import type { WalletObject as RawObject } from "../data/demo";
import { isProtectedType, isProtectedSingleton } from "../data/protectedTypes";
import {
  findProtocolByType,
  findProtocolByPackage,
  packageIdOfType,
  type KnownProtocol,
} from "../data/knownProtocols";
import { isKnownCollection } from "../data/knownCollections";
import { findProjectByCoinType, findProjectByName } from "../data/projectRegistry";
import { resolvePackageAddress } from "../capabilities/networkResolver";
import {
  extractCoinSymbol,
  formatCoinBalance,
  getCachedMetadata,
  VERIFIED_TOKEN_LOGOS,
  fixIpfsUrl,
} from "../lib/tokenMetadata";

export type Classification = "keep" | "review" | "suspicious" | "cleanable" | "protected";
export type CleanupAction = "burn" | "delete" | "withdraw";
export type Category = "coin" | "nft" | "object" | "unknown";

/**
 * Normalized wallet object. Mirrors the product spec's WalletObject shape.
 */
export interface WalletObject {
  objectId: string;
  type: string;
  category: Category;
  classification: Classification;
  cleanupAction?: CleanupAction;
  protected: boolean;
  reason: string;
  name: string;
  symbol?: string;
  iconUrl?: string;
  imageUrl?: string;
  decimals?: number;
  formattedBalance?: string;
  coinType?: string;
  collection: string;
  package: string;
  value?: number;
  /** coin balance in base units, when this object is a coin */
  coinBalance?: string;
  /** bright = valuable (accent dot), stable = trusted (outlined dot) */
  tone?: "bright" | "stable";
  /** the excavation found this artifact cursed — flagged for the altar */
  cursed?: boolean;
  /** true when this coin holds only a tiny (dust) balance — merged, never burned */
  dust?: boolean;
  /** DeFi position data (LP positions / obligations / receipts) — used to
   *  build the withdraw step of the convert-to-SUI pipeline */
  position?: {
    /** pool / market object id when known from on-chain fields */
    poolId?: string;
    coinTypeA?: string;
    coinTypeB?: string;
    /** raw liquidity / balance units when reported on-chain */
    liquidity?: string;
  };
  version?: string;
  digest?: string;
}

export interface OnchainFacts {
  objectId: string;
  type: string;
  packageId: string;
  category: Category;
  /** Coin balance in base units, when the object is a coin. */
  coinBalance?: string;
  name?: string;
  collection?: string;
  imageUrl?: string;
  ownerKind: "address" | "shared" | "immutable" | "object";
  /**
   * Move `store` ability / public_transfer. Only store-able objects can be
   * transferred to 0x0 (the generic verified NFT removal mechanism).
   */
  hasStore?: boolean;
  /** DeFi position fields read from the object contents (pool, pair, liquidity) */
  positionFields?: { poolId?: string; coinTypeA?: string; coinTypeB?: string; liquidity?: string };
}

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  keep: "KEEP",
  review: "REVIEW",
  suspicious: "SUSPICIOUS",
  cleanable: "CLEANABLE",
  protected: "PROTECTED",
};

const DEMO_REASON: Record<Classification, string> = {
  keep: "Verified collection / known protocol.",
  review: "Unknown package. No verified collection. Cleanup capability not verified.",
  suspicious: "Unknown package. No verified collection. No market data.",
  cleanable: "Cleanup verified: burn via transfer-to-0x0 (demo).",
  protected: "System-critical object. This object will not be included in cleanup.",
};

/* ------------------------------ demo classifier ---------------------------- */

const DEMO_ACTION: Partial<Record<RawObject["kind"], CleanupAction>> = {
  NFT: "burn",
  TOKEN: "burn",
  OBJECT: "delete",
};

