// Production server: serves the built site (dist/) with SPA fallback and
// mounts the same read-only /api/rpc proxy used by the dev server.
//
//   npm run build && npm start
//
// Env:
//   PORT        — listen port (default 4173)
//   SUI_RPC_URL — upstream RPC provider (default https://sui.publicnode.com)

import { loadEnvFile } from "node:process";
try {
  loadEnvFile();
} catch {}

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { handleRpcRequest, handleGraphqlRequest, handleQuoteRequest, handleConfigRequest } from "../server/rpc-proxy.mjs";
import { handleAiRequest, handlePortfolioRequest, handleSwapDustRequest, handleNetworkStats } from "../server/ai-proxy.mjs";
import { handleImageProxyRequest } from "../server/image-proxy.mjs";

const PORT = Number(process.env.PORT ?? 4173);
const DIST = normalize(join(process.cwd(), "dist"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

async function serveStatic(res, pathname) {
  let filePath = normalize(join(DIST, pathname));
  if (filePath !== DIST && !filePath.startsWith(DIST + sep)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  try {
    const st = await stat(filePath);
    if (st.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // SPA fallback — unknown paths render the app
    filePath = join(DIST, "index.html");
  }
  try {
    const data = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("content-type", MIME[extname(filePath)] ?? "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/api/rpc") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
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
    return;
  }

  if (url.pathname === "/api/graphql" || url.pathname === "/api/quote") {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { status, body } =
      url.pathname === "/api/quote"
        ? await handleQuoteRequest(raw)
        : await handleGraphqlRequest(raw);
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
    return;
  }

  if (url.pathname === "/api/config") {
    const { status, body } = await handleConfigRequest();
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
    return;
  }

  if (url.pathname === "/api/network-stats") {
    if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
    const { status, body } = await handleNetworkStats();
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
    return;
  }

  if (url.pathname === "/api/ai/image-proxy") {
    const imageUrl = url.searchParams.get("url");
    const { status, contentType, buffer, error } = await handleImageProxyRequest(imageUrl);
    res.statusCode = status;
    if (buffer) {
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(buffer);
    } else {
      res.end(error || "Image proxy failed");
    }
    return;
  }

  // AI endpoints — shared handlers so production matches the dev middleware.
  if (url.pathname === "/api/ai/analyze") {
    if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { status, body } = await handleAiRequest(raw);
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
    return;
  }

  if (url.pathname === "/api/ai/portfolio") {
    if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
    const { status, body } = await handlePortfolioRequest(url.search.slice(1));
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
    return;
  }

  if (url.pathname === "/api/ai/swap-dust") {
    if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { status, body } = await handleSwapDustRequest(raw);
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
    return;
  }

  await serveStatic(res, url.pathname === "/" ? "/index.html" : url.pathname);
});

server.listen(PORT, () => {
  console.log(`SUI CLEANER — serving dist/ on http://localhost:${PORT}`);
});
