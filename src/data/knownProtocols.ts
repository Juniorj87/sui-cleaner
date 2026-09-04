// Known Sui protocol packages.
//
// These are used by the deterministic classifier to decide that an object
// belongs to a known protocol. Classification must be based on on-chain
// facts (package IDs / types), never on heuristics about how an object
// "looks".
//
// Package IDs below were verified as live `package` objects on Sui mainnet
// (checked against the public RPC / GraphQL on 2026-08-17). They should be
// re-checked periodically: protocols upgrade packages over time, and a stale
// ID simply means objects classify as REVIEW until the ID is refreshed.
//
// PROTOCOLS LISTED IN THE DEFI TZ THAT ARE **NOT** YET VERIFIED (deliberately
// omitted — an unverified package ID is worse than none, see audit history):
//   Bluefin, Aftermath, Current Finance, WaterX, TradePort, Ember/DeepTrade/
//   Astros, Sudo, Magma, MMT, KAI. Their positions still classify as REVIEW
//   (unknown package) until their real package IDs are verified on-chain.

export type WithdrawStatus =
  | "verified"        // Entry point verified on mainnet, withdrawal executed in PTB
  | "not-verified"    // Protocol detected but withdrawal entry point NOT verified
  | "not-applicable"; // System/infra protocol — no user withdrawal possible

export interface KnownProtocol {
  name: string;
  /** package id on mainnet */
  packageId: string;
  kind:
    | "system"
    | "dex"
    | "lending"
    | "amm"
    | "nft"
    | "infra"
    | "game"
    | "bridge"
    | "lst"
    | "vault"
    | "cdp";
  /** Whether the withdrawal/recovery entry point has been verified on mainnet */
  withdrawStatus: WithdrawStatus;
  /** Human-readable summary of what this protocol's position means for cleanup */
  recoveryNote?: string;
  /** Move module containing the withdrawal function */
  module?: string;
  /** Withdrawal function name */
  withdrawFunction?: string;
  /** Type arguments for the withdrawal call */
  typeArgs?: string[];
  /** Token types this protocol can return to the user */
  supportedTokens?: string[];
  /** Shared objects required by the withdrawal function */
  sharedObjects?: string[];
}

