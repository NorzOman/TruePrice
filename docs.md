## TruePrice Docs

This document covers:
- **Tech stack**
- **API routes** (request/response shapes)
- **Running the backend from a release tar**
- **How the extension talks to the backend**

---

## Tech stack

### Extension
- **Manifest**: Chrome Extension Manifest V3 (`extension/manifest.json`)
- **Content script**: Reads ASIN + current price from Amazon product pages (`extension/content.js`)
- **Popup UI**: HTML/CSS + vanilla JS (`extension/popup.html`, `extension/popup.js`)
- **Dashboard UI**: HTML/CSS + vanilla JS (`extension/dashboard.html`, `extension/dashboard.js`)
- **Charts**: Chart.js (`extension/chart.js`)
- **Storage**: `chrome.storage.local` (tracked ASIN list + product titles)

### Backend
- **Runtime**: Python 3.11
- **Framework**: Flask
- **Data store**: In-memory dict (resets when container restarts)
- **Container**: Docker (`server/Dockerfile`)

---

## Data model

### PriceEntry

```json
{
  "timestamp": "2026-04-03T10:12:48.608Z",
  "price": 24990
}
```

Notes:
- `timestamp` should be **ISO-8601**. (If your flood script generates non-zero-padded dates, the UI will try to normalize, but ISO is recommended.)
- `price` may be a number or a numeric string; the UI extracts digits.

---

## API

Base URL (default): `http://localhost:8000`

All responses are JSON with the shape:

```json
{
  "status": "success",
  "response": "..."
}
```

or

```json
{
  "status": "error",
  "response": "Error message"
}
```

### GET `/api/health`

**Purpose**: Simple health check.

**Request**: no body

**Success response**:

```json
{
  "status": "success",
  "response": "200 Health OK"
}
```

---

### POST `/api/post/price`

**Purpose**: Append a price sample for a product.

**Request body**:

```json
{
  "uid": "B0FFM8M9B5",
  "timestamp": "2026-04-03T10:12:48.608Z",
  "price": 24990
}
```

**Success response**:

```json
{
  "status": "success",
  "response": "Data entered succesfully"
}
```

**Error cases**:
- Missing any of `uid`, `timestamp`, `price`

```json
{
  "status": "error",
  "response": "Missing feilds in the json body"
}
```

---

### POST `/api/get/price`

**Purpose**: Get stored price history for a product.

**Request body**:

```json
{
  "uid": "B0FFM8M9B5"
}
```

**Success response**:

```json
{
  "status": "success",
  "response": [
    { "price": "24990", "timestamp": "2026-04-03T10:12:48.608Z" },
    { "price": 24260,   "timestamp": "2026-03-01T09:47:07.377Z" }
  ]
}
```

Notes:
- The server currently returns whatever order it stored. The UI sorts by timestamp for charting.
- The UI also dedupes points by day for display (keeps the latest sample in a day).

**Error cases**:
- Missing `uid`

```json
{
  "status": "error",
  "response": "Missing feilds in the json body"
}
```

---

### GET `/api/admin/dump`

**Purpose**: Dump the entire in-memory DB (all products and their entries).

**Request**: no body

**Success response**:

```json
{
  "status": "success",
  "response": {
    "B0FFM8M9B5": [
      { "timestamp": "2026-04-03T10:12:48.608Z", "price": 24990 }
    ]
  }
}
```

---

## Running the backend from a release `.tar`

If you downloaded a Docker image tarball from the Releases page (example: `trueprice-backend.tar`):

1) Load the image:

```bash
docker load -i trueprice-backend.tar
```

Docker will print something like:
- `Loaded image: trueprice-backend:latest`

2) Run it on port 8000:

```bash
docker run --rm -p 8000:8000 trueprice-backend:latest
```

If your tar loads under a different name/tag, use the name Docker prints in step (1).

---

## How the extension works (high level)

### Tracking (content script)
- On Amazon product pages, `extension/content.js` extracts:
  - **ASIN**
  - **Product title** (prefers `#productTitle`)
  - **Current price**
- It stores the ASIN list + titles in `chrome.storage.local`
- It sends a `SAVE_PRICE` message to the background worker to persist the price sample via the backend API.

### Popup
- Uses the active tab URL to extract ASIN
- Fetches history from `/api/get/price`
- Displays:
  - current price
  - min/max/day count
  - chart with hover tooltips and min/max markers

### Dashboard
- Reads tracked ASINs from `chrome.storage.local`
- Fetches each product’s history from `/api/get/price`
- Renders cards with:
  - product title
  - latest price
  - min/max summary
  - mini chart
  - Open on Amazon button (`https://www.amazon.in/dp/<ASIN>`)

