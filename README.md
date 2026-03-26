# TruePrice – Detect Fake Discounts & Track Product Price History

TruePrice is a full-stack browser extension and containerized C++ backend designed to expose misleading e-commerce discounts. Instead of relying on easily manipulated "M.R.P." (Maximum Retail Price) tags, TruePrice tracks the actual historical selling price of an item to determine if a sale is a genuine deal or a psychological pricing trick.

## Key Features

* **Real-Time Price Tracking:** Automatically logs the exact selling price of Amazon products as you browse.
* **Deceptive Discount Detection:** Compares the website's advertised discount against a true 30-day historical average to expose inflated M.R.P. claims.
* **Market Volatility Metric:** Calculates price fluctuations to inform users if a product's price is highly unstable.
* **In-Memory C++ Database:** Ultra-fast, lightweight custom backend handling concurrent price logging.
* **Modern UI:** Clean, WhiteSur-inspired interface utilizing Adwaita Sans and Chart.js for beautiful data visualization.

## Architecture Stack

**Frontend (Browser Extension)**
* **Core:** JavaScript (Manifest V3 API)
* **Communication:** Background Service Workers (CORS bypass)
* **Data Visualization:** Chart.js (Local dependency for CSP compliance)
* **Styling:** Custom CSS

**Backend (Server)**
* **Language:** C++17
* **Framework:** Crow (C++ Microframework)
* **Networking:** Standalone ASIO (asio-dev)
* **Database:** nlohmann/json (In-Memory JSON store)
* **Infrastructure:** Docker & Linux

---

## Installation & Setup

### Prerequisites
* Docker Desktop installed and running.
* A Chromium-based browser (Chrome, Brave, Edge).

### 1. Spin up the Backend (Docker)
The backend is completely containerized. You do not need a local C++ compiler to run it.

```
# Clone the repository
git clone https://github.com/NorzOman/TruePrice.git
cd TruePrice/server

# Build the Docker image (Compiles the C++ code automatically)
docker build -t trueprice-backend .
```

### 2. Install the Extension (Frontend)
1. Open your browser and navigate to the extensions management page.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension/` folder from this repository.
4. Pin the TruePrice icon to your browser toolbar for quick access.

---

### 3. Run the server on port 8000
```
docker run -p 8000:8000 trueprice-backend
```
