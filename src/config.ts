/** Central runtime configuration, read once from the environment. */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const CONFIG = {
  /** SalesBox API base URL. */
  baseUrl: process.env.SALESBOX_BASE_URL ?? "https://prod.salesbox.me",

  /** Default OpenAPI token. May be empty if tokens are supplied per-request. */
  token: process.env.SALESBOX_API_TOKEN ?? "",

  /** Transport: "http" (Streamable HTTP, good for a VPS) or "stdio". */
  transport: (process.env.MCP_TRANSPORT ?? "http").toLowerCase() as
    | "http"
    | "stdio",

  /** HTTP listen host/port (http transport only). */
  host: process.env.HOST ?? "0.0.0.0",
  port: envInt("PORT", 3000),

  /**
   * Optional shared secret guarding the HTTP endpoint. When set, clients must
   * send `Authorization: Bearer <MCP_AUTH_TOKEN>` OR `X-MCP-Auth: <token>`.
   * Independent from the SalesBox API token.
   */
  mcpAuthToken: process.env.MCP_AUTH_TOKEN ?? "",

  /** Per-request timeout for calls to the SalesBox API. */
  requestTimeoutMs: envInt("SALESBOX_TIMEOUT_MS", 30_000),

  /** How many times to retry after a 429. */
  maxRetriesOn429: envInt("SALESBOX_MAX_RETRIES", 2),

  /** Never wait longer than this (seconds) on a single Retry-After. */
  maxRetryWaitSeconds: envInt("SALESBOX_MAX_RETRY_WAIT", 65),
} as const;
