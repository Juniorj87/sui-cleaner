import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { existsSync } from "node:fs";

const PORT = 5544;
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
  await serveStatic(res, url.pathname);
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`Test server running at http://localhost:${PORT}`);

const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (!existsSync(executablePath)) {
  console.error("Chrome not found at", executablePath);
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(e.message));

console.log("1. Testing Disconnected State at /app...");
await page.goto(`http://localhost:${PORT}/app`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "artifacts/redesign-disconnected-desktop.png", fullPage: true });
console.log("Saved artifacts/redesign-disconnected-desktop.png");

// Mobile disconnected view
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "artifacts/redesign-disconnected-mobile.png", fullPage: true });
console.log("Saved artifacts/redesign-disconnected-mobile.png");

// Reset viewport to desktop
await page.setViewport({ width: 1440, height: 900 });
await new Promise((r) => setTimeout(r, 400));

// 2. Click "Try Demo" and capture the Analyzing Screen
console.log("2. Clicking 'Try Demo' and capturing Analyzing Screen...");
const demoBtn = await page.$(".vch-btn-sec");
if (demoBtn) {
  await demoBtn.click();
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: "artifacts/redesign-analyzing-screen.png", fullPage: true });
  console.log("Saved artifacts/redesign-analyzing-screen.png");
}

// 3. Wait for the report screen to load
console.log("3. Waiting for Analysis to complete and Dashboard to load...");
await page.waitForFunction(() => {
  return document.body.innerText.includes("WHAT CAN BE CLEANED");
}, { timeout: 15000 });

console.log("Dashboard loaded successfully!");

// Take desktop screenshot of the initial dashboard
await page.screenshot({ path: "artifacts/redesign-dashboard-desktop.png", fullPage: true });
console.log("Saved artifacts/redesign-dashboard-desktop.png");

// 1. Check What Can Be Cleaned button
console.log("Testing Empty Objects click...");
const reviewEmptyBtn = await page.$(".clean-category-card.cat-empty button");
if (reviewEmptyBtn) {
  await reviewEmptyBtn.click();
  await new Promise((r) => setTimeout(r, 600));
}

// 2. Check table search
console.log("Testing table search...");
const searchInput = await page.$(".tbl-search-input");
if (searchInput) {
  await searchInput.type("HYPE");
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: "artifacts/redesign-search.png" });
  await searchInput.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
}

// 3. Take screenshot after selection (with items in Cleanup Plan)
await page.screenshot({ path: "artifacts/redesign-with-selection.png", fullPage: true });
console.log("Saved artifacts/redesign-with-selection.png");

// 4. Test mobile view
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "artifacts/redesign-dashboard-mobile.png", fullPage: true });
console.log("Saved artifacts/redesign-dashboard-mobile.png");

// 5. Test desktop inspect dossier
await page.setViewport({ width: 1440, height: 900 });
await new Promise((r) => setTimeout(r, 400));
const inspectBtn = await page.$(".row-more-btn");
if (inspectBtn) {
  await inspectBtn.click();
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: "artifacts/redesign-inspect-dossier.png", fullPage: true });
  console.log("Saved artifacts/redesign-inspect-dossier.png");

  // Click back from dossier
  const backBtn = await page.$(".ws-dossier-back");
  if (backBtn) {
    await backBtn.click();
    await new Promise((r) => setTimeout(r, 600));
  }
}

// 6. Test Review & Clean flow
console.log("Testing Review & Clean flow...");
const ctaBtn = await page.$(".cp-cta-btn");
if (ctaBtn) {
  await ctaBtn.click();
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: "artifacts/redesign-cleanup-flow.png", fullPage: true });
  console.log("Saved artifacts/redesign-cleanup-flow.png");

  // Proceed to Final Review screen
  const proceedBtn = await page.$("button[data-act='to-final']");
  if (proceedBtn) {
    await proceedBtn.click();
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: "artifacts/redesign-final-confirm.png", fullPage: true });
    console.log("Saved artifacts/redesign-final-confirm.png");

    // Click Confirm & Sign
    const confirmBtn = await page.$("button[data-act='confirm']");
    if (confirmBtn) {
      await confirmBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({ path: "artifacts/redesign-sign-screen.png", fullPage: true });
      console.log("Saved artifacts/redesign-sign-screen.png");

      // Click Simulate Sign
      const signBtn = await page.$("button[data-act='open-wallet']");
      if (signBtn) {
        await signBtn.click();
        await new Promise((r) => setTimeout(r, 1000));
        await page.screenshot({ path: "artifacts/redesign-success-screen.png", fullPage: true });
        console.log("Saved artifacts/redesign-success-screen.png");
      }
    }
  }
}

await browser.close();
server.close();

console.log("E2E Verification Complete!");
if (errors.length > 0) {
  console.log("Console errors observed:", errors);
} else {
  console.log("No console errors detected!");
}
process.exit(0);

