// Demo dataset for the Sui Cleaner design exploration.
// Everything here is fictional demo data — no blockchain involved.

export type Kind = "NFT" | "TOKEN" | "OBJECT";
export type Status = "VALUABLE" | "TRUSTED" | "UNKNOWN" | "SUSPICIOUS" | "PROTECTED";

export interface WalletObject {
  id: string;
  name: string;
  kind: Kind;
  status: Status;
  cleanable: boolean;
  collection: string;
  package: string;
  value?: number; // estimated USD value (demo)
  note: string;
  /** the excavation finds a cursed artifact — marked for the altar */
  cursed?: boolean;
  /** zero-balance coins are EMPTY COIN OBJECTS — the exact "AUSD 0 balance"
   *  case the product explains. Demo HYPE/YOLO exercise that UX. */
  coinBalance?: string;
}

// Deterministic PRNG so addresses are stable between reloads / HMR.
let seed = 1337;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function hexPkg(): string {
  let s = "0x";
  for (let i = 0; i < 20; i++) s += "0123456789abcdef"[Math.floor(rnd() * 16)];
  return s;
}

function obj(
  id: string,
  name: string,
  kind: Kind,
  status: Status,
  cleanable: boolean,
  collection: string,
  note: string,
  value?: number,
  cursed?: boolean,
  coinBalance?: string
): WalletObject {
  return { id, name, kind, status, cleanable, collection, package: hexPkg(), value, note, cursed, coinBalance };
}

