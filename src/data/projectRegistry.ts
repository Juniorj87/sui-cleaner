/**
 * Project / collection identity registry.
 *
 * This registry exists so the wallet report can show a human-readable
 * identity ("USDC · Circle") instead of a raw Move type, and so the
 * classifier can tell KNOWN tokens from UNKNOWN ones (known + balance →
 * KEEP; unknown → REVIEW). It NEVER decides cleanup capabilities — those
 * come from the cleanup engine. Matching is deliberately conservative: an
 * item only gets an identity when it matches a known name / coin type /
 * package / collection.
 *
 * The registry can grow over time (new tokens, collections, protocols).
 */

export type ProjectKind = "token" | "nft" | "protocol" | "collection";

export interface ProjectIdentity {
  id: string;
  /** display name — "USDC", "Pixel Pudgy", "Navi Protocol" */
  name: string;
  /** token symbol / short mark — "USDC", "NAVX" */
  symbol?: string;
  /** issuer / operator — "Circle", "Navi Protocol" */
  issuer?: string;
  kind: ProjectKind;
  /** substring marks matched against the inner coin type, e.g. "::usdc::USDC" */
  coinTypeMarks?: string[];
  /** move package id prefixes, e.g. "0xdee9" (DeepBook) */
  packageIds?: string[];
  /** collection names (case-insensitive) for NFTs / objects */
  collectionNames?: string[];
  /** token decimals — only set when confidently known (mainnet), used to format balances */
  decimals?: number;
}

