/**
 * Token Metadata Resolver & Icon Store
 *
 * Fetches CoinMetadata (symbol, name, decimals, iconUrl) via Sui JSON-RPC & GraphQL,
 * provides verified preset icons for major Sui ecosystem tokens, and caches results
 * in localStorage for instant retrieval.
 */

import { proxyGraphql, proxyRpc } from "./proxyRpc";

const CACHE_KEY = "sui_cleaner_token_meta_v2";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedMeta {
  symbol: string;
  name: string;
  decimals: number;
  description?: string;
  iconUrl?: string;
  fetchedAt: number;
}

interface CacheStore {
  [coinType: string]: CachedMeta;
}

/** Fix IPFS URLs to use public gateway */
export function fixIpfsUrl(url: string | null | undefined): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith("ipfs://")) {
    return trimmed.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return undefined;
}

/** Built-in verified tokens dictionary with official high-res vector/CDN logos */
export const VERIFIED_TOKEN_LOGOS: Record<string, { symbol: string; name: string; decimals: number; iconUrl?: string }> = {
  "0x2::sui::SUI": {
    symbol: "SUI",
    name: "Sui",
    decimals: 9,
    iconUrl: "https://raw.githubusercontent.com/sui-foundation/sui-brand-assets/main/sui-logo-symbol-blue.svg",
  },
  "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN": {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    iconUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  },
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb845e24a14e5::coin::COIN": {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    iconUrl: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  },
  "0xaf8c7e973e28d6ed090d52f64483b8f6a43c499505c8e1372d5b1fc009416434::cetus::CETUS": {
    symbol: "CETUS",
    name: "Cetus Token",
    decimals: 9,
    iconUrl: "https://raw.githubusercontent.com/CetusProtocol/cetus-asset/main/cetus_icon.png",
  },
  "0xa99b8952d4f7d947ea77fe0ecdcc9e5fc0bcab2841d6e2a5aa00c3044e5544b5::navx::NAVX": {
    symbol: "NAVX",
    name: "NAVI Protocol Token",
    decimals: 9,
    iconUrl: "https://assets.coingecko.com/coins/images/34914/standard/NAVX.png",
  },
  "0x7016aae72cfc67f2fadf77259c6604702b843d0b8d2364d14d29a76805746f70::sca::SCA": {
    symbol: "SCA",
    name: "Scallop Token",
    decimals: 9,
    iconUrl: "https://assets.coingecko.com/coins/images/35848/standard/SCA.png",
  },
  "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP": {
    symbol: "DEEP",
    name: "DeepBook Token",
    decimals: 6,
    iconUrl: "https://assets.coingecko.com/coins/images/39908/standard/deep.png",
  },
  "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d::hasui::HASUI": {
    symbol: "haSUI",
    name: "Haedal Staked SUI",
    decimals: 9,
    iconUrl: "https://assets.coingecko.com/coins/images/30740/standard/haSUI.png",
  },
  "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT": {
    symbol: "vSUI",
    name: "Volo Staked SUI",
    decimals: 9,
    iconUrl: "https://assets.coingecko.com/coins/images/33098/standard/volo.png",
  },
  "0x83556891f4a0f233ce7b05cfe7f957d4020492a34f5405b2cb9377d060bef4bf::spring_sui::SPRING_SUI": {
    symbol: "sSUI",
    name: "SpringSui Staked SUI",
    decimals: 9,
    iconUrl: "https://assets.coingecko.com/coins/images/39714/standard/sSUI.png",
  },
  "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK": {
    symbol: "BUCK",
    name: "Bucket USD",
    decimals: 9,
    iconUrl: "https://assets.coingecko.com/coins/images/31333/standard/buck.png",
  },
  "0xfa7ac3951fd1476dd96e2026f7b61390ed99313378c9d8394600691f9336402f::blub::BLUB": {
    symbol: "BLUB",
    name: "BLUB",
    decimals: 2,
    iconUrl: "https://assets.coingecko.com/coins/images/38600/standard/blub.png",
  },
  "0x76cbdd38900357f08e0e4e450ed04100bed49a969df9941574763b632fa55459::fud::FUD": {
    symbol: "FUD",
    name: "FUD the Pug",
    decimals: 5,
    iconUrl: "https://assets.coingecko.com/coins/images/33948/standard/fud.png",
  },
  "0x356a26eb9e012a68958082340d4c4116e7f55615cfc87eb572fb593674686940::wal::WAL": {
    symbol: "WAL",
    name: "Walrus",
    decimals: 9,
    iconUrl: "https://assets.coingecko.com/coins/images/50014/standard/walrus.png",
  },
  "0x514a00195a6797a1532132d431c79a9cd8927958f278cbecefe027725979bbbb::ns::NS": {
    symbol: "NS",
    name: "SuiNS Token",
    decimals: 6,
    iconUrl: "https://assets.coingecko.com/coins/images/39000/standard/suins.png",
  },
};

