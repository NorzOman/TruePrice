function getASIN() {
    const match = window.location.href.match(/(?:dp|o|ASIN|product)\/([a-zA-Z0-9]{10})/i);
    if (match) return match[1].toUpperCase();
    const hiddenAsin = document.querySelector('#ASIN');
    return hiddenAsin ? hiddenAsin.value : null;
}

function getAmazonPrice() {
    const priceElement = document.querySelector('.a-price-whole');
    return priceElement ? priceElement.innerText.replace(/[^\d]/g, '') : null;
}

function getAmazonMRP() {
    const mrpElement = document.querySelector('.a-text-price span[aria-hidden="true"]');
    return mrpElement ? mrpElement.innerText.replace(/[^\d]/g, '') : null;
}

function processProduct() {
    const uid = getASIN();
    const price = getAmazonPrice();
    const mrp = getAmazonMRP();

    if (!uid || !price) return;

    // Save MRP to local storage so the popup can use it for mismatch logic
    if (mrp) {
        let storageObj = {};
        storageObj[`mrp_${uid}`] = mrp;
        chrome.storage.local.set(storageObj);
    }

    const data = {
        uid: uid,
        timestamp: new Date().toISOString(),
        price: price
    };

    chrome.runtime.sendMessage({ type: "SAVE_PRICE", data: data });
}

setTimeout(processProduct, 1500);
