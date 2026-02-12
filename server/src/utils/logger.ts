type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel = (process.env.BRIDGE_LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function log(level: LogLevel, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const line = data !== undefined
    ? `${prefix} ${message} ${JSON.stringify(data)}`
    : `${prefix} ${message}`;
  process.stderr.write(line + "\n");
}

export const logger = {
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
};
