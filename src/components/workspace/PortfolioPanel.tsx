import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PortfolioData,
  TokenAsset,
  NftAsset,
  AssetCategory,
  ProtocolName,
} from "../../types/portfolio";
import { formatFloorSui } from "../../types/portfolio";

/* ---------- image proxy helper ---------- */
function proxyImage(url: string | null | undefined): string {
  if (!url) return "";
  // Route all external images through our server proxy to bypass CORS
  return `/api/ai/image-proxy?url=${encodeURIComponent(url)}`;
}

/* ---------- hooks ---------- */

function usePortfolio(address: string | null) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/ai/portfolio?address=${address}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Portfolio fetch failed: ${r.status}`);
        return r.json();
      })
      .then((d: PortfolioData) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [address]);

  return { data, loading, error };
}

/* ---------- CSV export ---------- */

function downloadCsv(tokens: TokenAsset[], nfts: NftAsset[]) {
  const tokenHeader = "Symbol,Name,Balance,USD Value,Category,Protocol,Is LP";
  const tokenRows = tokens.map((t) =>
    [t.symbol, t.name, t.balance, t.usdValue.toFixed(4), t.category, t.protocol ?? "", t.isLp ? "Yes" : "No"].join(",")
  );
  const nftHeader = "\nNFT Name,Collection,Category,Token ID";
  const nftRows = nfts.map((n) =>
    [n.name, n.collection, n.category, n.tokenId].join(",")
  );
  const csv = [tokenHeader, ...tokenRows, nftHeader, ...nftRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `portfolio_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- category badge ---------- */

function CategoryBadge({ category }: { category: AssetCategory }) {
  const colors: Record<AssetCategory, string> = {
    real: "var(--xr-safe, #46b58c)",
    test: "var(--xr-amber, #e8b84b)",
    spam: "var(--xr-coral)",
    unknown: "var(--xr-amber, #e8b84b)",
  };
  const labels: Record<AssetCategory, string> = {
    real: "REAL",
    test: "TEST",
    spam: "SPAM",
    unknown: "UNKNOWN",
  };
  return (
    <span
      className="portfolio-badge"
      style={{ color: colors[category], borderColor: colors[category] }}
    >
      {labels[category]}
    </span>
  );
}

/* ---------- protocol badge ---------- */

function ProtocolBadge({ protocol }: { protocol?: ProtocolName }) {
  if (!protocol || protocol === "Other") return null;
  return (
    <span className="portfolio-protocol-badge">
      {protocol}
    </span>
  );
}

/* ---------- NFT card ---------- */