/** Load the persistent cache from localStorage */
function loadCache(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheStore;
    const now = Date.now();
    const pruned: CacheStore = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (now - val.fetchedAt < CACHE_TTL_MS) {
        pruned[key] = val;
      }
    }
    return pruned;
  } catch {
    return {};
  }
}

/** Save the cache to localStorage */
function saveCache(store: CacheStore): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage unavailable or quota exceeded */
  }
}

const memoryCache = new Map<string, CachedMeta>();
const localStore = loadCache();
for (const [k, v] of Object.entries(localStore)) {
  memoryCache.set(k.toLowerCase(), v);
}

/**
 * Extract clean symbol and name from Move Coin type string.
 * Example: `0x4d2205d1...::osaIL::OSAIL` -> `oSAIL`
 * Example: `0x5d4b...::usdc::USDC` -> `USDC`
 * Example: `0x13eb...::token::NODO` -> `NODO`
 */
export function extractCoinSymbol(coinType: string): string {
  if (!coinType) return "TOKEN";
  const clean = coinType.trim().replace(/^0x2::coin::Coin<(.+)>$/i, "$1");
  
  // Check verified presets first
  for (const [verifiedType, info] of Object.entries(VERIFIED_TOKEN_LOGOS)) {
    if (clean.toLowerCase().includes(verifiedType.toLowerCase()) || clean.toLowerCase() === verifiedType.toLowerCase()) {
      return info.symbol;
    }
  }

  const parts = clean.split("::");
  if (parts.length >= 3) {
    const structName = parts[parts.length - 1];
    const moduleName = parts[parts.length - 2];
    if (/^(COIN|Coin|Token|TOKEN|T)$/i.test(structName)) {
      return moduleName.toUpperCase();
    }
    return structName;
  }
  return clean;
}

/**
 * Format raw balance string with token decimals into human-readable representation.
 * Example: "100163" with 6 decimals -> "0.100163"
 * Example: "930325065" with 9 decimals -> "0.930325"
 */
export function formatCoinBalance(rawUnits: string | undefined, decimals: number = 9): string {
  if (!rawUnits || rawUnits === "0") return "0";
  try {
    const raw = BigInt(rawUnits);
    if (raw === 0n) return "0";
    const div = 10n ** BigInt(Math.max(0, decimals));
    if (decimals === 0) return raw.toLocaleString("en-US");
    const whole = raw / div;
    const rem = raw % div;
    if (rem === 0n) return whole.toLocaleString("en-US");
    const remStr = rem.toString().padStart(decimals, "0").replace(/0+$/, "");
    const trimmedRem = remStr.slice(0, Math.min(6, remStr.length));
    return `${whole.toLocaleString("en-US")}.${trimmedRem}`;
  } catch {
    return rawUnits;
  }
}

/**
 * GraphQL query fallback for CoinMetadata
 */
const COIN_METADATA_QUERY = `query GetCoinMetadata($coinType: String!) {
  objects(filter: { type: $coinType }, first: 1) {
    nodes {
      address
      asMoveObject {
        contents {
          type { repr }
          json
        }
      }
    }
  }
}`;

interface SuiRpcCoinMetadata {
  decimals: number;
  name: string;
  symbol: string;
  description: string;
  iconUrl?: string | null;
  id?: string | null;
}

/**
 * Resolve metadata for a single coin type.
 * Uses verified presets -> persistent cache -> JSON-RPC suix_getCoinMetadata -> GraphQL.
 */
