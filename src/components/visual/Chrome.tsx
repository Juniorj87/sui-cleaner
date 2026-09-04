import React from "react";
import { Droplets, ShieldCheck, ScanSearch, Code2, Sparkles, ArrowRight, Check, Search, ChevronRight, ExternalLink } from "lucide-react";

export const Logo = () => (
  <div className="logo">
    <Droplets size={22} />
    <strong>SUI CLEANER</strong>
  </div>
);

export function Topbar({ onHome = () => {}, onClean = () => {} }: { onHome?: () => void; onClean?: () => void }) {
  return (
    <header className="topbar">
      <button className="logo-button" onClick={onHome} aria-label="Sui Cleaner home">
        <Logo />
      </button>
      <nav>
        <a href="#home">Why</a>
        <a href="#how">How it works</a>
        <a href="#security">Security</a>
        <a href="#docs">Docs</a>
        <a href="#faq">FAQ</a>
      </nav>
      <button className="yellow small" onClick={onClean}>
        CLEAN MY WALLET <ArrowRight size={13} />
      </button>
    </header>
  );
}

export const FeatureStrip = () => (
  <div className="feature-strip">
    {[
      [ShieldCheck, "01", "NON-CUSTODIAL", "You stay in control"],
      [ScanSearch, "02", "READ-ONLY SCAN", "No private keys"],
      [Code2, "03", "OPEN SOURCE", "More transparency"],
      [Sparkles, "04", "REAL IMPACT", "A cleaner Sui ecosystem"],
    ].map(([I, n, t, d]) => {
      const Icon = I as React.ComponentType<{ size?: number }>;
      return (
        <div className="feature" key={n as string}>
          <span className="feature-icon">
            <Icon size={17} />
          </span>
          <div>
            <small>{n as string}</small>
            <b>{t as string}</b>
            <em>{d as string}</em>
          </div>
        </div>
      );
    })}
  </div>
);

export function BrandLine({ address = true }: { address?: boolean }) {
  return (
    <div className="brandline">
      <Logo />
      {address && (
        <span className="address">
          <span>◉</span> 0x3a2...90ef
        </span>
      )}
    </div>
  );
}

export const Stepper = ({ active = 1 }: { active?: number }) => (
  <div className="stepper">
    {["Select", "Review", "Transaction", "Sign", "Done"].map((x, i) => (
      <div key={x} className={i < active ? "done" : i === active ? "active" : ""}>
        <i>{i < active ? <Check size={9} /> : i + 1}</i>
        <span>{x}</span>
      </div>
    ))}
  </div>
);

export const EmptyCheck = ({ checked = false }: { checked?: boolean }) => (
  <span className={"check " + (checked ? "checked" : "")}>{checked && <Check size={13} />}</span>
);

export const Pill = ({ children, type = "" }: { children: React.ReactNode; type?: string }) => (
  <span className={"pill " + type}>{children}</span>
);

// Re-export icons for VisualApp convenience
export { ArrowRight, Check, Search, ChevronRight, ExternalLink };
