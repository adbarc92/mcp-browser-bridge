---
layout: default
title: Browser Bridge MCP
---

# Browser Bridge MCP

An open-source MCP server + Chrome extension that gives AI coding assistants direct access to the browser. Navigate pages, click elements, fill forms, run JavaScript, take screenshots, and read page content — all from the terminal.

## The Problem

AI coding assistants are powerful but blind — they can't see what's in the browser. Developers end up copy-pasting error messages, describing UI state in words, and manually relaying what they see on screen. It's slow and lossy.

## The Solution

Browser Bridge MCP connects any MCP-compatible AI assistant directly to the browser. One `npx` command starts the server, a Chrome extension handles the browser side. The assistant can then navigate, interact, inspect, and screenshot — no more alt-tabbing.

## How It Works

```
MCP Client (Claude Code, Cursor, etc.)
    ↕ stdio
MCP Server (Node.js, runs locally)
    ↕ WebSocket (localhost:7483)
Chrome Extension (Manifest V3)
    ↕ Chrome APIs
Browser (any Chromium browser)
```

All communication stays on your machine. No data is sent to any remote server or third party.

## What It Can Do

| Feature | Description |
|---------|-------------|
| **Navigate & Screenshot** | Point the assistant at any URL and get a visual capture of the current state |
| **Click & Fill Forms** | Interact with UI elements by CSS selector — works with React's synthetic event system |
| **Run JavaScript** | Execute arbitrary JS in the page context and get results back |
| **Automated QA** | Run structured QA checklists that drive the browser through test scenarios and report pass/fail |

## Quick Start

```sh
# Add to Claude Code
claude mcp add browser-bridge -- npx -y mcp-browser-bridge

# Install the Chrome extension from the Web Store
# That's it. Start using browser_* tools.
```

## Technical Highlights

- **JSON-RPC 2.0 protocol** — UUID-tracked requests with timeout auto-rejection
- **React-compatible form filling** — Uses native property setters to trigger React/Vue state updates
- **WebSocket reconnection** — Exponential backoff (1s to 30s) with stale-connection guards
- **MCP Prompts as skills** — QA and browsing workflows ship as MCP prompts
- **Zero config** — No API keys, no cloud services, no accounts

## Links

- [GitHub](https://github.com/adbarc92/mcp-browser-bridge)
- [npm](https://www.npmjs.com/package/mcp-browser-bridge)
- [Chrome Web Store](https://chromewebstore.google.com/detail/browser-bridge-mcp/imdkejagogpjpjfdcncahmnkgfockpcp)
- [Privacy Policy](privacy-policy)

## License

MIT
