/**
 * Wallet Intelligence context — structured Cleaner analysis for the AI.
 *
 * This is the data foundation of the "wallet intelligence layer": every
 * number and object below comes from the REAL wallet scan that just ran
 * (Cleaner classification is the source of truth). Nothing is invented,
 * estimated, or hardcoded.
 *
 * Buckets (derived ONLY from Cleaner classification — AI must not override):
 *   safe   — Cleaner says cleanable AND the object holds no balance/value
 *   review — needs inspection: review/suspicious, or cleanable WITH balance
 *   keep   — keep/protected, or anything the Cleaner will not touch
 *
 * SAFETY: public on-chain data only (object ids, types, balances,
 * classifications, reasons). NEVER private keys, seeds, or credentials —
 * the client does not hold them and this module has no field for them.
 *
 * EXTENSION POINT for "FIND WHAT I FORGOT": future detectors (forgotten
 * assets, inactive objects, unusual objects) hook in here as additional
 * bucket entries — never as invented facts. No fake detectors exist today.
 */

import type { WalletObject } from "../scanner/objectClassifier";
import { getNetwork } from "../config";

export type ContextBucket = "safe" | "review" | "keep";

/**
 * Storage-rebate expectation derived from the REAL cleanup mechanics
 * (not a promise of any amount — walletContext carries NO rebate figures):
 *   "yes"     — destroy_zero deletion destroys the object → rebate returns
 *   "unknown" — mechanism-dependent (dust merge needs a partner and keeps
 *               a lone dust coin; NFT/object burns go to 0x0 or vary)
 */
export type RebateExpectation = "yes" | "unknown";

export interface ContextObjectEntry {
  name: string;
  /** public on-chain object id — safe to share, identifies the object */
  objectId: string;
  coinType?: string;
  category: string;
  /** raw Cleaner classification (source of truth) */
  classification: string;
  bucket: ContextBucket;
  /** coin balance in base units, when known */
  balance?: string;
  hasBalance: boolean;
  cleanupAction?: string;
  /**
   * Cleaner classification reason, SANITIZED for AI: any specific-amount
   * claims (e.g. a hardcoded "+0.0028 SUI" inside a classifier string)
   * are removed — the model must never quote figures that are not
   * measured per-transaction data. Mechanism facts are kept.
   */
  reason: string;
  /** whether destroying this object returns the storage rebate */
  rebate: RebateExpectation;
  /**
   * true ONLY for dust micro-balances: the real dust-merge mechanism may
   * combine same-type dust into one coin (balance kept in the wallet) and
   * only when a merge partner exists — a lone dust coin is kept.
   * False for everything else: no consolidation may be promised.
   */
  merge: boolean;
}

/**
 * Remove specific-amount claims from classifier copy before it reaches the
 * model. "Reclaim +0.0028 SUI storage rebate by destroying…" becomes
 * "Reclaim storage rebate by destroying…" — mechanism kept, figure dropped.
 */
export function sanitizeReasonForAI(reason: string): string {
  if (!reason) return "";
  return reason
    .replace(/[+-]?\d[\d,]*(\.\d+)?\s*SUI(\s+per object)?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 140);
}

/** Max entries per bucket sent to the provider (counts are always exact). */
export const CONTEXT_LIST_CAP = 40;
/** Max selectable safe ids attached to cleaning answers. */
export const CONTEXT_SAFE_IDS_CAP = 50;

/**
 * Deterministic action the proxy may attach to cleaning answers.
 * The button ONLY pre-selects objects for the existing review flow
 * (SELECT → REVIEW → CONFIRM → SIGN). AI never signs.
 */
export interface SafeSelectAction {
  type: "select_safe";
  objectIds: string[];
  count: number;
  label: string;
}

export type ChatAction = SafeSelectAction;

export interface WalletContext {
  network: string;
  total: number;
  counts: {
    safe: number;
    review: number;
    keep: number;
    /** coins with an explicit zero balance */
    empty: number;
    /** coins with balance > 0 */
    withBalance: number;
    /** review/suspicious classifications (subset of review) */
    suspicious: number;
  };
  safe: ContextObjectEntry[];
  safeTruncated: number;
  review: ContextObjectEntry[];
  reviewTruncated: number;
  /** keep bucket travels as count + name sample (no action needed there) */
  keepCount: number;
  keepSample: string[];
  /** ids the UI may offer as SELECT SAFE TO CLEAN (safe bucket, capped) */
  safeIds: string[];
}

function parseBalanceUint(raw: string | undefined): bigint | null {
  if (raw === undefined || raw === null) return null;
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  try {
    return BigInt(t);
  } catch {
    return null;
  }
}