export function classifyDemo(raw: RawObject): WalletObject {
  let classification: Classification;
  if (raw.status === "PROTECTED") classification = "protected";
  else if (raw.status === "VALUABLE" || raw.status === "TRUSTED") classification = "keep";
  else if (raw.status === "SUSPICIOUS") classification = "suspicious";
  else if (raw.cleanable) classification = "cleanable";
  else classification = "review";

  // Zero-balance coins are EMPTY COIN OBJECTS — the only coin case where a
  // "token" may be removed, via coin::destroy_zero. Mirrors the real
  // classifier: the object is empty, the token value is gone, nothing is
  // ever destroyed.
  const isEmptyCoin = raw.kind === "TOKEN" && raw.coinBalance === "0";
  const cleanupAction = raw.cleanable ? (isEmptyCoin ? "delete" : DEMO_ACTION[raw.kind]) : undefined;

  return {
    objectId: raw.id,
    type: `${raw.package}::demo::${raw.kind}`,
    category: raw.kind === "TOKEN" ? "coin" : raw.kind === "NFT" ? "nft" : "object",
    classification,
    cleanupAction,
    protected: raw.status === "PROTECTED",
    reason: isEmptyCoin
      ? "Empty coin object — zero balance. Cleanup verified: coin::destroy_zero. " + raw.note
      : cleanupAction
        ? `Cleanup verified: ${cleanupAction} (demo). ${raw.note}`
        : DEMO_REASON[classification],
    name: raw.name,
    collection: raw.collection === "—" ? "Unknown" : raw.collection,
    package: raw.package,
    value: raw.value,
    tone: raw.status === "VALUABLE" ? "bright" : "stable",
    cursed: raw.cursed,
    coinBalance: isEmptyCoin ? "0" : undefined,
  };
}

/* ------------------------------- real classifier --------------------------- */
/**
 * Deterministic on-chain classification.
 *
 * Order matters:
 *   1. protected (type patterns / singletons / non-address owners)
 *   2. known protocol / verified collection -> keep
 *   3. verified cleanup capability -> cleanable (only these!)
 *   4. everything else -> review (never auto-cleanable)
 *
 * Nothing is classified SUSPICIOUS from on-chain facts alone in this version —
 * a suspicious list must come from a curated, verifiable source (Phase 4).
 */
