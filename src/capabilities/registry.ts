/**
 * UNIFIED CAPABILITY REGISTRY
 *
 * Every cleanup mechanism is registered here as a Capability. The registry
 * is the single source of truth for:
 *   - What actions exist (destroy, merge, burn, withdraw, swap, unstake)
 *   - Which protocols are supported (Cetus, Scallop, SpringSui, Navi, …)
 *   - What verification level each capability has
 *   - Which network-specific package IDs to use
 *   - Which UI zone each capability maps to
 *
 * RULE: a capability only appears in the production UI when its
 * verification level meets the zone's minimum requirement:
 *
 *   CLEAN zone    → requires TESTNET_VERIFIED or POST_TX_VERIFIED
 *   SWEEP zone    → requires TESTNET_VERIFIED or POST_TX_VERIFIED
 *   RECOVER zone  → requires TESTNET_VERIFIED or POST_TX_VERIFIED
 *   REVIEW zone   → shows all detected capabilities (any level)
 *
 * RULE: never use "PRODUCTION READY" until ALL mandatory checks pass.
 */

import { getNetwork } from "../config";

// ─── Types ──────────────────────────────────────────────────────────────

export type CapabilityAction =
  | "destroy_zero"    // remove empty coin objects
  | "merge"           // merge dust coins
  | "burn"            // transfer to 0x0 (NFT/object)
  | "withdraw"        // DeFi position withdrawal
  | "unstake"         // LST unstaking
  | "swap"            // token → SUI conversion
  | "sweep_to_sui";   // combined: withdraw + swap + consolidate

export type CapabilityZone = "clean" | "sweep_to_sui" | "recover" | "review";

export type VerificationLevel =
  | "UNSUPPORTED"           // mechanism not implemented
  | "CODE_ONLY"             // code exists but not tested
  | "DRY_RUN_VERIFIED"      // dry-run succeeds
  | "TESTNET_VERIFIED"      // testnet tx + post-TX verification passed
  | "MAINNET_VERIFIED"      // mainnet tx + post-TX verification passed
  | "POST_TX_VERIFIED";     // full post-TX verification passed

/** Network-specific package address */
export interface NetworkPackage {
  mainnet: string;
  testnet?: string;  // undefined = not deployed on testnet
}

/** A cleanup capability — the atomic unit of what the Cleaner can do */
export interface Capability {
  /** unique identifier (e.g. "cetus_withdraw", "destroy_zero") */
  id: string;
  /** human-readable label */
  label: string;
  /** what action type this capability performs */
  action: CapabilityAction;
  /** which protocol this capability belongs to (or "sui" for framework) */
  protocol: string;
  /** which UI zone this capability maps to */
  zone: CapabilityZone;
  /** current verification level */
  level: VerificationLevel;
  /** network-aware package IDs (undefined = framework, no external package) */
  packages?: {
    /** the main entry point package */
    entry?: NetworkPackage;
    /** shared objects required by the entry point */
    shared?: Record<string, NetworkPackage>;
  };
  /** the Move entry point target (e.g. "0x2::coin::destroy_zero") */
  entryPoint: string;
  /** type arguments required (if any) — resolved at runtime */
  typeArgs?: string[];
  /** human-readable description of what this capability does */
  description: string;
  /** if blocked: specific reason why testnet/mainnet verification cannot be completed */
  blockReason?: string;
  /** capabilities that must run before this one (dependency order) */
  dependsOn?: string[];
  /** capabilities that this capability produces (e.g. withdraw produces swap candidates) */
  produces?: string[];
}

// ─── Network-aware resolution ──────────────────────────────────────────

/**
 * Resolve the package address for a NetworkPackage on the current network.
 * Returns mainnet address when on mainnet, testnet address when on testnet.
 * Falls back to mainnet if testnet address is not available.
 */
export function resolvePackageAddress(np: NetworkPackage): string {
  const network = getNetwork();
  if (network === "testnet" && np.testnet) return np.testnet;
  return np.mainnet;
}

/**
 * Check if a capability is available on the current network.
 * A capability is available if its package IDs resolve to real addresses.
 */
export function isCapabilityAvailableOnNetwork(cap: Capability): boolean {
  if (!cap.packages) return true; // framework capabilities always available
  const network = getNetwork();

  if (cap.packages.entry) {
    if (network === "testnet" && !cap.packages.entry.testnet) return false;
  }
  if (cap.packages.shared) {
    for (const obj of Object.values(cap.packages.shared)) {
      if (network === "testnet" && !obj.testnet) return false;
    }
  }
  return true;
}

