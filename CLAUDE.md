# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript → dist/
npm run dev              # TypeScript watch mode for development
npm link                 # Register 'mcp-browser-bridge' as a global CLI command
```

There is no test suite or linter configured. The extension uses plain JavaScript (no build step).

## Architecture

This is a **two-way bridge** between MCP clients and Chromium browsers:

```
MCP Client ←(MCP stdio)→ MCP Server ←(WebSocket localhost:7483)→ Browser Extension ←(Chrome APIs)→ Browser
```

The extension is plain JS, not a workspace.

### Server (`src/`)

TypeScript, ESM (`"type": "module"`), targets ES2022.

- **`index.ts`** — Entry point with shebang for global CLI. Creates WebSocket server, MCP server, wires events, handles graceful shutdown.
- **`mcp-server.ts`** — Defines 11 MCP tools (`browser_status`, `browser_navigate`, `browser_screenshot`, `browser_evaluate`, `browser_click`, `browser_fill`, `browser_get_content`, `browser_get_tabs`, `browser_get_console`, `browser_wait_for`, `browser_send_message`). Uses Zod for parameter validation.
- **`ws-server.ts`** — WebSocket server on `127.0.0.1:7483`. Single-client model (replaces stale connections). Origin verification accepts any `-extension://` protocol. JSON-RPC 2.0 request/response with UUID tracking. Keepalive ping every 20s.
- **`protocol.ts`** — JSON-RPC 2.0 types, method names, event names, error codes (-32000 to -32003 for domain errors), timeout constants.
- **`utils/logger.ts`** — Stderr logger controlled by `BRIDGE_LOG_LEVEL` env var.
- **`utils/pending-requests.ts`** — UUID-based request tracking with timeout auto-rejection.

### Extension (`extension/`)

Chrome Manifest V3, plain JavaScript, no build step.

- **`service-worker.js`** — WebSocket client with exponential backoff reconnection (1s→30s). Handles all browser tool requests. Forwards console/tab events to server. Per-tab console ring buffer (max 1000 entries). Port stored in `chrome.storage.local`.
- **`content-script.js`** — Injected at `document_start` on all pages. Wraps `console.*` methods, captures uncaught errors and unhandled rejections, forwards to service worker.
- **`popup.html/js/css`** — Connection status UI with port configuration and reconnect button.

### Protocol

All communication uses **JSON-RPC 2.0**. Requests have UUID `id`, events have `id: null`. Methods are namespaced: `browser.*` for tools, `connection.*` for status, `event.*` for unsolicited events from the extension.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `BRIDGE_WS_PORT` | `7483` | WebSocket server port |
| `BRIDGE_LOG_LEVEL` | `info` | Log level: debug, info, warn, error |

## Key Patterns

- **Native setter for React inputs**: `browser_fill` uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` to trigger React/React Native state updates.
- **Stale connection guard**: Service worker uses handler-instance checks to prevent reconnection loops when the WebSocket server restarts.
- **Framework selectors**: React Native Web renders `testID` as `data-testid` — use `[data-testid="foo"]` selectors.

## Common Issues

- **Stale MCP process on port 7483**: Kill old `node` process holding the port before restarting (`netstat -aon | findstr ":7483.*LISTEN"` then `taskkill /PID <pid> /F`).
- **Screenshots require visible tab**: Browser cannot capture background/minimized tabs.
- **`browser_evaluate` and promises**: Results must be JSON-serializable. Promises return `{}` — use synchronous expressions.
- **`window.scrollBy()` with React Native ScrollView**: Doesn't work. Use `element.scrollIntoView()` instead.

## Version Bumping

Version is tracked in two files that must stay in sync: `package.json` and `extension/manifest.json`.

## Git Conventions

- Always create feature branches (`feat/<name>`), never commit directly to master.
- No `Co-Authored-By` lines in commit messages.
