import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context. In HTTP mode we stash the SalesBox token supplied via
 * the `X-Salesbox-Token` header here so the client can pick it up without every
 * tool having to thread it through explicitly.
 */
export interface RequestContext {
  token?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Token from the current request context, if any. */
export function contextToken(): string | undefined {
  return requestContext.getStore()?.token;
}
