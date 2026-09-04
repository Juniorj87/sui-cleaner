import { mistToSui } from "./gasEstimator";
import { SERVICE_FEE_MIST, SERVICE_FEE_SUI_DISPLAY } from "./serviceFeeConfig";

export interface FeeBreakdown {
  /** Network fee shown in the regular fee breakdown — floored at 0 */
  networkFeeSui: string;
  cleanerFeeSui: string;
  totalSui: string;
  /** Always true until the final transaction is simulated post-signing. */
  isEstimate: boolean;
  method: "demo" | "dry-run";
  /** raw MIST values for the transaction builder */
  networkFeeMist: bigint;
  cleanerFeeMist: bigint;
  totalMist: bigint;
  /**
   * RAW net gas from the dry-run (computation + storage − rebate).
   * Can be NEGATIVE when storage rebate exceeds gas costs.
   * Used by the Financial Result section to compute the true net cost.
   */
  rawNetGasMist: bigint;
  /** Storage rebate returned to the gas coin owner (the user), in MIST. */
  storageRebateMist: bigint;
  /**
   * True net cost to the user: rawNetGas + cleanerFeeMist.
   * Can be negative (user profits from the storage rebate exceeding all costs).
   */
  netCostMist: bigint;
  /** human-readable explanation */
  rationale: string;
}

/**
 * Service fee calculation — INDEPENDENT of network gas.
 *
 * RULE: cleaner fee is a flat, configurable amount (SERVICE_FEE_MIST).
 * It does NOT depend on, match, or track the network gas cost.
 * The two fees are completely separate line items:
 *   Total = Network Fee (gas) + SuiCleaner Fee (flat)
 *
 * HONESTY RULE: network fee is only known after execution. Until then
 * the UI must label the network figure "Estimated network fee".
 */
export function calculateFee(
  networkEstimateMist: bigint,
  opts: { demo: boolean; storageRebateMist?: bigint }
): FeeBreakdown {
  // Raw net gas from the dry-run — can be negative (rebate > costs)
  const rawNetGas = networkEstimateMist;

  // Network gas for the fee breakdown — floor at 0
  // (the negative portion is already accounted for in the Financial Result)
  const networkMist = networkEstimateMist > 0n ? networkEstimateMist : 0n;

  // Service fee: always the fixed flat amount
  const cleanerMist = SERVICE_FEE_MIST;

  // Regular total: floored network + service fee (for the fees section)
  const totalMist = networkMist + cleanerMist;

  // True net cost: rawNetGas + cleanerFee (for the Financial Result section)
  // This accounts for the storage rebate reducing the effective gas cost.
  const netCostMist = rawNetGas + cleanerMist;

  // Storage rebate (0 in demo mode)
  const storageRebateMist = opts.storageRebateMist ?? 0n;

  return {
    networkFeeSui: mistToSui(networkMist),
    cleanerFeeSui: mistToSui(cleanerMist),
    totalSui: mistToSui(totalMist),
    isEstimate: true,
    method: opts.demo ? "demo" : "dry-run",
    networkFeeMist: networkMist,
    cleanerFeeMist: cleanerMist,
    totalMist,
    rawNetGasMist: rawNetGas,
    storageRebateMist,
    netCostMist,
    rationale:
      "SuiCleaner fee is a fixed flat amount independent of network gas. " +
      `Service fee: ${SERVICE_FEE_SUI_DISPLAY} SUI. ` +
      "Network fee is estimated via dry-run.",
  };
}

/** Demo estimate used by the demo flow (matches the product spec example). */
export const DEMO_NETWORK_FEE_MIST = 1_420_000n; // 0.00142 SUI

/**
 * Demo fee breakdown — uses the same fixed service fee, just with
 * a demo network estimate.
 */
export function calculateDemoFee(): FeeBreakdown {
  return calculateFee(DEMO_NETWORK_FEE_MIST, { demo: true, storageRebateMist: 0n });
}
