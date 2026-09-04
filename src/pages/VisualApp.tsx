import React, { useState } from "react";
import { ArrowRight, ArrowLeft, Search, ChevronRight, CheckCircle2, ExternalLink } from "lucide-react";
import { Topbar, FeatureStrip, BrandLine, Stepper, EmptyCheck, Pill } from "../components/visual/Chrome";
import { SuiScene, MiniScene } from "../components/visual/Scene";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useConnectAction } from "../lib/useConnectAction";
import "../styles/visual.css";

// Visual shell — identical to Project A, visual layer untouched
function Shell({ go, title, children }: { go: (s: string) => void; title: string; children: React.ReactNode }) {
  return (
    <div className="page">
      <div className="frame subframe">
        <Topbar onHome={() => go("home")} onClean={() => go("connect")} />
        <div className="screen-title">{title}</div>
        <main>{children}</main>
      </div>
    </div>
  );
}

function Home({ go }: { go: (s: string) => void }) {
  return (
    <div className="page">
      <div className="frame">
        <Topbar onHome={() => go("home")} onClean={() => go("connect")} />
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">SUI WALLET CLEANER</span>
            <h1>
              CLEANER<br />
              WALLETS<br />
              BRIGHTER<br />
              <strong>POSSIBILITIES</strong>
            </h1>
            <p>
              Analyze, understand and clean your Sui wallet.<br />
              You stay in control.
            </p>
            <div className="actions">
              <button className="yellow" onClick={() => go("connect")}>
                CLEAN MY WALLET <ArrowRight size={15} />
              </button>
              <button className="outline" onClick={() => go("connect")}>
                TRY DEMO
              </button>
            </div>
            <small className="proof">NON-CUSTODIAL · READ-ONLY · OPEN SOURCE</small>
          </div>
          <SuiScene />
        </section>
        <FeatureStrip />
      </div>
    </div>
  );
}