export function classifyReal(
  facts: OnchainFacts,
  opts?: { spamPackages?: ReadonlySet<string> }
): WalletObject {
  const protected_ =
    isProtectedType(facts.type) ||
    isProtectedSingleton(facts.objectId) ||
    facts.ownerKind !== "address";

  if (protected_) {
    return {
      objectId: facts.objectId,
      type: facts.type,
      category: facts.category,
      classification: "protected",
      protected: true,
      reason:
        facts.ownerKind !== "address"
          ? "Not address-owned (shared or immutable). Cannot be removed."
          : "System-critical object. This object will not be included in cleanup.",
      name: facts.name ?? humanizeTypeName(facts.type),
      collection: facts.collection ?? "Unknown",
      package: facts.packageId,
    };
  }

  // package flagged by the (server-loaded) spam registry — protection still wins
  const spam =
    !!opts?.spamPackages &&
    !!facts.packageId &&
    opts.spamPackages.has(facts.packageId.toLowerCase());

  // Coins first — the most common asset. `0x2::coin::Coin<T>` also matches the
  // `0x2` system package, so this branch must run before the protocol check.
  // Value must never be destroyed: only zero-balance coins can be destroyed,
  // dust coins are merged (balance preserved), and a known token with a real
  // balance is kept — an unknown token with a meaningful balance stays REVIEW.
  if (facts.category === "coin") {
    const balance = BigInt(facts.coinBalance ?? "0");
    const coinType = facts.type.match(/^0x2::coin::Coin<(.+)>$/i)?.[1] ?? facts.type;
    const proj = findProjectByCoinType(coinType);
    const meta = getCachedMetadata(coinType);
    const preset = VERIFIED_TOKEN_LOGOS[coinType];

    const symbol = proj?.symbol || preset?.symbol || meta?.symbol || extractCoinSymbol(coinType);
    const tokenName = proj?.name || preset?.name || meta?.name || facts.name || symbol;
    const decimals = proj?.decimals ?? preset?.decimals ?? meta?.decimals ?? (symbol === "SUI" ? 9 : symbol === "USDC" || symbol === "USDT" ? 6 : 9);
    const iconUrl = preset?.iconUrl || meta?.iconUrl;
    const formattedBalance = formatCoinBalance(facts.coinBalance, decimals);

    const base: WalletObject = {
      objectId: facts.objectId,
      type: facts.type,
      category: "coin",
      classification: "keep",
      protected: false,
      reason: `Verified token: ${tokenName} (${symbol}). Balance safe.`,
      name: tokenName,
      symbol,
      iconUrl,
      decimals,
      formattedBalance,
      coinType,
      coinBalance: facts.coinBalance,
      collection: proj?.issuer || meta?.description || "Coin",
      package: facts.packageId,
    };

    // sCoins (Scallop Coin<MarketCoin<T>>) and sSUI (SpringSui
    // Coin<SPRING_SUI>) are DeFi position receipts — a VERIFIED withdraw
    // (redeem) entry point exists, so they are cleanable with action
    // "withdraw": the sCoin is redeemed for the underlying token, which the
    // pipeline then converts to SUI. The balance is never destroyed.
    const defiCoin = defiCoinWithdraw(facts);
    if (defiCoin) {
      return spamOverride(
        {
          ...base,
          classification: "cleanable",
          cleanupAction: "withdraw",
          reason: defiCoin.reason,
          position: { coinTypeA: defiCoin.coinType, coinTypeB: undefined },
        },
        spam
      );
    }

    if (balance === 0n) {
      // Verified cleanup: zero-balance coin can be destroyed via coin::destroy_zero.
      return spamOverride(
        {
          ...base,
          name: `${symbol} (Empty Coin)`,
          classification: "cleanable",
          cleanupAction: "delete",
          reason: `Empty spent coin object (${symbol}) with zero balance. Reclaim +0.0028 SUI storage rebate by destroying this object via coin::destroy_zero().`,
        },
        spam
      );
    }
    if (isDustCoin(facts, balance)) {
      // Verified cleanup: dust coins are MERGED into one coin of the same type
      // (the balance stays in the wallet) and the empty containers are destroyed.
      return spamOverride(
        {
          ...base,
          classification: "cleanable",
          cleanupAction: "delete",
          dust: true,
          reason:
            `Micro-token dust balance (${formattedBalance} ${symbol}). Will be consolidated — the balance stays in your wallet, only empty containers are destroyed for rebates.`,
        },
        spam
      );
    }
    if (isKnownCoin(facts) || proj || preset) {
      return spamOverride(
        { ...base, tone: "bright", reason: `Verified token (${symbol}) with balance (${formattedBalance} ${symbol}). Value is never destroyed. Keep.` },
        spam
      );
    }
    // Unknown token with a meaningful balance: REVIEW (or SUSPICIOUS when the
    // package is spam-flagged) — never KEEP, never CLEANABLE.
    return spamOverride(
      {
        ...base,
        classification: "review",
        protected: false,
        reason:
          `We could not fully verify this token (${symbol}). Its balance (${formattedBalance} ${symbol}) is safe — nothing will be touched without review.`,
      },
      spam
    );
  }

  const protocol = findProtocolByType(facts.type) ?? findProtocolByPackage(facts.packageId);
  if (protocol) {
    const position = defiPositionInfo(facts, protocol);
    if (position) {
      // DeFi position object (Cetus Position, Scallop/Suilend Obligation, …).
      // It is shown in the DeFi tab; a withdraw is offered ONLY when the
      // mechanism is verified (currently: Cetus LP positions with liquidity).
      if (position.canWithdraw) {
        return spamOverride(
          {
            objectId: facts.objectId,
            type: facts.type,
            category: "object",
            classification: "cleanable",
            cleanupAction: "withdraw",
            protected: false,
            reason: position.reason,
            name: facts.name ?? humanizeTypeName(facts.type),
            collection: facts.collection ?? protocol.name,
            package: facts.packageId,
            position: position.position,
          },
          spam
        );
      }
      return spamOverride(
        {
          objectId: facts.objectId,
          type: facts.type,
          category: "object",
          classification: "review",
          protected: false,
          reason: position.reason,
          name: facts.name ?? humanizeTypeName(facts.type),
          collection: facts.collection ?? protocol.name,
          package: facts.packageId,
          position: position.position,
        },
        spam
      );
    }
    return spamOverride(
      keepObject(facts, protocol?.name ?? facts.collection ?? "Verified collection"),
      spam
    );
  }
  if (isKnownCollection(facts.name, facts.packageId)) {
    return spamOverride(
      keepObject(facts, facts.collection ?? "Verified collection"),
      spam
    );
  }

  // never a bright/valuable claim for unverified real objects

  if (facts.category === "nft" || facts.category === "object") {
    if (facts.hasStore === true) {
      // store ability confirmed (public_transfer) → transfer-to-0x0 is a
      // verified removal mechanism: the object leaves the wallet permanently,
      // but the storage rebate is NOT returned.
      return spamOverride(
        {
          objectId: facts.objectId,
          type: facts.type,
          category: facts.category,
          classification: "cleanable",
          cleanupAction: "burn",
          protected: false,
          reason:
            "Verified cleanup: transfer to 0x0. This object leaves the wallet, but the storage rebate will NOT be returned.",
          name: facts.name ?? humanizeTypeName(facts.type),
          collection: facts.collection ?? "Unknown",
          package: facts.packageId,
        },
        spam
      );
    }
    // No store ability → transfer-to-0x0 would fail at execution. Nothing is
    // offered; the object can only be removed by its own module (Phase 5).
    return spamOverride(
      {
        objectId: facts.objectId,
        type: facts.type,
        category: facts.category,
        classification: "review",
        protected: false,
        reason: "Not transferable — no verified cleanup method. Nothing will be touched.",
        name: facts.name ?? humanizeTypeName(facts.type),
        collection: facts.collection ?? "Unknown",
        package: facts.packageId,
      },
      spam
    );
  }

  // Unknown, unverified: review. Cleanup capability is NOT verified.
  return spamOverride(
    {
      objectId: facts.objectId,
      type: facts.type,
      category: facts.category,
      classification: "review",
      protected: false,
      reason: "Unknown package. No verified collection. Cleanup capability not verified.",
      name: facts.name ?? humanizeTypeName(facts.type),
      collection: facts.collection ?? "Unknown",
      package: facts.packageId,
    },
    spam
  );
}

