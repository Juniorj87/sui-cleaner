import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const PORT = 5575;
const DIST = normalize(join(process.cwd(), "dist"));
const OUT = normalize(join(process.cwd(), "artifacts", "e2e-selection"));
mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let fp = normalize(join(DIST, url.pathname));
  try { const st = await stat(fp); if (st.isDirectory()) fp = join(fp, "index.html"); } catch { fp = join(DIST, "index.html"); }
  try { res.statusCode = 200; res.setHeader("content-type", MIME[extname(fp)] ?? "application/octet-stream"); res.end(await readFile(fp)); } catch { res.statusCode = 404; res.end("nf"); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
const log = (...a) => console.log(...a);
const shot = async (name) => { await page.screenshot({ path: join(OUT, `${name}.png`) }); };

await page.setViewport({ width: 1440, height: 900 });

// 1. Home CTA label
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 700));
const homeHasClean = await page.evaluate(() => document.body.innerText.includes("CLEAN MY WALLET"));
const homeHasBanned = await page.evaluate(() => /SCAN MY STORAGE REBATES|CLEAN THIS WALLET|SCAN WALLET/.test(document.body.innerText));
log("1. Home:", homeHasClean ? "CLEAN MY WALLET present" : "MISSING", homeHasBanned ? "| banned label still present!" : "| no banned labels");

// 2. Disconnected app header
await page.goto(`http://localhost:${PORT}/app`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 700));
const hdr = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".app-topbar-actions button, .app-topbar-actions span")].map((b) => (b.textContent || "").trim()).filter(Boolean);
  return { btns, ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth };
});
log("2. Disconnected header:", JSON.stringify(hdr));

// 3. Demo -> dashboard: tabs + counts
await page.goto(`http://localhost:${PORT}/app?demo=true`, { waitUntil: "networkidle0" });
try { await page.waitForFunction(() => document.body.innerText.includes("WHAT CAN BE CLEANED"), { timeout: 15000 }); } catch { log("3. Dashboard text missing!"); }
await new Promise((r) => setTimeout(r, 700));
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll(".tbl-tab-pill")].map((t) => ({ label: (t.textContent || "").replace(/\d+/g, (d) => d).trim().replace(/\s+(\d+)$/, " [$1]") }))
);
const tabLabels = await page.evaluate(() => [...document.querySelectorAll(".tbl-tab-pill")].map((t) => (t.textContent || "").replace(/\s+/g, " ").trim()));
log("3. Tabs:", tabLabels.join(" | "));
const nftTab = await page.evaluate(() => {
  const tabs2 = [...document.querySelectorAll(".tbl-tab-pill")];
  const nft = tabs2.find((t) => /^NFT/i.test((t.textContent || "").trim()));
  if (!nft) return { found: false };
  nft.click();
  return { found: true };
});
await new Promise((r) => setTimeout(r, 500));
const nftRows = await page.evaluate(() => document.querySelectorAll(".compact-table-row").length);
const nftBadges = await page.evaluate(() => [...document.querySelectorAll(".status-badge")].slice(0, 12).map((b) => b.textContent));
log("4. NFT tab rows:", nftRows, "badges:", nftBadges.join(", "));
await shot("nft-tab");

// back to All
await page.evaluate(() => { const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => x.textContent.startsWith("All")); t?.click(); });
await new Promise((r) => setTimeout(r, 400));

// 5. single checkbox select (on the Cleanable tab so the row is visible)
await page.evaluate(() => { const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => /^Cleanable/.test(x.textContent.trim())); t?.click(); });
await new Promise((r) => setTimeout(r, 500));
const one = await page.evaluate(() => {
  const cb = document.querySelector(".tbl-row-check:not(:checked)");
  if (!cb) return { ok: false };
  cb.click();
  return { ok: true };
});
await new Promise((r) => setTimeout(r, 600));
const chipAfterOne = await page.evaluate(() => document.querySelector('[data-testid="selected-count"]')?.textContent || "");
const barAfterOne = await page.evaluate(() => document.querySelector('[data-testid="selection-bar"]')?.textContent?.replace(/\s+/g, " ").trim() || "");
log("5. after 1 checkbox — found:", one.ok, "chip:", chipAfterOne, "| bar:", barAfterOne);
await shot("one-selected");

// 6. SELECT ALL CLEANABLE
const cleanableTabCount = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => /^Cleanable/.test(x.textContent.trim()));
  return t ? parseInt((t.textContent.match(/(\d+)$/) || [])[1] || "0", 10) : -1;
});
await page.evaluate(() => { document.querySelector(".tbl-bulk-btn")?.click(); });
await new Promise((r) => setTimeout(r, 600));
const afterAll = await page.evaluate(() => ({
  chip: document.querySelector('[data-testid="selected-count"]')?.textContent || "",
  checked: document.querySelectorAll(".tbl-row-check:checked").length,
}));
log("6. SELECT ALL CLEANABLE — expected:", cleanableTabCount, "got:", JSON.stringify(afterAll));
await shot("select-all");

// 7. REVIEW & CLEAN from selection bar -> cleanup screen
const btnExists = await page.evaluate(() => !!document.querySelector('[data-act="review-cleanup"]'));
if (btnExists) {
  await page.evaluate(() => { document.querySelector('[data-act="review-cleanup"]').click(); });
  await new Promise((r) => setTimeout(r, 1500));
}
let cleanupText = "MISSING";
if (btnExists) {
  await new Promise((r) => setTimeout(r, 1500));
  cleanupText = await page.evaluate(() => {
    const hasCleanup = !!document.querySelector(".cleanup, [data-cleanup='ready']");
    const hasFinal = !!document.querySelector(".final-review-vault");
    const hasDesk = !!document.querySelector('[data-testid="cleaner-desk"]');
    const sel = document.querySelector('[data-testid="selected-count"]');
    const notice = document.querySelector(".fixed.bottom-0");
    return JSON.stringify({ hasCleanup, hasFinal, hasDesk, chip: sel ? sel.textContent : null, notice: notice ? notice.textContent.slice(0, 160) : null, body: document.body.innerText.slice(0, 200).replace(/\n+/g, " | ") });
  });
  log("7. after REVIEW & CLEAN click:", cleanupText);
}
await shot("cleanup-from-bar");

// back out -> dashboard
await page.evaluate(() => { document.querySelector('[data-act="back"]')?.click(); });
await new Promise((r) => setTimeout(r, 600));
// 8. clear selection
await page.evaluate(() => { document.querySelector(".sel-bar-clear")?.click(); });
await new Promise((r) => setTimeout(r, 400));
const cleared = await page.evaluate(() => document.querySelector('[data-testid="selected-count"]') === null);
log("8. clear selection:", cleared ? "OK (chip gone)" : "FAIL");

// 9. mobile dashboard: overflow check
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 600));
const mob = await page.evaluate(() => ({
  ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  sw: document.documentElement.scrollWidth,
  cw: document.documentElement.clientWidth,
  hdr: Math.round(document.querySelector(".app-topbar-slim").getBoundingClientRect().height),
}));
log("9. mobile 390 overflow:", JSON.stringify(mob));
await shot("mobile-dashboard");

log("--- console errors:", errors.length ? errors : "none");
await browser.close();
server.close();
process.exit(0);
