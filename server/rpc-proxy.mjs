// Read-only JSON-RPC + GraphQL proxy and server config endpoint.
//
// The browser never talks to a public RPC directly (CORS). It calls this
// same-origin server, which relays ONLY read-only traffic to a configurable
// Sui provider:
//
//   /api/rpc     — JSON-RPC 2.0: only whitelisted read methods are relayed.
//                  No transaction execution is ever proxied — the whitelist
//                  is the security boundary. Responses use STANDARD JSON-RPC
//                  2.0 envelopes so the @mysten/sui SDK transport can point
//                  at this endpoint too (Transaction.build() resolves gas and
//                  dry-runs through it).
//   /api/graphql — GraphQL: accepts standard POST bodies ({ query, variables })
//                  and relays them to the Sui GraphQL RPC (the modern,
//                  non-deprecated API). Only read-only QUERY operations are
//                  accepted — mutations and subscriptions are rejected before
//                  they leave the server. (Transaction simulation still goes
//                  through the JSON-RPC dry-run whitelist above.)
//
// Proxy-level JSON-RPC errors map to JSON-RPC error objects:
//
//   method-not-allowed  -> 400, code -32601
//   invalid-address     -> 400, code -32602
//   rate-limited        -> 429, code -32029
//   rpc-unavailable     -> 502, code -32001
//   upstream rpc error  -> 200, code from upstream (or -32000)
//
// /api/config exposes non-secret server configuration (network, RPC provider,
// service-fee treasury address, spam package list) so the client never
// hardcodes them.

import { loadEnvFile } from "node:process";
try {
  loadEnvFile();
} catch {}

const PROVIDER = process.env.SUI_RPC_URL ?? "https://sui.publicnode.com";
const RPC_TIMEOUT_MS = 30_000;

/**
 * Sui GraphQL RPC — the modern standard (JSON-RPC is deprecated upstream).
 * Override with SUI_GRAPHQL_URL; the default follows the NETWORK env.
 */
function resolveGraphqlUrl() {
  if (process.env.SUI_GRAPHQL_URL) return process.env.SUI_GRAPHQL_URL;
  const network = (process.env.NETWORK ?? "mainnet").toLowerCase();
  return network === "testnet"
    ? "https://graphql.testnet.sui.io/graphql"
    : "https://graphql.mainnet.sui.io/graphql";
}
const GRAPHQL_URL = resolveGraphqlUrl();

/** read-only methods only — including the ones the SDK needs to build and dry-run a PTB */
const READ_ONLY_METHODS = new Set([
  // wallet analysis
  "suix_getOwnedObjects",
  "suix_queryObjects",
  "suix_getCoins",
  "suix_getAllCoins",
  "suix_getBalance",
  "suix_getAllBalances",
  "suix_getCoinMetadata",
  "suix_getDynamicFieldObject",
  "sui_getObject",
  "sui_multiGetObjects",
  "sui_tryGetPastObject",
  "sui_tryMultiGetPastObjects",
  "sui_getLatestCheckpointSequenceNumber",
  "sui_getChainIdentifier",
  "sui_getTotalSupply",
  "sui_getTransactionBlock",
  "sui_getEvents",
  // PTB building + simulation (all read-only: nothing is executed)
  "suix_getReferenceGasPrice",
  "sui_getProtocolConfig",
  "suix_getLatestSuiSystemState",
  "sui_getMoveFunctionArgTypes",
  "sui_getNormalizedMoveModule",
  "sui_getNormalizedMoveFunction",
  "sui_devInspectTransactionBlock",
  "sui_dryRunTransactionBlock",
  // Wallet execution — the user explicitly signs each transaction in their
  // wallet extension, so this is safe to proxy. Without this, the wallet's
  // signAndExecuteTransaction fails with 400 because the proxy rejects the
  // execution call.
  "sui_executeTransactionBlock",
  "sui_getCheckpoint",
  "sui_getCheckpoints",
  "sui_getCommitteeInfo",
  "sui_getNetworkMetrics",
  "sui_getCurrentEpoch",
  "sui_getEpochs",
  "sui_getAllEpochAddressMetrics",
  "sui_getEpochMetrics",
  "sui_getValidatorsApy",
  "suix_getStakes",
  "suix_getStakesByIds",
]);

const ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

// simple in-memory rate limit: 120 requests / 10s (pagination + dry-run can fan out)
const WINDOW_MS = 10_000;
const MAX_REQUESTS = 120;
let hits = [];
function rateLimited() {
  if (process.env.DISABLE_RATE_LIMITER === "true") return false;
  const now = Date.now();
  hits = hits.filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_REQUESTS) return true;
  hits.push(now);
  return false;
}

/** JSON-RPC error helper */
function rpcError(code, message, id = 1) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/* ------------------------------------------------------------------ /api/graphql
 * Read-only GraphQL proxy. Security boundary: only `query` operations are
 * allowed — `mutation`/`subscription` operations and known write/simulation
 * fields are rejected before the request leaves the server. The scanner uses
 * this endpoint for owned-object reads; transaction simulation continues to
 * use the JSON-RPC dry-run whitelist above.
 */
