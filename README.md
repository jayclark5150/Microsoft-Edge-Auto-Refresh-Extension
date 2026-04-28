# Microsoft Edge Auto Refresh Extension

A lightweight Microsoft Edge extension that automatically refreshes a webpage at a configurable interval. Designed for dashboards, admin consoles, status pages, and other web pages that need periodic refreshing.

## Features

- Refresh a page on a set interval (seconds or minutes)
- Limit refreshing to a **specific URL**
- Optional **URL prefix matching** (useful for pages with query strings)
- Independent refresh timers per tab
- Automatically stops when the tab is closed
- Simple, clean popup interface

## Installation (Developer Mode)

1. Clone or download this repository
2. Open Microsoft Edge
3. Navigate to `edge://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked**
6. Select the folder containing these files
7. Click the extension icon, configure the refresh, and start it

## Usage

1. Open the webpage you want to auto‑refresh
2. Click the extension icon
3. Confirm or edit the **Target URL**
4. Choose the refresh interval and unit
5. Click **Start**

The page will only refresh if the tab URL matches the configured target.

### URL Matching Options

- **Match prefix** (default):  
  Refreshes as long as the current URL starts with the target URL  
  (recommended for sites with changing parameters)

- **Exact match**:  
  Refreshes only when the URL matches exactly

## Files

| File | Description |
|-----|-------------|
| `manifest.json` | Extension configuration |
| `popup.html` | Popup user interface |
| `popup.css` | Popup styling |
| `popup.js` | Popup logic |
| `background.js` | Background service worker logic |

## Notes

- This extension does **not** bypass cache by default  
  (can be changed in `background.js` if needed)
- Designed for Chromium‑based Edge (Manifest V3)

## License

MIT License
