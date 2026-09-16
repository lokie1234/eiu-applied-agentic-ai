const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.locator('input').fill('1103');
  await page.getByRole('button', { name: /Enter Session/i }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.getByText('Từ Prompt đến Web App', { exact: true }).click();
  await page.waitForTimeout(1200);
  const targets = new Set([32]);
  const frame = page.locator('.slide-frame');
  for (let slide = 1; slide <= 32; slide += 1) {
    if (targets.has(slide)) {
      await page.waitForTimeout(550);
      await frame.screenshot({ path: `tmp/patch-qa/slide-${String(slide).padStart(2, '0')}.png` });
    }
    if (slide < 32) {
      await page.locator('.header-nav-button-next').click();
      await page.waitForTimeout(80);
    }
  }
  console.log(await page.locator('[class*="flowStep"]').evaluateAll((els) => els.map((el) => {
    const box = el.querySelector(':scope > div');
    return { step: el.textContent, stepRect: el.getBoundingClientRect().toJSON(), boxRect: box?.getBoundingClientRect().toJSON(), cssWidth: box ? getComputedStyle(box).width : null, flex: getComputedStyle(el).flex };
  })));
  console.log('Captured', [...targets].join(', '));
  await browser.close();
})();
