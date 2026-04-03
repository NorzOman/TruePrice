function getASIN() {
    const href = window.location.href;
    // Common URL patterns on Amazon product pages.
    const match =
        href.match(/\/dp\/([a-zA-Z0-9]{10})/i) ||
        href.match(/\/gp\/product\/([a-zA-Z0-9]{10})/i) ||
        href.match(/\/ASIN\/([a-zA-Z0-9]{10})/i) ||
        href.match(/\/product\/([a-zA-Z0-9]{10})/i) ||
        href.match(/\/o\/([a-zA-Z0-9]{10})/i);

    if (match) return match[1].toUpperCase();

    // Common places the ASIN appears in the DOM.
    const fromHiddenInput =
        document.querySelector('#ASIN')?.value ||
        document.querySelector('input[name="ASIN"]')?.value;
    if (fromHiddenInput) return String(fromHiddenInput).toUpperCase();

    const fromMeta = document.querySelector('meta[itemprop="sku"]')?.getAttribute('content');
    if (fromMeta) return String(fromMeta).toUpperCase();

    const fromDataAsin = document.querySelector('[data-asin]')?.getAttribute('data-asin');
    if (fromDataAsin) return String(fromDataAsin).toUpperCase();

    return null;
}

function getAmazonPrice() {
    const priceElement = document.querySelector('.a-price-whole');
    return priceElement ? priceElement.innerText.replace(/[^\d]/g, '') : null;
}

function getProductSlugFromUrl() {
    const href = window.location.href;
    // For URLs like: /Dell-i5-1334U-.../dp/B0D2Y1BLDT
    const match =
        href.match(/\/([^/?#]+)\/dp\/[a-zA-Z0-9]{10}/i) ||
        href.match(/\/([^/?#]+)\/gp\/product\/[a-zA-Z0-9]{10}/i);

    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch (e) {
        return match[1];
    }
}

function getProductTitleFromDom() {
    const titleEl = document.querySelector('#productTitle');
    const title = titleEl ? titleEl.textContent : null;
    return title ? String(title).replace(/\s+/g, ' ').trim() : null;
}

function upsertAsin(uid) {
    if (!uid) return;

    chrome.storage.local.get(["asins"], (result) => {
        const asins = result.asins || [];
        if (asins.includes(uid)) return;
        asins.push(uid);
        chrome.storage.local.set({ asins });
    });
}

function upsertProductName(uid, name) {
    if (!uid || !name) return;
    chrome.storage.local.get(["productNames"], (result) => {
        const productNames = result.productNames || {};
        if (productNames[uid]) return;
        productNames[uid] = name;
        chrome.storage.local.set({ productNames });
    });
}

function sendPrice(uid, price) {
    if (!uid || !price) return;
    chrome.runtime.sendMessage({
        type: "SAVE_PRICE",
        data: {
            uid,
            timestamp: new Date().toISOString(),
            price
        }
    });
}

function shouldSendPrice(uid, price) {
    const dayKey = new Date().toISOString().slice(0, 10);
    const key = `lastSent_${uid}`;
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            const prev = result[key];
            if (prev && prev.dayKey === dayKey && String(prev.price) === String(price)) {
                resolve(false);
                return;
            }
            chrome.storage.local.set({ [key]: { dayKey, price } }, () => resolve(true));
        });
    });
}

function startTracking() {
    let asinSaved = false;
    let priceSent = false;
    let nameSaved = false;
    let lastUid = null;

    const MAX_ATTEMPTS = 20; // ~10s (500ms interval)
    const INTERVAL_MS = 500;

    const tick = () => {
        const uid = getASIN();
        const price = getAmazonPrice();

        // If navigation changes (or ASIN couldn't be read initially), reset flags.
        if (uid && uid !== lastUid) {
            lastUid = uid;
            asinSaved = false;
            priceSent = false;
            nameSaved = false;
        }

        if (uid && !asinSaved) {
            asinSaved = true;
            upsertAsin(uid);
        }

        if (uid && !nameSaved) {
            nameSaved = true;
            const domTitle = getProductTitleFromDom();
            const slug = getProductSlugFromUrl();
            // Prefer real product title when available; fall back to URL slug.
            upsertProductName(uid, domTitle || slug || uid);
        }

        // Only send price when both ASIN + price are available.
        if (uid && price && !priceSent) {
            shouldSendPrice(uid, price).then((ok) => {
                if (!ok) {
                    priceSent = true;
                    return;
                }
                priceSent = true;
                sendPrice(uid, price);
            });
        }
    };

    let attempts = 0;
    const intervalId = setInterval(() => {
        attempts += 1;
        tick();

        if (priceSent || attempts >= MAX_ATTEMPTS) {
            clearInterval(intervalId);
        }
    }, INTERVAL_MS);

    // Run once immediately so fast-rendering pages work without delay.
    tick();
}

startTracking();
