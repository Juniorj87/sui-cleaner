# Contributing to Sui Cleaner

## Setup

```bash
npm install
npm run dev      # Vite dev server (:5174)
npm run build    # tsc -b && vite build
npm run test     # vitest run (offline; LIVE_RPC=1 adds the live mainnet test)
```

Copy `.env.example` to `.env` and set at minimum `SERVICE_FEE_ADDRESS`
(a valid treasury address — real cleanup stays disabled without it).
Never commit `.env`. For browser e2e (`scripts/verify.mjs`) you need the dev
server running and a Chrome binary (`CHROME_PATH` if non-standard).

## Coding conventions

- **Evidence before synthesis.** Read the relevant files before changing
  them; existing behavior is the spec unless the task says otherwise.
- **No new audits/refactors bundled with fixes.** One change, one purpose;
  keep diffs reviewable.
- **Fail closed.** Any new gate that protects funds or classification must
  default to *refuse* on unknown states — never to *allow*.
- **No estimates presented as facts.** Pre-sign numbers are labeled
  ESTIMATED; post-sign numbers come from on-chain effects only.
- **No hardcoded financial figures** in UI copy (rebate/gas/fee values must
  flow from dry-run or effects, never literals).
- **No emojis in UI** unless explicitly requested; use lucide icons.
- **No mock/fake provider responses** in product code. Test stubs
  (`vi.stubGlobal(fetch, …)`) stay inside `tests/`.
- Relative imports, no path aliases. Comments stay concise and factual.

## AI-area rules (strict)

- Cleaner classification is the source of truth; AI output may only raise
  caution, never lower it.
- Chat stays free-text; JSON schemas only where a structured consumer
  exists. Never force `responseMimeType: json` on conversational turns.
- Every new provider-facing field needs a validator case + test in
  `tests/ai-*.test.ts`.
- Never log request bodies, API keys, or full prompt contents. Debug logs
  carry provider/model/status/reasons/previews only.
- The deterministic `select_safe` path must keep client-side re-validation
  against the live scan.

## Tests

- Add/update vitest suites with every behavior change
  (`tests/ai-chat`, `ai-hallucination`, `ai-multiquery`, `ai-wallet-intel`,
  `real-tx-regression`, `success-screen-ux`).
- Fixture-based offline tests are preferred; live RPC tests stay opt-in
  (`LIVE_RPC=1`) and must never mutate anything.
- For UI-affecting changes, attach headless-Chrome screenshots
  (`artifacts/`, git-ignored) at 390 / 768 / desktop widths.
- Green gate before review: `npx tsc -b`, `npm run test`, `npm run build`.

## PR guidelines

- One PR = one task. Link the task; paste test/build output in the PR body.
- Never include: `.env`, keys, screenshots/ZIPs from repo root, `dist/`,
  `node_modules/`, or anything under `artifacts/`, `backup_*/`, `Бэкграунд/`
  duplicates. Check `git status` for strays before pushing.
- UI PRs must show before/after screenshots and viewport coverage.
- Touching `transactionBuilder`, `postTxVerifier`, fee math, or AI guardrails
  requires a second reviewer run of the full suite plus the real-tx and AI
  regression tests.

## Security considerations

- Report vulnerabilities privately per [SECURITY.md](./SECURITY.md).
- New server endpoints: read-only by default, method whitelist, body size
  cap, no secret logging, no secret persistence.
- New AI features: no new secret storage; keys stay in the user's
  `localStorage` → same-origin relay only.
- Never weaken: the signing gate, treasury fail-safe, protected-object
  blocks, or the effects-only success verdict.
