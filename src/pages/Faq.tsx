import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import faqBg from "../assets/faq.png";
import "./Home.css";

interface FaqItem {
  category: "basics" | "security" | "rebates" | "technical" | "defi";
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  // BASICS
  {
    category: "basics",
    q: "What is Sui Cleaner?",
    a: "Sui Cleaner is a non-custodial object management, wallet optimization, and storage rebate recovery engine built specifically for the Sui blockchain. It analyzes your on-chain inventory, identifies zero-balance coins, dust fragments, and unwanted spam objects, and lets you safely destroy or sweep them in one atomic transaction."
  },
  {
    category: "basics",
    q: "Why does my Sui wallet accumulate so many unnecessary objects?",
    a: "Unlike account-based blockchains like Ethereum, Sui represents all assets as individual Move objects. Swapping tokens, minting NFTs, and interacting with dApps leaves residual objects behind — such as empty Coin<T> objects with a 0 balance, small dust fragments, and expired position receipts. These objects permanently occupy on-chain storage until explicitly destroyed."
  },
  {
    category: "basics",
    q: "What wallets are supported by Sui Cleaner?",
    a: "Sui Cleaner supports all standard Sui wallets via the official @mysten/dapp-kit standard, including Sui Wallet, Suiet, Nightly, Martian, OKX Wallet, Phantom, Bitget Wallet, and Ledger hardware wallets."
  },

  // SECURITY
  {
    category: "security",
    q: "Can Sui Cleaner access my private keys or seed phrase?",
    a: "No. Sui Cleaner is 100% non-custodial. Your private keys and recovery seed phrases never leave your secure wallet extension or Ledger device. The application has zero access to your cryptographic credentials and will never prompt you for a seed phrase."
  },
  {
    category: "security",
    q: "Can Sui Cleaner accidentally delete my valuable tokens or NFTs?",
    a: "Never. Sui Cleaner enforces strict deterministic rules. Any coin with a balance greater than zero and any recognized NFT collection is marked KEEP and cannot be queued for cleanup. Furthermore, system-critical singletons like Staked SUI, Kiosk Owner Capabilities, and Treasury Caps are hardcoded as PROTECTED and permanently excluded."
  },
  {
    category: "security",
    q: "What are 'Protected' objects?",
    a: "Protected objects are system-critical Move structs essential to your wallet's security and assets. This includes StakedSui (active staking positions), KioskOwnerCap (administrative access to your Sui Kiosk), Kiosk containers, TreasuryCap (token minting rights), and UpgradeCap (smart contract deployment rights). These are hard-blocked by code."
  },
  {
    category: "security",
    q: "What happens if a cleanup transaction fails?",
    a: "All cleanup commands are bundled into an atomic Programmable Transaction Block (PTB). If any single command fails or encounters unexpected state, the entire transaction automatically reverts with zero state changes. Your assets remain untouched."
  },

  // REBATES & FEES
  {
    category: "rebates",
    q: "How do I get real SUI back from the Sui Storage Fund?",
    a: "When any on-chain object is created on Sui, the creator pays a storage gas fee deposited into the Sui Storage Fund. When an empty object (such as an empty Coin wrapper) is destroyed via Move's coin::destroy_zero, the blockchain immediately refunds that storage deposit (Storage Rebate) directly back to the transaction sender in liquid SUI."
  },
  {
    category: "rebates",
    q: "How much does it cost to use Sui Cleaner?",
    a: "Scanning and analyzing any public Sui address is 100% free. When you execute a cleanup transaction, there is a flat 0.015 SUI service fee paid to our verified public treasury, plus standard network gas. In many cases, the storage rebate refunded from deleted objects exceeds the transaction cost, resulting in a net positive SUI balance gain!"
  },
  {
    category: "rebates",
    q: "Is the wallet scan completely free and read-only?",
    a: "Yes. Scanning only queries public JSON-RPC nodes to read public on-chain state. It does not require any wallet signature, gas, or fees."
  },

  // TECHNICAL
  {
    category: "technical",
    q: "What is `coin::destroy_zero`?",
    a: "`0x2::coin::destroy_zero` is a native Sui framework function. It takes a Coin<T> struct whose value is verified to be 0, unpacks the struct, deletes its UID from the global state, and returns the storage rebate. It is impossible to call this function on a coin that has any positive balance."
  },
  {
    category: "technical",
    q: "What is a Programmable Transaction Block (PTB)?",
    a: "A PTB is Sui's atomic transaction primitive. It allows chaining up to 1,024 Move commands into a single transaction without writing custom smart contracts. Sui Cleaner uses PTBs to batch destroy dozens of empty coins, merge dust, and transfer spam NFTs in a single signature."
  },
  {
    category: "technical",
    q: "Why can't EVM tools clean a Sui wallet?",
    a: "EVM blockchains (like Ethereum or Polygon) do not have an object-based storage model or a storage rebate fund. On EVM, account balances are rows in contract storage. On Sui, every asset is an independent Move object. Sui requires specialized Move bytecode PTB generation to interact with and destroy objects."
  },

