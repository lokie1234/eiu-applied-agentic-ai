// Recompile the matching original React lesson with a dedicated cover only.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {buildSection}=require('./generate-builtin-tsx.cjs');
async function main(){
 const outputDir=path.resolve('course-content/ai-for-managers/reuploaded');
 const previous=fs.existsSync(path.join(outputDir,'build.json'))?JSON.parse(fs.readFileSync(path.join(outputDir,'build.json'),'utf8')):null;
 const iconFolder=path.resolve('course-content/advanced-business-analytics/assets');
 const catalog=JSON.parse(fs.readFileSync(path.join(iconFolder,'official-icons.json'),'utf8'));
 const labels={'apps-script':'Google Apps Script',sheets:'Google Sheets',gemini:'Gemini',chatgpt:'ChatGPT',claude:'Claude'};
 const icons=Object.fromEntries(Object.entries(labels).map(([key,label])=>{const icon=catalog[key],bytes=fs.readFileSync(path.join(iconFolder,icon.path));if(createHash('sha256').update(bytes).digest('hex')!==icon.sha256)throw Error('Official icon bytes changed: '+key);return[key,{label,src:`data:${icon.mime};base64,${bytes.toString('base64')}`,sha256:icon.sha256,source:icon.source}];}));
 fs.writeFileSync(path.join(outputDir,'tool-icons.json'),JSON.stringify(icons,null,2)+'\n');
 const result=await buildSection(1,{outputDir,coverSource:path.join(outputDir,'cover.tsx.txt'),orientationSource:path.join(outputDir,'orientation.tsx.txt'),ideasSource:path.join(outputDir,'ideas.tsx.txt'),submissionSource:path.join(outputDir,'submission.tsx.txt')});
 const bytes=fs.readFileSync(path.join(outputDir,'section1.js'));
 const sourceRevisions=[...new Set([...(previous?.sourceRevisions||[]),previous?.sha256].filter(Boolean))];
 fs.writeFileSync(path.join(outputDir,'build.json'),JSON.stringify({sourceRevisions,courseId:'500c7192-961d-4e41-9917-9b9f85f0b667',sectionId:'98694749-2879-46e2-82bd-03fd27f23c5e',originalUpload:'course-content/imported/500c7192-961d-4e41-9917-9b9f85f0b667/98694749-2879-46e2-82bd-03fd27f23c5e/0242893b-b5f3-4036-8cfb-efc903434327.js',originalSha256:'19a89192d3ad62fe8f5d85df0a8f7eaed02853f0640bfb89d3b24e715907188d',sha256:createHash('sha256').update(bytes).digest('hex'),...result},null,2)+'\n');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
