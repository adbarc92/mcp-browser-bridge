# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.2.3] - 2026-10-28

### Security

- The WebSocket server now accepts connections only from this project's extension, `chrome-extension://oohfadbpiimgdciaopnehkldlakgdmhf`. Before this release it accepted any browser extension's origin and connections with no `Origin` header, so any other installed extension could drive the browser through the bridge. Rejected handshakes get HTTP 403
- `extension/manifest.json` now pins a public `key`, so the extension has the same ID for every unpacked install instead of an ID derived from its folder path

### Changed

- When another extension was refused, `browser_status` and the "not connected" tool error name the refused origin and explain how to reinstall. A refused origin's repeated retries are logged at debug level after the first warning
- The MCP server reports version 1.2.3; it had been stuck at 1.2.0

### Upgrading (action required)

- The 1.2.3 server refuses extensions loaded from an earlier copy. `npx -y mcp-browser-bridge` may pick up 1.2.3 on its own, so reinstall the extension even if you didn't upgrade on purpose
- Update your copy of the `extension/` folder, then in `chrome://extensions` remove the old extension and **Load unpacked** it again. Its ID changes to the pinned one, and the 1.2.3 server refuses extensions from earlier copies. Re-enter a custom port in the popup if you had set one, because the stored setting belonged to the old ID

## [1.2.2] - 2026-08-10

### Fixed

- Published package README previously linked a Chrome Web Store listing that is not live; the install path is loading the unpacked extension from this repo. The repository was corrected in 1.2.1 but the fix landed at an already-published version, so the registry continued to serve the outdated README until this release

## [1.2.1] - 2026-07-23

### Fixed

- Extension now recovers its WebSocket connection after the Manifest V3 service worker is suspended and revived (adds the `alarms` permission plus a keepalive)

### Changed

- README: add Cline setup instructions and correct the test count (now 57)

## [1.2.0] - 2026-04-09

### Added

- MCP prompts (`browse`, `qa-runner`) — browsing and QA workflow instructions ship through the MCP protocol, available automatically in any connected client
- Generalized skill files in `skills/` for Claude Code and other agents
- Vitest test suite — 53 tests covering MCP server, prompts, WebSocket server, and pending requests
- Portfolio page brief in `docs/`

## [1.0.3] - 2026-03-01

### Fixed

- Correct README claim that "all" browser tools accept `tabId` — `browser_status`, `browser_get_tabs`, and `browser_send_message` do not
- Sync extension manifest version to match package.json (was 1.0.1, now matches 1.0.3)
- Add CLAUDE.md for Claude Code onboarding

## [1.0.2] - 2026-03-01

### Added

- npm global install support via `bin` field and Node.js shebang
- Multi-browser extension support (Brave, Edge, Arc, Vivaldi, and other Chromium-based browsers)

## [1.0.1] - 2026-03-01

### Fixed

- Fix WebSocket reconnection loop caused by stale onclose handlers clobbering newer connections on both client (service worker) and server sides
