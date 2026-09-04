import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import "./index.css";
import App from "./App";
import { loadAppConfig, getNetwork } from "./config";

// dapp-kit 1.x requires a QueryClientProvider above WalletProvider.
const queryClient = new QueryClient();

// The client points at the same-origin read-only proxy: every RPC read
// (scans, gas resolution during Transaction.build, dry-runs) flows
// browser -> /api/rpc -> server proxy -> upstream Sui RPC. No CORS, no
// direct browser-to-fullnode dependency. Signing stays in the user's wallet.
const NETWORKS = {
  mainnet: new SuiJsonRpcClient({ url: "/api/rpc", network: "mainnet" }),
  testnet: new SuiJsonRpcClient({ url: "/api/rpc", network: "testnet" }),
};

// Load server config (network, treasury) before first render. A failed
// config fetch must not block the site — config stays null and real cleanup
// fails safe.
loadAppConfig()
  .catch(() => {
    /* fail-safe: treasury unconfigured -> real cleanup locked */
  })
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <SuiClientProvider networks={NETWORKS} defaultNetwork={getNetwork() as "mainnet" | "testnet"}>
              <WalletProvider autoConnect>
                <App />
              </WalletProvider>
            </SuiClientProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </StrictMode>
    );
  });
