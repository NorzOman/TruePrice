// Get ASIN from the active tab's URL
async function getActiveTabASIN() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    if (!tab || !tab.url) return null;
    
    const match = tab.url.match(/([a-zA-Z0-9]{10})(?:[/?]|$)/);
    return match ? match[1] : null;
}

async function loadPriceHistory() {
    const uid = await getActiveTabASIN();
    
    if (!uid) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        return;
    }

    try {
        // Fetch history from your C++ backend
        const response = await fetch("http://localhost:8000/api/get/price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid: uid })
        });
        
        const data = await response.json();
        
        if (data.status === "success" && data.response && data.response.length > 0) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('content').style.display = 'block';
            
            renderData(data.response);
        } else {
            throw new Error("No data");
        }
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
    }
}

function renderData(history) {
    // history looks like: [{timestamp: "...", price: "50000"}, ...]
    
    const labels = [];
    const prices = [];
    let min = Infinity, max = -Infinity, sum = 0;

    history.forEach(entry => {
        // Format timestamp to readable date
        const date = new Date(entry.timestamp).toLocaleDateString();
        labels.push(date);
        
        const p = parseFloat(entry.price);
        prices.push(p);
        
        if (p < min) min = p;
        if (p > max) max = p;
        sum += p;
    });

    const avg = Math.round(sum / prices.length);

    // Update UI Stats
    document.getElementById('minPrice').innerText = '₹' + min;
    document.getElementById('maxPrice').innerText = '₹' + max;
    document.getElementById('avgPrice').innerText = '₹' + avg;

    // Draw Chart
    const ctx = document.getElementById('priceChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price (₹)',
                data: prices,
                borderColor: '#1976d2',
                backgroundColor: 'rgba(25, 118, 210, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}

// Start execution
loadPriceHistory();