# Sui Cleaner

Sui wallet analysis and cleanup tool. It scans any Sui address, classifies every
owned object with deterministic rules, and — only after explicit user review —
builds one atomic cleanup transaction that the user signs in their own wallet.
Destroying empty on-chain objects returns Sui storage-fund rebates to the user.

**Non-custodial by construction:** the app never receives, requests, or stores
seed phrases or private keys. See [SECURITY.md](./SECURITY.md).

> Package name in this repo: `sui-cleaner-visual` (`package.json`).
> License: MIT — see [LICENSE](./LICENSE) (`Copyright (c) 2026 SuiCleaner contributors`).

## Key features

- **Read-only wallet scan** of any Sui address (no wallet connection needed to inspect).
- **Deterministic classification** — every object lands in exactly one bucket:
  `keep` / `review` / `suspicious` / `cleanable` / `protected`.
- **Verified cleanup mechanisms only**: `coin::destroy_zero` for zero-balance
  coins, same-type dust merging (balance kept), transfer-to-`0x0` for
  store-able NFTs/objects, quoted DeFi withdraw/swap steps.
- **Fail-closed signing gate** — the transaction can only be opened in the
  wallet after a successful dry-run simulation, a configured treasury, and a
  matching network; any selected object that changed on-chain blocks signing.
- **On-chain post-transaction verification** (`postTxVerifier`) — the Success
  screen shows only values read from transaction effects, never estimates.
- **Optional Cleaner AI** (own provider key) — explains objects, never signs.
  Cleaner rules decide, AI explains, the user signs.
- **Demo mode** (`/app?demo=true`) — a 47-object fictional wallet, fully offline.

## How it works

```
Connect Wallet (optional for scanning)
↓  AppTopBar → @mysten/dapp-kit (sui:mainnet / sui:testnet)
Scan  — walletScanner.ts reads owned objects via the same-origin
│       /api/rpc proxy (public RPC by default) or /api/graphql
Analyze — objectClassifier.ts normalizes every object (type, balance,
│       package, collection, spam registry, coin metadata)
Classify — deterministic rules → keep / review / suspicious /
│       cleanable / protected  (src/scanner/objectClassifier.ts)
Review — CleanerDesk: WhatCanBeCleaned cards + WalletObjectsTable;
│       InlineDossier per object; AI dossier is explanatory only
Select — user picks objects (SELECT ALL CLEANABLE never touches
│       protected / review / suspicious)
Cleanup Plan — cleanupEngine.ts Single real PTB (+ treasury fee transfer);
│       gas resolved + dry-run simulated through the proxy
Transaction — transactionBuilder.ts: destroy_zero / mergeCoins /
│       transfer-to-0x0 / quoted swaps (+ ptbVerifier checks)
Wallet Approval — user signs EXACTLY this PTB in their wallet extension
On-chain Verification — postTxVerifier.ts fetches effects + objectChanges
│       + balanceChanges; verdict comes from effects.status.status ONLY
Success — SuccessScreen shows ACTUAL on-chain values (rebate, gross gas,
        cleaner fee, sender net change), digest + SuiScan link
```

Per-stage implementation:

| Stage | Component / file | Mechanism / data |
|---|---|---|
| Connect | `AppTopBar.tsx`, `@mysten/dapp-kit` | wallet extension holds keys; app only gets the address |
| Scan | `src/scanner/walletScanner.ts`, `server/rpc-proxy.mjs` | `suix_getOwnedObjects` family + GraphQL fallback; read-only method whitelist; spam registry (`SPAM_REGISTRY_URL`, server-cached) |
| Analyze/Classify | `src/scanner/objectClassifier.ts` | coin metadata, known protocols/collections, project registry, dust/empty detection |
| Review | `CleanerDesk.tsx`, `WalletObjectsTable.tsx`, `InlineDossier.tsx` | filters, search, per-object dossier |
| Select | `src/flow/useFlow.ts` | selection set; stale ids pruned on rescan |
| Plan | `src/cleanup/cleanupEngine.ts`, `gasSelector.ts`, `feeCalculator.ts` | gas coin selection (+ merges), dry-run breakdown |
| Transaction | `src/cleanup/transactionBuilder.ts`, `actions.ts`, `burnHandler.ts`, `swapRouter.ts` | PTB commands; Cetus quotes for swaps; fee coin split + treasury transfer |
| Approval | `AppPage.tsx` (`openWallet`) + wallet extension | `signAndExecuteTransaction`; 90s wallet timeout; reject → cancelled screen |
| Verification | `src/cleanup/postTxVerifier.ts`, `txEffectAnalyzer.ts` | `getTransactionBlock` (effects/objectChanges/balanceChanges); deleted = union of `effects.deleted` + `objectChanges[type=deleted]` by id |
| Success | `SuccessScreen.tsx` | `storageRebate − grossGas − treasuryFee = sender net change`, all from effects |

