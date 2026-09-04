/**
 * TX EFFECT ANALYZER (pure, no network)
 *
 * Reads an ALREADY-FETCHED Sui transaction block and decides, from the
 * on-chain record ONLY:
 *
 *   outcome  → "success"  (effects.status.status === "success")
 *            → "failure"  (effects.status.status === "failure")
 *            → "unknown"  (no usable effects status — the block could not
 *                          be trusted as evidence either way)
 *
 * It also extracts the ACTUAL financials that the Success screen may show:
 * gross gas (computation + storage), storage rebate, the fee actually
 * received by the treasury (balance changes), the sender's real SUI balance
 * change, and the resulting net result — all from effects.gasUsed and
 * balanceChanges, never from pre-sign estimates or local selection state.
 *
 * DELETION DETECTION — multiple independent sources, compared by object ID:
 *   1. effects.deleted            (authoritative: object refs the chain deleted)
 *   2. objectChanges[type=deleted]
 * A selected object counts as "deleted" when ANY source lists it. A
 * successful transaction is NEVER reported as failed just because one of the
 * sources omitted it (some providers/indexers only expose effects.deleted).
 *
 * This module performs no RPC calls and imports nothing browser-specific so
 * it can be unit-tested offline with a captured block.
 */

export const SUI_COIN_TYPE = "0x2::sui::SUI";

export interface TxBlockLike {
  digest?: string;
  effects?: {
    status?: { status?: string | null; error?: string | null } | null;
    gasUsed?: {
      computationCost?: string | number;
      storageCost?: string | number;
      storageRebate?: string | number;
      nonRefundableStorageFee?: string | number;
    } | null;
    deleted?: Array<{ objectId?: string }> | null;
  } | null;
  objectChanges?: Array<{
    type?: string;
    objectId?: string;
    objectType?: string;
    owner?: unknown;
  }> | null;
  balanceChanges?: Array<{ owner?: unknown; coinType?: string; amount?: string | number }> | null;
}

export interface AnalyzeTxOptions {
  /** object ids the cleanup plan said the transaction would act on */
  actedOnIds: string[];
  /** the wallet owner address (used to read sender SUI balance changes) */
  walletAddress: string;
  /** configured treasury address (may be null when not configured) */
  treasuryAddress: string | null;
  /** expected service fee in MIST (only used as a fallback/check) */
  expectedFeeMist: bigint;
}

export interface TxEffectAnalysis {
  /** chain verdict: "success" | "failure" | "unknown" */
  outcome: "success" | "failure" | "unknown";
  /** raw effects status string (or "unknown"/"missing") */
  effectsStatus: string;
  /** chain error text when the transaction failed */
  chainError?: string;
  /** object IDs actually deleted on-chain (union of all sources) */
  deletedIds: string[];
  /** acted-on objects that no on-chain source reports as deleted */
  missingDeletions: string[];
  /** deleted objects that were NOT in the acted-on set */
  unexpectedDeletions: string[];
  /** objects transferred/wrapped that were not in the acted-on set */
  unexpectedChanges: string[];
  /** gross network gas charged = computationCost + storageCost (MIST) */
  grossGasMist?: bigint;
  /** net gas effect = computation + storage − storage rebate (MIST) */
  netGasMist?: bigint;
  /** storage rebate credited to the sender (MIST) */
  storageRebateMist?: bigint;
  /** actual SUI the treasury received (MIST), from balance changes */
  treasuryReceivedMist?: bigint;
  /** treasury received exactly the expected fee and nothing else */
  treasuryVerified: boolean;
  /** actual net SUI change of the wallet owner (MIST), from balance changes */
  senderNetMist?: bigint;
  /** ACTUAL net result = sender balance change (or rebate − gas − fee) */
  netResultMist?: bigint;
  /** human-readable notes for the UI (never "failure" on chain success) */
  discrepancies: string[];
}

