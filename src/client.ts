/**
 * Thin HTTP client for the SalesBox public OpenAPI.
 *
 * - Base URL and token come from env (see config.ts), with an optional
 *   per-request token override (used by the HTTP transport so each MCP
 *   client can supply its own token via header).
 * - Honours the documented rate limits: on HTTP 429 it reads Retry-After
 *   and retries a bounded number of times.
 */

import { CONFIG } from "./config.js";
import { contextToken } from "./context.js";

export interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path beginning with `/openapi/...` */
  path: string;
  /** Query params; undefined/null values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON body for POST/PUT/PATCH/DELETE. */
  body?: unknown;
  /** Overrides the default token (from env) for this call. */
  token?: string;
}

export interface ApiResult {
  status: number;
  ok: boolean;
  data: unknown;
}

export class SalesBoxError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "SalesBoxError";
  }
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, CONFIG.baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function apiRequest(opts: RequestOptions): Promise<ApiResult> {
  const token = opts.token ?? contextToken() ?? CONFIG.token;
  if (!token) {
    throw new SalesBoxError(
      "No SalesBox API token configured. Set SALESBOX_API_TOKEN (or pass a token via the X-Salesbox-Token header in HTTP mode).",
      401,
      null,
    );
  }

  const url = buildUrl(opts.path, opts.query);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  let bodyStr: string | undefined;
  if (opts.body !== undefined && opts.method !== "GET") {
    bodyStr = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }

  const maxRetries = CONFIG.maxRetriesOn429;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: opts.method,
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(CONFIG.requestTimeoutMs),
    });

    // Rate limited — respect Retry-After, then retry a bounded number of times.
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get("retry-after")) || 60;
      // Cap the wait so we never block indefinitely.
      const waitMs = Math.min(retryAfter, CONFIG.maxRetryWaitSeconds) * 1000;
      await sleep(waitMs);
      continue;
    }

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      throw new SalesBoxError(
        `SalesBox API ${opts.method} ${opts.path} failed with HTTP ${res.status}`,
        res.status,
        data,
      );
    }

    return { status: res.status, ok: true, data };
  }
}
