/**
 * PTB Fee Transfer Verifier — STRICT (SDK-based)
 *
 * Previous implementation parsed raw BCS bytes by hand and had fatal layout
 * bugs (MoveCall package read as uleb128 instead of a 32-byte ObjectID,
 * SharedObject length off-by-one, no intent-message prefix handling). The
 * resulting offset drift made it throw "Failed to parse TransferObjects
 * address" on perfectly valid transactions — permanently blocking signing.
 *
 * This version deserializes the SAME bytes the SDK produced using the SDK's
 * OWN bcs schemas (`bcs.TransactionKind` / `bcs.TransactionData`), so the
 * builder and the verifier can never disagree about the representation.
 *
 * Verification checks (unchanged, still fail-closed):
 *   1. SplitCoins source is GasCoin
 *   2. SplitCoins amount equals expectedFeeMist exactly
 *   3. TransferObjects references that SplitCoins result
 *   4. TransferObjects recipient address matches feeRecipientAddress
 */

import { bcs } from "@mysten/sui/bcs";

export const FEE_TRANSFER_MISSING =
  "FEE_TRANSFER_MISSING: the transaction does not contain a service fee transfer";

export interface FeeVerificationResult {
  present: boolean;
  reason: string;
  actualAmountMist?: bigint;
  actualRecipient?: string;
}

// ── Loose views over the SDK's parsed JSON shapes ──────────────────────
interface ArgumentView {
  $kind?: string;
  GasCoin?: boolean;
  Input?: number;
  Result?: number;
  NestedResult?: [number, number];
}

interface CommandView {
  $kind?: string;
  MoveCall?: unknown;
  TransferObjects?: { objects?: ArgumentView[]; address?: ArgumentView };
  SplitCoins?: { coin?: ArgumentView; amounts?: ArgumentView[] };
  MergeCoins?: unknown;
}

