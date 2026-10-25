const fs = require('node:fs');
const path = require('node:path');
const pruneSection = require('./prune-web-app-section.cjs');
const pruneAssets = require('./prune-web-app-assets.cjs');
const pruneStyles = require('./prune-web-app-styles.cjs');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve('course-content/web-app-development');
const course = JSON.parse(fs.readFileSync(path.join(root,'storyboard.json'),'utf8'));
const assets = JSON.parse(fs.readFileSync(process.env.COURSE_ASSETS || 'course-content/web-app-development/assets.json','utf8'));
assets['Course Inter'] = 'data:font/woff2;base64,' + fs.readFileSync(path.join(root,'fonts','Inter-Variable.woff2')).toString('base64');
const renderer = fs.readFileSync(path.join(root,'renderer.tsx.txt'),'utf8');
const selected = process.argv[2];
const manifestPath = path.join(root,'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath,'utf8')) : {};
const bindings = JSON.parse(fs.readFileSync('course-content/sources.json','utf8'));
if (selected && !['1','2'].includes(selected)) throw new Error('Choose section 1 or 2.');
for (const [name,filter] of [['Section1.js',1],['Section2.js',2]]) {
 if (selected && Number(selected) !== filter) continue;
 const section = { title: course.title, summary: course.summary, slides: course.slides.filter(s=>s.section===filter) };
 // The renderer keeps embedded assets for its standalone source. Replace that
 // block before injecting the selected asset catalog to avoid declaring twice.
 const sectionRendererPath = path.join(root,`renderer.section${filter}.tsx.txt`);
 const sectionRenderer = fs.existsSync(sectionRendererPath) ? fs.readFileSync(sectionRendererPath,'utf8') : renderer;
 const template = sectionRenderer.replace(/const assets: Record<string,string> = [\s\S]*?;\r?\n/, '');
 // Authoring notes remain in storyboard.json. These fields are never read by
 // the Section 1 display; nested workspace details keep their visualConcept.
 const runtimeSlide = ({objective,verify,minutes,regionDetails,guideSlide,...slide}, nested = false) => {
  if (!nested) delete slide.visualConcept;
  if (regionDetails) slide.regionDetails = regionDetails.map(detail => runtimeSlide(detail, true));
  if (guideSlide) slide.guideSlide = runtimeSlide(guideSlide, true);
  return slide;
 };
 const runtimeSection = filter === 1 ? {...section, slides: section.slides.map(slide => runtimeSlide(slide))} : section;
 const source = template.replace('// __COURSE_DATA__',()=>`// Nội dung phần ${filter}: chỉnh các slide trong mảng bên dưới.\nconst course: { title: string; summary: string; slides: SlideData[] } = ${JSON.stringify(runtimeSection,null,2)};\nconst assets: Record<string,string> = ${JSON.stringify(assets,null,2)};`);
 const pruned = pruneSection(source, section);
 const cleaned = pruneAssets(filter === 1 ? pruneStyles(pruned) : pruned, assets);
 const result=ts.transpileModule(cleaned,{fileName:'section.tsx',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'h',jsxFragmentFactory:'Fragment',esModuleInterop:true}});
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(errors.length)throw Error(ts.flattenDiagnosticMessageText(errors[0].messageText,' '));
 fs.writeFileSync(path.join(root,name),result.outputText);
 const binding = bindings.find(item => item.path === `course-content/web-app-development/${name}`);
 if (!binding) throw Error('Missing verified course/section binding for '+name);
 manifest[binding.sectionId] = {
  courseId: binding.courseId, path: binding.path,
  revision: createHash('sha256').update(result.outputText).digest('hex'),
  bytes: Buffer.byteLength(result.outputText),
  teachingSlides: section.slides.length,
  learnerSlides: section.slides.filter(slide => !slide.adminOnly).length,
  showcaseGuide: (() => {
   const guide = section.slides.find(slide => slide.visual === 'git-intro-submission')?.guideSlide;
   return guide && {...guide, cards: guide.cards.map(card => ({...card, logoSrc: card.logo ? assets[card.logo] : undefined}))};
  })(),
  preservesBusinessTemplate: true,
  nativeSlides: Object.fromEntries([['teaching', section.slides], ['learner', section.slides.filter(slide => !slide.adminOnly)]].map(([role, slides]) => [role,
   Object.fromEntries(slides.flatMap((slide, index) => {
    const interaction = { 'git-intro-submission': 'showcase', 'git-intro-section-quiz': 'quiz' }[slide.visual];
    return interaction ? [[String(index + 1), interaction]] : [];
   })),
  ])),
 };
 console.log(name,section.slides.length,'slides',Buffer.byteLength(result.outputText),'bytes');
}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