export const KNOWN_PROTOCOLS: KnownProtocol[] = [
  // ---- System / Infrastructure ---------------------------------------------
  { name: "Sui System", packageId: "0x2", kind: "system", withdrawStatus: "not-applicable" },
  { name: "Sui System State", packageId: "0x3", kind: "system", withdrawStatus: "not-applicable" },
  { name: "Sui System", packageId: "0x5", kind: "system", withdrawStatus: "not-applicable" },
  { name: "Price Oracle", packageId: "0xc8724de692400a2a08585f6f7c8617acfb783abe2c66ae6a4680a21b36a504c5", kind: "infra", withdrawStatus: "not-applicable" },
  { name: "DeepBook", packageId: "0xdee9", kind: "dex", withdrawStatus: "not-verified", recoveryNote: "DeepBook v2 DEX — order/swap withdrawal not yet wired", module: "pool", supportedTokens: ["SUI", "USDC"] },

  // ---- Cetus CLMM (VERIFIED: remove_liquidity + pool_script_v2 swap) -------
  // Cetus CLMM config package
  { name: "Cetus", packageId: "0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f", kind: "amm", withdrawStatus: "not-applicable", recoveryNote: "Cetus CLMM config package — used by pool operations" },
  // Cetus CLMM pool (VERIFIED: remove_liquidity)
  { name: "Cetus", packageId: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb", kind: "amm", withdrawStatus: "verified", recoveryNote: "LP withdrawal via pool::remove_liquidity verified — swap to SUI", module: "pool", withdrawFunction: "remove_liquidity", typeArgs: ["CoinTypeA", "CoinTypeB"], supportedTokens: ["SUI", "USDC", "USDT", "WETH", "WBTC", "CETUS"], sharedObjects: ["0x0408fa4e...::config::GlobalConfig"] },

  // ---- Turbos Finance (CLMM — detected, withdrawal NOT verified) ------------
  { name: "Turbos", packageId: "0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1", kind: "amm", withdrawStatus: "not-verified", recoveryNote: "Turbos CLMM — LP positions detected; withdrawal entry needs on-chain verification", module: "pool", withdrawFunction: "remove_liquidity", supportedTokens: ["SUI", "USDC"] },

  // ---- Lending --------------------------------------------------------------
  // Navi Protocol — lending (requires dynamic Pool<T> resolution)
  { name: "Navi", packageId: "0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0", kind: "lending", withdrawStatus: "not-verified", recoveryNote: "Navi lending — withdrawal requires dynamic Pool<T> object read from Storage; not statically resolvable", module: "pool", withdrawFunction: "withdraw", supportedTokens: ["SUI", "USDC", "USDT"] },
  // Scallop peripheral (coin operations — not the core redeem)
  { name: "Scallop", packageId: "0xd971609b7feb6230585831e7aeb3c121fb21b9431337a30fc99185eb459a05ee", kind: "lending", withdrawStatus: "not-verified", recoveryNote: "Scallop peripheral — coin/sCoin operations detected; core redeem not yet wired" },
  // Scallop core (VERIFIED: redeem::redeem)
  { name: "Scallop", packageId: "0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf", kind: "lending", withdrawStatus: "verified", recoveryNote: "Scallop redeem → sCoin<Underlying> → underlying Coin<T>", module: "redeem", withdrawFunction: "redeem", typeArgs: ["UnderlyingCoinType"], supportedTokens: ["SUI", "USDC", "USDT", "wBTC"], sharedObjects: ["Version (0x07871c4b...)", "Market (0xa757975...)"] },
  // Suilend — lending
  { name: "Suilend", packageId: "0xf95b06141ed4a174f239417323bde3f209b972f5930d8521ea38a52aff3a6ddf", kind: "lending", withdrawStatus: "not-verified", recoveryNote: "Suilend lending — withdrawal entry not yet verified on mainnet", module: "lending_market", withdrawFunction: "withdraw", supportedTokens: ["SUI", "USDC"] },

  // ---- Liquid staking (LST) --------------------------------------------------
  // Volo LST (vSUI)
  { name: "Volo", packageId: "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55", kind: "lst", withdrawStatus: "not-verified", recoveryNote: "Volo vSUI unstake — entry point not yet verified on mainnet", module: "staking", withdrawFunction: "unstake", typeArgs: ["0x549e8b...::vSUI::VSUI"], supportedTokens: ["vSUI"] },
  // Haedal LST (haSUI)
  { name: "Haedal", packageId: "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d", kind: "lst", withdrawStatus: "not-verified", recoveryNote: "Haedal haSUI unstake — entry point not yet verified on mainnet", module: "staking", withdrawFunction: "unstake", typeArgs: ["0xbde4ba...::haSUI::HASUI"], supportedTokens: ["haSUI"] },
  // SpringSui (VERIFIED: liquid_staking::redeem)
  { name: "SpringSui", packageId: "0xb0575765166030556a6eafd3b1b970eba8183ff748860680245b9edd41c716e7", kind: "lst", withdrawStatus: "verified", recoveryNote: "SpringSui sSUI → SUI redemption verified", module: "liquid_staking", withdrawFunction: "redeem", typeArgs: ["SpringSuiTokenType"], supportedTokens: ["sSUI"], sharedObjects: ["LiquidStakingInfo (0x15eda7...)", "SuiSystemState (0x5)"] },
  // SpringSui token type package
  { name: "SpringSui", packageId: "0x83556891f4a0f233ce7b05cfe7f957d4020492a34f5405b2cb9377d060bef4bf", kind: "lst", withdrawStatus: "not-applicable", recoveryNote: "SpringSui token type definition package" },

  // ---- Vaults / yield --------------------------------------------------------
  // Haedal Vaults (vault exit)
  { name: "Haedal Vaults", packageId: "0xc4ebf35be1478318d78c324342854dd2735a036139373a9d41a1aa3a46a01d05", kind: "vault", withdrawStatus: "not-verified", recoveryNote: "Haedal Vaults — vault exit entry not yet verified", module: "vault", withdrawFunction: "withdraw", supportedTokens: ["haSUI"] },
  { name: "Haedal Vaults", packageId: "0xfbc91f75397ce25b3b1b01cab2bf494d2e3f9b9e89c97545d88bd616cbbfcc37", kind: "vault", withdrawStatus: "not-verified", recoveryNote: "Haedal Vaults secondary — vault exit not yet verified" },
  // AlphaFi vault
  { name: "AlphaFi", packageId: "0x79729faced2e6294254e555424184f71c8c043a1dbe3447b88613704a7276710", kind: "vault", withdrawStatus: "not-verified", recoveryNote: "AlphaFi vault — exit/redeem entry not yet verified", module: "vault", withdrawFunction: "redeem", supportedTokens: ["SUI"] },

  // ---- CDP / stablecoin ------------------------------------------------------
  { name: "Bucket", packageId: "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2", kind: "cdp", withdrawStatus: "not-verified", recoveryNote: "Bucket CDP — borrow/repay entry not yet verified", module: "bucket", withdrawFunction: "repay", supportedTokens: ["BUCK"] },
];

/** Package id prefix match on the Move type string `package::module::Type`. */
export function packageIdOfType(type: string): string {
  const idx = type.indexOf("::");
  return idx === -1 ? type : type.slice(0, idx);
}

export function findProtocolByPackage(packageId: string): KnownProtocol | undefined {
  return KNOWN_PROTOCOLS.find((p) => p.packageId === packageId);
}

export function findProtocolByType(type: string): KnownProtocol | undefined {
  return findProtocolByPackage(packageIdOfType(type));
}

/** Get a summary of all protocols by status */
export function getProtocolSummary(): {
  verified: KnownProtocol[];
  notVerified: KnownProtocol[];
  notApplicable: KnownProtocol[];
} {
  const verified = KNOWN_PROTOCOLS.filter((p) => p.withdrawStatus === "verified");
  const notVerified = KNOWN_PROTOCOLS.filter((p) => p.withdrawStatus === "not-verified");
  const notApplicable = KNOWN_PROTOCOLS.filter((p) => p.withdrawStatus === "not-applicable");
  return { verified, notVerified, notApplicable };
}

/** Get all unique token types supported by verified protocols */
export function getSupportedTokenTypes(): string[] {
  const tokens = new Set<string>();
  for (const p of KNOWN_PROTOCOLS) {
    if (p.supportedTokens) {
      for (const t of p.supportedTokens) tokens.add(t);
    }
  }
  return [...tokens].sort();
}
