# Changelog

All notable changes to the Microsoft Edge Auto Refresh Extension are documented in this file.

The format is based on https://keepachangelog.com/en/1.1.0/,
and this project adheres to https://semver.org/spec/v2.0.0.html.

## [1.2.1] - 2026-10-24

### Added
- Optional "Bypass cache on refresh" checkbox in the popup (off by default); the setting is stored per tab and passed to `tabs.reload` as `bypassCache`
- "ON" toolbar badge (green) while a refresh is active and the popup is closed
- Port connection between the popup and the service worker, so the badge falls back to "ON" when the popup closes

### Changed
- The live countdown badge is now documented as popup-open only; a service worker cannot tick once per second, so the badge no longer shows a stale number after the popup closes
- URL prefix matching now compares whole path segments (`/app` matches `/app` and `/app/x`, but not `/application`)
- Intervals under 30 seconds are rejected with a "Minimum interval is 30 seconds" error in both the popup and the service worker, instead of being silently raised to 30
- Popup interval input `min` set to 1; the 30-second minimum is enforced in code on the value converted to seconds (the old `min="30"` also applied when the unit was minutes)
- `popup.js` uses `pagehide` instead of the deprecated `unload` event
- `stopRefresh` is handled before URL validation and the popup no longer sends a target URL with it

### Fixed
- Badge could clear after a page reload; it is now re-applied when a tab finishes loading while a refresh is active
- Stop could fail if the Target URL field held an invalid value
- Unknown actions with an invalid URL returned a URL error instead of "Unknown action"
- Broken version badge markup at the top of `README.md`

## [1.2.0] - 2026-07-08

### Added
- Live countdown badge on the toolbar icon, color-coded by urgency
  - Green when more than 10 seconds remain
  - Orange when 6–10 seconds remain
  - Red when 5 seconds or less remain
- Popup countdown text: "Next refresh in Ns" while a refresh is active
- Bright blue circle extension icons at 16, 32, 48, and 128 px
- `default_icon` and `icons` blocks in `manifest.json`
- "Unknown action" fallback response in the background service worker
- Error handling around alarm creation, storage writes, and permission requests
- Persistent `nextFireTime` in storage so the popup can re-sync the countdown after being reopened

### Changed
- Minimum refresh interval raised from 5 seconds to 30 seconds to match the browser alarm API's practical firing limit
- URL matching now compares URL origin first, then path prefix (was raw string `startsWith`)
- Browser restart behavior now clears all refresh alarms and storage entries, matching the documented behavior in `README.md`
- Popup input `min` attribute raised to 30 to align with the service worker clamp

### Security
- Refresh targets are now restricted to `http:` and `https:` schemes only
  - Blocks `javascript:`, `file:`, `edge:`, `chrome:`, and other non-web schemes
- URL prefix matching hardened against cross-domain false matches
  - Previously, target `https://example.com` could match `https://example.com.evil.test`
  - Now matches only when origins are identical and pathname prefix matches

### Fixed
- Repaired malformed universal selector in `popup.css` (`-` → `*`)
- Completed missing `:focus` styling block for text, number, and select inputs
- Completed missing `.btn-start`, `.btn-start:hover`, `.btn-stop`, `.btn-stop:hover`, and `.status.error` declaration blocks

## [1.1.0]

### Added
- Optional URL prefix matching for pages with changing query strings
- Independent refresh timers per tab
- Automatic cleanup of alarms and storage when a tab is closed

### Changed
- Documented behavior: extension stops refreshing when the browser restarts

## [1.0.0]

### Added
- Initial release
- Configurable refresh interval (seconds or minutes)
- Target URL support with exact match
- Manifest V3 service worker background script
- Simple popup interface with Start and Stop controls

[1.2.1]: https://github.com/jayclark5150/Microsoft-Edge-Auto-Refresh-Extension/releases/tag/v1.2.1
[1.2.0]: https://github.com/jayclark5150/Microsoft-Edge-Auto-Refresh-Extension/releases/tag/v1.2.0
[1.1.0]: https://github.com/jayclark5150/Microsoft-Edge-Auto-Refresh-Extension/releases/tag/v1.1.0
[1.0.0]: https://github.com/jayclark5150/Microsoft-Edge-Auto-Refresh-Extension/releases/tag/v1.0.0
