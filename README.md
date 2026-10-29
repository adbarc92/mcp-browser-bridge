# Browser Bridge MCP

[![npm version](https://img.shields.io/npm/v/mcp-browser-bridge.svg)](https://www.npmjs.com/package/mcp-browser-bridge)

MCP server that gives AI coding assistants direct control of a real Chrome browser — navigate, click, fill forms, run JavaScript, take screenshots, and read page content. It exists so your assistant can see what you see, instead of you alt-tabbing to copy-paste errors and describe UI state in words.

```
MCP Client ←(stdio)→ mcp-browser-bridge ←(WebSocket :7483)→ Browser Extension ←(Chrome APIs)→ Browser
```

Works with any MCP-compatible client: Claude Code, Cursor, Windsurf, Cline, and others.

## Quick Start

### 1. Install the extension

Load it as an unpacked extension:

1. Download or clone this repo.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.

Works in any Chromium browser: Chrome, Brave, Edge, Arc, Vivaldi, Opera.

### 2. Add to your MCP client

<details>
<summary><strong>Claude Code</strong></summary>

Run:
```sh
claude mcp add browser-bridge -- npx -y mcp-browser-bridge
```

Or add to `.mcp.json`:
```json
{
  "mcpServers": {
    "browser-bridge": {
      "command": "npx",
      "args": ["-y", "mcp-browser-bridge"]
    }
  }
}
```
</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "browser-bridge": {
      "command": "npx",
      "args": ["-y", "mcp-browser-bridge"]
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "browser-bridge": {
      "command": "npx",
      "args": ["-y", "mcp-browser-bridge"]
    }
  }
}
```
</details>

<details>
<summary><strong>Cline</strong></summary>

In the Cline pane, open **MCP Servers** → **Configure MCP Servers** to edit `cline_mcp_settings.json`, and add:
```json
{
  "mcpServers": {
    "browser-bridge": {
      "command": "npx",
      "args": ["-y", "mcp-browser-bridge"]
    }
  }
}
```
</details>

<details>
<summary><strong>Other MCP clients</strong></summary>

Use `npx -y mcp-browser-bridge` as the server command in your client's MCP configuration. The server communicates over stdio.
</details>

### 3. Verify

Start your MCP client. The extension popup should show a green **Connected** indicator. Call the `browser_status` tool to confirm.

## Available Tools

All tools accept an optional `tabId` parameter. When omitted, they target the active tab.

| Tool | Description |
|------|-------------|
| `browser_status` | Check if the extension is connected and get active tab info |
| `browser_navigate` | Navigate a tab to a URL |
| `browser_screenshot` | Capture a screenshot of the visible area of a tab |
| `browser_evaluate` | Execute JavaScript in a tab and return the result |
| `browser_click` | Click an element by CSS selector |
| `browser_fill` | Fill a form field by CSS selector (React-compatible) |
| `browser_get_content` | Get the text or HTML of a page or element |
| `browser_get_tabs` | List all open browser tabs |
| `browser_get_console` | Get captured console log entries from a tab |
| `browser_wait_for` | Wait for a CSS selector to appear on the page |
| `browser_send_message` | Send a custom message to the extension |

## Included Prompts

The server ships two MCP prompts that provide guided workflows to any connected client:

| Prompt | Description |
|--------|-------------|
| `browse` | General-purpose browser interaction — navigating, clicking, filling forms, screenshotting, running JS. Accepts an optional `task` argument. |
| `qa-runner` | Structured QA checklist execution — drives the browser through test scenarios defined in markdown and reports pass/fail results. Accepts an optional `checklist` path. |

In Claude Code, these appear as slash commands: `/browser-bridge:browse` and `/browser-bridge:qa-runner`.

## Configuration

The WebSocket port defaults to `7483`. To change it:

- **Server side:** Set the `BRIDGE_WS_PORT` environment variable in your MCP config.
- **Extension side:** Change the port in the extension popup and click Reconnect.

## Security

- WebSocket binds to `127.0.0.1` only — no network exposure.
- The server accepts exactly one origin, this project's extension at `chrome-extension://oohfadbpiimgdciaopnehkldlakgdmhf`. It refuses everything else with HTTP 403: other extensions' origins, web pages, and clients that send no `Origin` header.
- The extension ID is stable because `extension/manifest.json` pins a public `key`. Chromium derives an extension's ID from that key, so every unpacked install gets the same ID regardless of which folder you load it from. Don't remove or change the `key`, or the server will refuse the extension.
- Single extension client at a time.

The origin check stops websites, and extensions that connect under their own origin, from driving your browser through the bridge. `Origin` is still a header the client asserts, so the check has limits:
- A program running on your machine as your user can send any `Origin` it likes, and such a program could control your browser by other means anyway.
- An installed extension that can rewrite request headers might be able to forge the `Origin`.

Only install extensions you trust alongside this one.

## Troubleshooting

**Extension shows "Disconnected"**
Check that the MCP server is running and the port is free:
```sh
# macOS/Linux
lsof -i :7483

# Windows
netstat -aon | findstr :7483
```

**Tools return "No extension connected"**
Open the extension popup and click Reconnect.

**Server logs `Rejected connection from origin`, or `browser_status` says an extension was refused**
The extension's ID doesn't match the one the server accepts. This happens if you're running an extension copy from before 1.2.3, or one whose `manifest.json` has had its `key` removed. Update your copy of the repo, then in `chrome://extensions` remove the old **Browser Bridge MCP** and **Load unpacked** the `extension/` folder again. Its ID should read `oohfadbpiimgdciaopnehkldlakgdmhf`.

**Screenshots fail**
The target tab must be visible and focused. Background or minimized tabs cannot be captured.

**`browser_evaluate` returns unexpected results**
Results must be JSON-serializable. Promises return `{}` — use synchronous expressions or await inside an IIFE and return a plain value.

## Development

```bash
git clone https://github.com/adbarc92/mcp-browser-bridge.git
cd mcp-browser-bridge
npm install
npm run build
npm test                 # 67 tests via Vitest
```

Load the extension locally via `chrome://extensions` → **Load unpacked** → select `extension/`.

The repo includes a `.mcp.json` configured for local development.

## License

MIT