const SUI_RE = /^0x[0-9a-fA-F]{1,64}$/;

/** Extract an address from the various owner representations Sui returns. */
export function ownerAddressOf(owner: unknown): string | null {
  if (typeof owner === "string") {
    const t = owner.trim();
    return SUI_RE.test(t) ? t.toLowerCase() : null;
  }
  if (owner && typeof owner === "object") {
    const o = owner as Record<string, unknown>;
    for (const key of ["AddressOwner", "ObjectOwner", "Address"]) {
      const v = o[key];
      if (typeof v === "string" && SUI_RE.test(v.trim())) return v.trim().toLowerCase();
    }
    const consensus = o.ConsensusAddressOwner as { owner?: unknown } | undefined;
    if (consensus && typeof consensus.owner === "string" && SUI_RE.test(consensus.owner.trim())) {
      return consensus.owner.trim().toLowerCase();
    }
    if (o.ObjectOwner && typeof o.ObjectOwner === "object") {
      const inner = (o.ObjectOwner as Record<string, unknown>).owner;
      if (typeof inner === "string" && SUI_RE.test(inner.trim())) return inner.trim().toLowerCase();
    }
  }
  return null;
}

function num(v: string | number | undefined): bigint {
  if (v === undefined || v === null) return 0n;
  try {
    return BigInt(String(v));
  } catch {
    return 0n;
  }
}

