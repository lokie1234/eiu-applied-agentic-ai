import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
function load(file,deps={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
 {exports,require:name=>name==='server-only'?{}:deps[name]??require(name),console,Buffer,File,Request,Response,URL,AbortController,AbortSignal,Uint8Array});return exports;
}
const images=load('lib/showcaseImage.ts');
const course='a0ab05b2-ef8e-4cba-a85f-6ef213871c1a',section='cc16c754-a9c6-4967-bfa9-c45f615e0f4e';
const url=`https://lesson.test/api/sections/${section}/showcase`,context={params:Promise.resolve({id:section})};
const profile={sessionId:'signed-session',name:'Signed Learner',email:'',information:{name:'Signed Learner'}};
const png=await sharp({create:{width:2600,height:130,channels:3,background:'#144069'}}).withMetadata().png().toBuffer();
function fixture(options={}){
 const state={rows:[],uploads:[],removed:[],notifications:0,private:true,allowed:true,epoch:null,failInsert:false,failUpload:false,...options};
 const access={isActive:true,isAdmin:false,authUserId:'subject',displayName:'Signed Learner',email:'',learnerIdentity:profile,courses:[{id:course,title:'Analytics'}],sections:[{id:section,courseId:course,sectionKey:'week8-1',title:'Session 1'}]};
 const blobs=new Map();
 const db={storage:{getBucket:async()=>({data:{public:!state.private},error:null}),createBucket:async()=>({error:null}),from:()=>({upload:async(path,bytes,options)=>{if(state.failUpload)return{error:{message:'Unavailable'}};state.uploads.push({path,bytes,options});blobs.set(path,new Blob([bytes],{type:'image/webp'}));return{error:null};},download:async path=>({data:blobs.get(path),error:null}),remove:async paths=>{if(state.failRemove)return{error:{message:'storage unavailable'}};state.removed.push(...paths);paths.forEach(p=>blobs.delete(p));return{error:null};}})},from:()=>{
  const filters=[];let pending,deleting=false;const q={is(k,v){filters.push(r=>(k==='details->>showcaseActivity'?r.details?.showcaseActivity??null:r[k]??null)===v);return q;},select(){return q;},delete(){deleting=true;return q;},eq(k,v){filters.push(r=>k==='id'?String(r[k])===String(v):r[k]===v);return q;},contains(k,v){filters.push(r=>Object.entries(v).every(([a,b])=>r[k]?.[a]===b));return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},order(){return q;},limit(){return q;},insert(value){pending=value;return q;},single:async()=>{if(state.failInsert)return{error:{message:'write failed'}};const row={...pending,id:state.rows.length+1,created_at:new Date().toISOString()};state.rows.push(row);return{data:row};},maybeSingle:async()=>{const found=state.rows.find(r=>filters.every(f=>f(r)))||null;if(deleting){state.deleteAttempts=(state.deleteAttempts||0)+1;if(state.failDelete)return{error:{message:'delete failed'}};state.rows=state.rows.filter(r=>!filters.every(f=>f(r)));}return{data:found};},then(resolve,reject){return Promise.resolve({data:state.rows.filter(r=>filters.every(f=>f(r)))}).then(resolve,reject);}};return q;
 }};
 const route=load('app/api/sections/[id]/showcase/route.ts',{'@/lib/realtime/publish':{notifyRealtime(){state.notifications++;}},'@/lib/auth/currentUser':{currentUserAccess:async()=>state.access===null?null:state.access||access},'@/lib/supabase/server':{getSupabaseAdmin:()=>db},'@/lib/sectionTermination':{readSectionTermination:async()=>state.epoch},'@/lib/compiledSectionMetadata':{getCompiledSectionMetadata:()=>({showcasePractice:{allowImages:state.images!==false,allowDelete:state.deleteEnabled!==false},showcasePractices:{11:{activityId:"ai-tools-product",title:"AI tools practice",allowImages:state.images!==false,allowDelete:state.deleteEnabled!==false}}})},'@/lib/showcaseImage':images,'@/lib/security/rateLimit':{consumeRateLimit:async identity=>{state.rateIdentity=identity;return{allowed:state.allowed,retry_after:30};}}});
 const request=(file=new File([png],'work.png',{type:'image/png'}))=>{const form=new FormData();form.set('image',file);form.set('name','Impersonator');return new Request(url,{method:'POST',body:form,headers:{origin:'https://lesson.test'}});};
 return{state,access,route,request,blobs};
}

