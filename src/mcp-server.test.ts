import { describe, it, expect, beforeEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./mcp-server.js";
import type { BridgeWebSocketServer } from "./ws-server.js";

function mockWs(overrides: Partial<BridgeWebSocketServer> = {}): BridgeWebSocketServer {
  return {
    isConnected: true,
    send: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as BridgeWebSocketServer;
}

function getTools(mcp: McpServer): Record<string, any> {
  return (mcp as any)._registeredTools;
}

function getPrompts(mcp: McpServer): Record<string, any> {
  return (mcp as any)._registeredPrompts;
}

describe("createMcpServer", () => {
  let ws: BridgeWebSocketServer;
  let mcp: McpServer;

  beforeEach(() => {
    ws = mockWs();
    mcp = createMcpServer(ws);
  });

  describe("tool registration", () => {
    const expectedTools = [
      "browser_status",
      "browser_navigate",
      "browser_screenshot",
      "browser_evaluate",
      "browser_click",
      "browser_fill",
      "browser_get_content",
      "browser_get_tabs",
      "browser_get_console",
      "browser_wait_for",
      "browser_send_message",
    ];

    it("registers all 11 browser tools", () => {
      const tools = getTools(mcp);
      for (const name of expectedTools) {
        expect(tools[name], `missing tool: ${name}`).toBeDefined();
      }
    });

    it("registers no extra tools", () => {
      const tools = getTools(mcp);
      expect(Object.keys(tools).sort()).toEqual(expectedTools.sort());
    });
  });

  describe("prompt registration", () => {
    it("registers browse and qa-runner prompts", () => {
      const prompts = getPrompts(mcp);
      expect(prompts.browse).toBeDefined();
      expect(prompts["qa-runner"]).toBeDefined();
    });
  });

  describe("browser_status", () => {
    it("returns connected: false when extension is not connected", async () => {
      const disconnectedWs = mockWs({ isConnected: false });
      const server = createMcpServer(disconnectedWs);
      const tool = getTools(server).browser_status;

      const result = await tool.handler({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.connected).toBe(false);
      expect(parsed.message).toContain("No Chrome extension connected");
    });

    it("returns connected: true with status data when connected", async () => {
      const statusData = { activeTab: { id: 1, url: "https://example.com", title: "Example" } };
      const connectedWs = mockWs({ send: vi.fn().mockResolvedValue(statusData) });
      const server = createMcpServer(connectedWs);
      const tool = getTools(server).browser_status;

      const result = await tool.handler({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.connected).toBe(true);
      expect(parsed.activeTab.url).toBe("https://example.com");
    });
  });

  describe("browser_navigate", () => {
    it("sends navigate request with url and tabId", async () => {
      const tool = getTools(mcp).browser_navigate;

      await tool.handler({ url: "https://example.com", tabId: 5 });

      expect(ws.send).toHaveBeenCalledWith("browser.navigate", { url: "https://example.com", tabId: 5 });
    });

    it("returns error text on failure", async () => {
      const failWs = mockWs({ send: vi.fn().mockRejectedValue({ message: "Tab not found" }) });
      const server = createMcpServer(failWs);
      const tool = getTools(server).browser_navigate;

      const result = await tool.handler({ url: "https://example.com" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Navigation failed");
    });
  });

  describe("browser_screenshot", () => {
    it("returns an image content block on success", async () => {
      const screenshotWs = mockWs({
        send: vi.fn().mockResolvedValue({ data: "base64data", mimeType: "image/png" }),
      });
      const server = createMcpServer(screenshotWs);
      const tool = getTools(server).browser_screenshot;

      const result = await tool.handler({});

      expect(result.content[0].type).toBe("image");
      expect(result.content[0].data).toBe("base64data");
      expect(result.content[0].mimeType).toBe("image/png");
    });
  });

  describe("browser_evaluate", () => {
    it("sends the expression to the extension", async () => {
      const tool = getTools(mcp).browser_evaluate;

      await tool.handler({ expression: "document.title" });

      expect(ws.send).toHaveBeenCalledWith("browser.evaluate", { expression: "document.title", tabId: undefined });
    });
  });

  describe("browser_click", () => {
    it("sends the selector to the extension", async () => {
      const tool = getTools(mcp).browser_click;

      await tool.handler({ selector: "[data-testid='submit']" });

      expect(ws.send).toHaveBeenCalledWith("browser.click", { selector: "[data-testid='submit']", tabId: undefined });
    });
  });

  describe("browser_fill", () => {
    it("sends selector and value to the extension", async () => {
      const tool = getTools(mcp).browser_fill;

      await tool.handler({ selector: "#email", value: "test@example.com" });

      expect(ws.send).toHaveBeenCalledWith("browser.fill", { selector: "#email", value: "test@example.com", tabId: undefined });
    });
  });

  describe("browser_get_content", () => {
    it("returns formatted text with url and title", async () => {
      const contentWs = mockWs({
        send: vi.fn().mockResolvedValue({
          content: "Hello World",
          url: "https://example.com",
          title: "Example",
        }),
      });
      const server = createMcpServer(contentWs);
      const tool = getTools(server).browser_get_content;

      const result = await tool.handler({});

      expect(result.content[0].text).toContain("URL: https://example.com");
      expect(result.content[0].text).toContain("Title: Example");
      expect(result.content[0].text).toContain("Hello World");
    });
  });

  describe("browser_wait_for", () => {
    it("passes custom timeout to ws.send with padding", async () => {
      const tool = getTools(mcp).browser_wait_for;

      await tool.handler({ selector: ".loaded", timeout: 10000 });

      expect(ws.send).toHaveBeenCalledWith(
        "browser.waitFor",
        { selector: ".loaded", tabId: undefined, timeout: 10000 },
        15000 // timeout + 5000 padding
      );
    });

    it("uses default 30s timeout when not specified", async () => {
      const tool = getTools(mcp).browser_wait_for;

      await tool.handler({ selector: ".loaded" });

      expect(ws.send).toHaveBeenCalledWith(
        "browser.waitFor",
        { selector: ".loaded", tabId: undefined, timeout: 30000 },
        35000
      );
    });
  });
});
