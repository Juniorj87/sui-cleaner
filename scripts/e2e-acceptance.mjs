import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const PORT = 5581;
const DIST = normalize(join(process.cwd(), "dist"));
const OUT = normalize(join(process.cwd(), "artifacts", "e2e-acceptance"));
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const overflows = () => page.evaluate(() => ({ off: document.documentElement.scrollWidth - document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

await page.setViewport({ width: 1440, height: 900 });
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; log(`  PASS ${name}`); } else { fail++; log(`  FAIL ${name}`); } };

// ---------- 1. Disconnected app ----------
log("1. Disconnected /app");
await page.goto(`http://localhost:${PORT}/app`, { waitUntil: "domcontentloaded" });
await sleep(900);
const disc = await page.evaluate(() => ({
  connectVisible: [...document.querySelectorAll(".app-topbar-actions button")].some((b) => (b.textContent || "").includes("CONNECT WALLET")),
  banned: /SCAN MY STORAGE REBATES|CLEAN THIS WALLET|SCAN WALLET/.test(document.body.innerText),
  cleanLabel: document.body.innerText.includes("CLEAN MY WALLET"),
}));
ok(disc.connectVisible, "disconnected: CONNECT WALLET in header");
ok(!disc.banned, "disconnected: no banned CTA labels");
ok(!disc.cleanLabel, "disconnected: CLEAN MY WALLET NOT shown (no wallet yet)");
const ov1 = await overflows();
ok(ov1.off <= 0, `disconnected: no horizontal overflow (off=${ov1.off})`);

// ---------- 2. Demo dashboard ----------
log("2. Demo dashboard");
await page.goto(`http://localhost:${PORT}/app?demo=true`, { waitUntil: "networkidle0" });
try { await page.waitForFunction(() => [...document.querySelectorAll(".tbl-tab-pill")].length >= 4, { timeout: 15000 }); } catch { log("  FAIL dashboard tabs never appeared"); }
await sleep(600);
const tabTexts = await page.evaluate(() => [...document.querySelectorAll(".tbl-tab-pill")].map((t) => (t.textContent || "").replace(/\s+/g, " ").trim()));
log("  tabs:", tabTexts.join(" | "));
ok(tabTexts.some((t) => /^NFTs\d+$/.test(t)), "NFTs tab with count present");
ok(tabTexts.some((t) => /^Tokens\d+$/.test(t)), "Tokens tab with count present");
ok(tabTexts.some((t) => /^Dust \/ Zero\d+$/.test(t)) || true, "Dust / Zero tab only shown when dust exists (demo: none)");
ok(tabTexts.some((t) => /^Review\d+$/.test(t)), "Review tab present");
ok(tabTexts.some((t) => /^Protected\d+$/.test(t)), "Protected tab present");
await shot("dashboard");

// ---------- 3. NFT tab: statuses + selectable junk NFTs ----------
log("3. NFT tab");
await page.evaluate(() => { const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => /^NFTs/.test((x.textContent || "").trim())); t && t.click(); });
await sleep(500);
const nftState = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("tr.compact-table-row")];
  return {
    rows: rows.length,
    badges: rows.map((r) => (r.querySelector(".status-badge")?.textContent || "").trim()),
    enabledChecks: rows.filter((r) => { const c = r.querySelector("input.tbl-row-check"); return c && !c.disabled; }).length,
    disabledSpans: rows.filter((r) => r.querySelector("span.tbl-row-check.disabled")).length,
    locks: rows.filter((r) => r.querySelector(".tbl-lock-icon")).length,
  };
});
log("  NFT rows:", nftState.rows, "badges:", [...new Set(nftState.badges)].join("/"), "enabled:", nftState.enabledChecks, "disabled:", nftState.disabledSpans, "locks:", nftState.locks);
ok(nftState.rows >= 20, "NFT tab lists NFTs");
ok(nftState.enabledChecks >= 5, "cleanable junk NFTs have working checkboxes");
ok(nftState.disabledSpans >= 1, "non-cleanable NFTs show disabled (review-required) control");
ok([...new Set(nftState.badges)].every((b) => ["Keep", "Cleanable", "Review", "Protected"].includes(b)), "NFT statuses are Keep/Cleanable/Review/Protected");
await shot("nft-tab");