export const PROJECTS: ProjectIdentity[] = [
  // ---- tokens -------------------------------------------------------------
  {
    id: "sui",
    name: "Sui",
    symbol: "SUI",
    issuer: "Sui Network",
    kind: "token",
    coinTypeMarks: ["::sui::SUI"],
    packageIds: ["0x2"],
    decimals: 9,
  },
  {
    id: "usdc",
    name: "USDC",
    symbol: "USDC",
    issuer: "Circle",
    kind: "token",
    coinTypeMarks: ["::usdc::USDC", "::usdc::Coin", "5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"],
    packageIds: ["5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf"],
    decimals: 6,
  },
  {
    id: "usdt",
    name: "USDT",
    symbol: "USDT",
    issuer: "Tether",
    kind: "token",
    coinTypeMarks: ["::usdt::USDT", "dba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb845e24a14e5::coin::COIN"],
    packageIds: ["dba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb845e24a14e5"],
    decimals: 6,
  },
  {
    id: "weth",
    name: "WETH",
    symbol: "WETH",
    issuer: "Wrapped Ether",
    kind: "token",
    coinTypeMarks: ["::weth::WETH"],
    decimals: 8,
  },
  {
    id: "ausd",
    name: "AUSD",
    symbol: "AUSD",
    issuer: "Agora",
    kind: "token",
    coinTypeMarks: ["::ausd::AUSD"],
    decimals: 6,
  },
  {
    id: "deep",
    name: "DEEP",
    symbol: "DEEP",
    issuer: "DeepBook",
    kind: "token",
    coinTypeMarks: ["::deep::DEEP"],
  },
  {
    id: "sca",
    name: "SCA",
    symbol: "SCA",
    issuer: "Scallop",
    kind: "token",
    coinTypeMarks: ["::scallop::SCA", "::sca::SCA"],
  },
  {
    id: "navx",
    name: "NAVX",
    symbol: "NAVX",
    issuer: "Navi Protocol",
    kind: "token",
    coinTypeMarks: ["::navx::NAVX"],
  },
  {
    id: "blub",
    name: "BLUB",
    symbol: "BLUB",
    issuer: "Blub",
    kind: "token",
    coinTypeMarks: ["::blub::BLUB"],
  },
  {
    id: "cetus",
    name: "CETUS",
    symbol: "CETUS",
    issuer: "Cetus",
    kind: "token",
    coinTypeMarks: ["::cetus::CETUS", "::cetus::Coin"],
  },
  {
    id: "hype",
    name: "HYPE",
    symbol: "HYPE",
    issuer: "Hype",
    kind: "token",
    coinTypeMarks: ["::hype::HYPE"],
  },
  // ---- liquid staking tokens (LST) — value is never destroyed ---------------
  {
    id: "vsui",
    name: "Volo Staked SUI",
    symbol: "vSUI",
    issuer: "Volo",
    kind: "token",
    coinTypeMarks: ["::cert::CERT"],
    packageIds: ["0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55"],
  },
  {
    id: "hasui",
    name: "Haedal Staked SUI",
    symbol: "haSUI",
    issuer: "Haedal",
    kind: "token",
    coinTypeMarks: ["::hasui::HASUI"],
    packageIds: ["0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d"],
  },
  {
    id: "ssui",
    name: "SpringSui Staked SUI",
    symbol: "sSUI",
    issuer: "SpringSui",
    kind: "token",
    coinTypeMarks: ["::sui::sSUI", "::spring_sui::SPRING_SUI"],
    packageIds: [
      "0xb0575765166030556a6eafd3b1b970eba8183ff748860680245b9edd41c716e7",
      "0x83556891f4a0f233ce7b05cfe7f957d4020492a34f5405b2cb9377d060bef4bf",
    ],
  },
  {
    id: "buck",
    name: "BUCK",
    symbol: "BUCK",
    issuer: "Bucket Protocol",
    kind: "token",
    coinTypeMarks: ["::buck::BUCK"],
    packageIds: ["0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2"],
  },
  {
    id: "yolo",
    name: "YOLO",
    symbol: "YOLO",
    issuer: "YOLO",
    kind: "token",
    coinTypeMarks: ["::yolo::YOLO"],
  },

  // ---- real-world tokens discovered via mainnet wallet scans (Aug 2025) ----
  {
    id: "walrus",
    name: "Walrus",
    symbol: "WAL",
    issuer: "Walrus Protocol",
    kind: "token",
    coinTypeMarks: ["::wal::WAL", "356a26eb9e012a68958082340d4c4116e7f55615cf"],
  },
  {
    id: "deep_v2",
    name: "DEEP V2",
    symbol: "DEEP",
    issuer: "DeepBook V2",
    kind: "token",
    coinTypeMarks: ["::deepbook_v2::DEEP", "5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf"],
  },
  {
    id: "xbtc",
    name: "XBTC",
    symbol: "XBTC",
    issuer: "Wrapped Bitcoin",
    kind: "token",
    coinTypeMarks: ["::xbtc::XBTC", "dba34672e30cb065b1f93e3ab55318768fd6fef66c6ff00ee70c37ed9981194e"],
  },
  {
    id: "celer_usdc",
    name: "CELER USDC",
    symbol: "ceUSDC",
    issuer: "Celer Network",
    kind: "token",
    coinTypeMarks: ["::CELER_USDC_COIN", "::celer_usdc"],
  },
  {
    id: "ns_token",
    name: "SuiNS Token",
    symbol: "NS",
    issuer: "Sui Name Service",
    kind: "token",
    coinTypeMarks: ["::ns::NS"],
  },
  {
    id: "tesc",
    name: "TESC Coin",
    symbol: "TESC",
    issuer: "Unknown",
    kind: "token",
    coinTypeMarks: ["::coin::TESC_COIN", "::tesc::TESC"],
  },
  // ---- additional Sui ecosystem tokens (mainnet verified) ------------------
  {
    id: "wbtc",
    name: "Wrapped Bitcoin",
    symbol: "WBTC",
    issuer: "Wormhole",
    kind: "token",
    coinTypeMarks: ["::wbtc::WBTC"],
    decimals: 8,
  },
  {
    id: "wbnb",
    name: "Wrapped BNB",
    symbol: "WBNB",
    issuer: "Wormhole",
    kind: "token",
    coinTypeMarks: ["::wbnb::WBNB"],
    decimals: 8,
  },
  {
    id: "cake",
    name: "PancakeSwap Token",
    symbol: "CAKE",
    issuer: "PancakeSwap",
    kind: "token",
    coinTypeMarks: ["::cake::CAKE"],
    decimals: 18,
  },
  {
    id: "sushiswap",
    name: "SushiToken",
    symbol: "SUSHI",
    issuer: "SushiSwap",
    kind: "token",
    coinTypeMarks: ["::sushi::SUSHI"],
    decimals: 18,
  },
  {
    id: "turbos",
    name: "Turbos Token",
    symbol: "TURBOS",
    issuer: "Turbos Finance",
    kind: "token",
    coinTypeMarks: ["::turbos::TURBOS"],
  },
  {
    id: "suiswap",
    name: "SuiSwap Token",
    symbol: "SSWP",
    issuer: "SuiSwap",
    kind: "token",
    coinTypeMarks: ["::sswp::SSWP"],
  },
  {
    id: "deepbook_v2",
    name: "DEEP V2",
    symbol: "DEEP",
    issuer: "DeepBook V2",
    kind: "token",
    coinTypeMarks: ["::deepbook_v2::DEEP"],
  },
  {
    id: "wald",
    name: "Walrus Token",
    symbol: "WALD",
    issuer: "Walrus",
    kind: "token",
    coinTypeMarks: ["::wald::WALD"],
  },
  {
    id: "wal",
    name: "Walrus",
    symbol: "WAL",
    issuer: "Walrus Protocol",
    kind: "token",
    coinTypeMarks: ["::wal::WAL"],
  },
  {
    id: "bucket_buck",
    name: "BUCK Stablecoin",
    symbol: "BUCK",
    issuer: "Bucket Protocol",
    kind: "token",
    coinTypeMarks: ["::bucket::BUCK"],
    decimals: 9,
  },
  {
    id: "mist",
    name: "MIST",
    symbol: "MIST",
    issuer: "Sui Network",
    kind: "token",
    coinTypeMarks: ["::mist::MIST"],
    decimals: 9,
  },
  {
    id: "hippo",
    name: "Hippo Token",
    symbol: "HIPPO",
    issuer: "Hippo Aggregator",
    kind: "token",
    coinTypeMarks: ["::hippo::HIPPO"],
  },
  {
    id: "suia",
    name: "Suia Token",
    symbol: "SUIA",
    issuer: "Suia",
    kind: "token",
    coinTypeMarks: ["::suia::SUIA"],
  },
  {
    id: "movedao",
    name: "MoveDAO Token",
    symbol: "MOVEDAO",
    issuer: "MoveDAO",
    kind: "token",
    coinTypeMarks: ["::movedao::MOVEDAO"],
  },
  {
    id: "sui_names",
    name: "Sui Names Token",
    symbol: "SNS",
    issuer: "Sui Name Service",
    kind: "token",
    coinTypeMarks: ["::suins::SNS", "::sui_names::SNS"],
  },
  {
    id: "clmm_usdc",
    name: "USDC (CLMM)",
    symbol: "USDC",
    issuer: "Circle",
    kind: "token",
    coinTypeMarks: ["::usdc_clmm::USDC"],
    decimals: 6,
  },
  {
    id: "clmm_usdt",
    name: "USDT (CLMM)",
    symbol: "USDT",
    issuer: "Tether",
    kind: "token",
    coinTypeMarks: ["::usdt::USDT", "::usdt_clmm::USDT"],
    decimals: 6,
  },
  // ---- ecosystem tokens requested in task 12 (REAL not spam) --------------
  { id: "lofi", name: "LOFI", symbol: "LOFI", issuer: "LOFI", kind: "token", coinTypeMarks: ["::lofi::LOFI"] },
  { id: "fud", name: "FUD", symbol: "FUD", issuer: "FUD", kind: "token", coinTypeMarks: ["::fud::FUD"] },
  { id: "alchemy", name: "Alchemy", symbol: "ALCHEMY", issuer: "Alchemy", kind: "token", coinTypeMarks: ["::alchemy::ALCHEMY"] },
  { id: "tism", name: "TISM", symbol: "TISM", issuer: "TISM", kind: "token", coinTypeMarks: ["::tism::TISM"] },
  { id: "ika", name: "IKA", symbol: "IKA", issuer: "IKA", kind: "token", coinTypeMarks: ["::ika::IKA"] },
  { id: "wewal", name: "WEWAL", symbol: "WEWAL", issuer: "Wewal", kind: "token", coinTypeMarks: ["::wewal::WEWAL"] },
  { id: "larva", name: "LARVA", symbol: "LARVA", issuer: "Larva", kind: "token", coinTypeMarks: ["::larva::LARVA"] },
  { id: "msend", name: "MSEND", symbol: "MSEND", issuer: "MSEND", kind: "token", coinTypeMarks: ["::msend::MSEND"] },
  { id: "kdx", name: "KDX", symbol: "KDX", issuer: "KDX", kind: "token", coinTypeMarks: ["::kdx::KDX"] },
  { id: "bubble", name: "BUBBLE", symbol: "BUBBLE", issuer: "Bubble", kind: "token", coinTypeMarks: ["::bubble::BUBBLE"] },
  { id: "manifest", name: "MANIFEST", symbol: "MANIFEST", issuer: "Manifest", kind: "token", coinTypeMarks: ["::manifest::MANIFEST"] },
  { id: "axol", name: "AXOL", symbol: "AXOL", issuer: "Axol", kind: "token", coinTypeMarks: ["::axol::AXOL"] },
  { id: "wewall", name: "WEWALL", symbol: "WEWALL", issuer: "Wewal", kind: "token", coinTypeMarks: ["::wewall::WEWALL"] },
  { id: "aqua", name: "AQUA", symbol: "AQUA", issuer: "Aqua", kind: "token", coinTypeMarks: ["::aqua::AQUA"] },
  { id: "spark", name: "SPARK", symbol: "SPARK", issuer: "Spark", kind: "token", coinTypeMarks: ["::spark::SPARK"] },
  { id: "studio", name: "STUDIO", symbol: "STUDIO", issuer: "Studio", kind: "token", coinTypeMarks: ["::studio::STUDIO"] },
  { id: "coin_coin", name: "COIN", symbol: "COIN", issuer: "Coin", kind: "token", coinTypeMarks: ["::coin::COIN"] },
  // DeepBook WAL already covered but ensure WAL variants
  { id: "wal_turbos", name: "WAL (Turbos)", symbol: "WAL", issuer: "Walrus", kind: "token", coinTypeMarks: ["::wal_turbos::WAL"] },

  // ---- protocols -----------------------------------------------------------
  {
    id: "deepbook",
    name: "DeepBook",
    symbol: "DEEP",
    issuer: "DeepBook",
    kind: "protocol",
    packageIds: ["0xdee9"],
    collectionNames: ["deepbook"],
  },
  {
    id: "navi",
    name: "Navi Protocol",
    symbol: "NAVI",
    issuer: "Navi",
    kind: "protocol",
    packageIds: ["0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0"],
    collectionNames: ["navi", "navi capy"],
  },
  {
    id: "scallop",
    name: "Scallop",
    symbol: "SCA",
    issuer: "Scallop",
    kind: "protocol",
    packageIds: [
      "0xd971609b7feb6230585831e7aeb3c121fb21b9431337a30fc99185eb459a05ee",
      // Scallop core (redeem/market/reserve) — sCoins live here
      "0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf",
    ],
    collectionNames: ["scallop"],
  },
  {
    id: "scallop-scoin",
    name: "Scallop sCoin",
    symbol: "sCOIN",
    issuer: "Scallop",
    kind: "token",
    coinTypeMarks: ["::reserve::MarketCoin<"],
  },
  {
    id: "cetus",
    name: "Cetus",
    symbol: "CETUS",
    issuer: "Cetus",
    kind: "protocol",
    packageIds: [
      "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb",
      "0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f",
    ],
    collectionNames: ["cetus"],
  },
  {
    id: "suins",
    name: "SuiNS",
    symbol: "SNS",
    issuer: "Sui Name Service",
    kind: "protocol",
    collectionNames: ["suins", "sui ns", "sui name service"],
  },
  {
    id: "kiosk",
    name: "Kiosk",
    symbol: "KIOSK",
    issuer: "Kiosk",
    kind: "protocol",
    collectionNames: ["kiosk"],
  },
  {
    id: "sui-staking",
    name: "Sui Staking",
    symbol: "STK",
    issuer: "Sui Network",
    kind: "protocol",
    collectionNames: ["sui staking", "staking"],
  },

  // ---- NFT collections -----------------------------------------------------
  {
    id: "suifrens",
    name: "SuiFrens",
    symbol: "SF",
    issuer: "SuiFrens",
    kind: "collection",
    packageIds: ["0xee496a0cc04d06a345982ba6697c90c619020de9e274408c7819f787ff66e1a1"],
    collectionNames: ["suifrens"],
  },
  {
    id: "turbos",
    name: "Turbos",
    symbol: "TURBOS",
    issuer: "Turbos Finance",
    kind: "protocol",
    packageIds: ["0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1"],
    collectionNames: ["turbos"],
  },
  {
    id: "suilend",
    name: "Suilend",
    symbol: "SLND",
    issuer: "Suilend",
    kind: "protocol",
    packageIds: ["0xf95b06141ed4a174f239417323bde3f209b972f5930d8521ea38a52aff3a6ddf"],
    collectionNames: ["suilend"],
  },
  {
    id: "volo",
    name: "Volo",
    symbol: "VSUI",
    issuer: "Volo",
    kind: "protocol",
    packageIds: ["0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55"],
    collectionNames: ["volo"],
  },
  {
    id: "haedal",
    name: "Haedal",
    symbol: "HA",
    issuer: "Haedal",
    kind: "protocol",
    packageIds: [
      "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d",
      "0xc4ebf35be1478318d78c324342854dd2735a036139373a9d41a1aa3a46a01d05",
      "0xfbc91f75397ce25b3b1b01cab2bf494d2e3f9b9e89c97545d88bd616cbbfcc37",
    ],
    collectionNames: ["haedal"],
  },
  {
    id: "springsui",
    name: "SpringSui",
    symbol: "SSUI",
    issuer: "SpringSui",
    kind: "protocol",
    packageIds: [
      "0xb0575765166030556a6eafd3b1b970eba8183ff748860680245b9edd41c716e7",
      "0x83556891f4a0f233ce7b05cfe7f957d4020492a34f5405b2cb9377d060bef4bf",
    ],
    collectionNames: ["springsui", "spring sui"],
  },
  {
    id: "alphafi",
    name: "AlphaFi",
    symbol: "ALPHA",
    issuer: "AlphaFi",
    kind: "protocol",
    packageIds: ["0x79729faced2e6294254e555424184f71c8c043a1dbe3447b88613704a7276710"],
    collectionNames: ["alphafi", "alpha fi"],
  },
  {
    id: "bucket",
    name: "Bucket",
    symbol: "BUCK",
    issuer: "Bucket Protocol",
    kind: "protocol",
    packageIds: ["0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2"],
    collectionNames: ["bucket"],
  },
  {
    id: "pixel-pudgy",
    name: "Pixel Pudgy",
    symbol: "PP",
    issuer: "Pixel Pudgy",
    kind: "collection",
    collectionNames: ["pixel pudgy"],
  },
  {
    id: "navi-capy",
    name: "Navi Capy",
    symbol: "NC",
    issuer: "Navi Capy",
    kind: "collection",
    collectionNames: ["navi capy"],
  },
  {
    id: "aurora-bot",
    name: "Aurora Bot",
    symbol: "AB",
    issuer: "Aurora Bot",
    kind: "collection",
    collectionNames: ["aurora bot"],
  },
  {
    id: "mystic-orbit",
    name: "Mystic Orbit",
    symbol: "MO",
    issuer: "Mystic Orbit",
    kind: "collection",
    collectionNames: ["mystic orbit"],
  },
  {
    id: "fractal-dunes",
    name: "Fractal Dunes",
    symbol: "FD",
    issuer: "Fractal Dunes",
    kind: "collection",
    collectionNames: ["fractal dunes"],
  },
  {
    id: "neon-koi",
    name: "Neon Koi",
    symbol: "NK",
    issuer: "Neon Koi",
    kind: "collection",
    collectionNames: ["neon koi"],
  },
  {
    id: "ghost-protocol",
    name: "Ghost Protocol",
    symbol: "GP",
    issuer: "Ghost Protocol",
    kind: "collection",
    collectionNames: ["ghost protocol"],
  },
  {
    id: "lava-lamps",
    name: "Lava Lamps",
    symbol: "LL",
    issuer: "Lava Lamps",
    kind: "collection",
    collectionNames: ["lava lamps"],
  },
  {
    id: "mono-tokyo",
    name: "Mono Tokyo",
    symbol: "MT",
    issuer: "Mono Tokyo",
    kind: "collection",
    collectionNames: ["mono tokyo"],
  },
  {
    id: "stellar-drift",
    name: "Stellar Drift",
    symbol: "SD",
    issuer: "Stellar Drift",
    kind: "collection",
    collectionNames: ["stellar drift"],
  },
  {
    id: "wav3d",
    name: "Wav3d",
    symbol: "WV",
    issuer: "Wav3d",
    kind: "collection",
    collectionNames: ["wav3d"],
  },
  {
    id: "kelp-game",
    name: "Kelp Game",
    symbol: "KG",
    issuer: "Kelp Game",
    kind: "collection",
    collectionNames: ["kelp game"],
  },
];

