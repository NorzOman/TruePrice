window.onerror = function(msg) { showError("Error: " + msg); };
window.onunhandledrejection = function(e) { showError("Async Error: " + (e.reason || e)); };

let chartInstance = null;

function getThemeColor(varName, fallback) {
    try {
        const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
        return v || fallback;
    } catch (e) {
        return fallback;
    }
}

function normalizeTimestamp(ts) {
    const raw = String(ts || "").trim();
    // Accept proper ISO as-is.
    const d0 = new Date(raw);
    if (!Number.isNaN(d0.getTime())) return d0;

    // Fix common fake-data format: YYYY-MM-DTHH:mm:ss.sssZ or YYYY-M-D...
    // Example bad: 2026-03-1T09:47:07.377Z
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

function extractNumericPrice(value) {
    const n = parseFloat(String(value).replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : null;
}

/** Backend may return newest-first; chart must be oldest → newest. */
function sortHistoryByTimestampAsc(history) {
    return [...history].sort((a, b) => {
        const da = normalizeTimestamp(a.timestamp);
        const db = normalizeTimestamp(b.timestamp);
        const ta = da ? da.getTime() : 0;
        const tb = db ? db.getTime() : 0;
        return ta - tb;
    });
}

// Collapse multiple samples from the same calendar day into a single point.
// Keeps the last sample of the day (highest timestamp).
function dedupeHistoryByDay(historyAsc) {
    const byDay = new Map(); // YYYY-MM-DD -> { timestamp, price }
    for (const entry of historyAsc) {
        const d = normalizeTimestamp(entry.timestamp);
        const p = extractNumericPrice(entry.price);
        if (!d || p == null) continue;
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

async function getCurrentPagePrice() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const whole = document.querySelector('.a-price-whole')?.textContent || "";
                const frac = document.querySelector('.a-price-fraction')?.textContent || "";
                const raw = `${whole}.${frac}`.trim();
                const cleaned = raw.replace(/[^\d.]/g, "");
                const num = parseFloat(cleaned);
                if (!Number.isFinite(num)) return null;
                // Amazon often shows whole with commas; normalize to integer when fraction missing.
                return Math.round(num);
            }
        });
        return results?.[0]?.result ?? null;
    } catch (e) {
        return null;
    }
}

async function getActiveTabASIN() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    if (!tab || !tab.url) return null;
    const url = tab.url;
    const match =
      url.match(/\/dp\/([a-zA-Z0-9]{10})/i) ||
      url.match(/\/gp\/product\/([a-zA-Z0-9]{10})/i) ||
      url.match(/\/ASIN\/([a-zA-Z0-9]{10})/i) ||
      url.match(/\/product\/([a-zA-Z0-9]{10})/i) ||
      url.match(/\/o\/([a-zA-Z0-9]{10})/i) ||
      url.match(/[?&]asin=([a-zA-Z0-9]{10})/i);

    return match ? match[1].toUpperCase() : null;
}

function showError(message) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'block';
    errorDiv.innerText = message;
}

async function loadPriceHistory() {
    document.getElementById('loading').style.display = 'block';
    const uid = await getActiveTabASIN();

    if (!uid) {
        showError("Please open an Amazon product page to track prices.");
        return;
    }
    
    let data;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch("http://localhost:8000/api/get/price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: uid }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            showError(`Backend error (${response.status}). ${text || "No response body."}`);
            return;
        }

        data = await response.json();
    } catch (error) {
        const msg = (error && (error.name || error.message)) ? `${error.name || "Error"}: ${error.message || ""}`.trim() : String(error);
        if (error && error.name === "AbortError") {
            showError("Backend request timed out. Make sure the server is running and reachable at localhost:8000.");
            return;
        }
        showError(`Could not reach backend server. ${msg}`);
        return;
    }
        
    try {
        if (data && data.status === "success" && Array.isArray(data.response) && data.response.length > 0) {
            processData(uid, data.response);
            return;
        }

        // No history yet: show current price from the page (best-effort).
        const pagePrice = await getCurrentPagePrice();
        if (pagePrice != null) {
            renderSinglePrice(pagePrice);
            return;
        }

        showError("No price history yet.");
    } catch (e) {
        showError(`UI error: ${e && e.message ? e.message : String(e)}`);
    }
}

