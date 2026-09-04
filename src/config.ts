/**
 * Typed configuration layer.
 *
 * All environment-driven settings live here and come from the server
 * (/api/config → server env), never hardcoded in the client:
 *   NETWORK              — sui-mainnet / sui-testnet
 *   SUI_RPC_URL          — upstream RPC (server-side only, never exposed as a secret)
 *   SERVICE_FEE_ADDRESS  — public treasury recipient (shown before signing)
 *
 * The treasury is validated and the app FAILS SAFE: real cleanup is blocked
 * until a valid, non-placeholder treasury address is configured.
 */

import { fetchServerConfig } from "./lib/proxyRpc";
import { isSuiAddress } from "./lib/suiAddress";

export interface AppConfig {
  network: string;
  rpcProvider: string;
  /** validated treasury address, or null when not configured / invalid */
  serviceFeeAddress: string | null;
  /** package ids flagged by the server-loaded spam registry (may be empty) */
  spamPackages: string[];
}

let appConfig: AppConfig | null = null;

/** Load server config once. Safe to call repeatedly. */
export async function loadAppConfig(force = false): Promise<AppConfig> {
  if (appConfig && !force) return appConfig;
  const server = await fetchServerConfig(force);
  const addr = server.serviceFeeConfigured ? server.serviceFeeAddress.trim().toLowerCase() : "";
  appConfig = {
    network: server.network,
    rpcProvider: server.rpcProvider,
    serviceFeeAddress: addr && isSuiAddress(addr) ? addr : null,
    spamPackages: Array.isArray(server.spamList)
      ? server.spamList.map((p) => p.trim().toLowerCase()).filter(Boolean)
      : [],
  };
  return appConfig;
}

export function getAppConfig(): AppConfig | null {
  return appConfig;
}

export function getNetwork(): string {
  return appConfig?.network ?? "mainnet";
}
