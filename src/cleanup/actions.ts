/**
 * Action-specific cleanup handlers.
 *
 * There is deliberately NO generic burn(object) — each action maps to a
 * verified mechanism:
 *
 *   destroyZeroCoin         — 0x2::coin::destroy_zero  (VERIFIED, framework)
 *   cataloguedPackageBurn   — collection entry burn     (only when catalogued + verified)
 *   cataloguedPackageDelete — collection entry delete   (only when catalogued + verified)
 *
 * See CLEANUP_CAPABILITIES.md — generic deletion of arbitrary external types
 * is NOT possible, and nothing becomes cleanable until its mechanism is
 * verified.
 */
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";
import {
  resolveCetusCLMMPackages,
  resolveScallopPackages,
  resolveSpringSuiPackages,
} from "../capabilities/networkResolver";

/**
 * 0x2::coin::destroy_zero — destroys a zero-balance Coin object. Verified.
 * The generic type argument (the inner Coin<T> type) is required: without it
 * the VM fails deserialization in command 0.
 */
export function destroyZeroCoin(tx: Transaction, coinObjectId: string, coinType?: string): void {
  const inner = coinType?.match(/^0x2::coin::Coin<(.+)>$/)?.[1];
  if (!inner) {
    throw new Error(`Cannot destroy zero coin: failed to extract generic coin type from "${coinType}"`);
  }
  tx.moveCall({
    target: "0x2::coin::destroy_zero",
    arguments: [tx.object(coinObjectId)],
    typeArguments: [inner],
  });
}

/**
 * Removes an NFT or object from the wallet.
 *
 * Currently the ONLY verified mechanism is transfer to the 0x0 burn address:
 * it removes the object from the wallet permanently, but the object still
 * occupies storage on-chain, so the storage rebate does NOT return.
 *
 * Collection-specific official burn functions are deliberately NOT wired up
 * here yet: each one must be verified against the live package (signature,
 * required type arguments) before use. Until then the UI must show the
 * storage-rebate warning for every removed NFT.
 */
