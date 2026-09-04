import { useEffect } from "react";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import "./Home.css";

export default function Terms() {
  useEffect(() => {
    document.title = "Sui Cleaner — Terms of Service";
  }, []);

  return (
    <div className="sc-landing">
      <SiteHeader />
      <main className="sc-subpage-body" style={{ maxWidth: 840, margin: "0 auto", padding: "120px 24px 80px" }}>
        <div className="sc-eyebrow">LEGAL AGREEMENT</div>
        <h1 style={{ fontSize: 38, fontWeight: 800, color: "var(--sc-text-main)", marginBottom: 16 }}>
          Terms of Service
        </h1>
        <p style={{ color: "var(--sc-text-body)", marginBottom: 36, fontSize: 16, lineHeight: 1.6 }}>
          Please review these terms before using the Sui Cleaner interface and smart contract routing tools.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-cyan)", marginBottom: 8 }}>1. Non-Custodial Interface</h2>
            <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0, lineHeight: 1.6 }}>
              Sui Cleaner is a decentralized, client-side software tool that reads public on-chain Sui data and formats Programmable Transaction Blocks (PTB). Sui Cleaner never holds custody of any tokens, NFTs, or digital assets.
            </p>
          </div>

          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-gold)", marginBottom: 8 }}>2. User Responsibility &amp; Finality</h2>
            <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0, lineHeight: 1.6 }}>
              All blockchain transactions executed on the Sui network are irreversible. You are solely responsible for reviewing the transaction details, selected objects, and fees presented in your wallet before confirming signatures.
            </p>
          </div>

          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-emerald)", marginBottom: 8 }}>3. Fees &amp; Storage Rebates</h2>
            <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0, lineHeight: 1.6 }}>
              Cleanup transactions incur a network gas fee (determined by Sui validators) and a fixed service fee of 0.015 SUI routed to the public treasury. Storage rebates refunded upon object destruction are credited directly to your wallet by the Sui consensus protocol.
            </p>
          </div>

          <div className="sc-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--sc-coral)", marginBottom: 8 }}>4. Disclaimer of Warranties</h2>
            <p style={{ fontSize: 14.5, color: "var(--sc-text-body)", margin: 0, lineHeight: 1.6 }}>
              Sui Cleaner is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. While every effort is made to maintain verified protocol registries and Move safety invariants, users acknowledge the inherent risks of smart contract interaction.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
