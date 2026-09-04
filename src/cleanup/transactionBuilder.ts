import type { WalletObject } from "../scanner/objectClassifier";
import { burnCommand } from "./burnHandler";
import { deleteCommand } from "./deleteHandler";
import { coinInnerType } from "../lib/walletGroups";
import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import { destroyZeroCoin, burnNFT, withdrawCetusLiquidity, withdrawScallop, unstakeSpringSui } from "./actions";
import { resolveSpringSuiPackages } from "../capabilities/networkResolver";
import { appendCetusSwap, fetchSwapQuote, SUI_COIN_TYPE, type SwapQuote } from "./swapRouter";
import type { GasCoinInfo } from "./gasSelector";
import { SERVICE_FEE_MIST } from "../fees/serviceFeeConfig";

export interface CleanupPreview {
  commands: string[];
  /** One coherent transaction flow: cleanup actions + service fee transfer. */
  note: string;
}

export interface BuiltCleanup {
  demo: boolean;
  preview: CleanupPreview;
  /** Real ProgrammableTransaction. undefined in demo mode. */
  transaction?: Transaction;
  /**
   * Object ids that received a REAL command in the transaction. Used after
   * signing to verify removals — objects that were selected but could not be
   * acted on (e.g. a lone dust coin with no merge partner) are NOT listed.
   */
  actedOnIds: string[];
}

function isZeroCoin(o: WalletObject): boolean {
  return o.category === "coin" && (o.coinBalance === "0" || BigInt(o.coinBalance ?? "0") === 0n);
}

function isDustCoin(o: WalletObject): boolean {
  return o.category === "coin" && !!o.dust && !isZeroCoin(o);
}

/**
 * Build the cleanup transaction.
 *
 * Design rule: ONE coherent transaction flow — cleanup actions + service fee
 * transfer in the same PTB, so the user sees and signs the complete
 * transaction once. No "send fee first" step.
 *
 * REAL MODE (verified actions only — see CLEANUP_CAPABILITIES.md):
 *   - zero-balance coin  -> 0x2::coin::destroy_zero   (VERIFIED)
 *   - dust coins         -> merge per type: balances are combined into one
 *                           receiver coin (the value stays in the wallet) and
 *                           the emptied containers are consumed by the merge
 *                           (storage rebate returns). A lone dust coin with no
 *                           merge partner is KEPT — it is never burned.
 *   - DeFi position      -> withdraw (Cetus remove_liquidity is VERIFIED;
 *                           everything else stays REVIEW and never reaches
 *                           the builder — see actions.ts fail-safe throws)
 *   - swap to SUI        -> non-SUI token balances (merged dust or withdrawn
 *                           tokens) are converted to SUI via the verified
 *                           Cetus pool_script_v2 swap, gated on a real quote
 *                           (fetchSwapQuote). No quote -> the token stays in
 *                           the wallet, honestly skipped.
 *   - store-able NFT     -> transfer to 0x0           (VERIFIED, rebate not returned)
 *   - fee transfer       -> split gas coin, transfer to treasury
 * Anything without a verified capability must have been filtered out by the
 * validator before this is called; the builder re-checks and skips unverified
 * actions rather than inventing commands.
 */
