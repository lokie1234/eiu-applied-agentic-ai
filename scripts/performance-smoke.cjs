const { chromium } = require(process.env.PERF_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const { performance } = require('perf_hooks');
const base = process.env.PERF_BASE_URL || 'http://localhost:3100';
const output = process.env.PERF_OUTPUT_DIR || 'tmp/performance-smoke';
if (!process.env.PERF_PASSCODE) throw new Error('Set PERF_PASSCODE before running. Synthetic logins create audit records.');
fs.mkdirSync(output, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const summarize = values => {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  return sorted.length ? { count: sorted.length, medianMs: Math.round(sorted[Math.floor(sorted.length * .5)]), p95Ms: Math.round(sorted[Math.min(sorted.length-1, Math.floor(sorted.length*.95))]), maxMs: Math.round(sorted.at(-1)) } : null;
};
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PERF_BROWSER_PATH ? { executablePath: process.env.PERF_BROWSER_PATH } : {}) });
  const sessions = await Promise.all(Array.from({length:10}, async (_, index) => {
    const context = await browser.newContext({ viewport: {width:1366,height:768}, baseURL: base });
    const page = await context.newPage();
    page.setDefaultTimeout(45_000);
    const result = { user:index+1, timings:{}, clicks:[], api:[], failures:[], errors:[], checks:{} };
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('requestfailed', request => result.failures.push({url:new URL(request.url()).pathname,method:request.method(),phase:result.phase,error:request.failure()?.errorText}));
    page.on('response', response => { if(response.status()>=400) result.errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`); });
    page.on('requestfinished', request => {
      if (!request.url().startsWith(base+'/api/')) return;
      const timing=request.timing(); result.api.push({path:new URL(request.url()).pathname, method:request.method(), durationMs:Math.round(timing.responseEnd), status:request.response().then(r=>r?.status())});
    });
    await page.addInitScript(() => {
      window.__perfLongTasks=[];
      try { new PerformanceObserver(list=>list.getEntries().forEach(entry=>window.__perfLongTasks.push(entry.duration))).observe({type:'longtask',buffered:true}); } catch {}
    });
    return {context,page,result};
  }));
  const started=performance.now();
  await Promise.all(sessions.map(async ({context,page,result}) => {
    try {
      result.phase='login';
      let start=performance.now();
      let login=await context.request.post('/api/auth/access',{data:{passcode:process.env.PERF_PASSCODE}});
      let payload=await login.json();
      if(payload.requiresInformation) {
        const information={};
        for(const field of payload.fields) information[field.id]=field.type==='email'?`loadtest-${result.user}@example.test`:field.type==='number'?String(field.min??Math.min(field.max??1,1)):`Performance Test ${result.user}`;
        login=await context.request.post('/api/auth/access',{data:{passcode:process.env.PERF_PASSCODE,information}});
        payload=await login.json();
      }
      result.timings.login=performance.now()-start;
      if(!login.ok()||!payload.success) throw Error(`Login failed: HTTP ${login.status()} ${payload.message||''}`);
      const cookie=(await context.cookies()).find(c=>c.name==='eiu_access_session');
      const session=JSON.parse(Buffer.from(cookie.value.split('.')[0],'base64url').toString());
      result.sessionFingerprint=require('crypto').createHash('sha256').update(session.sessionId).digest('hex'); result.role=session.role;
      start=performance.now();
      result.phase='catalog';
      await page.goto('/learn',{waitUntil:'domcontentloaded'});
      const course=page.getByRole('button').filter({hasText:/Agentic AI/i}).first();
      await course.waitFor({state:'visible'});
      result.timings.catalog=performance.now()-start;
      start=performance.now(); await course.click();
      const section=page.getByRole('button').filter({hasText:/SECTION\s+1/i}).first();
      await section.waitFor({state:'visible'});
      result.timings.course=performance.now()-start;
      start=performance.now(); await section.click();
      result.phase='slides';
      const input=page.getByRole('spinbutton',{name:'Go to slide'});
      await input.waitFor({state:'visible'});
      await page.locator('.slide-stage .section-one-slide-transition').waitFor({state:'visible'});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      result.timings.section=performance.now()-start;
      result.checks.initialSlide=await input.inputValue();
      const max=Number(await input.getAttribute('max')); result.checks.totalSlides=max;
      for(let step=0;step<10;step++) {
        const current=Number(await input.inputValue()); start=performance.now();
        await page.locator('button[title="Next slide"]').click();
        await page.waitForFunction(target=>document.querySelector('[aria-label="Go to slide"]').value===String(target),current+1);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        result.clicks.push({action:'next',slide:current+1,ms:performance.now()-start});
        await pause(250);
      }
      for(let step=0;step<3;step++) {
        const current=Number(await input.inputValue()); start=performance.now();
        await page.locator('button[title="Previous slide"]').click();
        await page.waitForFunction(target=>document.querySelector('[aria-label="Go to slide"]').value===String(target),current-1);
        result.clicks.push({action:'previous',slide:current-1,ms:performance.now()-start});
      }
      for(const target of [14,25,35,Math.min(38,max)]) {
        start=performance.now(); await input.fill(String(target)); await input.press('Enter');
        await page.waitForFunction(target=>new URL(location.href).searchParams.get('slide')===String(target),target);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        result.clicks.push({action:'jump',slide:target,ms:performance.now()-start});
        await pause(500);
      }
      const before=await input.inputValue(); start=performance.now();
      result.phase='refresh';
      await page.reload({waitUntil:'domcontentloaded'});
      await input.waitFor({state:'visible'});
      await page.waitForFunction(target=>document.querySelector('[aria-label="Go to slide"]').value===target,before);
      result.timings.refresh=performance.now()-start;
      result.checks.restoredSlide=await input.inputValue();
      result.checks.refreshPreserved=result.checks.restoredSlide===before;
      result.phase='idle';
      if(process.env.PERF_INCLUDE_QUIZ === '1') {
        result.phase='quiz';
        await input.fill(String(max)); await input.press('Enter');
        await page.waitForFunction(target=>document.querySelector('[aria-label="Go to slide"]').value===String(target),max);
      }
      await pause(35_000);
      result.longTasks=await page.evaluate(()=>window.__perfLongTasks);
      if(result.user===1) await page.screenshot({path:output+'/section1-user1.png'});
      result.success=true;
    } catch(error) {
      result.success=false;result.error=error.message;
      await page.screenshot({path:output+`/failed-user${result.user}.png`}).catch(()=>{});
    }
  }));
  const results=sessions.map(s=>s.result);
  for(const result of results) for(const request of result.api) request.status=await request.status;
  const summary={base,mode:'production local; 10 isolated contexts; API login + real UI clicks',elapsedMs:Math.round(performance.now()-started),users:10,successful:results.filter(r=>r.success).length,uniqueSessions:new Set(results.map(r=>r.sessionFingerprint).filter(Boolean)).size,
    timings:Object.fromEntries(['login','catalog','course','section','refresh'].map(key=>[key,summarize(results.map(r=>r.timings[key]))])),
    slideClicks:summarize(results.flatMap(r=>r.clicks.map(c=>c.ms))),api:summarize(results.flatMap(r=>r.api.map(a=>a.durationMs))),
    pageErrors:results.flatMap(r=>r.errors),requestFailures:results.flatMap(r=>r.failures),refreshPreserved:results.filter(r=>r.checks.refreshPreserved).length,
    quiz: process.env.PERF_INCLUDE_QUIZ === '1' ? { requests:results.flatMap(r=>r.api.filter(a=>a.path==='/api/quiz-control' || a.path==='/api/quiz-results')), users:sessions.length } : null};
  fs.writeFileSync(output+'/results.json',JSON.stringify({summary,results},null,2));
  console.log(JSON.stringify(summary,null,2));
  if(summary.successful !== 10 || summary.refreshPreserved !== 10 || summary.pageErrors.length) process.exitCode=1;
  await Promise.all(sessions.map(async ({context,page})=>{await page.goto('about:blank').catch(()=>{});await context.request.post('/api/signout').catch(()=>{});await context.close();}));
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
