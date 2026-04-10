# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