/* ------------------------------ DeFi positions ---------------------------- */

/* ------------------------- DeFi coins (sCoin / sSUI) ---------------------- */

/**
 * Resolve Scallop core package for DeFi coin detection.
 * Uses the network resolver instead of hardcoded mainnet IDs.
 */
function getScallopCorePackage(): string {
  return resolvePackageAddress("scallop", "entry") ?? "";
}

/**
 * Resolve SpringSui token type for DeFi coin detection.
 * IMPORTANT: the SPRING_SUI token type lives under a SEPARATE package
 * from the core liquid staking package. Uses the TokenType shared object
 * from the network resolver, not the entry package.
 */
function getSpringSuiTokenType(): string {
  const tokenPkg = resolvePackageAddress("springsui", "TokenType");
  return tokenPkg ? `${tokenPkg}::spring_sui::SPRING_SUI` : "";
}

/**
 * A coin that is actually a DeFi position receipt with a VERIFIED withdraw
 * (redeem) entry point: Scallop sCoins (Coin<MarketCoin<T>>) and SpringSui
 * sSUI (Coin<SPRING_SUI>). Returns the withdraw info or undefined.
 */
function defiCoinWithdraw(
  facts: OnchainFacts
): { reason: string; coinType: string } | undefined {
  const inner = facts.type.match(/^0x2::coin::Coin<(.+)>$/)?.[1];
  if (!inner) return undefined;

  // Scallop sCoin: Coin<0xefe8b36d…::reserve::MarketCoin<Underlying>>
  const marketCoin = inner.match(
    /^(0x[0-9a-fA-F]+)::reserve::MarketCoin<(.+)>$/
  );
  const scallopCore = getScallopCorePackage();
  if (marketCoin && marketCoin[1].toLowerCase() === scallopCore.toLowerCase()) {
    const underlying = marketCoin[2];
    return {
      coinType: underlying,
      reason:
        "Scallop sCoin (deposit receipt). Verified withdraw: redeem for the underlying token, then convert to SUI. The balance is never destroyed.",
    };
  }

  // SpringSui sSUI: Coin<package::spring_sui::SPRING_SUI>
  const springSuiType = getSpringSuiTokenType();
  if (springSuiType && inner.toLowerCase() === springSuiType.toLowerCase()) {
    return {
      coinType: "0x2::sui::SUI",
      reason:
        "SpringSui sSUI (liquid staking). Verified withdraw: redeem back into SUI. The balance is never destroyed.",
    };
  }
  return undefined;
}

/** Move modules that represent a DeFi position / receipt object. */
const POSITION_MODULES = new Set([
  "position",
  "obligation",
  "vault",
  "receipt",
  "deposit",
  "borrow",
  "cert",
  "staking",
]);

