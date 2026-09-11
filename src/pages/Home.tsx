import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Home.css";
import allImg from "../assets/all3.jpg";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

interface NetworkStats {
  suiUsd: number | null;
  checkpoint: number | null;
}

/** Live Sui network facts (price + checkpoint). Silent when unavailable. */
function NetworkStrip() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/network-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && (d.suiUsd || d.checkpoint)) setStats(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!stats) return null;
  return (
    <div className="sc-hero-live" aria-label="Live network status">
      <span className="sc-pill-dot" aria-hidden="true" />
      <span>LIVE</span>
      {typeof stats.suiUsd === "number" && <span>SUI ${stats.suiUsd.toFixed(2)}</span>}
      {typeof stats.checkpoint === "number" && (
        <span>CHECKPOINT #{stats.checkpoint.toLocaleString("en-US")}</span>
      )}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const goClean = () => navigate("/app");
  const goHow = () => navigate("/how-it-works");

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Preview only — questions already answered by the sections above
  // (what it is, rebates, safety, custody, fees) are intentionally left out.
  // Full answers live on /faq.
  const FAQ_ITEMS = [
    {
      q: "Which wallets are supported?",
      a: "All standard Sui wallets via the official @mysten/dapp-kit standard, including Sui Wallet, Suiet, Nightly, Martian, OKX Wallet, Phantom, Bitget Wallet, and Ledger hardware wallets."
    },
    {
      q: "What does it mean when an object is in Review?",
      a: "Its Move package is not in the verified registry — for example a custom game item, a test token, or an unverified contract. It stays out of cleanup until you inspect it and decide."
    },
    {
      q: "What happens if a cleanup transaction fails?",
      a: "All cleanup commands run as one atomic Programmable Transaction Block. If any command fails, the whole transaction reverts with zero state changes — your assets stay untouched."
    },
    {
      q: "Is the wallet scan really free and read-only?",
      a: "Yes. Scanning only reads public on-chain state through JSON-RPC. No signature, no gas, no fees — cleanup is the only step that costs anything."
    }
  ];

  return (
    <main className="sc-landing">
      {/* HEADER */}
      <SiteHeader />

      {/* MASTER CINEMATIC WRAPPER */}
      <div className="sc-master-wrap">
        <div className="sc-master-bg" aria-hidden="true">
          <img
            src={allImg}
            alt="Sui Cleaner Background"
            className="sc-master-img"
            decoding="async"
            fetchPriority="high"
          />
          <div className="sc-master-overlay" aria-hidden="true" />
        </div>

        {/* HERO SECTION */}
        <section className="sc-hero" aria-label="Hero">
          <div className="sc-container">
            <div className="sc-hero-grid">
              <div className="sc-hero-copy">
                <NetworkStrip />
                <div className="sc-eyebrow">SUI OBJECT MANAGEMENT & STORAGE REBATE ENGINE</div>
                <h1>
                  Clean your Sui wallet.
                  <strong>Keep what matters. Reclaim SUI.</strong>
                </h1>
                <p className="sc-hero-desc">
                  Find unused and reclaimable objects in your Sui wallet, review what can be safely cleaned, and see your estimated storage recovery before you approve anything.
                </p>

                <div className="sc-hero-pills">
                  <div className="sc-pill">
                    <span className="sc-pill-dot" />
                    <span>100% Non-Custodial</span>
                  </div>
                  <div className="sc-pill">
                    <span className="sc-pill-dot" />
                    <span>Read-Only Scanning</span>
                  </div>
                  <div className="sc-pill">
                    <span className="sc-pill-dot" />
                    <span>Reclaim Storage Rebates</span>
                  </div>
                  <div className="sc-pill">
                    <span className="sc-pill-dot" />
                    <span>Atomic PTB Execution</span>
                  </div>
                  <div className="sc-pill">
                    <span className="sc-pill-dot" />
                    <span>Staking & Kiosks Protected</span>
                  </div>
                </div>

                <div className="sc-hero-actions">
                  <button className="sc-primary sc-primary--large" type="button" onClick={goClean}>
                    CLEAN MY WALLET
                  </button>
                  <Link to="/app?demo=true" className="sc-secondary">
                    TRY DEMO
                  </Link>
                  <button className="sc-secondary" type="button" onClick={goHow}>
                    HOW IT WORKS
                  </button>
                  <Link to="/app?scan=" className="sc-secondary">
                    SCAN ANY ADDRESS
                  </Link>
                </div>

                <div className="sc-hero-trust">
                  <span>✓ No Seed Phrase</span>
                  <span>·</span>
                  <span>✓ Pre-Execution Dry Run</span>
                  <span>·</span>
                  <span>✓ You Approve Every Action</span>
                </div>

                <div className="sc-hero-trust" style={{ marginTop: 10 }}>
                  <span>Scan → Classify → Review → Clean — nothing is deleted automatically, and estimates never promise a fixed return.</span>
                </div>

                <div className="sc-hero-proof">
                  <span>✓ Verified on-chain cleanup: +0.003596472 SUI rebate</span>
                  <Link to="/proof">View proof →</Link>
                </div>
              </div>

              {/* EXAMPLE SCAN PREVIEW — static illustration, not a real wallet */}
              <div className="sc-sim-card" aria-label="Example Scan Preview">
                <div className="sc-sim-header">
                  <span className="sc-sim-title">EXAMPLE SCAN · PREVIEW</span>
                  <span className="sc-sim-badge">EXAMPLE</span>
                </div>

                <div className="sc-sim-stat-main">
                  <div className="sc-sim-num">47</div>
                  <div className="sc-sim-label">Total On-Chain Objects Discovered</div>
                </div>

                <div className="sc-sim-grid">
                  <div className="sc-sim-item">
                    <div className="sc-sim-item-info">
                      <span style={{ color: "var(--sc-emerald)" }}>KEEP</span>
                      <small>Tokens & Verified NFTs</small>
                    </div>
                    <div className="sc-sim-item-count" style={{ color: "var(--sc-emerald)" }}>14</div>
                  </div>

                  <div className="sc-sim-item">
                    <div className="sc-sim-item-info">
                      <span style={{ color: "var(--sc-coral)" }}>CLEANUP</span>
                      <small>Zero-Balance & Dust</small>
                    </div>
                    <div className="sc-sim-item-count" style={{ color: "var(--sc-coral)" }}>19</div>
                  </div>

                  <div className="sc-sim-item">
                    <div className="sc-sim-item-info">
                      <span style={{ color: "var(--sc-indigo)" }}>PROTECTED</span>
                      <small>Staking & Kiosk Caps</small>
                    </div>
                    <div className="sc-sim-item-count" style={{ color: "var(--sc-indigo)" }}>3</div>
                  </div>

                  <div className="sc-sim-item">
                    <div className="sc-sim-item-info">
                      <span style={{ color: "var(--sc-amber)" }}>REVIEW</span>
                      <small>Unverified Contracts</small>
                    </div>
                    <div className="sc-sim-item-count" style={{ color: "var(--sc-amber)" }}>11</div>
                  </div>
                </div>

                <div className="sc-sim-rebate">
                  <div className="sc-sim-rebate-text">
                    <span>ESTIMATED STORAGE REBATE</span>
                    <small>Refunded directly from Sui Storage Fund</small>
                  </div>
                  <div className="sc-sim-rebate-val">+0.042 SUI</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--sc-text-muted)", marginBottom: 14 }}>
                  <span>Service Fee: <b>0.015 SUI</b></span>
                  <span>Net Estimated Gain: <b style={{ color: "var(--sc-emerald)" }}>+0.026 SUI</b></span>
                </div>

                <button
                  className="sc-primary"
                  style={{ width: "100%", height: 44 }}
                  type="button"
                  onClick={goClean}
                >
                  CLEAN MY WALLET
                </button>

                <div style={{ marginTop: 10, fontSize: 12, color: "var(--sc-text-muted)", textAlign: "center" }}>
                  Example figures — your scan results will differ. Actual recovery depends on the objects removed and the resulting transaction.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: WHY SUI WALLETS GET CLUTTERED (THE SUI MOVE OBJECT MODEL) */}
        <section className="sc-section" id="why" aria-label="Why Sui Wallets Get Cluttered">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">THE SUI MOVE ARCHITECTURE & STORAGE FUND</div>
              <h2 className="sc-section-title">
                Why Sui Wallets Accumulate <strong>On-Chain Bloat</strong>
              </h2>
              <p className="sc-section-subtitle">
                Unlike Ethereum’s account balance model, Sui is an object-centric blockchain. Every token, receipt, and interaction creates an independent on-chain Move object that locks a storage fee.
              </p>
            </div>

            <div className="sc-why-box">
              <div className="sc-why-grid">
                {/* Column 1: The Problem */}
                <div className="sc-why-col sc-why-col--bad">
                  <div className="sc-why-header" style={{ color: "var(--sc-coral)" }}>
                    <span>⚠</span> The Problem: Residual Wallet Objects
                  </div>
                  <ul className="sc-why-list">
                    <li>
                      <strong>Empty Coin Wrappers:</strong> When you swap or transfer all your tokens, the <code>Coin&lt;T&gt;</code> object often remains in your wallet with a <code>balance = 0</code>, permanently occupying storage.
                    </li>
                    <li>
                      <strong>Dust Fragmentation:</strong> Interacting with DEXes and dApps fragments your balance into dozens of tiny coin objects, increasing future transaction gas costs.
                    </li>
                    <li>
                      <strong>Spam & Phishing Airdrops:</strong> Malicious actors send spam NFTs and fake tokens to public addresses to advertise scam URLs in object metadata.
                    </li>
                    <li>
                      <strong>Orphaned DeFi Receipts:</strong> Closed staking positions and expired liquid staking tickets linger as dead objects in your wallet inventory.
                    </li>
                  </ul>
                </div>

                {/* Column 2: The Solution */}
                <div className="sc-why-col sc-why-col--good">
                  <div className="sc-why-header" style={{ color: "var(--sc-emerald)" }}>
                    <span>✦</span> The Solution: Sui Cleaner Storage Rebate Engine
                  </div>
                  <ul className="sc-why-list">
                    <li>
                      <strong>Reclaim Real SUI:</strong> Calling Move <code>0x2::coin::destroy_zero</code> safely destroys empty coin objects and refunds their locked storage deposit directly back to your wallet.
                    </li>
                    <li>
                      <strong>Consolidate Dust:</strong> Automatically merges multiple small coin objects of the same type into one primary coin via <code>0x2::coin::merge</code>.
                    </li>
                    <li>
                      <strong>Spam Disposal:</strong> Unwanted spam NFTs are cleanly transferred to the burn address <code>0x0</code> via non-custodial Move calls.
                    </li>
                    <li>
                      <strong>DeFi Position Recovery:</strong> Detects redeemable liquidity positions (Cetus LP, Scallop sCoins, SpringSui sSUI) and provides verified recovery routes.
                    </li>
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: 28, padding: 18, borderRadius: 12, background: "rgba(35, 196, 255, 0.06)", border: "1px solid rgba(35, 196, 255, 0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <b style={{ color: "var(--sc-cyan)", fontSize: 15 }}>Don&apos;t just hide spam in wallet UI settings.</b>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--sc-text-body)" }}>
                    Destroy empty objects on-chain to reclaim your locked SUI storage fund rebate.
                  </p>
                </div>
                <button className="sc-primary" type="button" onClick={goClean}>
                  CLEAN MY WALLET
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: WHAT SUI CLEANER CAN DO WITH YOUR OBJECTS (MECHANISMS) */}
        <section className="sc-section" aria-label="Cleanup mechanisms">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">CLEANUP MECHANISMS</div>
              <h2 className="sc-section-title">
                See what Sui Cleaner can <strong>do with your objects</strong>
              </h2>
              <p className="sc-section-subtitle">
                Four verified Move execution paths. What each of your objects falls into is a separate decision — see the classification below.
              </p>
            </div>

            <div className="sc-zone-grid">
              {/* ZONE 1: CLEAN */}
              <div className="sc-zone-card sc-zone-card--clean">
                <div className="sc-zone-top">
                  <span className="sc-zone-icon">🧹</span>
                  <span className="sc-zone-tag" style={{ background: "rgba(35, 196, 255, 0.12)", color: "var(--sc-cyan)" }}>
                    CLEAN ZONE
                  </span>
                </div>
                <h3 className="sc-zone-title">Object Destruction</h3>
                <p className="sc-zone-desc">
                  Safely destroys zero-balance coin containers and merges dust fragments, immediately reclaiming locked storage rebates.
                </p>
                <ul className="sc-zone-items">
                  <li><code>✓ 0x2::coin::destroy_zero</code></li>
                  <li><code>✓ 0x2::coin::merge (Dust)</code></li>
                  <li><code>✓ 0x2::transfer::transfer(0x0)</code></li>
                  <li><code>✓ Instant Storage Rebate Refund</code></li>
                </ul>
              </div>

              {/* ZONE 2: SWEEP */}
              <div className="sc-zone-card sc-zone-card--sweep">
                <div className="sc-zone-top">
                  <span className="sc-zone-icon">🔄</span>
                  <span className="sc-zone-tag" style={{ background: "rgba(255, 201, 79, 0.12)", color: "var(--sc-gold)" }}>
                    SWEEP ZONE
                  </span>
                </div>
                <h3 className="sc-zone-title">Auto-Sweep to SUI</h3>
                <p className="sc-zone-desc">
                  Liquidates fragmented altcoins and unwanted token balances into native SUI using verified decentralized liquidity pools.
                </p>
                <ul className="sc-zone-items">
                  <li><code>✓ Cetus CLMM Router Swap</code></li>
                  <li><code>✓ Slippage Protected Execution</code></li>
                  <li><code>✓ Multi-Token Batch Routing</code></li>
                  <li><code>✓ Consolidate to Native SUI</code></li>
                </ul>
              </div>

              {/* ZONE 3: RECOVER */}
              <div className="sc-zone-card sc-zone-card--recover">
                <div className="sc-zone-top">
                  <span className="sc-zone-icon">♻️</span>
                  <span className="sc-zone-tag" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--sc-emerald)" }}>
                    RECOVER ZONE
                  </span>
                </div>
                <h3 className="sc-zone-title">DeFi Recovery</h3>
                <p className="sc-zone-desc">
                  Identifies forgotten liquidity pools, lending deposits, and liquid staking positions to redeem collateral back to your wallet.
                </p>
                <ul className="sc-zone-items">
                  <li><code>✓ Cetus LP Position Withdraw</code></li>
                  <li><code>✓ Scallop sCoin Redemption</code></li>
                  <li><code>✓ SpringSui sSUI Unstake</code></li>
                  <li><code>✓ Navi &amp; Suilend Detection</code></li>
                </ul>
              </div>

              {/* ZONE 4: REVIEW */}
              <div className="sc-zone-card sc-zone-card--review">
                <div className="sc-zone-top">
                  <span className="sc-zone-icon">📋</span>
                  <span className="sc-zone-tag" style={{ background: "rgba(129, 140, 248, 0.12)", color: "var(--sc-indigo)" }}>
                    REVIEW ZONE
                  </span>
                </div>
                <h3 className="sc-zone-title">Technical Dossier</h3>
                <p className="sc-zone-desc">
                  Inspects unknown Move packages, custom structs, dynamic fields, and AI metadata summaries before you take any action.
                </p>
                <ul className="sc-zone-items">
                  <li><code>✓ Move Struct Bytecode Analysis</code></li>
                  <li><code>✓ AI Explanatory Dossier</code></li>
                  <li><code>✓ Dynamic Field Resolution</code></li>
                  <li><code>✓ Manual Approval Control</code></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: HOW IT WORKS (6-STEP WORKFLOW) */}
        <section className="sc-section" aria-label="How it works workflow">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">DETERMINISTIC LIFECYCLE</div>
              <h2 className="sc-section-title">
                How Sui Cleaner <strong>Executes in 6 Phases</strong>
              </h2>
              <p className="sc-section-subtitle">
                A non-custodial pipeline: dry-run simulation before signing, protected objects hard-blocked, and every result verified against on-chain effects.
              </p>
            </div>

            <div className="sc-flow-grid">
              <div className="sc-flow-step">
                <div className="sc-flow-num">01</div>
                <h3 className="sc-flow-title">Connect Wallet</h3>
                <p className="sc-flow-desc">
                  Connect via official <code>@mysten/dapp-kit</code>. Only your public address is read. Your private key and seed phrase never leave your device.
                </p>
              </div>

              <div className="sc-flow-step">
                <div className="sc-flow-num">02</div>
                <h3 className="sc-flow-title">Deep On-Chain Scan</h3>
                <p className="sc-flow-desc">
                  Paginated RPC &amp; GraphQL scan fetches every owned object, struct type, package ID, coin balance, and Move <code>store</code> ability without altering state.
                </p>
              </div>

              <div className="sc-flow-step">
                <div className="sc-flow-num">03</div>
                <h3 className="sc-flow-title">Intelligent Classification</h3>
                <p className="sc-flow-desc">
                  Objects are automatically matched against verified protocol registries: KEEP (valuable), PROTECTED (staking/caps), REVIEW (unknown), and CLEANABLE.
                </p>
              </div>

              <div className="sc-flow-step">
                <div className="sc-flow-num">04</div>
                <h3 className="sc-flow-title">Granular User Review</h3>
                <p className="sc-flow-desc">
                  You see an itemized breakdown of every candidate object. Check or uncheck items freely. Nothing is selected or queued without your explicit choice.
                </p>
              </div>

              <div className="sc-flow-step">
                <div className="sc-flow-num">05</div>
                <h3 className="sc-flow-title">PTB Build &amp; Dry-Run</h3>
                <p className="sc-flow-desc">
                  Builds an atomic Programmable Transaction Block (PTB) and simulates it on-chain (dryRun) to calculate exact network gas and storage rebate refunds.
                </p>
              </div>

              <div className="sc-flow-step">
                <div className="sc-flow-num">06</div>
                <h3 className="sc-flow-title">Signature &amp; Post-TX Verification</h3>
                <p className="sc-flow-desc">
                  You sign once in your wallet. After block confirmation, <code>verifyPostTransaction</code> rescans the wallet to confirm exact object removals and fee integrity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: DECISION SYSTEM — WHAT TO DO WITH EACH OBJECT */}
        <section className="sc-section" aria-label="Classification decision system">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">DECISION SYSTEM · SAFETY BY DESIGN</div>
              <h2 className="sc-section-title">
                What to do with <strong>each object</strong>
              </h2>
              <p className="sc-section-subtitle">
                Every object gets one clear recommendation — Cleanup, Review, Keep, or Protected — decided by deterministic on-chain rules. AI only explains the decision, never makes it.
              </p>
            </div>

            <div className="sc-cat-grid">
              {/* KEEP */}
              <div className="sc-cat-card sc-cat-card--keep">
                <span className="sc-cat-badge sc-cat-badge--keep">KEEP</span>
                <h3 className="sc-cat-title">Active Assets</h3>
                <p className="sc-cat-desc">
                  All coins with positive balances, recognized tokens (SUI, USDC, CETUS), verified NFT collections, and active DeFi assets. Never queued for deletion.
                </p>
                <div className="sc-cat-examples">
                  Examples: SUI, USDC, Prime Machin, Rootlets, active LP receipts.
                </div>
              </div>

              {/* PROTECTED */}
              <div className="sc-cat-card sc-cat-card--protected">
                <span className="sc-cat-badge sc-cat-badge--protected">PROTECTED</span>
                <h3 className="sc-cat-title">System Singletons</h3>
                <p className="sc-cat-desc">
                  Objects essential to your wallet security and staking. Hard-blocked by code from being touched or included in cleanup transactions.
                </p>
                <div className="sc-cat-examples">
                  Examples: StakedSui, KioskOwnerCap, TreasuryCap, UpgradeCap.
                </div>
              </div>

              {/* REVIEW */}
              <div className="sc-cat-card sc-cat-card--review">
                <span className="sc-cat-badge sc-cat-badge--review">REVIEW</span>
                <h3 className="sc-cat-title">Unverified Structs</h3>
                <p className="sc-cat-desc">
                  Unknown packages, custom Move structs, or ambiguous tokens lacking public market registry entries. Requires manual inspection before any action.
                </p>
                <div className="sc-cat-examples">
                  Examples: Unverified airdrops, test tokens, custom game assets.
                </div>
              </div>

              {/* CLEANUP CANDIDATES */}
              <div className="sc-cat-card sc-cat-card--cleanable">
                <span className="sc-cat-badge sc-cat-badge--cleanable">CLEANUP CANDIDATES</span>
                <h3 className="sc-cat-title">Zero-Balance &amp; Dust</h3>
                <p className="sc-cat-desc">
                  Empty coin objects (balance = 0), dust coins with negligible value, and confirmed spam objects with verified Move destruction paths.
                </p>
                <div className="sc-cat-examples">
                  Examples: Empty Coin&lt;SUI&gt;, dust fragments, scam NFT drops.
                </div>
              </div>
            </div>

            <p className="sc-section-subtitle" style={{ marginTop: 28, textAlign: "center" }}>
              Candidate ≠ guaranteed safe deletion. Every cleanup is shown for review first, and nothing happens until you sign the transaction in your wallet.
            </p>
          </div>
        </section>

        {/* SECTION 5: SECURITY MANDATES */}
        <section className="sc-section" aria-label="Security Mandates">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">NON-CUSTODIAL INTEGRITY</div>
              <h2 className="sc-section-title">
                Zero Trust. <strong>Bank-Grade On-Chain Security.</strong>
              </h2>
              <p className="sc-section-subtitle">
                Built specifically to adhere to strict Move security standards. We have zero access to your assets at any point.
              </p>
            </div>

            <div className="sc-sec-grid">
              <div className="sc-sec-card">
                <div className="sc-sec-header">
                  <span className="sc-sec-icon">🔒</span>
                  <h3 className="sc-sec-title">Non-Custodial Architecture</h3>
                </div>
                <p className="sc-sec-desc">
                  Sui Cleaner never acts as an intermediary or custodian. Transactions execute directly between your wallet and the Sui blockchain via atomic PTBs.
                </p>
              </div>

              <div className="sc-sec-card">
                <div className="sc-sec-header">
                  <span className="sc-sec-icon">🛡</span>
                  <h3 className="sc-sec-title">Zero Private Key Exposure</h3>
                </div>
                <p className="sc-sec-desc">
                  Your seed phrase and private keys never leave your browser extension or hardware wallet. Scanning uses public read-only JSON-RPC endpoints.
                </p>
              </div>

              <div className="sc-sec-card">
                <div className="sc-sec-header">
                  <span className="sc-sec-icon">⚡</span>
                  <span className="sc-sec-title">Fail-Closed Move Verification</span>
                </div>
                <p className="sc-sec-desc">
                  If an object’s Move entry point or package bytecode cannot be verified on the current network, cleanup execution is automatically blocked.
                </p>
              </div>

              <div className="sc-sec-card">
                <div className="sc-sec-header">
                  <span className="sc-sec-icon">🧪</span>
                  <h3 className="sc-sec-title">Pre-Execution Dry-Run</h3>
                </div>
                <p className="sc-sec-desc">
                  Every cleanup transaction is pre-simulated on the node before asking for your signature. You see exact gas costs and storage rebate gains up front.
                </p>
              </div>

              <div className="sc-sec-card">
                <div className="sc-sec-header">
                  <span className="sc-sec-icon">🤖</span>
                  <h3 className="sc-sec-title">Sandboxed AI Advisory Layer</h3>
                </div>
                <p className="sc-sec-desc">
                  Our AI assistant only explains object metadata. The AI cannot create, modify, or sign transaction blocks. Move rules decide; you sign.
                </p>
              </div>

              <div className="sc-sec-card">
                <div className="sc-sec-header">
                  <span className="sc-sec-icon">🔍</span>
                  <h3 className="sc-sec-title">Post-TX State Delta Audit</h3>
                </div>
                <p className="sc-sec-desc">
                  After block execution, the app rescans your address to verify that only the approved object IDs were removed and gas matched estimates.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: TRANSPARENT PRICING & STORAGE REBATES */}
        <section className="sc-section" aria-label="Pricing and Economics">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">TRANSPARENT PRICING</div>
              <h2 className="sc-section-title">
                Simple, Fair &amp; <strong>Transparent Fees</strong>
              </h2>
              <p className="sc-section-subtitle">
                Read-only analysis is completely free. Cleanup carries a flat 0.015 SUI service fee, kept separate from any recovery. Estimated recovery is shown up front — actual recovery depends on the objects removed and the resulting transaction.
              </p>
            </div>

            <div className="sc-price-grid">
              {/* CARD 1: SCAN */}
              <div className="sc-price-card">
                <span className="sc-price-tag">READ-ONLY AUDIT</span>
                <div className="sc-price-val">
                  <strong>FREE</strong>
                </div>
                <div className="sc-price-sub">Deep wallet scan and object classification</div>
                <ul className="sc-price-features">
                  <li><span className="sc-price-check">✓</span> Comprehensive on-chain object inventory</li>
                  <li><span className="sc-price-check">✓</span> Storage rebate reclaim estimation</li>
                  <li><span className="sc-price-check">✓</span> Automatic KEEP vs CLEANABLE classification</li>
                  <li><span className="sc-price-check">✓</span> Protected singleton detection (StakedSui, Kiosks)</li>
                  <li><span className="sc-price-check">✓</span> Scan any public address without connecting</li>
                </ul>
                <Link to="/app?scan=" className="sc-secondary" style={{ width: "100%", textAlign: "center" }}>
                  TRY FREE SCAN
                </Link>
              </div>

              {/* CARD 2: CLEANUP */}
              <div className="sc-price-card sc-price-card--featured">
                <span className="sc-price-tag" style={{ color: "var(--sc-gold)" }}>CLEANUP TRANSACTION</span>
                <div className="sc-price-val">
                  <strong>0.015 SUI</strong>
                  <span style={{ fontSize: 16, color: "var(--sc-text-muted)", fontWeight: 500 }}> / tx</span>
                </div>
                <div className="sc-price-sub">Flat service fee paid to public treasury + network gas</div>
                <ul className="sc-price-features">
                  <li><span className="sc-price-check">✓</span> Batch destruction of empty Move coins</li>
                  <li><span className="sc-price-check">✓</span> Instant Storage Fund rebate refund to your wallet</li>
                  <li><span className="sc-price-check">✓</span> Dust token consolidation &amp; merging</li>
                  <li><span className="sc-price-check">✓</span> Transfer spam NFTs to 0x0 burn address</li>
                  <li><span className="sc-price-check">✓</span> Pre-transaction dry-run simulation &amp; post-tx audit</li>
                </ul>
                <button className="sc-primary" style={{ width: "100%" }} type="button" onClick={goClean}>
                  START CLEANING
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: FAQ ACCORDION PREVIEW */}
        <section className="sc-section" aria-label="Frequently Asked Questions">
          <div className="sc-container sc-container--narrow">
            <div className="sc-section-head">
              <div className="sc-eyebrow">COMMON QUESTIONS</div>
              <h2 className="sc-section-title">
                Frequently Asked <strong>Questions</strong>
              </h2>
              <p className="sc-section-subtitle">
                Everything you need to know about Sui Move objects, storage rebates, and non-custodial safety.
              </p>
            </div>

            <div className="sc-faq-group">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="sc-faq-item">
                  <button
                    type="button"
                    className="sc-faq-btn"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span className="sc-faq-q">{item.q}</span>
                    <span className="sc-faq-icon">{openFaq === i ? "−" : "+"}</span>
                  </button>
                  {openFaq === i && (
                    <div className="sc-faq-body">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <Link to="/faq" className="sc-secondary">
                VIEW ALL FAQS →
              </Link>
            </div>
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="sc-section" aria-label="Final Call to Action">
          <div className="sc-container">
            <div className="sc-cta-box">
              <h2>
                Ready to Declutter Your Wallet &amp; <strong>Reclaim SUI?</strong>
              </h2>
              <p>
                Join thousands of Sui users optimizing their on-chain storage footprint with safe, non-custodial object cleanup.
              </p>
              <div className="sc-cta-actions">
                <button className="sc-primary sc-primary--large" type="button" onClick={goClean}>
                  CLEAN MY WALLET
                </button>
                <Link to="/how-it-works" className="sc-secondary">
                  LEARN HOW IT WORKS
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <SiteFooter />
    </main>
  );
}
