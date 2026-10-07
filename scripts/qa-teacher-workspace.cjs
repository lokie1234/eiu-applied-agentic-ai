// First run tests/teacher-workspace-ui.test.mjs to render the real shared components.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const results = [];
  try {
    for (const size of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: size });
      for (const fixture of ['owned', 'readonly', 'admin', 'admin-layouts', 'teacher-layouts']) {
        await page.goto('file:///' + path.resolve(`tmp/teacher-workspace/${fixture}.html`).replaceAll('\\', '/'));
        await page.screenshot({ path: `tmp/teacher-workspace/${fixture}-${size.width}.png`, fullPage: true });
        const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
        assert.ok(overflow.width <= overflow.viewport, `${fixture} ${size.width}: horizontal overflow ${overflow.width}`);
        if (fixture === 'readonly') {
          assert.equal(await page.locator('[aria-label="Selected course"] form').count(), 0);
          assert.equal(await page.locator('[aria-label="Selected course"] input[type=file]').count(), 0);
          assert.equal(await page.getByRole('link', { name: 'View', exact: true }).count(), 1);
        }
        if (fixture.endsWith('-layouts')) {
          const geometry = await page.evaluate(() => {
            const slide = document.querySelector('.preview').getBoundingClientRect();
            const stage = document.querySelector('.previewViewport').getBoundingClientRect();
            const footer = document.querySelector('.previewFooter').getBoundingClientRect();
            const content = document.querySelector('.templateContent');
            const sample = document.querySelector('.sample');
            return { ratio: slide.width / slide.height, slideBottom: slide.bottom, stageBottom: stage.bottom,
              footerBottom: footer.bottom, viewportHeight: innerHeight, sampleHeight: sample.scrollHeight, contentHeight: content.clientHeight };
          });
          assert.ok(Math.abs(geometry.ratio - 16 / 9) < .02, `${fixture}: slide ratio changed`);
          assert.ok(geometry.slideBottom <= geometry.stageBottom + 1, `${fixture}: slide footer clipped`);
          assert.ok(geometry.sampleHeight <= geometry.contentHeight, `${fixture}: preview text clipped`);
          if (size.width > 980) assert.ok(geometry.footerBottom <= geometry.viewportHeight, `${fixture}: preview below viewport`);
          if (fixture === 'teacher-layouts') {
            assert.equal(await page.locator('input[type=file]').count(), 0);
            assert.equal(await page.getByRole('button', { name: 'Delete layout', exact: true }).count(), 0);
          }
        }
        if (fixture === 'admin') {
          const names = await page.locator('.folderGroupNameText').evaluateAll(elements => elements.map(el => ({ text: el.textContent, whiteSpace: getComputedStyle(el).whiteSpace, overflow: getComputedStyle(el).overflow })));
          assert.ok(names.every(name => name.whiteSpace !== 'nowrap' && name.overflow !== 'hidden'), 'Folder names must remain readable');
          assert.ok(await page.locator('.visibilityToggle svg').count() > 0);
          assert.equal(await page.getByRole('button', { name: 'Hide', exact: true }).count(), 0);
        }
        results.push({ fixture, viewport: size.width, overflow: false });
      }
      await page.close();
    }
    fs.writeFileSync('tmp/teacher-workspace/report.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
