# Security Model — Sui Cleaner

This document describes what Sui Cleaner protects, what it never touches,
and where the trust boundaries are. It is written against the actual code;
anything marked "verified" was checked in this repository.

## 1. The one rule

**Sui Cleaner never asks the user for a seed phrase or a private key — and
the app never receives, requests, stores, logs, or transmits them.**
All 26 `PRIVATE KEY` code matches in the repo are UI copy and comments
stating exactly that; there are zero key files, zero key persistence calls,
and zero private-key-shaped secrets in the codebase (verified by pattern
scan). Scanning does not require secrets: any address can be inspected
read-only without a wallet connection.

## 2. Wallet security

- Connection happens exclusively through the user's wallet extension via
  `@mysten/dapp-kit` (`sui:mainnet` / `sui:testnet` chains). The app only
  ever receives the wallet/account information the provider exposes
  (public address) — never secrets.
- Scanning any address is read-only and needs no connection at all.
- Signing happens exclusively inside the wallet extension popup
  (`signAndExecuteTransaction`): the app builds the transaction bytes, the
  user reviews them in the wallet, approves there, and the wallet returns
  only a digest. Transaction approval remains with the user at all times.
- A 90-second wallet timeout returns the user to review instead of hanging;
  rejection lands on an explicit "cancelled — nothing was changed" screen.

## 3. Transaction security

- One atomic PTB is built per reviewed selection (`planCleanup`) and is
  invalidated the moment the selection or the scan changes.
- **Fail-closed signing gate** (`AppPage.openWallet`): signing is refused
  unless (a) a simulated plan exists, (b) dry-run simulation succeeded,
  (c) every selected object revalidates clean against the chain (any changed
  object blocks with a per-object explanation), (d) the treasury is
  configured and valid, (e) the wallet network matches.
- The success/failure verdict comes from on-chain `effects.status.status`
  ONLY (`postTxVerifier` + `txEffectAnalyzer`): `success` → SUCCESS (count
  differences become notes, never failure), `failure` → FAILED, unreadable
  block → VERIFICATION FAILED / UNKNOWN with an explorer link. Wallet popup
  text and local state can never flip the verdict.
- Financials on the Success screen come from `effects.gasUsed` +
  `balanceChanges` only (rebate, gross gas, treasury receipt, sender net
  change). Estimates are labeled ESTIMATED and live only pre-sign.

## 4. Object classification & protected objects

- Classification (`keep` / `review` / `suspicious` / `cleanable` / `protected`)
  is deterministic and is the source of truth; AI output can only raise
  caution, never lower it (server-side overrides force `PROTECTED` and
  downgrade low-confidence `SAFE_TO_CLEAN` to `REVIEW`).
- Bulk selection (`SELECT ALL CLEANABLE`) structurally excludes `protected`,
  `review`, and `suspicious` objects. Protected types (staking, kiosks,
  treasury caps) are hard-blocked from cleanup.
- Only verified mechanisms execute: `destroy_zero` (zero-balance coins),
  same-type dust merge (balance kept; lone dust kept), transfer-to-`0x0`
  for store-able NFTs/objects (no rebate — explicit UI warning), quoted
  DeFi withdraw/swap steps. Anything without a verified route stays
  untouched.

## 5. AI security & boundaries

- House rule: **CLEANER RULES DECIDE · AI EXPLAINS · USER SIGNS.**
- The AI cannot sign, build, or send transactions; it has no access to keys
  (there are none to access) and no execution path.
- Anti-hallucination layer: prompt prohibitions, deterministic output
  validator (SUI/USD/gas figures, consolidation, execution/payout promises,
  scam/value verdicts, rewards), one correction retry, grounded fallback.
  Persistent violations degrade to real context data, never to invented
  facts and never to fake "success".
- The deterministic `select_safe` action only pre-selects verified-safe
  objects into the normal review flow; every id is re-validated against the
  live scan client-side before selection.

## 6. API key handling (AI key ≠ wallet credentials)

A seed phrase controls funds and must never leave the wallet. An AI API key
only pays for the user's own AI calls. They are different secrets with
different handling:

- **Where stored:** the user's browser `localStorage` only — keys
  `sc_ai_key`, `sc_ai_provider`, `sc_ai_model`, set explicitly via the AI
  settings panel ("SAVE & VERIFY"), removable at any time ("REMOVE KEY").
  Nothing in `sessionStorage`/cookies, nothing syncs anywhere.
- **Why:** to authenticate the user's own AI provider calls.
- **Sent to the server:** yes — with each AI request the browser sends the
  key to the **same-origin** `/api/ai/*` proxy, which relays it to the
  configured AI provider (Gemini / OpenAI / Anthropic / DeepSeek / Mistral)
  in that request. It is *not* true that "the key never leaves the browser"
  or that "the server never sees the key" — the relay is the documented
  architecture.
- **Persisted by the server:** no (verified: zero file/storage writes in
  `server/`).
- **Logged by the server:** no — error/debug logs contain provider, model,
  HTTP status, finish reasons and message previews only, never key material.
- Key validation (`test_key`) and per-request failures return structured,
  actionable errors (invalid key / rate limit / unreachable) — never key
  material.

## 7. Backend transport & SSRF protection

- `/api/rpc` relays a **read-only whitelist** of Sui methods (object/balance/
  metadata reads, transaction reads, dry-run for simulation). Anything else
  → `method-not-allowed`. No write path exists through the proxy.
- `/api/config` exposes only network name and whether a treasury is
  configured — never secret values.
- `/api/ai/image-proxy` (used for IPFS/external token art) is implemented
  with https-only fetching, a host allowlist, DNS validation and redirect
  re-checks, specifically to prevent server-side request forgery and
  `ERR_BLOCKED_BY_RESPONSE` breakage.
- Security headers on API responses: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Request size caps and per-IP rate limiting are enforced server-side
  (disablable only deliberately via `DISABLE_RATE_LIMITER` when external
  limiting such as Nginx/Cloudflare is in front).

## 8. Supply-chain & build notes

- Dependencies are pinned via `package-lock.json`; audit with `npm audit`
  before release. No secrets live in code or tests (test keys are dummies
  like `AQ.test-key` / `sk-test`).
- `dist/`, `node_modules/`, `.env`, local screenshots/backups and
  `artifacts/` are git-ignored and must never be published (note: several
  hundred MB of local PNG/ZIP verification artifacts exist at the repo
  root — keep them out of version control).

## 9. Responsible disclosure

Found a vulnerability? **Do not open a public issue.** Contact the
maintainers privately with: affected version/commit, reproduction steps,
and impact assessment. Please give reasonable time to fix before any
public disclosure. Safe-harbor: good-faith research against your own
wallet/data is welcome; do not exfiltrate other users' data or disrupt
public RPC infrastructure.
