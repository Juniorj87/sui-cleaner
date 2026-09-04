// Protected-type rules.
//
// PROTECTED means: this object will never be included in cleanup, and the UI
// must say so explicitly. Protection is decided from on-chain facts only:
// type strings, package ids, ownership.

/** Substrings that, when found in a Move type, mark the object as protected. */
export const PROTECTED_TYPE_PATTERNS: string[] = [
  "staking_pool::StakedSui", // staking positions
  "sui_system", // system-level objects
  "kiosk::Kiosk", // kiosk containers (may hold items)
  "kiosk::KioskOwnerCap", // capability to manage a kiosk
  "dynamic_field", // dynamic field objects are managed by their parent
  "dynamic_object_field",
];

/** Singleton system object addresses that must never be touched. */
export const PROTECTED_SINGLETON_ADDRESSES: string[] = [
  "0x5", // Sui System State
  "0x6", // Clock
  "0x403", // DenyList
];

/** Well-known system types that are shared or immutable by design. */
export const PROTECTED_SYSTEM_TYPES: string[] = [
  "0x2::coin::CoinMetadata", // immutable metadata, not owned as an asset
  "0x2::coin::TreasuryCap", // treasury capabilities (can burn supply!)
  "0x2::coin::DenyCap",
  "0x2::package::UpgradeCap",
  "0x2::package::Publisher",
  "0x2::display::Display",
];

export function isProtectedType(type: string): boolean {
  return (
    PROTECTED_TYPE_PATTERNS.some((p) => type.includes(p)) ||
    PROTECTED_SYSTEM_TYPES.some((t) => type.startsWith(t))
  );
}

export function isProtectedSingleton(objectId: string): boolean {
  return PROTECTED_SINGLETON_ADDRESSES.some((a) => objectId.toLowerCase() === a);
}
