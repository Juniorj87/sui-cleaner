// ANTI-HALLUCINATION regression — the AI must stay grounded in Cleaner data.
//
// Real failure that motivated this suite (Gemini output observed in prod):
//   "Destroying these will reclaim +0.0028 SUI storage rebate per object"
//   "Cleaner will consolidate these balances into a single object"
// Neither figure nor action existed in the walletContext. Layers:
//   1. context sanitization (classifier copy loses specific-amount claims);
//   2. prompt prohibitions + allowed phrasings;
//   3. deterministic output validator + 1 correction retry + grounded fallback.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleAiRequest,
  validateChatText,
  groundingFromCtx,
  buildDeterministicSummary,
} from "../server/ai-proxy.mjs";
import {
  buildWalletContext,
  sanitizeReasonForAI,
} from "../src/ai/walletContext";
import type { WalletObject } from "../src/scanner/objectClassifier";

function obj(partial: Partial<WalletObject> & { objectId: string }): WalletObject {
  return {
    type: "0x2::coin::Coin<0x2::sui::SUI>",
    category: "coin",
    classification: "cleanable",
    protected: false,
    reason: "",
    name: "Unnamed",
    collection: "—",
    package: "0x2",
    ...partial,
  } as WalletObject;
}

/** Big realistic scan: safe=194 (151 empty coins + 43 cleanable NFTs), review=87, keep=10. */
function bigScan(): WalletObject[] {
  const out: WalletObject[] = [];
  for (let i = 0; i < 151; i++) {
    out.push(obj({ objectId: `0xempty${i}`, name: `TOKEN-${i}`, coinBalance: "0", cleanupAction: "delete", reason: "Empty spent coin object with zero balance. Reclaim +0.0028 SUI storage rebate by destroying this object via coin::destroy_zero()." }));
  }
  for (let i = 0; i < 43; i++) {
    out.push(obj({ objectId: `0xnft${i}`, name: `Junk #${i}`, category: "nft", classification: "cleanable", cleanupAction: "burn", reason: "Verified cleanup: transfer to 0x0." }));
  }
  for (let i = 0; i < 87; i++) {
    out.push(obj({ objectId: `0xrev${i}`, name: `HOLD-${i}`, classification: "review", coinBalance: "5000", reason: "Unknown token with balance" }));
  }
  for (let i = 0; i < 10; i++) {
    out.push(obj({ objectId: `0xkeep${i}`, name: `SUI`, classification: "keep", coinBalance: "1000000000", reason: "Native gas coin" }));
  }
  return out;
}

function geminiTextReply(text: string) {
  const body = {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP", safetyRatings: [] }],
  };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
}

function chatBody(question: string, walletContext: unknown) {
  return JSON.stringify({
    type: "chat", provider: "gemini", apiKey: "AQ.test", model: "gemini-2.5-flash",
    question, objectInput: null, walletStats: null, walletContext, conversationHistory: [],
  });
}

// The exact hallucinated claims observed in production.
const HALLUCINATED =
  "Destroying these will reclaim +0.0028 SUI storage rebate per object. " +
  "Cleaner will consolidate these balances into a single object.";

describe("context sanitization + mechanics metadata", () => {
  it("strips specific rebate amounts from classifier copy, keeps the mechanism", () => {
    const clean = sanitizeReasonForAI(
      "Empty spent coin object (CETUS) with zero balance. Reclaim +0.0028 SUI storage rebate by destroying this object via coin::destroy_zero()."
    );
    expect(clean).not.toMatch(/0\.0028/);
    expect(clean).not.toMatch(/SUI/);
    expect(clean).toContain("destroy_zero");
    expect(clean).toContain("zero balance");
  });

  it("derives rebate/merge truthfully: destroy_zero yes, dust merge-only, burns unknown", () => {
    const ctx = buildWalletContext([
      obj({ objectId: "0xe1", name: "E", coinBalance: "0", cleanupAction: "delete", reason: "Empty" }),
      obj({ objectId: "0xd1", name: "D", coinBalance: "42", classification: "cleanable", cleanupAction: "delete", dust: true, reason: "dust" }),
      obj({ objectId: "0xn1", name: "N", category: "nft", classification: "cleanable", cleanupAction: "burn", reason: "0x0" }),
    ]);
    const byId = new Map(ctx.safe.concat(ctx.review).map((e) => [e.objectId, e]));
    expect(byId.get("0xe1")).toMatchObject({ rebate: "yes", merge: false });
    expect(byId.get("0xd1")).toMatchObject({ rebate: "unknown", merge: true });
    expect(byId.get("0xn1")).toMatchObject({ rebate: "unknown", merge: false });
  });
});

