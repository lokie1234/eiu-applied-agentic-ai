import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadTS} from './helpers/mis301-fixture.mjs';
const folder='course-content/advanced-business-analytics';
const input=JSON.parse(fs.readFileSync(`${folder}/storyboard.json`,'utf8'));
const bindings=JSON.parse(fs.readFileSync('course-content/sources.json','utf8'));
const manifest=JSON.parse(fs.readFileSync(`${folder}/manifest.json`,'utf8'));
const topics=slides=>slides.flatMap(s=>[s,...(s.items&&['hub','history','split-overview'].includes(s.kind)?topics(s.items.map(item=>item.content)):[])]);

test('Section 2 cover and all Learning objectives match Section 1 exactly',()=>{
 assert.deepEqual(input.sections[1].slides[0],input.sections[0].slides[0]);
 assert.deepEqual(input.sections[1].objectives,input.sections[0].objectives);
});

test('both Week 8 lessons bind to the verified course with native slide counts and an isolated shared showcase',()=>{
 const count=loadTS('lib/interactiveLessonMetadata.ts');
 for(const section of input.sections){
  const entry=manifest[section.id],code=fs.readFileSync(`${folder}/${section.file}`,'utf8');
  assert.ok(bindings.some(b=>b.courseId===input.courseId&&b.sectionId===section.id&&b.path===entry.path));
  assert.equal(entry.revision,createHash('sha256').update(code).digest('hex'));
  assert.equal(count.interactiveLessonCounts(code).learnerSlides,section.slides.length);
  assert.match(code,/mis311-player-template/);assert.doesNotMatch(code,/https:\/\/.*(?:api_key|token)=/);
 }
 assert.deepEqual(manifest[input.sections[1].id].nativeSlides.learner,{'4':'showcase'});
 assert.equal(manifest[input.sections[1].id].showcaseGuide,undefined);
 assert.equal(manifest[input.sections[1].id].showcasePractice,undefined,'the new activity must not replace the legacy section board');
 assert.equal(manifest[input.sections[1].id].showcasePractices['4'].activityId,'gas-webapp');
 assert.deepEqual(manifest[input.sections[0].id].nativeSlides.learner,{'5':'showcase','11':'showcase'});assert.equal(manifest[input.sections[0].id].showcasePractice.minutes,15);
});