// CONNECT — now wired to real Sui wallet (Project B functionality)
function Connect({ go }: { go: (s: string) => void }) {
  const account = useCurrentAccount();
  const connect = useConnectAction(() => {});
  return (
    <Shell go={go} title="CONNECT WALLET">
      <div className="connect-screen">
        <div className="connect-art">
          <SuiScene />
          <span className="handwrite">
            Same<br />
            Safety.<br />
            Greater<br />
            Potential<br />♡
          </span>
        </div>
        <div className="connect-copy">
          <h2>
            Let’s clean<br />
            your wallet
          </h2>
          <p>
            Connect your wallet to get started.
            <br />
            Your keys never leave your device.
          </p>
          {account && (
            <div style={{ margin: "12px 0", fontSize: 9, color: "#60aef0", border: "1px solid #153b57", padding: 8, borderRadius: 8 }}>
              Connected: {account.address.slice(0, 6)}…{account.address.slice(-4)}
            </div>
          )}
          <div className="wallets">
            {["Sui Wallet", "Ethos", "Nightly", "Suiet"].map((x, i) => (
              <button key={x} onClick={() => !account && connect()}>
                <span>{["◉", "C", "N", "S"][i]}</span>
                <small>{x}</small>
              </button>
            ))}
          </div>
          <button className="yellow wide" onClick={() => (account ? go("scanning") : connect())}>
            {account ? "CONTINUE TO SCAN" : "CONNECT WALLET"} <ArrowRight size={15} />
          </button>
          <span className="or">or</span>
          <button className="outline wide" onClick={() => go("scanning")}>
            TRY DEMO MODE
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Readonly({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="ENTER ADDRESS (READ-ONLY)">
      <div className="readonly">
        <div className="tabs">
          <button>Connected Wallet</button>
          <button className="selected">Public Address</button>
        </div>
        <h2>Explore any Sui address</h2>
        <p>
          Get a read-only analysis of any public Sui address.
          <br />
          No connection needed.
        </p>
        <div className="searchbox">
          <input placeholder="0x..." />
          <button onClick={() => go("scanning")}>
            <Search size={18} />
          </button>
        </div>
        <label>EXAMPLE ADDRESSES</label>
        <div className="chips">
          <span>DeFi Whale</span>
          <span>NFT Collector</span>
          <span>Project Treasury</span>
        </div>
        <div className="readonly-scene">
          <SuiScene compact />
        </div>
      </div>
    </Shell>
  );
}

function Check() {
  return <CheckCircle2 size={12} />;
}

function Scanning({ go }: { go: (s: string) => void }) {
  React.useEffect(() => {
    const t = setTimeout(() => go("results"), 1800);
    return () => clearTimeout(t);
  }, [go]);
  return (
    <Shell go={go} title="SCANNING">
      <div className="scan-screen">
        <button className="back" onClick={() => go("connect")}>
          CANCEL <ChevronRight size={14} />
        </button>
        <BrandLine address={false} />
        <div className="scan-center">
          <h2>Analyzing your wallet...</h2>
          <p>Reading on-chain data. This is a read-only scan.</p>
          <MiniScene />
          <div className="progress">
            <span style={{ width: "72%" }} />
          </div>
          <b>72%</b>
          <small>SCANNING THE SUI ECOSYSTEM</small>
        </div>
        <ul className="scan-list">
          <li>
            <Check />
            Fetching objects
          </li>
          <li>
            <Check />
            Classifying assets
          </li>
          <li>
            <Check />
            Detecting cleaning opportunities
          </li>
          <li>
            <Check />
            Almost there...
          </li>
        </ul>
      </div>
    </Shell>
  );
}

const stats: [string, string, string, string][] = [
  ["KEEP", "12", "Assets with value", "green"],
  ["REVIEW", "28", "Take a closer look", "gold"],
  ["PROTECTED", "3", "Stay safe", "blue"],
  ["CAN BE CLEANED", "216", "Potential cleanup", "purple"],
];
function Results({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="SCAN RESULTS">
      <div className="results">
        <BrandLine />
        <h2>Your wallet at a glance</h2>
        <p>Here’s what we found. You decide what to do next.</p>
        <div className="statgrid">
          {stats.map((s) => (
            <div className={"stat " + s[3]} key={s[0]}>
              <b>{s[0]}</b>
              <strong>{s[1]}</strong>
              <span>{s[2]}</span>
            </div>
          ))}
        </div>
        <div className="total">
          <strong>299</strong>
          <span>Total on-chain objects</span>
          <button className="outline" onClick={() => go("objects")}>
            EXPLORE ALL <ArrowRight size={13} />
          </button>
        </div>
        <div className="result-scene">
          <MiniScene />
        </div>
      </div>
    </Shell>
  );
}

const objects: [string, string, string, string, string][] = [
  ["SUI", "Coin", "42.391 SUI", "KEEP", "keep"],
  ["USDC", "Coin", "12.42 USDC", "KEEP", "keep"],
  ["Unknown Token", "0x01...2a", "500.00 ???", "REVIEW", "review"],
  ["Cetus Position", "DeFi Position", "1 object", "PROTECTED", "protected"],
  ["AUSD (empty)", "Empty Coin Object", "0 balance", "CLEAN", "clean"],
  ["DEEP (empty)", "Empty Coin Object", "0 balance", "CLEAN", "clean"],
];
function Objects({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="EXPLORE OBJECTS">
      <div className="objects">
        <BrandLine />
        <div className="objects-head">
          <h2>All objects</h2>
          <div className="filters">
            {["All", "Keep", "Review", "Protected", "Cleanable"].map((x, i) => (
              <button className={i === 0 ? "selected" : ""} key={x}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="object-list">
          {objects.map((o) => (
            <button className="object-row" key={o[0]} onClick={() => o[4] === "clean" && go("details")}>
              <EmptyCheck />
              <span className={"obj-icon " + o[4]}>{o[0][0]}</span>
              <span className="obj-name">
                <b>{o[0]}</b>
                <small>{o[1]}</small>
              </span>
              <strong>{o[2]}</strong>
              <Pill type={o[4]}>{o[3]}</Pill>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
        <div className="object-foot">
          <span>0 SELECTED</span>
          <button className="disabled">
            REVIEW CLEANUP <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Details({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="OBJECT DETAILS">
      <div className="details">
        <button className="back" onClick={() => go("objects")}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="detail-card">
          <div className="bigicon purple">◔</div>
          <h2>AUSD Empty Coin Object</h2>
          <Pill type="clean">CAN BE CLEANED</Pill>
          <p>
            This is an empty on-chain coin object.
            <br />
            It contains no token balance.
          </p>
          <dl>
            <dt>Object ID</dt>
            <dd>0x7f3c...e9a1</dd>
            <dt>Type</dt>
            <dd>0x2::coin::Coin&lt;0x...AUSD&gt;</dd>
            <dt>Balance</dt>
            <dd>0</dd>
            <dt>Owner</dt>
            <dd>Your wallet</dd>
            <dt>Digest</dt>
            <dd>3nQ...9kL2</dd>
          </dl>
          <div className="method">
            <small>CLEANUP METHOD</small>
            <b>→ destroy_zero()</b>
            <span>Verified cleaning method for zero-balance coin objects.</span>
          </div>
          <button className="outline wide">
            VIEW ON SUISCAN <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Selection({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="SELECTION">
      <div className="selection">
        <BrandLine />
        <h2>9 items selected</h2>
        <p>Review your selection before proceeding.</p>
        <div className="selection-list">
          {[
            ["AUSD (empty)", "12 objects"],
            ["DEEP (empty)", "7 objects"],
            ["BLUB (empty)", "4 objects"],
            ["USDT (dust)", "2 objects"],
          ].map((x) => (
            <div key={x[0]}>
              <EmptyCheck checked />
              <span className="obj-icon purple">◔</span>
              <b>{x[0]}</b>
              <small>{x[1]}</small>
              <ChevronRight size={13} />
            </div>
          ))}
        </div>
        <div className="selection-actions">
          <button className="outline">CLEAR SELECTION</button>
          <button className="yellow" onClick={() => go("review")}>
            REVIEW CLEANUP <ArrowRight size={14} />
          </button>
        </div>
        <MiniScene />
      </div>
    </Shell>
  );
}

function Review({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="CLEANUP REVIEW">
      <div className="review">
        <Stepper active={1} />
        <h2>Review your cleanup</h2>
        <p>Here’s what will be included in the transaction.</p>
        <div className="review-box">
          <span>
            ITEMS<strong>9</strong>
          </span>
          <span>
            AFFECTED OBJECTS<strong>23</strong>
          </span>
          <span>
            ACTIONS<strong>destroy_zero()</strong>
          </span>
        </div>
        <div className="cost">
          <small>ESTIMATED COST</small>
          <p>
            Network cost <b>0.0051 SUI</b>
          </p>
          <p>
            Cleaner fee <b>0.0051 SUI</b>
          </p>
          <strong>
            Total <b>0.0102 SUI</b>
          </strong>
        </div>
        <div className="notice">ⓘ Cleaner fee matches estimated network cost 1:1.</div>
        <div className="bottom-actions">
          <button className="outline">VIEW DETAILS</button>
          <button className="yellow" onClick={() => go("transaction")}>
            CONTINUE <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Transaction({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="TRANSACTION PREVIEW">
      <div className="transaction">
        <Stepper active={2} />
        <h2>Your transaction</h2>
        <p>This is the transaction your wallet will ask you to sign.</p>
        <div className="tx-box">
          <div>
            TRANSACTION <b>23 × destroy_zero()</b>
            <span>Remove empty coin objects</span>
          </div>
          <p>
            Estimated gas budget <b>0.0051 SUI</b>
          </p>
          <p>
            Estimated total cost <b>0.0102 SUI</b>
          </p>
          <p>
            Network <b>Sui Mainnet</b>
          </p>
          <p>
            Fee recipient <b>0x12e4...8f3d</b>
          </p>
        </div>
        <div className="what-next">
          <b>WHAT HAPPENS NEXT</b>
          <p>✓ You will approve this transaction in your wallet.</p>
          <p>✓ Objects will be removed from your wallet.</p>
          <p>✓ Nothing else will be touched.</p>
        </div>
        <div className="bottom-actions">
          <button className="outline">CANCEL</button>
          <button className="yellow" onClick={() => go("signature")}>
            OPEN WALLET <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Signature({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="WALLET SIGNATURE">
      <div className="signature">
        <Stepper active={3} />
        <div className="sig-copy">
          <h2>Approve in your wallet</h2>
          <p>
            Check the transaction details in your wallet
            <br />
            and confirm the signature.
          </p>
        </div>
        <div className="wallet-popup">
          <small>Sui Wallet</small>
          <b>Transaction Request</b>
          <hr />
          <strong>0.0102 SUI</strong>
          <span>Estimated total cost</span>
          <button className="approve" onClick={() => go("success")}>
            Approve
          </button>
          <button>Reject</button>
        </div>
        <p className="after">◷ After approval we’ll execute the transaction and verify the result.</p>
      </div>
    </Shell>
  );
}

function Success({ go }: { go: (s: string) => void }) {
  return (
    <Shell go={go} title="SUCCESS">
      <div className="success">
        <Stepper active={4} />
        <div className="success-art">
          <MiniScene success />
        </div>
        <h2>Cleanup complete!</h2>
        <p>
          Your wallet is cleaner and ready
          <br />
          for greater possibilities.
        </p>
        <div className="numbers">
          <span>
            <b>299</b>BEFORE
          </span>
          <span>
            <b>23</b>REMOVED
          </span>
          <span>
            <b>276</b>AFTER
          </span>
        </div>
        <div className="bottom-actions">
          <button className="outline">VIEW TRANSACTION</button>
          <button className="yellow" onClick={() => go("objects")}>
            CLEAN MORE <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Shell>
  );
}

export default function VisualApp() {
  const [screen, setScreen] = useState("home");
  const go = (s: string) => setScreen(s);
  const screens: Record<string, React.ReactNode> = {
    home: <Home go={go} />,
    connect: <Connect go={go} />,
    readonly: <Readonly go={go} />,
    scanning: <Scanning go={go} />,
    results: <Results go={go} />,
    objects: <Objects go={go} />,
    details: <Details go={go} />,
    selection: <Selection go={go} />,
    review: <Review go={go} />,
    transaction: <Transaction go={go} />,
    signature: <Signature go={go} />,
    success: <Success go={go} />,
  };
  return screens[screen] || screens.home;
}
