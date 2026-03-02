export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcEvent {
  jsonrpc: "2.0";
  id: null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcEvent;

export const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  TIMEOUT: -32000,
  NOT_CONNECTED: -32001,
  ELEMENT_NOT_FOUND: -32002,
  EXECUTION_ERROR: -32003,
} as const;

export const METHODS = {
  // Server -> Extension requests
  NAVIGATE: "browser.navigate",
  SCREENSHOT: "browser.screenshot",
  EVALUATE: "browser.evaluate",
  CLICK: "browser.click",
  FILL: "browser.fill",
  GET_CONTENT: "browser.getContent",
  GET_TABS: "browser.getTabs",
  GET_CONSOLE: "browser.getConsole",
  WAIT_FOR: "browser.waitFor",
  CONNECTION_STATUS: "connection.status",
  CUSTOM_MESSAGE: "browser.sendMessage",

  // Extension -> Server events
  EVENT_CONSOLE: "event.console",
  EVENT_TAB_UPDATED: "event.tabUpdated",
  EVENT_TAB_REMOVED: "event.tabRemoved",
} as const;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const SCREENSHOT_TIMEOUT_MS = 60_000;
export const KEEPALIVE_INTERVAL_MS = 20_000;
export const WS_PORT = parseInt(process.env.BRIDGE_WS_PORT || "7483", 10);