function uniqueLower(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const k = id.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Analyze an executed transaction block purely from its on-chain record.
 */
export function analyzeTxEffects(block: TxBlockLike | null | undefined, opts: AnalyzeTxOptions): TxEffectAnalysis {
  const discrepancies: string[] = [];
  const actedSet = new Set(opts.actedOnIds.map((id) => id.trim().toLowerCase()));
  const effects = block?.effects;
  const rawStatus = effects?.status?.status;
  const effectsStatus = typeof rawStatus === "string" && rawStatus ? rawStatus : "unknown";
  const chainError = effects?.status?.error ?? undefined;

  // ── On-chain outcome — the ONLY decision input for success vs failure ──
  let outcome: TxEffectAnalysis["outcome"];
  if (effectsStatus === "success") outcome = "success";
  else if (effectsStatus === "failure") outcome = "failure";
  else outcome = "unknown";

  // Deleted objects — union of effects.deleted and objectChanges[deleted].
  const fromEffectsDeleted = (effects?.deleted ?? []).map((r) => r?.objectId ?? "").filter(Boolean);
  const fromObjectChangesDeleted = (block?.objectChanges ?? [])
    .filter((c) => c?.type === "deleted")
    .map((c) => c?.objectId ?? "")
    .filter(Boolean);
  const deletedIds = uniqueLower([...fromEffectsDeleted, ...fromObjectChangesDeleted]);
  const deletedSet = new Set(deletedIds);

  const missingDeletions = opts.actedOnIds
    .map((id) => id.trim().toLowerCase())
    .filter((id) => id && !deletedSet.has(id));
  const unexpectedDeletions = deletedIds.filter((id) => !actedSet.has(id));

  // Objects that MOVED to another owner outside the acted-on set. Plain
  // "mutated" entries are normal plumbing (the sender's SUI gas coin pays
  // gas; a dust merge mutates its target coin) and created SUI coins are the
  // fee transfer to the treasury — none of those are anomalies.
  const unexpectedChanges: string[] = [];
  for (const change of block?.objectChanges ?? []) {
    const type = change?.type;
    const id = change?.objectId?.trim().toLowerCase();
    if (!id || actedSet.has(id)) continue;
    const isSuiCoin = change?.objectType === SUI_COIN_TYPE;
    if ((type === "transferred" || type === "wrapped") && !isSuiCoin) {
      unexpectedChanges.push(id);
    }
  }

  // ── Actual gas + rebate from effects.gasUsed ─────────────────────────
  const gas = effects?.gasUsed;
  const grossGasMist = gas ? num(gas.computationCost) + num(gas.storageCost) : undefined;
  const storageRebateMist = gas ? num(gas.storageRebate) : undefined;
  const netGasMist =
    gas ? num(gas.computationCost) + num(gas.storageCost) - num(gas.storageRebate) : undefined;

  // ── Actual fee + sender change from balanceChanges ───────────────────
  const wallet = opts.walletAddress.trim().toLowerCase();
  const treasury = opts.treasuryAddress?.trim().toLowerCase() ?? null;

  let treasuryReceivedMist: bigint | undefined;
  let treasuryNonSuiCount = 0;
  let senderNetMist: bigint | undefined;

  for (const b of block?.balanceChanges ?? []) {
    const owner = ownerAddressOf(b?.owner);
    const amount = num(b?.amount);
    const isSui = b?.coinType === SUI_COIN_TYPE;
    if (!owner) continue;
    if (treasury && owner === treasury) {
      if (isSui) {
        treasuryReceivedMist = (treasuryReceivedMist ?? 0n) + amount;
      } else if (amount > 0n) {
        treasuryNonSuiCount += 1;
      }
    }
    if (owner === wallet && isSui) {
      senderNetMist = (senderNetMist ?? 0n) + amount;
    }
  }

  // ACTUAL net result. Prefer the sender's real, on-chain balance change —
  // the exact amount the wallet owner gained/lost. Fall back to the formula
  // (rebate − gross gas − fee) only when balance changes were unavailable.
  const feeForNet =
    treasuryReceivedMist !== undefined
      ? treasuryReceivedMist
      : netGasMist !== undefined
        ? opts.expectedFeeMist
        : undefined;
  const netResultMist =
    senderNetMist ??
    (storageRebateMist !== undefined && grossGasMist !== undefined && feeForNet !== undefined
      ? storageRebateMist - grossGasMist - feeForNet
      : undefined);

  // ── Notes (never flip chain success to "failed") ─────────────────────
  if (outcome === "success") {
    if (missingDeletions.length > 0) {
      discrepancies.push(
        `${missingDeletions.length} selected object(s) not deleted by the transaction: ${missingDeletions
          .map((id) => id.slice(0, 12))
          .join(", ")}`
      );
    }
    if (unexpectedDeletions.length > 0) {
      discrepancies.push(
        `${unexpectedDeletions.length} unexpected object(s) deleted on-chain: ${unexpectedDeletions
          .map((id) => id.slice(0, 12))
          .join(", ")}`
      );
    }
    if (unexpectedChanges.length > 0) {
      discrepancies.push(
        `${unexpectedChanges.length} unexpected object change(s): ${unexpectedChanges
          .map((id) => id.slice(0, 12))
          .join(", ")}`
      );
    }
    if (treasury) {
      if (treasuryReceivedMist === undefined) {
        discrepancies.push("Treasury balance change not found in transaction record.");
      } else if (treasuryReceivedMist !== opts.expectedFeeMist) {
        discrepancies.push(
          `Treasury received ${treasuryReceivedMist} MIST (expected ${opts.expectedFeeMist} MIST)`
        );
      }
      if (treasuryNonSuiCount > 0) {
        discrepancies.push(`Treasury received ${treasuryNonSuiCount} unexpected non-SUI token(s).`);
      }
    } else {
      discrepancies.push("No treasury address configured — service-fee transfer not verified.");
    }
  }

  const treasuryVerified =
    !!treasury &&
    treasuryReceivedMist === opts.expectedFeeMist &&
    treasuryNonSuiCount === 0;

  return {
    outcome,
    effectsStatus,
    chainError,
    deletedIds,
    missingDeletions,
    unexpectedDeletions,
    unexpectedChanges,
    grossGasMist,
    netGasMist,
    storageRebateMist,
    treasuryReceivedMist,
    treasuryVerified,
    senderNetMist,
    netResultMist,
    discrepancies,
  };
}
