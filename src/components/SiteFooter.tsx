import { Link } from "react-router-dom";
import mascotImg from "../assets/mascot.png";

const COLUMNS: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Why Sui Cleaner", to: "/#why" },
      { label: "How it works", to: "/how-it-works" },
      { label: "Security & Guarantees", to: "/security" },
      { label: "Technical Docs", to: "/docs" },
      { label: "Frequently Asked Questions", to: "/faq" },
    ],
  },
  {
    title: "Capabilities",
    links: [
      { label: "Clean Empty Coins", to: "/app" },
      { label: "Storage Rebate Refund", to: "/docs" },
      { label: "Sweep to SUI", to: "/app" },
      { label: "DeFi Position Recovery", to: "/how-it-works" },
      { label: "Scan Any Public Address", to: "/app?scan=" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "X / Twitter (@SuiCleaner)", to: "https://x.com/SuiCleaner", external: true },
      { label: "GitHub", to: "https://github.com", external: true },
      { label: "Sui Foundation", to: "https://sui.io", external: true },
      { label: "Suiscan Explorer", to: "https://suiscan.xyz/mainnet", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms of Service", to: "/terms" },
    ],
  },
];

/**
 * Unified Public footer for all landing and info pages.
 */
export default function SiteFooter() {
  return (
    <footer className="sc-footer">
      <div className="sc-container">
        <div className="sc-footer-grid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.8fr" }}>
          <div className="sc-footer-brand">
            <Link to="/" className="sc-footer-logo" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}>
              <img src={mascotImg} alt="Sui Cleaner Mascot" style={{ width: 34, height: 34, objectFit: "contain" }} />
              <span>SUI <span style={{ color: "var(--sc-cyan)" }}>CLEANER</span></span>
            </Link>
            <p>
              Non-custodial object management, wallet optimization, and storage rebate recovery for the Sui blockchain.
            </p>
            <small>
              ✓ Non-custodial · No seed phrases · You approve every transaction
            </small>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--sc-emerald)", fontFamily: "var(--font-mono)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sc-emerald)", boxShadow: "0 0 8px var(--sc-emerald)", display: "inline-block" }} />
              SUI MAINNET LIVE
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div className="sc-footer-col" key={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((l) =>
                l.external ? (
                  <a href={l.to} key={l.label} target="_blank" rel="noopener noreferrer">
                    {l.label} ↗
                  </a>
                ) : (
                  <Link to={l.to} key={l.label}>
                    {l.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>

        <div className="sc-footer-copy">
          © 2026 SUI CLEANER · All Rights Reserved · Built for the Sui Ecosystem
        </div>
      </div>
    </footer>
  );
}
