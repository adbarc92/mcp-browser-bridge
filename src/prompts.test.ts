import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./prompts.js";

function getPrompts(mcp: McpServer): Record<string, any> {
  return (mcp as any)._registeredPrompts;
}

describe("registerPrompts", () => {
  let mcp: McpServer;

  beforeEach(() => {
    mcp = new McpServer({ name: "test", version: "0.0.0" });
    registerPrompts(mcp);
  });

  it("registers the browse prompt", () => {
    expect(getPrompts(mcp).browse).toBeDefined();
  });

  it("registers the qa-runner prompt", () => {
    expect(getPrompts(mcp)["qa-runner"]).toBeDefined();
  });

  it("registers exactly 2 prompts", () => {
    expect(Object.keys(getPrompts(mcp))).toHaveLength(2);
  });

  describe("browse prompt", () => {
    it("returns messages with browse instructions when called without a task", async () => {
      const browse = getPrompts(mcp).browse;
      const result = await browse.callback({ task: undefined }, {});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[0].content.text).toContain("browser_status");
      expect(result.messages[0].content.text).toContain("browser_navigate");
      expect(result.messages[0].content.text).not.toContain("## Task:");
    });

    it("appends the task to the prompt when provided", async () => {
      const browse = getPrompts(mcp).browse;
      const result = await browse.callback({ task: "Go to google.com and take a screenshot" }, {});

      expect(result.messages[0].content.text).toContain("## Task: Go to google.com and take a screenshot");
    });

    it("includes selector tips and gotchas", async () => {
      const browse = getPrompts(mcp).browse;
      const result = await browse.callback({ task: undefined }, {});
      const text = result.messages[0].content.text;

      expect(text).toContain("Selector Tips");
      expect(text).toContain("Gotchas");
      expect(text).toContain("data-testid");
    });
  });

  describe("qa-runner prompt", () => {
    it("returns messages with QA instructions when called without a checklist", async () => {
      const qaRunner = getPrompts(mcp)["qa-runner"];
      const result = await qaRunner.callback({ checklist: undefined }, {});

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
      expect(result.messages[0].content.text).toContain("QA Runner");
      expect(result.messages[0].content.text).toContain("Prerequisites Check");
      expect(result.messages[0].content.text).not.toContain("## Run Checklist:");
    });

    it("appends the checklist path when provided", async () => {
      const qaRunner = getPrompts(mcp)["qa-runner"];
      const result = await qaRunner.callback({ checklist: "docs/qa/checklists/login.md" }, {});

      expect(result.messages[0].content.text).toContain("## Run Checklist: docs/qa/checklists/login.md");
    });

    it("includes execution flow and error recovery sections", async () => {
      const qaRunner = getPrompts(mcp)["qa-runner"];
      const result = await qaRunner.callback({ checklist: undefined }, {});
      const text = result.messages[0].content.text;

      expect(text).toContain("Execution Flow");
      expect(text).toContain("Error Recovery");
      expect(text).toContain("Reporting");
    });

    it("documents the checklist YAML format", async () => {
      const qaRunner = getPrompts(mcp)["qa-runner"];
      const result = await qaRunner.callback({ checklist: undefined }, {});
      const text = result.messages[0].content.text;

      expect(text).toContain("automation: claude-qa");
      expect(text).toContain("app_url:");
    });
  });
});
