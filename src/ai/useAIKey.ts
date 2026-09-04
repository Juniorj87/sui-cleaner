/**
 * useAIKey — React hook for managing the AI API key and provider.
 *
 * The key is stored in the browser localStorage (persists until removed
 * via REMOVE KEY) and is sent to the same-origin /api/ai/* relay — then the
 * chosen AI provider — with each AI request. Never persisted or logged
 * server-side.
 * State: NOT_CONFIGURED → TESTING → READY / ERROR
 */

import { useState, useCallback, useEffect } from "react";
import type { AIProviderName } from "./provider";
import { getDefaultModel } from "./registry";

const STORAGE_KEY = "sc_ai_key";
const STORAGE_MODEL = "sc_ai_model";
const STORAGE_PROVIDER = "sc_ai_provider";

export type AIKeyState = "not_configured" | "testing" | "ready" | "error";

export interface UseAIKeyReturn {
  state: AIKeyState;
  apiKey: string;
  model: string;
  provider: AIProviderName;
  isConfigured: boolean;
  testKey: (key: string) => Promise<boolean>;
  saveKey: (key: string, provider?: AIProviderName, model?: string) => void;
  removeKey: () => void;
  setModel: (m: string) => void;
  setProvider: (p: AIProviderName) => void;
  error: string | null;
}

/** Safe storage access — tries localStorage, falls back to in-memory */
function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function loadKey(): string {
  return safeGetItem(STORAGE_KEY) ?? "";
}

function loadModel(provider: AIProviderName): string {
  return safeGetItem(STORAGE_MODEL) || getDefaultModel(provider);
}

function loadProvider(): AIProviderName {
  const p = safeGetItem(STORAGE_PROVIDER);
  if (p === "gemini" || p === "openai" || p === "anthropic" || p === "deepseek" || p === "mistral") return p;
  return "gemini";
}

export function useAIKey(): UseAIKeyReturn {
  const [apiKey, setApiKey] = useState<string>(loadKey);
  const [provider, setProviderState] = useState<AIProviderName>(loadProvider);
  const [model, setModelState] = useState<string>(() => loadModel(loadProvider()));
  const [state, setState] = useState<AIKeyState>(() => apiKey ? "ready" : "not_configured");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = loadKey();
    if (key) { setApiKey(key); setState("ready"); }
  }, []);

  const testKey = useCallback(async (key: string): Promise<boolean> => {
    setState("testing");
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test_key", apiKey: key, model, provider }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok === true) { setState("ready"); return true; }
        // Structured guidance from the proxy (billing/rate-limit/invalid) —
        // surface it instead of a generic message.
        if (data && typeof data.error === "string" && data.error) {
          setState("error");
          setError(data.error);
          return false;
        }
      }
      setState("error");
      setError("API key is invalid or the provider is unreachable.");
      return false;
    } catch {
      setState("error");
      setError("Cannot reach AI service. Check your connection.");
      return false;
    }
  }, [model, provider]);

  const saveKey = useCallback((key: string, newProvider?: AIProviderName, newModel?: string) => {
    const p = newProvider ?? provider;
    const m = newModel ?? model;
    safeSetItem(STORAGE_KEY, key);
    safeSetItem(STORAGE_PROVIDER, p);
    safeSetItem(STORAGE_MODEL, m);
    setApiKey(key);
    setProviderState(p);
    setModelState(m);
    setState("ready");
    setError(null);
  }, [provider, model]);

  const removeKey = useCallback(() => {
    safeRemoveItem(STORAGE_KEY);
    safeRemoveItem(STORAGE_MODEL);
    safeRemoveItem(STORAGE_PROVIDER);
    setApiKey("");
    setState("not_configured");
    setError(null);
  }, []);

  const setModel = useCallback((m: string) => {
    safeSetItem(STORAGE_MODEL, m);
    setModelState(m);
  }, []);

  const setProvider = useCallback((p: AIProviderName) => {
    safeSetItem(STORAGE_PROVIDER, p);
    const m = getDefaultModel(p);
    safeSetItem(STORAGE_MODEL, m);
    setModelState(m);
    setProviderState(p);
  }, []);

  return {
    state, apiKey, model, provider,
    isConfigured: state === "ready" && !!apiKey,
    testKey, saveKey, removeKey, setModel, setProvider, error,
  };
}

/** Get the current AI config for API calls (without React hook) */
export function getAIConfig(): { apiKey: string; model: string; provider: AIProviderName } | null {
  const key = safeGetItem(STORAGE_KEY);
  if (!key) return null;
  const provider = (safeGetItem(STORAGE_PROVIDER) as AIProviderName) || "gemini";
  const model = safeGetItem(STORAGE_MODEL) || getDefaultModel(provider);
  return { apiKey: key, model, provider };
}