export async function buildCleanupPTB(
  objects: WalletObject[],
  opts: {
    demo: boolean;
    serviceFeeRecipient?: string;
    /** cleaner fee in MIST — real mode only */
    serviceFeeMist?: bigint;
    /** sender address — real mode only (withdraw/swap recipients) */
    sender?: string;
    /**
     * Explicit gas coin to use for network fees + service fee split.
     * MUST have balance >= serviceFeeMist + estimated_network_gas.
     * MUST NOT be any of the cleanup target object IDs.
     * When provided, set via setGasPayment() to prevent the SDK from
     * auto-selecting a coin that conflicts with cleanup operations.
     */
    gasCoin?: GasCoinInfo;
    /** Additional coins to merge into gasCoin before splitting the fee */
    mergeCoins?: GasCoinInfo[];
    /** Explicit user consent for DeFi withdraw (Scallop/SpringSui/Cetus). If false, DeFi objects are skipped to avoid "Blocked object" */
    allowDeFi?: boolean;
  }
): Promise<BuiltCleanup> {
  if (opts.demo) {
    const commands: string[] = [];
    const actedOnIds: string[] = [];
    for (const o of objects) {
      if (o.cleanupAction === "burn") {
        const cmd = burnCommand(o);
        if (cmd) {
          commands.push(`Remove ${o.name} from wallet`);
          actedOnIds.push(o.objectId);
        }
      } else if (o.cleanupAction === "delete") {
        const cmd = deleteCommand(o, true);
        if (cmd) {
          commands.push(`Destroy empty coin ${o.name}`);
          actedOnIds.push(o.objectId);
        }
      } else      if (o.cleanupAction === "withdraw") {
        commands.push(`Recover DeFi position → ${o.name}`);
        actedOnIds.push(o.objectId);
      }
    }
    if (opts.serviceFeeRecipient) {
      commands.push(`Service fee: see below`);
    }
    return {
      demo: true,
      preview: {
        commands,
        note: "One transaction: cleanup actions + service fee transfer.",
      },
      actedOnIds,
    };
  }

  // ---- REAL MODE -----------------------------------------------------------
  if (!opts.sender) throw new Error("Real cleanup requires a sender address.");

  const tx = new Transaction();

  // CRITICAL: Set explicit gas payment + budget BEFORE adding any commands.
  // This prevents the SDK from auto-selecting a coin that might also be
  // a cleanup target, which would cause InsufficientCoinBalance errors.
  // The gas coin must have enough balance for: serviceFee + networkGas.
  if (opts.gasCoin) {
    tx.setGasPayment([{
      objectId: opts.gasCoin.objectId,
      version: String(opts.gasCoin.version),
      digest: opts.gasCoin.digest,
    }]);
    // Explicit gas budget: service fee + estimated network gas.
    // The SDK will use this as the maximum gas the transaction can spend.
    // Must be set BEFORE build() so the VM knows the budget upfront.
    const GAS_BUDGET = Number(opts.serviceFeeMist ?? SERVICE_FEE_MIST) + 50_000_000; // fee + ~0.05 SUI gas
    tx.setGasBudget(GAS_BUDGET);

    // If additional coins need to be merged into the gas coin (for users
    // whose single largest coin is too small to cover fee + gas), merge
    // them into tx.gas BEFORE splitting the service fee.
    if (opts.mergeCoins && opts.mergeCoins.length > 0) {
      for (const mc of opts.mergeCoins) {
        tx.mergeCoins(tx.gas, [tx.object(mc.objectId)]);
      }
    }
  }

  const commands: string[] = [];
  const actedOnIds: string[] = [];
  const handled = new Set<string>();
  const swapInputs: {
    coin: TransactionObjectArgument;
    coinType: string;
    /** known static balance (merged dust); 0n = dynamic (withdrawn coin) */
    amountIn: bigint;
    sourceId: string;
  }[] = [];

  /** route a withdrawn coin: SUI → wallet, token → swap candidate */
  const routeWithdrawnCoin = (
    coin: import("@mysten/sui/transactions").TransactionArgument,
    coinType: string,
    sourceId: string
  ) => {
    if (coinType === SUI_COIN_TYPE) {
      tx.transferObjects([coin as TransactionObjectArgument], opts.sender!);
      return;
    }
    swapInputs.push({
      coin: coin as TransactionObjectArgument,
      coinType,
      amountIn: 0n, // dynamic — the swap step reads coin::balance on-chain
      sourceId,
    });
  };

  // 0. DeFi positions — only if user explicitly allowed DeFi withdraw (avoid Blocked object)
  // Allowed actions when allowDeFi=true: Cetus remove_liquidity, Scallop redeem, SpringSui redeem.
  // When allowDeFi=false (default) DeFi objects are skipped — prevents "Blocked object detected" from risky protocol calls.
  // Withdrawn SUI is sent to wallet, non-SUI routed to swap step.
  for (const o of objects) {
    if (!o.cleanupAction || o.cleanupAction !== "withdraw") continue;
    if (opts.allowDeFi === false) {
      commands.push(`Skipped ${o.name} — DeFi withdraw requires explicit consent (allowDeFi)`);
      handled.add(o.objectId);
      continue;
    }

    // Scallop sCoin / SpringSui sSUI are COINS (redeem consumes the coin)
    if (o.category === "coin" && !o.position?.poolId) {
      const inner = coinInnerType(o.type);
      try {
        if (inner && inner.toLowerCase().includes("reserve::marketcoin<")) {
          const underlying = (inner.match(/^0x[0-9a-fA-F]+::reserve::MarketCoin<(.+)>$/) ?? [])[1];
          if (!underlying) throw new Error("cannot parse MarketCoin underlying type");
          const res = withdrawScallop(tx, o.objectId, underlying);
          actedOnIds.push(o.objectId);
          commands.push(`Recover ${o.name}`);
          handled.add(o.objectId);
          routeWithdrawnCoin(res.coin, res.coinType, o.objectId);
        } else if (inner && inner.toLowerCase() === resolveSpringSuiPackages().tokenType.toLowerCase()) {
          const res = unstakeSpringSui(tx, o.objectId);
          actedOnIds.push(o.objectId);
          commands.push(`Recover ${o.name}`);
          handled.add(o.objectId);
          // sSUI → SUI: straight to the wallet
          tx.transferObjects([res.coin as TransactionObjectArgument], opts.sender!);
        } else {
          commands.push(`Skipped ${o.name} — withdraw not verified`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        commands.push(`Skipped ${o.name} — ${msg}`);
      }
      continue;
    }

    // Cetus LP position
    if (!o.position?.poolId || !o.position.coinTypeA || !o.position.coinTypeB) {
      commands.push(`Skipped ${o.name} — position data missing`);
      continue;
    }
    try {
      const res = withdrawCetusLiquidity(tx, {
        objectId: o.objectId,
        poolId: o.position.poolId,
        coinTypeA: o.position.coinTypeA,
        coinTypeB: o.position.coinTypeB,
        liquidity: o.position.liquidity ?? "0",
      });
      actedOnIds.push(o.objectId);
      commands.push(`Recover liquidity from ${o.name}`);
      handled.add(o.objectId);
      // route each withdrawn side: SUI -> wallet, token -> swap candidate
      routeWithdrawnCoin(res.coinA, res.coinTypeA, o.objectId);
      routeWithdrawnCoin(res.coinB, res.coinTypeB, o.objectId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);        commands.push(`Skipped ${o.name} — ${msg}`);
    }
  }

  // 1. dust coins — group by inner coin type, merge into one receiver per type.
  //    The merge consumes the source coins (they leave storage → rebate returns)
  //    while the combined balance stays in the wallet.
  const dustByType = new Map<string, WalletObject[]>();
  for (const o of objects) {
    if (!isDustCoin(o) || !o.cleanupAction) continue;
    const inner = coinInnerType(o.type) ?? o.type;
    const group = dustByType.get(inner);
    if (group) group.push(o);
    else dustByType.set(inner, [o]);
  }
  for (const [inner, group] of dustByType) {
    if (group.length < 2) {
      // one dust coin of this type — nothing to merge with, so it stays.
      // Never burn a balance: the preview says so honestly and the object is
      // excluded from the transaction (so post-tx verification won't expect it).        commands.push(`Keep ${shortType(inner)} dust — only one coin, nothing to merge with`);
      handled.add(group[0].objectId);
      continue;
    }
    const [dest, ...sources] = group;
    tx.mergeCoins(
      tx.object(dest.objectId),
      sources.map((s) => tx.object(s.objectId))
    );
    for (const s of sources) handled.add(s.objectId);
    actedOnIds.push(dest.objectId, ...sources.map((s) => s.objectId));
    commands.push(
      `Merge ${group.length} ${shortType(inner)} coins → one coin (balance kept in wallet)`
    );
    // the merged balance is a swap candidate (unless it is SUI)
    const total = group.reduce((a, o) => a + BigInt(o.coinBalance ?? "0"), 0n);
    if (inner !== SUI_COIN_TYPE && total > 0n) {
      swapInputs.push({ coin: tx.object(dest.objectId), coinType: inner, amountIn: total, sourceId: dest.objectId });
    }
  }

  // 2. everything else — zero-balance coins (destroy_zero), NFT/object burns
  for (const o of objects) {
    if (handled.has(o.objectId) || !o.cleanupAction) continue;

    if (o.category === "coin" && isZeroCoin(o)) {
      destroyZeroCoin(tx, o.objectId, o.type);
      commands.push(`Remove empty ${o.name} — zero balance`);
      actedOnIds.push(o.objectId);
      continue;
    }

    if (o.cleanupAction === "burn" && (o.category === "nft" || o.category === "object")) {
      const res = burnNFT(tx, o.objectId, o.package, o.type);
      actedOnIds.push(o.objectId);
      if (res.method === "official") {
        commands.push(`Remove ${o.name} — official burn`);
      } else {
        commands.push(`Remove ${o.name} from wallet`);
      }
      continue;
    }

    commands.push(`Skipped ${o.name} — cleanup not verified`);
  }

  // 3. swap non-SUI balances to SUI — gated on a real quote per token type.
  //    No quote → the token stays in the wallet (never guessed, never burned).
  //    Known static balances (merged dust) quote with their exact amount;
  //    dynamic PTB coins (withdrawn tokens) read their balance on-chain via
  //    coin::balance and pass it as the swap amount — the aggregator quote is
  //    resolved with a probe amount purely to find the route, the min-output
  //    guard (1% slippage) protects the actual execution.
  //
  //    Multi-asset gas saver (3.3): swapping a handful of base units through a
  //    pool costs more in network gas than the swap returns. A tiny KNOWN
  //    static balance is honestly kept in the wallet instead — the preview
  //    says so. (Dynamic withdrawn balances are always swapped/returned, never
  //    guessed.)
  const MIN_SWAP_AMOUNT = 10_000_000n; // ≈ 0.01 of a 9-decimal token
  if (swapInputs.length > 0) {
    const quotes = new Map<string, SwapQuote | null>();
    for (const s of swapInputs) {
      const dynamic = s.amountIn === 0n; // withdrawn coin — balance known only on-chain
      if (!dynamic && s.amountIn > 0n && s.amountIn < MIN_SWAP_AMOUNT) {
        // gas saver: the swap would cost more than the dust it converts
        tx.transferObjects([s.coin], opts.sender!);
        commands.push(
          `Keep ${shortType(s.coinType)} — swap gas would exceed token value`
        );
        continue;
      }
      if (!quotes.has(s.coinType)) {
        const probe = !dynamic && s.amountIn > 0n ? s.amountIn : 1_000_000n; // route probe
        quotes.set(s.coinType, await fetchSwapQuote(s.coinType, SUI_COIN_TYPE, probe));
      }
      const quote = quotes.get(s.coinType);
      if (!quote || quote.hops.length === 0) {
        // no verified route — transfer the token to the wallet untouched
        tx.transferObjects([s.coin], opts.sender!);
        commands.push(`Keep ${shortType(s.coinType)} — no swap route to SUI available`);
        continue;
      }
      const hop = quote.hops[0];
      // min output: the quote's expected output minus a small slippage margin (1%)
      // For micro-amounts (quotedOut < 100), use 0 as minOut to avoid integer
      // division rounding to zero which makes the tx fragile to any price move.
      const quotedOut = BigInt(hop.amountOut || "0");
      const slippageBps = (quotedOut * 1n) / 100n; // 1% in base units
      const minOut = slippageBps > 0n ? quotedOut - slippageBps : 0n;
      const amountIn: bigint | import("@mysten/sui/transactions").TransactionResult = dynamic
        ? tx.moveCall({
            target: "0x2::coin::balance",
            typeArguments: [s.coinType],
            arguments: [s.coin],
          })
        : s.amountIn;
      const label = appendCetusSwap(tx, hop, s.coin, { amountIn, minAmountOut: minOut });
      if (label) {
        commands.push(label);
        actedOnIds.push(s.sourceId);
      } else {
        tx.transferObjects([s.coin], opts.sender!);
        commands.push(`Keep ${shortType(s.coinType)} — swap pool not verified`);
      }
    }
  }

  // service fee transfer — split the gas coin by the cleaner fee, send to treasury
  const recipient = opts.serviceFeeRecipient;
  if (recipient && opts.serviceFeeMist != null && opts.serviceFeeMist > 0n) {
    const feeCoin = tx.splitCoins(tx.gas, [opts.serviceFeeMist]);
    tx.transferObjects([feeCoin], recipient);
    commands.push(`Service fee: ${Number(opts.serviceFeeMist) / 1e9} SUI`);
  }

  // multi-asset consolidation note (3.3) — how many distinct swap paths ran
  if (swapInputs.length > 1) {
    commands.push(
      `Convert ${swapInputs.length} token type${swapInputs.length === 1 ? "" : "s"} to SUI (balances preserved)`
    );
  }

  return {
    demo: false,
    preview: {
      commands,
      note: "One transaction: verified cleanup actions + service fee transfer.",
    },
    transaction: tx,
    actedOnIds,
  };
}

function shortType(type: string): string {
  const parts = type.split("::");
  return parts.length >= 3 ? parts[parts.length - 1] : type;
}
