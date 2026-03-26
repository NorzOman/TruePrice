chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SAVE_PRICE") {
        fetch("http://localhost:8000/api/post/price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request.data)
        })
        .then(response => response.json())
        .catch(error => console.error("TruePrice API Error:", error));
    }
});
