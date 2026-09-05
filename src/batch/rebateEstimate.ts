/**
 * Per-wallet storage-rebate estimates for batch analysis.
 *
 * Source-of-truth ladder (ACTUAL SUI TRANSACTION ECONOMICS):
 *
 *   1. SIMULATION — a read-only dry-run of the REAL cleanup PTB
 *      (buildCleanupPTB + dryRunTransactionBlock, no signing, nothing
 *      executes). effects.gasUsed.storageRebate is the closest figure to
 *      what the wallet would really get — the same builder and the same
 *      dry-run source the single-wallet review uses, so both agree.
 *      Fee transfer is intentionally omitted: it adds storage COST, never
 *      rebate, and omitting it needs no treasury and no funds.
 *   2. OBJECT CALCULATION — only when there is nothing to simulate:
 *      zero cleanable targets means honestly +0.0000.
 *   3. UNAVAILABLE — build/dry-run impossible: show "Estimate unavailable",
 *      never an invented number.
 *
 * Banned: object count × universal constant (e.g. N × 0.0028) as the source.
 * Per-action economics actually executed:
 *   destroy_zero ........... may return rebate (object destroyed)
 *   dust merge ............. may return rebate only for really destroyed
 *                            containers (lone dust is kept → 0)
 *   NFT burn / transfer-0x0  0 (verified mechanics return none)
 *   swap / withdraw ........ 0 rebate contribution from the action itself
 *   unverified / skipped ... 0 (never estimated)
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Transaction } from "@mysten/sui/transactions";
import type { WalletObject } from "../scanner/objectClassifier";
import { buildCleanupPTB, type BuiltCleanup } from "../cleanup/transactionBuilder";
import { estimateGas, type GasEstimate } from "../fees/gasEstimator";

export type EstimateSource = "simulation" | "object" | "unavailable";

export interface MechanismBreakdown {
  /** acted-on zero-balance coins (destroy_zero) */
  destroyZero: number;
  /** acted-on dust (merge path) */
  dustMerge: number;
  /** cleanable targets the simulated PTB did NOT act on */
  unsupported: number;
}

export interface WalletEstimate {
  /** estimated storage rebate, SUI */
  rebateSui: number;
  source: EstimateSource;
  breakdown: MechanismBreakdown;
}

export const ZERO_BREAKDOWN: MechanismBreakdown = { destroyZero: 0, dustMerge: 0, unsupported: 0 };

/** split cleanable targets by rebate mechanism (pure, tested) */
export function classifyTargets(objects: WalletObject[]): {
  destroyZero: WalletObject[];
  dustMerge: WalletObject[];
  other: WalletObject[];
} {
  const destroyZero: WalletObject[] = [];
  const dustMerge: WalletObject[] = [];
  const other: WalletObject[] = [];
  for (const o of objects) {
    if (o.category === "coin" && o.coinBalance === "0") destroyZero.push(o);
    else if (o.dust) dustMerge.push(o);
    else other.push(o);
  }
  return { destroyZero, dustMerge, other };
}

/**
 * Executed-truth breakdown: which targets the simulated PTB really acted on.
 * Lone dust, unverified and skipped objects land in `unsupported`.
 */
export function summarizeBreakdown(targets: WalletObject[], actedOnIds: string[]): MechanismBreakdown {
  const acted = new Set(actedOnIds.map((id) => id.toLowerCase()));
  let destroyZero = 0;
  let dustMerge = 0;
  let unsupported = 0;
  for (const o of targets) {
    if (!acted.has(o.objectId.toLowerCase())) {
      unsupported += 1;
      continue;
    }
    if (o.category === "coin" && o.coinBalance === "0") destroyZero += 1;
    else if (o.dust) dustMerge += 1;
    // acted-on burns/transfers return no rebate — executed, but no mechanism line
  }
  return { destroyZero, dustMerge, unsupported };
}

export interface EstimateDeps {
  build?: (
    targets: WalletObject[],
    opts: { demo: false; sender: string }
  ) => Promise<BuiltCleanup>;
  dryRun?: (
    client: SuiJsonRpcClient,
    tx: Transaction,
    sender: string,
    opts: { demo: boolean }
  ) => Promise<GasEstimate>;
}

/**
 * Dry-run estimate for one wallet. Read-only: builds the real cleanup PTB
 * for `targets`, simulates it, reads effects.gasUsed.storageRebate.
 * Never signs, never executes, never needs the wallet connected.
 *
 * This is the SAME two calls single-wallet review makes (buildCleanupPTB →
 * dry-run → gas.breakdown.storageRebate); the review additionally wraps
 * them with validation/treasury/fee, none of which change the rebate
 * figure. `deps` exists so tests can prove that shared model (§13).
 */
export async function estimateWalletRebate(
  client: SuiJsonRpcClient,
  sender: string,
  targets: WalletObject[],
  deps: EstimateDeps = {}
): Promise<WalletEstimate> {
  if (targets.length === 0) {
    // Nothing to delete → honestly zero, computed from the object set.
    return { rebateSui: 0, source: "object", breakdown: { ...ZERO_BREAKDOWN } };
  }
  const build = deps.build ?? ((t, o) => buildCleanupPTB(t, o));
  const dryRun = deps.dryRun ?? ((c, t, s, o) => estimateGas(c, t, s, o));
  try {
    const built = await build(targets, { demo: false, sender });
    const tx = built.transaction;
    if (!tx) throw new Error("build produced no transaction");
    tx.setSenderIfNotSet(sender);
    const gas = await dryRun(client, tx, sender, { demo: false });
    const rebateMist = gas.breakdown?.storageRebate ?? 0n;
    const rebateSui = Math.round(Number(rebateMist) / 1e5) / 1e4;
    return {
      rebateSui,
      source: "simulation",
      breakdown: summarizeBreakdown(targets, built.actedOnIds),
    };
  } catch {
    return {
      rebateSui: 0,
      source: "unavailable",
      breakdown: { ...ZERO_BREAKDOWN, unsupported: targets.length },
    };
  }
}
