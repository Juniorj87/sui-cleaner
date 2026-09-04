import { useEffect } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import docsBg from "../assets/docs.png";
import "./Home.css";

export default function Docs() {
  useEffect(() => {
    document.title = "Sui Cleaner Technical Documentation — Move Architecture & Capabilities";
    const m = document.querySelector('meta[name="description"]');
    if (m) {
      m.setAttribute(
        "content",
        "Comprehensive technical documentation for Sui Cleaner. Learn about the Sui Move object model, storage rebate fund, PTB commands, and capability registry."
      );
    }
  }, []);

  return (
    <div className="sc-landing">
      <SiteHeader />

      <div className="sc-master-wrap">
        <div className="sc-master-bg" aria-hidden="true">
          <img
            src={docsBg}
            alt="Documentation Background"
            className="sc-master-img"
            decoding="async"
            fetchPriority="high"
          />
          <div className="sc-master-overlay" aria-hidden="true" />
        </div>

        {/* SUBPAGE HERO */}
        <section className="sc-subhero" aria-label="Documentation Hero">
          <div className="sc-subhero-inner">
            <span className="sc-subhero-kicker">TECHNICAL REFERENCE &amp; SPECIFICATION</span>
            <h1>Sui Cleaner Documentation</h1>
            <p>
              In-depth technical specifications covering the Sui Move object model, storage rebate mechanics, atomic PTB construction, and our capability registry.
            </p>
          </div>
        </section>

        {/* MAIN BODY */}
        <main className="sc-subpage-body">
          <div className="sc-container sc-container--narrow">
            {/* SECTION 1: SUI MOVE OBJECT MODEL */}
            <div className="sc-card" style={{ padding: 36, marginBottom: 40 }}>
              <div className="sc-eyebrow">FOUNDATIONAL ARCHITECTURE</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, margin: "8px 0 16px", color: "var(--sc-text-main)" }}>
                The Sui Move Object Model &amp; Storage Fund
              </h2>
              <p style={{ fontSize: 15.5, color: "var(--sc-text-body)", lineHeight: 1.7, marginBottom: 20 }}>
                Unlike EVM blockchains where balances exist solely as entries in a contract’s internal storage table, Sui represents all assets as individual, typed Move objects. Every object has an owner, a globally unique identifier (UID), and locks a storage deposit in the <strong>Sui Storage Fund</strong>.
              </p>

              <div style={{ background: "rgba(2, 8, 15, 0.65)", padding: 20, borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: 20 }}>
                <h4 style={{ color: "var(--sc-cyan)", fontSize: 14, fontFamily: "var(--font-mono)", margin: "0 0 10px", textTransform: "uppercase" }}>
                  Anatomy of an On-Chain Move Object
                </h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5, color: "var(--sc-text-body)", fontFamily: "var(--font-mono)" }}>
                  <li><strong style={{ color: "var(--sc-text-main)" }}>UID (0x...):</strong> Unique 32-byte hexadecimal address identifying the object.</li>
                  <li><strong style={{ color: "var(--sc-text-main)" }}>Type:</strong> Fully qualified Move struct path (e.g. <code>0x2::coin::Coin&lt;0x2::sui::SUI&gt;</code>).</li>
                  <li><strong style={{ color: "var(--sc-text-main)" }}>Owner:</strong> AddressOwner, ObjectOwner, Shared, or Immutable.</li>
                  <li><strong style={{ color: "var(--sc-text-main)" }}>Storage Rebate:</strong> MIST deposited to the Storage Fund upon object creation, refundable on deletion.</li>
                </ul>
              </div>

              <h4 style={{ color: "var(--sc-text-main)", fontSize: 18, fontWeight: 700, margin: "24px 0 10px" }}>
                Move Struct Abilities
              </h4>
              <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", lineHeight: 1.6, marginBottom: 14 }}>
                In Sui Move, struct abilities dictate how objects can be handled by smart contracts and transactions:
              </p>
              <div className="sc-grid-2" style={{ gap: 12 }}>
                <div style={{ padding: 14, background: "rgba(2, 8, 15, 0.4)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <b style={{ color: "var(--sc-cyan)", fontFamily: "var(--font-mono)", fontSize: 13 }}>key</b>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sc-text-muted)" }}>Allows the struct to serve as a top-level address-owned on-chain object with a UID.</p>
                </div>
                <div style={{ padding: 14, background: "rgba(2, 8, 15, 0.4)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <b style={{ color: "var(--sc-gold)", fontFamily: "var(--font-mono)", fontSize: 13 }}>store</b>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sc-text-muted)" }}>Allows the object to be transferred via <code>0x2::transfer::transfer</code> or stored inside other structs.</p>
                </div>
                <div style={{ padding: 14, background: "rgba(2, 8, 15, 0.4)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <b style={{ color: "var(--sc-emerald)", fontFamily: "var(--font-mono)", fontSize: 13 }}>drop</b>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sc-text-muted)" }}>Allows the value to be popped/dropped at the end of a transaction scope without explicit destruction.</p>
                </div>
                <div style={{ padding: 14, background: "rgba(2, 8, 15, 0.4)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <b style={{ color: "var(--sc-indigo)", fontFamily: "var(--font-mono)", fontSize: 13 }}>copy</b>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--sc-text-muted)" }}>Allows the value to be duplicated within execution memory.</p>
                </div>
              </div>
            </div>

            {/* SECTION 2: CLEANUP MECHANICS */}
            <div className="sc-card" style={{ padding: 36, marginBottom: 40 }}>
              <div className="sc-eyebrow">MOVE ENTRY POINTS</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, margin: "8px 0 16px", color: "var(--sc-text-main)" }}>
                Core Move Cleanup Methods
              </h2>
              <p style={{ fontSize: 15.5, color: "var(--sc-text-body)", lineHeight: 1.7, marginBottom: 24 }}>
                Sui Cleaner only executes deterministic, verified Move functions. Unverified or custom contracts without audited signatures are never executed.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Method 1 */}
                <div style={{ padding: 20, borderRadius: 12, background: "rgba(2, 8, 15, 0.55)", border: "1px solid rgba(35, 196, 255, 0.20)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <code style={{ fontSize: 15, color: "var(--sc-cyan)", fontWeight: 700 }}>0x2::coin::destroy_zero&lt;T&gt;(c: Coin&lt;T&gt;)</code>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--sc-emerald-soft)", color: "var(--sc-emerald)", padding: "2px 8px", borderRadius: 4 }}>
                      REBATE RETURNED
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--sc-text-body)", margin: "0 0 8px", lineHeight: 1.6 }}>
                    Destroys a <code>Coin&lt;T&gt;</code> object whose balance is exactly <code>0</code>. The Move framework unpacks the struct, deletes its UID from storage, and instantly credits the full storage rebate back to the transaction sender.
                  </p>
                  <small style={{ color: "var(--sc-text-muted)", fontSize: 12 }}>Precondition: <code>coin.value == 0</code>.</small>
                </div>

                {/* Method 2 */}
                <div style={{ padding: 20, borderRadius: 12, background: "rgba(2, 8, 15, 0.55)", border: "1px solid rgba(255, 201, 79, 0.20)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <code style={{ fontSize: 15, color: "var(--sc-gold)", fontWeight: 700 }}>0x2::coin::merge&lt;T&gt;(self: &amp;mut Coin&lt;T&gt;, c: Coin&lt;T&gt;)</code>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--sc-gold)", color: "#07111a", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                      DUST MERGE
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--sc-text-body)", margin: "0 0 8px", lineHeight: 1.6 }}>
                    Takes a primary coin object and merges one or more secondary dust coin objects of the identical token type <code>T</code> into it. The secondary coin objects are destroyed, releasing their storage rebates.
                  </p>
                  <small style={{ color: "var(--sc-text-muted)", fontSize: 12 }}>Precondition: All objects share exact identical <code>Type&lt;T&gt;</code>.</small>
                </div>

                {/* Method 3 */}
                <div style={{ padding: 20, borderRadius: 12, background: "rgba(2, 8, 15, 0.55)", border: "1px solid rgba(248, 113, 113, 0.20)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <code style={{ fontSize: 15, color: "var(--sc-coral)", fontWeight: 700 }}>0x2::transfer::transfer&lt;T: key + store&gt;(obj: T, @0x0)</code>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", background: "var(--sc-coral-soft)", color: "var(--sc-coral)", padding: "2px 8px", borderRadius: 4 }}>
                      SPAM BURN
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: "var(--sc-text-body)", margin: "0 0 8px", lineHeight: 1.6 }}>
                    Transfers unwanted spam or phishing NFTs with Move <code>store</code> ability to the standard zero address <code>0x0000000000000000000000000000000000000000000000000000000000000000</code>. Permanently removes the object from your wallet inventory.
                  </p>
                  <small style={{ color: "var(--sc-text-muted)", fontSize: 12 }}>Precondition: Object Move type possesses the <code>store</code> ability.</small>
                </div>
              </div>
            </div>

            {/* SECTION 3: GAS & ECONOMICS */}
            <div className="sc-card" style={{ padding: 36, marginBottom: 40 }}>
              <div className="sc-eyebrow">TRANSPARENT ECONOMICS</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, margin: "8px 0 16px", color: "var(--sc-text-main)" }}>
                Gas &amp; Fee Accounting
              </h2>
              <p style={{ fontSize: 15.5, color: "var(--sc-text-body)", lineHeight: 1.7, marginBottom: 20 }}>
                Every transaction on Sui computes three gas components: <strong>Computation Cost</strong>, <strong>Storage Cost</strong>, and <strong>Storage Rebate</strong>.
              </p>

              <div style={{ background: "rgba(2, 8, 15, 0.65)", padding: 24, borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.08)", marginBottom: 24 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--sc-cyan)", marginBottom: 12 }}>
                  Net Balance Delta Formula:
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--sc-gold)", background: "rgba(0,0,0,0.4)", padding: 14, borderRadius: 8, lineHeight: 1.5 }}>
                  Net Gain = StorageRebate - (ComputationGas + StorageGas + 0.015 SUI Service Fee)
                </div>
                <p style={{ fontSize: 13.5, color: "var(--sc-text-muted)", marginTop: 14, lineHeight: 1.6 }}>
                  Because deleting empty Move objects releases substantial storage rebates, users cleaning multiple zero-balance objects frequently see a <strong>positive net SUI increase</strong> after the transaction completes.
                </p>
              </div>

              <div className="sc-grid-2" style={{ gap: 16 }}>
                <div style={{ padding: 18, background: "rgba(2, 8, 15, 0.4)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <h4 style={{ color: "var(--sc-text-main)", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>Network Gas</h4>
                  <p style={{ fontSize: 13.5, color: "var(--sc-text-body)", margin: 0 }}>
                    Determined entirely by network validators through dry-run simulation. Typically between 0.001 and 0.003 SUI.
                  </p>
                </div>
                <div style={{ padding: 18, background: "rgba(2, 8, 15, 0.4)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <h4 style={{ color: "var(--sc-text-main)", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>Sui Cleaner Fee</h4>
                  <p style={{ fontSize: 13.5, color: "var(--sc-text-body)", margin: 0 }}>
                    A flat 0.015 SUI service fee transferred to our verified public treasury address on successful execution.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 4: DEFI RECOVERY & EXTENSIBILITY */}
            <div className="sc-card" style={{ padding: 36, marginBottom: 64 }}>
              <div className="sc-eyebrow">PROTOCOL INTEGRATIONS</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, margin: "8px 0 16px", color: "var(--sc-text-main)" }}>
                Supported Protocol Integrations
              </h2>
              <p style={{ fontSize: 15.5, color: "var(--sc-text-body)", lineHeight: 1.7, marginBottom: 20 }}>
                Sui Cleaner includes verified package IDs and withdrawal entry point signatures for leading Sui DeFi ecosystems:
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { name: "Cetus Protocol", kind: "CLMM DEX & Swaps", verified: "MAINNET_VERIFIED" },
                  { name: "Scallop Lending", kind: "sCoin Collateral", verified: "MAINNET_VERIFIED" },
                  { name: "SpringSui", kind: "sSUI Liquid Staking", verified: "MAINNET_VERIFIED" },
                  { name: "Navi Protocol", kind: "Lending Market", verified: "CODE_ONLY" },
                  { name: "Suilend", kind: "Lending Market", verified: "CODE_ONLY" },
                  { name: "Haedal & Volo", kind: "haSUI / vSUI Staking", verified: "CODE_ONLY" },
                ].map((p, i) => (
                  <div key={i} style={{ padding: 14, borderRadius: 8, background: "rgba(2, 8, 15, 0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--sc-text-main)" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--sc-text-muted)", margin: "2px 0 8px" }}>{p.kind}</div>
                    <span style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: p.verified.includes("MAINNET") ? "var(--sc-emerald-soft)" : "rgba(255,255,255,0.06)",
                      color: p.verified.includes("MAINNET") ? "var(--sc-emerald)" : "var(--sc-text-muted)"
                    }}>
                      {p.verified}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="sc-cta-box">
              <h2>Inspect and Clean Your Sui Wallet Now</h2>
              <p>
                Try a live read-only audit to see your full object inventory and storage fund rebate opportunities.
              </p>
              <div className="sc-cta-actions">
                <Link to="/app" className="sc-primary sc-primary--large">
                  LAUNCH CLEANER APP
                </Link>
                <Link to="/faq" className="sc-secondary">
                  BROWSE FAQ
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
