const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../course-content/mis311');
const sources = JSON.parse(fs.readFileSync(path.join(root, '../sources.json'), 'utf8'));
const manifest = {};
for (const session of [1, 2]) {
  const folder = path.join(root, `session${session}`);
  const storyboard = JSON.parse(fs.readFileSync(path.join(folder, 'storyboard.json'), 'utf8'));
  const presentationPath = path.join(folder, 'presentation.json');
  const presentation = fs.existsSync(presentationPath) ? JSON.parse(fs.readFileSync(presentationPath, 'utf8')) : {};
  const popup = presentation.learningOutcomesPopup;
  const coverStyle = presentation.coverStyle || (popup ? { ...popup, sourceSlide: popup.triggerSlide } : null);
  const tools = presentation.toolsHub;
  const hub = presentation.rootCauseHub;
  const exercise = presentation.defectExercise;
  const valueStream = presentation.valueStreamIntro;
  const streamHub = presentation.valueStreamHub;
  const parts = presentation.valueStreamParts;
  const followup = presentation.valueStreamFollowup;
  const conflicts = presentation.conflictSections;
  const conflictMenu = presentation.conflictHub;
  const persuasion = presentation.persuasion;
  const mapping = presentation.causeMapping;
  const tree = presentation.problemTree;
  const process = presentation.rootCauseProcess;
  const comparison = presentation.rootCauseComparison;
  const organizationChart = presentation.organizationChart;
  if (popup && (!storyboard.pages.some(page => page.sourceSlide === popup.sourceSlide) || !storyboard.pages.some(page => page.sourceSlide === popup.triggerSlide))) throw Error('Invalid Learning Outcomes source or trigger slide.');
  const assets = {};
  const displayed = storyboard.pages.filter(page => page.sourceSlide !== popup?.sourceSlide && !presentation.hiddenSourceSlides?.includes(page.sourceSlide));
  if (presentation.displaySourceOrder) {
    const order = presentation.displaySourceOrder;
    if (order.length !== displayed.length || new Set(order).size !== order.length || displayed.some(page => !order.includes(page.sourceSlide))) throw Error('Invalid display source order');
    displayed.sort((a, b) => order.indexOf(a.sourceSlide) - order.indexOf(b.sourceSlide));
  }
  for (const extra of presentation.additionalSlides || []) {
    const index = displayed.findIndex(page => page.sourceSlide === extra.afterSourceSlide);
    if (index < 0 || displayed.some(page => page.sourceSlide === extra.id)) throw Error('Invalid additional slide');
    displayed.splice(index + 1, 0, { sourceSlide: extra.id, file: extra.file });
  }
  const compiledTools = tools ? { ...tools, pages: [...new Set(tools.originalSourceSlides || tools.cards.flatMap(card => card.sourceSlides))].map(sourceSlide => {
      const original = storyboard.pages.find(page => page.sourceSlide === sourceSlide);
      if (!original) throw Error('Missing RCA tool source slide');
      return { sourceSlide, svg: fs.readFileSync(path.join(folder, original.file), 'utf8') };
    }) } : null;
  const pages = displayed.map((page, index) => {
    const persuasionIntro = page.sourceSlide === persuasion?.sourceSlide ? persuasion : null;
    const conflictHub = page.sourceSlide === conflictMenu?.sourceSlide ? { ...conflictMenu, backgroundSvg: fs.readFileSync(path.join(folder, conflictMenu.backgroundFile), 'utf8'), model: conflicts.find(item => item.kind === 'model') } : null;
    const conflictSection = conflictHub ? null : conflicts?.find(item => item.sourceSlide === page.sourceSlide);
    const valueStreamFollowup = followup?.find(item => item.sourceSlide === page.sourceSlide);
    const valueStreamParts = page.sourceSlide === parts?.sourceSlide ? parts : null;
    const valueStreamHub = page.sourceSlide === valueStream?.sourceSlide ? { ...streamHub, backgroundSvg: fs.readFileSync(path.join(folder, streamHub.backgroundFile), 'utf8'), definition: valueStream, parts, importance: followup.find(item => item.kind === 'importance') } : null;
    const chart = page.sourceSlide === organizationChart?.sourceSlide ? organizationChart : null;
    const rootCauseComparison = page.sourceSlide === comparison?.sourceSlide ? comparison : null;
    const rootCauseProcess = page.sourceSlide === process?.sourceSlide ? process : null;
    const problemTree = page.sourceSlide === tree?.sourceSlide ? tree : null;
    const causeMapping = page.sourceSlide === mapping?.sourceSlide ? mapping : null;
    const defectExercise = page.sourceSlide === exercise?.sourceSlide ? exercise : null;
    const toolsHub = page.sourceSlide === tools?.sourceSlide ? compiledTools : null;
    const rootCauseHub = page.sourceSlide === hub?.id ? { ...hub, backgroundSvg: fs.readFileSync(path.join(folder, page.file), 'utf8'), comparison, process, mapping, exercise, tree, tools: compiledTools } : null;
    const svg = conflictHub || rootCauseHub || persuasionIntro || conflictSection || valueStreamFollowup || valueStreamParts || valueStreamHub || chart || rootCauseComparison || rootCauseProcess || problemTree || causeMapping || toolsHub || defectExercise ? '' : fs.readFileSync(path.join(folder, page.file), 'utf8');
    for (const fragment of [svg, ...(rootCauseHub?.tools.pages.map(page => page.svg) || []), ...(valueStreamHub ? [`asset:${valueStream.exampleAsset}`, `asset:${parts.symbolsAsset}`, `asset:${parts.exampleAsset}`] : []), ...(valueStreamParts ? [`asset:${valueStreamParts.symbolsAsset}`, `asset:${valueStreamParts.exampleAsset}`] : []), ...(toolsHub?.pages.map(page => page.svg) || [])]) for (const match of fragment.matchAll(/asset:([a-f0-9]+\.(png|jpg))/g)) {
      const name = match[1];
      assets[name] ??= `data:image/${match[2] === 'jpg' ? 'jpeg' : 'png'};base64,${fs.readFileSync(path.join(root, 'assets', name)).toString('base64')}`;
    }
    return { svg, number: index + 1, ...(conflictHub ? { conflictHub } : {}), ...(rootCauseHub ? { rootCauseHub } : {}), ...(persuasionIntro ? { persuasionIntro } : {}), ...(conflictSection ? { conflictSection } : {}), ...(valueStreamFollowup ? { valueStreamFollowup } : {}), ...(valueStreamParts ? { valueStreamParts } : {}), ...(valueStreamHub ? { valueStreamHub } : {}), ...(toolsHub ? { toolsHub } : {}), ...(defectExercise ? { defectExercise } : {}), ...(causeMapping ? { causeMapping } : {}), ...(problemTree ? { problemTree } : {}), ...(rootCauseProcess ? { rootCauseProcess } : {}), ...(rootCauseComparison ? { rootCauseComparison } : {}), ...(coverStyle && page.sourceSlide === coverStyle.sourceSlide ? { coverStyle } : {}), ...(popup ? { popup: page.sourceSlide === popup.triggerSlide ? popup : null } : {}), ...(chart ? { organizationChart: chart } : {}), label: `MIS 311 · Week 7 · Session ${session} · Slide ${index + 1}` };
  });
  const code = (`// Generated by scripts/build-mis311-course.cjs; edit session${session}/ sources.\n`+
    `const assets=${JSON.stringify(assets)};\nconst pages=${JSON.stringify(pages)};\n`+
    (hub || streamHub || conflictMenu ? fs.readFileSync(path.join(root, 'root-cause-hub.js.txt'), 'utf8') + '\n' : '')+
    (coverStyle ? fs.readFileSync(path.join(root, 'cover-style.js.txt'), 'utf8') + '\n' : '')+
    (popup ? fs.readFileSync(path.join(root, 'learning-outcomes.js.txt'), 'utf8') + '\n' : '')+
    (persuasion ? fs.readFileSync(path.join(root, 'persuasion.js.txt'), 'utf8') + '\n' : '')+
    (conflicts ? fs.readFileSync(path.join(root, 'conflict-resolution.js.txt'), 'utf8') + '\n' : '')+
    (followup ? fs.readFileSync(path.join(root, 'value-stream-followup.js.txt'), 'utf8') + '\n' : '')+
    (parts ? fs.readFileSync(path.join(root, 'value-stream-parts.js.txt'), 'utf8') + '\n' : '')+
    (valueStream ? fs.readFileSync(path.join(root, 'value-stream-intro.js.txt'), 'utf8') + '\n' : '')+
    (tools ? fs.readFileSync(path.join(root, 'tools-hub.js.txt'), 'utf8') + '\n' : '')+
    (exercise ? fs.readFileSync(path.join(root, 'defect-exercise.js.txt'), 'utf8') + '\n' : '')+
    (mapping ? fs.readFileSync(path.join(root, 'cause-mapping.js.txt'), 'utf8') + '\n' : '')+
    (tree ? fs.readFileSync(path.join(root, 'problem-tree.js.txt'), 'utf8') + '\n' : '')+
    (process ? fs.readFileSync(path.join(root, 'root-cause-process.js.txt'), 'utf8') + '\n' : '')+
    (comparison ? fs.readFileSync(path.join(root, 'root-cause-comparison.js.txt'), 'utf8') + '\n' : '')+
    (organizationChart ? fs.readFileSync(path.join(root, 'organization-chart.js.txt'), 'utf8') + '\n' : '')+
    `module.exports.slides=pages.map(page=>()=>{\n`+
    `const root=document.createElement('div');root.className='slide';root.dataset.eiuTemplate='system';\n`+
    `root.style.cssText='width:100%;height:100%;position:relative;background-size:100% 100%;background-position:center;overflow:hidden';\n`+
    `root.setAttribute('role','img');root.setAttribute('aria-label',page.label);\n`+
    `const content=document.createElement('div');content.dataset.mis311Content='true';content.style.cssText='position:absolute;left:5.6%;top:11.5%;width:88.8%;height:77.4%;overflow:hidden';\n`+
    `content.innerHTML=page.svg.replace(/asset:([a-f0-9]+\\.(?:png|jpg))/g,(_,name)=>{if(!assets[name])throw Error('Missing lesson illustration');return assets[name];});root.appendChild(content);\n`+
    (hub ? `if(page.rootCauseHub)renderRootCauseHub(content,page.rootCauseHub);\n` : '')+
    (persuasion ? `if(page.persuasionIntro)renderPersuasion(content,page.persuasionIntro);\n` : '')+
    (conflictMenu ? `if(page.conflictHub)renderConflictHub(content,page.conflictHub);\n` : '')+
    (conflicts ? `if(page.conflictSection)renderConflictSection(content,page.conflictSection);\n` : '')+
    (followup ? `if(page.valueStreamFollowup)renderValueStreamFollowup(content,page.valueStreamFollowup);\n` : '')+
    (parts ? `if(page.valueStreamParts)renderValueStreamParts(content,page.valueStreamParts);\n` : '')+
    (valueStream ? `if(page.valueStreamHub)renderValueStreamHub(content,page.valueStreamHub);\n` : '')+
    (tools ? `if(page.toolsHub)renderToolsHub(content,page.toolsHub);\n` : '')+
    (exercise ? `if(page.defectExercise)renderDefectExercise(content,page.defectExercise);\n` : '')+
    (mapping ? `if(page.causeMapping)renderCauseMapping(content,page.causeMapping);\n` : '')+
    (tree ? `if(page.problemTree)renderProblemTree(content);\n` : '')+
    (process ? `if(page.rootCauseProcess)renderRootCauseProcess(content,page.rootCauseProcess);\n` : '')+
    (comparison ? `if(page.rootCauseComparison)renderRootCauseComparison(content,page.rootCauseComparison);\n` : '')+
    (organizationChart ? `if(page.organizationChart)renderOrganizationChart(content,page.organizationChart);\n` : '')+
    (organizationChart || comparison || process || tree || mapping || tools || exercise || parts ? `const svg=root.querySelector('svg');if(svg${hub ? '&&!page.rootCauseHub' : ''}${streamHub ? '&&!page.valueStreamHub' : ''}${parts ? '&&!page.valueStreamParts' : ''}${followup ? '&&!page.valueStreamFollowup' : ''}${conflicts ? '&&!page.conflictSection' : ''}${conflictMenu ? '&&!page.conflictHub' : ''}${persuasion ? '&&!page.persuasionIntro' : ''}){svg.style.cssText='display:block;width:100%;height:100%';svg.setAttribute('preserveAspectRatio','xMidYMid meet');}\n` : `const svg=root.querySelector('svg');svg.style.cssText='display:block;width:100%;height:100%';svg.setAttribute('preserveAspectRatio','xMidYMid meet');\n`)+
    `const number=document.createElement('span');number.textContent=String(page.number);number.dataset.mis311Page='true';number.style.cssText='position:absolute;left:93.711%;top:95.152%;width:2.664%;height:4.736%;display:grid;place-items:center;font:600 .9vw Arial;color:#144069';root.appendChild(number);\n`+
    (coverStyle ? `if(page.coverStyle)styleMis311Cover(root,page.coverStyle);\n` : '')+
    (popup ? `if(page.popup)attachLearningOutcomes(root,page.popup);\n` : '')+
    `return root;});\n`).replace(/\r\n/g, '\n');
  const name = `Week7Session${session}.js`;
  fs.writeFileSync(path.join(root, name), code);
  const binding = sources.find(item => item.path === `course-content/mis311/${name}`);
  if (!binding) throw Error(`Missing verified binding for ${name}`);
  manifest[binding.sectionId] = { courseId: binding.courseId, path: binding.path,
    revision: crypto.createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code),
    teachingSlides: pages.length, learnerSlides: pages.length, preservesBusinessTemplate: false };
  console.log(`Generated ${name}: ${pages.length} slides, ${Buffer.byteLength(code)} bytes.`);
}
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2)+'\n');
