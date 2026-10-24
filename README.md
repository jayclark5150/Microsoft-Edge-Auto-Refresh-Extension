## Microsoft Edge Auto Refresh Extension

A lightweight Microsoft Edge extension that automatically refreshes a webpage at a configurable interval. Designed for dashboards, admin consoles, status pages, and other web pages that need periodic refreshing.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue) ![Version](https://img.shields.io/badge/version-1.2.1-green)

### Features
- Refresh a page on a set interval (seconds or minutes)
- Limit refreshing to a **specific URL**
- Optional **URL prefix matching** (useful for pages with query strings)
- Optional **bypass cache** on each refresh
- Independent refresh timers per tab
- **Live countdown badge** on the toolbar icon while the popup is open (green → orange → red as refresh approaches); the badge shows **ON** while a refresh is active and the popup is closed
- **Popup countdown** text ("Next refresh in Ns")
- Automatically stops when the tab is closed or the browser restarts
- Simple, clean popup interface
- Privacy-friendly: tab access is requested only when needed, not at install
- Restricts refresh targets to `http:` and `https:` URLs only
- Origin-aware URL matching prevents cross-domain false matches

### Installation (Developer Mode)
- Clone or download this repository
- Open Microsoft Edge
- Navigate to edge://extensions/
- Enable **Developer mode**
- Click **Load unpacked**
- Select the folder containing these files
- Click the extension icon, configure the refresh, and start it

### Usage
- Open the webpage you want to auto-refresh
- Click the extension icon
- Confirm or edit the **Target URL**
- Choose the refresh interval and unit (minimum 30 seconds)
- Optionally check **Bypass cache on refresh**
- Click **Start**

The page will only refresh if the tab URL matches the configured target.

#### URL Matching Options
- **Match prefix** (default):
Refreshes as long as the current URL's origin matches the target and the current path starts with the target path, compared on whole path segments (a target of `/app` matches `/app` and `/app/page` but not `/application`)
(recommended for sites with changing parameters)
- **Exact match**:
Refreshes only when the URL matches exactly

#### Countdown Badge
While the popup is open, the toolbar badge shows the seconds remaining:
- **Green** — more than 10 seconds remain
- **Orange** — 6 to 10 seconds remain
- **Red** — 5 seconds or less until refresh

When the popup is closed, the badge shows **ON** (green) for any tab with an active refresh. A browser extension cannot tick once per second in the background, so the live countdown is only shown while the popup is open.

### Permissions

<table>
<tr>
<th>  
Permission
</th>
<th>  
Purpose
</th>
<th>  
When requested
</th>
</tr>
<tr>
<td>  
alarms
</td>
<td>  
Schedule periodic refresh timers
</td>
<td>  
At install
</td>
</tr>
<tr>
<td>  
storage
</td>
<td>  
Save active refresh configurations
</td>
<td>  
At install
</td>
</tr>
<tr>
<td>  
activeTab
</td>
<td>  
Read the current tab's URL to pre-fill the popup
</td>
<td>  
At install
</td>
</tr>
<tr>
<td>  
tabs
</td>
<td>  
Check tab URLs during background refresh
</td>
<td>  
At first use (optional)
</td>
</tr>
</table>


### Files

<table>
<tr>
<th>  
File
</th>
<th>  
Description
</th>
</tr>
<tr>
<td>  
manifest.json
</td>
<td>  
Extension configuration (Manifest V3)
</td>
</tr>
<tr>
<td>  
popup.html
</td>
<td>  
Popup user interface
</td>
</tr>
<tr>
<td>  
popup.css
</td>
<td>  
Popup styling
</td>
</tr>
<tr>
<td>  
popup.js
</td>
<td>  
Popup logic, permission handling, and live countdown
</td>
</tr>
<tr>
<td>  
background.js
</td>
<td>  
Background service worker, alarms, badge updates, and tab cleanup
</td>
</tr>
<tr>
<td>  
icons/
</td>
<td>  
Extension icons (16, 32, 48, 128 px)
</td>
</tr>
</table>


### Notes
- The extension does **not** bypass the cache unless you check **Bypass cache on refresh** in the popup
- Designed for Chromium-based Edge (Manifest V3)
- Alarms and storage are automatically cleared on browser restart
- Minimum refresh interval is 30 seconds (browser alarm API limitation)

### Changelog

#### v1.2.1 (2026-10-24)
- **Fix**: The toolbar badge no longer freezes on a stale number after the popup closes; it shows **ON** instead, and the live countdown is documented as popup-open only
- **Fix**: The badge is re-applied after each page load, since a reload can clear it
- **Fix**: Intervals under 30 seconds now show a "Minimum interval is 30 seconds" error instead of being silently raised
- **Fix**: Stop no longer depends on the Target URL field being valid
- **Fix**: Unknown actions now return "Unknown action" instead of a URL error
- **Fix**: Repaired the broken version badge at the top of this README
- **Change**: Prefix matching now compares whole path segments (`/app` no longer matches `/application`)
- **Change**: The interval input minimum is now enforced in code, since the old `min="30"` also applied when the unit was minutes
- **Change**: The popup uses `pagehide` instead of the deprecated `unload` event
- **New**: Optional **Bypass cache on refresh** checkbox

#### v1.2.0 (2026-07-08)
- **Security**: Restricted refresh targets to `http:` and `https:` schemes only
- **Security**: URL matching now compares URL origin first, then path prefix — prevents `https://example.com` from matching `https://example.com.evil.test`
- **Reliability**: Raised minimum refresh interval to 30 seconds to match browser alarm API behavior
- **Reliability**: Aligned browser restart behavior with documentation — all refresh alarms and storage entries are now cleared on restart
- **Reliability**: Added error handling around alarm creation, storage writes, and permission requests
- **Reliability**: Added "Unknown action" fallback response in the service worker
- **UI**: Added live countdown badge on the toolbar icon (color-coded: green > 10s, orange 6–10s, red ≤ 5s)
- **UI**: Popup now shows "Next refresh in Ns" while active
- **UI**: Added bright blue circle extension icons (16, 32, 48, 128 px)
- **UI**: Repaired malformed selectors in `popup.css` and completed button and status styling

#### v1.1.0
- Optional URL prefix matching
- Independent refresh timers per tab
- Automatic cleanup on tab close and browser restart

#### v1.0.0
- Initial release: configurable refresh interval, target URL support

### License

MIT License