test('image processing verifies decoded format, limits pixels, resizes and strips metadata',async()=>{
 const bytes=await images.prepareShowcaseImage(new File([png],'shot.png',{type:'image/png'})),meta=await sharp(bytes).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.width,2000);assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);assert.ok(bytes.length<1024*1024);
 for(const file of [new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'],'spoof.png',{type:'image/png'}),new File(['not an image'],'x.png',{type:'image/png'}),new File([png],'bad.svg',{type:'image/svg+xml'}),new File([new Uint8Array(4*1024*1024+1)],'big.png',{type:'image/png'})])await assert.rejects(()=>images.prepareShowcaseImage(file));
 const big=await sharp({create:{width:4001,height:4001,channels:3,background:'#fff'}}).png().toBuffer();await assert.rejects(()=>images.prepareShowcaseImage(new File([big],'pixels.png',{type:'image/png'})));
});

test('bounded bodies stop oversized uploads without trusting Content-Length',async()=>{
 const request=new Request(url,{method:'POST',body:new Uint8Array(3000)});await assert.rejects(()=>images.readShowcaseBytes(request,2048),e=>e.status===413);
 await assert.rejects(()=>images.readShowcaseForm(new Request(url,{method:'POST',headers:{'content-length':String(5*1024*1024)},body:'x'})),e=>e.status===413);
});

test('an image shares one durable record and a private, scoped, stable link; report links survive Terminate',async()=>{
 const f=fixture(),response=await f.route.POST(f.request(),context);assert.equal(response.status,200);const data=await response.json();
 assert.equal(data.item.kind,'image');assert.equal(data.item.name,profile.name);assert.equal(f.state.rows.length,1);assert.equal(f.state.notifications,1);assert.equal(f.state.rateIdentity,'showcase:signed-session');
 const row=f.state.rows[0];assert.equal(row.details.sessionId,profile.sessionId);assert.equal(row.details.email,'');assert.equal(row.details.courseId,course);assert.equal(row.details.sectionId,section);assert.equal(row.details.showcaseSession,'initial');
 assert.ok(f.state.uploads[0].path.startsWith(`${course}/${section}/`));assert.equal(f.state.uploads[0].options.upsert,false);assert.equal(f.state.uploads[0].options.contentType,'image/webp');
 const file=await f.route.GET(new Request(data.item.url),context);assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/webp');assert.equal(file.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await file.arrayBuffer()),f.state.uploads[0].bytes);
 const board=await(await f.route.GET(new Request(url),context)).json();assert.equal(board.items.length,1);assert.equal(board.items[0].email,undefined);
 f.state.epoch={id:100,details:{token:'new'}};assert.equal((await(await f.route.GET(new Request(url),context)).json()).items.length,0);assert.equal((await f.route.GET(new Request(data.item.url),context)).status,200);
 f.state.rows=[];assert.equal((await f.route.GET(new Request(data.item.url),context)).status,404,'Reset revokes the image link');
});

test('authorization, role, origin, upload policy and distributed subject limits precede image work',async()=>{
 for(const kind of ['unauthorized','teacher','hidden','disabled','rate','public']){const f=fixture();if(kind==='unauthorized')f.state.access=null;if(kind==='teacher')f.access.sections[0].canFacilitate=true;if(kind==='hidden')f.access.sections[0].hidden=true;if(kind==='disabled')f.state.images=false;if(kind==='rate')f.state.allowed=false;if(kind==='public')f.state.private=false;
  const result=await f.route.POST(f.request(),context);assert.ok([400,403,429,500].includes(result.status),kind);assert.equal(f.state.rows.length,0);assert.equal(f.state.uploads.length,0);assert.equal(f.state.notifications,0);
 }
 const f=fixture(),foreign=f.request();foreign.headers.set('origin','https://attacker.test');assert.equal((await f.route.POST(foreign,context)).status,403);
 assert.equal((await f.route.GET(new Request(`${url}?image=../../etc/passwd`),context)).status,404);
 assert.equal((await f.route.GET(new Request(url),{params:Promise.resolve({id:'another-section'})})).status,403);
});

test('failed durable saves clean up uploaded images and never notify success; changed epochs reject late uploads',async()=>{
 const failed=fixture({failInsert:true});assert.equal((await failed.route.POST(failed.request(),context)).status,500);assert.equal(failed.state.rows.length,0);assert.equal(failed.state.removed.length,1);assert.equal(failed.blobs.size,0);assert.equal(failed.state.notifications,0);
 const stale=fixture();const prepare=images.prepareShowcaseImage; // Switch epoch after upload, before the final durable authorization fence.
 stale.state.failInsert=false;const oldUpload=stale.blobs.set.bind(stale.blobs);stale.blobs.set=(key,value)=>{stale.state.epoch={id:99,details:{token:'ended'}};return oldUpload(key,value);};
 assert.equal((await stale.route.POST(stale.request(),context)).status,409);assert.equal(stale.state.rows.length,0);assert.equal(stale.state.removed.length,1);assert.equal(stale.state.notifications,0);assert.ok(prepare);
});

