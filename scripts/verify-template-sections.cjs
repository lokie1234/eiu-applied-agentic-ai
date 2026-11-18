// Run against the unchanged Windows 1.2.1 runtime, with network access disabled.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { browserOptions, createOfflinePlayer } = require('./lib/offline-player-qa.cjs');

async function main() {
  const out = path.resolve(process.env.TEMPLATE_QA_OUTPUT || '.tmp/template-sections-qa');
  fs.mkdirSync(out, { recursive: true });
  const sections = JSON.parse(fs.readFileSync('course-content/sources.json', 'utf8')).map(row => ({ id: row.sectionId, path: row.path }));
  for (const n of [1, 2]) sections.push({ id: `applied-agentic-ai-section${n}`, path: `lib/drive/builtin-decks/section${n}.js` });
  // An authorized catalog read can supply uploaded lessons for the same checks.
  if (process.env.OFFLINE_EXTRA_SECTIONS) sections.push(...JSON.parse(fs.readFileSync(process.env.OFFLINE_EXTRA_SECTIONS, 'utf8').replace(/^\uFEFF/,'')));
  const browser = await chromium.launch(browserOptions()), report = [];
  try {
    for (const [width, height] of [[1280,720], [960,540], [1428,804], [1920,1080]]) for (const section of sections) {
      const context = await browser.newContext({ viewport: { width, height }, offline: true, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage(), errors = [], requests = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
        const {frame,total,show} = await createOfflinePlayer(page, fs.readFileSync(section.path, 'utf8'));
        if(width===1920){await page.evaluate(()=>{const b=document.createElement('button');b.textContent='Enter fullscreen QA';b.style.cssText='position:fixed;top:8px;right:8px;z-index:999';b.onclick=()=>{void document.documentElement.requestFullscreen();b.remove();};document.body.appendChild(b);});await page.getByRole('button',{name:'Enter fullscreen QA'}).click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));}
        let nativePages = 0;
        for (let n=1;n<=total;n++) {
          await show(n);
          await frame.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
          const layout = await frame.evaluate(() => {
            const root = document.querySelector('#root'), wrapper = root.querySelector(':scope > .eiu-content');
            const native = wrapper.querySelector(':scope > [data-mis311-frame]');
            const mainRegions=[...wrapper.querySelectorAll('[data-offline-canvas],[data-mis311-content],.mis > .frame,.eiu > .content')].filter(n=>n.getBoundingClientRect().width>0).map(n=>{const b=n.getBoundingClientRect();const overflow=getComputedStyle(n).overflowY,extra=n.scrollHeight-n.clientHeight;return{tag:n.tagName,className:n.className,left:b.left,top:b.top,right:b.right,bottom:b.bottom,scroll:extra,requiresScroll:extra>1&&['auto','scroll'].includes(overflow),clipped:extra>1&&['hidden','clip'].includes(overflow)};});
            const preserved = wrapper.querySelector('[data-preserve-original="true"],[data-eiu-template="eiu-business-v1"]');
            const r = wrapper.getBoundingClientRect();
            const element = [...wrapper.children].find(node=>node.tagName!=='STYLE'), box=element?.getBoundingClientRect();
            const inset = native?.querySelector(':scope > [data-mis311-content]')?.getBoundingClientRect();
            return { width: innerWidth, height: innerHeight, outer: {left:r.left,top:r.top,width:r.width,height:r.height},
              mainRegions, element: box ? {left:box.left,top:box.top,right:box.right,bottom:box.bottom} : null,
              template: root.classList.contains('eiu-template'), native: Boolean(native), preserved: Boolean(preserved),
              inset: inset ? {left:inset.left,top:inset.top} : null,
              duplicateNumber: Boolean(native && getComputedStyle(root.querySelector(':scope > .eiu-number')).display !== 'none'),
              scroll: document.documentElement.scrollWidth > innerWidth+1 || document.documentElement.scrollHeight > innerHeight+1,
              activityScroll: native?.querySelector('[data-mis311-vsm-followup="activity"]') ? native.querySelector('[data-mis311-content]').scrollHeight-native.querySelector('[data-mis311-content]').clientHeight : 0,
              onlineOnly: Boolean(wrapper.querySelector('[data-eiu-quiz],[data-eiu-showcase],[data-draw-restricted]')) };
          });
          assert.equal(layout.scroll,false,`${section.id} page ${n}: outer frame scroll`);
          assert.equal(layout.duplicateNumber,false,`${section.id} page ${n}: duplicate page numbers`);
          assert(layout.element,`${section.id} page ${n}: missing slide root`);
          assert(layout.element.left>=-1&&layout.element.top>=-1&&layout.element.right<=width+1&&layout.element.bottom<=height+1,`${section.id} page ${n}: slide root clipped by the player canvas`);
          if(layout.mainRegions.some(r=>r.requiresScroll||r.clipped)){await page.screenshot({path:path.join(out,'overflow.png')});console.log(JSON.stringify({section:section.id,page:n,layout},null,2));}
          for(const region of layout.mainRegions){assert(region.left>=-1&&region.top>=-1&&region.right<=width+1&&region.bottom<=height+1,`${section.id} page ${n}: main content leaves the canvas`);assert(!region.requiresScroll&&!region.clipped,`${section.id} page ${n}: main content scrolls or clips`);}
          const full = !layout.template || layout.native;
          assert(Math.abs(layout.outer.width-width*(full?1:.888))<2,`${section.id} page ${n}: duplicate/incorrect width inset`);
          assert(Math.abs(layout.outer.height-height*(full?1:.774))<2,`${section.id} page ${n}: duplicate/incorrect height inset`);
          if(layout.native){assert(Math.abs(layout.inset.left-width*.056)<2);assert(Math.abs(layout.inset.top-height*.115)<2);assert(layout.activityScroll<=1);}
          if(layout.onlineOnly)nativePages++;
          if(n===1&&width===1280)await page.screenshot({path:path.join(out,`${section.id}.png`)});
        }
        assert.deepEqual(errors,[],`${section.id}: runtime errors`);
        assert.deepEqual(requests,[],`${section.id}: undeclared online asset request`);
        report.push({id:section.id,width,height,fullscreen:width===1920,slides:total,onlineOnlyMarkers:nativePages,errors,requests});
        console.log(`${section.id} ${width}x${height}: ${total} slides fit one frame; no outer scrolling or network requests`);
      } finally { await context.close(); }
    }
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`Verified ${report.reduce((n,r)=>n+r.slides,0)} page renders across ${sections.length} sections.`);
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
