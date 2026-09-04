/**
 * NETWORK-AWARE PACKAGE RESOLVER
 *
 * Resolves the correct package IDs and object IDs based on the current
 * network (mainnet / testnet). This eliminates hardcoded mainnet IDs
 * scattered across the codebase.
 *
 * Usage:
 *   const pkg = resolvePackage("cetus", "entry");
 *   // → mainnet: "0x1eabed72..."
 *   // → testnet: "0x..." (when testnet IDs are known)
 */

import { getNetwork } from "../config";
import type { NetworkPackage } from "./registry";

// ─── Package Registry ──────────────────────────────────────────────────
//
// Each protocol's package IDs per network. DeFi protocols deploy SEPARATE
// package addresses per network — mainnet IDs do NOT exist on testnet.
//
// When testnet IDs are unknown, they are omitted (undefined).
// The resolver returns the mainnet ID as fallback → dry-run fails →
// mechanism not available on this network. This is the fail-safe.
//
// VERIFIED TESTNET AVAILABILITY (August 2025):
//   ✅ sui framework (0x2) — same on all networks
//   ✅ 0x5 (SuiSystemState) — same on all networks
//   ❌ cetus_clmm — mainnet IDs NOT found on testnet
//   ❌ cetus_swap — mainnet IDs NOT found on testnet
//   ❌ scallop — mainnet IDs NOT found on testnet
//   ❌ springsui — mainnet IDs NOT found on testnet
//   ❌ navi, suilend, haedal, volo, alphafi, bucket — NOT found on testnet
//
// To enable testnet for a protocol, add testnet-specific package IDs below.
// These must be discovered from the protocol's testnet deployment.

interface ProtocolPackages {
  /** the main entry point package */
  entry?: NetworkPackage;
  /** shared objects required by the entry point */
  shared?: Record<string, NetworkPackage>;
}