## Security

Summary only — full model in [SECURITY.md](./SECURITY.md):

- Sui Cleaner never asks the user for a seed phrase or a private key.
- No seed phrase / private key is ever received, requested, stored, or logged
  (verified: 0 key files, 0 key persistence calls server-side; the 26
  `PRIVATE KEY` code matches are UI copy stating exactly that).
- Wallet connection happens through the wallet provider (extension); the
  application only receives the wallet/account information the provider
  exposes (public address). Transaction approval remains with the user —
  signing happens exclusively in the wallet extension.
- Real cleanup is locked until: dry-run simulation succeeded, treasury
  address configured and valid, wallet network matches, pre-sign revalidation
  passes (fail-closed).
- Success vs failure comes from on-chain `effects.status.status`, never from
  wallet popup text or local state. Unverifiable = UNKNOWN, never "failed".
- **Wallet credentials vs AI API key** (different secrets, different
  handling): a seed phrase / private key controls funds and is never asked
  for, never received, and never stored. The AI API key only pays for the
  user's own AI calls: it is stored locally in the browser (`localStorage`
  keys `sc_ai_key`, `sc_ai_provider`, `sc_ai_model`), is sent to the
  same-origin `/api/ai/*` relay — then the configured AI provider — with
  each AI request, and is never persisted or logged on the server. See
  "What is stored" below.

## Architecture

```
browser (React 19 + Vite)
 ├─ pages: / Home, /app, /how-it-works, /security, /docs, /faq, /privacy, /terms
 ├─ flow: useFlow.ts (start → analyzing → report/explore → cleanup → final → sign → success)
 ├─ scanner → classifier → cleanup engine → transaction builder → verifier
 ├─ fees: serviceFeeConfig.ts, treasury.ts, gasEstimator.ts
 ├─ ai: provider.ts, registry.ts, analyzer.ts, walletContext.ts, cache.ts, useAIKey.ts
 └─ lib: proxyRpc.ts (same-origin transport), suiscan.ts, walletGroups.ts
node server (dev: vite middleware · prod: scripts/serve.mjs + dist/)
 ├─ /api/rpc       → Sui JSON-RPC (read-only whitelist; build + dry-run allowed)
 ├─ /api/graphql   → Sui GraphQL read surface
 ├─ /api/config    → network, treasury-configured flag (never secrets)
 ├─ /api/ai/*      → AI proxy (Gemini/OpenAI/Anthropic/DeepSeek/Mistral), portfolio, dust-swap quotes
 ├─ /api/quote     → Cetus swap router
 └─ /api/ai/image-proxy → CORS-safe images (https-only, host allowlist)
```

## AI

- Providers: Gemini (default `gemini-2.5-flash`), OpenAI, Anthropic, DeepSeek,
  Mistral — `src/ai/provider.ts`, `registry.ts`.
- Chat contract is **free text**: valid provider text is shown as-is; JSON is
  demanded only by the structured object-analysis path.
- Every chat request carries structured `walletContext`
  (`src/ai/walletContext.ts`): total + `safe/review/keep` counts, empty /
  with-balance counts, per-object entries (name, object id, coin type,
  classification, balance, reason, rebate/merge mechanics) — public on-chain
  data only.
- **Anti-hallucination layer** (`server/ai-proxy.mjs`): prompt prohibitions +
  deterministic output validator (SUI/USD/gas figures, consolidation,
  execution/payout promises, scam/value verdicts, rewards) + one correction
  retry + grounded deterministic fallback. Valid answers pass untouched.
