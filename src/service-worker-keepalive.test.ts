import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Regression guard for the MV3 disconnect bug: an idle service worker is suspended (~30s),
// killing the WebSocket and discarding the setTimeout-based reconnect. chrome.alarms is the
// only timer that survives suspension and can wake the worker to reconnect. These assert the
// MV3-survival wiring stays in place. (The service worker has no test seam — it depends on the
// live chrome.* globals — so this is a static contract test until the SW is refactored behind
// an injectable `chrome`; that larger refactor is tracked separately.)

const sw = readFileSync(
  fileURLToPath(new URL("../extension/service-worker.js", import.meta.url)),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../extension/manifest.json", import.meta.url)),
    "utf8",
  ),
);

describe("MV3 service-worker keepalive (disconnect regression)", () => {
  it("declares the alarms permission", () => {
    expect(manifest.permissions).toContain("alarms");
  });

  it("creates a keepalive alarm (survives SW suspension; setTimeout does not)", () => {
    expect(sw).toMatch(/chrome\.alarms\.create\(/);
  });

  it("registers an onAlarm handler that reconnects", () => {
    expect(sw).toMatch(/chrome\.alarms\.onAlarm\.addListener/);
  });

  it("reconnects on browser startup", () => {
    expect(sw).toMatch(/chrome\.runtime\.onStartup\.addListener/);
  });
});
