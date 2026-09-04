// AI CHAT integration — client → /api/ai/analyze → provider.
//
// Covers the runtime flow fixes:
//   - free-text chat: valid provider text is returned as-is (no JSON parser
//     between the answer and the user);
//   - conversationHistory reaches the provider (Gemini assistant→model);
//   - blocked / empty / 400 / 401 / 429 / 503 map to distinct codes;
//   - every provider failure keeps working for SEQUENTIAL calls (the proxy
//     itself has no deterministic second-request bug);
//   - client askChat maps structured errors to AI_* codes.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleAiRequest } from "../server/ai-proxy.mjs";

function geminiTextReply(text: string) {
  const body = {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP", safetyRatings: [] }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
  };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
}

function geminiError(status: number, message: string) {
  const body = { error: { code: status, message, status: status === 429 ? "RESOURCE_EXHAUSTED" : "ERROR" } };
  return { ok: false, status, text: async () => JSON.stringify(body), json: async () => body };
}

const BASE_CHAT = {
  type: "chat",
  provider: "gemini",
  apiKey: "AQ.test-key",
  model: "gemini-2.5-flash",
  question: "Can it be deleted?",
  objectInput: null,
  walletStats: null,
  conversationHistory: [
    { role: "user", content: "Do I need this token?" },
    { role: "assistant", content: "Yes — SAIL is a known token, keep it." },
  ],
};

describe("ai-proxy chat (free-text contract)", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("returns provider text as-is (no JSON demanded, no parser)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      geminiTextReply("Empty coin objects return the storage rebate when destroyed.")
    );
    const r = await handleAiRequest(JSON.stringify({ ...BASE_CHAT, conversationHistory: [] }));
    expect(r.status).toBe(200);
    expect((r.body as { text: string }).text).toBe(
      "Empty coin objects return the storage rebate when destroyed."
    );
  });

  it("does not force JSON mode for chat (no responseMimeType)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(JSON.stringify({ ...BASE_CHAT, conversationHistory: [] }));
    const sent = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sent.generationConfig.responseMimeType).toBeUndefined();
  });

  it("forwards conversation history to Gemini (assistant turns as model role)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("Yes, it can."));
    const r = await handleAiRequest(JSON.stringify(BASE_CHAT));
    expect(r.status).toBe(200);
    const sent = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    const roles = (sent.contents ?? []).map((c: { role: string }) => c.role);
    expect(roles).toEqual(["user", "model", "user"]);
    expect(sent.contents[1].parts[0].text).toContain("SAIL is a known token");
    // history roles are provider-safe: never a bare "assistant" for Gemini
    expect(roles).not.toContain("assistant");
  });

  it("multi-turn: second call carries the first exchange", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("answer"));
    const r1 = await handleAiRequest(JSON.stringify({ ...BASE_CHAT, question: "What is this token?", conversationHistory: [] }));
    expect(r1.status).toBe(200);
    const r2 = await handleAiRequest(JSON.stringify({
      ...BASE_CHAT,
      question: "Can I remove it?",
      conversationHistory: [
        { role: "user", content: "What is this token?" },
        { role: "assistant", content: "answer" },
      ],
    }));
    expect(r2.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    const texts = sent.contents.map((c: { parts: Array<{ text: string }> }) => c.parts[0].text);
    expect(texts).toEqual(["What is this token?", "answer", "User question: Can I remove it?"]);
  });

  it("blocked response (SAFETY + promptFeedback) surfaces as blocked_response", async () => {
    const body = {
      promptFeedback: { blockReason: "SAFETY" },
      candidates: [{ finishReason: "SAFETY", content: { parts: [] }, safetyRatings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "HIGH" }] }],
    };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
    const r = await handleAiRequest(JSON.stringify(BASE_CHAT));
    expect(r.status).toBe(502);
    expect((r.body as { code: string }).code).toBe("blocked_response");
  });

  it("empty candidates surface as empty_response (not generic unreadable)", async () => {
    const body = { candidates: [] };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
    const r = await handleAiRequest(JSON.stringify(BASE_CHAT));
    expect(r.status).toBe(502);
    expect((r.body as { code: string }).code).toBe("empty_response");
  });

  it("provider 429 surfaces as structured rate_limited (never generic 502)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiError(429, "Quota exceeded. retry in 30s"));
    const r = await handleAiRequest(JSON.stringify(BASE_CHAT));
    expect(r.status).toBe(429);
    expect((r.body as { code: string }).code).toBe("rate_limited");
  });

  it("provider 401 surfaces as structured invalid_key (never generic 502)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiError(401, "API key not valid"));
    const r = await handleAiRequest(JSON.stringify(BASE_CHAT));
    expect(r.status).toBe(401);
    expect((r.body as { code: string }).code).toBe("invalid_key");
  });

  it("provider 400 / 503 surface as structured errors", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiError(400, "Invalid argument"));
    const r400 = await handleAiRequest(JSON.stringify(BASE_CHAT));
    expect(r400.status).toBe(502);
    expect((r400.body as { code: string }).code).toBe("provider_error");
    fetchMock.mockResolvedValue(geminiError(503, "Service unavailable"));
    const r503 = await handleAiRequest(JSON.stringify(BASE_CHAT));
    expect(r503.status).toBe(502);
    expect((r503.body as { code: string }).code).toBe("provider_error");
  });

  it("OpenAI-style providers receive history as messages (roles preserved)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: "Kept." }, finish_reason: "stop" }] }),
      text: async () => "{}",
    });
    const r = await handleAiRequest(JSON.stringify({ ...BASE_CHAT, provider: "openai", apiKey: "sk-test", model: "gpt-4o-mini" }));
    expect(r.status).toBe(200);
    expect((r.body as { text: string }).text).toBe("Kept.");
    const sent = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    const roles = sent.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "user"]);
  });
});

