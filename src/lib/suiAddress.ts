/**
 * Sui address helpers. A Sui address is `0x` followed by 1..64 lowercase
 * hex characters (short addresses are valid). We accept both cases and
 * normalize to lowercase for comparisons.
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

/** true when the string looks like a plausible Sui address */
export function isSuiAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

/**
 * Normalize for comparisons AND for RPC calls: lowercase, no surrounding
 * whitespace, and short addresses are padded to the canonical 64-hex form
 * (Sui omits leading zeros; RPC servers expect the full form).
 */
export function normalizeAddress(value: string): string {
  const v = value.trim().toLowerCase();
  const hex = v.startsWith("0x") ? v.slice(2) : v;
  if (!/^[0-9a-f]+$/.test(hex)) return v;
  return "0x" + hex.padStart(64, "0");
}

/** short display form: 0x1234…ABCD */
export function shortAddress(address: string): string {
  const a = address;
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
