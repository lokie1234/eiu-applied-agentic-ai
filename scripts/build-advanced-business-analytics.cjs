// Compile the editable native Week 8 lessons, including referenced offline assets.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const folder = path.join(__dirname, '../course-content/advanced-business-analytics');
async function main() {
  const input = JSON.parse(fs.readFileSync(path.join(folder,'storyboard.json'),'utf8'));
  const frame = 'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../public/templates/eiu-business-v1/background.png')).toString('base64');
  const reference=fs.readFileSync(path.join(folder,'../mis311/cover-style.js.txt'),'utf8');
  const art=reference.match(/processBackground\.innerHTML = `([\s\S]*?)`;/)?.[1];
  if(!art)throw Error('Missing reference course cover artwork');
  const coverArt=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" fill="none" stroke="#144069" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" opacity=".12" aria-hidden="true">${art}</svg>`;
  const designCSS=fs.readFileSync(path.join(folder,'design.css'),'utf8');
  const iconManifest=JSON.parse(fs.readFileSync(path.join(folder,'assets/official-icons.json'),'utf8'));
  const icons=Object.fromEntries(Object.entries(iconManifest).map(([name,asset])=>{
    const bytes=fs.readFileSync(path.join(folder,'assets',asset.path));
    if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Official icon bytes changed: '+name);
    return [name,`data:${asset.mime};base64,${bytes.toString('base64')}`];
  }));
  const interfaceManifest=JSON.parse(fs.readFileSync(path.join(folder,'assets/tool-interfaces.json'),'utf8'));
  const toolInterfaces=Object.fromEntries(Object.entries(interfaceManifest).map(([name,asset])=>{
    const bytes=fs.readFileSync(path.join(folder,'assets',asset.path));
    if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Tool interface bytes changed: '+name);
    return [name,`data:${asset.mime};base64,${bytes.toString('base64')}`];
  }));
  const sourcesPath=path.join(folder,'../sources.json'),bindings=JSON.parse(fs.readFileSync(sourcesPath,'utf8'));
  const metadata={};
  for(const section of input.sections){
    const defaultPractice=section.slides.find(s=>s.practice&&!s.practice.activityId)?.practice;
    const relative=`course-content/advanced-business-analytics/${section.file}`;
    // Embed only marks used by this section, including automatic inline brands.
    const sectionText=JSON.stringify(section),usedIcons=new Set();
    const collect=value=>{if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);else if(typeof value==='string'&&icons[value])usedIcons.add(value);};collect(section);
    for(const [term,name] of Object.entries({'Google Apps Script':'apps-script','Google Sheets':'sheets','Apps Script':'apps-script','OpenAI':'openai','ChatGPT':'chatgpt','GPT':'openai'}))if(sectionText.includes(term))usedIcons.add(name);
    if(sectionText.includes('GPT'))usedIcons.add('chatgpt');
    const sectionIcons=Object.fromEntries([...usedIcons].sort().map(name=>[name,icons[name]]));
    const course={sectionTitle:section.title,slides:section.slides.map((s,i)=>({...s,number:i+1})),frame,coverArt,icons:sectionIcons,objectives:section.objectives};
    if(section.slides.some(s=>s.kind==='ai-tool'))course.toolInterfaces=toolInterfaces;
    const needsTry=s=>(s.kind==='try-code'&&s.fileSet!=='sales-dashboard')||(s.kind==='hub'&&s.items.some(item=>needsTry(item.content)));
    if(section.slides.some(needsTry)){
      const files=JSON.parse(fs.readFileSync(path.join(folder,'try-app/manifest.json'),'utf8'));
      if(JSON.stringify(files.map(f=>f.name))!==JSON.stringify(['Code.gs','Index.html','Register.html','Demo.html']))throw Error('Unexpected Try file order');
      course.tryFiles=Object.fromEntries(files.map(file=>{
        const bytes=fs.readFileSync(path.join(folder,'try-app',file.name));
        if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Try attachment bytes changed: '+file.name);
        return[file.name,bytes.toString('utf8')];
      }));
    }
    const needsSales=s=>(s.kind==='try-code'&&s.fileSet==='sales-dashboard')||(s.kind==='hub'&&s.items.some(item=>needsSales(item.content)));
    if(section.slides.some(needsSales)){
      course.icons.sheets=icons.sheets;
      const source=fs.readFileSync(path.join(folder,'../../components/section1/salesDashboardEmergencyData.ts'),'utf8');
      const match=source.match(/export const SALES_DASHBOARD_FILES = (\[[\s\S]*\]) as const;/);
      if(!match)throw Error('Missing slide 41 Emergency sales source');
      const files=JSON.parse(match[1]);
      if(JSON.stringify(files.map(file=>file.name))!==JSON.stringify(['Code.gs','Index.html']))throw Error('Unexpected sales Emergency files');
      course.salesDashboardFiles=Object.fromEntries(files.map(file=>[file.name,file.code]));
      course.salesData={name:'Sales-Data-2025.xlsx',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',data:fs.readFileSync(path.join(folder,'../../public/downloads/Sales-Data-2025.xlsx')).toString('base64')};
    }
    const skillDownloads=new Set();
    const collectSkillDownloads=s=>{if(s.kind==='skill-demo')skillDownloads.add(s.download);if(s.kind==='hub')s.items.forEach(item=>collectSkillDownloads(item.content));};
    section.slides.forEach(collectSkillDownloads);
    if(skillDownloads.size){
      course.skillDemoFiles={};
      for(const key of skillDownloads){
        if(!['calorie-planner','visualization-automation','light-3d-game'].includes(key))throw Error('Unknown skill download: '+key);
        const directory=path.join(folder,'skill-examples',key),asset=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8')),bytes=fs.readFileSync(path.join(directory,asset.name));
        if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('SKILL.md bytes changed: '+key);
        course.skillDemoFiles[key]={name:asset.name,mime:asset.mime,data:bytes.toString('base64')};
      }
    }
    const code=`// Generated by scripts/build-advanced-business-analytics.cjs. Edit storyboard.json, renderer.js.txt, design.css or referenced assets.\nconst course=${JSON.stringify(course)};\nconst designCSS=${JSON.stringify(designCSS)};\n`+
      fs.readFileSync(path.join(folder,'../mis311/player-template.js.txt'),'utf8')+'\n'+fs.readFileSync(path.join(folder,'renderer.js.txt'),'utf8');
    fs.writeFileSync(path.join(folder,section.file),code);
    const existing=bindings.find(row=>row.sectionId===section.id);
    if(existing&&(existing.courseId!==input.courseId||existing.path!==relative))throw Error('Conflicting course source binding');
    if(!existing)bindings.push({courseId:input.courseId,sectionId:section.id,path:relative});
    const native=Object.fromEntries(section.slides.flatMap((s,i)=>s.kind==='showcase'?[[String(i+1),'showcase']]:[]));
    metadata[section.id]={courseId:input.courseId,path:relative,revision:createHash('sha256').update(code).digest('hex'),bytes:Buffer.byteLength(code),teachingSlides:section.slides.length,learnerSlides:section.slides.length,preservesBusinessTemplate:false,nativeSlides:{teaching:native,learner:native},...(defaultPractice?{showcasePractice:defaultPractice}:section.slides.some(s=>s.kind==='showcase'&&!s.practice)?{showcaseGuide:{title:'Share an Apps Script visualization',message:'Submit the deployed /exec URL after checking its values and audience access.',cards:[{title:'Deploy',text:'Use Deploy > New deployment > Web app. Keep data synthetic or public.'},{title:'Verify',text:'Check totals and filters, then open the link in the intended viewer account.'},{title:'Discuss',text:'Keep your final prompt, one insight, one correction and one limitation ready.'}]}}:{})};
    const practices=Object.fromEntries(section.slides.flatMap((s,i)=>s.practice?[[String(i+1),s.practice]]:[]));
    if(Object.keys(practices).length)metadata[section.id].showcasePractices=practices;
    console.log(`${section.file}: ${section.slides.length} native slides, ${Buffer.byteLength(code)} bytes`);
  }
  fs.writeFileSync(sourcesPath,JSON.stringify(bindings,null,2)+'\n');
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(metadata,null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