const PROTOCOL_KIND_LABEL: Record<KnownProtocol["kind"], string> = {
  system: "System object",
  dex: "DEX position",
  lending: "Lending deposit/borrow",
  amm: "Liquidity position",
  nft: "NFT collection",
  infra: "Infrastructure",
  game: "Game object",
  bridge: "Bridge",
  lst: "Liquid staking",
  vault: "Vault deposit",
  cdp: "Debt position (CDP)",
};

/** short display symbol of a coin type: `0x2::sui::SUI` → `SUI` */
function coinSymbol(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const parts = type.split("::");
  return parts.length >= 3 ? parts[parts.length - 1] : type;
}

function pairLabel(a: string | undefined, b: string | undefined): string | undefined {
  const sa = coinSymbol(a);
  const sb = coinSymbol(b);
  if (!sa || !sb) return undefined;
  return `${sa}/${sb}`;
}

function defiPositionInfo(
  facts: OnchainFacts,
  protocol: KnownProtocol
): { reason: string; canWithdraw: boolean; position?: WalletObject["position"] } | undefined {
  const parts = facts.type.split("::");
  const module = parts[1] ?? "";
  if (!POSITION_MODULES.has(module)) return undefined;

  const kindLabel = PROTOCOL_KIND_LABEL[protocol.kind] ?? "Позиция";
  const pair = pairLabel(facts.positionFields?.coinTypeA, facts.positionFields?.coinTypeB);
  const pairSuffix = pair ? ` (${pair})` : "";
  const reason = `${kindLabel} in ${protocol.name}${pairSuffix}. Withdrawal is not executed without your explicit confirmation.`;

  const position: WalletObject["position"] = {
    poolId: facts.positionFields?.poolId,
    coinTypeA: facts.positionFields?.coinTypeA,
    coinTypeB: facts.positionFields?.coinTypeB,
    liquidity: facts.positionFields?.liquidity,
  };

  // VERIFIED withdraw mechanisms (checked on-chain 2026-08-17):
  //   Cetus CLMM pool::remove_liquidity(&GlobalConfig, &mut Pool, &mut Position,
  //   u128 liquidity, &Clock) — requires the position to hold liquidity.
  const canWithdraw =
    protocol.name === "Cetus" &&
    module === "position" &&
    !!position.poolId &&
    (() => {
      try {
        return BigInt(position.liquidity ?? "0") > 0n;
      } catch {
        return false;
      }
    })();

  return { reason, canWithdraw, position };
}

/**
 * Spam-registry override: a package on the spam list forces SUSPICIOUS
 * (cursed tone + review warning), EXCEPT when a verified removal method
 * exists — then the object stays cleanable but keeps the cursed tone.
 * Protected objects are never overridden (safety first).
 */
function spamOverride(o: WalletObject, spam: boolean): WalletObject {
  if (!spam || o.protected) return o;
  if (o.cleanupAction) return { ...o, cursed: true };
  return {
    ...o,
    classification: "suspicious",
    cleanupAction: undefined,
    cursed: true,
    reason: "Package flagged in the spam registry. Review carefully — nothing will be touched.",
  };
}

/**
 * Dust threshold — a coin balance small enough that it is only clutter.
 * Value is NEVER destroyed: dust coins are merged (balance preserved) and the
 * emptied containers destroyed, so the exact threshold is a UX choice, not a
 * safety boundary.
 */
const DUST_FALLBACK_THRESHOLD = 10_000_000n; // ≈ 0.01 SUI @ 9 decimals, unknown token decimals

function isDustCoin(facts: OnchainFacts, balance: bigint): boolean {
  const inner = facts.type.match(/^0x2::coin::Coin<(.+)>$/)?.[1];
  const project = inner ? findProjectByCoinType(inner) : undefined;
  if (project?.decimals != null) {
    // below 0.01 whole token units (e.g. < 0.01 USDC)
    const threshold = 10n ** BigInt(Math.max(0, project.decimals - 2));
    return balance < threshold;
  }
  // unknown token decimals — conservative absolute threshold
  return balance < DUST_FALLBACK_THRESHOLD;
}