// ─── Capability Registry ───────────────────────────────────────────────

const CAPABILITIES: Capability[] = [
  // ═════════════════════════════════════════════════════════════════════
  // CLEAN ZONE — framework capabilities (always available, all networks)
  // ═════════════════════════════════════════════════════════════════════

  {
    id: "destroy_zero",
    label: "Destroy empty coin",
    action: "destroy_zero",
    protocol: "sui",
    zone: "clean",
    level: "POST_TX_VERIFIED",
    entryPoint: "0x2::coin::destroy_zero",
    description: "Remove zero-balance Coin<T> objects. Framework entry point — same on all networks.",
  },
  {
    id: "merge_dust",
    label: "Merge dust coins",
    action: "merge",
    protocol: "sui",
    zone: "clean",
    level: "POST_TX_VERIFIED",
    entryPoint: "0x2::coin::merge",
    description: "Merge multiple small-balance coins of the same type. Balance preserved in wallet.",
  },
  {
    id: "burn_transfer_to_0x0",
    label: "Remove NFT (transfer to 0x0)",
    action: "burn",
    protocol: "sui",
    zone: "clean",
    level: "POST_TX_VERIFIED",
    entryPoint: "0x2::transfer::transfer",
    description: "Transfer object to the 0x0 burn address. Storage rebate NOT returned.",
  },

  // ═════════════════════════════════════════════════════════════════════
  // SWEEP TO SUI ZONE — token → SUI conversion
  // ═════════════════════════════════════════════════════════════════════

  {
    id: "cetus_swap",
    label: "Swap to SUI (Cetus)",
    action: "swap",
    protocol: "Cetus",
    zone: "sweep_to_sui",
    level: "DRY_RUN_VERIFIED",
    packages: {
      entry: {
        mainnet: "0x2d8c2e0fc6dd25b0214b3fa747e0fd27fd54608142cd2e4f64c1cd350cc4add4",
        // testnet: undefined — Cetus uses different package IDs per network
      },
      shared: {
        GlobalConfig: {
          mainnet: "0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f",
        },
      },
    },
    entryPoint: "pool_script_v2::swap_a2b",
    description: "Convert non-SUI tokens to SUI via Cetus CLMM pools. Requires a Cetus pool with liquidity.",
    blockReason: "Cetus uses different package IDs per network. Mainnet IDs don't resolve on testnet.",
  },

  // ═════════════════════════════════════════════════════════════════════
  // RECOVER ZONE — DeFi position withdrawals
  // ═════════════════════════════════════════════════════════════════════

  // ── Cetus CLMM ──────────────────────────────────────────────────────
  {
    id: "cetus_withdraw",
    label: "Recover Cetus LP position",
    action: "withdraw",
    protocol: "Cetus",
    zone: "recover",
    level: "DRY_RUN_VERIFIED",
    packages: {
      entry: {
        mainnet: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb",
      },
      shared: {
        GlobalConfig: {
          mainnet: "0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f",
        },
      },
    },
    entryPoint: "pool::remove_liquidity",
    description: "Withdraw liquidity from a Cetus CLMM position. Returns both sides of the pair.",
    blockReason: "Cetus uses different package IDs per network. Mainnet IDs don't resolve on testnet.",
    produces: ["cetus_swap"],
  },

  // ── Scallop ─────────────────────────────────────────────────────────
  {
    id: "scallop_withdraw",
    label: "Recover Scallop sCoin",
    action: "withdraw",
    protocol: "Scallop",
    zone: "recover",
    level: "DRY_RUN_VERIFIED",
    packages: {
      entry: {
        mainnet: "0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf",
      },
      shared: {
        Version: {
          mainnet: "0x07871c4b3c847a0f674510d4978d5cf6f960452795e8ff6f189fd2088a3f6ac7",
        },
        Market: {
          mainnet: "0xa757975255146dc9686aa823b7838b507f315d704f428cbadad2f4ea061939d9",
        },
      },
    },
    entryPoint: "redeem::redeem",
    description: "Redeem a Scallop sCoin for the underlying token. Then convert to SUI.",
    blockReason: "Scallop uses different package IDs per network. Mainnet IDs don't resolve on testnet.",
    produces: ["cetus_swap"],
  },

  // ── SpringSui ───────────────────────────────────────────────────────
  {
    id: "springsui_withdraw",
    label: "Recover SpringSui sSUI",
    action: "unstake",
    protocol: "SpringSui",
    zone: "recover",
    level: "DRY_RUN_VERIFIED",
    packages: {
      entry: {
        mainnet: "0xb0575765166030556a6eafd3b1b970eba8183ff748860680245b9edd41c716e7",
      },
      shared: {
        LiquidStakingInfo: {
          mainnet: "0x15eda7330c8f99c30e430b4d82fd7ab2af3ead4ae17046fcb224aa9bad394f6b",
        },
        SuiSystemState: {
          mainnet: "0x5",
        },
      },
    },
    entryPoint: "liquid_staking::redeem",
    description: "Redeem SpringSui sSUI back into SUI.",
    blockReason: "SpringSui may not be deployed on testnet. Mainnet IDs don't resolve on testnet.",
  },

  // ── Navi ────────────────────────────────────────────────────────────
  {
    id: "navi_withdraw",
    label: "Recover Navi deposit",
    action: "withdraw",
    protocol: "Navi",
    zone: "recover",
    level: "CODE_ONLY",
    packages: {
      entry: {
        mainnet: "0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0",
      },
    },
    entryPoint: "storage::withdraw",
    description: "Withdraw from Navi lending pool. Requires dynamic Pool<T> resolution.",
    blockReason: "Navi withdraw requires reading a dynamic Pool<T> object from Storage dynamic fields. Cannot be resolved statically. Entry point signature not yet verified.",
  },

  // ── Suilend ─────────────────────────────────────────────────────────
  {
    id: "suilend_withdraw",
    label: "Recover Suilend deposit",
    action: "withdraw",
    protocol: "Suilend",
    zone: "recover",
    level: "CODE_ONLY",
    packages: {
      entry: {
        mainnet: "0xf95b06141ed4a174f239417323bde3f209b972f5930d8521ea38a52aff3a6ddf",
      },
    },
    entryPoint: "lending_market::withdraw",
    description: "Withdraw from Suilend lending market.",
    blockReason: "Suilend withdraw entry point not yet verified on-chain. Signature may have changed.",
  },

  // ── Haedal ──────────────────────────────────────────────────────────
  {
    id: "haedal_unstake",
    label: "Recover Haedal haSUI",
    action: "unstake",
    protocol: "Haedal",
    zone: "recover",
    level: "CODE_ONLY",
    packages: {
      entry: {
        mainnet: "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d",
      },
    },
    entryPoint: "liquid_staking::request_remove_liquidity",
    description: "Unstake Haedal haSUI back into SUI.",
    blockReason: "Haedal unstake entry point not yet verified on-chain.",
  },

  // ── Volo ────────────────────────────────────────────────────────────
  {
    id: "volo_unstake",
    label: "Recover Volo vSUI",
    action: "unstake",
    protocol: "Volo",
    zone: "recover",
    level: "CODE_ONLY",
    packages: {
      entry: {
        mainnet: "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55",
      },
    },
    entryPoint: "liquid_staking::request_remove_liquidity",
    description: "Unstake Volo vSUI back into SUI.",
    blockReason: "Volo unstake entry point not yet verified on-chain.",
  },

  // ── AlphaFi ─────────────────────────────────────────────────────────
  {
    id: "alphafi_withdraw",
    label: "Recover AlphaFi vault deposit",
    action: "withdraw",
    protocol: "AlphaFi",
    zone: "recover",
    level: "CODE_ONLY",
    packages: {
      entry: {
        mainnet: "0x79729faced2e6294254e555424184f71c8c043a1dbe3447b88613704a7276710",
      },
    },
    entryPoint: "vault::withdraw",
    description: "Withdraw from AlphaFi vault.",
    blockReason: "AlphaFi vault exit entry point not yet verified on-chain.",
  },

  // ── Bucket ──────────────────────────────────────────────────────────
  {
    id: "bucket_repay",
    label: "Recover Bucket CDP position",
    action: "withdraw",
    protocol: "Bucket",
    zone: "recover",
    level: "CODE_ONLY",
    packages: {
      entry: {
        mainnet: "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2",
      },
    },
    entryPoint: "cdp::repay",
    description: "Repay a Bucket CDP position and recover collateral.",
    blockReason: "Bucket CDP repay entry point not yet verified on-chain.",
  },
];

