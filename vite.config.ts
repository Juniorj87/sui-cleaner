import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-ignore — .mjs imports are resolved by Vite at runtime, not by tsc
import { handleRpcRequest, handleGraphqlRequest, handleQuoteRequest, handleConfigRequest } from "./server/rpc-proxy.mjs";
// @ts-ignore
import { handleAiRequest, handlePortfolioRequest, handleSwapDustRequest, handleNetworkStats } from "./server/ai-proxy.mjs";
// @ts-ignore
import { handleImageProxyRequest } from "./server/image-proxy.mjs";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // same-origin read-only RPC proxy + config endpoint for development
      // (production uses scripts/serve.mjs which mounts the same handlers).
      // No @types/node is installed, so the middleware is deliberately untyped.
      name: "sui-cleaner-rpc-proxy",
      configureServer: (server: { middlewares: { use: (p: string, h: (req: any, res: any) => Promise<void>) => void } }) => {
        const MAX_BODY = 1024 * 1024;
        function setSecurityHeaders(res: any) {
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("X-Frame-Options", "DENY");
          res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        }
        async function readBody(req: any): Promise<string | null> {
          let raw = "";
          for await (const chunk of req) { raw += chunk; if (raw.length > MAX_BODY) return null; }
          return raw;
        }

        server.middlewares.use("/api/rpc", async (req: any, res: any) => {
          setSecurityHeaders(res);
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const raw = await readBody(req);
          if (raw === null) { res.statusCode = 413; res.end("payload too large"); return; }
          let parsed;
          try {
            parsed = JSON.parse(raw || "{}");
          } catch {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32700, message: "bad-json" } }));
            return;
          }
          if (Array.isArray(parsed)) {
            const results = await Promise.all(
              parsed.map((req) => handleRpcRequest(req?.method, req?.params, req?.id))
            );
            res.statusCode = 200;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(results.map((r) => r.body)));
          } else {
            const { status, body } = await handleRpcRequest(parsed?.method, parsed?.params, parsed?.id);
            res.statusCode = status;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(body));
          }
        });
        server.middlewares.use("/api/graphql", async (req: any, res: any) => {
          setSecurityHeaders(res);
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const raw = await readBody(req);
          if (raw === null) { res.statusCode = 413; res.end("payload too large"); return; }
          const { status, body } = await handleGraphqlRequest(raw);
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        });
        server.middlewares.use("/api/quote", async (req: any, res: any) => {
          setSecurityHeaders(res);
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const raw = await readBody(req);
          if (raw === null) { res.statusCode = 413; res.end("payload too large"); return; }
          const { status, body } = await handleQuoteRequest(raw);
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        });
        server.middlewares.use("/api/config", async (req: any, res: any) => {
          setSecurityHeaders(res);
          const { status, body } = await handleConfigRequest();
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        });
        server.middlewares.use("/api/network-stats", async (req: any, res: any) => {
          setSecurityHeaders(res);
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const { status, body } = await handleNetworkStats();
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        });
        // AI analysis endpoint
        server.middlewares.use("/api/ai/analyze", async (req: any, res: any) => {
          setSecurityHeaders(res);
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const raw = await readBody(req);
          if (raw === null) { res.statusCode = 413; res.end("payload too large"); return; }
          const { status, body } = await handleAiRequest(raw);
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        });
        // Portfolio endpoint — DeFi positions + NFT collections
        server.middlewares.use("/api/ai/portfolio", async (req: any, res: any) => {
          setSecurityHeaders(res);
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const { status, body } = await handlePortfolioRequest(req.url?.split("?")[1] || "");
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        });
        // Image proxy — bypasses CORS for IPFS and external images.
        // SSRF-safe: same shared handler as the production server (https-only,
        // host allowlist + DNS validation, redirect re-check).
        server.middlewares.use("/api/ai/image-proxy", async (req: any, res: any) => {
          setSecurityHeaders(res);
          // @ts-ignore — URL is available at runtime in Node.js
          const url = new URL(req.url ?? "/", "http://localhost");
          const imageUrl = url.searchParams.get("url");
          const { status, contentType, buffer, error } = await handleImageProxyRequest(imageUrl);
          res.statusCode = status;
          if (buffer) {
            res.setHeader("Content-Type", contentType);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "public, max-age=86400");
            // @ts-ignore — Buffer available in Node.js
            res.end(buffer);
          } else {
            res.end(error || "Image proxy failed");
          }
        });
        // Dust-to-SUI swap batch endpoint
        server.middlewares.use("/api/ai/swap-dust", async (req: any, res: any) => {
          setSecurityHeaders(res);
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const raw = await readBody(req);
          if (raw === null) { res.statusCode = 413; res.end("payload too large"); return; }
          const { status, body } = await handleSwapDustRequest(raw);
          res.statusCode = status;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        });
      },
    },
  ],
  server: { port: 5174, strictPort: true, host: true },
  preview: { port: 5174, strictPort: true },
});
