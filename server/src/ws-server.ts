import { WebSocketServer, WebSocket } from "ws";
import {
  ErrorCodes,
  KEEPALIVE_INTERVAL_MS,
  WS_PORT,
  type JsonRpcMessage,
  type JsonRpcResponse,
  type JsonRpcEvent,
  type JsonRpcRequest,
  type JsonRpcError,
} from "./protocol.js";
import { PendingRequests } from "./utils/pending-requests.js";
import { logger } from "./utils/logger.js";

type EventHandler = (event: JsonRpcEvent) => void;

export class BridgeWebSocketServer {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private pendingRequests = new PendingRequests();
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private eventHandlers = new Map<string, EventHandler[]>();

  get isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  start(): void {
    this.wss = new WebSocketServer({
      host: "127.0.0.1",
      port: WS_PORT,
      verifyClient: (info: { origin: string; req: import("http").IncomingMessage }) => {
        const origin = info.origin || info.req.headers.origin || "";
        if (!origin.startsWith("chrome-extension://")) {
          logger.warn(`Rejected connection from origin: ${origin}`);
          return false;
        }
        return true;
      },
    });

    this.wss.on("listening", () => {
      logger.info(`WebSocket server listening on 127.0.0.1:${WS_PORT}`);
    });

    this.wss.on("connection", (ws, req) => {
      const origin = req.headers.origin || "unknown";
      logger.info(`Extension connected from ${origin}`);

      // Single client - close existing connection cleanly before reassigning
      if (this.client && this.client.readyState === WebSocket.OPEN) {
        logger.info("Replacing existing client connection");
        const oldClient = this.client;
        this.client = null; // Detach first so the old close handler is a no-op
        oldClient.close(1000, "Replaced by new connection");
      }

      this.client = ws;
      this.startKeepalive();

      ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      ws.on("close", (code, reason) => {
        logger.info(`Extension disconnected: ${code} ${reason.toString()}`);
        if (this.client === ws) {
          this.client = null;
          this.stopKeepalive();
          this.pendingRequests.rejectAll({
            code: ErrorCodes.NOT_CONNECTED,
            message: "Extension disconnected",
          });
        }
      });

      ws.on("error", (err) => {
        logger.error("WebSocket client error", err.message);
      });
    });

    this.wss.on("error", (err) => {
      logger.error("WebSocket server error", err.message);
    });
  }

  stop(): void {
    this.stopKeepalive();
    if (this.client) {
      this.client.close(1000, "Server shutting down");
      this.client = null;
    }
    this.pendingRequests.rejectAll({
      code: ErrorCodes.INTERNAL_ERROR,
      message: "Server shutting down",
    });
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  async send(method: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
    if (!this.isConnected) {
      throw {
        code: ErrorCodes.NOT_CONNECTED,
        message: "No Chrome extension connected. Please open the extension and check the connection.",
      } satisfies JsonRpcError;
    }

    const { request, promise } = this.pendingRequests.create(method, params, timeoutMs);
    logger.debug(`Sending request: ${method}`, request);
    this.client!.send(JSON.stringify(request));
    return promise;
  }

  on(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  private handleMessage(raw: string): void {
    // Handle keepalive
    if (raw === "pong") {
      logger.debug("Received pong");
      return;
    }

    let message: JsonRpcMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      logger.warn("Failed to parse message", raw);
      return;
    }

    // Response to a pending request
    if ("id" in message && message.id !== null && ("result" in message || "error" in message)) {
      const response = message as JsonRpcResponse;
      if (response.error) {
        this.pendingRequests.reject(response.id, response.error);
      } else {
        this.pendingRequests.resolve(response.id, response.result);
      }
      return;
    }

    // Unsolicited event from extension
    if ("method" in message && ("id" in message ? message.id === null : true)) {
      const event = message as JsonRpcEvent;
      logger.debug(`Received event: ${event.method}`);
      const handlers = this.eventHandlers.get(event.method) || [];
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          logger.error(`Event handler error for ${event.method}`, err);
        }
      }
      return;
    }

    logger.warn("Unhandled message", message);
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.isConnected) {
        this.client!.send("ping");
        logger.debug("Sent ping");
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }
}
