import type { WalletObject } from "../scanner/objectClassifier";

export type BurnKind = "transfer-to-0x0" | "coin-destroy-zero";

export interface BurnCommand {
  action: "burn";
  kind: BurnKind;
  description: string;
  /** Human-readable PTB step for the fee/preview screens. */
  preview: string;
}

/**
 * Build a burn command for one object. Only technically valid mechanisms:
 *
 *  - transfer-to-0x0 : for store-able objects (NFTs). Sends the object to
 *    the 0x0 burn address. Removes it from the wallet permanently, but the
 *    object still exists in storage (not a storage deletion).
 *  - coin-destroy-zero : for zero-balance coins via 0x2::coin::destroy_zero.
 *
 * Anything else returns undefined — we never invent burn mechanisms.
 */
export function burnCommand(object: WalletObject): BurnCommand | undefined {
  if (object.category === "coin") {
    return {
      action: "burn",
      kind: "coin-destroy-zero",
      description: "Destroy the zero-balance coin object (coin::destroy_zero).",
      preview: `0x2::coin::destroy_zero — ${short(object.name)}`,
    };
  }
  if (object.category === "nft" || object.category === "object") {
    return {
      action: "burn",
      kind: "transfer-to-0x0",
      description: "Transfer the object to the 0x0 burn address.",
      preview: `transfer to 0x0 — ${short(object.name)}`,
    };
  }
  return undefined;
}

function short(name: string): string {
  return name.length > 28 ? `${name.slice(0, 26)}…` : name;
}
