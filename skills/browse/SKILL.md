---
name: browse
description: Use when asked to interact with a web browser — navigate, click, fill forms, take screenshots, run JavaScript, or read page content. Requires the browser-bridge MCP server and Chrome extension.
---

# Browse

Gives you direct access to a Chromium browser via the Browser Bridge MCP tools.

## Available Tools

| Tool | Purpose |
|------|---------|
| `browser_status` | Check connection and get active tab info |
| `browser_navigate` | Go to a URL |
| `browser_screenshot` | Capture visible area of a tab |
| `browser_evaluate` | Run JavaScript in the page context |
| `browser_click` | Click an element by CSS selector |
| `browser_fill` | Fill a form field by CSS selector |
| `browser_get_content` | Get text or HTML of a page or element |
| `browser_get_tabs` | List all open tabs |
| `browser_get_console` | Get console logs from a tab |
| `browser_wait_for` | Wait for a selector to appear |

## Workflow

1. Always start with `browser_status` to confirm the extension is connected.
2. Use `browser_navigate` to go to the target page.
3. Use `browser_screenshot` to see the current state before interacting.
4. After any interaction (click, fill), take another screenshot to verify the result.

## Selector Tips

- Prefer `[data-testid="foo"]` selectors when available.
- `button:has-text("Submit")` is NOT supported — use `browser_evaluate` to find elements by text content instead.
- For scrolling, use `browser_evaluate` with `document.querySelector('selector').scrollIntoView()`. Do NOT use `window.scrollBy()` — it doesn't work with many framework scroll containers.

## Gotchas

- **Screenshots require a visible, focused tab.** Minimized or background tabs will fail.
- **`browser_evaluate` results must be JSON-serializable.** Promises return `{}` — use synchronous expressions or await inside an IIFE and return a primitive/plain object.
- **`browser_fill` works with React.** It uses native property setters to trigger React state updates.
- **All tools accept an optional `tabId`.** Omit it to target the active tab.

## Task: $ARGUMENTS
