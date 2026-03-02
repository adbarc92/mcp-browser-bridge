# Session Notes: 2026-03-01 — Fixes & Operational Learnings

This document covers the issues discovered and fixes applied during the first real-world QA session using claude-qa against the Tenzy project (React Native + Expo, running on web via `localhost:8081`).

---

## Summary of Changes

### 1. npm Global Install Support (v1.0.2)

**Problem:** The `.mcp.json` in consuming projects used a relative path (`./server/build/index.js`) to launch the MCP server. This only works if claude-qa is cloned into the same directory as the consuming project, making it non-portable.

**Fix:**
- Added `"bin": { "claude-qa": "./server/build/index.js" }` to root `package.json`
- Added `#!/usr/bin/env node` shebang to `server/src/index.ts`
- Removed `"private": true` from `package.json`

**Result:** After `npm link` (or `npm install -g`), the MCP server can be launched by command name from any directory:

```json
{
  "mcpServers": {
    "chrome-bridge": {
      "command": "claude-qa",
      "args": [],
      "env": { "BRIDGE_WS_PORT": "7483" }
    }
  }
}
```

**Files changed:**
- `package.json` — added `bin` field, removed `private`
- `server/src/index.ts` — added shebang line

---

### 2. Multi-Browser Extension Support (v1.0.2)

**Problem:** The WebSocket server's `verifyClient` callback only accepted connections from `chrome-extension://` origins. When using Brave (and potentially other Chromium-based browsers), the origin header sent by the service worker was either empty or used a different protocol prefix, causing the connection to be silently rejected.

**Symptoms:** The extension popup showed "Connected" (the TCP connection established), but `browser_status` returned `{ connected: false }`. The `netstat` showed an ESTABLISHED connection on port 7483, but the server's `this.client` was never set because `verifyClient` returned `false` before the WebSocket handshake completed.

**Diagnosis steps:**
1. `netstat -an | grep 7483` showed ESTABLISHED connection — TCP was fine
2. Checked `verifyClient` in `ws-server.ts` — only accepted `chrome-extension://`
3. Brave uses `chrome-extension://` protocol but may send an empty `origin` header from service workers

**Fix:** Broadened the origin check to accept any Chromium-based browser extension:

```typescript
const allowed =
  origin === "" ||                          // Service workers may send empty origin
  origin.endsWith("-extension://") ||       // Brave, Edge, etc.
  origin.startsWith("chrome-extension://"); // Chrome
```

Added a log on accepted connections for future debugging:
```typescript
logger.info(`Accepted connection from origin: ${origin || "(empty)"}`);
```

**Security note:** The primary security boundary is the `127.0.0.1` binding (localhost only). The origin check is defense-in-depth to prevent non-extension WebSocket clients from connecting. Accepting empty origins is safe because only browser extensions can initiate WebSocket connections from a service worker context to localhost.

**Files changed:**
- `server/src/ws-server.ts` — updated `verifyClient` callback

---

## Operational Learnings

### Stale MCP Server Processes

**Problem:** When restarting a Claude Code session, the old MCP server process (a Node.js child process) sometimes doesn't terminate. The new session's MCP server then fails to bind port 7483 with `EADDRINUSE`, but this error is logged to stderr and swallowed — the MCP server continues running without a WebSocket listener.

**Result:** The extension connects to the old (stale) process, while Claude Code talks to the new (broken) process. `browser_status` returns `{ connected: false }` even though the extension shows "Connected."

**Diagnosis:**
```bash
# Find what process owns the port
netstat -aon | grep ":7483.*LISTEN"
# Returns PID of the stale process

# Verify it's an old instance
wmic process where "ProcessId=<PID>" get CommandLine
# Shows the old node process running the server
```

**Resolution:** Kill the stale process and restart the Claude Code session (or use `/mcp` to reconnect). The new session's MCP server will then bind the port successfully.

**Prevention ideas:**
- Add a startup check in `index.ts` that probes port 7483 before starting, and provides a clear error message if occupied
- Write a PID file to detect and clean up stale instances
- Add a `--force` flag that kills the existing process on the port before starting

### React Native Web Input Handling

When automating React Native Web apps via `browser_evaluate`, standard DOM manipulation doesn't trigger React's state updates. The following patterns were discovered:

