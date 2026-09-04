import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import mascotImg from "../assets/mascot.png";

/**
 * Public website header — clean navigation header with brand mascot, social icons, and responsive drawer.
 */
export default function SiteHeader() {
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const close = () => setMenu(false);

  /** scroll to a landing section — from another page, go home first */
  const scrollTo = (id: string) => {
    setMenu(false);
    if (location.pathname !== "/") {
      navigate("/", { state: { scrollTo: id } });
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="navbar" style={{ background: "rgba(2, 8, 15, 0.88)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-6 md:px-8">
        <Link to="/" className="sc-brand" onClick={close} style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#f8fafc", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em" }}>
          <img src={mascotImg} alt="Sui Cleaner Mascot" style={{ width: 30, height: 30, objectFit: "contain" }} />
          <span>SUI <span style={{ color: "var(--sc-cyan)" }}>CLEANER</span></span>
        </Link>

        {/* NOTE: no inline display here — .nav-links from the stylesheet owns
            it, otherwise the mobile collapse rule can never apply. */}
        <ul className={`nav-links ${menu ? "open" : ""}`} style={{ listStyle: "none", alignItems: "center", gap: 32, margin: 0, padding: 0 }}>
          <li>
            <button
              type="button"
              className={isActive("/") ? "nav-active" : ""}
              onClick={() => scrollTo("why")}
              style={{ background: "none", border: "none", color: "#cbd5e1", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Why
            </button>
          </li>
          <li>
            <Link
              to="/how-it-works"
              className={isActive("/how-it-works") ? "nav-active" : ""}
              onClick={close}
              style={{ color: isActive("/how-it-works") ? "var(--sc-cyan)" : "#cbd5e1", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
            >
              How it works
            </Link>
          </li>
          <li>
            <Link
              to="/security"
              className={isActive("/security") ? "nav-active" : ""}
              onClick={close}
              style={{ color: isActive("/security") ? "var(--sc-cyan)" : "#cbd5e1", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
            >
              Security
            </Link>
          </li>
          <li>
            <Link
              to="/docs"
              className={isActive("/docs") ? "nav-active" : ""}
              onClick={close}
              style={{ color: isActive("/docs") ? "var(--sc-cyan)" : "#cbd5e1", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
            >
              Docs
            </Link>
          </li>
          <li>
            <Link
              to="/faq"
              className={isActive("/faq") ? "nav-active" : ""}
              onClick={close}
              style={{ color: isActive("/faq") ? "var(--sc-cyan)" : "#cbd5e1", textDecoration: "none", fontSize: 14, fontWeight: 600 }}
            >
              FAQ
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-3">
          {/* Twitter / X Icon */}
          <a
            href="https://x.com/SuiCleaner"
            target="_blank"
            rel="noopener noreferrer"
            title="Sui Cleaner on X (Twitter)"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#cbd5e1",
              textDecoration: "none",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--sc-cyan)";
              e.currentTarget.style.borderColor = "rgba(35, 196, 255, 0.4)";
              e.currentTarget.style.background = "rgba(35, 196, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#cbd5e1";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          {/* GitHub Icon */}
          <a
            href="https://github.com/Juniorj87/sui-cleaner"
            target="_blank"
            rel="noopener noreferrer"
            title="Sui Cleaner on GitHub"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#cbd5e1",
              textDecoration: "none",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--sc-cyan)";
              e.currentTarget.style.borderColor = "rgba(35, 196, 255, 0.4)";
              e.currentTarget.style.background = "rgba(35, 196, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#cbd5e1";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            }}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>

          {/* CTA */}
          <Link
            to="/app"
            className="sc-primary sc-primary--nav"
            onClick={close}
            style={{ height: 42, minWidth: 140, padding: "0 18px", fontSize: 13 }}
          >
            CLEAN MY WALLET
          </Link>

          {/* Hamburger for Mobile */}
          <button
            className="hamburger"
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-label="Toggle Menu"
            aria-expanded={menu}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </nav>
  );
}