function processData(uid, history) {
    const sorted = sortHistoryByTimestampAsc(history);
    const deduped = dedupeHistoryByDay(sorted);
    renderData(deduped);
}

function renderSinglePrice(price) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('content').style.display = 'flex';

    document.getElementById('currentPrice').innerText = '₹' + Number(price).toLocaleString('en-IN');
    const changeEl = document.getElementById('priceChange');
    changeEl.innerText = 'LIVE';
    changeEl.style.backgroundColor = 'color-mix(in oklab, var(--primary) 18%, var(--card) 82%)';
    changeEl.style.borderColor = 'color-mix(in oklab, var(--primary) 55%, var(--border) 45%)';
    changeEl.style.color = 'var(--card-foreground)';

    document.getElementById('minStat').innerText = '-';
    document.getElementById('maxStat').innerText = '-';
    document.getElementById('daysStat').innerText = '0';

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    // Leave chart empty for now (no history).
}

function renderData(history) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('content').style.display = 'flex';

    const labels = [];
    const prices = [];
    const fullDates = [];
    let min = Infinity, max = -Infinity;
    let minIndex = -1;
    let maxIndex = -1;
    const dayKeys = new Set();

    history.forEach(entry => {
        const date = normalizeTimestamp(entry.timestamp);
        const p = extractNumericPrice(entry.price);
        if (!date || p == null) return;

        const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labels.push(dayLabel);
        fullDates.push(date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }));
        dayKeys.add(date.toISOString().slice(0, 10));

        prices.push(p);
        if (p < min) {
            min = p;
            minIndex = prices.length - 1;
        }
        if (p > max) {
            max = p;
            maxIndex = prices.length - 1;
        }
    });

    if (prices.length === 0) {
        showError("No valid numerical data found.");
        return;
    }

    const current = prices[prices.length - 1]; 
    const previous = prices.length > 1 ? prices[prices.length - 2] : current;

    let pctChange = 0;
    if (prices.length > 1 && previous > 0) pctChange = ((current - previous) / previous) * 100;

    const changeEl = document.getElementById('priceChange');
    if (prices.length === 1) {
        changeEl.innerText = `NEW`;
        changeEl.style.backgroundColor = 'color-mix(in oklab, var(--primary) 18%, var(--card) 82%)';
        changeEl.style.borderColor = 'color-mix(in oklab, var(--primary) 55%, var(--border) 45%)';
        changeEl.style.color = 'var(--card-foreground)';
    } else if (pctChange < -0.5) {
        changeEl.innerText = `-${Math.abs(pctChange).toFixed(1)}%`;
        changeEl.style.backgroundColor = 'color-mix(in oklab, var(--chart-2) 20%, var(--card) 80%)';
        changeEl.style.borderColor = 'color-mix(in oklab, var(--chart-2) 55%, var(--border) 45%)';
        changeEl.style.color = 'var(--card-foreground)';
    } else if (pctChange > 0.5) {
        changeEl.innerText = `+${pctChange.toFixed(1)}%`;
        changeEl.style.backgroundColor = 'color-mix(in oklab, var(--destructive) 18%, var(--card) 82%)';
        changeEl.style.borderColor = 'color-mix(in oklab, var(--destructive) 55%, var(--border) 45%)';
        changeEl.style.color = 'var(--card-foreground)';
    } else { 
        changeEl.innerText = `0.0%`;
        changeEl.style.backgroundColor = 'color-mix(in oklab, var(--muted) 55%, var(--card) 45%)';
        changeEl.style.borderColor = 'color-mix(in oklab, var(--border) 75%, transparent 25%)';
        changeEl.style.color = 'var(--muted-foreground)';
    }

    document.getElementById('currentPrice').innerText = '₹' + current.toLocaleString('en-IN');
    document.getElementById('minStat').innerText =
        minIndex >= 0 ? `₹${min.toLocaleString('en-IN')} • ${labels[minIndex]}` : '-';
    document.getElementById('maxStat').innerText =
        maxIndex >= 0 ? `₹${max.toLocaleString('en-IN')} • ${labels[maxIndex]}` : '-';
    document.getElementById('daysStat').innerText = String(dayKeys.size);

    const chartLine = getThemeColor('--chart-1', '#3794ff');
    const chartMin = getThemeColor('--chart-2', '#4ec9b0');
    const chartMax = getThemeColor('--destructive', '#f14c4c');

    const ctx = document.getElementById('priceChart').getContext('2d');
    // Canvas can’t apply alpha to OKLCH easily; use a neutral dark fill.
    let gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.00)');

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    const spread = max - min;
    const padding = Math.max(spread * 0.10, Math.max(25, current * 0.02));
    const yMin = Math.max(0, Math.floor(min - padding));
    const yMax = Math.ceil(max + padding);

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: prices,
                borderColor: chartLine,
                backgroundColor: gradient,
                borderWidth: 2.5,
                pointBackgroundColor: (context) => {
                    const i = context.dataIndex;
                    if (i === minIndex) return '#ffffff';
                    if (i === maxIndex) return '#ffffff';
                    return '#ffffff';
                },
                pointBorderColor: (context) => {
                    const i = context.dataIndex;
                    if (i === minIndex) return chartMin;
                    if (i === maxIndex) return chartMax;
                    return chartLine;
                },
                pointBorderWidth: (context) => {
                    const i = context.dataIndex;
                    if (i === minIndex || i === maxIndex) return 2.5;
                    return 0;
                },
                pointRadius: (context) => {
                    const i = context.dataIndex;
                    if (prices.length === 1) return 4;
                    if (i === minIndex || i === maxIndex) return 4;
                    return 0;
                },
                pointHoverRadius: (context) => {
                    const i = context.dataIndex;
                    if (i === minIndex || i === maxIndex) return 6;
                    return 5;
                },
                fill: true,
                tension: 0.3 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    right: 15
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: getThemeColor('--popover', '#252526'),
                    titleColor: getThemeColor('--muted-foreground', '#9da1a6'),
                    bodyColor: getThemeColor('--popover-foreground', '#d4d4d4'),
                    borderColor: getThemeColor('--border', 'rgba(212, 212, 212, 0.18)'),
                    borderWidth: 1,
                    padding: 8,
                    displayColors: false,
                    bodyFont: { weight: 'bold', family: 'Adwaita Sans' },
                    titleFont: { family: 'Adwaita Sans' },
                    callbacks: {
                        title: function(items) {
                            const i = items?.[0]?.dataIndex ?? -1;
                            if (i < 0) return '';
                            return fullDates[i] || labels[i] || '';
                        },
                        label: function(context) {
                            const i = context.dataIndex;
                            const price = context.parsed?.y;
                            const parts = [];
                            if (typeof price === 'number' && !Number.isNaN(price)) {
                                parts.push('₹' + price.toLocaleString('en-IN'));
                            }
                            if (i === minIndex) parts.push('(Min)');
                            if (i === maxIndex) parts.push('(Max)');
                            return parts.join(' ');
                        }
                    }
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    offset: true,
                    ticks: { maxTicksLimit: 4, color: getThemeColor('--muted-foreground', '#9da1a6'), font: { family: 'Adwaita Sans', weight: '600' } } 
                },
                y: { 
                    border: { display: false }, 
                    grid: { color: 'rgba(255, 255, 255, 0.08)' }, 
                    ticks: { maxTicksLimit: 4, color: getThemeColor('--muted-foreground', '#9da1a6'), font: { family: 'Adwaita Sans', weight: '600' }, callback: function(value) { return '₹' + value.toLocaleString('en-IN'); } },
                    min: yMin,
                    max: yMax
                }
            }
        }
    });
}

const btn = document.getElementById("dashboardBtn");
if (btn) {
  btn.addEventListener("click", () => {
    const url = chrome.runtime.getURL("dashboard.html");
    try {
      // Prefer `chrome.tabs.create` when permission is available.
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
        return;
      }
    } catch (e) {
      // Fall back to window.open below.
    }
    window.open(url, "_blank");
  });
}

loadPriceHistory();