test('Reset removes only attachments of successfully deleted scoped submissions',async()=>{
 const foreign='961a0a16-0dc0-486e-a501-d965a3f3c7ce',imageId='11111111-1111-4111-8111-111111111111';
 const reset=load('lib/resetLearningScope.ts',{'./courseHierarchy':{},'./reportScopes':{reportScope:row=>row},'./showcaseImage':images}).resetScopedLearningData;
 for(const failDelete of [false,true]){
  let rows=[{id:1,action:'SHOWCASE_SUBMITTED',details:{courseId:course,sectionId:section,imageId}},{id:2,action:'SHOWCASE_SUBMITTED',details:{courseId:course,sectionId:foreign,imageId}}];const removed=[];
  const db={storage:{from:()=>({remove:async paths=>{assert.equal(rows.some(r=>r.id===1),false,'audit deletion precedes storage cleanup');removed.push(...paths);return{error:null};}})},from:table=>{let deleting=false,ids=[];const q={select(){return q;},order(){return q;},in(key,v){if(key==='id')ids=v;return q;},range(){return q;},delete(){deleting=true;return q;},like(){return q;},then(resolve){if(deleting&&table==='access_audit_logs'){if(failDelete)return resolve({error:{message:'denied'}});rows=rows.filter(r=>!ids.includes(r.id));}return resolve({data:table==='access_audit_logs'?rows:[],error:null});}};return q;}};
  const scope={ids:new Set([section]),courses:[],sections:[],legacySections:[]};
  if(failDelete){await assert.rejects(()=>reset(db,scope));assert.equal(removed.length,0);}else{await reset(db,scope);assert.deepEqual(removed,[`${course}/${section}/${imageId}.webp`]);assert.equal(rows.length,1);assert.equal(rows[0].details.sectionId,foreign);}
 }
});

test('the two practices isolate boards while sharing the signed identity and durable image/report path',async()=>{
 const f=fixture();
 assert.equal((await f.route.POST(f.request(),context)).status,200);
 const toolsUrl=`${url}?activity=ai-tools-product`;
 const second=await f.route.POST(new Request(toolsUrl,{method:'POST',headers:{origin:'https://lesson.test','content-type':'application/json'},body:JSON.stringify({url:'https://example.test/my-product',showcaseActivity:'forged'})}),context);
 assert.equal(second.status,200);assert.equal(f.state.rows.length,2);assert.equal(f.state.rows[1].details.showcaseActivity,'ai-tools-product');assert.equal(f.state.rows[1].details.sessionId,profile.sessionId);
 const firstBoard=await(await f.route.GET(new Request(url),context)).json(),secondBoard=await(await f.route.GET(new Request(toolsUrl),context)).json();
 assert.equal(firstBoard.items.length,1);assert.equal(firstBoard.items[0].kind,'image');assert.equal(secondBoard.items.length,1);assert.equal(secondBoard.items[0].url,'https://example.test/my-product');
 const form=new FormData();form.set('image',new File([png],'product.png',{type:'image/png'}));const image=await f.route.POST(new Request(toolsUrl,{method:'POST',headers:{origin:'https://lesson.test'},body:form}),context);assert.equal(image.status,200);
 const saved=(await image.json()).item;assert.equal((await f.route.GET(new Request(saved.url),context)).status,200,'stable image links work without a public activity parameter');
 for(const activity of ['not-registered','11','../escape']){const target=`${url}?activity=${encodeURIComponent(activity)}`;assert.equal((await f.route.GET(new Request(target),context)).status,403);assert.equal((await f.route.POST(new Request(target,{method:'POST',body:'{}'}),context)).status,403);}
});

const deleteRequest=(id='1',activity='')=>new Request(url+(activity?`?activity=${activity}`:''),{method:'DELETE',headers:{origin:'https://lesson.test','content-type':'application/json'},body:JSON.stringify({id})});

