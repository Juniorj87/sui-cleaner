/**
 * Portfolio types — DeFi protocols, NFT collections, and asset filtering.
 *
 * Used by PortfolioPanel and the /api/ai/portfolio endpoint to display
 * a unified view of wallet assets categorized as real, test, or spam.
 */

export type AssetCategory = "real" | "test" | "spam" | "unknown";
export type NftCategory = "verified" | "unverified";

export type ProtocolName =
  | "Suilend"
  | "Scallop"
  | "Haedal"
  | "Volo"
  | "Momentum"
  | "DeepTrade"
  | "Yield"
  | "Navi"
  | "Other";

export interface TokenAsset {
  symbol: string;
  name: string;
  /** Balance in SUI or base units */
  balance: number;
  usdValue: number;
  /** USD price per whole token, null when unknown (shows $—) */
  price?: number | null;
  /** true when price is known from CoinGecko, false → $— */
  priceKnown?: boolean;
  category: AssetCategory;
  protocol?: ProtocolName;
  isLp: boolean;
  /** On-chain icon URL from suix_getCoinMetadata */
  iconUrl?: string | null;
  /** Token decimals (default 9 for SUI) */
  decimals?: number;
  /** Full on-chain coin type (e.g. 0x2::sui::SUI) for matching against wallet objects */
  coinType?: string;
  /** First Coin objectId for this coinType (used for ADD TO CLEANUP real linkage) */
  objectId?: string | null;
  /** marks the gas coin — never selectable for destructive cleanup */
  isGasCoin?: boolean;
  protected?: boolean;
  keeper?: boolean;
  isDust?: boolean;
}

export interface NftAsset {
  name: string;
  collection: string;
  category: NftCategory;
  imageUrl: string;
  tokenId: string;
  /**
   * Real last recorded sale price in SUI from the upstream provider
   * (Blockberry `latestPrice`, when configured). Null when unknown —
   * the UI renders "Price —" and never invents a price.
   */
  lastSaleSui?: number | null;
  /** true only when lastSaleSui holds a real provider value */
  lastSaleKnown?: boolean;
}

/** Format a known SUI amount compactly (2.5 → "2.5", 0.042 → "0.042"). */
export function formatSuiAmount(value: number): string {
  if (!isFinite(value) || value <= 0) return "—";
  const rounded = Math.round(value * 10000) / 10000;
  return String(rounded);
}

export interface PortfolioData {
  tokens: TokenAsset[];
  nfts: NftAsset[];
  /** SuiNS name for the address, if resolved */
  suiNsName?: string;
  /** Data source: "blockberry" or "rpc" */
  source?: string;
  updatedAt: number;
}
