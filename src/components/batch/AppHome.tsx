/**
 * App Home — the /app landing. A standalone application page (not a
 * continuation of the landing): wallet entry points, batch entry, recents.
 *
 * NEVER starts a scan by itself — every scan below is an explicit user
 * action (button / OPEN / RESCAN). Returning here never re-scans.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isSuiAddress } from "../../lib/suiAddress";
import { shortAddress } from "../../lib/suiAddress";
import { MAX_BATCH_WALLETS } from "../../batch/addresses";
import { timeAgo, type RecentScan } from "../../batch/sessions";

export default function AppHome({
  connectedAddress,
  onConnect,
  onScanConnected,
  onScanAddress,
  onDemo,
  onBatch,
  recents,
  onOpenRecent,
  onRescanRecent,
  focusInputSignal,
}: {
  /** connected wallet address, if any */
  connectedAddress: string | null;
  onConnect: () => void;
  /** scan the connected wallet (single) */
  onScanConnected: () => void;
  /** scan a pasted address (single, read-only unless it matches) */
  onScanAddress: (address: string) => void;
  onDemo: () => void;
  onBatch: () => void;
  recents: RecentScan[];
  onOpenRecent: (rec: RecentScan) => void;
  onRescanRecent: (rec: RecentScan) => void;
  /** increments to focus the address input (NEW SCAN / NEW WALLET) */
  focusInputSignal: number;
}) {
  const [address, setAddress] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevSignal = useRef(focusInputSignal);

  // NEW SCAN / NEW WALLET focuses the address picker without scanning.
  useEffect(() => {
    if (focusInputSignal !== prevSignal.current) {
      prevSignal.current = focusInputSignal;
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [focusInputSignal]);

  const submitAddress = () => {
    const v = address.trim();
    if (!isSuiAddress(v)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onScanAddress(v);
  };

  return (
    <div className="app-home" data-home="ready">
      <div className="app-home-head">
        <div>
          <h2 className="report-title">
            Clean your Sui wallet.
          </h2>
          <p className="final-sub">Understand every object — scan one wallet, or batch up to {MAX_BATCH_WALLETS} at once.</p>
        </div>
        <Link to="/" className="btn btn-secondary" data-act="back-to-website">
          ← BACK TO WEBSITE
        </Link>
      </div>

      <div className="app-home-grid">
        {/* SINGLE WALLET */}
        <section className="app-home-panel" aria-label="Single wallet">
          <div className="app-home-panel-title">SINGLE WALLET</div>
          {connectedAddress ? (
            <div className="app-home-connected">
              <span className="app-home-addr" title={connectedAddress}>{shortAddress(connectedAddress)}</span>
              <button className="btn btn-primary" data-act="scan-connected" onClick={onScanConnected}>
                SCAN MY WALLET
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" data-act="connect" onClick={onConnect}>
              CONNECT WALLET
            </button>
          )}
          <div className="app-home-or">or</div>
          <div className="app-home-scanrow">
            <input
              ref={inputRef}
              className="app-home-input"
              data-input="address"
              placeholder="Paste Sui wallet address"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setInvalid(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") submitAddress(); }}
              aria-label="Sui wallet address"
            />
            <button className="btn btn-secondary" data-act="scan" onClick={submitAddress}>
              Scan wallet
            </button>
          </div>
          {invalid && <p className="app-home-error">Enter a valid Sui wallet address.</p>}
          <p className="app-home-note">
            Read-only analysis — no wallet connection needed to inspect.{" "}
            <button className="app-home-link" data-act="demo" onClick={onDemo}>
              Try demo
            </button>
          </p>
        </section>

        {/* BATCH SCAN */}
        <section className="app-home-panel" aria-label="Batch scan">
          <div className="app-home-panel-title">BATCH SCAN</div>
          <p className="final-sub">Analyze up to {MAX_BATCH_WALLETS} Sui wallets at once. Batch analysis only — each wallet is cleaned individually.</p>
          <button className="btn btn-primary" data-act="batch" onClick={onBatch}>
            BATCH SCAN
          </button>
        </section>
      </div>

      {/* RECENT SCANS */}
      <section className="app-home-panel" aria-label="Recent scans">
        <div className="app-home-panel-title">RECENT SCANS</div>
        {recents.length === 0 ? (
          <p className="final-sub">No scans yet. Your recent wallet scans will appear here.</p>
        ) : (
          <ul className="app-home-recents">
            {recents.map((r) => (
              <li key={r.address} className="app-home-recent">
                <div className="app-home-recent-main">
                  <span className="app-home-addr" title={r.address}>{shortAddress(r.address)}</span>
                  {r.label && r.label !== "—" && <span className="app-home-label">{r.label}</span>}
                  <span className="app-home-meta">
                    {r.total} objects · {r.safe} cleanable · Scan from {timeAgo(r.scannedAt)}
                  </span>
                </div>
                <div className="app-home-recent-actions">
                  <button className="btn btn-secondary" data-act="open-recent" onClick={() => onOpenRecent(r)}>
                    OPEN
                  </button>
                  <button className="btn btn-secondary" data-act="rescan-recent" onClick={() => onRescanRecent(r)}>
                    RESCAN
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
