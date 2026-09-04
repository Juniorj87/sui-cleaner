import { useConnectWallet, useWallets } from "@mysten/dapp-kit";
import type { ErrorCode } from "../components/ErrorNotice";

/** connect the first registered wallet, reporting errors through onError */
export function useConnectAction(onError?: (code: ErrorCode) => void) {
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();
  const handleError = onError ?? ((code) => console.warn("Wallet connect error:", code));

  return () => {
    if (wallets.length === 0) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const currentUrl = window.location.href;
        // Try opening OKX Wallet app first, fallback to Sui Wallet
        window.location.href = `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(currentUrl)}`;
        setTimeout(() => {
          window.location.href = `sui://dapp?url=${encodeURIComponent(currentUrl)}`;
        }, 1500);
        return;
      }
      handleError("wallet-not-installed");
      return;
    }
    connect({ wallet: wallets[0] }, { onError: () => handleError("wallet-rejected") });
  };
}
