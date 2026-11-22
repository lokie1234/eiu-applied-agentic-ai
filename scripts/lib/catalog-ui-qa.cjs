const fs=require('fs'),path=require('path'),http=require('http'),esbuild=require('esbuild');
const {chromium}=require('playwright'),{browserOptions}=require('./offline-player-qa.cjs');
async function createCatalogFixture(out,entry){
 fs.mkdirSync(out,{recursive:true});
 await esbuild.build({stdin:{contents:entry,loader:'tsx',resolveDir:process.cwd()},bundle:true,external:['/branding/*'],outfile:path.join(out,'app.js'),plugins:[{name:'fixture',setup(build){
  build.onResolve({filter:/^(next\/|@\/lib\/(realtime\/client|supabase\/browser|learningLanguage))|LivePresentation|PdfDeck|SectionTwoDeck|UploadedSectionDeck|LearningInnovationIcon|CourseDiscoveryHeading|useSectionSlideCounts/},args=>({path:args.path,namespace:'mock'}));
  build.onLoad({filter:/.*/,namespace:'mock'},args=>{let contents=`export default ()=>null;export const LiveSectionControl=()=>null,LiveController=()=>null,LiveFollower=()=>null;`;
   if(args.path==='next/navigation')contents=`export const useRouter=()=>({refresh(){window.catalogRefreshes=(window.catalogRefreshes||0)+1;},replace(){},push(){}});`;
   if(args.path==='next/dynamic')contents=`export default ()=>()=>null;`;
   if(args.path==='next/image'||args.path==='next/link')contents=`import React from 'react';export default props=>React.createElement('${args.path==='next/link'?'a':'img'}',props,props.children);`;
   if(args.path.includes('learningLanguage'))contents=`export const useLearningLanguage=()=>({t:x=>x,language:'en',setLanguage(){}});`;
   if(args.path.includes('supabase/browser'))contents=`export const getSupabaseBrowserClient=()=>null;`;
   if(args.path.includes('useSectionSlideCounts'))contents=`export const useSectionSlideCounts=()=>({section:11});`;
   if(args.path.includes('realtime/client'))contents=`export const useCourseRealtime=()=>false,realtimeReady=()=>false,pulsePresence=async()=>false,listenInteractive=()=>()=>{},watchRealtimeReady=()=>()=>{};`;
   return {contents,resolveDir:process.cwd()};});
  build.onResolve({filter:/^@\//},args=>{const stem=path.resolve(args.path.replace('@/',''));for(const ext of ['.ts','.tsx','.json'])if(fs.existsSync(stem+ext))return{path:stem+ext};});
 }}]});
 const server=http.createServer((req,res)=>{const file=req.url.split('?')[0];if(file==='/app.js'||file==='/app.css'){res.setHeader('Content-Type',file.endsWith('js')?'text/javascript':'text/css');return res.end(fs.readFileSync(path.join(out,file.slice(1))));}if(file.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({success:true,items:[],counts:{},online:0}));}res.setHeader('Content-Type','text/html');res.end('<html><head><link rel="stylesheet" href="/app.css"></head><body style="margin:0"><div id="app"></div><script src="/app.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch(browserOptions());

 return {server,browser};
}
module.exports={createCatalogFixture};