describe("validateChatText (pure guardrail)", () => {
  const ground = groundingFromCtx(buildWalletContext(bigScan()), null);

  it("flags the production hallucination (+0.0028 SUI, consolidation)", () => {
    const r = validateChatText(HALLUCINATED, ground);
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("invented-sui-amount");
    expect(r.violations).toContain("unverified-consolidation");
  });

  it("allows grounded counts, balances, and safe phrasings", () => {
    const ok = validateChatText(
      "291 objects detected. 194 safe to clean. CETUS has a zero balance and Cleaner classifies this as safe to clean. " +
      "oSAIL contains balance 5000 and should be reviewed before cleaning. Start with empty cleanable objects.",
      ground
    );
    expect(ok).toEqual({ ok: true, violations: [] });
  });

  it("allows dust-qualified consolidation only when merge entries exist", () => {
    const dustCtx = buildWalletContext([
      obj({ objectId: "0xd1", name: "DUST", coinBalance: "42", classification: "cleanable", cleanupAction: "delete", dust: true, reason: "dust" }),
    ]);
    const g2 = groundingFromCtx(dustCtx, null);
    const ok = validateChatText(
      "Dust balances may be consolidated into one coin, balance stays in the wallet, only with a merge partner.",
      g2
    );
    expect(ok.ok).toBe(true);
    const bad = validateChatText("Your balance will be preserved.", ground);
    expect(bad.violations).toContain("promised-balance");
  });

  it("flags USD, gas, value verdicts, execution and payout promises", () => {
    const cases: Array<[string, string]> = [
      ["Found $12.40 rewards worth claiming", "invented-rewards"],
      ["You will receive 5 SUI", "promised-payout"],
      ["This token is a scam, delete it now", "invented-value-verdict"],
      ["Cleaner will delete these objects", "promised-execution"],
      ["This is completely safe and has no value", "absolute-safety"],
      ["Network gas will be 0.001 SUI", "invented-gas-price"],
    ];
    for (const [text, code] of cases) {
      const r = validateChatText(text, ground);
      expect(r.violations, text).toContain(code);
    }
  });
});

describe("deterministic grounded fallback", () => {
  it("renders the §10 template from real counts and passes the validator", () => {
    const ctx = buildWalletContext(bigScan());
    const summary = buildDeterministicSummary(ctx);
    expect(summary).toContain("291 objects");
    expect(summary).toContain("194 objects");
    expect(summary).toContain("87 objects");
    expect(summary).toContain("SAFE TO CLEAN");
    expect(summary).toContain("RECOMMENDATION");
    const check = validateChatText(summary, groundingFromCtx(ctx, null));
    expect(check).toEqual({ ok: true, violations: [] });
  });
});

describe("chat pipeline guardrail (server)", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("hallucinated answer triggers correction; persistent hallucination → deterministic summary", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply(HALLUCINATED));
    const ctx = buildWalletContext(bigScan());
    const r = await handleAiRequest(chatBody("What should I clean first?", ctx));
    expect(r.status).toBe(200);
    const body = r.body as { text: string; grounded: string };
    // one correction retry happened, then the grounded fallback
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.grounded).toBe("deterministic");
    expect(body.text).toContain("291 objects");
    expect(body.text).toContain("194 objects");
    expect(body.text).not.toContain("0.0028");
    expect(body.text).not.toMatch(/consolidat/i);
    const check = validateChatText(body.text, groundingFromCtx(ctx, null));
    expect(check.ok).toBe(true);
  });

  it("corrected retry is used when it passes (grounded=corrected)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(geminiTextReply(HALLUCINATED))
      .mockResolvedValueOnce(geminiTextReply("Start with the empty objects that Cleaner already classifies as safe to clean."));
    const ctx = buildWalletContext(bigScan());
    const r = await handleAiRequest(chatBody("What should I clean first?", ctx));
    const body = r.body as { text: string; grounded: string };
    expect(body.grounded).toBe("corrected");
    expect(body.text).toContain("Start with the empty objects");
  });

  it("valid answers pass through untouched with a single provider call", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("Cleaner classifies these as safe to clean and they have zero balance."));
    const ctx = buildWalletContext(bigScan());
    const r = await handleAiRequest(chatBody("What is safe to remove?", ctx));
    const body = r.body as { text: string; grounded: string };
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.grounded).toBe("model");
    expect(body.text).toContain("safe to clean");
  });

  it("prompt carries the prohibitions and the overview template rules", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(chatBody("What should I clean first?", buildWalletContext(bigScan())));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = sent.contents.map((c: { parts: Array<{ text: string }> }) => c.parts[0].text).join("\n");
    expect(prompt).toContain("never state a specific rebate amount");
    expect(prompt).toContain("marked as merge candidates");
    expect(prompt).toContain("never convert");
    expect(prompt).toContain("definitely safe");
    expect(prompt).toContain("I don't have enough on-chain information");
  });
});
