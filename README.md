# Browser Bridge MCP

[![npm version](https://img.shields.io/npm/v/browser-bridge-mcp.svg)](https://www.npmjs.com/package/browser-bridge-mcp)

MCP server that bridges AI assistants to the browser via a WebSocket-connected extension.

```
AI Assistant ←(MCP stdio)→ browser-bridge-mcp ←(WebSocket :7483)→ Browser Extension ←(Chrome APIs)→ Browser
```

## Quick Start

### 1. Install the extension

Install from the Chrome Web Store (coming soon), or load manually:

1. Download or clone this repo.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.

Works in Chrome, Brave, Edge, and other Chromium browsers.

### 2. Add to your MCP config

Add to your `.mcp.json` (or equivalent MCP client config):

```json
{
  "mcpServers": {
    "browser-bridge": {
      "command": "npx",
      "args": ["-y", "browser-bridge-mcp"],
      "env": { "BRIDGE_WS_PORT": "7483" }
    }
  }
}
```

### 3. Verify

Start your MCP client. The extension popup should show a green "Connected" indicator. Use the `browser_status` tool to confirm the connection.

## Available Tools

All tools accept an optional `tabId` parameter. When omitted, they target the active tab.

| Tool | Description |
|------|-------------|
| `browser_status` | Check if the extension is connected and get active tab info |
| `browser_navigate` | Navigate a tab to a URL |
| `browser_screenshot` | Capture a screenshot of the visible area of a tab |
| `browser_evaluate` | Execute JavaScript in a tab and return the result |
| `browser_click` | Click an element by CSS selector |
| `browser_fill` | Fill a form field by CSS selector |
| `browser_get_content` | Get the text or HTML of a page or element |
| `browser_get_tabs` | List all open browser tabs |
| `browser_get_console` | Get captured console log entries from a tab |
| `browser_wait_for` | Wait for a CSS selector to appear on the page |
| `browser_send_message` | Send a custom message to the extension |

## Configuration

The WebSocket port defaults to `7483`. To change it:

- **Server side:** Set the `BRIDGE_WS_PORT` environment variable in your MCP config.
- **Extension side:** Change the port in the extension popup and click Reconnect.

## Compatibility

Works with any Chromium-based browser: Chrome, Brave, Edge, Arc, Vivaldi, Opera.

## Security

- WebSocket binds to `127.0.0.1` only (no network exposure).
- Connections restricted to `chrome-extension://` origins.
- Single extension client at a time.

## Troubleshooting

**Extension shows "Disconnected"**
Check that the MCP server is running and the port is free. Verify nothing else is using port 7483:
```sh
# macOS/Linux
lsof -i :7483

# Windows
netstat -aon | findstr :7483
```

**Tools return "No extension connected"**
Open the extension popup and click Reconnect. Ensure the popup shows a green "Connected" indicator.

**Screenshots fail**
The target tab must be visible and focused. Background or minimized tabs cannot be captured.

**`browser_evaluate` returns unexpected results**
Scripts run in the page's MAIN world. Results must be JSON-serializable. Promises return `{}` -- use synchronous expressions or structure async work to return a final value.

## Development

```bash
git clone https://github.com/adbarc92/browser-bridge-mcp.git
cd browser-bridge-mcp
npm install
npm run build
```

To load the extension locally:

1. Open `chrome://extensions` and enable Developer mode.
2. Click "Load unpacked" and select the `extension/` folder.

The repo includes a `.mcp.json` configured for local development.

## License

MIT