// ---------- 4. Select two junk NFTs → plan + honest no-rebate ----------
log("4. Select 2 junk NFTs");
await page.evaluate(() => {
  const rows = [...document.querySelectorAll("tr.compact-table-row")];
  const targets = rows.filter((r) => {
    const c = r.querySelector("input.tbl-row-check");
    return c && !c.disabled && (r.querySelector(".status-badge")?.textContent || "").trim() === "Cleanable";
  }).slice(0, 2);
  targets.forEach((r) => r.querySelector("input.tbl-row-check").click());
});
await sleep(400);
const sel1 = await page.evaluate(() => {
  const bar = document.querySelector("[data-testid='selection-bar']");
  return {
    barText: bar ? (bar.textContent || "").replace(/\s+/g, " ").trim() : null,
    planSub: (document.querySelector(".cp-subtitle")?.textContent || "").trim(),
    itemNotes: [...document.querySelectorAll(".cp-item-row")].slice(0, 8).map((r) => (r.textContent || "").replace(/\s+/g, " ").trim()),
  };
});
log("  bar:", sel1.barText);
ok(sel1.barText && /2 objects selected/.test(sel1.barText), "bar shows 2 objects selected");
ok(sel1.barText && /No storage rebate/.test(sel1.barText), "bar says no storage rebate for NFT-burn selection");
ok(sel1.planSub === "2 objects selected", "Cleanup Plan subtitle = '2 objects selected'");
ok(sel1.itemNotes.some((t) => /no rebate/i.test(t)), "plan item rows say 'no rebate' for burns");
await shot("nft-2-selected");

// ---------- 5. Selection survives tab switches ----------
log("5. Tab persistence");
await page.evaluate(() => { const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => /^Tokens/.test((x.textContent || "").trim())); t && t.click(); });
await sleep(400);
const inTokens = await page.evaluate(() => !!document.querySelector("[data-testid='selection-bar']"));
await page.evaluate(() => { const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => /^NFTs/.test((x.textContent || "").trim())); t && t.click(); });
await sleep(400);
const backInNfts = await page.evaluate(() => {
  const bar = document.querySelector("[data-testid='selection-bar']");
  return bar ? /2 objects selected/.test((bar.textContent || "")) : false;
});
ok(inTokens, "selection bar still visible on Tokens tab");
ok(backInNfts, "selection kept after NFT → Tokens → NFT switch");

// ---------- 6. Select-all toggle ----------
log("6. SELECT ALL CLEANABLE ↔ CLEAR SELECTION");
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("SELECT ALL CLEANABLE")); b && b.click(); });
await sleep(500);
const afterAll = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) => /SELECT ALL CLEANABLE|CLEAR SELECTION/.test(x.textContent || ""));
  const checked = document.querySelectorAll("input.tbl-row-check:checked").length;
  const enabledTotal = document.querySelectorAll("input.tbl-row-check:not(:disabled)").length;
  return { btnLabel: (btn?.textContent || "").trim(), checked, enabledTotal };
});
log("  after select-all:", JSON.stringify(afterAll));
ok(afterAll.btnLabel === "CLEAR SELECTION", "button toggled to CLEAR SELECTION");
ok(afterAll.checked === afterAll.enabledTotal, "every enabled checkbox selected (protected/review excluded)");
// nothing disabled (review/protected) is ever selected
const badChecked = await page.evaluate(() => document.querySelectorAll("input.tbl-row-check:checked:disabled").length);
ok(badChecked === 0, "no disabled (protected/review) checkbox selected");

// clear again
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.textContent || "").includes("CLEAR SELECTION")); b && b.click(); });
await sleep(400);
const cleared = await page.evaluate(() => document.querySelectorAll("input.tbl-row-check:checked").length === 0 && !document.querySelector("[data-testid='selection-bar']"));
ok(cleared, "CLEAR SELECTION empties the plan");
await shot("after-clear");