export const OBJECTS: WalletObject[] = [
  // ---- VALUABLE (14) -------------------------------------------------------
  obj("o01", "SUI", "TOKEN", "VALUABLE", false, "Sui Network", "Native gas token", 296),
  obj("o02", "USDC", "TOKEN", "VALUABLE", false, "Circle", "Stablecoin", 450),
  obj("o03", "WETH", "TOKEN", "VALUABLE", false, "Wrapped Ether", "Wrapped ETH", 180),
  obj("o04", "AUSD", "TOKEN", "VALUABLE", false, "Agora", "Stablecoin", 120),
  obj("o05", "DEEP", "TOKEN", "VALUABLE", false, "DeepBook", "DEX liquidity", 40),
  obj("o06", "SCA", "TOKEN", "VALUABLE", false, "Scallop", "Lending protocol", 30),
  obj("o07", "NAVX", "TOKEN", "VALUABLE", false, "Navi Protocol", "Lending protocol", 25),
  obj("o08", "alex.sui", "TOKEN", "VALUABLE", false, "SuiNS", "Name service", 35),
  obj("o09", "SuiFrens Capybara", "NFT", "VALUABLE", false, "SuiFrens", "Verified collection", 60),
  obj("o10", "Navi Capy #1024", "NFT", "VALUABLE", false, "Navi Capy", "Verified collection", 28),
  obj("o11", "Aurora Bot", "NFT", "VALUABLE", false, "Aurora Bot", "Verified collection", 12),
  obj("o12", "Mystic Orbit #7", "NFT", "VALUABLE", false, "Mystic Orbit", "Verified collection", 8),
  obj("o13", "Fractal Dunes", "NFT", "VALUABLE", false, "Fractal Dunes", "Verified collection", 6),
  obj("o14", "Neon Koi", "NFT", "VALUABLE", false, "Neon Koi", "Verified collection"),

  // ---- TRUSTED (3) ---------------------------------------------------------
  obj("o15", "BLUB", "TOKEN", "TRUSTED", false, "Blub", "Verified memecoin"),
  obj("o16", "CETUS", "TOKEN", "TRUSTED", false, "Cetus", "Verified DEX"),
  obj("o17", "SuiFrens Access Pass", "OBJECT", "TRUSTED", false, "SuiFrens", "Verified access pass"),

  // ---- UNKNOWN, not cleanable (8) ------------------------------------------
  obj("o18", "Airdrop Claim Ticket", "OBJECT", "UNKNOWN", false, "—", "Not claimable yet"),
  obj("o19", "Beta Access Key", "OBJECT", "UNKNOWN", false, "—", "No contract on-chain"),
  obj("o20", "Kelp Sword", "NFT", "UNKNOWN", false, "Kelp Game", "In-game item, locked"),
  obj("o21", "Loyalty Card", "OBJECT", "UNKNOWN", false, "Merchant Club", "Used in stores"),
  obj("o22", "Mystery Box", "OBJECT", "UNKNOWN", false, "Loot", "Opens in 2026"),
  obj("o23", "Event Ticket 2024", "OBJECT", "UNKNOWN", false, "Sui Summit", "Past event, kept"),
  obj("o24", "Community Pass", "OBJECT", "UNKNOWN", false, "DAO", "Membership pass"),
  obj("o25", "Referral Badge", "OBJECT", "UNKNOWN", false, "—", "Earned badge"),

  // ---- UNKNOWN, cleanable (11) — 9 NFT + 2 TOKEN ----------------------------
  obj("o26", "Pixel Pudgy #7", "NFT", "UNKNOWN", true, "Pixel Pudgy", "Minted 3 weeks ago"),
  obj("o27", "Ghost Protocol", "NFT", "UNKNOWN", true, "Ghost Protocol", "No transfers"),
  obj("o28", "Lava Lamp #13", "NFT", "UNKNOWN", true, "Lava Lamps", "Mint dust"),
  obj("o29", "Mono Tokyo", "NFT", "UNKNOWN", true, "Mono Tokyo", "Airdrop, never opened"),
  obj("o30", "Stellar Drift", "NFT", "UNKNOWN", true, "Stellar Drift", "Mint dust"),
  obj("o31", "Wav3d", "NFT", "UNKNOWN", true, "Wav3d", "Free mint"),
  obj("o32", "Super Rare Drop", "NFT", "UNKNOWN", true, "—", "Unverified collection"),
  obj("o33", "Winter Giveaway", "NFT", "UNKNOWN", true, "—", "Unverified collection"),
  obj("o34", "Mini Mint #1", "NFT", "UNKNOWN", true, "—", "Unverified collection"),
  // Empty coin objects — the balance was spent, only the empty on-chain coin
  // object remains. Removing it never destroys token value.
  obj("o35", "HYPE", "TOKEN", "UNKNOWN", true, "Hype", "Balance spent — only the empty coin object remains.", undefined, false, "0"),
  obj("o36", "YOLO", "TOKEN", "UNKNOWN", true, "YOLO", "Balance spent — only the empty coin object remains.", undefined, false, "0"),

  // ---- SUSPICIOUS (8) — 7 NFT + 1 TOKEN, all cleanable ----------------------
  obj("o37", "Gift NFT", "NFT", "SUSPICIOUS", true, "Unknown", "Suspicious contract, no transfers"),
  obj("o38", "Phishing Pass", "NFT", "SUSPICIOUS", true, "Unknown", "Likely phishing airdrop"),
  obj("o39", "SPAM-69420", "NFT", "SUSPICIOUS", true, "Unknown", "Bulk minted, spam pattern. The cursed artifact.", 0, true),
  obj("o40", "Fake Reward Voucher", "NFT", "SUSPICIOUS", true, "Unknown", "Claims link to external site"),
  obj("o41", "Unverified Drop", "NFT", "SUSPICIOUS", true, "Unknown", "No verified creator"),
  obj("o42", "Junk Collectible", "NFT", "SUSPICIOUS", true, "Unknown", "Zero value, zero transfers"),
  obj("o43", "Scam Mint", "NFT", "SUSPICIOUS", true, "Unknown", "Minted by flagged address"),
  obj("o44", "Drainer Token", "TOKEN", "SUSPICIOUS", true, "Unknown", "Contract flagged as drainer"),

  // ---- PROTECTED (3) ---------------------------------------------------------
  obj("o45", "Staked SUI", "OBJECT", "PROTECTED", false, "Sui Staking", "Locked in staking"),
  obj("o46", "Kiosk Owner Cap", "OBJECT", "PROTECTED", false, "Kiosk", "Required to manage kiosk"),
  obj("o47", "Cold Storage Vault", "OBJECT", "PROTECTED", false, "—", "Multisig vault"),
];

export const ESTIMATED_VALUE_USD = 1290;

export function shortAddr(pkg: string): string {
  return `${pkg.slice(0, 6)}…${pkg.slice(-4)}`;
}

export const COUNT_BY_STATUS: Record<Status, number> = {
  VALUABLE: OBJECTS.filter((o) => o.status === "VALUABLE").length,
  TRUSTED: OBJECTS.filter((o) => o.status === "TRUSTED").length,
  UNKNOWN: OBJECTS.filter((o) => o.status === "UNKNOWN" || o.status === "SUSPICIOUS").length,
  SUSPICIOUS: OBJECTS.filter((o) => o.status === "SUSPICIOUS").length,
  PROTECTED: OBJECTS.filter((o) => o.status === "PROTECTED").length,
};

export const CLEANABLE_COUNT = OBJECTS.filter((o) => o.cleanable).length;
