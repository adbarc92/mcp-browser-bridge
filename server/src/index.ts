import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BridgeWebSocketServer } from "./ws-server.js";
import { createMcpServer } from "./mcp-server.js";
import { METHODS } from "./protocol.js";
import { logger } from "./utils/logger.js";

async function main() {
  const ws = new BridgeWebSocketServer();
  const mcp = createMcpServer(ws);

  // Log console events from the extension
  ws.on(METHODS.EVENT_CONSOLE, (event) => {
    logger.debug("Console event", event.params);
  });

  ws.on(METHODS.EVENT_TAB_UPDATED, (event) => {
    logger.debug("Tab updated", event.params);
  });

  ws.on(METHODS.EVENT_TAB_REMOVED, (event) => {
    logger.debug("Tab removed", event.params);
  });

  // Start WebSocket server first
  ws.start();

  // Connect MCP over stdio
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  logger.info("MCP server connected via stdio");

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    ws.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