test('slides 6–10 use five official AI-tool interfaces and slide 11 binds a separate 15-minute practice',()=>{
 const section=input.sections[0],tools=section.slides.slice(5,10),assets=JSON.parse(fs.readFileSync(`${folder}/assets/tool-interfaces.json`,'utf8'));
 assert.deepEqual(tools.map(s=>s.tool),['Canva','Gamma','Adobe Express','Suno','Lovable']);
 for(const tool of tools){assert.equal(tool.kind,'ai-tool');assert.equal(tool.browserBased,true);assert.ok(tool.quickProduct);assert.equal(tool.accessNote,undefined);assert.equal(new URL(tool.url).protocol,'https:');const asset=assets[tool.icon],bytes=fs.readFileSync(`${folder}/assets/${asset.path}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.ok(bytes.length<200000);assert.ok(fs.readFileSync(`${folder}/Week8Session1.js`,'utf8').includes(`data:${asset.mime};base64,${bytes.toString('base64')}`));assert.ok(tool.sourceUrl);}
 assert.equal(section.slides[10].practice.minutes,15);assert.equal(section.slides[10].practice.activityId,'ai-tools-product');assert.match(section.slides[10].practice.steps[0],/AI tool you know/);
 assert.equal(section.slides[4].practice.deliverable,'');
 assert.equal(section.slides[10].practice.deliverable,'');
 assert.ok(section.slides[4].practice.allowDelete&&section.slides[10].practice.allowDelete);
 const renderer=fs.readFileSync(`${folder}/renderer.js.txt`,'utf8');assert.doesNotMatch(renderer,/Official interface source|Try creating/);
 const registered=manifest[section.id].showcasePractices;assert.deepEqual(Object.keys(registered),['5','11']);assert.equal(registered['11'].activityId,'ai-tools-product');assert.equal(registered['5'].activityId,undefined);assert.equal(section.slides.length,11);assert.equal(section.slides.at(-1).kind,'showcase');
});

test('updated charts preserve units, populations, dates and primary source links',()=>{
 const charts=topics(input.sections[1].slides).filter(s=>s.kind==='evidence');
 assert.equal(charts.length,3);
 const [business,markets,usage]=charts.map(s=>s.views);
 assert.deepEqual(business[0].rows.map(r=>r[1]),[82,75,63,52]);assert.match(business[0].source.detail,/1,460/);assert.match(business[0].title,/plan/);
 assert.deepEqual(business[1].rows.map(r=>r[1]),[57,27,4,4]);assert.match(business[1].source.detail,/1,224/);
 assert.deepEqual(business[2].rows.map(r=>r[1]),[71,60,31,30,28]);assert.match(business[2].source.detail,/19/);
 assert.deepEqual(markets[0].rows.map(r=>r[1]),[55,31,9,5]);assert.equal(markets[0].rows.reduce((sum,r)=>sum+r[1],0),100);assert.match(markets[0].subtitle,/spending/);
 assert.deepEqual(markets[1].rows.map(r=>r[1]),[60,58,20]);assert.match(markets[1].caption,/overlap/);
 assert.deepEqual(markets[1].rows.map(r=>r[2]),['chatgpt','gemini','claude']);
 assert.deepEqual(usage.map(v=>v.icon),['gemini','chatgpt','claude']);
 assert.deepEqual(usage[0].rows.map(r=>r[1]),[26.4,20.7,13.5,11]);
 assert.deepEqual(usage[1].rows.map(r=>r[1]),[28.1,21.4,20.2,8.9,8.8]);assert.match(usage[1].source.detail,/September 2026/);
 assert.deepEqual(usage[2].rows.map(r=>r[1]),[36,16,11,8]);assert.match(usage[2].source.detail,/Chapter 2/);
 assert.match(charts[2].caveat,/Separate studies, dates and categories/);
 for(const chart of charts)for(const view of chart.views){assert.equal(new URL(view.source.url).protocol,'https:');assert.ok(view.source.detail);for(const [,v] of view.rows)assert.ok(v>=0&&v<=100);}
 assert.doesNotMatch(JSON.stringify(input.sections[1]),/[\u00c2\u00c3\ufffd]/);
 assert.equal(input.sections[1].slides[0].subtitle,undefined);assert.equal(input.sections[1].slides[0].downloads,undefined);
 assert.match(input.sources.uk.url,/publishing.service.gov.uk/);assert.match(input.sources.menlo.detail,/weighted by AI spend/);
 assert.deepEqual(input.sections[0].slides[1].items.map(item=>item.label),['A short history','Plugins']);
});

test('related material is grouped behind topic buttons without duplicate section footers or lost learning content',()=>{
 assert.deepEqual(input.sections.map(s=>s.slides.length),[11,6]);
 const first=topics(input.sections[0].slides),second=topics(input.sections[1].slides);
 for(const kind of ['annotated-prompt','leave-compare','showcase','ai-tool'])assert.ok(first.some(s=>s.kind===kind));
 for(const kind of ['gas-flow','showcase','try-code'])assert.ok(second.some(s=>s.kind===kind));
 assert.equal(second.filter(s=>s.kind==='evidence').length,3);
 assert.equal(input.sections[0].objectives.length,4);assert.equal(input.sections[1].objectives.length,4);
 const renderer=fs.readFileSync(`${folder}/renderer.js.txt`,'utf8');
 assert.doesNotMatch(renderer,/MIS 311 · Advanced Business Analytics ·/);
 assert.doesNotMatch(renderer,/canvas\.append\(el\('p','note'/);
 assert.match(renderer,/panels\.get\(index\)/,'reopening a topic reuses its interactive content');
 assert.equal(input.sections[1].slides[3].kind,'showcase','the practice submission board stays a parent-owned native slide');
});

test('Section 2 removes data preparation and replaces the old Apps Script menu with a definition and one non-IT flow',()=>{
 const section=input.sections[1],gas=section.slides[2],practice=section.slides[3];
 assert.equal(section.slides.length,6);assert.ok(!section.slides.some(s=>s.title==='Data preparation'));
 assert.equal(gas.title,'Google Apps Script');assert.deepEqual(gas.tools,['apps-script']);assert.deepEqual(gas.items.map(i=>i.label),['How can non-IT users use it?','Try?']);assert.equal(gas.definitionTitle,'What is Google Apps Script?');assert.ok(gas.definition.length<150);
 const flow=gas.items[0].content;assert.equal(flow.kind,'gas-flow');assert.equal(flow.steps.length,4);assert.match(JSON.stringify(flow.steps),/need|prompt|Code.gs|Deploy|\/exec/);
 for(const old of ['The app architecture','Interactive preview','Write the prompt','Starter files','Setup and deployment'])assert.ok(!gas.items.some(item=>item.label===old));
 assert.equal(practice.kind,'showcase');assert.equal(practice.practice.minutes,15);assert.equal(practice.practice.activityId,'gas-webapp');assert.ok(practice.practice.allowImages&&practice.practice.allowDelete);assert.equal(practice.practice.steps.length,4);assert.match(practice.practice.steps[3],/\/exec/);
 assert.equal(practice.practice.hint,'Create a web app on google appscript and take the googlesheet as the database, this web app is about....... (your demand).');
 assert.ok(input.sections[0].slides.filter(s=>s.practice).every(s=>!s.practice.hint));
 // The generated page map, rather than a section-wide fallback, selects this practice.
 assert.deepEqual(Object.keys(manifest[section.id].showcasePractices),['4']);
 const {getCompiledSectionMetadata}=loadTS('lib/compiledSectionMetadata.ts',{
  '../course-content/web-app-development/manifest.json':{},'../course-content/mis301/manifest.json':{},'../course-content/mis311/manifest.json':{},'../course-content/advanced-business-analytics/manifest.json':manifest,'../course-content/sources.json':bindings,
 });
 const active=getCompiledSectionMetadata(section.id);assert.equal(active.showcasePractices['4'].activityId,'gas-webapp');assert.equal(active.showcasePractice,undefined);assert.equal(active.showcaseGuide,undefined);
});

test('Try embeds the four original attachment files in order and treats their code as copy-only text',()=>{
 const slide=input.sections[1].slides[2].items[1].content;
 assert.equal(slide.kind,'try-code');assert.equal(slide.url,'https://script.google.com/');assert.equal(slide.showIntro,false);assert.deepEqual(slide.files,['Code.gs','Index.html','Register.html','Demo.html']);
 const assets=JSON.parse(fs.readFileSync(`${folder}/try-app/manifest.json`,'utf8'));
 const compiled=JSON.parse(fs.readFileSync(`${folder}/Week8Session2.js`,'utf8').match(/^const course=(.*);$/m)[1]);
 assert.equal(JSON.parse(fs.readFileSync(`${folder}/Week8Session1.js`,'utf8').match(/^const course=(.*);$/m)[1]).tryFiles,undefined);
 for(const asset of assets){const bytes=fs.readFileSync(`${folder}/try-app/${asset.name}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(compiled.tryFiles[asset.name],bytes.toString('utf8'));}
 const renderer=fs.readFileSync(`${folder}/renderer.js.txt`,'utf8');assert.match(renderer,/copy\(files\[name\]/);assert.doesNotMatch(renderer,/innerHTML\s*=\s*course\.(?:tryFiles|salesDashboardFiles)/);
});

test('Visualization has only Try and embeds the exact slide 41 Emergency files and Sales workbook',()=>{
 const slide=input.sections[1].slides[4];assert.equal(slide.title,'Visualization');assert.deepEqual(slide.items.map(i=>i.label),['Try']);
 const content=slide.items[0].content;assert.equal(content.fileSet,'sales-dashboard');assert.deepEqual(content.files,['Code.gs','Index.html']);assert.equal(content.download,'sales-data');
 assert.equal(content.showIntro,false);assert.equal(content.url,'https://script.google.com/');assert.deepEqual(content.limitations,{kind:'discussion-question',title:'What are the limitations?'});
 const compiled=JSON.parse(fs.readFileSync(`${folder}/Week8Session2.js`,'utf8').match(/^const course=(.*);$/m)[1]);
 const original=JSON.parse(fs.readFileSync('components/section1/salesDashboardEmergencyData.ts','utf8').match(/export const SALES_DASHBOARD_FILES = (\[[\s\S]*\]) as const;/)[1]);
 assert.deepEqual(compiled.salesDashboardFiles,Object.fromEntries(original.map(f=>[f.name,f.code])));
 assert.deepEqual(Buffer.from(compiled.salesData.data,'base64'),fs.readFileSync('public/downloads/Sales-Data-2025.xlsx'));assert.equal(compiled.salesData.name,'Sales-Data-2025.xlsx');
 assert.notEqual(compiled.salesDashboardFiles['Code.gs'],compiled.tryFiles['Code.gs'],'registration and sales files remain separate');
});

test('Custom AI keeps three concise setup guides without outside descriptions, examples or source captions',()=>{
 const slide=input.sections[1].slides[5];assert.equal(slide.title,'Custom AI');assert.equal(slide.kind,'hub');assert.equal(slide.layout,'custom-ai');assert.equal(slide.summary,undefined);
 assert.deepEqual(slide.items.map(i=>i.label),['Gemini','ChatGPT','Claude','Try?']);
 assert.deepEqual(slide.items.slice(0,3).map(i=>i.content.tools[0]),['gemini','chatgpt','claude']);
 for(const {content} of slide.items.slice(0,3)){assert.equal(content.kind,'skill-setup');assert.equal(content.steps.length,3);assert.equal(content.example,undefined);assert.equal(content.availability,undefined);assert.equal(content.sources,undefined);for(const source of content.sourceReferences){assert.equal(new URL(source.url).protocol,'https:');assert.match(new URL(source.url).hostname,/^(support\.google\.com|help\.openai\.com|support\.claude\.com)$/);}}
 assert.match(slide.items[0].content.steps[0],/Gems/);assert.match(slide.items[2].content.steps[1],/ZIP/);
 assert.equal(input.sections[1].slides.some(s=>s.title==='Share your visualization'),false);
});

test('Custom AI Try embeds the supplied calorie-planner SKILL.md as an exact local download',()=>{
 const demo=input.sections[1].slides[5].items[3].content;assert.equal(demo.kind,'skill-demo');assert.equal(demo.features.length,3);assert.match(JSON.stringify(demo.features),/calorie|Google Maps|location/);
 const asset=JSON.parse(fs.readFileSync(`${folder}/skill-examples/calorie-planner/manifest.json`,'utf8')),bytes=fs.readFileSync(`${folder}/skill-examples/calorie-planner/SKILL.md`);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
 const section=JSON.parse(fs.readFileSync(`${folder}/Week8Session2.js`,'utf8').match(/^const course=(.*);$/m)[1]);assert.equal(section.skillDemoFile.name,'SKILL.md');assert.deepEqual(Buffer.from(section.skillDemoFile.data,'base64'),bytes);
 const first=JSON.parse(fs.readFileSync(`${folder}/Week8Session1.js`,'utf8').match(/^const course=(.*);$/m)[1]);assert.equal(first.skillDemoFile,undefined);
});

test('official tool marks keep verified source bytes and only referenced marks are embedded',()=>{
 const assets=JSON.parse(fs.readFileSync(`${folder}/assets/official-icons.json`,'utf8'));
 assert.deepEqual(Object.keys(assets).sort(),['adobe','apps-script','calendar','canva','chatgpt','claude','deepseek','drive','gamma','gemini','gmail','llama','lovable','openai','qwen','sheets','slack','suno']);
 for(const asset of Object.values(assets)){
  const bytes=fs.readFileSync(`${folder}/assets/${asset.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.match(new URL(asset.source).hostname,/(?:^|\.)(?:openai\.com|chatgpt\.com|gstatic\.com|perplexity\.ai|claude\.com|fbcdn\.net|alicdn\.com|deepseek\.com|slack-edge\.com|canva\.com|gamma\.app|notion\.com|cursor\.com|microsoft\.com|adobe\.com|suno\.com|lovable\.dev)$/);
  for(const section of input.sections){const course=JSON.parse(fs.readFileSync(`${folder}/${section.file}`,'utf8').match(/^const course=(.*);$/m)[1]);for(const [name,uri] of Object.entries(course.icons)){const mark=assets[name];assert.equal(uri,`data:${mark.mime};base64,${fs.readFileSync(`${folder}/assets/${mark.path}`).toString('base64')}`);}assert.equal(course.icons.perplexity,undefined);assert.equal(course.labZip,undefined);assert.equal(course.labFiles,undefined);if(section===input.sections[1]){assert.equal(course.toolInterfaces,undefined);assert.equal(course.icons.adobe,undefined);assert.ok(Buffer.byteLength(JSON.stringify(course))<500000);}}
 }
});

 test('history distinguishes model families, dated releases, IPO filings and actual listings',()=>{
 const history=topics(input.sections[0].slides).find(s=>s.kind==='history');
 assert.deepEqual(history.items.map(i=>i.icon),['openai','gemini','claude','llama','qwen','deepseek']);
 assert.doesNotMatch(JSON.stringify(history),/\?/,'history typography has no encoding replacement characters');
 for(const item of history.items){assert.equal(item.content.events.length,4);assert.equal(item.content.updated,'21 November 2026');for(const event of item.content.events)assert.equal(new URL(event.url).protocol,'https:');}
 assert.match(history.items[0].content.marketText,/confidential S-1/);
 assert.match(history.items[1].content.marketText,/19 Aug 2004/);
 assert.match(history.items[2].content.marketText,/19 Nov 2026/);
 assert.match(history.items[2].content.marketTitle,/ANT/);
 });

test('local histories identify downloadable checkpoints and realistic hardware scope',()=>{
 const history=topics(input.sections[0].slides).find(s=>s.kind==='history');
 assert.deepEqual(history.items.map(i=>i.group),['online','online','online','local','local','local']);
 const locals=history.items.filter(i=>i.group==='local');
 assert.equal(locals.length,3);
 for(const item of locals){assert.equal(item.content.deployment,'local');assert.match(item.content.marketTitle,/Local example:/);assert.match(item.content.marketText,/memory|RAM|hardware/i);}
 assert.match(locals[0].content.marketTitle,/1B \/ 3B/);
 assert.match(locals[1].content.marketTitle,/0.6B \/ 4B/);
 assert.match(locals[2].content.marketTitle,/1.5B/);
 assert.match(locals[2].content.marketText,/Full V4.1-Flash needs substantial memory/);
});

test('Plug in introduces integrations for all three online assistants with primary-source examples',()=>{
 const page=input.sections[0].slides[1].items[1].content;
 assert.equal(page.kind,'plugins');assert.deepEqual(page.platforms.map(p=>p.name),['ChatGPT','Gemini','Claude']);
 assert.match(page.scope,/permissions/);
 for(const p of page.platforms){assert.equal(p.examples.length,3);assert.equal(p.exampleIcons.length,3);assert.equal(new URL(p.url).protocol,'https:');}
 assert.equal(page.platforms[1].term,'Connected Apps');
});

test('page two exposes models and platform integrations in a split layout',()=>{
 const page=input.sections[0].slides[1];assert.equal(page.kind,'split-overview');
 assert.equal(page.items[0].content.items.length,6);assert.equal(page.items[1].content.platforms.length,3);
});

test('Prompt keeps one annotated example and a concrete leave-app comparison with exact demo links',()=>{
 const section=input.sections[0],cover=section.slides[0],slide=section.slides[2];
 assert.equal(cover.subtitle,undefined);
 assert.equal(slide.title,'Prompt');assert.ok(slide.definition.length<100);
 assert.deepEqual(slide.items.map(i=>i.label),['Prompt components','Bad prompt vs Good prompt']);
 assert.deepEqual(slide.items[0].content.annotations.map(s=>s.component),['Persona','Task','Context','Format','Tone']);
 const comparison=slide.items[1].content;assert.equal(comparison.pages.length,5);
 assert.equal(comparison.goodUrl,'https://script.google.com/macros/s/AKfycbzLVGtKi66AFWM2bYUtBV-JOJHiCR8vSlOpnH5SqcgMgJW_pOzC7nbtlBoT60vABp2gXA/exec');
 assert.equal(comparison.badUrl,'https://script.google.com/macros/s/AKfycbzywv0i1CW8eAgphqDg9bsPLxZjYPUZx8SlJHnjEuOU3kSN-CF1dJBALp1GM-PNf7w8/exec');
 assert.match(JSON.stringify(comparison.pages),/assigned manager|Pending|deploy/);
});

test('Best Use cases keeps both reference groups and a complete caution email with leftover AI commentary',()=>{
 const slide=input.sections[0].slides[3];assert.equal(slide.title,'Best Use cases');assert.deepEqual(slide.items.map(i=>i.label),['For students','Other tasks']);
 assert.equal(slide.items[0].content.items.length,7);assert.equal(slide.items[1].content.items.length,5);
 assert.match(JSON.stringify(slide.items[0]),/Coding|Analyze data/);
 assert.match(slide.caution.subject,/Subject:/);assert.match(slide.caution.salutation,/Dear/);assert.equal(slide.caution.closing,'Best wishes,');assert.match(slide.caution.leftover,/This is your Academic mail to send to Mr/);
});