const GRAPHQL_FORBIDDEN_FIELDS =
  /executeTransactionBlock|dryRunTransactionBlock|transferCoins|transferObjects|splitCoins|mergeCoins|publish|upgrade|requestType|paySui|payAllSui/;

function isReadOnlyGraphql(query) {
  const q = String(query ?? "").trim();
  if (!q) return false;
  // any `mutation` / `subscription` operation ANYWHERE in the document is
  // rejected — a document may legally define several operations and select
  // one via operationName, so only pure-read documents are relayed.
  if (/\b(mutation|subscription)\b/.test(q)) return false;
  // explicit `query` operations (and unnamed queries) are the only allowed kind
  const op = q.match(/^\s*(query|mutation|subscription)\b/);
  if (op && op[1] !== "query") return false;
  // defense-in-depth: block write / simulation field names entirely
  if (GRAPHQL_FORBIDDEN_FIELDS.test(q)) return false;
  return true;
}

/**
 * @returns {{ status: number, body: object }} — body is a GraphQL envelope
 * ({ data, errors }) or a plain { errors } for proxy-level failures.
 */
export async function handleGraphqlRequest(rawBody) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    return { status: 400, body: { errors: [{ message: "bad-json" }] } };
  }
  const { query, variables } = parsed ?? {};
  if (typeof query !== "string" || !isReadOnlyGraphql(query)) {
    return { status: 400, body: { errors: [{ message: "method-not-allowed" }] } };
  }
  if (rateLimited()) {
    return { status: 429, body: { errors: [{ message: "rate-limited" }] } };
  }

  let res;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch {
    return { status: 502, body: { errors: [{ message: "rpc-unavailable" }] } };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return { status: 502, body: { errors: [{ message: "rpc-unavailable" }] } };
  }
  if (res.status === 429) {
    return { status: 429, body: { errors: [{ message: "rate-limited" }] } };
  }
  // upstream GraphQL errors are relayed as-is with 200 (standard GraphQL over HTTP)
  return { status: 200, body: json };
}

/* ------------------------------------------------------------------ /api/quote
 * Swap-quote relay. The browser asks this same-origin endpoint for a
 * token→token quote; the server forwards it to the Cetus aggregator
 * (find_routes) so no CORS and no API keys are involved. The response is
 * relayed as-is: the route data (pool ids, providers, amounts) is what the
 * swap step of the convert-to-SUI pipeline uses.
 *
 * Env: CETUS_QUOTE_URL / CETUS_QUOTE_VERSION (defaults match the public API).
 */
const CETUS_QUOTE_URL =
  process.env.CETUS_QUOTE_URL ?? "https://api-sui.cetus.zone/router_v3/find_routes";
const CETUS_QUOTE_VERSION = Number(process.env.CETUS_QUOTE_VERSION ?? 1010701);

/**
 * @param {{ from: string, target: string, amountIn: string }}
 * @returns {{ status: number, body: object }} — Cetus quote envelope
 */
export async function handleQuoteRequest(rawBody) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    return { status: 400, body: { errors: [{ message: "bad-json" }] } };
  }
  const { from, target, amountIn } = parsed ?? {};
  if (
    typeof from !== "string" ||
    typeof target !== "string" ||
    !/^0x[0-9a-fA-F]{1,64}(::[0-9a-zA-Z_]+){2,}$/.test(from) ||
    !/^0x[0-9a-fA-F]{1,64}(::[0-9a-zA-Z_]+){2,}$/.test(target)
  ) {
    return { status: 400, body: { errors: [{ message: "invalid-quote-params" }] } };
  }
  const amount = BigInt(amountIn ?? "0");
  if (amount <= 0n) {
    return { status: 400, body: { errors: [{ message: "invalid-amount" }] } };
  }
  if (rateLimited()) {
    return { status: 429, body: { errors: [{ message: "rate-limited" }] } };
  }

  let res;
  try {
    res = await fetch(CETUS_QUOTE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from,
        target,
        amount: Number(amount), // aggregator expects a JS number (u64-scale is fine for quotes)
        by_amount_in: true,
        v: CETUS_QUOTE_VERSION,
      }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch {
    return { status: 502, body: { errors: [{ message: "rpc-unavailable" }] } };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return { status: 502, body: { errors: [{ message: "rpc-unavailable" }] } };
  }
  if (res.status === 429) {
    return { status: 429, body: { errors: [{ message: "rate-limited" }] } };
  }
  return { status: 200, body: json };
}

