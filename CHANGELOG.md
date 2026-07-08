# Changelog

All notable changes to the Microsoft Edge Auto Refresh Extension are documented in this file.

The format is based on https://keepachangelog.com/en/1.1.0/,
and this project adheres to https://semver.org/spec/v2.0.0.html.

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

[1.2.0]: https://github.com/jayclark5150/Microsoft-Edge-Auto-Refresh-Extension/releases/tag/v1.2.0
[1.1.0]: https://github.com/jayclark5150/Microsoft-Edge-Auto-Refresh-Extension/releases/tag/v1.1.0
[1.0.0]:https://github.com/jayclark5150/Microsoft-Edge-Auto-Refresh-Extension/releases/tag/v1.0.0