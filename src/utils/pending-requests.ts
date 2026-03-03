import { v4 as uuidv4 } from "uuid";
import { ErrorCodes, DEFAULT_TIMEOUT_MS, type JsonRpcRequest, type JsonRpcError } from "../protocol.js";
import { logger } from "./logger.js";

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: JsonRpcError) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
}

export class PendingRequests {
  private pending = new Map<string, PendingRequest>();

  create(method: string, params?: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): {
    request: JsonRpcRequest;
    promise: Promise<unknown>;
  } {
    const id = uuidv4();
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params && { params }),
    };

    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        logger.warn(`Request timed out: ${method} (${id})`);
        reject({
          code: ErrorCodes.TIMEOUT,
          message: `Request timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, method });
    });

    return { request, promise };
  }

  resolve(id: string, result: unknown): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    logger.debug(`Request resolved: ${pending.method} (${id})`);
    pending.resolve(result);
    return true;
  }

  reject(id: string, error: JsonRpcError): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    logger.debug(`Request rejected: ${pending.method} (${id})`);
    pending.reject(error);
    return true;
  }

  rejectAll(error: JsonRpcError): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      logger.debug(`Rejecting pending request: ${pending.method} (${id})`);
      pending.reject(error);
    }
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }
}