function coinTypeOf(o: WalletObject): string | undefined {
  if (o.coinType) return o.coinType;
  const inner = o.type.match(/^0x2::coin::Coin<(.+)>$/);
  return inner ? inner[1] : undefined;
}

/**
 * Derive the intelligence bucket from Cleaner classification.
 * Caution only ever increases: unknown shapes land in review, never safe.
 */
export function bucketFor(o: WalletObject): { bucket: ContextBucket; hasBalance: boolean } {
  const bal = parseBalanceUint(o.coinBalance);
  const hasBalance = bal !== null && bal > 0n;
  switch (o.classification) {
    case "cleanable":
      // Cleanable WITH balance/value still needs human review first —
      // the AI must recommend review, never unconditional deletion.
      if (hasBalance) return { bucket: "review", hasBalance };
      return { bucket: "safe", hasBalance };
    case "review":
    case "suspicious":
      return { bucket: "review", hasBalance };
    case "keep":
    case "protected":
      return { bucket: "keep", hasBalance };
    default:
      return { bucket: "review", hasBalance };
  }
}

/**
 * Derive rebate/merge mechanics from the real cleanup implementation:
 * - zero-balance coin + delete → 0x2::coin::destroy_zero destroys the
 *   object, so the storage rebate returns;
 * - dust with balance → merge candidate only (partner required, balance
 *   kept, lone dust kept): rebate unknown, merge true;
 * - everything else (NFT/object burns to 0x0, withdraw/swap path, keep)
 *   → rebate unknown, merge false: no rebate and no consolidation story.
 */
function mechanicsFor(o: WalletObject, bucket: ContextBucket, hasBalance: boolean): { rebate: RebateExpectation; merge: boolean } {
  if (!hasBalance && o.category === "coin" && o.cleanupAction === "delete" && bucket === "safe") {
    return { rebate: "yes", merge: false };
  }
  if (!!o.dust && hasBalance && !!o.cleanupAction) {
    return { rebate: "unknown", merge: true };
  }
  return { rebate: "unknown", merge: false };
}

function toEntry(o: WalletObject, bucket: ContextBucket, hasBalance: boolean): ContextObjectEntry {
  const { rebate, merge } = mechanicsFor(o, bucket, hasBalance);
  return {
    name: o.name || "Unnamed object",
    objectId: o.objectId,
    coinType: coinTypeOf(o),
    category: o.category,
    classification: o.classification,
    bucket,
    balance: o.coinBalance,
    hasBalance,
    cleanupAction: o.cleanupAction,
    reason: sanitizeReasonForAI(o.reason || ""),
    rebate,
    merge,
  };
}

/**
 * Trust-but-verify for SELECT SAFE TO CLEAN: only ids still present in the
 * current scan AND still Cleaner-classified cleanable (never protected).
 * Used by the UI before pre-selecting; covered by unit tests.
 */
export function filterSelectableSafeIds(objectIds: string[], objects: WalletObject[]): string[] {
  const alive = new Map(objects.map((o) => [o.objectId.toLowerCase(), o]));
  return objectIds.filter((id) => {
    const o = alive.get(id.toLowerCase());
    return !!o && o.classification === "cleanable" && !o.protected;
  });
}

/** Build the structured wallet context from a real scan result. */
export function buildWalletContext(objects: WalletObject[]): WalletContext {
  const safe: ContextObjectEntry[] = [];
  const review: ContextObjectEntry[] = [];
  const keepSample: string[] = [];
  let keepCount = 0;
  let empty = 0;
  let withBalance = 0;
  let suspicious = 0;

  for (const o of objects) {
    const bal = parseBalanceUint(o.coinBalance);
    if (o.category === "coin" && bal === 0n) empty += 1;
    if (bal !== null && bal > 0n) withBalance += 1;
    if (o.classification === "review" || o.classification === "suspicious") suspicious += 1;

    const { bucket, hasBalance } = bucketFor(o);
    if (bucket === "safe") safe.push(toEntry(o, bucket, hasBalance));
    else if (bucket === "review") review.push(toEntry(o, bucket, hasBalance));
    else {
      keepCount += 1;
      if (keepSample.length < 15) keepSample.push(o.name || "Unnamed object");
    }
  }

  return {
    network: getNetwork(),
    total: objects.length,
    counts: { safe: safe.length, review: review.length, keep: keepCount, empty, withBalance, suspicious },
    safe: safe.slice(0, CONTEXT_LIST_CAP),
    safeTruncated: Math.max(0, safe.length - CONTEXT_LIST_CAP),
    review: review.slice(0, CONTEXT_LIST_CAP),
    reviewTruncated: Math.max(0, review.length - CONTEXT_LIST_CAP),
    keepCount,
    keepSample,
    safeIds: safe.slice(0, CONTEXT_SAFE_IDS_CAP).map((e) => e.objectId),
  };
}