function NftCard({ nft }: { nft: NftAsset }) {
  return (
    <div className={`portfolio-nft-card ${nft.category}`}>
      <div className="portfolio-nft-img">
        {nft.imageUrl ? (
          <img src={proxyImage(nft.imageUrl)} alt={nft.name} loading="lazy" />
        ) : (
          <span className="portfolio-nft-placeholder">◇</span>
        )}
      </div>
      <div className="portfolio-nft-info">
        <span className="portfolio-nft-name">{nft.name}</span>
        <span className="portfolio-nft-collection">{nft.collection}</span>
        <span className={`portfolio-nft-cat ${nft.category}`}>
          {nft.category === "verified" ? "✓ VERIFIED" : "UNVERIFIED"}
        </span>
        {nft.floorPriceKnown && typeof nft.floorPriceSui === "number" ? (
          <span className="portfolio-nft-floor" title="Collection floor price via Blockberry">
            Floor {formatFloorSui(nft.floorPriceSui)} SUI
          </span>
        ) : (
          <span className="portfolio-nft-floor unknown">Floor —</span>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
/*                      PORTFOLIO PANEL                         */
/* ============================================================ */

export default function PortfolioPanel({ address }: { address: string | null }) {
  const { data, loading, error } = usePortfolio(address);
  const [filterCategory, setFilterCategory] = useState<"all" | AssetCategory>("all");
  const [sortBy, setSortBy] = useState<"balance" | "value" | "name">("balance");
  const [filterProtocol, setFilterProtocol] = useState<"all" | string>("all");
  const [showNfts, setShowNfts] = useState(true);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [swapStatus, setSwapStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [swapMessage, setSwapMessage] = useState<string | null>(null);
  const [swapTxHash, setSwapTxHash] = useState<string | null>(null);
  const [swapPlans, setSwapPlans] = useState<Array<{ symbol: string; amountIn: number; expectedSuiOut: number }>>([]);

  const tokenKey = useCallback((t: TokenAsset, idx: number) => t.coinType ?? `${t.symbol}-${t.name}-${idx}`, []);

  function comparePortfolioTokens(a: TokenAsset, b: TokenAsset, sort: "balance" | "value" | "name"): number {
    const aBalance = Number(a.balance || 0);
    const bBalance = Number(b.balance || 0);
    const aNonZero = aBalance > 0;
    const bNonZero = bBalance > 0;
    if (aNonZero !== bNonZero) return aNonZero ? -1 : 1;
    if (sort === "balance") {
      if (aBalance !== bBalance) return bBalance - aBalance;
    }
    if (sort === "value") {
      const aValue = a.priceKnown && a.price != null ? aBalance * a.price : -1;
      const bValue = b.priceKnown && b.price != null ? bBalance * b.price : -1;
      if (aValue !== bValue) return bValue - aValue;
    }
    if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }

  /* --- filtering + sorting --- */
  const filteredTokens = useMemo(() => {
    if (!data) return [];
    const filtered = data.tokens.filter((t) => {
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterProtocol !== "all" && t.protocol !== filterProtocol) return false;
      return true;
    });
    return [...filtered].sort((a, b) => comparePortfolioTokens(a, b, sortBy));
  }, [data, filterCategory, filterProtocol, sortBy]);

  /* --- unique protocols for filter dropdown --- */
  const protocols = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const t of data.tokens) {
      if (t.protocol) set.add(t.protocol);
    }
    return [...set].sort();
  }, [data]);

  /* --- dust tokens (usdValue < 0.01 or tiny balance <0.01) --- */
  const dustTokens = useMemo(() => {
    if (!data) return [];
    return data.tokens.filter((t) => (t.usdValue > 0 && t.usdValue < 0.01) || (t.balance > 0 && t.balance < 0.01));
  }, [data]);

  /* --- totals --- */
  const totalUsd = useMemo(() => {
    if (!data) return 0;
    return data.tokens.reduce((s, t) => s + t.usdValue, 0);
  }, [data]);

  const realCount = data?.tokens.filter((t) => t.category === "real").length ?? 0;
  const testCount = data?.tokens.filter((t) => t.category === "test").length ?? 0;
  const spamCount = data?.tokens.filter((t) => t.category === "spam").length ?? 0;
  const unknownCount = data?.tokens.filter((t) => t.category === "unknown").length ?? 0;
  const defiCount = data?.tokens.filter((t) => !!t.protocol && t.protocol !== "Other").length ?? 0;

  /* --- handlers --- */
  const handleExport = useCallback(() => {
    if (!data) return;
    downloadCsv(data.tokens, data.nfts);
  }, [data]);

  const handleSwapDust = useCallback(async () => {
    if (!address || dustTokens.length === 0) return;
    setSwapStatus("loading");
    setSwapMessage(null);
    setSwapTxHash(null);
    setSwapPlans([]);
    try {
      const res = await fetch("/api/ai/swap-dust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, tokens: dustTokens }),
      });
      const json = await res.json();
      if (json.ok && json.txBytesBase64) {
        setSwapMessage("Requesting wallet signature…");
        try {
          const suiWallet = (window as unknown as Record<string, unknown>).suiWallet as
            { signAndExecuteTransactionBlock?: (args: { transactionBlock: string; chain: string }) => Promise<{ digest?: string }> } | undefined;
          if (!suiWallet?.signAndExecuteTransactionBlock) {
            setSwapStatus("error");
            setSwapMessage("No Sui wallet found. Install a Sui wallet extension to execute swaps.");
            return;
          }
          const result = await suiWallet.signAndExecuteTransactionBlock({
            transactionBlock: json.txBytesBase64,
            chain: "sui:mainnet",
          });
          const digest = result?.digest;
          setSwapStatus("done");
          setSwapTxHash(digest ?? null);
          setSwapMessage(json.message ?? "Dust swap executed successfully.");
          setSwapPlans(json.plans ?? []);
        } catch (signErr: unknown) {
          const msg = signErr instanceof Error ? signErr.message : String(signErr);
          if (/reject|denied|cancel/i.test(msg)) {
            setSwapStatus("error");
            setSwapMessage("Transaction rejected by wallet.");
          } else {
            setSwapStatus("error");
            setSwapMessage(`Wallet error: ${msg}`);
          }
        }
      } else if (json.ok) {
        setSwapStatus("done");
        setSwapMessage(json.message ?? "Dust swap planned successfully.");
        setSwapTxHash(json.txHash ?? null);
        setSwapPlans(json.plans ?? []);
      } else {
        setSwapStatus("error");
        setSwapMessage(json.error ?? json.message ?? "Swap request failed.");
      }
    } catch (e: unknown) {
      setSwapStatus("error");
      setSwapMessage(e instanceof Error ? e.message : "Network error");
    }
  }, [address, dustTokens]);

function isSelectableToken(_t: TokenAsset): boolean {
    // ОТКЛЮЧАЕМ ВСЕ ПРОВЕРКИ, ЧТОБЫ ЧЕКБОКС 100% РАБОТАЛ
    return true;
}

  /* --- selection for cleanup --- */
  const toggleTokenSelect = useCallback((key: string) => {
    setSelectedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const selectable = filteredTokens.filter(isSelectableToken);
    const selectableKeys = selectable.map((t, i) => tokenKey(t, i));
    const allSelected = selectableKeys.length > 0 && selectableKeys.every((k) => selectedTokens.has(k));
    if (allSelected) {
      setSelectedTokens(new Set());
    } else {
      setSelectedTokens(new Set(selectableKeys));
    }
  }, [filteredTokens, selectedTokens, tokenKey]);

const handleAddToCleanup = useCallback(() => {
    const selected = filteredTokens.filter((t, i) => selectedTokens.has(tokenKey(t, i)));
    if (selected.length === 0) return;
    sessionStorage.setItem('portfolio_cleanup_tokens', JSON.stringify(selected.map(t => ({
        symbol: t.symbol,
        name: t.name,
        category: t.category,
        coinType: t.coinType,
        balance: t.balance,
        objectId: t.objectId ?? null
    }))));
    window.dispatchEvent(new CustomEvent('portfolio-add-cleanup', { detail: { tokens: selected } }));
    setSelectedTokens(new Set());
}, [filteredTokens, selectedTokens, tokenKey]);

  /* --- empty / loading states --- */
  if (!address) {
    return (
      <div className="portfolio-panel portfolio-empty">
        <span className="portfolio-empty-icon">◎</span>
        <p>Connect a wallet or enter an address to view the portfolio.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="portfolio-panel portfolio-loading">
        <div className="portfolio-spinner" />
        <p>Loading portfolio…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-panel portfolio-empty">
        <span className="portfolio-empty-icon">⚠</span>
        <p className="portfolio-error-text">{error}</p>
      </div>
    );
  }

  if (!data || (data.tokens.length === 0 && data.nfts.length === 0)) {
    return (
      <div className="portfolio-panel portfolio-empty">
        <span className="portfolio-empty-icon">◇</span>
        <p>No DeFi positions or NFT collections detected.</p>
      </div>
    );
  }

  return (
    <div className="portfolio-panel">
      {/* Header */}
      <div className="portfolio-header">
        <div className="portfolio-header-top">
          <h3 className="portfolio-title">Portfolio</h3>
          {data.suiNsName && (
            <span className="portfolio-suins">{data.suiNsName}.sui</span>
          )}
        </div>
        <div className="portfolio-stats-row">
          <span className="portfolio-stat">
            <span className="portfolio-stat-num">${totalUsd.toFixed(2)}</span>
            <span className="portfolio-stat-label">TOTAL</span>
          </span>
          <span className="portfolio-stat" style={{ color: "var(--xr-safe, #46b58c)" }}>
            <span className="portfolio-stat-num">{realCount}</span>
            <span className="portfolio-stat-label">REAL</span>
          </span>
          <span className="portfolio-stat" style={{ color: "var(--xr-amber, #e8b84b)" }}>
            <span className="portfolio-stat-num">{testCount}</span>
            <span className="portfolio-stat-label">TEST</span>
          </span>
          <span className="portfolio-stat" style={{ color: "var(--xr-coral)" }}>
            <span className="portfolio-stat-num">{spamCount}</span>
            <span className="portfolio-stat-label">SPAM</span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="portfolio-filters">
        <div className="portfolio-filter-group">
          <span className="portfolio-filter-label">Category</span>
          <div className="portfolio-filter-btns">
            {(["all", "real", "test", "spam", "unknown"] as const).map((cat) => (
              <button
                key={cat}
                className={`portfolio-filter-btn ${filterCategory === cat ? "active" : ""}`}
                onClick={() => setFilterCategory(cat)}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {protocols.length > 0 && (
          <div className="portfolio-filter-group">
            <span className="portfolio-filter-label">Protocol</span>
            <div className="portfolio-filter-btns">
              <button
                className={`portfolio-filter-btn ${filterProtocol === "all" ? "active" : ""}`}
                onClick={() => setFilterProtocol("all")}
              >
                ALL
              </button>
              {protocols.map((p) => (
                <button
                  key={p}
                  className={`portfolio-filter-btn ${filterProtocol === p ? "active" : ""}`}
                  onClick={() => setFilterProtocol(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="portfolio-filter-group">
          <span className="portfolio-filter-label">Sort</span>
          <div className="portfolio-filter-btns">
            {(["balance", "value", "name"] as const).map((s) => (
              <button
                key={s}
                className={`portfolio-filter-btn ${sortBy === s ? "active" : ""}`}
                onClick={() => setSortBy(s)}
              >
                {s === "balance" ? "BALANCE ↓" : s === "value" ? "VALUE ↓" : "NAME A–Z"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Token list */}
      <div className="portfolio-tokens">
        {filteredTokens.length === 0 ? (
          <p className="portfolio-empty-list">No tokens match the current filters.</p>
        ) : (
          filteredTokens.map((token, i) => {
            const key = tokenKey(token, i);
            const selectable = isSelectableToken(token);
            const checked = selectedTokens.has(key);
            const priceKnown = token.priceKnown !== false && token.price != null && token.price > 0;
            const usdDisplay = priceKnown && token.usdValue > 0 ? `${token.usdValue.toFixed(4)}` : `$—`;
            return (
            <div
              key={`${token.symbol}-${token.name}-${i}`}
              className={`portfolio-token-item ${selectable ? "selectable" : "keeper"}`}
              style={selectable ? { cursor: "pointer" } : undefined}
            >
              <div className="portfolio-token-left">                 <button
                className={`portfolio-token-check ${checked ? "on" : ""}`}
                onClick={(e) => { e.stopPropagation(); toggleTokenSelect(key); }}
                style={{ pointerEvents: "auto", cursor: "pointer", opacity: 1, width: "26px", height: "26px" }}
              >
                {checked ? "✓" : ""}
              </button>
                {token.iconUrl ? (
                   <img
                     className="portfolio-token-icon"
                     src={proxyImage(token.iconUrl)}
                     alt={token.symbol}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span className="portfolio-token-icon-placeholder">◆</span>
                )}
                <span className="portfolio-token-symbol">{token.symbol}</span>
                <span className="portfolio-token-name">{token.name}</span>
              </div>
              <div className="portfolio-token-right">
                <span className="portfolio-token-bal">{token.balance.toLocaleString('en-US', { maximumSignificantDigits: 6 })}</span>
                <span className="portfolio-token-usd">${token.usdValue.toFixed(4)}</span>
                <CategoryBadge category={token.category} />
                <ProtocolBadge protocol={token.protocol} />
                {token.isLp && <span className="portfolio-lp-badge">LP</span>}
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* NFTs */}
      {data.nfts.length > 0 && (
        <div className="portfolio-nfts-section">
          <button
            className="portfolio-section-toggle"
            onClick={() => setShowNfts(!showNfts)}
          >
            <span>NFTs ({data.nfts.length})</span>
            <span>{showNfts ? "▲" : "▼"}</span>
          </button>
          {showNfts && (
            <div className="portfolio-nfts-grid">
              {data.nfts.map((nft, i) => (
                <NftCard key={`nft-${nft.tokenId}-${i}`} nft={nft} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="portfolio-actions">
        {selectedTokens.size > 0 && (
          <button
            className="portfolio-action-btn cleanup-btn"
            onClick={handleAddToCleanup}
          >
            ✦ ADD TO CLEANUP ({selectedTokens.size} selected)
          </button>
        )}
        <button className="portfolio-action-btn select-all-btn" onClick={selectAll}>
          {selectedTokens.size === filteredTokens.length ? "☐ DESELECT ALL" : "☑ SELECT ALL"}
        </button>
        {dustTokens.length > 0 && (
          <button
            className="portfolio-action-btn dust-btn"
            onClick={handleSwapDust}
            disabled={swapStatus === "loading"}
          >
            {swapStatus === "loading" ? (
              <span>Processing…</span>
            ) : (
              <span>🧹 Clear Dust ({dustTokens.length} tokens → SUI)</span>
            )}
          </button>
        )}
        <button className="portfolio-action-btn export-btn" onClick={handleExport}>
          📊 Export CSV
        </button>
      </div>

      {/* Swap status message */}
      {swapMessage && (
        <div className={`portfolio-swap-msg ${swapStatus}`}>
          <p>{swapMessage}</p>
          {swapTxHash && (
            <div className="portfolio-tx-hash">
              <span className="portfolio-tx-label">TX:</span>
              <a
                className="portfolio-tx-link"
                href={`https://suiscan.xyz/mainnet/tx/${swapTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {swapTxHash.slice(0, 16)}…{swapTxHash.slice(-8)}
              </a>
            </div>
          )}
          {swapPlans.length > 0 && (
            <div className="portfolio-swap-plans">
              {swapPlans.map((p, i) => (
                <div key={i} className="portfolio-swap-plan-item">
                  <span className="portfolio-swap-plan-sym">{p.symbol}</span>
                  <span className="portfolio-swap-plan-arrow">→</span>
                  <span className="portfolio-swap-plan-sui">~{p.expectedSuiOut.toFixed(4)} SUI</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="portfolio-footer">
        <span className="portfolio-updated">
          Updated {new Date(data.updatedAt).toLocaleTimeString()}
          {data.source && (
            <span className="portfolio-source"> · {data.source === "blockberry" ? "Powered by Blockberry" : "Sui RPC"}</span>
          )}
        </span>
      </div>
    </div>
  );
}
