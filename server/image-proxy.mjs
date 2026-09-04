// SSRF-safe image proxy — shared by the dev middleware (vite.config.ts) and the
// production server (scripts/serve.mjs), so the two can never drift apart.
//
// The proxy exists to bypass CORS for on-chain NFT/token images (IPFS etc.).
// A proxy that fetches arbitrary URLs is an SSRF hole, so every fetch is
// gated:
//
//   1. protocol must be https (never http, file, ftp, gopher…)
//   2. hostname must be in the trusted allowlist, OR resolve to a public IP
//   3. before fetching, the hostname is DNS-resolved and every address is
//      checked: loopback, link-local, private ranges, CGNAT, metadata
//      endpoints (169.254.169.254) and the special-use 0.0.0.0 are rejected
//   4. redirects are followed manually (max 3) and each hop is re-validated
//      against the same rules — a redirect to localhost/private IP is refused
//   5. only image/* content is returned; the body size is capped

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB cap
const FETCH_TIMEOUT_MS = 10_000;

/** Explicitly trusted public hosts (their IPs are public by policy). */
const TRUSTED_HOST_SUFFIXES = [
  "ipfs.io",
  "ipfs.nftstorage.link",
  "nftstorage.link",
  "dweb.link",
  "arweave.net",
  "cloudflare-ipfs.com",
  "raw.githubusercontent.com",
  "github.com",
  "gateway.pinata.cloud",
  "suiscan.xyz",
  "suivision.xyz",
  "suiexplorer.com",
];

const NEVER_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function isBlockedHostname(host) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (NEVER_HOSTS.has(h)) return true;
  if (h === "0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^0x[0-9a-f]+$/i.test(h)) return true; // hex IP encoding
  if (/^\d+$/.test(h)) return true; // decimal IP encoding ("2130706433")
  // hostnames containing a colon but not parseable as an IP literal are junk
  if (h.includes(":") && isIP(h.replace(/^\[|\]$/g, "")) === 0) return true;
  return false;
}

/** True when the IP is private / reserved and must never be fetched. */
function isPrivateIp(ip) {
  const kind = isIP(ip);
  if (kind === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // RFC1918
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local incl. metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 192 && b === 0) return true; // IETF protocol assignments (192.0.0.0/24)
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  if (kind === 6) {
    const low = ip.toLowerCase();
    if (low === "::" || low === "::1") return true; // unspecified / loopback
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA fc00::/7
    if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true; // link-local fe80::/10
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice("::ffff:".length)); // v4-mapped
    if (low.startsWith("64:ff9b:")) return isPrivateIp(low.slice("64:ff9b:".length)); // NAT64 (approx)
    if (low.startsWith("2001:db8")) return true; // documentation
    if (low.startsWith("2001:10") || low.startsWith("2001:20")) return true; // ORCHID
    if (/^f[cd][0-9a-f]{2}:/.test(low)) return true;
    return false;
  }
  return true; // not a parsable IP → caller decides
}

/**
 * Validate a target URL against the SSRF rules without fetching.
 * Returns { ok: true } or { ok: false, reason }.
 */
async function validateImageUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "protocol-not-https" };

  const rawHost = parsed.hostname.toLowerCase().replace(/\.$/, "");
  // URL.hostname keeps brackets for IPv6 literals — normalize for IP checks
  const host = rawHost.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(rawHost)) return { ok: false, reason: "blocked-host" };

  // allowlist shortcut — trusted public hosts do not need a DNS round-trip
  const trusted = TRUSTED_HOST_SUFFIXES.some((s) => rawHost === s || rawHost.endsWith("." + s));
  if (trusted) return { ok: true };

  const ipKind = isIP(host);
  if (ipKind !== 0) {
    return isPrivateIp(host) ? { ok: false, reason: "private-ip" } : { ok: true };
  }

  // resolve every A/AAAA record; if ANY address is private/reserved → reject
  // (this also covers DNS-rebinding style attacks at request time)
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (!records || records.length === 0) return { ok: false, reason: "dns-empty" };
    for (const r of records) {
      if (isPrivateIp(r.address)) return { ok: false, reason: "private-ip" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "dns-failed" };
  }
}

/** Manually follow redirects, re-validating each hop. */
async function fetchImage(url) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await validateImageUrl(current);
    if (!check.ok) throw new Error(check.reason);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/*" },
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("redirect-without-location");
      current = new URL(loc, current).toString();
      continue; // hop++ validates the next URL at the top of the loop
    }
    if (!res.ok) throw new Error(`upstream-${res.status}`);

    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/")) throw new Error("not-an-image");

    const contentLength = Number(res.headers.get("content-length") || "0");
    if (contentLength > MAX_BYTES) throw new Error("too-large");

    // stream with a hard size cap
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("too-large");
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    return { buffer: buf, contentType: type || "image/png" };
  }
  throw new Error("too-many-redirects");
}

/**
 * Handle one /api/ai/image-proxy request.
 * Returns { status, contentType?, buffer?, error? }.
 */
export async function handleImageProxyRequest(rawUrl) {
  if (!rawUrl) return { status: 400, error: "No URL provided" };
  try {
    const { buffer, contentType } = await fetchImage(rawUrl);
    return { status: 200, contentType, buffer };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "image-proxy-failed";
    return { status: reason.startsWith("upstream-") ? Number(reason.slice(9)) : 502, error: reason };
  }
}

export { isPrivateIp, validateImageUrl };
