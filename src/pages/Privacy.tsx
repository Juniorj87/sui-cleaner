import { useEffect } from "react";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import "./Home.css";

export default function Privacy() {
  useEffect(() => {
    document.title = "Sui Cleaner — Privacy Policy";
  }, []);

  return (
    <div className="sc-landing">
      <SiteHeader />
      <main className="sc-subpage-body" style={{ maxWidth: 840, margin: "0 auto", padding: "120px 24px 80px" }}>
        <div className="sc-eyebrow">LEGAL &amp; PRIVACY</div>
        <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--sc-text-main)", marginBottom: 16 }}>
          Privacy Policy
        </h1>
        <p style={{ color: "var(--sc-text-body)", marginBottom: 36, fontSize: 16, lineHeight: 1.6 }}>
          Sui Cleaner is designed around one uncompromising rule: your private keys and your seed phrase never enter our custody.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-cyan)", marginBottom: 8 }}>1. What We Read</h2>
            <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0, lineHeight: 1.6 }}>
              We only query public, on-chain data associated with the connected address (or an address you search): owned Move object IDs, struct types, balances, dynamic fields, and public transaction digests necessary for object classification.
            </p>
          </div>

          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-coral)", marginBottom: 8 }}>2. What We Never Read or Store</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 14.5, color: "var(--sc-text-body)" }}>
              <li><strong>• Private Keys:</strong> Never received, never requested, never stored.</li>
              <li><strong>• Seed Recovery Phrases:</strong> The app has no mechanism or UI to ask for or handle seed phrases.</li>
              <li><strong>• Wallet Internals:</strong> Authentication and signing happen strictly inside your wallet extension or hardware device.</li>
            </ul>
          </div>

          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-gold)", marginBottom: 8 }}>3. Session Storage &amp; Caching</h2>
            <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0, lineHeight: 1.6 }}>
              Object classification results and metadata are cached locally in your browser session for performance. They are never transmitted to marketing trackers and can be cleared at any time by refreshing or resetting the app.
            </p>
          </div>

          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-emerald)", marginBottom: 8 }}>4. Third-Party RPC Nodes</h2>
            <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0, lineHeight: 1.6 }}>
              RPC requests are routed to public or custom Sui network nodes. Standard IP and connection logs at the network layer are governed by the respective RPC node provider’s privacy policy.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
