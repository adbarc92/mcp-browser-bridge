# Browser Bridge MCP Distribution — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the repo and prepare for npm + Chrome Web Store publishing as `browser-bridge-mcp`.

**Architecture:** Flatten the workspace layout so the server is the root package with a `bin` entry. Extension stays in-repo for CWS uploads but is excluded from npm. README targets general MCP users.

**Tech Stack:** Node.js, TypeScript, npm, Chrome Web Store

---

### Task 1: Move server source to root

**Files:**
- Move: `server/src/*` → `src/`
- Delete: `server/src/` (empty after move)
- Delete: `server/package.json`
- Delete: `server/tsconfig.json`
- Delete: `server/build/` (will be replaced by `dist/`)

**Step 1: Move source files**

```bash
cd D:/MajorProjects/HARNESSES/claude-qa
# Move server source to root
mv server/src/* src/ 2>/dev/null || (mkdir -p src && mv server/src/* src/)
# Remove old server directory structure
rm -rf server/
```

**Step 2: Verify files are in place**

```bash
ls src/
```

Expected: `index.ts  mcp-server.ts  protocol.ts  utils/  ws-server.ts`

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move server source to root src/"
```

---

### Task 2: Update tsconfig.json

**Files:**
- Modify: `tsconfig.json`

**Step 1: Rewrite tsconfig**

Replace the root `tsconfig.json` with the merged config. The server's tsconfig extended root and added `outDir`/`rootDir` — merge those in and change output to `dist/`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "refactor: merge tsconfig, output to dist/"
```

---

### Task 3: Rewrite package.json

**Files:**
- Modify: `package.json`

**Step 1: Replace package.json**

Merge root and server package.json into a single publishable package:

```json
{
  "name": "browser-bridge-mcp",
  "version": "1.1.0",
  "description": "MCP server that bridges AI assistants to the browser via a WebSocket-connected extension",
  "type": "module",
  "bin": {
    "browser-bridge-mcp": "./dist/index.js"
  },
  "files": [
    "dist/"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=18"
  },
  "keywords": [
    "mcp",
    "browser",
    "chrome",
    "automation",
    "testing",
    "screenshot",
    "websocket",
    "model-context-protocol"
  ],
  "author": "adbarc92",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/adbarc92/browser-bridge-mcp.git"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "uuid": "^11.1.0",
    "ws": "^8.18.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/uuid": "^10.0.0",
    "@types/ws": "^8.18.0",
    "typescript": "^5.7.3"
  }
}
```

**Step 2: Delete old package-lock.json and regenerate**

```bash
rm package-lock.json
npm install
```

**Step 3: Verify build works**

```bash
npm run build
ls dist/
```

Expected: `index.js  mcp-server.js  protocol.js  utils/  ws-server.js` (plus `.map` and `.d.ts` files)

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "refactor: rewrite package.json for npm publishing as browser-bridge-mcp"
```

---

### Task 4: Add .gitignore, .npmignore, LICENSE

**Files:**
- Modify: `.gitignore`
- Create: `.npmignore`
- Create: `LICENSE`

**Step 1: Update .gitignore**

```
node_modules/
dist/
```

**Step 2: Create .npmignore**

```
src/
extension/
docs/
.mcp.json
tsconfig.json
.gitignore
```

**Step 3: Create MIT LICENSE**

Standard MIT license with year 2026 and author name.

**Step 4: Commit**

```bash
git add .gitignore .npmignore LICENSE
git commit -m "chore: add .npmignore and MIT license"
```

---

### Task 5: Update extension branding

**Files:**
- Modify: `extension/manifest.json`

**Step 1: Update manifest.json**

Change these fields:
- `"name"`: `"Claude Code Bridge"` → `"Browser Bridge MCP"`
- `"description"`: → `"Connects MCP servers to your browser for automation, testing, and screenshots via WebSocket"`
- `"version"`: → `"1.1.0"`

**Step 2: Commit**

```bash
git add extension/manifest.json
git commit -m "chore: rebrand extension to Browser Bridge MCP"
```

---

### Task 6: Update .mcp.json for new structure

**Files:**
- Modify: `.mcp.json`

**Step 1: Update .mcp.json**

Point to new dist path:

```json
{
  "mcpServers": {
    "browser-bridge": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "BRIDGE_WS_PORT": "7483"
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add .mcp.json
git commit -m "chore: update .mcp.json for new dist/ path"
```

---

### Task 7: Rewrite README.md

**Files:**
- Modify: `README.md`

**Step 1: Write new README**

Full content targeting general MCP users. Sections:

1. Header with npm badge
2. Architecture diagram
3. Quick Start (3 steps: install extension, add MCP config, verify)
4. Available Tools table (11 tools)
5. Configuration (port, env var)
6. Compatibility (Chrome, Brave, Edge)
7. Security notes
8. Troubleshooting (include Brave storage permission issue)
9. Development section for contributors

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for general MCP users"
```

---

### Task 8: Verify end-to-end

**Step 1: Clean build**

```bash
rm -rf dist/ node_modules/
npm install
npm run build
```

**Step 2: Test bin entry**

```bash
node dist/index.js
```

Expected: Server starts, prints `[INFO] MCP server connected via stdio` and `[INFO] WebSocket server listening on 127.0.0.1:7483` to stderr.

**Step 3: Test npm pack (dry run)**

```bash
npm pack --dry-run
```

Expected: Only `dist/` files, `README.md`, `LICENSE`, `package.json` are included. No `src/`, `extension/`, `docs/`.

**Step 4: Commit any fixes if needed**

---

### Task 9: Rename GitHub repo and publish

**Step 1: Rename repo on GitHub**

```bash
gh repo rename browser-bridge-mcp
```

**Step 2: Update local remote**

```bash
git remote set-url origin https://github.com/adbarc92/browser-bridge-mcp.git
```

**Step 3: Push all changes**

```bash
git push origin master
```

**Step 4: Publish to npm**

```bash
npm login
npm publish
```

**Step 5: Verify install works**

```bash
npx -y browser-bridge-mcp
```

Expected: Server starts and listens on port 7483.

---

### Task 10: Chrome Web Store (manual)

This task is manual — not automatable:

1. Go to https://chrome.google.com/webstore/devconsole
2. Pay $5 developer fee, create account
3. Click "New Item"
4. Zip the `extension/` folder: `cd extension && zip -r ../browser-bridge-mcp-extension.zip . && cd ..`
5. Upload the zip
6. Fill in listing:
   - Name: "Browser Bridge MCP"
   - Description: Use README's description
   - Category: Developer Tools
   - Screenshots: Take screenshots of the popup connected/disconnected states
7. Submit for review (typically 1-3 days)
8. Once approved, update README with Chrome Web Store link and badge