export async function resolveCoinMetadata(coinType: string): Promise<CachedMeta | null> {
  const normType = coinType.trim().replace(/^0x2::coin::Coin<(.+)>$/i, "$1");
  const key = normType.toLowerCase();

  // 1. Check verified presets
  if (VERIFIED_TOKEN_LOGOS[normType]) {
    const preset = VERIFIED_TOKEN_LOGOS[normType];
    const meta: CachedMeta = {
      symbol: preset.symbol,
      name: preset.name,
      decimals: preset.decimals,
      iconUrl: preset.iconUrl,
      fetchedAt: Date.now(),
    };
    memoryCache.set(key, meta);
    return meta;
  }

  // 2. Check cache
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }

  // 3. Try Sui JSON-RPC suix_getCoinMetadata (fastest and most direct)
  try {
    const rpcRes = await proxyRpc<SuiRpcCoinMetadata | null>("suix_getCoinMetadata", [normType]);
    if (rpcRes && typeof rpcRes === "object" && (rpcRes.symbol || rpcRes.name)) {
      const meta: CachedMeta = {
        symbol: rpcRes.symbol || extractCoinSymbol(normType),
        name: rpcRes.name || rpcRes.symbol || extractCoinSymbol(normType),
        decimals: typeof rpcRes.decimals === "number" ? rpcRes.decimals : 9,
        description: rpcRes.description || undefined,
        iconUrl: fixIpfsUrl(rpcRes.iconUrl),
        fetchedAt: Date.now(),
      };
      memoryCache.set(key, meta);
      localStore[normType] = meta;
      saveCache(localStore);
      return meta;
    }
  } catch {
    /* fallback to GraphQL */
  }

  // 4. Try GraphQL query
  try {
    const metaType = `0x2::coin::CoinMetadata<${normType}>`;
    const data = await proxyGraphql<{
      objects?: { nodes?: Array<{ asMoveObject?: { contents?: { json?: Record<string, unknown> } }; contents?: { json?: Record<string, unknown> } }> };
    }>(COIN_METADATA_QUERY, { coinType: metaType });

    const node = data?.objects?.nodes?.[0];
    const fields = (node?.asMoveObject?.contents?.json ?? node?.contents?.json) as Record<string, unknown> | undefined;
    if (fields && typeof fields === "object") {
      const symbol = typeof fields.symbol === "string" ? fields.symbol : extractCoinSymbol(normType);
      const name = typeof fields.name === "string" ? fields.name : symbol;
      const decimals = typeof fields.decimals === "number" ? fields.decimals : 9;
      const description = typeof fields.description === "string" ? fields.description : undefined;
      const iconUrl = fixIpfsUrl(typeof fields.icon_url === "string" ? fields.icon_url : undefined);

      const meta: CachedMeta = {
        symbol,
        name,
        decimals,
        description,
        iconUrl,
        fetchedAt: Date.now(),
      };
      memoryCache.set(key, meta);
      localStore[normType] = meta;
      saveCache(localStore);
      return meta;
    }
  } catch {
    /* fallback to extracted symbol */
  }

  // 5. Default fallback from type extraction
  const fallbackSymbol = extractCoinSymbol(normType);
  const fallbackMeta: CachedMeta = {
    symbol: fallbackSymbol,
    name: fallbackSymbol,
    decimals: 9,
    fetchedAt: Date.now(),
  };
  memoryCache.set(key, fallbackMeta);
  return fallbackMeta;
}

/**
 * Resolve metadata for multiple coin types in parallel.
 */
export async function resolveBatchMetadata(coinTypes: string[]): Promise<Map<string, CachedMeta>> {
  const result = new Map<string, CachedMeta>();
  const toFetch: string[] = [];

  for (const ct of coinTypes) {
    const norm = ct.trim().replace(/^0x2::coin::Coin<(.+)>$/i, "$1");
    const key = norm.toLowerCase();
    if (memoryCache.has(key)) {
      result.set(norm, memoryCache.get(key)!);
    } else {
      toFetch.push(norm);
    }
  }

  const CONCURRENCY = 10;
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((ct) => resolveCoinMetadata(ct)));
    for (let j = 0; j < settled.length; j++) {
      const res = settled[j];
      if (res.status === "fulfilled" && res.value) {
        result.set(batch[j], res.value);
      }
    }
  }

  return result;
}

/** Get cached metadata synchronously */
export function getCachedMetadata(coinType: string): CachedMeta | undefined {
  const norm = coinType.trim().replace(/^0x2::coin::Coin<(.+)>$/i, "$1").toLowerCase();
  return memoryCache.get(norm);
}