// ─── Public API ────────────────────────────────────────────────────────

/** Get all registered capabilities */
export function getAllCapabilities(): readonly Capability[] {
  return CAPABILITIES;
}

/** Get a capability by ID */
export function getCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

/** Get capabilities for a specific zone */
export function getCapabilitiesForZone(zone: CapabilityZone): Capability[] {
  return CAPABILITIES.filter((c) => c.zone === zone);
}

/**
 * Get capabilities that should be shown in the UI for a given zone.
 *
 * CLEAN/SWEEP/RECOVER zones: only show capabilities at TESTNET_VERIFIED or higher.
 * REVIEW zone: show all detected capabilities (any level).
 * Also filters by network availability (package IDs must resolve).
 */
export function getVisibleCapabilities(zone: CapabilityZone, network?: string): Capability[] {
  const minLevel = zone === "review" ? "CODE_ONLY" : "TESTNET_VERIFIED";
  const levelOrder: VerificationLevel[] = [
    "UNSUPPORTED", "CODE_ONLY", "DRY_RUN_VERIFIED", "TESTNET_VERIFIED", "MAINNET_VERIFIED", "POST_TX_VERIFIED",
  ];
  const minIdx = levelOrder.indexOf(minLevel);

  return CAPABILITIES.filter((c) => {
    if (c.zone !== zone) return false;
    const capIdx = levelOrder.indexOf(c.level);
    if (capIdx < minIdx) return false;
    // network availability check
    if (network === "testnet" && c.packages?.entry && !c.packages.entry.testnet) return false;
    return true;
  });
}

