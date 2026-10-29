import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Mock protocol to use a test port — factory cannot reference outer variables
vi.mock("./protocol.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./protocol.js")>();
  return { ...mod, WS_PORT: 17483 };
});

const { BridgeWebSocketServer } = await import("./ws-server.js");
const { ErrorCodes } = await import("./protocol.js");

const TEST_PORT = 17483;

// Derive the extension ID the way Chromium does: SHA-256 of the manifest `key`
// (DER-encoded public key), first 32 hex digits, each mapped 0-f -> a-p.
// Computed independently of the server so a key/ID mismatch fails the suite.
function extensionIdFromManifest(): string {
  const manifestUrl = new URL("../extension/manifest.json", import.meta.url);
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
  if (typeof manifest.key !== "string") {
    throw new Error("extension/manifest.json has no `key`; the extension ID would not be stable");
  }
  const hex = createHash("sha256").update(Buffer.from(manifest.key, "base64")).digest("hex");
  return [...hex.slice(0, 32)].map((h) => String.fromCharCode(97 + parseInt(h, 16))).join("");
}

const REAL_EXTENSION_ORIGIN = `chrome-extension://${extensionIdFromManifest()}`;

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`, {
      origin: REAL_EXTENSION_ORIGIN,
    });
    client.on("open", () => resolve(client));
    client.on("error", reject);
  });
}

// Attempt a handshake and report whether it opened or was refused (with HTTP status).
// Passing `undefined` sends no Origin header at all.
function tryConnect(origin: string | undefined): Promise<{ opened: boolean; status?: number }> {
  return new Promise((resolve) => {
    const client = new WebSocket(
      `ws://127.0.0.1:${TEST_PORT}`,
      origin === undefined ? {} : { origin },
    );
    client.on("open", () => {
      client.close();
      resolve({ opened: true });
    });
    client.on("unexpected-response", (_req, res) => {
      resolve({ opened: false, status: res.statusCode });
      res.resume();
      client.terminate();
    });
    client.on("error", () => resolve({ opened: false }));
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

  describe("origin check", () => {
    it("server's allowed extension ID matches the ID derived from the manifest key", async () => {
      const { EXTENSION_ORIGIN } = await import("./protocol.js");
      expect(EXTENSION_ORIGIN).toBe(REAL_EXTENSION_ORIGIN);
    });

    it("accepts this project's extension", async () => {
      const result = await tryConnect(REAL_EXTENSION_ORIGIN);
      expect(result.opened).toBe(true);
    });

    it("rejects a different extension's origin", async () => {
      const result = await tryConnect("chrome-extension://abcdefghijklmnopabcdefghijklmnop");
      expect(result).toEqual({ opened: false, status: 403 });
      expect(server.isConnected).toBe(false);
    });

    it("rejects a lookalike origin that only prefixes the real one", async () => {
      const result = await tryConnect(`${REAL_EXTENSION_ORIGIN}x`);
      expect(result).toEqual({ opened: false, status: 403 });
      expect(server.isConnected).toBe(false);
    });

    it("rejects connections with no Origin header", async () => {
      const result = await tryConnect(undefined);
      expect(result).toEqual({ opened: false, status: 403 });
      expect(server.isConnected).toBe(false);
    });

    it("rejects a web page origin", async () => {
      const result = await tryConnect("https://example.com");
      expect(result).toEqual({ opened: false, status: 403 });
      expect(server.isConnected).toBe(false);
    });

    it("explains a refused extension in the not-connected error (e.g. a pre-1.2.3 copy)", async () => {
      const oldOrigin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
      await tryConnect(oldOrigin);
      expect(server.refusedExtensionHint).toContain(oldOrigin);
      expect(server.refusedExtensionHint).toContain(REAL_EXTENSION_ORIGIN.replace("chrome-extension://", ""));

      const err: any = await server.send("browser.navigate", { url: "https://example.com" }).catch((e) => e);
      expect(err.code).toBe(ErrorCodes.NOT_CONNECTED);
      expect(err.message).toContain(oldOrigin);
      expect(err.message).toContain("Load unpacked");
    });

    it("gives no extension hint when only non-extension origins were refused", async () => {
      await tryConnect("https://example.com");
      await tryConnect(undefined);
      expect(server.refusedExtensionHint).toBeNull();
    });

    it("does not let a rejected connection displace the connected extension", async () => {
      const client = await connectClient();
      const result = await tryConnect("chrome-extension://abcdefghijklmnopabcdefghijklmnop");
      expect(result.opened).toBe(false);
      expect(client.readyState).toBe(WebSocket.OPEN);
      expect(server.isConnected).toBe(true);
      client.close();
    });
  });

  describe("connection", () => {
    it("accepts connections from the extension", async () => {
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
