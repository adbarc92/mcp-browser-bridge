import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";

// Mock protocol to use a test port — factory cannot reference outer variables
vi.mock("./protocol.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./protocol.js")>();
  return { ...mod, WS_PORT: 17483 };
});

const { BridgeWebSocketServer } = await import("./ws-server.js");
const { ErrorCodes } = await import("./protocol.js");

const TEST_PORT = 17483;

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      origin: "chrome-extension://testextension",
    });
    client.on("open", () => resolve(client));
    client.on("error", reject);
  });
}

function waitForMessage(client: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    client.once("message", (data) => resolve(data.toString()));
  });
}

describe("BridgeWebSocketServer", () => {
  let server: InstanceType<typeof BridgeWebSocketServer>;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server = new BridgeWebSocketServer();
    server.start();
    await new Promise((r) => setTimeout(r, 50));
  });

  afterEach(async () => {
    server.stop();
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));
  });

  describe("connection", () => {
    it("accepts connections from chrome extensions", async () => {
      const client = await connectClient();
      expect(server.isConnected).toBe(true);
      client.close();
    });

    it("reports disconnected before any client connects", () => {
      expect(server.isConnected).toBe(false);
    });

    it("reports disconnected after client closes", async () => {
      const client = await connectClient();
      expect(server.isConnected).toBe(true);

      client.close();
      await new Promise<void>((resolve) => client.on("close", resolve));

      expect(server.isConnected).toBe(false);
    });

    it("replaces existing client when a new one connects", async () => {
      const client1 = await connectClient();
      expect(server.isConnected).toBe(true);

      const closePromise = new Promise<void>((resolve) => client1.on("close", resolve));
      const client2 = await connectClient();
      expect(server.isConnected).toBe(true);

      await closePromise;
      expect(client1.readyState).toBe(WebSocket.CLOSED);

      client2.close();
    });
  });

  describe("send", () => {
    it("throws NOT_CONNECTED when no client is connected", async () => {
      try {
        await server.send("browser.navigate", { url: "https://example.com" });
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.code).toBe(ErrorCodes.NOT_CONNECTED);
      }
    });

    it("sends a JSON-RPC request and resolves with the response", async () => {
      const client = await connectClient();

      client.on("message", (data) => {
        const raw = data.toString();
        if (raw === "ping") return;
        const msg = JSON.parse(raw);
        client.send(JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          result: { ok: true },
        }));
      });

      const result = await server.send("browser.navigate", { url: "https://example.com" });
      expect(result).toEqual({ ok: true });

      client.close();
    });

    it("rejects when the response contains an error", async () => {
      const client = await connectClient();

      client.on("message", (data) => {
        const raw = data.toString();
        if (raw === "ping") return;
        const msg = JSON.parse(raw);
        client.send(JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: ErrorCodes.ELEMENT_NOT_FOUND, message: "Selector not found" },
        }));
      });

      try {
        await server.send("browser.click", { selector: "#missing" });
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.code).toBe(ErrorCodes.ELEMENT_NOT_FOUND);
        expect(err.message).toBe("Selector not found");
      }

      client.close();
    });
  });

  describe("events", () => {
    it("dispatches events to registered handlers", async () => {
      const client = await connectClient();
      const received: any[] = [];

      server.on("event.console", (event: any) => {
        received.push(event);
      });

      client.send(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        method: "event.console",
        params: { tabId: 1, level: "error", message: "Uncaught TypeError" },
      }));

      await new Promise((r) => setTimeout(r, 50));

      expect(received).toHaveLength(1);
      expect(received[0].method).toBe("event.console");
      expect(received[0].params.level).toBe("error");

      client.close();
    });
  });

  describe("keepalive", () => {
    it("sends ping messages to the connected client", async () => {
      const client = await connectClient();
      const msgPromise = waitForMessage(client);

      vi.advanceTimersByTime(20_000);

      const msg = await msgPromise;
      expect(msg).toBe("ping");

      client.close();
    });
  });

  describe("stop", () => {
    it("rejects all pending requests on shutdown", async () => {
      const client = await connectClient();

      const sendPromise = server.send("browser.navigate", { url: "https://example.com" }).catch((e: any) => e);

      await new Promise((r) => setTimeout(r, 50));

      server.stop();

      const err = await sendPromise;
      expect(err.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(err.message).toContain("shutting down");
    });
  });
});
