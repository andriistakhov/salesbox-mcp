import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";

/** Build a fully configured MCP server instance. */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "salesbox-mcp",
      version: "1.0.0",
    },
    {
      instructions:
        "Tools for the SalesBox public API (https://prod.salesbox.me). " +
        "Manage cashbacks, categories, chats, company/category SEO and custom " +
        "fields, discounts, and filters. All /openapi/* endpoints share a " +
        "company-scoped limit of 100 requests/minute; on HTTP 429 the server " +
        "retries after Retry-After automatically. Use salesbox_raw_request for " +
        "any endpoint without a dedicated tool.",
    },
  );

  registerTools(server);
  return server;
}
