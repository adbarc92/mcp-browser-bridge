# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.2] - 2026-03-01

### Added

- npm global install support via `bin` field and Node.js shebang
- Multi-browser extension support (Brave, Edge, Arc, Vivaldi, and other Chromium-based browsers)

## [1.0.1] - 2026-03-01

### Fixed

- Fix WebSocket reconnection loop caused by stale onclose handlers clobbering newer connections on both client (service worker) and server sides
