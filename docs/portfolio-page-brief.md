# Portfolio Page Brief: Browser Bridge MCP

Instructions for building a project showcase page on my React/GitHub Pages portfolio.

## Project Summary

**Browser Bridge MCP** is an open-source MCP server + Chrome extension that gives AI coding assistants (Claude Code, Cursor, Windsurf, Cline) direct access to the browser. Navigate pages, click elements, fill forms, run JavaScript, take screenshots, and read page content — all from the terminal.

- **npm**: [mcp-browser-bridge](https://www.npmjs.com/package/mcp-browser-bridge) (v1.1.3)
- **Chrome Web Store**: [Browser Bridge MCP](https://chromewebstore.google.com/detail/browser-bridge-mcp/imdkejagogpjpjfdcncahmnkgfockpcp)
- **GitHub**: [adbarc92/mcp-browser-bridge](https://github.com/adbarc92/mcp-browser-bridge)
- **License**: MIT

---

## Page Structure

### 1. Hero Section

**Hook text** (large, above the fold):
> "Kept alt-tabbing between my AI coding assistant and Chrome to describe what I was seeing. Got annoyed. Built a bridge."

Below the hook, embed the demo video. The video shows Claude Code running side-by-side with a browser being debugged. If the video isn't ready yet, leave a placeholder with a 16:9 aspect ratio container.

Below the video, two small pill-style badges linking to npm and Chrome Web Store.

### 2. Problem / Solution

Two short blocks, side by side on desktop, stacked on mobile.

**Problem:**
AI coding assistants are powerful but blind — they can't see what's in the browser. Developers end up copy-pasting error messages, describing UI state in words, and manually relaying what they see on screen. It's slow and lossy.

**Solution:**
Browser Bridge MCP connects any MCP-compatible AI assistant directly to the browser. One `npx` command installs the server, a Chrome extension handles the browser side. The assistant can then navigate, interact, inspect, and screenshot — no more alt-tabbing.

### 3. How It Works (Architecture)

Render this architecture as a visual diagram (styled to match the portfolio's design system). It should show the data flow left-to-right:

```
MCP Client (Claude Code, Cursor, etc.)
    ↕ stdio
MCP Server (Node.js, runs locally)
    ↕ WebSocket (localhost:7483)
Chrome Extension (Manifest V3)
    ↕ Chrome APIs
Browser (any Chromium browser)
```

Key points to annotate on the diagram:
- **stdio**: Standard MCP transport — no HTTP server, no ports exposed
- **WebSocket**: Local-only (127.0.0.1), origin-verified, JSON-RPC 2.0
- **Extension**: Manifest V3 service worker with exponential backoff reconnection

### 4. What It Can Do (Feature Demos)

Show 3-4 capabilities, each as a short card with a title, one-line description, and a screenshot or GIF. Lay these out in a grid (2x2 on desktop, stacked on mobile).

| Feature | Description |
|---------|-------------|
| **Navigate & Screenshot** | Point the assistant at any URL and get a visual capture of the current state |
| **Click & Fill Forms** | Interact with UI elements by CSS selector — works with React's synthetic event system |
| **Run JavaScript** | Execute arbitrary JS in the page context and get results back |
| **Automated QA** | Run structured QA checklists that drive the browser through test scenarios and report pass/fail |

If screenshots/GIFs aren't available yet, use styled placeholder cards with the text content. These can be swapped in later.

### 5. Technical Highlights

A short section with 4-5 bullet points. Use a monospace or code-style font for technical terms. This section should feel dense and credible, not flashy.

- **JSON-RPC 2.0 protocol** — UUID-tracked requests with timeout auto-rejection. Domain-specific error codes (-32000 to -32003).
- **React-compatible form filling** — Uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` to trigger React/Vue state updates through native setters.
- **WebSocket reconnection** — Exponential backoff (1s to 30s) with stale-connection guards to prevent reconnection loops on server restart.
- **MCP Prompts as skills** — QA and browsing workflows ship as MCP prompts, so any compatible client gets them automatically — no extra install step.
- **Zero config** — `npx -y mcp-browser-bridge` starts the server. No API keys, no cloud services, no accounts.

### 6. Quick Start

A minimal code block showing how fast it is to get running:

```sh
# Add to Claude Code
claude mcp add browser-bridge -- npx -y mcp-browser-bridge

# Install the Chrome extension from the Web Store
# That's it. Start using browser_* tools.
```

### 7. Links

Three prominent buttons/links at the bottom:
- **GitHub** → https://github.com/adbarc92/mcp-browser-bridge
- **npm** → https://www.npmjs.com/package/mcp-browser-bridge
- **Chrome Web Store** → https://chromewebstore.google.com/detail/browser-bridge-mcp/imdkejagogpjpjfdcncahmnkgfockpcp

---

## Design Notes

- Lead with the product story (sections 1-2), then let people drill into technical depth (sections 3-5). Casual visitors get the pitch; technical reviewers get the architecture.
- Keep the page scannable. Short paragraphs, whitespace between sections, no walls of text.
- The architecture diagram is the centerpiece of the technical story — invest in making it look good. Consider a subtle animation (data flowing through the pipeline) if it fits the portfolio's style.
- Color palette and typography should match the rest of the portfolio. Don't introduce new brand elements for this page.
- The page should be a route like `/projects/browser-bridge` or `/projects/mcp-browser-bridge`.

## Tech Stack Context

- **Server**: TypeScript, ESM, Node.js 18+. Dependencies: `@modelcontextprotocol/sdk`, `ws`, `zod`, `uuid`.
- **Extension**: Chrome Manifest V3, plain JavaScript, no build step.
- **Protocol**: JSON-RPC 2.0 over WebSocket. Methods namespaced as `browser.*`, `connection.*`, `event.*`.

## What MCP Is (for context if needed)

MCP (Model Context Protocol) is an open standard by Anthropic that lets AI assistants connect to external tools and data sources through a unified protocol. Think of it like USB for AI — any MCP client can use any MCP server. Browser Bridge is an MCP server that provides browser automation as a capability.
