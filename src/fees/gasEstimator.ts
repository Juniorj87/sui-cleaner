import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Transaction } from "@mysten/sui/transactions";

export const SUI_DECIMALS = 9n;
export const MIST_PER_SUI = 10n ** SUI_DECIMALS;

/** Demo estimate used by the demo flow (matches the product spec example). Demo-only. */
export const DEMO_NETWORK_FEE_MIST = 1_420_000n; // 0.00142 SUI = 1_420_000 mist

export interface GasEstimate {
  mist: bigint;
  /** formatted SUI string, e.g. "0.00142" */
  sui: string;
  method: "demo" | "dry-run";
  /** dry-run breakdown (real mode only) */
  breakdown?: {
    computationCost: bigint;
    storageCost: bigint;
    storageRebate: bigint;
  };
  /** built transaction bytes from the dry-run (real mode) — reuse to avoid double-build */
  builtBytes?: Uint8Array;
}

export function mistToSui(mist: bigint): string {
  const whole = mist / MIST_PER_SUI;
  const frac = mist % MIST_PER_SUI;
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

/**
 * Estimate the network cost of the cleanup transaction.
 *
 * REAL MODE (spec §26, §27): Sui gas is dynamic — never hardcoded.
 *   1. build the cleanup PTB (Transaction.build resolves gas via the client)
 *   2. dry-run it (simulation — nothing executes)
 *   3. read effects.gasUsed: net = computationCost + storageCost − storageRebate
 *
 * Demo mode returns the documented demo estimate so the demo flow works
 * fully offline.
 */
export async function estimateGas(
  client: SuiJsonRpcClient | undefined,
  transaction: Transaction | undefined,
  sender: string | undefined,
  opts: { demo: boolean }
): Promise<GasEstimate> {
  if (opts.demo) {
    return { mist: DEMO_NETWORK_FEE_MIST, sui: mistToSui(DEMO_NETWORK_FEE_MIST), method: "demo" };
  }

  if (!client || !transaction || !sender) {
    throw new Error("Real gas estimation requires a client, transaction and sender.");
  }

  // build full transaction data (resolves gas coin + price via the client,
  // which points at the same-origin proxy — no CORS, nothing executes)
  const bytes = await transaction.build({ client });

  // Log the built transaction for debugging
  console.log("[GasEstimator] tx.build() succeeded, bytes length:", bytes.length);
  console.log("[GasEstimator] Serialization (base64):", btoa(String.fromCharCode(...bytes.slice(0, 64))) + "...");

  const dry = await client.dryRunTransactionBlock({ transactionBlock: bytes });

  const gas = dry.effects.gasUsed;
  const computationCost = BigInt(gas.computationCost);
  const storageCost = BigInt(gas.storageCost);
  const storageRebate = BigInt(gas.storageRebate);
  const net = computationCost + storageCost - storageRebate;

  return {
    mist: net,
    sui: mistToSui(net),
    method: "dry-run",
    breakdown: { computationCost, storageCost, storageRebate },
    builtBytes: bytes,
  };
}
