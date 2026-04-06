import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { METHODS, SCREENSHOT_TIMEOUT_MS, type JsonRpcError } from "./protocol.js";
import { BridgeWebSocketServer } from "./ws-server.js";
import { logger } from "./utils/logger.js";

function errorText(err: unknown): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    return (err as JsonRpcError).message;
  }
  return String(err);
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

export function createMcpServer(ws: BridgeWebSocketServer): McpServer {
  const mcp = new McpServer({
    name: "browser-bridge",
    version: "1.1.0",
  });

  // 1. browser_status
  mcp.tool(
    "browser_status",
    "Check if the Chrome extension is connected and get active tab info",
    {},
    async () => {
      if (!ws.isConnected) {
        return textResult(JSON.stringify({
          connected: false,
          message: "No Chrome extension connected. Load the extension and ensure it shows 'Connected'.",
        }, null, 2));
      }
      try {
        const result = await ws.send(METHODS.CONNECTION_STATUS);
        return textResult(JSON.stringify({ connected: true, ...result as object }, null, 2));
      } catch (err) {
        return textResult(`Connected but status check failed: ${errorText(err)}`, true);
      }
    }
  );

  // 2. browser_navigate
  mcp.tool(
    "browser_navigate",
    "Navigate a browser tab to the specified URL",
    {
      url: z.string().describe("The URL to navigate to"),
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
    },
    async ({ url, tabId }) => {
      try {
        const result = await ws.send(METHODS.NAVIGATE, { url, tabId });
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Navigation failed: ${errorText(err)}`, true);
      }
    }
  );

  // 3. browser_screenshot
  mcp.tool(
    "browser_screenshot",
    "Capture a screenshot of the visible area of a browser tab",
    {
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
      format: z.enum(["png", "jpeg"]).optional().describe("Image format (default: png)"),
      quality: z.number().min(0).max(100).optional().describe("JPEG quality (0-100, only for jpeg format)"),
    },
    async ({ tabId, format, quality }) => {
      try {
        const result = await ws.send(METHODS.SCREENSHOT, { tabId, format, quality }, SCREENSHOT_TIMEOUT_MS) as {
          data: string;
          mimeType: string;
        };
        return {
          content: [{
            type: "image" as const,
            data: result.data,
            mimeType: result.mimeType,
          }],
        };
      } catch (err) {
        return textResult(`Screenshot failed: ${errorText(err)}`, true);
      }
    }
  );

  // 4. browser_evaluate
  mcp.tool(
    "browser_evaluate",
    "Execute JavaScript in the context of a browser tab and return the result",
    {
      expression: z.string().describe("JavaScript expression to evaluate"),
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
    },
    async ({ expression, tabId }) => {
      try {
        const result = await ws.send(METHODS.EVALUATE, { expression, tabId });
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Evaluation failed: ${errorText(err)}`, true);
      }
    }
  );

  // 5. browser_click
  mcp.tool(
    "browser_click",
    "Click an element on the page identified by a CSS selector",
    {
      selector: z.string().describe("CSS selector for the element to click"),
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
    },
    async ({ selector, tabId }) => {
      try {
        const result = await ws.send(METHODS.CLICK, { selector, tabId });
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Click failed: ${errorText(err)}`, true);
      }
    }
  );

  // 6. browser_fill
  mcp.tool(
    "browser_fill",
    "Fill a form field with the specified value",
    {
      selector: z.string().describe("CSS selector for the input element"),
      value: z.string().describe("Value to fill in"),
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
    },
    async ({ selector, value, tabId }) => {
      try {
        const result = await ws.send(METHODS.FILL, { selector, value, tabId });
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Fill failed: ${errorText(err)}`, true);
      }
    }
  );

  // 7. browser_get_content
  mcp.tool(
    "browser_get_content",
    "Get the HTML or text content of a page or specific element",
    {
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
      selector: z.string().optional().describe("CSS selector to get content of (defaults to body)"),
      format: z.enum(["html", "text"]).optional().describe("Content format (default: text)"),
    },
    async ({ tabId, selector, format }) => {
      try {
        const result = await ws.send(METHODS.GET_CONTENT, { tabId, selector, format });
        const content = result as { content: string; url: string; title: string };
        return textResult(`URL: ${content.url}\nTitle: ${content.title}\n\n${content.content}`);
      } catch (err) {
        return textResult(`Get content failed: ${errorText(err)}`, true);
      }
    }
  );

  // 8. browser_get_tabs
  mcp.tool(
    "browser_get_tabs",
    "List all open browser tabs",
    {},
    async () => {
      try {
        const result = await ws.send(METHODS.GET_TABS);
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Get tabs failed: ${errorText(err)}`, true);
      }
    }
  );

  // 9. browser_get_console
  mcp.tool(
    "browser_get_console",
    "Get captured console log entries from a tab",
    {
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
      clear: z.boolean().optional().describe("Clear logs after retrieval (default: false)"),
    },
    async ({ tabId, clear }) => {
      try {
        const result = await ws.send(METHODS.GET_CONSOLE, { tabId, clear });
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Get console failed: ${errorText(err)}`, true);
      }
    }
  );

  // 10. browser_wait_for
  mcp.tool(
    "browser_wait_for",
    "Wait for an element matching a CSS selector to appear on the page",
    {
      selector: z.string().describe("CSS selector to wait for"),
      tabId: z.number().optional().describe("Tab ID (defaults to active tab)"),
      timeout: z.number().optional().describe("Timeout in milliseconds (default: 30000)"),
    },
    async ({ selector, tabId, timeout }) => {
      const waitTimeout = timeout || 30000;
      try {
        const result = await ws.send(METHODS.WAIT_FOR, { selector, tabId, timeout: waitTimeout }, waitTimeout + 5000);
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Wait failed: ${errorText(err)}`, true);
      }
    }
  );

  // 11. browser_send_message
  mcp.tool(
    "browser_send_message",
    "Send a custom message to the Chrome extension for extensibility",
    {
      type: z.string().describe("Custom message type"),
      data: z.record(z.unknown()).optional().describe("Optional data payload"),
    },
    async ({ type, data }) => {
      try {
        const result = await ws.send(METHODS.CUSTOM_MESSAGE, { type, data });
        return textResult(JSON.stringify(result, null, 2));
      } catch (err) {
        return textResult(`Send message failed: ${errorText(err)}`, true);
      }
    }
  );

  return mcp;
}
