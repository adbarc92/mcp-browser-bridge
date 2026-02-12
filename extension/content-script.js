// Claude Code Bridge - Content Script
// Intercepts console output and forwards to service worker

(function () {
  "use strict";

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  function serialize(arg) {
    if (arg === undefined) return "undefined";
    if (arg === null) return "null";
    if (typeof arg === "string") return arg;
    if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}${arg.stack ? "\n" + arg.stack : ""}`;
    }
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }

  function intercept(level) {
    return function (...args) {
      // Call original
      originalConsole[level](...args);

      // Forward to service worker
      try {
        chrome.runtime.sendMessage({
          type: "console-log",
          level,
          args: args.map(serialize),
          timestamp: Date.now(),
          url: window.location.href,
          line: new Error().stack?.split("\n")[2]?.trim() || "",
        });
      } catch {
        // Extension context invalidated - ignore
      }
    };
  }

  console.log = intercept("log");
  console.warn = intercept("warn");
  console.error = intercept("error");
  console.info = intercept("info");
  console.debug = intercept("debug");

  // Capture uncaught errors
  window.addEventListener("error", (event) => {
    try {
      chrome.runtime.sendMessage({
        type: "console-log",
        level: "error",
        args: [`Uncaught ${event.error?.name || "Error"}: ${event.message}`, event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : ""],
        timestamp: Date.now(),
        url: window.location.href,
        line: `${event.filename}:${event.lineno}`,
      });
    } catch {
      // ignore
    }
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    try {
      const reason = event.reason;
      const message = reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : String(reason);

      chrome.runtime.sendMessage({
        type: "console-log",
        level: "error",
        args: [`Unhandled Promise Rejection: ${message}`],
        timestamp: Date.now(),
        url: window.location.href,
        line: reason?.stack?.split("\n")[1]?.trim() || "",
      });
    } catch {
      // ignore
    }
  });
})();
