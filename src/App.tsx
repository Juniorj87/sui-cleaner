import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import Security from "./pages/Security";
import Docs from "./pages/Docs";
import Faq from "./pages/Faq";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import AppPage from "./pages/AppPage";

// /visual is a standalone prototype shell with its own generic CSS
// (.review, .success, .page, ...). Lazy-loading confines that stylesheet
// to the route so it can never leak into the product pages.
const VisualApp = lazy(() => import("./pages/VisualApp"));

export default function App() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <Routes>
      {/* PUBLIC SITE — understanding + trust */}
      <Route path="/" element={<Home />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/security" element={<Security />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* APP — the product itself */}
      <Route path="/app" element={<AppPage />} />
      {/* Visual demo — Project A functionality wired to Project B components */}
      <Route path="/visual" element={<VisualApp />} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