- **Multi-question**: one message is split into intents; ≥2 questions get one
  numbered section each; single questions keep the legacy flow.
- **Structured errors** end-to-end (rate-limited / invalid key / bad model /
  blocked / empty / unreachable / network) with distinct UI states; real
  causes are logged server-side and in dev console, never masked.
- Deterministic `select_safe` action pre-selects verified-safe objects into
  the existing review flow — AI never signs, never executes.

Rule of the house: **CLEANER RULES DECIDE · AI EXPLAINS · USER SIGNS.**

## Cleanup mechanisms

Actually implemented in `src/cleanup/` (nothing else is offered):

- **destroy_zero** — zero-balance `Coin` objects via `0x2::coin::destroy_zero`;
  the object is destroyed, the storage rebate returns.
- **Dust merge** — same-type dust micro-balances merged into one coin with
  `mergeCoins`; the balance stays in the wallet, emptied containers are
  consumed (rebate returns). A lone dust coin with no merge partner is KEPT,
  never burned.
- **NFT/object burn** — verified path is transfer to the `0x0` burn address;
  the object leaves the wallet permanently but **no storage rebate returns**
  (explicit UI warning). Official module burns where catalogued.
- **Withdraw / swap-to-SUI** — DeFi receipts redeemed and non-SUI dust
  converted via quoted Cetus routes; without a quote the token stays
  untouched (never guessed, never burned).
- **Gas handling** — largest coin pays; extra coins merged into gas only as
  needed to cover fee + gas.

Never automatically cleaned: `protected` and `keep` objects, `review` /
`suspicious` objects, lone dust, swaps without a quote, unverified burns.

## Fees

- **Cleaner fee (flat): 0.015 SUI** (`SERVICE_FEE_MIST = 15_000_000`) per
  cleanup transaction, transferred to the public treasury address.
- **Network gas**: real dry-run estimate pre-sign; actual gross gas
  (`computation + storage`) read from effects post-sign.
- **Storage rebate**: dry-run estimate pre-sign; actual `storageRebate` from
  effects post-sign.
- **Net result** (the formula used everywhere):
  `storage rebate − network gas − cleaner fee = net result`.
- **PRE-TRANSACTION ESTIMATE vs ACTUAL ON-CHAIN RESULT**: review screens are
  explicitly labeled ESTIMATED; the Success screen shows only verified
  on-chain values (rebate `0.003596472`, gross gas `0.002076`, fee `0.015`,
  net `-0.013479528` SUI on reference tx
  `5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb`).
- Demo mode uses fixed demo figures (`0.00142` network, `0.015` cleaner).

## Transaction flow

Built once per selection (`planCleanup`), invalidated when selection or scan
changes. Signing requires: plan transaction present, every selected object
revalidated OK, treasury configured, wallet on the right network, dry-run
method recorded. After signing, `verifyPostTransaction` decides by
`effects.status.status`: `success` → SUCCESS (count differences become notes,
never failure), `failure` → FAILED ("nothing assumed cleaned" appears ONLY
here), unreadable → VERIFICATION FAILED / UNKNOWN with explorer link.
Sender net change is preferred from `balanceChanges`, falling back to
`rebate − grossGas − fee`. Treasury receipt is verified against the
configured address and exact fee.

## What is stored

| Data | Where | Why | Sensitive? | Sent to server? |
|---|---|---|---|---|
| Wallet address | wallet extension + React state (memory) | scan + sign | No (public) | Yes — as RPC params (public data) |
| Scan objects/metadata | React state (memory) | display, plan | No (public on-chain) | No (client-side; only ids in tx) |
| AI API key | `localStorage` (`sc_ai_key`, `sc_ai_provider`, `sc_ai_model`) | user-owned AI access | **Yes — handle carefully** | Yes — to same-origin `/api/ai/*`, relayed to the AI provider; never logged/stored server-side |
| Private key / seed phrase | **nowhere — never touched** | — | N/A | Never |
| Transaction digest | React state + UI | verification + explorer link | No | Only as read params to RPC |
| Object metadata sent to AI | request body | explanations | No (public on-chain) | Yes — to AI provider via proxy |

## Installation

