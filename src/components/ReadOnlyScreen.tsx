/**
 * CONNECT REQUIRED — the intentional read-only lock. Inspecting is free;
 * cleanup needs the wallet owner to connect and match the scanned address.
 */
export default function ReadOnlyScreen({
  onConnect,
  onKeepExploring,
}: {
  onConnect: () => void;
  onKeepExploring: () => void;
}) {
  return (
    <div className="readonly-screen" data-readonly="locked">
      <p className="report-eyebrow">Read-only mode</p>
      <h2 className="report-title">
        This wallet is <span className="highlight">read-only.</span>
      </h2>
      <p className="final-sub">
        You can inspect everything, but cleanup requires the wallet owner to connect.
      </p>
      <div className="readonly-actions">
        <button className="btn btn-primary" data-act="connect-to-clean" onClick={onConnect}>
          Connect wallet
        </button>
        <button className="btn btn-secondary" data-act="keep-exploring" onClick={onKeepExploring}>
          Keep exploring
        </button>
      </div>
      <p className="app-start-note">Only the wallet that owns these items can approve cleanup.</p>
    </div>
  );
}