export async function verifyFeeTransferInPTB(
  txBytes: Uint8Array,
  feeRecipientAddress: string,
  expectedFeeMist: bigint
): Promise<FeeVerificationResult> {
  try {
    const bytes =
      typeof txBytes === "string" ? base64ToBytes(txBytes) : txBytes;

    const ptb = extractProgrammableTransaction(bytes);
    if (!ptb.ok) {
      return { present: false, reason: ptb.reason };
    }

    const { inputs, commands } = ptb.value;

    /** Decode a Pure input's bytes by input index (null when not Pure). */
    const pureInputBytes = (idx: number): Uint8Array | null => {
      const input = inputs[idx] as { Pure?: { bytes?: string } } | undefined;
      const raw = input?.Pure?.bytes;
      if (!raw) return null;
      return base64ToBytes(raw);
    };

    const decodeAmount = (arg: ArgumentView): bigint | null => {
      if (getKind(arg) !== "Input") return null;
      const value = pureInputBytes(arg.Input ?? -1);
      if (!value || value.length === 0 || value.length > 16) return null;
      let result = 0n;
      for (let i = 0; i < value.length; i++) {
        result |= BigInt(value[i]) << BigInt(i * 8);
      }
      return result;
    };

    const normalizedRecipient = normalizeAddress(feeRecipientAddress);

    const commandList = commands as CommandView[];

    for (let s = 0; s < commandList.length; s++) {
      const cmd = commandList[s];
      if (getKind(cmd) !== "SplitCoins") continue;

      const split = cmd.SplitCoins!;
      // 1. The split source MUST be the gas coin.
      if (getKind(split.coin) !== "GasCoin") continue;

      const amounts = split.amounts ?? [];
      for (const amountArg of amounts) {
        // 2. Exact expected fee amount.
        const amountMist = decodeAmount(amountArg);
        if (amountMist !== expectedFeeMist) continue;

        // Found SplitCoins(GasCoin, expectedFeeMist) at command index s.
        // Look for TransferObjects that transfer this split coin onward.
        for (let t = s + 1; t < commandList.length; t++) {
          const candidate = commandList[t];
          if (getKind(candidate) !== "TransferObjects") continue;

          const transfer = candidate.TransferObjects!;
          const objects = transfer.objects ?? [];

          // 3. Must reference the fee split result (Result(s) / NestedResult(s,0)).
          const referencesFeeCoin = objects.some((obj) => {
            const k = getKind(obj);
            if (k === "Result") return obj.Result === s;
            if (k === "NestedResult")
              return obj.NestedResult?.[0] === s && obj.NestedResult?.[1] === 0;
            return false;
          });
          if (!referencesFeeCoin) continue;

          // 4. Recipient must be a Pure address input equal to the treasury.
          const addressArg = transfer.address;
          if (getKind(addressArg) !== "Input") continue;
          const addrBytes = pureInputBytes(addressArg!.Input ?? -1);
          if (!addrBytes || addrBytes.length !== 32) continue;

          const foundAddress = bytesToHex(addrBytes);

          if (foundAddress !== normalizedRecipient) {
            // Fail-closed: ANY transfer of the fee coin to another address
            // rejects the whole transaction.
            return {
              present: false,
              reason: `Fee transfer found but address mismatch: PTB sends to 0x${foundAddress}, expected ${feeRecipientAddress}`,
              actualAmountMist: amountMist,
              actualRecipient: `0x${foundAddress}`,
            };
          }

          return {
            present: true,
            reason: `Fee transfer verified: SplitCoins(GasCoin, ${amountMist}) → TransferObjects(${feeRecipientAddress}) at cmd[${s}]→cmd[${t}]`,
            actualAmountMist: amountMist,
            actualRecipient: feeRecipientAddress,
          };
        }
      }
    }

    return {
      present: false,
      reason:
        "Fee transfer not found. No SplitCoins(GasCoin, expectedAmount) → TransferObjects(expectedAddress) pattern detected.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      present: false,
      reason: `PTB verification failed with exception: ${msg}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Deserialization helpers
// ═══════════════════════════════════════════════════════════════════════

type ParseOutcome<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Extract the ProgrammableTransaction payload from either:
 *   - full bytes as produced by Transaction.build()
 *     (raw bcs(TransactionData), no intent prefix), or
 *   - bare bcs(TransactionKind) bytes
 *     (from tx.build({ onlyTransactionKind: true })).
 */
function extractProgrammableTransaction(
  bytes: Uint8Array
): ParseOutcome<{ inputs: unknown[]; commands: unknown[] }> {
  if (bytes.length === 0) {
    return { ok: false, reason: "Transaction bytes too short" };
  }

  // Full TransactionData bytes as produced by Transaction.build().
  // The SDK serializes { V1: { kind, sender, gasData, expiration } }
  // directly via bcs.TransactionData.serialize().toBytes() — no intent
  // prefix is added.  Try this first since it covers the production path.
  try {
    const data = bcs.TransactionData.parse(bytes) as {
      V1?: { kind?: Record<string, unknown> };
    };
    const ptb = data.V1?.kind?.ProgrammableTransaction as
      | { inputs: unknown[]; commands: unknown[] }
      | undefined;
    if (ptb && Array.isArray(ptb.inputs) && Array.isArray(ptb.commands)) {
      return { ok: true, value: ptb };
    }
    return {
      ok: false,
      reason: "Transaction is not a programmable transaction",
    };
  } catch {
    // Not a full TransactionData — fall through to bare-kind parsing.
  }

  // Bare TransactionKind bytes (e.g. onlyTransactionKind builds / fixtures).
  try {
    const kind = bcs.TransactionKind.parse(bytes) as Record<string, unknown>;
    const ptb = kind.ProgrammableTransaction as
      | { inputs: unknown[]; commands: unknown[] }
      | undefined;
    if (!ptb || !Array.isArray(ptb.inputs) || !Array.isArray(ptb.commands)) {
      return {
        ok: false,
        reason: "Transaction is not a programmable transaction",
      };
    }
    return { ok: true, value: ptb };
  } catch {
    return {
      ok: false,
      reason: "Failed to parse transaction bytes as TransactionData or TransactionKind",
    };
  }
}

/** Discriminant of a parsed bcs enum value ($kind or single-key fallback). */
function getKind(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { $kind?: string };
  if (v.$kind) return v.$kind;
  const keys = Object.keys(value).filter(
    (k) => !k.startsWith("$") && (value as Record<string, unknown>)[k] != null
  );
  return keys.length === 1 ? keys[0] : null;
}

// ═══════════════════════════════════════════════════════════════════════
// Byte helpers
// ═══════════════════════════════════════════════════════════════════════

function normalizeAddress(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  return hex.toLowerCase().padStart(64, "0");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
