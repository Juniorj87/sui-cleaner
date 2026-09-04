/**
 * POST-TRANSACTION VERIFICATION
 *
 * After every real (non-demo) cleanup transaction the Cleaner verifies the
 * result against the ON-CHAIN RECORD before claiming success.
 *
 * SOURCE OF TRUTH — Sui RPC transaction effects, never the wallet popup text
 * and never local selection state:
 *
 *   1. fetch the executed block (effects + objectChanges + balanceChanges)
 *   2. read effects.status.status:
 *        "success" → the transaction EXECUTED on-chain → SUCCESS presentation
 *        "failure" → the chain rejected it             → FAILED presentation
 *        anything else / fetch error → UNKNOWN          → cannot be verified
 *   3. count deleted objects from MULTIPLE sources (effects.deleted +
 *      objectChanges[type=deleted]) comparing object IDs, not counts
 *   4. extract ACTUAL financials from effects.gasUsed + balanceChanges
 *   5. re-scan the wallet (informational only)
 *
 * A successful on-chain transaction is NEVER reported as failed just because
 * one RPC field omitted an expected object or the executed object count
 * differs from the initial selection — those become notes on the success
 * screen, never a FAILED verdict.
 */

import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { WalletObject } from "../scanner/objectClassifier";
import { scanWallet } from "../scanner/walletScanner";
import { SERVICE_FEE_MIST } from "../fees/serviceFeeConfig";
import { getServiceFeeAddress } from "../fees/treasury";
import { analyzeTxEffects, type TxBlockLike } from "./txEffectAnalyzer";

/** Result of the full post-transaction verification */
export interface VerificationResult {
  /**
   * overall status — decided by effects.status.status ONLY:
   *   "success"            → chain success (notes may exist, never "failed")
   *   "state-differs"      → chain success + notable notes (still executed)
   *   "failure"            → effects.status.status === "failure"
   *   "verification-failed" → could NOT be verified (RPC/network/unknown)
   */
  status: "success" | "state-differs" | "failure" | "verification-failed";
  /** the transaction digest (confirmed on-chain when status is success/state-differs/failure) */
  digest: string;
  /** object IDs that the transaction actually deleted on-chain */
  deletedIds: string[];
  /** object IDs that were acted-on but NOT found deleted in any on-chain source */
  missingDeletions: string[];
  /** object IDs deleted by the transaction that were NOT in the acted-on set */
  unexpectedDeletions: string[];
  /** objects that changed (transferred/wrapped/mutated) but were not in the acted-on set */
  unexpectedChanges: string[];
  /** object count before the transaction (from the scan) */
  beforeCount: number;
  /** object count after rescan (informational; rescan failure is never a failure verdict) */
  afterCount: number;
  /** expected removal count (acted-on objects) */
  expectedRemovals: number;
  /** actual removal count (deleted ids ∩ acted-on ids) */
  actualRemovals: number;
  /** balance before (in MIST, if available) */
  balanceBefore?: bigint;
  /** balance after (in MIST, if available) */
  balanceAfter?: bigint;
  /** net gas effect (computation + storage − rebate, MIST) from effects */
  gasUsedMist?: bigint;
  /** ACTUAL gross network gas (computation + storage, MIST) from effects */
  grossGasMist?: bigint;
  /** ACTUAL storage rebate returned to the sender (MIST) from effects */
  storageRebateMist?: bigint;
  /** ACTUAL net result = sender balance change on-chain (MIST) */
  netResultMist?: bigint;
  /** treasury received exactly the service fee and nothing else */
  treasuryVerified: boolean;
  /** actual amount received by treasury (in MIST) from balance changes */
  treasuryReceivedMist?: bigint;
  /** human-readable notes (only shown on success; never flip to failure) */
  discrepancies: string[];
  /** the re-scanned wallet objects (or empty if rescan failed) */
  afterObjects: WalletObject[];
  /** the effects status string from the chain ("success"|"failure"|"unknown"|"fetch-failed") */
  effectsStatus: string;
  /** chain error text when the transaction failed */
  chainError?: string;
}

/**
 * Options for post-transaction verification.
 */
export interface VerificationOptions {
  /** the RPC client for fetching effects and re-scanning */
  client: SuiJsonRpcClient;
  /** the wallet address that was cleaned */
  walletAddress: string;
  /** the transaction digest to verify */
  digest: string;
  /** object IDs that the transaction was supposed to act on */
  actedOnIds: string[];
  /** object count before the transaction */
  beforeCount: number;
  /** balance before the transaction (in MIST), if known */
  balanceBefore?: bigint;
}

/**
 * Run the full post-transaction verification pipeline.
 *
 * Returns a VerificationResult that the UI uses to decide whether to
 * show SUCCESS, FAILED or "could not verify".
 */