**Text inputs (TextInput):**
```javascript
// DON'T: Just set .value — React state won't update
el.value = 'text';

// DO: Use native setter + InputEvent per character
const setter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype, 'value'
).set;
const text = 'Hello';
for (let i = 0; i < text.length; i++) {
  setter.call(el, text.substring(0, i + 1));
  el.dispatchEvent(new InputEvent('input', {
    bubbles: true, data: text[i], inputType: 'insertText'
  }));
}
el.dispatchEvent(new Event('change', { bubbles: true }));
```

**Textarea inputs:**
Same pattern but use `HTMLTextAreaElement.prototype` for the setter.

**Button clicks (Pressable/TouchableOpacity):**
```javascript
// Standard .click() usually works for buttons
button.click();

// But if the button is disabled or behind a modal, .click() may be swallowed.
// In that case, check for multiple matching elements (e.g., two "Save" buttons
// stacked from a modal over the main page).
```

**Scrolling React Native ScrollView on web:**
```javascript
// window.scrollBy() doesn't work — ScrollView manages its own scroll container
// Find the scrollable div and set scrollTop directly
const scrollable = document.querySelector('[role="dialog"]');
scrollable.scrollTop = scrollable.scrollHeight;

// Or use scrollIntoView on the target element
element.scrollIntoView({ block: 'center' });
```

### Selector Translation

React Native's `testID` prop renders as `data-testid` in the web DOM. The QA skill handles this translation, but when writing raw `browser_evaluate` expressions, use:

```javascript
// React Native: testID="save-button"
// Web DOM:      data-testid="save-button"
document.querySelector('[data-testid="save-button"]')
```

### Modal Stacking

When a modal opens another modal (e.g., "Add Term" from within the guide editor which already has the editor open), closing the inner modal may reveal the outer modal rather than returning to the base page. The close button selectors can be ambiguous — use `aria-label="Close"` or check button position and size to differentiate.

### Tab Context

`browser_get_content` and `browser_screenshot` default to the active tab. If the user has switched tabs in the browser during the QA run, these tools may return content from the wrong tab. Always pass `tabId` explicitly when running multi-step scenarios to avoid this.

---

## Setup Checklist for New Projects

To use claude-qa in a new project:

### One-Time Setup (per machine)

1. **Clone and build:**
   ```bash
   git clone <repo-url> claude-qa
   cd claude-qa
   npm install
   npm run build
   ```

2. **Install globally:**
   ```bash
   npm link
   ```
   This makes `claude-qa` available as a command anywhere.

3. **Load the browser extension:**
   - Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`)
   - Enable Developer Mode
   - Click "Load unpacked" and select the `extension/` folder
   - Verify the extension icon appears in the toolbar

### Per-Project Setup

4. **Add `.mcp.json` to the project root:**
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

5. **Start the app's dev server** (e.g., `npm start` for Expo, `npm run dev` for Next.js)

6. **Open Claude Code** in the project directory — the MCP server starts automatically

7. **Verify connection:**
   - Click the extension icon — should show green "Connected"
   - In Claude Code, the `browser_status` tool should return `{ connected: true }`

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Extension shows "Connected" but tools say "No extension connected" | Stale MCP server process on port 7483 | Kill the old process: `netstat -aon \| grep 7483`, then `taskkill /PID <pid> /F` (Windows) or `kill <pid>` (Unix) |
| Extension shows "Disconnected" | MCP server not running or port mismatch | Check that Claude Code is running in a directory with `.mcp.json`. Verify port matches in both `.mcp.json` and extension popup |
| `browser_screenshot` returns error | Tab not visible or minimized | Bring the browser window to the foreground. Screenshots require a visible tab |
| `browser_evaluate` returns `{}` for async code | Promises aren't awaited | The evaluate tool wraps the expression; use `await` and ensure it returns a value |
| `browser_click` says "Element not found" | Selector wrong or element behind modal | Check `data-testid` (not `testID`). Element may be in a modal or scrolled off-screen |

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `package.json` | Added `bin` field, removed `private: true` |
| `server/src/index.ts` | Added `#!/usr/bin/env node` shebang |
| `server/src/ws-server.ts` | Broadened `verifyClient` to accept all Chromium browsers |
| `CHANGELOG.md` | Added v1.0.2 entry |
