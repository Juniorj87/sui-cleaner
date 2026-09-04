/**
 * AI Analyzer — client-side service for object analysis.
 *
 * All requests go through /api/ai/analyze → server proxy.
 * Browser NEVER sends API keys directly to providers.
 * AI NEVER signs, sends transactions, or receives private keys.
 */

import type { WalletObject } from "../scanner/objectClassifier";
import { getNetwork } from "../config";
import {
  findProjectByCoinType,
  findProjectByName,
  findProjectByPackage,
} from "../data/projectRegistry";
import {
  type ObjectAnalysisInput,
  type AIAnalysis,
  type AIProviderConfig,
  sanitizeForAI,
} from "./provider";
import { getCachedAnalysis, setCachedAnalysis } from "./cache";

/** Build structured input from a WalletObject for AI analysis */
export function buildAnalysisInput(object: WalletObject): ObjectAnalysisInput {
  const network = getNetwork();
  const inner = object.type.match(/^0x2::coin::Coin<(.+)>$/)?.[1];
  const project =
    (inner ? findProjectByCoinType(inner) : undefined) ??
    (object.name ? findProjectByName(object.name) : undefined) ??
    (object.package ? findProjectByPackage(object.package) : undefined);

  return {
    objectId: object.objectId,
    type: object.type,
    category: object.category,
    classification: object.classification,
    cleanupAction: object.cleanupAction,
    protected: object.protected,
    protectedReason: object.reason,
    name: object.name,
    collection: object.collection,
    package: object.package,
    coinBalance: object.coinBalance,
    balance: object.value,
    network,
    digest: object.digest,
    version: object.version,
    cursed: object.cursed,
    dust: object.dust,
    project: project
      ? { name: project.name, symbol: project.symbol, issuer: project.issuer, kind: project.kind, decimals: project.decimals }
      : undefined,
  };
}

/** Rate limit: minimum ms between API calls */
const RATE_LIMIT_MS = 2000;
let lastCallTime = 0;

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - lastCallTime < RATE_LIMIT_MS) return false;
  lastCallTime = now;
  return true;
}

/**
 * Reset the local send throttle. Used ONLY by explicit user RETRY after a
 * failed attempt: one deliberate re-fire must not be blocked by our own
 * client-side limiter (the provider still enforces its own quota).
 */
export function resetChatThrottle(): void {
  lastCallTime = 0;
}

/**
 * Coded AI errors — the UI maps each code to a distinct message
 * (never one universal error). The raw provider detail stays in
 * `detail` and is logged to the dev console, never shown raw.
 */
export type AIErrorCode =
  | "AI_RATE_LIMITED"
  | "AI_INVALID_KEY"
  | "AI_BAD_MODEL"
  | "AI_PROVIDER_DOWN"
  | "AI_BAD_RESPONSE"
  | "AI_BLOCKED"
  | "AI_EMPTY"
  | "AI_NETWORK"
  | "AI_FAILED";

export class AIRequestError extends Error {
  code: AIErrorCode;
  status: number;
  detail: string;
  constructor(code: AIErrorCode, status: number, detail: string) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/** Known proxy error codes (server/ai-proxy.mjs aiError) */
const KNOWN_PROXY_CODES = new Set([
  "rate_limited",
  "invalid_key",
  "bad_model",
  "bad_response",
  "blocked_response",
  "empty_response",
  "provider_unreachable",
  "provider_error",
]);

function proxyCodeToAI(code: string): AIErrorCode {
  switch (code) {
    case "rate_limited": return "AI_RATE_LIMITED";
    case "invalid_key": return "AI_INVALID_KEY";
    case "bad_model": return "AI_BAD_MODEL";
    case "bad_response": return "AI_BAD_RESPONSE";
    case "blocked_response": return "AI_BLOCKED";
    case "empty_response": return "AI_EMPTY";
    case "provider_unreachable":
    case "provider_error": return "AI_PROVIDER_DOWN";
    default: return "AI_FAILED";
  }
}

/** Read a failed proxy response into a coded error (keeps legacy mapping). */
async function throwProxyError(res: Response): Promise<never> {
  let code: AIErrorCode = "AI_FAILED";
  let detail = "";
  try {
    const text = await res.text();
    detail = text.slice(0, 300);
    try {
      const body = JSON.parse(text) as { code?: string; error?: string };
      if (body && typeof body.code === "string" && KNOWN_PROXY_CODES.has(body.code)) {
        code = proxyCodeToAI(body.code);
        detail = typeof body.error === "string" && body.error ? body.error : detail;
      } else if (res.status === 429) code = "AI_RATE_LIMITED";
      else if (res.status === 401) code = "AI_INVALID_KEY";
    } catch {
      if (res.status === 429) code = "AI_RATE_LIMITED";
      else if (res.status === 401) code = "AI_INVALID_KEY";
    }
  } catch {
    // body unreadable — keep AI_FAILED
  }
  // Development visibility: the REAL cause (status + provider detail).
  // The request body is never logged — it contains the user's API key.
  if (import.meta.env.DEV) {
    console.error("[CleanerAI] request failed", { code, status: res.status, detail });
  }
  throw new AIRequestError(code, res.status, detail);
}

function throwNetworkError(e: unknown): never {
  const detail = e instanceof Error ? e.message : String(e);
  if (import.meta.env.DEV) {
    console.error("[CleanerAI] network failure", { detail });
  }
  throw new AIRequestError("AI_NETWORK", 0, detail.slice(0, 300));
}

export interface AnalyzeResult {
  analysis: AIAnalysis;
  fromCache: boolean;
}

/** Analyze a single object — with caching and rate limiting */
export async function analyzeObject(
  object: WalletObject,
  config: AIProviderConfig
): Promise<AnalyzeResult> {
  const network = getNetwork();
  const input = buildAnalysisInput(object);

  const cached = getCachedAnalysis(object.objectId, network, object.digest, object.version, config.model);
  if (cached) return { analysis: cached, fromCache: true };

  if (!checkRateLimit()) throw new Error("RATE_LIMITED");

  let res: Response;
  try {
    res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, apiKey: config.apiKey, model: config.model, provider: config.provider }),
    });
  } catch (e) {
    throwNetworkError(e);
  }

  if (!res.ok) await throwProxyError(res);

  const analysis: AIAnalysis = await res.json();
  if (!analysis.verdict || !analysis.confidence || !analysis.summary) throw new Error("Invalid AI response structure");

  setCachedAnalysis(object.objectId, network, analysis, object.digest, object.version, config.model);
  return { analysis, fromCache: false };
}

