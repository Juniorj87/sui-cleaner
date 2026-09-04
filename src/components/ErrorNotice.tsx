import { useEffect, useState } from "react";

export type ErrorCode =
  | "wallet-not-installed"
  | "wallet-rejected"
  | "wallet-not-connected"
  | "user-rejected"
  | "insufficient-sui"
  | "rpc-unavailable"
  | "scan-failed"
  | "rate-limited"
  | "transaction-failed"
  | "object-no-longer-exists"
  | "ownership-changed"
  | "cleanup-unavailable"
  | "network-mismatch"
  | "treasury-misconfigured"
  | "simulation-failed"
  | "post-tx-verification-failed"
  | "wallet-timeout"
  | "sign-failed"
  | "unexpected";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  "wallet-not-installed": "No Sui wallet detected. Install a Sui wallet extension to connect.",
  "wallet-rejected": "Connection rejected by the wallet.",
  "wallet-not-connected": "Connect a wallet first — or use the demo.",
  "user-rejected": "Transaction rejected by the wallet. Nothing was sent.",
  "insufficient-sui": "Not enough SUI to cover the network fee. Add SUI to your wallet and try again.",
  "rpc-unavailable": "Wallet analysis is temporarily unavailable. Please try again.",
  "scan-failed": "Scan failed. The wallet may be on a different network.",
  "rate-limited": "Too many requests. Wait a moment and try again.",
  "transaction-failed": "The chain rejected the transaction. Nothing is assumed to be cleaned. Re-scan your wallet.",
  "object-no-longer-exists": "An object no longer exists. Re-scan your wallet.",
  "ownership-changed": "An object changed ownership. Re-scan your wallet.",
  "cleanup-unavailable": "Your cleanup selection has no valid transaction. Objects are revalidated against the chain right before signing, and one or more of them changed or are no longer eligible. Go back, review the current object states, and try again.",
  "network-mismatch": "Network mismatch. The wallet is on a different network.",
  "treasury-misconfigured": "MAINNET BLOCKER: the service treasury is not configured. Set SERVICE_FEE_ADDRESS (a valid mainnet Sui address) in the server environment and restart. Cleanup stays disabled until then.",
  "simulation-failed": "The transaction could not be simulated. No transaction was sent.",
  "post-tx-verification-failed": "The transaction was submitted, but its on-chain result could not be verified (RPC/network error). Re-scan your wallet to see the current state.",
  "wallet-timeout": "Your wallet did not respond within 90 seconds. No transaction was sent — you can safely return to the review and try again.",
  "sign-failed": "The wallet could not send the transaction. Nothing was sent — return to the review and try again.",
  unexpected: "Something unexpected happened. Please try again.",
};

/** split a "• a — b" list into readable lines for the detail area */
function formatDetail(detail: string): string[] {
  return detail.split("\n").filter(Boolean);
}

export default function ErrorNotice({
  code,
  onDismiss,
  light,
  detail,
}: {
  code: ErrorCode;
  onDismiss: () => void;
  light?: boolean;
  /** optional per-error explanation (e.g. which objects blocked signing) */
  detail?: string;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => setVisible(true), [code]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[3500] transition-transform duration-300 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div
        className={`flex items-center gap-3 border-t px-5 py-3.5 ${
          light ? "border-inktext/10 bg-paper" : "border-fg/10 bg-ink"
        }`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
        <div className="flex-1 text-[13px] leading-snug">
          <p className={`${light ? "text-inktext/80" : "text-fg/80"}`}>{ERROR_MESSAGES[code]}</p>
          {detail && (
            <div
              className={`mt-1 whitespace-pre-line rounded-md border px-2.5 py-1.5 font-mono text-[11px] leading-relaxed ${
                light
                  ? "border-inktext/10 bg-inktext/5 text-inktext/70"
                  : "border-white/10 bg-white/5 text-fg/70"
              }`}
            >
              {formatDetail(detail).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className={`font-mono text-xs ${light ? "text-inktext/50" : "text-mut"} transition hover:opacity-70`}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
