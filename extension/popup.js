window.onerror = function(msg) { showError("Error: " + msg); };
window.onunhandledrejection = function(e) { showError("Async Error: " + (e.reason || e)); };

async function getActiveTabASIN() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    if (!tab || !tab.url) return null;
    const match = tab.url.match(/(?:dp|o|ASIN|product)\/([a-zA-Z0-9]{10})/i);
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
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch("http://localhost:8000/api/get/price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: uid }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (data.status === "success" && Array.isArray(data.response) && data.response.length > 0) {
            processData(uid, data.response);
        } else {
            showError("No price history found. Refresh the page to log the first price.");
        }
    } catch (error) {
        showError("Could not connect to backend server. Ensure Docker is running.");
    }
}

function processData(uid, history) {
    chrome.storage.local.get([`mrp_${uid}`], function(result) {
        const mrp = result[`mrp_${uid}`] ? parseFloat(result[`mrp_${uid}`]) : null;
        renderData(history, mrp);
    });
}

function renderData(history, mrp) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    const labels = [];
    const prices = [];
    let min = Infinity, max = -Infinity, sum = 0;

    history.forEach(entry => {
        const date = new Date(entry.timestamp);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const p = parseFloat(String(entry.price).replace(/[^\d]/g, ''));
        if (!isNaN(p)) {
            prices.push(p);
            if (p < min) min = p;
            if (p > max) max = p;
            sum += p;
        }
    });

    if (prices.length === 0) {
        showError("No valid numerical data found.");
        return;
    }

    const avg = Math.round(sum / prices.length);
    const current = prices[prices.length - 1]; 
    const previous = prices.length > 1 ? prices[prices.length - 2] : current;

    let pctChange = 0;
    if (prices.length > 1 && previous > 0) pctChange = ((current - previous) / previous) * 100;

    const changeEl = document.getElementById('priceChange');
    if (prices.length === 1) {
        changeEl.innerText = `NEW`;
        changeEl.style.backgroundColor = 'var(--accent)';
        changeEl.style.color = '#fff';
    } else if (pctChange < -0.5) { 
        changeEl.innerText = `-${Math.abs(pctChange).toFixed(1)}%`;
        changeEl.style.backgroundColor = 'var(--success-bg)';
        changeEl.style.color = 'var(--success)';
    } else if (pctChange > 0.5) { 
        changeEl.innerText = `+${pctChange.toFixed(1)}%`;
        changeEl.style.backgroundColor = 'var(--danger-bg)';
        changeEl.style.color = 'var(--danger)';
    } else { 
        changeEl.innerText = `0.0%`;
        changeEl.style.backgroundColor = 'var(--bg-base)';
        changeEl.style.color = 'var(--text-muted)';
    }

    const spread = max - min;
    const volatilityPct = (spread / avg) * 100;
    const volEl = document.getElementById('volatility');
    
    if (prices.length === 1) { volEl.innerText = "N/A"; volEl.style.color = "var(--text-muted)"; }
    else if (volatilityPct > 12) { volEl.innerText = "HIGH"; volEl.style.color = "var(--danger)"; }
    else if (volatilityPct > 5) { volEl.innerText = "MED"; volEl.style.color = "var(--warning)"; }
    else { volEl.innerText = "LOW"; volEl.style.color = "var(--success)"; }

    const verdictBox = document.getElementById('verdictBox');
    verdictBox.style.display = 'block';
    
    if (prices.length === 1) {
        verdictBox.innerText = "Tracking Started (Awaiting data)";
        verdictBox.style.backgroundColor = '#eef3fa';
        verdictBox.style.color = '#3584e4';
        verdictBox.style.border = '1px solid #dce8f8';
    } else if (current >= avg * 0.95) {
        if (mrp && mrp > current) {
            const amazonClaim = (((mrp - current) / mrp) * 100).toFixed(0);
            verdictBox.innerText = `Fake Discount (Claims ${amazonClaim}% off, actual price is normal)`;
        } else {
            verdictBox.innerText = "No active discount";
        }
        verdictBox.style.backgroundColor = 'var(--danger-bg)';
        verdictBox.style.color = 'var(--danger)';
        verdictBox.style.border = '1px solid #f6d1d1';
    } else {
        const truePct = (((avg - current) / avg) * 100).toFixed(0);
        if (mrp && mrp > current) {
            const amazonClaim = (((mrp - current) / mrp) * 100).toFixed(0);
            if (amazonClaim > truePct) {
                verdictBox.innerText = `Exaggerated Deal (Claims ${amazonClaim}%, Actually ${truePct}% below avg)`;
                verdictBox.style.backgroundColor = 'var(--warning-bg)';
                verdictBox.style.color = 'var(--warning)';
                verdictBox.style.border = '1px solid #f9e2a3';
            } else {
                verdictBox.innerText = `Genuine Deal (${truePct}% below avg)`;
                verdictBox.style.backgroundColor = 'var(--success-bg)';
                verdictBox.style.color = 'var(--success)';
                verdictBox.style.border = '1px solid #cce5d7';
            }
        } else {
            verdictBox.innerText = `Genuine Deal (${truePct}% below avg)`;
            verdictBox.style.backgroundColor = 'var(--success-bg)';
            verdictBox.style.color = 'var(--success)';
            verdictBox.style.border = '1px solid #cce5d7';
        }
    }

    document.getElementById('currentPrice').innerText = '₹' + current.toLocaleString('en-IN');

    const ctx = document.getElementById('priceChart').getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(53, 132, 228, 0.15)');
    gradient.addColorStop(1, 'rgba(53, 132, 228, 0.0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: prices,
                borderColor: '#3584e4',
                backgroundColor: gradient,
                borderWidth: 2.5,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#3584e4',
                pointBorderWidth: 2,
                pointRadius: prices.length === 1 ? 4 : 0, 
                pointHoverRadius: 5,
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
                    backgroundColor: '#ffffff',
                    titleColor: '#6e6e6e',
                    bodyColor: '#242424',
                    borderColor: '#e4e4e4',
                    borderWidth: 1,
                    padding: 8,
                    displayColors: false,
                    bodyFont: { weight: 'bold', family: 'Adwaita Sans' },
                    titleFont: { family: 'Adwaita Sans' },
                    callbacks: { label: function(context) { return '₹' + context.parsed.y.toLocaleString('en-IN'); } }
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    offset: true,
                    ticks: { maxTicksLimit: 4, color: '#242424', font: { family: 'Adwaita Sans', weight: '600' } } 
                },
                y: { 
                    border: { display: false }, 
                    grid: { color: '#f4f5f5' }, 
                    ticks: { maxTicksLimit: 4, color: '#242424', font: { family: 'Adwaita Sans', weight: '600' }, callback: function(value) { return '₹' + value.toLocaleString('en-IN'); } },
                    suggestedMin: current * 0.95,
                    suggestedMax: current * 1.05
                }
            }
        }
    });
}

loadPriceHistory();