function keepObject(facts: OnchainFacts, via: string): WalletObject {
  return {
    objectId: facts.objectId,
    type: facts.type,
    category: facts.category,
    classification: "keep",
    protected: false,
    reason: `Verified: ${via}. Keep.`,
    name: facts.name ?? humanizeTypeName(facts.type),
    collection: facts.collection ?? "Unknown",
    package: facts.packageId,
  };
}

function shortType(type: string): string {
  const parts = type.split("::");
  return parts.length >= 3 ? parts[2] : type;
}

/**
 * Human-readable fallback names for well-known Sui system types, so the UI
 * shows "Staked SUI" instead of `0x2::staking_pool::StakedSui`. Display names
 * (when present) always win. This is presentation only — it never affects
 * classification or cleanup.
 */
const HUMAN_TYPE_NAMES: [RegExp, string][] = [
  [/^0x2::staking_pool::StakedSui$/, "Staked SUI"],
  [/^0x2::staking_pool::StakedSuiV2$/, "Staked SUI"],
  [/::kiosk::KioskOwnerCap$/, "Kiosk Owner Cap"],
  [/::kiosk::Kiosk$/, "Kiosk"],
  [/::transfer_policy::TransferPolicy$/, "Transfer Policy"],
  [/::treasury::TreasuryCap$/, "Treasury Cap"],
  [/::package::Publisher$/, "Publisher"],
  [/::display::Display$/, "Display"],
  [/::coin::CoinMetadata$/, "Coin Metadata"],
  [/::coin::Coin$/, "Coin"],
  [/::sui_system::State$/, "Sui System State"],
  [/::validator::Validator$/, "Validator"],
  [/::voting_escrow::Lock$/, "Voting Lock"],
  [/::dynamic_field::Field$/, "Dynamic Field"],
];

export function humanizeTypeName(type: string): string {
  for (const [re, label] of HUMAN_TYPE_NAMES) if (re.test(type)) return label;
  return shortType(type);
}

/**
 * A coin is KNOWN when its identity is confidently recognized (project
 * registry coin type / name, or a known protocol package). Unknown coins
 * with a balance are REVIEW — the balance is safe, the identity isn't.
 */
function isKnownCoin(facts: OnchainFacts): boolean {
  const inner = facts.type.match(/^0x2::coin::Coin<(.+)>$/)?.[1];
  if (inner && findProjectByCoinType(inner)) return true;
  if (facts.name && findProjectByName(facts.name)) return true;
  // The Coin module lives in package 0x2 for EVERY coin — the token's own
  // package is the inner type's package (0x2 for SUI, 0xdee9 for DEEP…).
  // Checking the outer package would mark every coin as "Sui System" → KEEP.
  if (inner) {
    const innerPkg = packageIdOfType(inner);
    if (findProtocolByPackage(innerPkg)) return true;
  }
  return false;
}

/* ---------------------------------- stats ---------------------------------- */

export interface ScanStats {
  total: number;
  keep: number;
  review: number;
  suspicious: number;
  cleanable: number;
  protected: number;
  /** keep objects with tone=bright (valuable) */
  valuable: number;
  /** keep objects with tone=stable (trusted) */
  trusted: number;
  byKind: { nft: number; token: number; object: number };
  estimatedValueUsd: number;
}

export function aggregateStats(objects: WalletObject[]): ScanStats {
  const stats: ScanStats = {
    total: objects.length,
    keep: 0,
    review: 0,
    suspicious: 0,
    cleanable: 0,
    protected: 0,
    valuable: 0,
    trusted: 0,
    byKind: { nft: 0, token: 0, object: 0 },
    estimatedValueUsd: 0,
  };
  for (const o of objects) {
    stats[o.classification] += 1;
    if (o.classification === "keep") {
      if (o.tone === "bright") stats.valuable += 1;
      else stats.trusted += 1;
    }
    if (o.category === "nft") stats.byKind.nft += 1;
    else if (o.category === "coin") stats.byKind.token += 1;
    else stats.byKind.object += 1;
    stats.estimatedValueUsd += o.value ?? 0;
  }
  return stats;
}

/**
 * Wallet condition 0..100. Derived deterministically from the scan result —
 * the more clutter and suspicion, the lower the score.
 */
export function walletCondition(stats: ScanStats): number {
  const raw = 100 - (stats.suspicious * 2 + stats.review + Math.floor(stats.cleanable / 6));
  return Math.max(25, Math.min(99, raw));
}
