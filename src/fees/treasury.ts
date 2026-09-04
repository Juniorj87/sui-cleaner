// Treasury configuration.
//
// The service fee is sent to this address as part of the cleanup transaction.
// The address comes from the SERVER environment (SERVICE_FEE_ADDRESS via
// /api/config) and is PUBLIC — shown in the UI before signing. The client
// never hardcodes a treasury address.
//
// FAIL-SAFE: real cleanup is blocked until a valid, non-placeholder treasury
// is configured. The placeholder below is only a sentinel for detecting an
// unset address — it is never used as a send recipient.

import { getAppConfig } from "../config";

/** Sentinel for "not configured" — never a real recipient. */
export const TREASURY_PLACEHOLDER = "0x000000000000000000000000000000000000000000000000000000000000dead";

/** Validated treasury address, or null when missing/invalid (fail-safe). */
export function getServiceFeeAddress(): string | null {
  const cfg = getAppConfig();
  if (!cfg) return null;
  const addr = cfg.serviceFeeAddress;
  if (!addr || addr === TREASURY_PLACEHOLDER) return null;
  return addr;
}

/** True only when a real, validated treasury is configured. */
export function isTreasuryConfigured(): boolean {
  return getServiceFeeAddress() !== null;
}

/**
 * The treasury shown in the UI. When unconfigured the UI must clearly say so
 * (never pretend the placeholder is the real recipient).
 */
export function treasuryDisplay(): { address: string | null; configured: boolean } {
  const addr = getServiceFeeAddress();
  return { address: addr, configured: addr !== null };
}
