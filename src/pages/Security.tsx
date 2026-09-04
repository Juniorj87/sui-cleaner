import { useEffect } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import securityImg from "../assets/security.png";
import "./Home.css";

export default function Security() {
  useEffect(() => {
    document.title = "Sui Cleaner Security — Non-Custodial Safety Guarantees";
    const m = document.querySelector('meta[name="description"]');
    if (m) {
      m.setAttribute(
        "content",
        "Sui Cleaner is strictly non-custodial. Zero seed phrase or private key access. Hardcoded protection for StakedSui, Kiosks, and TreasuryCaps."
      );
    }
  }, []);

  const CORE_GUARANTEES = [
    {
      title: "100% Non-Custodial",
      desc: "You always remain the sole signer. Sui Cleaner never takes custody of your tokens, NFTs, or objects at any moment."
    },
    {
      title: "Zero Private Key Exposure",
      desc: "Your private key and seed phrase never leave your wallet extension or hardware device. The app has no mechanism to request them."
    },
    {
      title: "Read-Only Analysis",
      desc: "Wallet scanning queries public on-chain RPC nodes. Reading your wallet state cannot modify or transfer anything."
    },
    {
      title: "Atomic PTB Execution",
      desc: "All Move commands are packaged into a single atomic Programmable Transaction Block. If any instruction fails, the entire transaction reverts."
    },
    {
      title: "Pre-Execution Dry-Run",
      desc: "Every transaction is pre-simulated on-chain via `sui_dryRunTransactionBlock` before you sign, showing exact gas costs and rebate gains."
    },
    {
      title: "Protected Asset Shield",
      desc: "System-critical objects (StakedSui, KioskOwnerCaps, TreasuryCaps) are hard-coded into an immutable exclusion list and can never be cleaned."
    },
    {
      title: "Post-Transaction Audit",
      desc: "After execution, `verifyPostTransaction` checks the transaction digest and confirms that only the approved objects were affected."
    },
    {
      title: "Public Treasury Recipient",
      desc: "The flat 0.015 SUI service fee recipient address is public and clearly displayed before you sign, completely isolated from network gas."
    }
  ];

  const PROTECTED_ASSETS = [
    {
      type: "0x3::staking_pool::StakedSui",
      name: "Staked SUI Objects",
      reason: "Represents active validator staking positions. Deleting or transferring would forfeit staked principal and staking rewards."
    },
    {
      type: "0x2::kiosk::KioskOwnerCap",
      name: "Kiosk Owner Capabilities",
      reason: "Provides administrative ownership of your Sui Kiosk. Losing this object would permanently lock all NFTs inside your kiosk."
    },
    {
      type: "0x2::kiosk::Kiosk",
      name: "Sui Kiosk Objects",
      reason: "On-chain containers holding listed and protected digital assets with creator royalty enforcement."
    },
    {
      type: "0x2::coin::TreasuryCap<T>",
      name: "Treasury Capabilities",
      reason: "Gives token creators the authority to mint and manage supply. Irreplaceable administrative singleton."
    },
    {
      type: "0x2::package::UpgradeCap",
      name: "Package Upgrade Capabilities",
      reason: "Grants developers authority to deploy upgrades to smart contract packages on the Sui blockchain."
    },
    {
      type: "Shared / Immutable Objects",
      name: "System Singletons (0x5, 0x6)",
      reason: "Global network state objects such as the Clock and SuiSystemState. Cannot be owned or modified by individual users."
    }
  ];

  const COMPARISON = [
    {
      feature: "Private Key / Seed Phrase Handling",
      cleaner: "Never requested or accessed (100% Non-Custodial)",
      phishing: "Prompts for seed phrase or downloads keystore files"
    },
    {
      feature: "Scanning Permissions",
      cleaner: "Read-only public JSON-RPC requests",
      phishing: "Requests blanket token transfer approvals"
    },
    {
      feature: "Transaction Preview",
      cleaner: "Pre-simulated on-chain (dryRun) with exact object IDs & gas",
      phishing: "Obfuscated bytecode hiding malicious transfer calls"
    },
    {
      feature: "Staking & Kiosks Handling",
      cleaner: "Hard-coded code protection (cannot be selected)",
      phishing: "Drains high-value caps, Kiosks, and staked assets"
    },
    {
      feature: "Fee Transparency",
      cleaner: "Flat 0.015 SUI service fee previewed before signing",
      phishing: "Hidden percentage fee draining entire wallet balance"
    }
  ];

  return (
    <div className="sc-landing">
      <SiteHeader />

      <div className="sc-master-wrap">
        <div className="sc-master-bg" aria-hidden="true">
          <img
            src={securityImg}
            alt="Security Background"
            className="sc-master-img"
            decoding="async"
            fetchPriority="high"
          />
          <div className="sc-master-overlay" aria-hidden="true" />
        </div>

        {/* HERO */}
        <section className="sc-subhero" aria-label="Security Hero">
          <div className="sc-subhero-inner">
            <span className="sc-subhero-kicker">BANK-GRADE NON-CUSTODIAL SAFETY</span>
            <h1>You Stay in Total Control</h1>
            <p>
              Sui Cleaner is engineered under strict zero-trust principles. We can analyze public on-chain objects and assemble Move PTBs, but nothing executes without your cryptographic signature.
            </p>
          </div>
        </section>

        {/* MAIN CONTENT */}
        <main className="sc-subpage-body">
          <div className="sc-container">
            {/* 3 HIGHLIGHT CARDS */}
            <div className="sc-grid-3" style={{ marginBottom: 64 }}>
              <div className="sc-card" style={{ borderTop: "3px solid var(--sc-coral)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: "var(--sc-coral)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  NO PRIVATE KEYS
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 8px" }}>Zero Key Access</h3>
                <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0 }}>
                  Your private keys never leave your secure wallet extension or Ledger device. We have no backend capable of storing secrets.
                </p>
              </div>

              <div className="sc-card" style={{ borderTop: "3px solid var(--sc-coral)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: "var(--sc-coral)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  NO SEED PHRASES
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 8px" }}>Never Requested</h3>
                <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0 }}>
                  We will never ask for your 12 or 24-word recovery phrase. The application interface has no input field for seed phrases.
                </p>
              </div>

              <div className="sc-card" style={{ borderTop: "3px solid var(--sc-emerald)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: "var(--sc-emerald)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  YOU SIGN EVERY ACTION
                </span>
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 8px" }}>Explicit Approval</h3>
                <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0 }}>
                  Every cleanup is an atomic Programmable Transaction Block (PTB) that you review and confirm in your wallet before execution.
                </p>
              </div>
            </div>

            {/* CORE GUARANTEES */}
            <div className="sc-section-head" style={{ marginBottom: 40 }}>
              <div className="sc-eyebrow">SECURITY ARCHITECTURE</div>
              <h2 className="sc-section-title">
                The 8 Core <strong>Security Mandates</strong>
              </h2>
            </div>

            <div className="sc-grid-2" style={{ gap: 20, marginBottom: 80 }}>
              {CORE_GUARANTEES.map((g, i) => (
                <div key={i} className="sc-card" style={{ padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ color: "var(--sc-cyan)", fontSize: 18 }}>✦</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--sc-text-main)" }}>
                      {g.title}
                    </h3>
                  </div>
                  <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", lineHeight: 1.6, margin: 0 }}>
                    {g.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* PROTECTED ASSETS LIST */}
            <div className="sc-section-head" style={{ marginBottom: 40 }}>
              <div className="sc-eyebrow">CODE-LEVEL SHIELD</div>
              <h2 className="sc-section-title">
                Hardcoded <strong>Protected Assets</strong>
              </h2>
              <p className="sc-section-subtitle">
                The following Move object types are explicitly hardcoded into the protective blacklist. The cleaner will NEVER suggest or allow these to be modified or deleted.
              </p>
            </div>

            <div className="sc-grid-2" style={{ gap: 20, marginBottom: 80 }}>
              {PROTECTED_ASSETS.map((p, i) => (
                <div key={i} className="sc-card" style={{ borderLeft: "4px solid var(--sc-indigo)", padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--sc-text-main)" }}>
                      {p.name}
                    </h3>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontWeight: 800,
                      background: "var(--sc-indigo-soft)",
                      color: "var(--sc-indigo)",
                      padding: "2px 8px",
                      borderRadius: 4
                    }}>
                      PROTECTED
                    </span>
                  </div>
                  <code style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--sc-cyan)",
                    marginBottom: 10,
                    wordBreak: "break-all"
                  }}>
                    {p.type}
                  </code>
                  <p style={{ fontSize: 14, color: "var(--sc-text-muted)", lineHeight: 1.55, margin: 0 }}>
                    {p.reason}
                  </p>
                </div>
              ))}
            </div>

            {/* AI ISOLATION GUARDRAILS */}
            <div className="sc-card" style={{ background: "rgba(10, 24, 48, 0.75)", borderColor: "rgba(35, 196, 255, 0.30)", padding: 36, marginBottom: 80 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
                <div style={{ fontSize: 36 }}>🤖</div>
                <div style={{ flex: "1 1 500px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 800, color: "var(--sc-cyan)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    AI SAFETY ARCHITECTURE
                  </span>
                  <h3 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 12px", color: "var(--sc-text-main)" }}>
                    AI is Read-Only Advisory. Move Rules Decide. You Sign.
                  </h3>
                  <p style={{ fontSize: 15, color: "var(--sc-text-body)", lineHeight: 1.65, margin: "0 0 16px" }}>
                    Our integrated AI assistant provides human-readable explanations of unknown structs, dynamic fields, and token origins. To ensure strict security:
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--sc-text-body)" }}>
                    <li><strong style={{ color: "var(--sc-cyan)" }}>• Zero Private Data Sent:</strong> Only public on-chain type strings, package IDs, and token symbols are analyzed.</li>
                    <li><strong style={{ color: "var(--sc-cyan)" }}>• Sandboxed Isolation:</strong> The AI has no connection to the PTB builder or wallet signer. It cannot initiate or modify transactions.</li>
                    <li><strong style={{ color: "var(--sc-cyan)" }}>• Deterministic Verification:</strong> All cleanup actions are governed by strict Move smart contract invariants, not probabilistic AI prompts.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* COMPARISON TABLE */}
            <div className="sc-section-head" style={{ marginBottom: 40 }}>
              <div className="sc-eyebrow">TRUST VERIFICATION</div>
              <h2 className="sc-section-title">
                Sui Cleaner vs <strong>Malicious Tools</strong>
              </h2>
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
                    <th style={{ padding: "16px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--sc-cyan)", textTransform: "uppercase" }}>Security Vector</th>
                    <th style={{ padding: "16px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--sc-emerald)", textTransform: "uppercase" }}>Sui Cleaner Standard</th>
                    <th style={{ padding: "16px 20px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--sc-coral)", textTransform: "uppercase" }}>Phishing / Scam Sites</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "16px 20px", fontWeight: 700, color: "var(--sc-text-main)", fontSize: 14 }}>
                        {row.feature}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13.5, color: "var(--sc-emerald)", fontWeight: 500 }}>
                        ✓ {row.cleaner}
                      </td>
                      <td style={{ padding: "16px 20px", fontSize: 13.5, color: "var(--sc-coral)", fontWeight: 500 }}>
                        ✕ {row.phishing}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CTA */}
            <div className="sc-cta-box">
              <h2>Experience Secure, Transparent Object Management</h2>
              <p>
                Analyze your Sui wallet state safely with zero exposure of your keys or valuable assets.
              </p>
              <div className="sc-cta-actions">
                <Link to="/app" className="sc-primary sc-primary--large">
                  CLEAN MY WALLET
                </Link>
                <Link to="/docs" className="sc-secondary">
                  VIEW TECHNICAL DOCS
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
