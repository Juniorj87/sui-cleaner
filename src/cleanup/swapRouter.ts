/**
 * Swap router — the swap step of the convert-to-SUI pipeline.
 *
 * Goal (DeFi TZ §2.2): after DeFi positions are withdrawn and dust coins are
 * merged, every non-SUI token balance is converted to SUI inside the same PTB
 * so the user ends up with one clean asset and pays a single service fee.
 *
 * VERIFIED MECHANISM (checked on-chain 2026-08-17, mainnet):
 *   - Quote:      Cetus aggregator `find_routes` (relayed via /api/quote).
 *   - Execution:  Cetus CLMM `pool_script_v2::swap_a2b / swap_b2a`
 *                 (package 0x2d8c2e0f…, entry, GlobalConfig 0x0408fa4e…,
 *                 Clock 0x6). Only pools whose `published_at` resolves to the
 *                 verified integrate package are used.
 *
 * FAIL-SAFE: if no verified quote can be produced (no route, non-Cetus pool,
 * malformed response), NO swap commands are generated — the token balance
 * simply stays in the wallet. Value is never destroyed, never guessed.
 * A wrong swap would fail the dry-run gate before signing, so this module
 * prefers to skip honestly rather than emit a possibly-broken command.
 *
 * Other protocols (Scallop/Navi/Suilend/LSTs) are NOT wired into the swap
 * step — their withdraw entry points are not yet verified (see actions.ts),
 * so their positions stay REVIEW and never reach this module.
 */

import type { Transaction, TransactionObjectArgument, TransactionResult } from "@mysten/sui/transactions";

import { resolveCetusSwapPackages } from "../capabilities/networkResolver";

export const SUI_COIN_TYPE = "0x2::sui::SUI";

/**
 * Resolve Cetus swap packages for the current network.
 * These come from the capability registry — not hardcoded.
 */
function getCetusSwapPackages() {
  return resolveCetusSwapPackages();
}

/** one hop from the aggregator route (Cetus pools only, verified package) */
export interface SwapHop {
  poolId: string;
  /** a2b = sell coin A for coin B; b2a = the reverse */
  a2b: boolean;
  coinA: string;
  coinB: string;
  /** pool object package (published_at from the quote) — must match the verified integrate package */
  publishedAt: string;
  /** expected output in base units (u64 scale, aggregator) */
  amountOut: string;
}

export interface SwapQuote {
  /** canonical coin type being sold (the token we convert to SUI) */
  from: string;
  /** canonical coin type being bought (SUI) */
  target: string;
  /** input amount in base units of `from` */
  amountIn: string;
  hops: SwapHop[];
}

/**
 * Ask the same-origin proxy for a Cetus aggregator quote (from → SUI).
 * Returns null when no verified single-protocol Cetus route exists — the
 * caller must then skip the swap step (fail-safe).
 */
export async function fetchSwapQuote(from: string, target: string, amountIn: bigint): Promise<SwapQuote | null> {
  if (amountIn <= 0n) return null;
  let res: Response;
  try {
    res = await fetch("/api/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, target, amountIn: amountIn.toString() }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  let json: { code?: number; data?: { paths?: unknown[] } } | null = null;
  try {
    json = (await res.json()) as { code?: number; data?: { paths?: unknown[] } } | null;
  } catch {
    return null;
  }
  const paths = Array.isArray(json?.data?.paths) ? json.data.paths : [];
  const hops: SwapHop[] = [];
  for (const p of paths) {
    if (!p || typeof p !== "object") continue;
    const hop = p as Record<string, unknown>;
    // only CETUS pools are wired — other providers (Aftermath, Bluefin, …)
    // have unverified PTB builders and are skipped (fail-safe).
    if (hop.provider !== "CETUS") continue;
    if (typeof hop.id !== "string" || typeof hop.published_at !== "string") continue;
    const { integratePackage: verifiedPkg } = getCetusSwapPackages();
    if (hop.published_at !== verifiedPkg) continue;
    const a2b = hop.direction === true || hop.direction === "true";
    const coinA = typeof hop.from === "string" ? hop.from : "";
    const coinB = typeof hop.target === "string" ? hop.target : "";
    if (!coinA || !coinB) continue;
    hops.push({
      poolId: hop.id,
      a2b,
      coinA,
      coinB,
      publishedAt: hop.published_at,
      amountOut: hop.amount_out != null ? String(hop.amount_out) : "0",
    });
  }
  if (hops.length === 0) return null;
  return { from, target, amountIn: amountIn.toString(), hops };
}

/**
 * The default sqrt-price limit used by the Cetus SDK (no price guard):
 * 0 for a2b (sell the input), u128::MAX for b2a.
 */
function defaultSqrtPriceLimit(a2b: boolean): bigint {
  return a2b ? 0n : (1n << 128n) - 1n;
}

/**
 * Append Cetus swap commands for one hop to the PTB.
 *
 * The swap functions are ENTRY functions: the output coin is automatically
 * transferred to the transaction sender (Sui entry-function semantics), so
 * no explicit transfer is needed. The input coin is consumed.
 *
 * @returns a human-readable command label, or null when the hop is not
 *          supported (caller should skip — fail-safe).
 */
export function appendCetusSwap(
  tx: Transaction,
  hop: SwapHop,
  inputCoin: TransactionObjectArgument,
  opts: { amountIn: bigint | TransactionResult; minAmountOut: bigint }
): string | null {
  const { integratePackage } = getCetusSwapPackages();
  if (!integratePackage) return null; // package not available on this network
  if (hop.publishedAt !== integratePackage) return null;
  // The input coin must be the hop's "from" side. pool_script_v2::swap_a2b
  // sells Coin<A> (typeParams [A, B]); swap_b2a sells Coin<B>.
  const sellA = hop.a2b;
  const sellType = sellA ? hop.coinA : hop.coinB;
  const buyType = sellA ? hop.coinB : hop.coinA;

  const functionName = sellA ? "swap_a2b" : "swap_b2a";
  // u64-scale amount (aggregator quotes are u64; dust balances fit).
  // A dynamic amount (PTB result) is passed through as-is — the function
  // accepts a u64 argument, and coin::balance returns exactly that.
  const amount =
    typeof opts.amountIn === "bigint"
      ? opts.amountIn > (1n << 64n) - 1n
        ? (1n << 64n) - 1n
        : opts.amountIn
      : opts.amountIn;
  const amountLimit = opts.minAmountOut > (1n << 64n) - 1n ? (1n << 64n) - 1n : opts.minAmountOut;

  tx.moveCall({
    target: `${integratePackage}::pool_script_v2::${functionName}`,
    typeArguments: [hop.coinA, hop.coinB],
    arguments: [
      tx.object(getCetusSwapPackages().globalConfig),
      tx.object(hop.poolId),
      // input coin (the merged dust / withdrawn token coin)
      inputCoin,
      // empty Coin<B> placeholder — the entry function wraps the output;
      // the SDK passes a zero coin here.
      tx.moveCall({
        target: "0x2::coin::zero",
        typeArguments: [buyType],
        arguments: [],
      }),
      tx.pure.bool(true), // by_amount_in
      typeof amount === "bigint" ? tx.pure.u64(amount) : amount,
      tx.pure.u64(amountLimit), // min output (slippage guard)
      tx.pure.u128(defaultSqrtPriceLimit(sellA)),
      tx.object("0x6"), // Clock
    ],
  });
  return `swap ${shortType(sellType)} → SUI (Cetus)`;
}

function shortType(type: string): string {
  const parts = type.split("::");
  return parts.length >= 3 ? parts[parts.length - 1] : type;
}
