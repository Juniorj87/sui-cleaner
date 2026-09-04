/**
 * Gas Coin Selector
 *
 * Selects a dedicated gas coin for the cleanup transaction that is:
 *   1. NOT one of the cleanup target objects (prevents InsufficientCoinBalance)
 *   2. Has sufficient balance for: service fee + estimated network gas
 *   3. Preferably the smallest sufficient coin (preserves larger coins for user)
 *
 * ROOT CAUSE of InsufficientCoinBalance:
 *   When the SDK auto-selects a gas coin that is ALSO a cleanup target,
 *   the PTB tries to use the same coin object for two different purposes
 *   (gas payment + cleanup operation), causing the VM to fail with
 *   InsufficientCoinBalance in the second command.
 *
 * SOLUTION: Explicitly select and set the gas coin via setGasPayment()
 * before any cleanup commands are added to the transaction.
 */
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { SERVICE_FEE_MIST, SERVICE_FEE_SUI_DISPLAY } from "../fees/serviceFeeConfig";

/** Selected gas coin information for explicit gas payment */
export interface GasCoinInfo {
  objectId: string;
  version: string | number;
  digest: string;
  balance: bigint;
}

/** Result of gas coin selection */
export interface GasSelectionResult {
  /** The selected gas coin, or undefined if SDK auto-select should be used */
  gasCoin?: GasCoinInfo;
  /** Additional coins to merge into gasCoin before splitting (empty if not needed) */
  mergeCoins?: GasCoinInfo[];
  /** All SUI coins the user owns (for diagnostics) */
  allCoins: { objectId: string; balance: bigint }[];
  /** Object IDs that are cleanup targets (excluded from gas selection) */
  cleanupObjectIds: string[];
  /** Why this coin was selected (for diagnostics) */
  reason: string;
}

/**
 * Minimum reserve for network gas beyond the service fee.
 * This is a safety buffer — the actual gas cost comes from dry-run.
 * If the gas coin has exactly serviceFee + MIN_GAS_RESERVE, and the
 * network gas exceeds the reserve, the dry-run will fail with a clear error.
 */
const MIN_GAS_RESERVE = 10_000_000n; // ~0.01 SUI

/**
 * Select a gas coin for the cleanup transaction.
 *
 * @param client - RPC client for fetching coins
 * @param sender - User's wallet address
 * @param cleanupObjectIds - Set of object IDs that will be used in cleanup
 * @returns GasSelectionResult with the selected gas coin or undefined
 */
export async function selectGasCoin(
  client: SuiJsonRpcClient,
  sender: string,
  cleanupObjectIds: Set<string>
): Promise<GasSelectionResult> {
  const requiredBalance = SERVICE_FEE_MIST + MIN_GAS_RESERVE;

  // Fetch all SUI coins owned by the user
  let allCoinsData;
  try {
    allCoinsData = await client.getCoins({
      owner: sender,
      coinType: "0x2::sui::SUI",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      allCoins: [],
      cleanupObjectIds: [...cleanupObjectIds],
      reason: `Failed to fetch SUI coins: ${msg}`,
    };
  }

  const allCoins = allCoinsData.data.map((c) => ({
    objectId: c.coinObjectId,
    balance: BigInt(c.balance),
  }));

  // Filter: exclude cleanup targets AND coins with insufficient balance
  const candidates = allCoinsData.data
    .filter((c) => !cleanupObjectIds.has(c.coinObjectId))
    .filter((c) => BigInt(c.balance) >= requiredBalance)
    .sort((a, b) => Number(BigInt(a.balance) - BigInt(b.balance)));

  if (candidates.length === 0) {
    // No single coin is large enough — try to MERGE multiple small coins
    const anyNonCleanup = allCoinsData.data
      .filter((c) => !cleanupObjectIds.has(c.coinObjectId))
      .sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance))); // largest first for merge

    if (anyNonCleanup.length === 0) {
      return {
        allCoins,
        cleanupObjectIds: [...cleanupObjectIds],
        reason:
          "All SUI coins are cleanup targets — no separate gas coin available. " +
          "The user needs at least one SUI coin that is NOT being cleaned up.",
      };
    }

    // Try combining multiple coins (merge into the largest one)
    let combinedBalance = 0n;
    const mergeCandidates: typeof anyNonCleanup = [];
    for (const c of anyNonCleanup) {
      combinedBalance += BigInt(c.balance);
      mergeCandidates.push(c);
      if (combinedBalance >= requiredBalance) break;
    }

    if (combinedBalance >= requiredBalance && mergeCandidates.length >= 2) {
      // Use the largest coin as gas, merge the rest into it
      const primary = mergeCandidates[0];
      const toMerge = mergeCandidates.slice(1);
      return {
        gasCoin: {
          objectId: primary.coinObjectId,
          version: primary.version,
          digest: primary.digest,
          balance: BigInt(primary.balance),
        },
        mergeCoins: toMerge.map((c) => ({
          objectId: c.coinObjectId,
          version: c.version,
          digest: c.digest,
          balance: BigInt(c.balance),
        })),
        allCoins,
        cleanupObjectIds: [...cleanupObjectIds],
        reason:
          `No single coin sufficient — merging ${mergeCandidates.length} coins ` +
          `(${(combinedBalance / 1000000000n).toString()} SUI total) for gas.`,
      };
    }

    // Even combining doesn't work
    const maxBalance = anyNonCleanup.length > 0 ? BigInt(anyNonCleanup[0].balance) : 0n;
    return {
      allCoins,
      cleanupObjectIds: [...cleanupObjectIds],
      reason:
        `No SUI coin(s) have enough balance for service fee (${SERVICE_FEE_SUI_DISPLAY} SUI) + gas. ` +
        `Combined: ${(combinedBalance / 1000000000n).toString()} SUI. ` +
        `Largest single: ${(maxBalance / 1000000000n).toString()} SUI. ` +
        `Required: ${(requiredBalance / 1000000000n).toString()} SUI.`,
    };
  }

  // Select the smallest sufficient coin (preserves larger coins for the user)
  const pick = candidates[0];
  const gasCoin: GasCoinInfo = {
    objectId: pick.coinObjectId,
    version: pick.version,
    digest: pick.digest,
    balance: BigInt(pick.balance),
  };

  return {
    gasCoin,
    allCoins,
    cleanupObjectIds: [...cleanupObjectIds],
    reason:
      `Selected gas coin ${pick.coinObjectId.slice(0, 12)}… ` +
      `(${(gasCoin.balance / 1000000000n).toString()} SUI) — ` +
      `not a cleanup target, sufficient balance for fee + gas.`,
  };
}

/**
 * Log gas selection diagnostics. Called from cleanupEngine for debugging.
 */
export function logGasSelection(result: GasSelectionResult): void {
  console.log("[GasSelector] Selection result:");
  console.log("  Cleanup targets:", result.cleanupObjectIds.length, "objects");
  console.log("  Available SUI coins:", result.allCoins.length);
  if (result.gasCoin) {
    console.log("  Selected gas coin:", result.gasCoin.objectId.slice(0, 16) + "...",
      "(" + (result.gasCoin.balance / 1000000000n).toString() + " SUI)");
  } else {
    console.log("  No gas coin selected — SDK will auto-select");
  }
  if (result.mergeCoins && result.mergeCoins.length > 0) {
    console.log("  Merge coins:", result.mergeCoins.length, "additional coins to merge");
  }
  console.log("  Reason:", result.reason);
}