/* ------------------------------ lookups ----------------------------------- */

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** match by symbol or name (demo objects carry the token symbol as name) */
export function findProjectByName(name: string): ProjectIdentity | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return PROJECTS.find(
    (p) => (p.symbol && norm(p.symbol) === n) || norm(p.name) === n || (p.issuer && norm(p.issuer) === n)
  );
}

/** match by the inner coin type (`0x…::usdc::USDC`) */
export function findProjectByCoinType(innerType: string): ProjectIdentity | undefined {
  const t = norm(innerType);
  if (!t) return undefined;
  return PROJECTS.find((p) => (p.coinTypeMarks ?? []).some((m) => t.includes(norm(m))));
}

/** match by move package id prefix */
export function findProjectByPackage(packageId: string): ProjectIdentity | undefined {
  const p = norm(packageId);
  if (!p) return undefined;
  return PROJECTS.find((proj) => (proj.packageIds ?? []).some((id) => p.startsWith(norm(id))));
}

/** match by collection name */
export function findProjectByCollection(collection: string): ProjectIdentity | undefined {
  const c = norm(collection);
  if (!c) return undefined;
  return PROJECTS.find((p) => (p.collectionNames ?? []).some((n) => c.includes(norm(n))));
}

/** the display mark shown inside the icon — symbol initials or name initials */
export function projectMark(identity: ProjectIdentity | undefined, name: string): string {
  if (identity?.symbol && identity.symbol.length > 0) {
    return identity.symbol.slice(0, 2).toUpperCase();
  }
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
