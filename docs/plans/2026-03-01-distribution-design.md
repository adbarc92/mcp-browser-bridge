# Browser Bridge MCP — Distribution Design

**Date:** 2026-03-01
**Status:** Approved

## Goal

Make the chrome-bridge MCP server + browser extension consumable by general MCP users via npm and Chrome Web Store.

## Decisions

- **npm package name:** `browser-bridge-mcp`
- **Extension name:** "Browser Bridge MCP"
- **License:** MIT
- **Distribution:** npm (server) + Chrome Web Store (extension)
- **Target audience:** General MCP users (not Claude Code specific)

## 1. npm Package

Publish `browser-bridge-mcp` to npm with a `bin` entry.

**User-facing config:**
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

**Package changes:**
- Remove workspace setup; server becomes the root package
- Move `server/src/` → `src/`, `server/build/` → `dist/`
- Add `bin: { "browser-bridge-mcp": "./dist/index.js" }`
- Add shebang (`#!/usr/bin/env node`) to entry point
- Set `"private": false`, configure `"files"` to publish only `dist/`
- Add `"engines": { "node": ">=18" }`

## 2. Chrome Web Store Extension

**Branding changes:**
- Rename "Claude Code Bridge" → "Browser Bridge MCP" in manifest
- Update description: "Connects MCP servers to your browser for automation, testing, and screenshots via WebSocket"
- Bump to version `1.1.0`

**No code changes needed** — service worker and content script are already browser-agnostic.

**Publish workflow:**
1. Create CWS developer account ($5 one-time)
2. Zip `extension/` folder
3. Upload to CWS dashboard, fill listing, submit for review
4. Future updates: bump manifest version, re-zip, upload

## 3. README Rewrite

Target audience: someone who has never seen this project.

**Sections:**
1. Header — name, one-liner, badges (npm version, CWS link)
2. Quick Start — 3 steps: install extension, add MCP config, done
3. Available Tools — table of 11 tools
4. Configuration — port, env vars
5. Compatibility — Chrome, Brave, Edge
6. Security — localhost-only, origin validation, single client
7. Troubleshooting — common issues
8. Development — for contributors: clone, build, load unpacked

## 4. Repo Restructuring

**Before:**
```
claude-qa/
├── package.json          (workspace root, private)
├── server/
│   ├── package.json
│   ├── src/
│   └── build/
└── extension/
```

**After:**
```
browser-bridge-mcp/
├── package.json          (publishable, bin field)
├── src/                  (server TypeScript source)
├── dist/                 (compiled JS, gitignored)
├── extension/            (CWS extension, npm-ignored)
├── README.md
├── LICENSE               (MIT)
├── .npmignore
└── tsconfig.json
```

**Additional:**
- Rename GitHub repo from `claude-qa` to `browser-bridge-mcp`
- Add `.npmignore` excluding `extension/`, `src/`, `docs/`
- Add MIT `LICENSE` file
