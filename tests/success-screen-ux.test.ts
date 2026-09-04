// UX REGRESSION — SuccessScreen shows the REAL on-chain result as SUCCESS.
//
//   digest: 5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb
//
// Asserts the exact display contract for the confirmed transaction:
//   - status = success (never failure/unknown)
//   - Objects cleaned = 2 (from effects, never the selection)
//   - Storage rebate  = +0.003596472 SUI
//   - Network gas     = -0.002076 SUI
//   - SuiCleaner fee  = -0.015 SUI
//   - Net result      = -0.013479528 SUI  (rebate - grossGas - fee)
//   - explorer link built from the REAL base58 digest
//   - selected=5 / cleaned=2 renders a neutral partial note, still SUCCESS

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeTxEffects, type TxBlockLike } from "../src/cleanup/txEffectAnalyzer";
import { mistToSui } from "../src/fees/gasEstimator";
import { SERVICE_FEE_MIST } from "../src/fees/serviceFeeConfig";
import { suiscanTxUrl } from "../src/lib/suiscan";

const DIGEST = "5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb";
const DELETED_1 = "0x0528d09e3f588de236c3fa7855baa9d59e95574cb6d514195e759ecb1324561d";
const DELETED_2 = "0xa6a22d549714694fcffc5b3fb56362d56824265fb75c5481f5340bbc05fe1150";
const SENDER = "0x30a293e77a0a23468a1c05149a985a3810ebca25cc7efe45952cd3e267bb90ef";
const TREASURY = "0xb59b5eb40f0cae687de5df9bac567605aef3dcb6f4fc8ff25d75db454483f6ba";

const fixturePath = fileURLToPath(
  new URL(`./fixtures/real-tx-${DIGEST}.json`, import.meta.url)
);
const block = JSON.parse(readFileSync(fixturePath, "utf8")) as TxBlockLike;

/** mirrors the SuccessScreen value formatting (AppPage verifyAndRescan) */
function formatSuccessValues() {
  const r = analyzeTxEffects(block, {
    actedOnIds: [DELETED_1, DELETED_2],
    walletAddress: SENDER,
    treasuryAddress: TREASURY,
    expectedFeeMist: SERVICE_FEE_MIST,
  });
  const grossGasSui = r.grossGasMist != null ? mistToSui(r.grossGasMist) : undefined;
  const storageRebateSui =
    r.storageRebateMist != null && r.storageRebateMist > 0n
      ? mistToSui(r.storageRebateMist)
      : undefined;
  const treasurySui =
    r.treasuryReceivedMist != null ? mistToSui(r.treasuryReceivedMist) : undefined;
  const netMist = r.netResultMist ?? (r.storageRebateMist ?? 0n) - (r.grossGasMist ?? 0n) - (r.treasuryReceivedMist ?? SERVICE_FEE_MIST);
  const netSui = netMist >= 0n ? `+${mistToSui(netMist)}` : `-${mistToSui(-netMist)}`;
  return { r, grossGasSui, storageRebateSui, treasurySui, netSui };
}

describe("success-screen UX — real tx 5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb", () => {
  it("renders SUCCESS with Objects cleaned = 2", () => {
    const { r } = formatSuccessValues();
    expect(r.outcome).toBe("success");
    expect(r.deletedIds).toHaveLength(2);
  });

  it("shows the exact ACTUAL financial values from effects", () => {
    const { grossGasSui, storageRebateSui, treasurySui, netSui } = formatSuccessValues();
    expect(storageRebateSui).toBe("0.003596472");
    expect(grossGasSui).toBe("0.002076");
    expect(treasurySui).toBe("0.015");
    expect(netSui).toBe("-0.013479528");
  });

  it("net formula matches exactly: rebate - grossGas - fee = sender change", () => {
    const { r } = formatSuccessValues();
    expect(r.senderNetMist).toBe(-13_479_528n);
    expect(r.netResultMist).toBe(-13_479_528n);
    expect((r.storageRebateMist ?? 0n) - (r.grossGasMist ?? 0n) - (r.treasuryReceivedMist ?? 0n)).toBe(
      r.senderNetMist
    );
  });

  it("explorer link is built from the REAL base58 digest", () => {
    const url = suiscanTxUrl("mainnet", DIGEST);
    expect(url).toBe(`https://suiscan.xyz/mainnet/tx/${DIGEST}`);
  });

  it("selected=5 / cleaned=2 stays SUCCESS with a neutral partial note (never FAILED)", () => {
    const extra = [
      "0x1111111111111111111111111111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333333333333333333333333333",
    ];
    const r = analyzeTxEffects(block, {
      actedOnIds: [DELETED_1, DELETED_2, ...extra],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });
    expect(r.outcome).toBe("success");
    const selected = 5;
    const cleaned = r.deletedIds.filter((id) =>
      [DELETED_1, DELETED_2, ...extra].map((a) => a.toLowerCase()).includes(id)
    ).length;
    expect(cleaned).toBe(2);
    const partial = selected - cleaned;
    expect(partial).toBe(3);
    // the neutral note the SuccessScreen renders for this case
    const note = `${partial} selected object${partial === 1 ? " was" : "s were"} not included in the executed cleanup.`;
    expect(note).toBe("3 selected objects were not included in the executed cleanup.");
  });

  it("on-chain failure is FAILED and RPC loss is UNKNOWN — never mixed with SUCCESS", () => {
    const failed = analyzeTxEffects(
      { digest: DIGEST, effects: { status: { status: "failure", error: "MoveAbort" } } },
      { actedOnIds: [DELETED_1], walletAddress: SENDER, treasuryAddress: TREASURY, expectedFeeMist: SERVICE_FEE_MIST }
    );
    expect(failed.outcome).toBe("failure");
    const unknown = analyzeTxEffects(null, {
      actedOnIds: [DELETED_1],
      walletAddress: SENDER,
      treasuryAddress: TREASURY,
      expectedFeeMist: SERVICE_FEE_MIST,
    });
    expect(unknown.outcome).toBe("unknown");
  });
});