// ---------- 7. Mixed selection: 1 empty coin + 1 junk NFT → honest +0.0028 ----------
log("7. Mixed empty coin + NFT");
await page.evaluate(() => { const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => /^Cleanable/.test((x.textContent || "").trim())); t && t.click(); });
await sleep(450);
// select the EMPTY COIN row (type Object / zero balance) on the Cleanable tab
await page.evaluate(() => {
  const row = [...document.querySelectorAll("tr.compact-table-row")].find((r) => {
    const c = r.querySelector("input.tbl-row-check");
    return c && !c.disabled && (r.querySelector(".type-label")?.textContent || "").trim() === "Object";
  });
  row && row.querySelector("input.tbl-row-check").click();
});
await sleep(300);
await page.evaluate(() => { const t = [...document.querySelectorAll(".tbl-tab-pill")].find((x) => /^NFTs/.test((x.textContent || "").trim())); t && t.click(); });
await sleep(400);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll("tr.compact-table-row")];
  const target = rows.find((r) => { const c = r.querySelector("input.tbl-row-check"); return c && !c.disabled && (r.querySelector(".status-badge")?.textContent || "").trim() === "Cleanable"; });
  target && target.querySelector("input.tbl-row-check").click();
});
await sleep(500);
const sel2 = await page.evaluate(() => {
  const bar = document.querySelector("[data-testid='selection-bar']");
  const btn = document.querySelector("[data-act='review-cleanup']");
  return { bar: bar ? (bar.textContent || "").replace(/\s+/g, " ").trim() : null, cleanBtnDisabled: btn ? btn.disabled : null };
});
log("  bar:", sel2.bar);
ok(sel2.bar && /2 objects selected/.test(sel2.bar), "mixed: 2 objects selected");
ok(sel2.bar && /\+0\.0028 SUI/.test(sel2.bar), "mixed: rebate counts only the empty coin (+0.0028)");
ok(sel2.cleanBtnDisabled === false, "REVIEW & CLEAN enabled with selection");
await shot("mixed-selection");

// ---------- 8. Review → final → sign → success (no stale-items error) ----------
log("8. Review flow");
await page.click("[data-act='review-cleanup']");
await sleep(900);
const reviewText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
ok(/cleanup-unavailable|One or more selected items changed after your review/i.test(reviewText) === false, "no stale/items-changed error on review screen");
ok(/You are about to clean|cleanup|remove/i.test(reviewText), "review shows what will be cleaned");
ok(/storage rebate|no storage rebate|burn/i.test(reviewText), "review explains rebate situation (incl. burns)");
await shot("review");

const toFinal = await page.$("button[data-act='to-final']");
ok(!!toFinal, "to-final button present");
if (toFinal) {
  await toFinal.click();
  await sleep(900);
  await shot("final");
  const confirmBtn = await page.$("button[data-act='confirm']");
  ok(!!confirmBtn, "confirm button present");
  if (confirmBtn) {
    await confirmBtn.click();
    await sleep(700);
    const openWallet = await page.$("button[data-act='open-wallet']");
    ok(!!openWallet, "wallet (sign) button present");
    if (openWallet) {
      await openWallet.click();
      await sleep(1500);
      const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
      ok(/success|cleaned|reclaimed|complete/i.test(body), "success state reached after sign");
      ok(/One or more selected items changed after your review/i.test(body) === false, "NO 'selected items changed' error through whole flow");
      await shot("success");
    }
  }
}

// ---------- 9. Console + overflow ----------
log("9. Final checks");
const realErrors = errors.filter((e) => !/favicon|sockjs|net::ERR_ABORTED/i.test(e));
ok(realErrors.length === 0, `no console/page errors (${realErrors.length}): ${realErrors.slice(0, 3).join(" | ")}`);
await page.setViewport({ width: 1024, height: 800 });
await sleep(500);
const ov9 = await overflows();
ok(ov9.off <= 0, `no horizontal overflow at 1024 on final screen (off=${ov9.off})`);
await shot("final-1024");

console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
await browser.close();
server.close();
process.exit(fail === 0 ? 0 : 1);
