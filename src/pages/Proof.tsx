import { Link } from "react-router-dom";
import "./Home.css";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

/**
 * Proof of clean — one REAL mainnet cleanup, verified on-chain.
 *
 * Every figure below comes from the executed transaction's effects
 * (see tests/fixtures/real-tx-5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb.json
 * and tests/real-tx-regression.test.ts). Nothing here is estimated.
 */

const DIGEST = "5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb";
const SUISCAN = `https://suiscan.xyz/mainnet/tx/${DIGEST}`;

const ROWS: Array<[string, string, string?]> = [
  ["On-chain status", "success", "effects.status.status"],
  ["Objects deleted", "2", "effects.deleted"],
  ["Storage rebate", "+0.003596472 SUI", "effects.gasUsed.storageRebate"],
  ["Network gas (gross)", "−0.002076 SUI", "computation 100 000 + storage 1 976 000 MIST"],
  ["SuiCleaner fee", "−0.015 SUI", "treasury receipt, verified"],
  ["Sender net change", "−0.013479528 SUI", "on-chain balance change"],
];

export default function Proof() {
  return (
    <main className="sc-landing">
      <SiteHeader />
      <div className="sc-master-wrap">
        <div className="sc-master-bg" aria-hidden="true">
          <div className="sc-master-overlay" aria-hidden="true" />
        </div>

        <section className="sc-hero" aria-label="Proof of clean">
          <div className="sc-container">
            <div className="sc-eyebrow">ON-CHAIN VERIFIED · NOT ESTIMATED</div>
            <h1>
              Proof of clean.
              <br />
              <strong>Real transaction. Real rebate.</strong>
            </h1>
            <p className="sc-hero-desc">
              This cleanup executed on Sui mainnet. The figures below are read
              from its transaction effects — the same record our post-transaction
              verifier checks before any Success screen is shown.
            </p>

            <div className="sc-proof-card">
              <div className="sc-proof-digest">
                <span className="sc-proof-label">TRANSACTION DIGEST</span>
                <code className="sc-proof-digest-hash">{DIGEST}</code>
                <a
                  className="sc-secondary"
                  href={SUISCAN}
                  target="_blank"
                  rel="noreferrer"
                >
                  VIEW ON SUISCAN
                </a>
              </div>
              <table className="sc-proof-table">
                <tbody>
                  {ROWS.map(([k, v, src]) => (
                    <tr key={k}>
                      <th scope="row">{k}</th>
                      <td className="mono">{v}</td>
                      <td className="sc-proof-src">{src}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sc-proof-note">
                Net result = storage rebate − network gas − cleaner fee
                (0.003596472 − 0.002076 − 0.015 = −0.013479528 SUI), matching the
                sender&apos;s actual on-chain balance change exactly.
              </p>
            </div>

            <div className="sc-hero-actions">
              <Link to="/app?demo=true" className="sc-primary sc-primary--large">
                TRY THE DEMO
              </Link>
              <Link to="/security" className="sc-secondary">
                HOW VERIFICATION WORKS
              </Link>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