export function burnNFT(
  tx: Transaction,
  objectId: string,
  _packageId: string,
  _type: string
): { method: "official" | "transfer-to-0x0"; details: string } {
  // Generic verified mechanism: transfer to 0x0
  tx.transferObjects(
    [tx.object(objectId)],
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
  return { method: "transfer-to-0x0", details: "transfer to 0x0" };
}

/**
 * Collection burn — only callable for catalog entries marked VERIFIED.
 * The collection catalog is currently empty, so this must never be invoked
 * (it delegates to the transfer-to-0x0 mechanism).
 */
export function cataloguedPackageBurn(tx: Transaction, objectId: string): void {
  burnNFT(tx, objectId, "", "");
}

/**
 * Collection delete — only callable for catalog entries marked VERIFIED.
 * The collection catalog is currently empty, so this must never be invoked.
 */
export function cataloguedPackageDelete(_tx: Transaction, _objectId: string): never {
  throw new Error("cataloguedPackageDelete: no verified collection catalog entry (Phase 5).");
}

/* ------------------------------------------------------------------ */
/*  DeFi position withdrawal (DeFi TZ §2.3)                           */
/* ------------------------------------------------------------------ */
//
// Rules (project fail-safe philosophy): a withdraw function is only wired
// when its entry point was VERIFIED on-chain (signature, type arguments,
// required shared objects). Anything else throws — an unverified call would
// fail the dry-run gate before signing, but inventing commands is worse
// than refusing (see the audit history: fabricated package IDs).
//
// VERIFIED on mainnet (2026-08-17):
//   Cetus CLMM pool::remove_liquidity(&GlobalConfig, &mut Pool, &mut Position,
//   u128 liquidity, &Clock) -> (Balance<A>, Balance<B>)
//     GlobalConfig 0x0408fa4e… (0x95b8d278…::config::GlobalConfig)
//     Clock 0x6
//   Scallop redeem::redeem(&Version, &mut Market, Coin<MarketCoin<T>>,
//     &Clock, &mut TxContext) -> Coin<T>
//     Package   0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf
//     Version   0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7 (shared)
//     Market    0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9 (shared)
//     Clock     0x6
//   SpringSui liquid_staking::redeem(&mut LiquidStakingInfo<T>, Coin<T>,
//     &mut SuiSystemState, &mut TxContext) -> Coin<SUI>
//     Core package  0xb0575765166030556a6eafd3b1b970eba8183ff748860680245b9edd41c716e7
//     LiquidStakingInfo 0x15eda7330c8f99c30e430b4d82fd7ab2af3ead4ae17046fcb224aa9bad394f6b (shared)
//     T = SPRING_SUI (0x83556891…::spring_sui::SPRING_SUI)
//     SuiSystemState 0x5
//
// NOT YET VERIFIED (throw — fail-safe):
//   Navi withdraw (requires a dynamic Pool<T> object read from Storage
//     dynamic fields — cannot be resolved statically; the package id in the
//     gap report 0x8fe003e8… does NOT exist on mainnet), Suilend withdraw,
//   Haedal/Volo unstake, AlphaFi vault exit, Bucket CDP repay.
//   Their positions classify REVIEW until each entry point is verified.
//

/**
 * Resolve Cetus CLMM packages for the current network.
 * These are NOT hardcoded — they come from the capability registry
 * and resolve to the correct addresses per network.
 */
function getCetusCLMMPackages() {
  return resolveCetusCLMMPackages();
}

/**
 * Withdraw liquidity from a Cetus CLMM position.
 *
 * Calls the verified `pool::remove_liquidity` entry point, which returns the
 * two underlying balances to the transaction. Both are wrapped into coins and
 * RETURNED as PTB results — the pipeline then decides what to do with each:
 * SUI is transferred to the sender, a non-SUI token is routed into the swap
 * step (converted to SUI), and only when no verified swap route exists is it
 * transferred to the wallet untouched.
 *
 * Only positions with liquidity > 0 reach here (the classifier gates on that).
 */
export function withdrawCetusLiquidity(
  tx: Transaction,
  position: { objectId: string; poolId: string; coinTypeA: string; coinTypeB: string; liquidity: string }
): {
  method: "withdraw";
  details: string;
  coinTypeA: string;
  coinTypeB: string;
  coinA: TransactionArgument;
  coinB: TransactionArgument;
} {
  const liquidity = BigInt(position.liquidity ?? "0");
  if (liquidity <= 0n) {
    throw new Error("withdrawCetusLiquidity: position has no liquidity to withdraw.");
  }
  const { packageId: cetusPackage, globalConfig } = getCetusCLMMPackages();
  if (!cetusPackage) {
    throw new Error("withdrawCetusLiquidity: Cetus CLMM package not available on this network.");
  }
  const result = tx.moveCall({
    target: `${cetusPackage}::pool::remove_liquidity`,
    typeArguments: [position.coinTypeA, position.coinTypeB],
    arguments: [
      tx.object(globalConfig),
      tx.object(position.poolId),
      tx.object(position.objectId),
      tx.pure.u128(liquidity),
      tx.object("0x6"), // Clock
    ],
  });
  // (Balance<A>, Balance<B>) -> wrap each into a Coin (kept in the PTB)
  const coinA = tx.moveCall({
    target: "0x2::coin::from_balance",
    typeArguments: [position.coinTypeA],
    arguments: [result[0]],
  });
  const coinB = tx.moveCall({
    target: "0x2::coin::from_balance",
    typeArguments: [position.coinTypeB],
    arguments: [result[1]],
  });
  return {
    method: "withdraw",
    details: "remove_liquidity → withdraw pair",
    coinTypeA: position.coinTypeA,
    coinTypeB: position.coinTypeB,
    coinA,
    coinB,
  };
}

/**
 * Resolve Scallop packages for the current network.
 */
function getScallopPackages() {
  return resolveScallopPackages();
}

/**
 * Redeem a Scallop sCoin (Coin<MarketCoin<T>>) for the underlying token.
 *
 * Verified on mainnet: `redeem::redeem(&Version, &mut Market,
 * Coin<MarketCoin<T>>, &Clock, &mut TxContext) -> Coin<T>`. The sCoin object
 * is consumed and the underlying Coin<T> is returned as a PTB result — the
 * pipeline then routes it into the swap step (converted to SUI) or to the
 * wallet when it is already SUI.
 */
export function withdrawScallop(
  tx: Transaction,
  sCoinObjectId: string,
  underlyingCoinType: string
): {
  method: "withdraw";
  details: string;
  coinType: string;
  /** Coin<T> PTB result (a NestedResult reference to the moveCall output) */
  coin: TransactionArgument;
} {
  const { packageId: scallopPackage, version, market } = getScallopPackages();
  if (!scallopPackage) {
    throw new Error("withdrawScallop: Scallop package not available on this network.");
  }
  const result = tx.moveCall({
    target: `${scallopPackage}::redeem::redeem`,
    typeArguments: [underlyingCoinType],
    arguments: [
      tx.object(version),
      tx.object(market),
      tx.object(sCoinObjectId),
      tx.object("0x6"), // Clock
    ],
  });
  return {
    method: "withdraw",
    details: "redeem sCoin → underlying token",
    coinType: underlyingCoinType,
    coin: result[0],
  };
}

/** Navi withdrawal — entry point NOT verified on-chain yet (fail-safe). */
export function withdrawNavi(_tx: Transaction, _positionId: string): never {
  throw new Error(
    "withdrawNavi: Navi withdrawal entry point is not verified yet. The position stays REVIEW — nothing is executed."
  );
}

/** Suilend withdrawal — entry point NOT verified on-chain yet (fail-safe). */
export function withdrawSuilend(_tx: Transaction, _reserveId: string): never {
  throw new Error(
    "withdrawSuilend: Suilend withdrawal entry point is not verified yet. The position stays REVIEW — nothing is executed."
  );
}

/**
 * Resolve SpringSui packages for the current network.
 */
function getSpringSuiPackages() {
  return resolveSpringSuiPackages();
}

/**
 * Unstake SpringSui sSUI back into SUI.
 *
 * Verified on mainnet: `liquid_staking::redeem(&mut LiquidStakingInfo<SPRING_SUI>,
 * Coin<SPRING_SUI>, &mut SuiSystemState, &mut TxContext) -> Coin<SUI>`. The
 * sSUI coin is consumed and Coin<SUI> is returned as a PTB result — routed
 * straight to the wallet (already SUI).
 */
export function unstakeSpringSui(
  tx: Transaction,
  sSuiCoinId: string
): {
  method: "withdraw";
  details: string;
  /** Coin<SUI> PTB result (a NestedResult reference to the moveCall output) */
  coin: TransactionArgument;
} {
  const { packageId: springsuiPackage, liquidStakingInfo, tokenType } = getSpringSuiPackages();
  if (!springsuiPackage) {
    throw new Error("unstakeSpringSui: SpringSui package not available on this network.");
  }
  const result = tx.moveCall({
    target: `${springsuiPackage}::liquid_staking::redeem`,
    typeArguments: [tokenType],
    arguments: [
      tx.object(liquidStakingInfo),
      tx.object(sSuiCoinId),
      tx.object("0x5"), // SuiSystemState
    ],
  });
  return {
    method: "withdraw",
    details: "redeem sSUI → SUI",
    coin: result[0],
  };
}

/** LST unstake (Haedal) — entry point NOT verified on-chain yet (fail-safe). */
export function unstakeHaedal(_tx: Transaction, _haSuiCoinId: string): never {
  throw new Error(
    "unstakeHaedal: Haedal unstake entry point is not verified yet. The position stays REVIEW — nothing is executed."
  );
}

/** LST unstake (Volo) — entry point NOT verified on-chain yet (fail-safe). */
export function unstakeVolo(_tx: Transaction, _vSuiCoinId: string): never {
  throw new Error(
    "unstakeVolo: Volo unstake entry point is not verified yet. The position stays REVIEW — nothing is executed."
  );
}
