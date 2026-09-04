/**
 * Client transport for the same-origin read-only proxy.
 *
 *  - /api/rpc      — JSON-RPC 2.0: the proxy relays only whitelisted read
 *                    methods, so there is no CORS and no write path.
 *  - /api/graphql  — GraphQL: the proxy accepts read-only queries and relays
 *                    them to the Sui GraphQL RPC (the modern standard).
 *
 * The browser never talks to a public RPC directly.
 */

export type ProxyRpcErrorCode =
  | "rpc-unavailable"
  | "rate-limited"
  | "rpc-error"
  | "method-not-allowed"
  | "invalid-address";

export class ProxyRpcError extends Error {
  code: ProxyRpcErrorCode;
  constructor(code: ProxyRpcErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

interface JsonRpcEnvelope<T> {
  result?: T;
  error?: { code?: number; message?: string };
}

function messageFor(code: ProxyRpcErrorCode): string {
  switch (code) {
    case "rate-limited":
      return "Too many requests. Try again shortly.";
    case "rpc-unavailable":
      return "RPC unavailable. Check your connection and try again.";
    case "method-not-allowed":
      return "This RPC method is not allowed through the read-only proxy.";
    case "invalid-address":
      return "The address is not a valid Sui address.";
    default:
      return "RPC error.";
  }
}

export async function proxyRpc<T>(method: string, params: unknown[]): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
  } catch {
    throw new ProxyRpcError("rpc-unavailable", messageFor("rpc-unavailable"));
  }

  let json: JsonRpcEnvelope<T> | null = null;
  try {
    json = (await res.json()) as JsonRpcEnvelope<T>;
  } catch {
    throw new ProxyRpcError("rpc-unavailable", messageFor("rpc-unavailable"));
  }
  if (!json) {
    throw new ProxyRpcError("rpc-unavailable", messageFor("rpc-unavailable"));
  }
  // map proxy-level errors by HTTP status / JSON-RPC error
  if (json.error) {
    const msg = json.error.message ?? "";
    if (res.status === 429 || msg === "rate-limited") {
      throw new ProxyRpcError("rate-limited", messageFor("rate-limited"));
    }
    if (res.status === 400 && msg === "invalid-address") {
      throw new ProxyRpcError("invalid-address", messageFor("invalid-address"));
    }
    if (res.status === 400) {
      throw new ProxyRpcError("method-not-allowed", messageFor("method-not-allowed"));
    }
    if (res.status >= 500 || msg === "rpc-unavailable") {
      throw new ProxyRpcError("rpc-unavailable", messageFor("rpc-unavailable"));
    }
    throw new ProxyRpcError("rpc-error", msg || messageFor("rpc-error"));
  }
  if (json.result === undefined) {
    throw new ProxyRpcError("rpc-error", messageFor("rpc-error"));
  }
  return json.result;
}

/** Fetch the non-secret server configuration (network, treasury, spam list). */
export interface ServerConfig {
  network: string;
  rpcProvider: string;
  serviceFeeAddress: string;
  serviceFeeConfigured: boolean;
  /** package ids flagged by the server-loaded spam registry (may be empty) */
  spamList: string[];
}

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: { message?: string }[];
}

/**
 * GraphQL query through the same-origin read-only proxy (/api/graphql).
 * The proxy rejects mutations and subscriptions — queries only.
 */
export async function proxyGraphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ProxyRpcError("rpc-unavailable", messageFor("rpc-unavailable"));
  }

  let json: GraphqlEnvelope<T> | null = null;
  try {
    json = (await res.json()) as GraphqlEnvelope<T>;
  } catch {
    throw new ProxyRpcError("rpc-unavailable", messageFor("rpc-unavailable"));
  }
  if (!json) {
    throw new ProxyRpcError("rpc-unavailable", messageFor("rpc-unavailable"));
  }
  if (res.status === 429 || json.errors?.some((e) => e.message === "rate-limited")) {
    throw new ProxyRpcError("rate-limited", messageFor("rate-limited"));
  }
  if (json.errors && json.errors.length > 0) {
    throw new ProxyRpcError("rpc-error", json.errors[0]?.message || messageFor("rpc-error"));
  }
  if (json.data === undefined) {
    throw new ProxyRpcError("rpc-error", messageFor("rpc-error"));
  }
  return json.data;
}

let configCache: ServerConfig | null = null;

export async function fetchServerConfig(force = false): Promise<ServerConfig> {
  if (configCache && !force) return configCache;
  const res = await fetch("/api/config");
  if (!res.ok) {
    throw new ProxyRpcError("rpc-unavailable", "Config unavailable.");
  }
  const json = (await res.json()) as ServerConfig;
  configCache = json;
  return json;
}