describe("analyzer.askChat error mapping", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  // the client keeps a 2s minimum gap between AI calls — space the
  // stubbed calls out so they reach fetch instead of the local throttle
  const coolDown = () => new Promise((r) => setTimeout(r, 2100));
  const cfg = { apiKey: "k", model: "m", provider: "gemini" as const };

  it("returns text on success", async () => {
    await coolDown();
    const { askChat } = await import("../src/ai/analyzer");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ text: "Remove it." }),
    });
    await expect(askChat("Can I remove it?", cfg)).resolves.toEqual({ text: "Remove it." });
  });

  it("structured 429 maps to AI_RATE_LIMITED (not the generic error)", async () => {
    await coolDown();
    const { askChat } = await import("../src/ai/analyzer");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 429,
      text: async () => JSON.stringify({ error: "Rate limited", code: "rate_limited" }),
    });
    await expect(askChat("hi?", cfg)).rejects.toThrow("AI_RATE_LIMITED");
  });

  it("structured 401 maps to AI_INVALID_KEY", async () => {
    await coolDown();
    const { askChat } = await import("../src/ai/analyzer");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false, status: 401,
      text: async () => JSON.stringify({ error: "bad key", code: "invalid_key" }),
    });
    await expect(askChat("hi?", cfg)).rejects.toThrow("AI_INVALID_KEY");
  });

  it("blocked_response maps to AI_BLOCKED, empty_response to AI_EMPTY", async () => {
    await coolDown();
    const { askChat } = await import("../src/ai/analyzer");
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: false, status: 502,
      text: async () => JSON.stringify({ error: "blocked", code: "blocked_response" }),
    });
    await expect(askChat("hi?", cfg)).rejects.toThrow("AI_BLOCKED");
    await coolDown();
    fetchMock.mockResolvedValue({
      ok: false, status: 502,
      text: async () => JSON.stringify({ error: "empty", code: "empty_response" }),
    });
    await expect(askChat("hi?", cfg)).rejects.toThrow("AI_EMPTY");
  });

  it("missing text maps to AI_BAD_RESPONSE", async () => {
    await coolDown();
    const { askChat } = await import("../src/ai/analyzer");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => ({}),
    });
    await expect(askChat("hi?", cfg)).rejects.toThrow("AI_BAD_RESPONSE");
  });

  it("network failure maps to AI_NETWORK", async () => {
    await coolDown();
    const { askChat } = await import("../src/ai/analyzer");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("fetch failed"));
    await expect(askChat("hi?", cfg)).rejects.toThrow("AI_NETWORK");
  });

  it("rapid second send is throttled, but resetChatThrottle lets an explicit retry through", async () => {
    await coolDown();
    const { askChat, resetChatThrottle } = await import("../src/ai/analyzer");
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ text: "x" }),
    });
    await expect(askChat("q1?", cfg)).resolves.toEqual({ text: "x" });
    await expect(askChat("q2?", cfg)).rejects.toThrow("RATE_LIMITED");
    resetChatThrottle();
    await expect(askChat("q1?", cfg)).resolves.toEqual({ text: "x" });
  });
});
