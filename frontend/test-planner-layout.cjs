const { chromium } = require('./node_modules/playwright');

async function run() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vdXNlciIsImV4cCI6MTc3NTk5NTYzMn0.Yws8rjbqi5Ak2h-hl_K8qZiHdzxEtGNHZgtUr6oDBz8";
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      localStorage.setItem('open-garden-token', t);
      localStorage.setItem('open-garden-help-seen', 'true');
    }, token);
    
    await page.goto('http://localhost:5173/planner', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Screenshot of Setup tab
    await page.screenshot({ path: '/tmp/planner-setup-tab.png', fullPage: false });
    
    // Click Manage Plantings tab
    const plantingsBtn = await page.locator('button:has-text("Manage Plantings")').first();
    await plantingsBtn.click();
    await new Promise(r => setTimeout(r, 500));
    
    // Screenshot of Plantings tab
    await page.screenshot({ path: '/tmp/planner-plantings-tab.png', fullPage: false });
    
    console.log('✓ Planner layout screenshots saved');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    if (browser) await browser.close();
  }
}

run();
