/**
 * SuiCleaner Service Fee — fixed, independent of network gas.
 *
 * RULE: The service fee is a flat, configurable amount that the user pays
 * to the SuiCleaner treasury on every cleanup transaction. It is completely
 * independent of the network gas fee — the two are separate line items.
 *
 * The user sees:
 *   Network fee  (gas, estimated by dry-run)
 *   SuiCleaner fee (this flat amount)
 *   Total = Network fee + SuiCleaner fee
 */

/**
 * Service fee in MIST (1 SUI = 1_000_000_000 MIST).
 * 0.015 SUI = 15_000_000 MIST — current fee per spec.
 *
 * To change the fee, update this single constant.
 * All display formatting is derived from this value.
 */
export const SERVICE_FEE_MIST = 15_000_000n; // 0.015 SUI

/** Human-readable service fee string for display. */
export const SERVICE_FEE_SUI_DISPLAY = "0.015";
