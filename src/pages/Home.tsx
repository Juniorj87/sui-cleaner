import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Home.css";
import allImg from "../assets/all3.png";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export default function Home() {
  const navigate = useNavigate();
  const goClean = () => navigate("/app");
  const goHow = () => navigate("/how-it-works");

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const FAQ_ITEMS = [
    {
      q: "What is Sui Cleaner and why does my wallet have unnecessary objects?",
      a: "On the Sui blockchain, everything (tokens, NFTs, DeFi receipts, staking tickets) is an individual on-chain Move object. When you transact, swap, or transfer coins, empty coin objects (with 0 balance) and small dust objects remain stored in your wallet. Sui Cleaner scans your wallet, classifies these objects, and lets you safely delete them to reclaim your locked Storage Fund rebates."
    },
    {
      q: "How do I get money back from cleaning my wallet (Storage Rebates)?",
      a: "Every object created on Sui requires a storage deposit paid to the Sui Storage Fund. When an empty coin or unwanted object is destroyed via verified Move calls (such as coin::destroy_zero), the blockchain immediately refunds that storage deposit (Storage Rebate) back to your wallet address as real SUI."
    },
    {
      q: "Can Sui Cleaner accidentally delete my valuable tokens or NFTs?",
      a: "Never. Sui Cleaner uses a strict deterministic classification system. All tokens with a balance > 0 and recognized collections are marked KEEP. System-critical assets (Staked SUI, Kiosk Owner Capabilities, Treasury Caps) are classified as PROTECTED and are hard-blocked from cleanup. Only zero-balance objects and verified dust are offered for cleanup."
    },
    {
      q: "Is Sui Cleaner non-custodial? Does it need my private key or seed phrase?",
      a: "Sui Cleaner is 100% non-custodial. It never asks for, receives, or stores your private key or seed phrase. Wallet analysis is completely read-only. All cleanup transactions are assembled into atomic Programmable Transaction Blocks (PTB) and simulated (dry-run) for your review before you sign them in your own wallet extension."
    },
    {
      q: "What are the fees for using Sui Cleaner?",
      a: "Scanning and analyzing any Sui wallet is 100% free. When you choose to execute a cleanup transaction, there is a flat service fee of 0.015 SUI sent to the public treasury, plus standard network gas. In many cases, the storage rebate you reclaim from deleting objects exceeds the network cost!"
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
                <div className="sc-eyebrow">SUI OBJECT MANAGEMENT & STORAGE REBATE ENGINE</div>
                <h1>
                  Clean your Sui wallet.
                  <strong>Keep what matters. Reclaim SUI.</strong>
                </h1>
                <p className="sc-hero-desc">
                  Sui Cleaner analyzes your wallet&apos;s on-chain Move objects, safely destroys zero-balance coin containers, consolidates dust, and reclaims locked storage fund rebates directly to your address.
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
              </div>

              {/* LIVE SIMULATION DASHBOARD PREVIEW */}
              <div className="sc-sim-card" aria-label="Live Scan Simulation">
                <div className="sc-sim-header">
                  <span className="sc-sim-title">LIVE WALLET SCAN · PREVIEW</span>
                  <span className="sc-sim-badge">SUI MAINNET</span>
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
                      <span style={{ color: "var(--sc-coral)" }}>SAFE TO CLEAN</span>
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

        {/* SECTION 2: THE 4 FUNCTIONAL ZONES (CAPABILITY REGISTRY) */}
        <section className="sc-section" aria-label="Capabilities and Zones">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">UNIFIED CAPABILITY ENGINE</div>
              <h2 className="sc-section-title">
                Four Specialized Zones for <strong>Complete Wallet Control</strong>
              </h2>
              <p className="sc-section-subtitle">
                Sui Cleaner classifies every object into four actionable zones, each backed by verified Move bytecode execution and safety checks.
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
                A non-custodial pipeline designed to ensure absolute safety, zero asset risk, and verified on-chain execution.
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

        {/* SECTION 4: CLASSIFICATION MATRIX */}
        <section className="sc-section" aria-label="Classification Matrix">
          <div className="sc-container">
            <div className="sc-section-head">
              <div className="sc-eyebrow">SAFETY BY DESIGN</div>
              <h2 className="sc-section-title">
                The Four <strong>Classification Categories</strong>
              </h2>
              <p className="sc-section-subtitle">
                Sui Cleaner enforces strict deterministic rules to ensure your valuable holdings, staking positions, and critical dApp capabilities are never put at risk.
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

              {/* SAFE TO CLEAN */}
              <div className="sc-cat-card sc-cat-card--cleanable">
                <span className="sc-cat-badge sc-cat-badge--cleanable">SAFE TO CLEAN</span>
                <h3 className="sc-cat-title">Zero-Balance &amp; Dust</h3>
                <p className="sc-cat-desc">
                  Empty coin objects (balance = 0), dust coins with negligible value, and confirmed spam objects with verified Move destruction paths.
                </p>
                <div className="sc-cat-examples">
                  Examples: Empty Coin&lt;SUI&gt;, dust fragments, scam NFT drops.
                </div>
              </div>
            </div>
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
                Read-only analysis is completely free. Cleanup carries a flat 0.015 SUI service fee, while storage rebates refund real SUI directly into your balance.
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
