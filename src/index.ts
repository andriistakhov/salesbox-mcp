#!/usr/bin/env node
import { CONFIG } from "./config.js";
import { createServer } from "./server.js";
import { requestContext } from "./context.js";

async function startStdio(): Promise<void> {
  const { StdioServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/stdio.js"
  );
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Logs must go to stderr in stdio mode (stdout carries the protocol).
  console.error("salesbox-mcp running on stdio");
}

async function startHttp(): Promise<void> {
  const express = (await import("express")).default;
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const { randomUUID } = await import("node:crypto");

  const app = express();
  app.use(express.json({ limit: "4mb" }));

  // Optional shared-secret gate for the whole MCP endpoint.
  function authorized(req: import("express").Request): boolean {
    if (!CONFIG.mcpAuthToken) return true;
    const auth = req.header("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    const custom = req.header("x-mcp-auth");
    return bearer === CONFIG.mcpAuthToken || custom === CONFIG.mcpAuthToken;
  }

  app.get("/health", (_req, res) => {
    res.json({ ok: true, name: "salesbox-mcp", version: "1.0.0" });
  });

  // Stateless Streamable HTTP: a fresh server+transport per request.
  app.post("/mcp", async (req, res) => {
    if (!authorized(req)) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      });
      return;
    }

    // Per-request SalesBox token. Prefer the explicit X-Salesbox-Token header.
    // If no auth gate is configured (MCP_AUTH_TOKEN empty), the standard
    // `Authorization: Bearer <token>` is treated as the SalesBox token, so a
    // client only needs to send its own SalesBox token and nothing else.
    const authHeader = req.header("authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;
    const salesboxToken =
      req.header("x-salesbox-token") ||
      (CONFIG.mcpAuthToken ? undefined : bearer) ||
      undefined;

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await requestContext.run({ token: salesboxToken }, async () => {
        await transport.handleRequest(req, res, req.body);
      });
    } catch (err) {
      console.error("Error handling MCP request:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET/DELETE on /mcp aren't used in stateless mode.
  const methodNotAllowed = (_req: unknown, res: import("express").Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.listen(CONFIG.port, CONFIG.host, () => {
    console.log(
      `salesbox-mcp (HTTP) listening on http://${CONFIG.host}:${CONFIG.port}/mcp`,
    );
    if (!CONFIG.token) {
      console.warn(
        "WARNING: SALESBOX_API_TOKEN is not set. Clients must supply a token via the X-Salesbox-Token header.",
      );
    }
  });
}

async function main(): Promise<void> {
  if (CONFIG.transport === "stdio") {
    await startStdio();
  } else {
    await startHttp();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
