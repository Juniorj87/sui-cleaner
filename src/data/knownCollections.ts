// Known collections.
//
// Objects from verified collections are classified KEEP. Entries here are
// demo/curated names used by the demo classifier; package-level entries
// (verified on mainnet) get added during Phase 4.
//
// packageId is only set when the package was VERIFIED on mainnet (checked
// against the public RPC on 2026-08-17). Demo-only names keep packageId
// empty — an unverified package ID would be worse than none.

export interface KnownCollection {
  name: string;
  /** verified package id on mainnet (empty = demo-only entry) */
  packageId?: string;
}

export const KNOWN_COLLECTIONS: KnownCollection[] = [
  // Verified on mainnet with package IDs
  { name: "SuiFrens", packageId: "0xee496a0cc04d06a345982ba6697c90c619020de9e274408c7819f787ff66e1a1" },
  { name: "SuiFrens Capybara", packageId: "0xee496a0cc04d06a345982ba6697c90c619020de9e274408c7819f787ff66e1a1" },
  // Demo-only entries (no package ID — used for demo data classification)
  { name: "Navi Capy" },
  { name: "Aurora Bot" },
  { name: "Mystic Orbit" },
  { name: "Fractal Dunes" },
  { name: "Neon Koi" },
];

export function isKnownCollection(name: string | undefined, packageId?: string): boolean {
  return KNOWN_COLLECTIONS.some((c) => {
    if (packageId && c.packageId) {
      return c.packageId.toLowerCase() === packageId.toLowerCase();
    }
    return !!name && c.name.toLowerCase() === name.toLowerCase();
  });
}
