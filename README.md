# TruePrice – Detect Fake Discounts & Track Product Price History

TruePrice is a browser extension and backend system that helps users detect **fake discounts** and understand the **real price** of products across e-commerce platforms.

Many online stores inflate the *“original price”* to show large discounts. **TruePrice** solves this by tracking historical prices and showing users the **actual minimum, average, and maximum price** for a product.

The extension displays a **price history graph** and determines whether the current discount is **genuine or misleading**.

---

## 🚀 Features

### 1. Fake Discount Detection

Analyzes historical price data to determine whether a discount is legitimate.

**Example**

```
Claimed price: ₹9,999 → ₹4,999 (50% OFF)

Historical analysis:
Average price: ₹4,850

Result:
⚠ Discount is misleading — product usually sells near the current price.
```

---

### 2. Price History Tracking

TruePrice continuously tracks product prices and stores them in a database.

**Stored metrics include:**

- Current price  
- Minimum historical price  
- Maximum historical price  
- Average price  
- Median price  
- Timestamped price history  

---

### 3. Price Graph Visualization

Users can view a **visual price trend directly inside the browser**.

The graph shows:

- Historical price movement  
- Price spikes  
- Seasonal discounts  
- Lowest historical price  

---

### 4. Cross-Site Tracking

TruePrice can monitor products across multiple websites including:

- Amazon  
- Flipkart  
- Myntra  
- Ajio  
- Other major e-commerce stores  

---

### 5. Crowdsourced Price Collection

When a user visits a product page:

1. The extension extracts the product price.
2. The price is sent to the backend API.
3. The backend stores the data as a new price entry.

Over time this builds a **large price history dataset**.

---

## 🧠 How It Works

1. User visits an e-commerce product page.
2. The browser extension extracts the product price and metadata.
3. The data is sent to the **TruePrice backend API**.
4. The backend stores it in the **price history database**.
5. The extension retrieves historical data and displays:
   - Price graph
   - Discount analysis
   - Historical statistics

---

## 📊 Example Output

- Current Price: ₹4,999  
- Average Price: ₹4,850  
- Lowest Price: ₹4,200  
- Highest Price: ₹9,999  

**Discount Analysis:**  
⚠ The current discount is likely **misleading**.

---

## 🎯 Goal

Help users **avoid fake discounts**, make **smarter buying decisions**, and increase **transparency in e-commerce pricing**.

---

## 🛠 Future Improvements

- AI-based discount authenticity scoring  
- Deal alerts when price drops below historical average  
- Mobile app integration  
- Support for more international e-commerce platforms  

---

## 📄 License

MIT License
