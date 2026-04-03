function formatPrice(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return "₹" + value.toLocaleString("en-IN");
}

function prettifyName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function openOnAmazon(asin) {
  const url = `https://www.amazon.in/dp/${encodeURIComponent(asin)}`;
  try {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
      return;
    }
  } catch (e) {
    // fallback below
  }
  window.open(url, "_blank");
}

function normalizeTimestamp(ts) {
  const raw = String(ts || "").trim();
  const d0 = new Date(raw);
  if (!Number.isNaN(d0.getTime())) return d0;

  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})T(.*)$/);
  if (!m) return null;
  const yyyy = m[1];
  const mm = String(m[2]).padStart(2, "0");
  const dd = String(m[3]).padStart(2, "0");
  const fixed = `${yyyy}-${mm}-${dd}T${m[4]}`;
  const d1 = new Date(fixed);
  if (!Number.isNaN(d1.getTime())) return d1;
  return null;
}

function sortHistoryByTimestampAsc(history) {
  return [...history].sort((a, b) => {
    const da = normalizeTimestamp(a.timestamp);
    const db = normalizeTimestamp(b.timestamp);
    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;
    return ta - tb;
  });
}

function dedupeHistoryByDay(historyAsc) {
  const byDay = new Map();
  for (const entry of historyAsc) {
    const d = normalizeTimestamp(entry.timestamp);
    const p = parseFloat(String(entry.price).replace(/[^\d]/g, ""));
    if (!d || !Number.isFinite(p)) continue;
    const dayKey = d.toISOString().slice(0, 10);
    const prev = byDay.get(dayKey);
    if (!prev || d.getTime() >= prev._t) {
      byDay.set(dayKey, { timestamp: d.toISOString(), price: p, _t: d.getTime() });
    }
  }
  return Array.from(byDay.values())
    .sort((a, b) => a._t - b._t)
    .map(({ _t, ...rest }) => rest);
}

