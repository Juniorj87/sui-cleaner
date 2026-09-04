import puppeteer from 'puppeteer-core';
import { join } from 'node:path';

const BASE = 'http://localhost:4173';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // 1. Initial /app?demo=true
    console.log('Loading /app?demo=true...');
    await page.goto(`${BASE}/app?demo=true`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="vault-banner"]', { timeout: 10000 });
    await page.screenshot({ path: join(process.cwd(), 'app-vault.png') });
    console.log('Saved app-vault.png');

    // 2. Select 1-Click Quick Clean
    console.log('Clicking 1-Click Quick Clean...');
    await page.click('.vault-quick');
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: join(process.cwd(), 'app-after-select.png') });
    console.log('Saved app-after-select.png');

    // 3. Table View
    console.log('Switching to Table View...');
    await page.click('.dock-view-btn[title="Compact Table View"]');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: join(process.cwd(), 'app-table.png') });
    console.log('Saved app-table.png');

    // 4. Inline Dossier
    console.log('Opening Inline Dossier...');
    await page.click('.inv-table-row');
    await page.waitForSelector('[data-testid="inline-dossier"]', { timeout: 5000 });
    await page.screenshot({ path: join(process.cwd(), 'app-dossier.png') });
    console.log('Saved app-dossier.png');

    // 5. Back to Grid View
    await page.click('.ws-dossier-back');
    await new Promise((r) => setTimeout(r, 400));
    await page.click('.dock-view-btn[title="Grid Cards View"]');
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: join(process.cwd(), 'app-final.png') });
    console.log('Saved app-final.png');

    // 6. Mobile View (390px)
    console.log('Capturing Mobile View...');
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.screenshot({ path: join(process.cwd(), 'app-mobile.png') });
    console.log('Saved app-mobile.png');

    console.log('All screenshots captured successfully!');
  } finally {
    await browser.close();
  }
}

capture().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