/**
 * Structured chat (legacy contract) — provider must return the analysis JSON.
 * Kept for the object-analysis card flows; the free-text assistant uses
 * askChat below so normal questions never go through a JSON parser.
 */
export async function askQuestion(
  question: string,
  config: AIProviderConfig,
  objectInput?: ObjectAnalysisInput,
  walletStats?: { knownAssets: number; protected: number; needsReview: number; verifiedCleanup: number; sweepToSui: number; total: number; sampleText: string },
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<AIAnalysis> {
  if (!checkRateLimit()) throw new Error("RATE_LIMITED");

  let res: Response;
  try {
    res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "chat",
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        question: sanitizeForAI(question),
        objectInput: objectInput ?? null,
        walletStats: walletStats ?? null,
        conversationHistory: conversationHistory ?? [],
      }),
    });
  } catch (e) {
    throwNetworkError(e);
  }

  if (!res.ok) await throwProxyError(res);

  let analysis: AIAnalysis;
  try {
    analysis = (await res.json()) as AIAnalysis;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) {
      console.error("[CleanerAI] unreadable proxy response", { detail });
    }
    throw new AIRequestError("AI_BAD_RESPONSE", res.status, detail.slice(0, 300));
  }
  if (!analysis.summary) throw new AIRequestError("AI_BAD_RESPONSE", res.status, "empty summary");
  return analysis;
}

export interface ChatAnswer {
  text: string;
  action?: import("./walletContext").ChatAction;
}

/**
 * Free-text chat — plain questions get plain-text answers.
 * If the provider returned valid text, it is shown as-is: no JSON schema
 * is demanded, so a good answer can never become "UNREADABLE".
 */
export async function askChat(
  question: string,
  config: AIProviderConfig,
  objectInput?: ObjectAnalysisInput,
  walletStats?: { knownAssets: number; protected: number; needsReview: number; verifiedCleanup: number; sweepToSui: number; total: number; sampleText: string },
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
  walletContext?: import("./walletContext").WalletContext
): Promise<ChatAnswer> {
  if (!checkRateLimit()) throw new Error("RATE_LIMITED");

  let res: Response;
  try {
    res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "chat",
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        question: sanitizeForAI(question),
        objectInput: objectInput ?? null,
        walletStats: walletStats ?? null,
        walletContext: walletContext ?? null,
        conversationHistory: conversationHistory ?? [],
      }),
    });
  } catch (e) {
    throwNetworkError(e);
  }

  if (!res.ok) await throwProxyError(res);

  let body: { text?: unknown; action?: import("./walletContext").ChatAction };
  try {
    body = (await res.json()) as { text?: unknown; action?: import("./walletContext").ChatAction };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (import.meta.env.DEV) {
      console.error("[CleanerAI] unreadable proxy response", { detail });
    }
    throw new AIRequestError("AI_BAD_RESPONSE", res.status, detail.slice(0, 300));
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    throw new AIRequestError("AI_BAD_RESPONSE", res.status, "empty text");
  }
  const action = body.action;
  if (action && action.type === "select_safe" && Array.isArray(action.objectIds) && action.objectIds.length > 0) {
    return { text: body.text, action };
  }
  return { text: body.text };
}
