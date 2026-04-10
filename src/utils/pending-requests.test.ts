import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PendingRequests } from "./pending-requests.js";

describe("PendingRequests", () => {
  let pending: PendingRequests;

  beforeEach(() => {
    vi.useFakeTimers();
    pending = new PendingRequests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("create", () => {
    it("returns a valid JSON-RPC 2.0 request with a UUID id", () => {
      const { request } = pending.create("browser.navigate", { url: "https://example.com" });

      expect(request.jsonrpc).toBe("2.0");
      expect(request.method).toBe("browser.navigate");
      expect(request.params).toEqual({ url: "https://example.com" });
      expect(request.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("omits params when none are provided", () => {
      const { request } = pending.create("connection.status");

      expect(request).not.toHaveProperty("params");
    });

    it("increments size for each pending request", () => {
      expect(pending.size).toBe(0);
      pending.create("a");
      expect(pending.size).toBe(1);
      pending.create("b");
      expect(pending.size).toBe(2);
    });

    it("generates unique ids for each request", () => {
      const { request: r1 } = pending.create("a");
      const { request: r2 } = pending.create("b");

      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe("resolve", () => {
    it("resolves the promise with the given result", async () => {
      const { request, promise } = pending.create("browser.navigate");
      pending.resolve(request.id, { url: "https://example.com", title: "Example" });

      await expect(promise).resolves.toEqual({ url: "https://example.com", title: "Example" });
    });

    it("removes the request from pending", async () => {
      const { request, promise } = pending.create("browser.navigate");
      expect(pending.size).toBe(1);

      pending.resolve(request.id, "ok");
      await promise;

      expect(pending.size).toBe(0);
    });

    it("returns true when resolving an existing request", () => {
      const { request } = pending.create("a");
      expect(pending.resolve(request.id, "ok")).toBe(true);
    });

    it("returns false for an unknown id", () => {
      expect(pending.resolve("nonexistent-id", "ok")).toBe(false);
    });

    it("returns false when resolving the same id twice", () => {
      const { request } = pending.create("a");
      pending.resolve(request.id, "ok");
      expect(pending.resolve(request.id, "ok")).toBe(false);
    });
  });

  describe("reject", () => {
    it("rejects the promise with the given error", async () => {
      const { request, promise } = pending.create("browser.click");
      const error = { code: -32002, message: "Element not found" };

      pending.reject(request.id, error);

      await expect(promise).rejects.toEqual(error);
    });

    it("removes the request from pending", async () => {
      const { request, promise } = pending.create("a");
      pending.reject(request.id, { code: -1, message: "fail" });
      await promise.catch(() => {});

      expect(pending.size).toBe(0);
    });

    it("returns false for an unknown id", () => {
      expect(pending.reject("nonexistent", { code: -1, message: "fail" })).toBe(false);
    });
  });

  describe("timeout", () => {
    it("rejects with TIMEOUT error after the default timeout", async () => {
      const { promise } = pending.create("browser.navigate");

      vi.advanceTimersByTime(30_000);

      await expect(promise).rejects.toEqual(
        expect.objectContaining({
          code: -32000,
          message: expect.stringContaining("timed out"),
        })
      );
    });

    it("rejects after a custom timeout", async () => {
      const { promise } = pending.create("browser.screenshot", undefined, 5000);

      vi.advanceTimersByTime(5000);

      await expect(promise).rejects.toEqual(
        expect.objectContaining({
          code: -32000,
          message: expect.stringContaining("timed out"),
        })
      );
    });

    it("removes the request from pending after timeout", async () => {
      const { promise } = pending.create("a");
      promise.catch(() => {}); // suppress unhandled rejection
      expect(pending.size).toBe(1);

      vi.advanceTimersByTime(30_000);
      await vi.runAllTimersAsync();

      expect(pending.size).toBe(0);
    });

    it("does not reject if resolved before the deadline", async () => {
      const { request, promise } = pending.create("a");

      pending.resolve(request.id, "done");
      vi.advanceTimersByTime(30_000);

      await expect(promise).resolves.toBe("done");
    });
  });

  describe("rejectAll", () => {
    it("rejects all pending requests with the given error", async () => {
      const { promise: p1 } = pending.create("a");
      const { promise: p2 } = pending.create("b");
      const { promise: p3 } = pending.create("c");

      const error = { code: -32001, message: "Extension disconnected" };
      pending.rejectAll(error);

      await expect(p1).rejects.toEqual(error);
      await expect(p2).rejects.toEqual(error);
      await expect(p3).rejects.toEqual(error);
    });

    it("clears all pending requests", () => {
      const { promise: p1 } = pending.create("a");
      const { promise: p2 } = pending.create("b");
      p1.catch(() => {});
      p2.catch(() => {});
      expect(pending.size).toBe(2);

      pending.rejectAll({ code: -1, message: "shutdown" });

      expect(pending.size).toBe(0);
    });

    it("is a no-op when nothing is pending", () => {
      expect(() => {
        pending.rejectAll({ code: -1, message: "shutdown" });
      }).not.toThrow();
    });
  });
});