Requirements: Node.js 18+ (22 used here), npm, a Sui wallet extension (e.g.
Slayer/Sui Wallet) for signing, Chrome for the e2e scripts.

```bash
npm install
npm run dev      # Vite on :5174 (see vite.config.ts)
npm run build    # tsc -b && vite build
npm run start    # serve dist/ via scripts/serve.mjs (PORT env, default 4173)
npm run test     # vitest run
```

## Environment variables

See [.env.example](./.env.example) (names only, no secrets):

| Variable | Purpose | Default |
|---|---|---|
| `NETWORK` | `mainnet` / `testnet` | `mainnet` |
| `SUI_RPC_URL` | upstream Sui JSON-RPC | `https://sui.publicnode.com` |
| `SUI_GRAPHQL_URL` | upstream GraphQL override | derived from `NETWORK` |
| `SERVICE_FEE_ADDRESS` | public treasury (0x…); real cleanup stays **disabled** until valid | — (required) |
| `SPAM_REGISTRY_URL` | spam package list JSON (server-cached) | — (optional) |
| `BLOCKBERRY_API_KEY` | portfolio enrichment (optional; RPC fallback without it) | — |
| `CETUS_QUOTE_URL` / `CETUS_QUOTE_VERSION` | swap quotes | Cetus mainnet router |
| `PORT` | production server port | `4173` |
| `DISABLE_RATE_LIMITER` | disable built-in limiter (use with external limiting) | `false` |
| `AI_DEBUG` | verbose AI provider logging (dev only; never logs keys) | on outside production |

## Development

- `npm run dev` — programmatic Vite server (`scripts/dev.mjs`, UTF-8 console).
- `npm run check:encoding` — encoding hygiene script.
- Path aliasing: none — relative imports throughout.
- Styling: Tailwind v4 (`@tailwindcss/vite`) + `src/index.css` +
  `src/styles/*.css` (workspace-vault, visual app, per-page Home.css).
- AI panel, Success screen and workspace are covered by `@media` rules
  (390 / 768 / desktop verified via headless screenshots in `artifacts/`).

## Testing

```bash
npm run test          # all vitest suites (offline except LIVE_RPC=1)
LIVE_RPC=1 npm run test  # includes live mainnet regression (needs network)
node scripts/verify.mjs  # real-browser journey (needs dev server + Chrome)
```

Suites: `real-tx-regression` (fixture tx `5RcaXX…`), `success-screen-ux`,
`ai-chat`, `ai-hallucination`, `ai-multiquery`, `ai-wallet-intel`
(+ `real-tx-live`, skipped by default). E2E helpers: `e2e-acceptance.mjs`,
`e2e-selection.mjs`, `test-redesign.mjs`.

## Production

`npm run build && npm run start` with env set (`NETWORK`, `SUI_RPC_URL`,
`SERVICE_FEE_ADDRESS`, `PORT`). The server sets `nosniff`/`DENY`
frame/`strict-origin` referrer headers; RPC writes are impossible through
the proxy (read-only whitelist + dry-run); put it behind HTTPS and (if
exposed) external rate limiting. Never commit `.env`.

## Known limitations

- Signing requires a Sui wallet browser extension; scanning does not.
- Depends on upstream Sui RPC/GraphQL availability and rate limits.
- AI requires the user's own provider key and is subject to provider
  quotas — free Gemini (`AIza…`) keys are rate-limited/unstable (the UI
  says so and surfaces structured errors, never fake answers).
- No portfolio valuation and no reward detection exist — the AI must not
  invent prices, USD values, rewards, or APYs (enforced by guardrails).
- NFT/object removals usually go to `0x0` with **no** storage rebate.
- Swaps need a live Cetus quote; lone dust and unquotable tokens are kept.
- Multi-turn AI context is capped (last 12 turns server-side).
- Demo numbers are illustrative, not on-chain data.

## Roadmap

- "Find what I forgot" spotlight over known objects (no fake detectors —
  architecture hook exists in `walletContext` buckets).
- More quoted DeFi withdraw routes as mechanisms get verified.
- Mobile app-shell polish; extended e2e matrix.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues: see
[SECURITY.md](./SECURITY.md) — report privately, never in a public issue.
