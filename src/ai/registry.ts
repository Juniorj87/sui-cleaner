/**
 * AI Provider Registry — default models per provider.
 *
 * All actual API calls go through server/ai-proxy.mjs.
 * This module only provides client-side metadata.
 */

import type { AIProviderName } from "./provider";

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
  deepseek: "deepseek-chat",
  mistral: "mistral-small-latest",
};

/** Get the default model for a provider */
export function getDefaultModel(name: AIProviderName): string {
  return DEFAULT_MODELS[name] ?? DEFAULT_MODELS.gemini;
}
