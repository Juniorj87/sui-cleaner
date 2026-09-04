// LIVE regression — exercises the exact production path
//   SuiJsonRpcClient.getTransactionBlock(...) → analyzeTxEffects(...)
//
// Runs only when LIVE_RPC=1 (network). The committed fixture test
// (real-tx-regression.test.ts) covers the same assertions offline.

import { describe, it, expect } from "vitest";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { analyzeTxEffects, type TxBlockLike } from "../src/cleanup/txEffectAnalyzer";
import { SERVICE_FEE_MIST } from "../src/fees/serviceFeeConfig";

const DIGEST = "5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb";
const DELETED_1 = "0x0528d09e3f588de236c3fa7855baa9d59e95574cb6d514195e759ecb1324561d";
const DELETED_2 = "0xa6a22d549714694fcffc5b3fb56362d56824265fb75c5481f5340bbc05fe1150";
const SENDER = "0x30a293e77a0a23468a1c05149a985a3810ebca25cc7efe45952cd3e267bb90ef";
const TREASURY = "0xb59b5eb40f0cae687de5df9bac567605aef3dcb6f4fc8ff25d75db454483f6ba";

const live = process.env.LIVE_RPC === "1";

describe.skipIf(!live)("live RPC regression — 5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb", () => {
  it("fetches the real block via the production RPC client and classifies it as SUCCESS", async () => {
    // The production app points its SuiJsonRpcClient at the same-origin /api/rpc
    // proxy which forwards to SUI_RPC_URL (default https://sui.publicnode.com).
    const rpcUrl = process.env.SUI_RPC_URL ?? "https://sui.publicnode.com";
    const client = new SuiJsonRpcClient({ url: rpcUrl, network: "mainnet" });
    const block = (await client.getTransactionBlock({
      digest: DIGEST,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showBalanceChanges: true,
      },
    })) as unknown as TxBlockLike;

    expect(block?.effects?.status?.status).toBe("success");

    const r = analyzeTxEffects(block, {
      actedOnIds: [DELETED_1, DELETED_2],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });

    // Regression target: on-chain success must never be classified failed/unknown.
    expect(r.outcome).toBe("success");
    expect(r.deletedIds).toEqual(expect.arrayContaining([DELETED_1, DELETED_2]));
    expect(r.grossGasMist).toBe(2_076_000n);
    expect(r.storageRebateMist).toBe(3_596_472n);
    expect(r.treasuryReceivedMist).toBe(15_000_000n);
    expect(r.senderNetMist).toBe(-13_479_528n);
    expect(r.netResultMist).toBe(-13_479_528n);
    expect(r.treasuryVerified).toBe(true);
    expect(r.discrepancies).toHaveLength(0);
  }, 30_000);
});