export async function verifyPostTransaction(
  opts: VerificationOptions
): Promise<VerificationResult> {
  const {
    client,
    walletAddress,
    digest,
    actedOnIds,
    beforeCount,
    balanceBefore,
  } = opts;

  const treasuryAddress = getServiceFeeAddress();

  // ── Step 1: fetch effects + objectChanges + balanceChanges ───────────
  let block: TxBlockLike | null = null;
  try {
    block = (await client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showBalanceChanges: true,
      },
    })) as unknown as TxBlockLike;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // RPC/network error → the result is UNKNOWN, never "failed".
    return {
      status: "verification-failed",
      digest,
      deletedIds: [],
      missingDeletions: actedOnIds,
      unexpectedDeletions: [],
      unexpectedChanges: [],
      beforeCount,
      afterCount: beforeCount,
      expectedRemovals: actedOnIds.length,
      actualRemovals: 0,
      treasuryVerified: false,
      discrepancies: [`Could not fetch the transaction block: ${msg}`],
      afterObjects: [],
      effectsStatus: "fetch-failed",
    };
  }

  // ── Step 2: analyze the on-chain record (pure) ───────────────────────
  const analysis = analyzeTxEffects(block, {
    actedOnIds,
    walletAddress,
    treasuryAddress,
    expectedFeeMist: SERVICE_FEE_MIST,
  });

  // digest sanity — informational, never fatal
  const discrepancies = [...analysis.discrepancies];
  const blockDigest = block?.digest;
  if (blockDigest && blockDigest !== digest) {
    discrepancies.push(`Digest mismatch: expected ${digest}, got ${blockDigest}`);
  }

  if (analysis.outcome === "unknown") {
    return {
      status: "verification-failed",
      digest: blockDigest ?? digest,
      deletedIds: analysis.deletedIds,
      missingDeletions: analysis.missingDeletions,
      unexpectedDeletions: analysis.unexpectedDeletions,
      unexpectedChanges: analysis.unexpectedChanges,
      beforeCount,
      afterCount: beforeCount,
      expectedRemovals: actedOnIds.length,
      actualRemovals: analysis.deletedIds.filter((id) =>
        actedOnIds.map((a) => a.toLowerCase()).includes(id)
      ).length,
      treasuryVerified: false,
      discrepancies: ["Transaction effects could not be read (no status in the on-chain record)."],
      afterObjects: [],
      effectsStatus: analysis.effectsStatus,
      chainError: analysis.chainError,
    };
  }

  if (analysis.outcome === "failure") {
    // The CHAIN rejected the transaction → nothing was cleaned.
    return {
      status: "failure",
      digest: blockDigest ?? digest,
      deletedIds: analysis.deletedIds,
      missingDeletions: analysis.missingDeletions,
      unexpectedDeletions: analysis.unexpectedDeletions,
      unexpectedChanges: analysis.unexpectedChanges,
      beforeCount,
      afterCount: beforeCount,
      expectedRemovals: actedOnIds.length,
      actualRemovals: 0,
      treasuryVerified: false,
      discrepancies: [
        `Transaction failed on-chain: ${analysis.chainError ?? "unknown error"}`,
      ],
      afterObjects: [],
      effectsStatus: "failure",
      chainError: analysis.chainError,
    };
  }

  // ── Step 3 (chain success): re-scan wallet — informational only ──────
  let afterObjects: WalletObject[] = [];
  let afterCount = beforeCount;
  try {
    const rescan = await scanWallet(client, walletAddress);
    afterObjects = rescan.objects;
    afterCount = afterObjects.length;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    discrepancies.push(`Wallet re-scan failed: ${msg} (not counted as a failure — see the transaction on-chain).`);
  }

  // Count check uses ON-CHAIN deletions (actualRemovals) as the baseline.
  // The pre/post object diff is noisy (gas coins merge etc.) — informative only.
  const expectedRemovals = actedOnIds.length;
  const actualRemovals = analysis.deletedIds.filter((id) =>
    actedOnIds.map((a) => a.toLowerCase()).includes(id)
  ).length;
  const countDiff = Math.abs(afterCount - (beforeCount - actualRemovals));
  if (countDiff > 1) {
    discrepancies.push(
      `Object count after the transaction (${afterCount}) differs from the expected count ` +
        `(${beforeCount - actualRemovals}). The transaction executed on-chain — re-scan your wallet to confirm the final state.`
    );
  }

  // balance re-check — non-fatal
  let balanceAfter: bigint | undefined;
  if (balanceBefore !== undefined) {
    try {
      const bal = await client.getBalance({ owner: walletAddress });
      balanceAfter = BigInt(bal.totalBalance);
    } catch {
      // balance check is non-fatal
    }
  }

  const status: VerificationResult["status"] =
    discrepancies.length === 0 ? "success" : "state-differs";

  return {
    status,
    digest: blockDigest ?? digest,
    deletedIds: analysis.deletedIds,
    missingDeletions: analysis.missingDeletions,
    unexpectedDeletions: analysis.unexpectedDeletions,
    unexpectedChanges: analysis.unexpectedChanges,
    beforeCount,
    afterCount,
    expectedRemovals,
    actualRemovals,
    balanceBefore,
    balanceAfter,
    gasUsedMist: analysis.netGasMist,
    grossGasMist: analysis.grossGasMist,
    storageRebateMist: analysis.storageRebateMist,
    netResultMist: analysis.netResultMist,
    treasuryVerified: analysis.treasuryVerified,
    treasuryReceivedMist: analysis.treasuryReceivedMist,
    discrepancies,
    afterObjects,
    effectsStatus: analysis.effectsStatus,
  };
}