/**
 * Get capabilities that are detected (for REVIEW zone) but not actionable
 * in production UI. Shows the user what the scanner found.
 */
export function getDetectedCapabilities(_network?: string): Capability[] {
  return CAPABILITIES.filter((c) => {
    if (c.zone !== "recover" && c.zone !== "sweep_to_sui") return false;
    // show if level is below TESTNET_VERIFIED (detected but not actionable)
    const levelOrder: VerificationLevel[] = [
      "UNSUPPORTED", "CODE_ONLY", "DRY_RUN_VERIFIED", "TESTNET_VERIFIED", "MAINNET_VERIFIED", "POST_TX_VERIFIED",
    ];
    const capIdx = levelOrder.indexOf(c.level);
    return capIdx < levelOrder.indexOf("TESTNET_VERIFIED");
  });
}

/**
 * Check if a specific capability is actionable on the current network.
 * Actionable = level >= TESTNET_VERIFIED AND package IDs resolve.
 */
export function isCapabilityActionable(id: string, network?: string): boolean {
  const cap = CAPABILITIES.find((c) => c.id === id);
  if (!cap) return false;
  const levelOrder: VerificationLevel[] = [
    "UNSUPPORTED", "CODE_ONLY", "DRY_RUN_VERIFIED", "TESTNET_VERIFIED", "MAINNET_VERIFIED", "POST_TX_VERIFIED",
  ];
  const minIdx = levelOrder.indexOf("TESTNET_VERIFIED");
  if (levelOrder.indexOf(cap.level) < minIdx) return false;
  // network check
  const net = network ?? getNetwork();
  if (net === "testnet" && cap.packages?.entry && !cap.packages.entry.testnet) return false;
  return true;
}

/**
 * Format a capability summary for console/UI.
 */
export function formatCapabilitySummary(): string {
  const lines: string[] = [];
  const zoneIcons: Record<CapabilityZone, string> = {
    clean: "🧹",
    sweep_to_sui: "🔄",
    recover: "♻️ ",
    review: "📋",
  };
  const levelIcons: Record<VerificationLevel, string> = {
    UNSUPPORTED: "❌",
    CODE_ONLY: "📝",
    DRY_RUN_VERIFIED: "🧪",
    TESTNET_VERIFIED: "🔗",
    MAINNET_VERIFIED: "🌐",
    POST_TX_VERIFIED: "✅",
  };

  const zones: CapabilityZone[] = ["clean", "sweep_to_sui", "recover", "review"];
  for (const zone of zones) {
    const caps = CAPABILITIES.filter((c) => c.zone === zone);
    if (caps.length === 0) continue;
    lines.push(`\n${zoneIcons[zone]} ${zone.toUpperCase()} ZONE:`);
    for (const c of caps) {
      const icon = levelIcons[c.level];
      lines.push(`  ${icon} ${c.id}: ${c.label} [${c.level}]`);
      if (c.blockReason) lines.push(`    ⚠ ${c.blockReason}`);
    }
  }

  const actionable = CAPABILITIES.filter((c) => isCapabilityActionable(c.id));
  const detected = getDetectedCapabilities();
  lines.push(`\n${"─".repeat(60)}`);
  lines.push(`  ${actionable.length} actionable / ${CAPABILITIES.length} total capabilities`);
  lines.push(`  ${detected.length} detected but not yet actionable`);

  return lines.join("\n");
}
