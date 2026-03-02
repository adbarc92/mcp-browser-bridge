# Claude Code Chrome Bridge

A two-way communication bridge between Claude Code and Chrome (or any Chromium-based browser). Claude Code interacts via MCP tools; a browser extension connects over a local WebSocket.

```
Claude Code ←(MCP stdio)→ MCP Server ←(WebSocket localhost:7483)→ Browser Extension ←(Chrome APIs)→ Browser
```

Supports Chrome, Brave, Edge, Arc, Vivaldi, and other Chromium-based browsers.

## Quick Start

### 1. Build and install the server

```sh
npm install
npm run build
npm link          # Makes 'claude-qa' available as a global command
```

### 2. Load the browser extension

1. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`)
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked** and select the `extension/` folder
4. The extension icon appears in your toolbar — click it to see the connection popup

### 3. Add to your project

Create a `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "chrome-bridge": {
      "command": "claude-qa",
      "args": [],
      "env": {
        "BRIDGE_WS_PORT": "7483"
      }
    }
  }
}
```

### 4. Start Claude Code

Open Claude Code in your project directory. The MCP server starts automatically via `.mcp.json`. The extension popup should show a green dot and "Connected".

If the dot is red, click **Reconnect** in the popup. Make sure nothing else is using port 7483.

## MCP Tools

| Tool | What it does |
|------|-------------|
| `browser_status` | Check if the extension is connected and get active tab info |
| `browser_navigate` | Navigate a tab to a URL |
| `browser_screenshot` | Capture a screenshot of the visible tab |
| `browser_evaluate` | Run JavaScript in the page and return the result |
| `browser_click` | Click an element by CSS selector |
| `browser_fill` | Fill a form field by CSS selector |
| `browser_get_content` | Get the text or HTML of a page or element |
| `browser_get_tabs` | List all open tabs |
| `browser_get_console` | Get captured console log entries |
| `browser_wait_for` | Wait for a CSS selector to appear on the page |
| `browser_send_message` | Send a custom message to the extension |

Most browser tools accept an optional `tabId` parameter. When omitted, they target the active tab.

## Examples

Ask Claude Code to:

- "Take a screenshot of the current page"
- "Navigate to https://example.com and get the page title"
- "Click the Login button and fill in the username field with 'test@example.com'"
- "Check the console for any errors on this page"
- "Wait for the `.results` element to appear, then get its text content"

## Configuration

The WebSocket port defaults to `7483`. To change it:

- **Server side:** Set the `BRIDGE_WS_PORT` environment variable in `.mcp.json`
- **Extension side:** Change the port in the extension popup and click Reconnect

## Project Structure

```
claude-qa/
├── .mcp.json                  # MCP server registration (for local dev)
├── package.json               # Workspace root
├── server/
│   ├── package.json
│   └── src/
│       ├── index.ts           # Entry point (shebang for global install)
│       ├── mcp-server.ts      # MCP tool definitions
│       ├── ws-server.ts       # WebSocket server
│       ├── protocol.ts        # Message types and constants
│       └── utils/
│           ├── logger.ts      # stderr logging
│           └── pending-requests.ts  # Request/response tracking
├── extension/
│   ├── manifest.json          # Chrome extension manifest (V3)
│   ├── service-worker.js      # WebSocket client + browser handlers
│   ├── content-script.js      # Console log interception
│   ├── popup.html/js/css      # Connection status UI
│   └── icons/
└── docs/                      # Session notes and operational learnings
```

## Security

- The WebSocket server binds to `127.0.0.1` only (no network exposure)
- Connections are verified to come from browser extension origins
- Only one extension client is allowed at a time

## Troubleshooting

**Extension shows "Disconnected"**
Make sure the MCP server is running. Start Claude Code in a directory with `.mcp.json` — the server starts automatically. Check that port 7483 is free:
```sh
# macOS/Linux
lsof -i :7483

# Windows
netstat -aon | findstr :7483
```

**Extension shows "Connected" but tools say "No extension connected"**
A stale MCP server process from a previous session may be holding the port. Find and kill it:
```sh
# Windows
netstat -aon | findstr ":7483.*LISTEN"
taskkill /PID <pid> /F

# macOS/Linux
lsof -ti :7483 | xargs kill
```
Then restart Claude Code (or use `/mcp` to reconnect).

**Tools return "No Chrome extension connected"**
Open the extension popup and verify the green dot. If disconnected, click Reconnect.

**Screenshots fail**
The target tab must be visible and focused. The browser cannot capture tabs that are in the background or minimized.

**`browser_evaluate` returns unexpected results**
Scripts run in the page's `MAIN` world with access to the page's own JS context. Results must be JSON-serializable. Promises return `{}` — use synchronous expressions or structure async work to return a final value.

## Using with React Native Web

When automating React Native Web apps, note that:

- `testID` renders as `data-testid` in the DOM (use `[data-testid="foo"]` selectors)
- `maxLength` on TextInput may not be enforced in the web DOM
- Setting input values requires the native setter pattern to trigger React state updates (see `docs/SESSION-2026-03-01-fixes.md` for details)
- `window.scrollBy()` doesn't work with React Native ScrollView — use `element.scrollIntoView()` instead
