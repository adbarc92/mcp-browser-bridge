// Claude Code Bridge - Service Worker
// WebSocket client that connects to the MCP bridge server

const DEFAULT_PORT = 7483;
const MAX_RECONNECT_DELAY = 30000;
const CONSOLE_BUFFER_MAX = 1000;

let ws = null;
let port = DEFAULT_PORT;
let reconnectDelay = 1000;
let reconnectTimer = null;
let isConnecting = false;

// Console log buffers per tab
const consoleLogs = new Map();

// --- WebSocket Lifecycle ---

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  if (isConnecting) return;
  isConnecting = true;

  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
  } catch (err) {
    console.error("[Bridge] Failed to create WebSocket:", err);
    isConnecting = false;
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[Bridge] Connected to server");
    isConnecting = false;
    reconnectDelay = 1000;
    updateBadge(true);
  };

  ws.onmessage = (event) => {
    handleMessage(event.data);
  };

  ws.onclose = (event) => {
    console.log(`[Bridge] Disconnected: ${event.code} ${event.reason}`);
    ws = null;
    isConnecting = false;
    updateBadge(false);
    scheduleReconnect();
  };

  ws.onerror = (event) => {
    console.error("[Bridge] WebSocket error");
    isConnecting = false;
  };
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close(1000, "User disconnect");
    ws = null;
  }
  updateBadge(false);
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  console.log(`[Bridge] Reconnecting in ${reconnectDelay}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    connect();
  }, reconnectDelay);
}

function updateBadge(connected) {
  const color = connected ? "#22c55e" : "#ef4444";
  const text = connected ? "ON" : "";
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
}

// --- Message Handling ---

function handleMessage(raw) {
  // Handle keepalive
  if (raw === "ping") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send("pong");
    }
    return;
  }

  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    console.error("[Bridge] Failed to parse message:", raw);
    return;
  }

  if (!message.jsonrpc || !message.id || !message.method) {
    console.warn("[Bridge] Unknown message format:", message);
    return;
  }

  handleRequest(message);
}

async function handleRequest(request) {
  const { id, method, params } = request;

  try {
    let result;
    switch (method) {
      case "connection.status":
        result = await handleConnectionStatus();
        break;
      case "browser.navigate":
        result = await handleNavigate(params);
        break;
      case "browser.screenshot":
        result = await handleScreenshot(params);
        break;
      case "browser.evaluate":
        result = await handleEvaluate(params);
        break;
      case "browser.click":
        result = await handleClick(params);
        break;
      case "browser.fill":
        result = await handleFill(params);
        break;
      case "browser.getContent":
        result = await handleGetContent(params);
        break;
      case "browser.getTabs":
        result = await handleGetTabs();
        break;
      case "browser.getConsole":
        result = await handleGetConsole(params);
        break;
      case "browser.waitFor":
        result = await handleWaitFor(params);
        break;
      case "browser.sendMessage":
        result = await handleSendMessage(params);
        break;
      default:
        sendError(id, -32601, `Unknown method: ${method}`);
        return;
    }
    sendResult(id, result);
  } catch (err) {
    console.error(`[Bridge] Error handling ${method}:`, err);
    sendError(id, -32603, err.message || String(err));
  }
}

function sendResult(id, result) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, result }));
  }
}

function sendError(id, code, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }));
  }
}

function sendEvent(method, params) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: null, method, params }));
  }
}

// --- Helper: resolve tab ID ---

async function resolveTabId(tabId) {
  if (tabId !== undefined && tabId !== null) return tabId;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found");
  return tab.id;
}

// --- Request Handlers ---

async function handleConnectionStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    activeTab: tab ? { id: tab.id, url: tab.url, title: tab.title } : null,
  };
}

async function handleNavigate(params) {
  const { url, tabId } = params;
  const id = await resolveTabId(tabId);

  await chrome.tabs.update(id, { url });

  // Wait for the tab to finish loading
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Navigation timeout"));
    }, 30000);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === id && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });

  const tab = await chrome.tabs.get(id);
  return { tabId: id, url: tab.url, title: tab.title };
}

async function handleScreenshot(params) {
  const { tabId, format, quality } = params || {};
  const id = await resolveTabId(tabId);

  // Focus the tab's window and make it active
  const tab = await chrome.tabs.get(id);
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(id, { active: true });

  // Small delay to ensure rendering is complete
  await new Promise(r => setTimeout(r, 150));

  const imgFormat = format === "jpeg" ? "jpeg" : "png";
  const options = { format: imgFormat };
  if (imgFormat === "jpeg" && quality !== undefined) {
    options.quality = quality;
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, options);
  // dataUrl is like "data:image/png;base64,..."
  const base64 = dataUrl.split(",")[1];
  const mimeType = imgFormat === "jpeg" ? "image/jpeg" : "image/png";

  return { data: base64, mimeType };
}

async function handleEvaluate(params) {
  const { expression, tabId } = params;
  const id = await resolveTabId(tabId);

  const results = await chrome.scripting.executeScript({
    target: { tabId: id },
    func: (expr) => {
      try {
        const result = eval(expr);
        return { value: result, type: typeof result };
      } catch (e) {
        return { error: e.message, type: "error" };
      }
    },
    args: [expression],
    world: "MAIN",
  });

  if (!results || results.length === 0) {
    throw new Error("Script execution returned no results");
  }

  const result = results[0].result;
  if (result.type === "error") {
    throw new Error(`Evaluation error: ${result.error}`);
  }

  return { value: result.value, type: result.type };
}

async function handleClick(params) {
  const { selector, tabId } = params;
  const id = await resolveTabId(tabId);

  const results = await chrome.scripting.executeScript({
    target: { tabId: id },
    func: (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { error: `Element not found: ${sel}` };
      el.click();
      return {
        clicked: true,
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.slice(0, 100) || "",
      };
    },
    args: [selector],
    world: "MAIN",
  });

  const result = results[0].result;
  if (result.error) throw new Error(result.error);
  return result;
}

async function handleFill(params) {
  const { selector, value, tabId } = params;
  const id = await resolveTabId(tabId);

  const results = await chrome.scripting.executeScript({
    target: { tabId: id },
    func: (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return { error: `Element not found: ${sel}` };

      // Focus and set value
      el.focus();
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, "value"
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, val);
      } else {
        el.value = val;
      }

      // Dispatch events to trigger frameworks
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));

      return {
        filled: true,
        tag: el.tagName.toLowerCase(),
        selector: sel,
      };
    },
    args: [selector, value],
    world: "MAIN",
  });

  const result = results[0].result;
  if (result.error) throw new Error(result.error);
  return result;
}

async function handleGetContent(params) {
  const { tabId, selector, format } = params || {};
  const id = await resolveTabId(tabId);

  const results = await chrome.scripting.executeScript({
    target: { tabId: id },
    func: (sel, fmt) => {
      const el = sel ? document.querySelector(sel) : document.body;
      if (!el) return { error: `Element not found: ${sel}` };
      const content = fmt === "html" ? el.innerHTML : el.innerText;
      return {
        content,
        url: window.location.href,
        title: document.title,
      };
    },
    args: [selector || null, format || "text"],
    world: "MAIN",
  });

  const result = results[0].result;
  if (result.error) throw new Error(result.error);
  return result;
}

async function handleGetTabs() {
  const tabs = await chrome.tabs.query({});
  return {
    tabs: tabs.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.active,
      windowId: t.windowId,
    })),
  };
}

async function handleGetConsole(params) {
  const { tabId, clear } = params || {};
  const id = await resolveTabId(tabId);

  const logs = consoleLogs.get(id) || [];
  if (clear) {
    consoleLogs.delete(id);
  }

  return { tabId: id, logs, count: logs.length };
}

async function handleWaitFor(params) {
  const { selector, tabId, timeout } = params;
  const id = await resolveTabId(tabId);
  const waitTimeout = timeout || 30000;

  const results = await chrome.scripting.executeScript({
    target: { tabId: id },
    func: (sel, ms) => {
      return new Promise((resolve) => {
        // Check if already present
        const existing = document.querySelector(sel);
        if (existing) {
          resolve({ found: true, elapsed: 0 });
          return;
        }

        const start = Date.now();
        const timer = setTimeout(() => {
          observer.disconnect();
          resolve({ found: false, elapsed: ms, error: `Timeout waiting for: ${sel}` });
        }, ms);

        const observer = new MutationObserver(() => {
          if (document.querySelector(sel)) {
            clearTimeout(timer);
            observer.disconnect();
            resolve({ found: true, elapsed: Date.now() - start });
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      });
    },
    args: [selector, waitTimeout],
    world: "MAIN",
  });

  const result = results[0].result;
  if (result.error) throw new Error(result.error);
  return result;
}

async function handleSendMessage(params) {
  const { type, data } = params;
  // Extensibility hook - for now just acknowledge
  return { received: true, type, data };
}

// --- Console Log Collection ---

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "console-log" && sender.tab?.id) {
    const tabId = sender.tab.id;
    if (!consoleLogs.has(tabId)) {
      consoleLogs.set(tabId, []);
    }
    const logs = consoleLogs.get(tabId);
    logs.push({
      level: message.level,
      args: message.args,
      timestamp: message.timestamp,
      url: message.url,
      line: message.line,
    });

    // Ring buffer - trim to max size
    if (logs.length > CONSOLE_BUFFER_MAX) {
      logs.splice(0, logs.length - CONSOLE_BUFFER_MAX);
    }

    // Forward as event to server
    sendEvent("event.console", {
      tabId,
      level: message.level,
      args: message.args,
      timestamp: message.timestamp,
    });
  }
});

// Clean up console logs when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  consoleLogs.delete(tabId);
  sendEvent("event.tabRemoved", { tabId });
});

// Forward tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    sendEvent("event.tabUpdated", {
      tabId,
      url: tab.url,
      title: tab.title,
      status: changeInfo.status,
    });
  }
});

// --- Port Management (from popup) ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get-status") {
    sendResponse({
      connected: ws && ws.readyState === WebSocket.OPEN,
      port,
    });
    return true;
  }

  if (message.type === "set-port") {
    port = message.port;
    disconnect();
    connect();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "reconnect") {
    disconnect();
    reconnectDelay = 1000;
    connect();
    sendResponse({ ok: true });
    return true;
  }
});

// --- Storage: Persist port setting ---

chrome.storage?.local?.get(["port"], (result) => {
  if (result.port) {
    port = result.port;
  }
  // Auto-connect on startup
  connect();
});
