// Function to extract Amazon's unique product ID (ASIN) from the URL
function getASIN() {
    const match = window.location.href.match(/([a-zA-Z0-9]{10})(?:[/?]|$)/);
    return match ? match[1] : null;
}

// Function to get the current date in YYYY-MM-DD format (for local storage tracking)
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// Function to scrape the price
function getAmazonPrice() {
    const priceElement = document.querySelector('.a-price-whole');
    if (!priceElement) return null;
    // Remove commas and dots to get a clean number string
    return priceElement.innerText.replace(/,/g, '').replace(/\./g, '').trim();
}

async function processProduct() {
    const uid = getASIN();
    const price = getAmazonPrice();

    if (!uid || !price) return; // Not a valid product page

    const today = getTodayDate();
    const storageKey = `trueprice_${uid}_${today}`;

    // 1. Check local storage to prevent duplicate sends on the same day
    chrome.storage.local.get([storageKey], async function(result) {
        if (result[storageKey]) {
            console.log("TruePrice: Price already recorded today for this product.");
            return;
        }

        // 2. Prepare data for C++ backend
        const data = {
            uid: uid,
            timestamp: new Date().toISOString(),
            price: price
        };

        // 3. Send to C++ Server
        try {
            const response = await fetch("http://localhost:8000/api/post/price", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                console.log("TruePrice: Successfully saved price to database!");
                // 4. Mark as saved in local storage for today
                let storageObj = {};
                storageObj[storageKey] = true;
                chrome.storage.local.set(storageObj);
            }
        } catch (error) {
            console.error("TruePrice: Failed to connect to backend API.", error);
        }
    });
}

// Run the script
processProduct();