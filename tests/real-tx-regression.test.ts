// REGRESSION TEST — real mainnet transaction
//
//   digest: 5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb
//   SuiVision: https://suivision.xyz/txblock/5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb
//
// This transaction was executed by the real cleanup flow (2 × destroy_zero,
// SplitCoins, TransferObjects). The on-chain record says:
//   effects.status.status = "success"
//   effects.deleted       = [0x0528…, 0xa6a2…]  (2 objects)
//   effects.gasUsed       = comp 100000, storage 1976000, rebate 3596472
//   balanceChanges        = sender −13 479 528 MIST, treasury +15 000 000 MIST
//
// The regression asserts that the verifier NEVER classifies this transaction
// as FAILED or UNKNOWN, and that the actual financials shown are the on-chain
// values (never the pre-sign estimate).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeTxEffects, type TxBlockLike } from "../src/cleanup/txEffectAnalyzer";
import { SERVICE_FEE_MIST } from "../src/fees/serviceFeeConfig";

const DIGEST = "5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb";
const DELETED_1 = "0x0528d09e3f588de236c3fa7855baa9d59e95574cb6d514195e759ecb1324561d";
const DELETED_2 = "0xa6a22d549714694fcffc5b3fb56362d56824265fb75c5481f5340bbc05fe1150";
const SENDER = "0x30a293e77a0a23468a1c05149a985a3810ebca25cc7efe45952cd3e267bb90ef";
const TREASURY = "0xb59b5eb40f0cae687de5df9bac567605aef3dcb6f4fc8ff25d75db454483f6ba";

const fixturePath = fileURLToPath(
  new URL(`./fixtures/real-tx-${DIGEST}.json`, import.meta.url)
);
const block = JSON.parse(readFileSync(fixturePath, "utf8")) as TxBlockLike;

describe("real transaction regression — 5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb", () => {
  it("on-chain record says success", () => {
    expect(block.effects?.status?.status).toBe("success");
  });

  it("analyzer classifies as SUCCESS — never failure/unknown (on-chain status=success)", () => {
    const r = analyzeTxEffects(block, {
      actedOnIds: [DELETED_1, DELETED_2],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });
    expect(r.outcome).toBe("success");
    expect(r.effectsStatus).toBe("success");
    expect(["failure", "unknown"]).not.toContain(r.outcome);
  });

  it("detects BOTH deleted objects by object ID from effects.deleted (objectChanges omits them)", () => {
    const r = analyzeTxEffects(block, {
      actedOnIds: [DELETED_1, DELETED_2],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });
    // The raw objectChanges array only contains mutated/created entries —
    // deleted objects are only in effects.deleted. Multi-source detection must
    // still find them.
    const fromObjectChanges = (block.objectChanges ?? []).filter((c) => c.type === "deleted");
    expect(fromObjectChanges.length).toBe(0);
    expect(r.deletedIds).toEqual(
      expect.arrayContaining([DELETED_1, DELETED_2])
    );
    expect(r.missingDeletions).toHaveLength(0);
    expect(r.unexpectedDeletions).toHaveLength(0);
  });

  it("extracts ACTUAL on-chain financials (never the estimate)", () => {
    const r = analyzeTxEffects(block, {
      actedOnIds: [DELETED_1, DELETED_2],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });
    // gasUsed: computation 100000 + storage 1976000 = 2076000 gross
    expect(r.grossGasMist).toBe(2_076_000n);
    // storage rebate returned to the sender
    expect(r.storageRebateMist).toBe(3_596_472n);
    // treasury actually received exactly the service fee
    expect(r.treasuryReceivedMist).toBe(15_000_000n);
    expect(r.treasuryVerified).toBe(true);
    // sender net change = rebate − grossGas − fee = −13 479 528 MIST
    expect(r.senderNetMist).toBe(-13_479_528n);
    expect(r.netResultMist).toBe(-13_479_528n);
    // No discrepancy notes for a fully-matching successful tx
    expect(r.discrepancies).toHaveLength(0);
  });

  it("chain success with fewer deleted objects than selected is still SUCCESS (count mismatch is a note, not a failure)", () => {
    // Simulate the reported mismatch: 3 selected, only 2 actually deleted.
    const r = analyzeTxEffects(block, {
      actedOnIds: [DELETED_1, DELETED_2, "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });
    expect(r.outcome).toBe("success"); // NEVER failure on chain success
    expect(r.missingDeletions).toHaveLength(1);
    expect(r.discrepancies.length).toBeGreaterThan(0); // surfaced as a note
  });

  it("RPC/network error is classified UNKNOWN, not FAILED", () => {
    const r = analyzeTxEffects(null, {
      actedOnIds: [DELETED_1, DELETED_2],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });
    expect(r.outcome).toBe("unknown");
  });

  it("effects.status failure IS classified as failure", () => {
    const failed = analyzeTxEffects(
      {
        digest: DIGEST,
        effects: {
          status: { status: "failure", error: "MoveAbort" },
        },
      },
      {
        actedOnIds: [DELETED_1, DELETED_2],
        walletAddress: SENDER,
        treasuryAddress: TREASURY,
        expectedFeeMist: SERVICE_FEE_MIST,
      }
    );
    expect(failed.outcome).toBe("failure");
  });
});