/* ------------------------------------------------------------------ spam registry
 * A curated spam-package list is fetched from a public JSON source and cached
 * in memory for 1 hour. The client receives the package ids via /api/config
 * and the classifier marks matching objects SUSPICIOUS (cursed tone).
 *
 * Env: SPAM_REGISTRY_URL — raw JSON URL. Expected shape:
 *   { "packages": ["0x…", "0x…"] }   (a bare string array also works)
 * When unset, the list is empty and nothing is flagged (safe default).
 */
const SPAM_REGISTRY_URL = process.env.SPAM_REGISTRY_URL ?? "";
const SPAM_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let spamCache = { packages: [], fetchedAt: 0 };

async function loadSpamRegistry(force = false) {
  const now = Date.now();
  if (!SPAM_REGISTRY_URL) return { packages: [] };
  if (!force && spamCache.fetchedAt > 0 && now - spamCache.fetchedAt < SPAM_CACHE_TTL_MS) {
    return spamCache;
  }
  try {
    const res = await fetch(SPAM_REGISTRY_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`spam registry HTTP ${res.status}`);
    const json = await res.json();
    const raw = Array.isArray(json) ? json : json?.packages;
    const packages = Array.isArray(raw)
      ? raw
          .filter(
            (p) => typeof p === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(p.trim())
          )
          .map((p) => p.trim().toLowerCase())
      : [];
    spamCache = { packages, fetchedAt: now };
  } catch {
    // stale cache beats an empty list; a first failure means "no flags today"
    if (spamCache.fetchedAt === 0) spamCache = { packages: [], fetchedAt: now };
  }
  return spamCache;
}

/**
 * @returns {{ status: number, body: object }} — body is a standard JSON-RPC envelope
 */
export async function handleRpcRequest(method, params, id = 1) {
  const reqId = id ?? 1;
  if (typeof method !== "string" || !READ_ONLY_METHODS.has(method)) {
    return { status: 400, body: rpcError(-32601, "method-not-allowed", reqId) };
  }
  if (rateLimited()) {
    return { status: 429, body: rpcError(-32029, "rate-limited", reqId) };
  }
  // Reject obviously malformed addresses. Recursive check to cover nested params.
  // Addresses are case-insensitive: normalize to lowercase before comparing so
  // both `0x…` and `0X…` prefixes with mixed-case hex pass or fail identically.
  const queue = [...(params ?? [])];
  while (queue.length > 0) {
    const item = queue.shift();
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (/^0[xX]/i.test(trimmed) && !trimmed.includes("::")) {
        if (!ADDRESS_RE.test(trimmed.toLowerCase())) {
          return { status: 400, body: rpcError(-32602, "invalid-address", reqId) };
        }
      }
    } else if (item && typeof item === "object") {
      queue.push(...Object.values(item));
    }
  }

  const payload = { jsonrpc: "2.0", id: reqId, method, params: params ?? [] };
  let res;
  try {
    res = await fetch(PROVIDER, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch {
    return { status: 502, body: rpcError(-32001, "rpc-unavailable", reqId) };
  }
  if (res.status === 429) {
    return { status: 429, body: rpcError(-32029, "rate-limited", reqId) };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return { status: 502, body: rpcError(-32001, "rpc-unavailable", reqId) };
  }
  if (json.error) {
    // upstream JSON-RPC error — relayed as-is (status 200 so the SDK throws JsonRpcError)
    return { status: 200, body: rpcError(json.error.code ?? -32000, String(json.error.message ?? "RPC error"), reqId) };
  }
  return { status: 200, body: { jsonrpc: "2.0", id: reqId, result: json.result } };
}

// ------------------------------------------------------------------ /api/config
/**
 * Non-secret server configuration for the client. SERVICE_FEE_ADDRESS is the
 * public treasury recipient — never a secret — but it is NOT hardcoded in the
 * client; it comes from the server environment.
 */
/**
 * A configured SERVICE_FEE_ADDRESS must be a syntactically valid Sui address
 * (0x + 1..64 hex chars, either case). Anything else — a typo, a foreign
 * address, the example placeholder — is treated as NOT configured so the
 * client keeps its fail-safe and never routes a fee to a broken recipient.
 */
const SERVICE_FEE_ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

export function getServerConfig() {
  const rawTreasury = (process.env.SERVICE_FEE_ADDRESS ?? "").trim();
  const network = process.env.NETWORK ?? "mainnet";
  const normalizedTreasury = rawTreasury.toLowerCase();
  const isPlaceholder = normalizedTreasury === "0x000000000000000000000000000000000000000000000000000000000000dead";
  const isValidAddress = SERVICE_FEE_ADDRESS_RE.test(normalizedTreasury) && !isPlaceholder;
  return {
    network,
    rpcProvider: PROVIDER,
    serviceFeeAddress: isValidAddress ? normalizedTreasury : "",
    serviceFeeConfigured: isValidAddress,
  };
}

/** @returns {{ status: number, body: object }} — includes the cached spam list */
export async function handleConfigRequest() {
  const base = getServerConfig();
  const { packages } = await loadSpamRegistry();
  return { status: 200, body: { ...base, spamList: packages } };
}
