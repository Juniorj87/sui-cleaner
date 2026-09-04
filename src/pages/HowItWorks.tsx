import { useEffect } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import howBg from "../assets/how-it-works.png";
import "./Home.css";

export default function HowItWorks() {
  useEffect(() => {
    document.title = "How Sui Cleaner Works — Scan, Review, and Clean Your Sui Wallet";
    const m = document.querySelector('meta[name="description"]');
    if (m) {
      m.setAttribute(
        "content",
        "Learn the 6-phase lifecycle of Sui Cleaner: non-custodial object scanning, Move classification, PTB simulation, and storage rebate recovery."
      );
    }
  }, []);

  const LIFECYCLE_STEPS = [
    {
      num: "01",
      title: "Connect Wallet & Read-Only Ingestion",
      subtitle: "Secure connection via official @mysten/dapp-kit",
      desc: "When you connect your wallet (Sui Wallet, Suiet, Nightly, OKX, Phantom, Ledger), Sui Cleaner receives only your public 32-byte address (0x...). No private keys or seed phrases can ever be accessed. Connection is 100% read-only.",
      details: [
        "Read-only public address retrieval",
        "No wallet permissions requested for transfers or spending",
        "Compatible with all Sui standard browser & hardware wallets"
      ]
    },
    {
      num: "02",
      title: "Deep On-Chain State Ingestion",
      subtitle: "Multi-page RPC and GraphQL object querying",
      desc: "Sui Cleaner queries the Sui RPC with paginated `suix_getOwnedObjects` including full options: `showType`, `showContent`, `showDisplay`, `showOwner`, and `showBcs`. It extracts raw balances for Coin<T>, detects Move abilities (such as `store`), and reads dynamic fields.",
      details: [
        "Full inventory of Coins, NFTs, Dynamic Fields, and Kiosks",
        "Exact balance extraction down to raw MIST units",
        "Zero state changes during scanning — 100% passive"
      ]
    },
    {
      num: "03",
      title: "Deterministic Object Classification",
      subtitle: "Algorithmic matching against protocol and token registries",
      desc: "Every object is classified using strict on-chain rules against known protocols (Cetus, Scallop, Navi, SpringSui, Aftermath) and verified NFT collections. Objects are segregated into KEEP, PROTECTED, REVIEW, and SAFE TO CLEAN.",
      details: [
        "KEEP: Any Coin with balance > 0 and verified NFT collections",
        "PROTECTED: StakedSui, KioskOwnerCap, TreasuryCap, UpgradeCap (hard-blocked)",
        "REVIEW: Custom structs and unverified packages requiring user check",
        "CLEANABLE: Zero-balance coins (balance = 0) and dust fragments"
      ]
    },
    {
      num: "04",
      title: "Granular Review & Dossier Inspection",
      subtitle: "You inspect and control every single item",
      desc: "Sui Cleaner presents an organized interface separated into four actionable zones: Clean, Sweep to SUI, Recover (DeFi positions), and Review. You can toggle items on or off, view object IDs, and inspect technical struct metadata.",
      details: [
        "Transparent object list with Move types, balances, and reasons",
        "AI-assisted technical explanations of unknown package origins",
        "Nothing is selected for action without your explicit consent"
      ]
    },
    {
      num: "05",
      title: "PTB Construction & Dry-Run Simulation",
      subtitle: "Atomic Programmable Transaction Block generation & pre-flight test",
      desc: "The app compiles your selected actions into a single atomic Move PTB. Before asking for your signature, it executes `sui_dryRunTransactionBlock` on the RPC node. This guarantees that all Move calls succeed and computes exact network gas and storage rebate refunds.",
      details: [
        "Atomic PTB: all actions succeed or the entire transaction reverts",
        "Calls Move native `0x2::coin::destroy_zero` and `0x2::coin::merge`",
        "Pre-computes exact Storage Rebate refund in SUI from the Storage Fund"
      ]
    },
    {
      num: "06",
      title: "Wallet Signature & Post-TX Verification",
      subtitle: "User approval in wallet + on-chain delta verification",
      desc: "You confirm the transaction in your wallet extension. Once committed to a checkpoint, `verifyPostTransaction` rescans your wallet state to ensure only the approved objects were removed, the storage rebate was credited, and the flat 0.015 SUI fee was transferred to the treasury.",
      details: [
        "Sign directly in your trusted wallet UI",
        "Live on-chain delta audit confirms exact object removal",
        "Reclaimed storage rebate credited instantly to your SUI balance"
      ]
    }
  ];

  const CAPABILITY_MATRIX = [
    {
      action: "Destroy Zero-Balance Coin",
      entryPoint: "0x2::coin::destroy_zero",
      protocol: "Sui Framework",
      zone: "Clean Zone",
      storageRebate: "Full Storage Rebate Refunded",
      desc: "Destroys empty Coin<T> objects whose balance is exactly 0. The locked storage deposit is released from the Sui Storage Fund."
    },
    {
      action: "Merge Dust Coins",
      entryPoint: "0x2::coin::merge",
      protocol: "Sui Framework",
      zone: "Clean Zone",
      storageRebate: "Storage Rebates for Merged Objects",
      desc: "Combines multiple fragmented coin objects of the same type into one primary coin. Preserves 100% of token balances."
    },
    {
      action: "Disclose Spam NFT to 0x0",
      entryPoint: "0x2::transfer::transfer",
      protocol: "Sui Framework",
      zone: "Clean Zone",
      storageRebate: "Object Transferred to 0x0",
      desc: "Transfers unwanted spam or phishing NFTs with Move `store` ability to the standard zero address 0x0."
    },
    {
      action: "Cetus CLMM Liquidity Withdraw",
      entryPoint: "pool::remove_liquidity",
      protocol: "Cetus Protocol",
      zone: "Recover Zone",
      storageRebate: "Returns Underlying Tokens",
      desc: "Redeems Cetus LP positions back into token A and token B pairs."
    },
    {
      action: "Scallop sCoin Redemption",
      entryPoint: "redeem::redeem",
      protocol: "Scallop Lending",
      zone: "Recover Zone",
      storageRebate: "Returns Collateral Token",
      desc: "Redeems interest-bearing sCoin tokens back into the base lending asset."
    },
    {
      action: "SpringSui Liquid Unstake",
      entryPoint: "liquid_staking::redeem",
      protocol: "SpringSui",
      zone: "Recover Zone",
      storageRebate: "Returns Liquid SUI",
      desc: "Redeems sSUI liquid staking positions directly into native SUI."
    }
  ];

  return (
    <div className="sc-landing">
      <SiteHeader />

      <div className="sc-master-wrap">
        <div className="sc-master-bg" aria-hidden="true">
          <img
            src={howBg}
            alt="How It Works Background"
            className="sc-master-img"
            decoding="async"
            fetchPriority="high"
          />
          <div className="sc-master-overlay" aria-hidden="true" />
        </div>

        {/* SUBPAGE HERO */}
        <section className="sc-subhero" aria-label="How It Works Hero">
          <div className="sc-subhero-inner">
            <span className="sc-subhero-kicker">TECHNICAL LIFECYCLE</span>
            <h1>How Sui Cleaner Works</h1>
            <p>
              An end-to-end walkthrough of our deterministic, non-custodial object scanning, Move classification, dry-run simulation, and storage rebate recovery engine.
            </p>
          </div>
        </section>

        {/* MAIN BODY */}
        <main className="sc-subpage-body">
          <div className="sc-container">
            {/* OVERVIEW PILLARS */}
            <div className="sc-grid-3" style={{ marginBottom: 64 }}>
              <div className="sc-card">
                <div className="sc-card-icon">🔍</div>
                <h3 className="sc-card-title">1. Non-Custodial Scan</h3>
                <p className="sc-card-desc">
                  Passive read-only ingestion of on-chain Move objects via paginated RPC &amp; GraphQL. Zero transactions sent during scanning.
                </p>
                <span className="sc-card-badge" style={{ background: "rgba(35, 196, 255, 0.12)", color: "var(--sc-cyan)" }}>
                  READ-ONLY
                </span>
              </div>

              <div className="sc-card">
                <div className="sc-card-icon">⚡</div>
                <h3 className="sc-card-title">2. Atomic Move PTB</h3>
                <p className="sc-card-desc">
                  Selected cleanup actions are bundled into a single Programmable Transaction Block, pre-simulated on-chain before signing.
                </p>
                <span className="sc-card-badge" style={{ background: "rgba(255, 201, 79, 0.12)", color: "var(--sc-gold)" }}>
                  ATOMIC EXECUTION
                </span>
              </div>

              <div className="sc-card">
                <div className="sc-card-icon">💰</div>
                <h3 className="sc-card-title">3. Storage Rebates</h3>
                <p className="sc-card-desc">
                  Object destruction triggers native Sui Storage Fund rebates, instantly refunding locked SUI back to your wallet.
                </p>
                <span className="sc-card-badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--sc-emerald)" }}>
                  REAL SUI REFUND
                </span>
              </div>
            </div>

            {/* 6-STEP DETAILED LIFECYCLE */}
            <div className="sc-section-head" style={{ marginBottom: 40 }}>
              <div className="sc-eyebrow">STEP-BY-STEP PROCESS</div>
              <h2 className="sc-section-title">
                The 6 Phases of <strong>Wallet Hygiene</strong>
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 80 }}>
              {LIFECYCLE_STEPS.map((step) => (
                <div key={step.num} className="sc-card" style={{ padding: "32px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 36,
                      fontWeight: 900,
                      color: "var(--sc-cyan)",
                      lineHeight: 1,
                      minWidth: 50
                    }}>
                      {step.num}
                    </div>
                    <div style={{ flex: "1 1 500px" }}>
                      <h3 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: "var(--sc-text-main)" }}>
                        {step.title}
                      </h3>
                      <p style={{ fontSize: 13.5, color: "var(--sc-cyan)", fontFamily: "var(--font-mono)", margin: "0 0 14px" }}>
                        {step.subtitle}
                      </p>
                      <p style={{ fontSize: 15, color: "var(--sc-text-body)", lineHeight: 1.65, margin: "0 0 16px" }}>
                        {step.desc}
                      </p>

                      <ul style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8
                      }}>
                        {step.details.map((d, di) => (
                          <li key={di} style={{ fontSize: 13.5, color: "var(--sc-text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "var(--sc-emerald)", fontWeight: "bold" }}>✓</span> {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* MOVE CAPABILITY MATRIX TABLE */}
            <div className="sc-section-head" style={{ marginBottom: 40 }}>
              <div className="sc-eyebrow">VERIFIED CAPABILITY REGISTRY</div>
              <h2 className="sc-section-title">
                Supported <strong>Move Execution Targets</strong>
              </h2>
              <p className="sc-section-subtitle">
                Every action executed by Sui Cleaner is mapped to a verified on-chain Move entry point. Unverified contracts are blocked by default.
              </p>
            </div>

            <div style={{
              background: "var(--sc-panel)",
              border: "1px solid var(--sc-border)",
              borderRadius: "var(--sc-radius-lg)",
              overflowX: "auto",
              marginBottom: 80
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.10)", background: "rgba(2, 8, 15, 0.40)" }}>
                    <th style={{ padding: "16px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--sc-cyan)", textTransform: "uppercase" }}>Action</th>
                    <th style={{ padding: "16px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--sc-cyan)", textTransform: "uppercase" }}>Move Entry Point</th>
                    <th style={{ padding: "16px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--sc-cyan)", textTransform: "uppercase" }}>Protocol</th>
                    <th style={{ padding: "16px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--sc-cyan)", textTransform: "uppercase" }}>Storage Rebate Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITY_MATRIX.map((c, ci) => (
                    <tr key={ci} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "16px 20px", fontWeight: 700, color: "var(--sc-text-main)", fontSize: 14 }}>
                        {c.action}
                        <div style={{ fontSize: 12, color: "var(--sc-text-muted)", fontWeight: 400, marginTop: 4 }}>{c.desc}</div>
                      </td>
                      <td style={{ padding: "16px 20px", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--sc-gold)" }}>
                        <code>{c.entryPoint}</code>
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--sc-text-body)" }}>
                        {c.protocol}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13, color: "var(--sc-emerald)", fontWeight: 600 }}>
                        {c.storageRebate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CTA BOX */}
            <div className="sc-cta-box">
              <h2>Ready to Experience Clean Wallet Storage?</h2>
              <p>
                Run a free, read-only scan of your Sui wallet and see how many empty objects and storage rebates you can recover right now.
              </p>
              <div className="sc-cta-actions">
                <Link to="/app" className="sc-primary sc-primary--large">
                  CLEAN MY WALLET
                </Link>
                <Link to="/security" className="sc-secondary">
                  READ SECURITY GUARANTEES
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