test('teacher/admin permanent deletion removes the scoped record, private image and report source; repeats do not succeed',async()=>{
 for(const role of ['teacher','admin'])for(const activity of ['', 'ai-tools-product']){
  const f=fixture(),form=new FormData();form.set('image',new File([png],'work.png',{type:'image/png'}));
  const posted=await f.route.POST(new Request(url+(activity?`?activity=${activity}`:''),{method:'POST',headers:{origin:'https://lesson.test'},body:form}),context);assert.equal(posted.status,200);const work=(await posted.json()).item;
  if(role==='admin')f.access.isAdmin=true;else f.access.sections[0].canFacilitate=true;
  const before=f.state.notifications,response=await f.route.DELETE(deleteRequest(work.id,activity),context);assert.equal(response.status,200);assert.equal((await response.json()).deletedId,work.id);
  assert.equal(f.state.rows.length,0,'the report audit source is physically deleted');assert.equal(f.blobs.size,0);assert.equal(f.state.removed.length,1);assert.equal(f.state.notifications,before+1);assert.equal(f.state.rateIdentity,'showcase-delete:subject');
  assert.equal((await f.route.GET(new Request(work.url),context)).status,404);assert.equal((await f.route.DELETE(deleteRequest(work.id,activity),context)).status,404);assert.equal(f.state.notifications,before+1);
 }
});

test('permanent deletion rejects unauthorized callers, forged scopes and IDs before changing learner data',async()=>{
 const f=fixture();assert.equal((await f.route.POST(f.request(),context)).status,200);const original=f.state.rows[0];
 assert.equal((await f.route.DELETE(deleteRequest(),context)).status,403);f.access.canFacilitate=true;assert.equal((await f.route.DELETE(deleteRequest(),context)).status,403,'global teaching flags cannot grant this section');f.access.sections[0].canFacilitate=true;
 assert.equal((await f.route.DELETE(deleteRequest('1','not-registered'),context)).status,403);
 for(const kind of ['origin','activity','section','disabled','hidden','rate']){
  const request=deleteRequest(),ctx=context;
  if(kind==='origin')request.headers.set('origin','https://attacker.test');if(kind==='activity')f.state.rows[0]={...original,details:{...original.details,showcaseActivity:'ai-tools-product'}};if(kind==='section')f.state.rows[0]={...original,details:{...original.details,sectionId:'961a0a16-0dc0-486e-a501-d965a3f3c7ce'}};if(kind==='disabled')f.state.deleteEnabled=false;if(kind==='hidden')f.access.sections[0].hidden=true;if(kind==='rate')f.state.allowed=false;
  assert.ok([403,404,429].includes((await f.route.DELETE(request,ctx)).status),kind);assert.equal(f.state.rows.length,1);assert.equal(f.state.removed.length,0);assert.equal(f.blobs.size,1);
  f.state.rows[0]=original;f.state.deleteEnabled=true;f.access.sections[0].hidden=false;f.state.allowed=true;
 }
 for(const id of ['0','-1','1 OR true','https://example.test','1'.repeat(21),1])assert.equal((await f.route.DELETE(deleteRequest(id),context)).status,400);
 f.state.rows[0]={...original,course_id:'other-course'};assert.equal((await f.route.DELETE(deleteRequest(),context)).status,404);f.state.rows[0]={...original,action:'QUIZ_COMPLETED'};assert.equal((await f.route.DELETE(deleteRequest(),context)).status,404);f.state.rows[0]=original;
 const large=new Request(url,{method:'DELETE',headers:{origin:'https://lesson.test'},body:'x'.repeat(513)});assert.equal((await f.route.DELETE(large,context)).status,413);assert.equal(f.state.removed.length,0);
});

test('storage/database deletion failures remain retryable and never publish false success',async()=>{
 for(const stage of ['failRemove','failDelete']){
  const f=fixture();await f.route.POST(f.request(),context);f.access.sections[0].canFacilitate=true;f.state[stage]=true;const before=f.state.notifications;
  const response=await f.route.DELETE(deleteRequest(),context);assert.equal(response.status,500);assert.equal(f.state.rows.length,1,'retain the exact record for an authorized retry');assert.equal(f.state.notifications,before);if(stage==='failRemove'){assert.equal(f.blobs.size,1);assert.equal(f.state.deleteAttempts,undefined);}else assert.equal(f.blobs.size,0);
  f.state[stage]=false;assert.equal((await f.route.DELETE(deleteRequest(),context)).status,200);assert.equal(f.state.rows.length,0);assert.equal(f.blobs.size,0);assert.equal(f.state.notifications,before+1);
 }
 const f=fixture();await f.route.POST(new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'https://example.test/result'})}),context);f.access.sections[0].canFacilitate=true;assert.equal((await f.route.DELETE(deleteRequest(),context)).status,200);assert.equal(f.state.removed.length,0,'links do not delete storage objects');
});
