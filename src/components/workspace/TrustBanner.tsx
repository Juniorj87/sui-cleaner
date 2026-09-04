import { Link } from "react-router-dom";

export default function TrustBanner() {
  return (
    <section className="ws-trust-banner" aria-label="Trust and Security Highlights">
      <div className="trust-item">
        <div className="trust-icon-wrap trust-shield">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="trust-text">
          <div className="trust-title">Sui Cleaner is safe & secure</div>
          <div className="trust-desc">Read-only scan. You approve every transaction.</div>
        </div>
      </div>

      <div className="trust-item">
        <div className="trust-icon-wrap trust-lock">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="trust-text">
          <div className="trust-title">Your data is private</div>
          <div className="trust-desc">We never store your private keys or seed phrase.</div>
        </div>
      </div>

      <div className="trust-item">
        <div className="trust-icon-wrap trust-zap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div className="trust-text">
          <div className="trust-title">Transparent & open</div>
          <div className="trust-desc">View contracts, fees and transactions anytime.</div>
        </div>
      </div>

      <Link to="/security" className="trust-learn-link">
        Learn more <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
