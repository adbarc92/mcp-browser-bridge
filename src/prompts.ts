import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BROWSE_PROMPT = `# Browse

Gives you direct access to a Chromium browser via the Browser Bridge MCP tools.

## Available Tools

| Tool | Purpose |
|------|---------|
| \`browser_status\` | Check connection and get active tab info |
| \`browser_navigate\` | Go to a URL |
| \`browser_screenshot\` | Capture visible area of a tab |
| \`browser_evaluate\` | Run JavaScript in the page context |
| \`browser_click\` | Click an element by CSS selector |
| \`browser_fill\` | Fill a form field by CSS selector |
| \`browser_get_content\` | Get text or HTML of a page or element |
| \`browser_get_tabs\` | List all open tabs |
| \`browser_get_console\` | Get console logs from a tab |
| \`browser_wait_for\` | Wait for a selector to appear |

## Workflow

1. Always start with \`browser_status\` to confirm the extension is connected.
2. Use \`browser_navigate\` to go to the target page.
3. Use \`browser_screenshot\` to see the current state before interacting.
4. After any interaction (click, fill), take another screenshot to verify the result.

## Selector Tips

- Prefer \`[data-testid="foo"]\` selectors when available.
- \`button:has-text("Submit")\` is NOT supported — use \`browser_evaluate\` to find elements by text content instead.
- For scrolling, use \`browser_evaluate\` with \`document.querySelector('selector').scrollIntoView()\`. Do NOT use \`window.scrollBy()\` — it doesn't work with many framework scroll containers.

## Gotchas

- **Screenshots require a visible, focused tab.** Minimized or background tabs will fail.
- **\`browser_evaluate\` results must be JSON-serializable.** Promises return \`{}\` — use synchronous expressions or await inside an IIFE and return a primitive/plain object.
- **\`browser_fill\` works with React.** It uses native property setters to trigger React state updates.
- **All tools accept an optional \`tabId\`.** Omit it to target the active tab.`;

const QA_RUNNER_PROMPT = `# QA Runner

Executes structured QA checklists against a running app using Browser Bridge MCP tools. Reads a checklist markdown file with YAML frontmatter and CSS selectors, drives the browser through each scenario, captures evidence (screenshots, console logs, content checks), and reports pass/fail results.

## Prerequisites Check

Before running any scenario, verify ALL of these in order:

1. **Check browser connection** — Call \`browser_status\`. If \`connected: false\`, stop and tell the user to load the Browser Bridge extension and reconnect.
2. **Locate the checklist** — Search the project for checklist markdown files (common locations: \`docs/qa/checklists/\`, \`qa/checklists/\`, \`tests/checklists/\`). If the user specifies a file path, use that directly. The file must have YAML frontmatter with \`automation: claude-qa\`. If not, offer guided-manual mode.
3. **Verify app is running** — Navigate to the \`app_url\` from the checklist frontmatter. If navigation fails, stop and tell the user to start their dev server.

## Checklist Format

Checklists that support automation have this structure:

\`\`\`yaml
---
title: Create New Item
app_url: http://localhost:3000
preconditions:
  - logged_in: true
  - start_route: /dashboard
automation: claude-qa
---
\`\`\`

Steps reference CSS selectors after an arrow:

\`\`\`
1. Click the create button → \`[data-testid="create-button"]\`
2. Fill in the title → \`[data-testid="title-input"]\` with "My Item"
3. Click save → \`#save-btn\`
\`\`\`

Verify items specify the check method:

\`\`\`
- [ ] \`screenshot\` Item appears in the list
- [ ] \`console_check\` No errors in console
- [ ] \`content_check\` Page contains "My Item"
- [ ] \`evaluate\` document.querySelector('.item-count').textContent === '1'
\`\`\`

## Selector Conventions

Use whatever selectors the project provides. Common patterns by framework:

| Framework | Preferred Selector |
|-----------|-------------------|
| React / Vue / Svelte | \`[data-testid="foo"]\` |
| React Native Web / Expo | \`[data-testid="foo"]\` (rendered from \`testID\`) |
| Angular | \`[data-cy="foo"]\` or \`[data-testid="foo"]\` |
| Plain HTML | \`#id\`, \`.class\`, or semantic selectors |

### Filling inputs in React-based apps

Use \`browser_fill\` which handles React state automatically via native property setters. If that doesn't work, fall back to \`browser_evaluate\`:

\`\`\`js
const el = document.querySelector('[data-testid="title-input"]');
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(el, 'New Value');
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
\`\`\`

## Execution Flow

For each scenario in the checklist:

### Execute Steps

Map each step to a browser tool call based on its action verb and selector:

| Action | Browser Tool |
|--------|-------------|
| Navigate to | \`browser_navigate\` |
| Tap / Click | \`browser_click\` |
| Enter / Fill / Type | \`browser_fill\` |
| Verify / Check | \`browser_get_content\` |
| Wait for | \`browser_wait_for\` |
| Scroll to | \`browser_evaluate\` with \`element.scrollIntoView()\` |

### Execute Verify Items

- **\`screenshot\`**: Call \`browser_screenshot\`. Visually inspect the result. Report what you see.
- **\`console_check\`**: Call \`browser_get_console\`. Check for errors (level: "error"). Warnings are acceptable.
- **\`content_check\`**: Call \`browser_get_content\` with \`format: "text"\`. Search for expected text.
- **\`evaluate\`**: Call \`browser_evaluate\` with the JS expression. Check return value.

### Record Results

After each scenario, record:
- **Pass**: All verify items confirmed
- **Fail**: One or more verify items failed (include which ones and why)
- **Blocked**: Could not execute steps (include the blocking reason)

## Reporting

After all scenarios complete, output a summary table:

\`\`\`
## QA Results: [Checklist Title]

| Scenario | Result | Notes |
|----------|--------|-------|
| S1: Create item with all fields | PASS | All verifications confirmed |
| S2: Minimum fields | PASS | Item created with title only |
| S3: Validation errors | FAIL | Save button not disabled (see screenshot) |
| S4: Default state | PASS | Defaults confirmed |

**Overall: 3/4 PASS | 1 FAIL**
\`\`\`

Then ask the user if they want to:
1. Re-run failed scenarios
2. Update the checklist file with results

## Error Recovery

- **Element not found**: Wait 3 seconds with \`browser_wait_for\`, retry once. If still missing, mark step as failed and continue.
- **Navigation timeout**: Retry once. If still failing, mark scenario as blocked.
- **Console errors during test**: Log them but don't auto-fail unless the verify item specifically checks for console errors.
- **Screenshot fails**: Note it in results, continue execution. Tab must be visible.`;

export function registerPrompts(mcp: McpServer): void {
  mcp.prompt(
    "browse",
    "Interact with the browser — navigate, click, fill forms, take screenshots, run JS, read page content",
    {
      task: z.string().optional().describe("What to do in the browser"),
    },
    async ({ task }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: task
              ? `${BROWSE_PROMPT}\n\n## Task: ${task}`
              : BROWSE_PROMPT,
          },
        },
      ],
    })
  );

  mcp.prompt(
    "qa-runner",
    "Run structured QA checklists against a running app via browser automation",
    {
      checklist: z.string().optional().describe("Path to the QA checklist file, or a requirement ID to search for"),
    },
    async ({ checklist }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: checklist
              ? `${QA_RUNNER_PROMPT}\n\n## Run Checklist: ${checklist}`
              : QA_RUNNER_PROMPT,
          },
        },
      ],
    })
  );
}