async function fetchHistory(uid) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch("http://localhost:8000/api/get/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
      signal: controller.signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Backend error (${res.status}) ${text || ""}`.trim());
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCard({ uid, title, history }) {
  const card = document.createElement("div");
  card.className = "card";

  const top = document.createElement("div");
  top.className = "top";

  const nameWrap = document.createElement("div");
  nameWrap.className = "meta";

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.innerText = title || uid;
  nameEl.title = title || uid;

  const codeEl = document.createElement("div");
  codeEl.className = "code";
  codeEl.innerText = "ASIN: " + uid;

  nameWrap.appendChild(nameEl);
  nameWrap.appendChild(codeEl);

  const last = history[history.length - 1];
  const lastPrice = parseFloat(String(last.price).replace(/[^\d]/g, ""));

  const priceEl = document.createElement("div");
  priceEl.className = "price";
  priceEl.innerText = formatPrice(lastPrice);

  top.appendChild(nameWrap);
  top.appendChild(priceEl);

  const actionsRow = document.createElement("div");
  actionsRow.className = "actionsRow";

  const stats = document.createElement("div");
  stats.className = "stats";

  const openBtn = document.createElement("button");
  openBtn.className = "btn";
  openBtn.type = "button";
  openBtn.innerText = "Open on Amazon";
  openBtn.addEventListener("click", () => openOnAmazon(uid));

  actionsRow.appendChild(stats);
  actionsRow.appendChild(openBtn);

  const chartWrap = document.createElement("div");
  chartWrap.className = "chart";

  const canvas = document.createElement("canvas");
  chartWrap.appendChild(canvas);

  card.appendChild(top);
  card.appendChild(actionsRow);
  card.appendChild(chartWrap);

  const labels = [];
  const fullDates = [];
  const prices = [];
  let min = Infinity, max = -Infinity;
  let minIndex = -1, maxIndex = -1;

  history.forEach((e) => {
    const p = parseFloat(String(e.price).replace(/[^\d]/g, ""));
    const d = normalizeTimestamp(e.timestamp);
    if (!d || !Number.isFinite(p)) return;
    labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    fullDates.push(d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }));
    prices.push(p);
    if (p < min) { min = p; minIndex = prices.length - 1; }
    if (p > max) { max = p; maxIndex = prices.length - 1; }
  });

  // If we only have one point, duplicate it so Chart.js draws a line.
  if (prices.length === 1) {
    const d = normalizeTimestamp(history[0]?.timestamp) || new Date();
    const d2 = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    labels.push(d2.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    fullDates.push(d2.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }));
    prices.push(prices[0]);
    // keep markers on the first point
    minIndex = 0;
    maxIndex = 0;
  }

  if (Number.isFinite(min) && Number.isFinite(max) && prices.length > 0) {
    const minLabel = minIndex >= 0 ? `${formatPrice(min)} (min • ${labels[minIndex]})` : "";
    const maxLabel = maxIndex >= 0 ? `${formatPrice(max)} (max • ${labels[maxIndex]})` : "";
    stats.innerText = `${minLabel}  •  ${maxLabel}`;
  } else {
    stats.innerText = "Not enough data yet.";
  }

  const ctx = canvas.getContext("2d");
  const theme = getComputedStyle(document.body);
  const chartLine = theme.getPropertyValue("--chart-1").trim() || "#3794ff";
  const chartMin = theme.getPropertyValue("--chart-2").trim() || "#4ec9b0";
  const chartMax = theme.getPropertyValue("--destructive").trim() || "#f14c4c";

  const gradient = ctx.createLinearGradient(0, 0, 0, 160);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.18)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.00)");

  const spread = max - min;
  const padding = Math.max(spread * 0.10, Math.max(25, (Number.isFinite(lastPrice) ? lastPrice : 0) * 0.02));
  const yMin = Number.isFinite(min) ? Math.max(0, Math.floor(min - padding)) : undefined;
  const yMax = Number.isFinite(max) ? Math.ceil(max + padding) : undefined;

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: chartLine,
        backgroundColor: gradient,
        borderWidth: 2.25,
        fill: true,
        tension: 0.3,
        pointRadius: (context) => {
          const i = context.dataIndex;
          if (prices.length === 1) return 3.5;
          if (i === minIndex || i === maxIndex) return 3.5;
          return 0;
        },
        pointHoverRadius: 5,
        pointBorderWidth: (context) => {
          const i = context.dataIndex;
          if (i === minIndex || i === maxIndex) return 2.25;
          return 0;
        },
        pointBorderColor: (context) => {
          const i = context.dataIndex;
          if (i === minIndex) return chartMin;
          if (i === maxIndex) return chartMax;
          return chartLine;
        },
        pointBackgroundColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.getPropertyValue("--popover").trim() || "#252526",
          titleColor: theme.getPropertyValue("--muted-foreground").trim() || "#9da1a6",
          bodyColor: theme.getPropertyValue("--popover-foreground").trim() || "#d4d4d4",
          borderColor: theme.getPropertyValue("--border").trim() || "rgba(212, 212, 212, 0.18)",
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          callbacks: {
            title: (items) => {
              const i = items?.[0]?.dataIndex ?? -1;
              return i >= 0 ? (fullDates[i] || labels[i] || "") : "";
            },
            label: (context) => {
              const i = context.dataIndex;
              const y = context.parsed?.y;
              const parts = [formatPrice(y)];
              if (i === minIndex) parts.push("(Min)");
              if (i === maxIndex) parts.push("(Max)");
              return parts.join(" ");
            }
          }
        }
      },
      scales: {
        x: { display: false },
        y: { display: false, min: yMin, max: yMax }
      }
    }
  });

  return card;
}

async function loadDashboard() {
  const grid = document.getElementById("grid");
  const empty = document.getElementById("empty");
  grid.innerHTML = "";

  empty.style.display = "block";
  empty.innerText = "Loading tracked prices...";

  chrome.storage.local.get(["asins", "productNames"], async (result) => {
    const asins = result.asins || [];
    const productNames = result.productNames || {};

    if (asins.length === 0) {
      empty.innerText = "No tracked products yet.";
      return;
    }

    let renderedCount = 0;

    for (const uid of asins) {
      try {
        const data = await fetchHistory(uid);
        if (data.status !== "success" || !Array.isArray(data.response) || data.response.length === 0) continue;

        const rawName = productNames[uid] || uid;
        const title = prettifyName(rawName) || uid;
        const sorted = sortHistoryByTimestampAsc(data.response);
        const deduped = dedupeHistoryByDay(sorted);
        const card = buildCard({ uid, title, history: deduped });
        grid.appendChild(card);

        renderedCount += 1;
      } catch (err) {
        console.error("Error loading:", uid, err);
      }
    }

    if (renderedCount === 0) {
      empty.innerText = "No tracked products yet.";
      empty.style.display = "block";
    } else {
      empty.style.display = "none";
    }
  });
}

loadDashboard();

