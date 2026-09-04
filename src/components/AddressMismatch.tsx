import { shortAddr } from "./ui";

/**
 * The user is viewing a scanned wallet, but the connected wallet is a
 * different address. Cleanup must stay locked. Two honest exits.
 */
export default function AddressMismatch({
  scanned,
  connected,
  onAnalyzeConnected,
  onKeepViewing,
}: {
  scanned: string;
  connected: string;
  onAnalyzeConnected: () => void;
  onKeepViewing: () => void;
}) {
  return (
    <div className="mismatch" data-mismatch="different-wallet">
      <div className="mismatch-text">
        <p className="mismatch-title">WRONG WALLET CONNECTED.</p>
        <p className="mismatch-sub">
          Scanned <span className="mono-sm">{shortAddr(scanned)}</span> · connected{" "}
          <span className="mono-sm">{shortAddr(connected)}</span>. Cleanup stays locked
          until the addresses match.
        </p>
      </div>
      <div className="mismatch-actions">
        <button className="btn btn-primary" data-act="analyze-connected" onClick={onAnalyzeConnected}>
          ANALYZE CONNECTED WALLET
        </button>
        <button className="btn btn-secondary" data-act="keep-viewing" onClick={onKeepViewing}>
          KEEP VIEWING
        </button>
      </div>
    </div>
  );
}