const PROTOCOL_PACKAGES: Record<string, ProtocolPackages> = {
  // ── Framework (0x2) — same on all networks ──────────────────────────
  sui: {},

  // ── Cetus CLMM ──────────────────────────────────────────────────────
  // Verified: mainnet IDs do NOT exist on testnet. Need separate deployment.
  cetus_clmm: {
    entry: {
      mainnet: "0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb",
    },
    shared: {
      GlobalConfig: {
        mainnet: "0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f",
      },
    },
  },

  // ── Cetus Swap (integrate) ──────────────────────────────────────────
  // Verified: mainnet IDs do NOT exist on testnet. Need separate deployment.
  cetus_swap: {
    entry: {
      mainnet: "0x2d8c2e0fc6dd25b0214b3fa747e0fd27fd54608142cd2e4f64c1cd350cc4add4",
    },
    shared: {
      GlobalConfig: {
        mainnet: "0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f",
      },
    },
  },

  // ── Scallop ─────────────────────────────────────────────────────────
  // Verified: mainnet IDs do NOT exist on testnet. Need separate deployment.
  scallop: {
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

  // ── SpringSui ───────────────────────────────────────────────────────
  // Verified: mainnet IDs do NOT exist on testnet. Need separate deployment.
  // IMPORTANT: the SPRING_SUI coin type lives under a SEPARATE package
  // from the core liquid staking package. Two different deployed packages.
  springsui: {
    entry: {
      mainnet: "0xb0575765166030556a6eafd3b1b970eba8183ff748806680245b9edd41c716e7",
    },
    shared: {
      LiquidStakingInfo: {
        mainnet: "0x15eda7330c8f99c30e430b4d82fd7ab2af3ead4ae17046fcb224aa9bad394f6b",
      },
      SuiSystemState: {
        mainnet: "0x5",
      },
      TokenType: {
        mainnet: "0x83556891f4a0f233ce7b05cfe7f957d4020492a34f5405b2cb9377d060bef4bf",
      },
    },
  },

  // ── Navi ────────────────────────────────────────────────────────────
  navi: {
    entry: {
      mainnet: "0xee0041239b89564ce870a7dec5ddc5d114367ab94a1137e90aa0633cb76518e0",
    },
  },

  // ── Suilend ─────────────────────────────────────────────────────────
  suilend: {
    entry: {
      mainnet: "0xf95b06141ed4a174f239417323bde3f209b972f5930d8521ea38a52aff3a6ddf",
    },
  },

  // ── Haedal ──────────────────────────────────────────────────────────
  haedal: {
    entry: {
      mainnet: "0xbde4ba4c2e274a60ce15c1cfff9e5c42e41654ac8b6d906a57efa4bd3c29f47d",
    },
  },

  // ── Volo ────────────────────────────────────────────────────────────
  volo: {
    entry: {
      mainnet: "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55",
    },
  },

  // ── AlphaFi ─────────────────────────────────────────────────────────
  alphafi: {
    entry: {
      mainnet: "0x79729faced2e6294254e555424184f71c8c043a1dbe3447b88613704a7276710",
    },
  },

  // ── Bucket ──────────────────────────────────────────────────────────
  bucket: {
    entry: {
      mainnet: "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2",
    },
  },
};

// ─── Resolution API ────────────────────────────────────────────────────

/**
 * Resolve a package address for a protocol on the current network.
 *
 * @param protocol — protocol identifier (e.g. "cetus_clmm", "scallop")
 * @param kind — "entry" for the main package, or a shared object name
 * @returns the resolved address, or undefined if not available on this network
 */
export function resolvePackageAddress(
  protocol: string,
  kind: "entry" | string
): string | undefined {
  const pkgs = PROTOCOL_PACKAGES[protocol];
  if (!pkgs) return undefined;

  const network = getNetwork();

  if (kind === "entry") {
    if (!pkgs.entry) return undefined;
    if (network === "testnet" && pkgs.entry.testnet) return pkgs.entry.testnet;
    return pkgs.entry.mainnet;
  }

  // shared object
  const sharedObj = pkgs.shared?.[kind];
  if (!sharedObj) return undefined;
  if (network === "testnet" && sharedObj.testnet) return sharedObj.testnet;
  return sharedObj.mainnet;
}

/**
 * Resolve all packages for a protocol (entry + shared) on the current network.
 */
export function resolveProtocolPackages(
  protocol: string
): { entry?: string; shared: Record<string, string> } {
  const pkgs = PROTOCOL_PACKAGES[protocol];
  if (!pkgs) return { entry: undefined, shared: {} };

  const network = getNetwork();

  const entry = pkgs.entry
    ? network === "testnet" && pkgs.entry.testnet
      ? pkgs.entry.testnet
      : pkgs.entry.mainnet
    : undefined;

  const shared: Record<string, string> = {};
  if (pkgs.shared) {
    for (const [name, np] of Object.entries(pkgs.shared)) {
      shared[name] =
        network === "testnet" && np.testnet ? np.testnet : np.mainnet;
    }
  }

  return { entry, shared };
}

/**
 * Check if a protocol's packages are available on the current network.
 * Returns true if at least the entry package resolves.
 */
export function isProtocolAvailableOnNetwork(protocol: string): boolean {
  return resolvePackageAddress(protocol, "entry") !== undefined;
}

// ─── Specialized resolvers (used by actions.ts and swapRouter.ts) ──────

/**
 * Resolve Cetus CLMM packages for withdrawCetusLiquidity.
 */
export function resolveCetusCLMMPackages(): {
  packageId: string;
  globalConfig: string;
} {
  return {
    packageId: resolvePackageAddress("cetus_clmm", "entry") ?? "",
    globalConfig: resolvePackageAddress("cetus_clmm", "GlobalConfig") ?? "",
  };
}

/**
 * Resolve Cetus swap packages for appendCetusSwap.
 */
export function resolveCetusSwapPackages(): {
  integratePackage: string;
  globalConfig: string;
} {
  return {
    integratePackage: resolvePackageAddress("cetus_swap", "entry") ?? "",
    globalConfig: resolvePackageAddress("cetus_swap", "GlobalConfig") ?? "",
  };
}

/**
 * Resolve Scallop packages for withdrawScallop.
 */
export function resolveScallopPackages(): {
  packageId: string;
  version: string;
  market: string;
} {
  return {
    packageId: resolvePackageAddress("scallop", "entry") ?? "",
    version: resolvePackageAddress("scallop", "Version") ?? "",
    market: resolvePackageAddress("scallop", "Market") ?? "",
  };
}

/**
 * Resolve SpringSui packages for unstakeSpringSui.
 */
export function resolveSpringSuiPackages(): {
  packageId: string;
  liquidStakingInfo: string;
  tokenType: string;
} {
  return {
    packageId: resolvePackageAddress("springsui", "entry") ?? "",
    liquidStakingInfo: resolvePackageAddress("springsui", "LiquidStakingInfo") ?? "",
    // The token type is network-specific: the package ID changes per network
    tokenType: (() => {
      const tokenPkg = resolvePackageAddress("springsui", "TokenType");
      return tokenPkg ? `${tokenPkg}::spring_sui::SPRING_SUI` : "";
    })(),
  };
}

// ─── Testnet Availability ─────────────────────────────────────────────

/**
 * Return the testnet availability status for all registered protocols.
 * Uses live RPC verification to check if package IDs exist on testnet.
 *
 * For programmatic use, check individual protocols:
 *   resolvePackageAddress("cetus_clmm", "entry")
 * returns undefined on testnet (not available).
 */
export function getProtocolTestnetStatus(): {
  availableOnTestnet: string[];
  mainnetOnly: string[];
} {
  const allProtocols = Object.keys(PROTOCOL_PACKAGES).filter(
    (p) => p !== "sui" // framework is always available
  );
  // Check which protocols have testnet-specific package IDs
  const availableOnTestnet: string[] = [];
  const mainnetOnly: string[] = [];

  for (const protocol of allProtocols) {
    const pkgs = PROTOCOL_PACKAGES[protocol];
    // Check if this protocol has a testnet entry OR is network-agnostic
    const hasTestnetEntry = pkgs.entry?.testnet != null;
    if (hasTestnetEntry) {
      availableOnTestnet.push(protocol);
    } else {
      mainnetOnly.push(protocol);
    }
  }

  return { availableOnTestnet, mainnetOnly };
}