  // DEFI & SPAM
  {
    category: "defi",
    q: "How does Sui Cleaner handle scam and phishing airdrop NFTs?",
    a: "Scammers frequently airdrop spam NFTs containing phishing URLs to public wallet addresses. If the spam NFT possesses the standard Move `store` ability, Sui Cleaner allows you to safely transfer it to the standard burn address `0x0`, permanently removing it from your wallet view."
  },
  {
    category: "defi",
    q: "How does DeFi Position Recovery work?",
    a: "Sui Cleaner detects redeemable DeFi positions across supported protocols such as Cetus LP, Scallop sCoins, and SpringSui sSUI. It generates the exact Move withdrawal call arguments to pull your locked liquidity back into liquid token balances."
  },
  {
    category: "defi",
    q: "What does it mean when an object is in 'Review'?",
    a: "An object is placed in the REVIEW zone when its Move package ID is not recognized in our verified registry. It might be a custom game item, a test token, or an unverified contract. Sui Cleaner holds it in Review so you can inspect its bytecode, read an AI metadata summary, and decide what action to take."
  }
];

export default function Faq() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Sui Cleaner FAQ — Frequently Asked Questions";
    const m = document.querySelector('meta[name="description"]');
    if (m) {
      m.setAttribute(
        "content",
        "Frequently asked questions about Sui Cleaner: Move object cleanup, storage rebate recovery, security guarantees, and non-custodial safety."
      );
    }
  }, []);

  const filteredFaqs = activeCategory === "all"
    ? FAQS
    : FAQS.filter(f => f.category === activeCategory);

  return (
    <div className="sc-landing">
      <SiteHeader />

      <div className="sc-master-wrap">
        <div className="sc-master-bg" aria-hidden="true">
          <img
            src={faqBg}
            alt="FAQ Background"
            className="sc-master-img"
            decoding="async"
            fetchPriority="high"
          />
          <div className="sc-master-overlay" aria-hidden="true" />
        </div>

        {/* SUBPAGE HERO */}
        <section className="sc-subhero" aria-label="FAQ Hero">
          <div className="sc-subhero-inner">
            <span className="sc-subhero-kicker">KNOWLEDGE BASE</span>
            <h1>Frequently Asked Questions</h1>
            <p>
              Clear, transparent answers about Sui Move objects, storage rebate refunds, non-custodial security, and wallet optimization.
            </p>
          </div>
        </section>

        {/* MAIN BODY */}
        <main className="sc-subpage-body">
          <div className="sc-container sc-container--narrow">
            {/* CATEGORY FILTER TABS */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 40
            }}>
              {[
                { id: "all", label: "All Questions" },
                { id: "basics", label: "Basics" },
                { id: "security", label: "Security & Safety" },
                { id: "rebates", label: "Storage Rebates & Fees" },
                { id: "technical", label: "Technical & Move" },
                { id: "defi", label: "DeFi & Spam" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(tab.id);
                    setOpenIndex(0);
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "999px",
                    border: activeCategory === tab.id
                      ? "1px solid var(--sc-cyan)"
                      : "1px solid rgba(255, 255, 255, 0.10)",
                    background: activeCategory === tab.id
                      ? "rgba(35, 196, 255, 0.15)"
                      : "rgba(6, 16, 32, 0.65)",
                    color: activeCategory === tab.id
                      ? "var(--sc-cyan)"
                      : "var(--sc-text-muted)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ACCORDION LIST */}
            <div className="sc-faq-group" style={{ marginBottom: 64 }}>
              {filteredFaqs.map((faq, i) => (
                <div key={i} className="sc-faq-item">
                  <button
                    type="button"
                    className="sc-faq-btn"
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    aria-expanded={openIndex === i}
                  >
                    <span className="sc-faq-q">{faq.q}</span>
                    <span className="sc-faq-icon">{openIndex === i ? "−" : "+"}</span>
                  </button>
                  {openIndex === i && (
                    <div className="sc-faq-body">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="sc-cta-box">
              <h2>Still Have Questions? Try a Free Scan</h2>
              <p>
                Run a read-only scan of your Sui address to explore your wallet&apos;s real on-chain objects with zero risk.
              </p>
              <div className="sc-cta-actions">
                <Link to="/app" className="sc-primary sc-primary--large">
                  CLEAN MY WALLET
                </Link>
                <Link to="/docs" className="sc-secondary">
                  READ TECHNICAL DOCS
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
