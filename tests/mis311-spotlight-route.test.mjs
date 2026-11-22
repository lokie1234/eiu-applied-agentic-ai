import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTS } from './helpers/mis301-fixture.mjs';
const common=loadTS('lib/mis311Spotlight.ts'),sectionId=common.MIS311_SPOTLIGHT_SECTION_ID,courseId=common.MIS311_SPOTLIGHT_COURSE_ID;
function fixture(options={}){
  const targetId=options.sectionId||sectionId;
  let role='teacher',enabled=true,email='real@example.com',stale=0,business=null,queries=0;const calls=[];
  const snapshot={ready:true,teaching:true,viewerSubject:'teacher',epoch:'epoch',draws:[],members:[]};
  const access=()=>role==='none'?null:{isActive:true,isAdmin:options.admin??role==='teacher',authUserId:role,email,learnerIdentity:{information:{name:'An'}},sections:[{id:targetId,courseId,canFacilitate:role==='teacher',...(options.wheelEnabled===undefined?{}:{wheelEnabled:options.wheelEnabled})}],courses:[{id:courseId}]};
  const route=loadTS('app/api/sections/[id]/spotlight/route.ts',{
    'convex/browser':{ConvexHttpClient:class{setAuth(){}async query(name){queries++;if(!enabled)throw Error('offline');return name==='spotlight:settings'?{count:options.count||1}:snapshot;}async mutation(name,args){calls.push(args);if(stale>0){stale--;return {code:'STALE_CLASSROOM',message:'Session changed'};}if(business)return business;if(name==='spotlight:configure')return {count:args.count};return {requestId:args.requestId,subject:'real-session',username:'Real learner',revealAt:5000,members:[{id:'real-session',username:'Real learner'}]};}}},
    'convex/server':{makeFunctionReference:n=>n},'@/lib/auth/currentUser':{currentUserAccess:async()=>access()},
    '@/lib/sectionTermination':{readSectionTermination:async()=>({details:{token:'epoch'}})},'@/lib/realtime/server':{mintRealtimeToken:()=>'',realtimeConfigured:()=>true},
    '@/lib/security/wheelResetPassword':{verifyWheelResetPassword:async password=>password==='valid-test'},
    '@/lib/security/rateLimit':{consumeRateLimit:async()=>({allowed:!options.rateLimited,retry_after:120})},
    '@/lib/resetSectionWheel':{resetSectionWheel:async args=>{calls.push({reset:args});return {success:true,resetAt:Date.now(),count:1};}},
    '@/lib/realtime/classroom':{spotlightScope:{courseId,sectionId},publishClassroom:async()=>{calls.push('roster');},classroomSnapshot:async()=>({members:[{subject:'real-session',username:'Real learner'}]})},'@/lib/mis311Spotlight':common,
  },{process:{env:{NEXT_PUBLIC_CONVEX_URL:'https://example.convex.cloud'}}});
  const context={params:Promise.resolve({id:targetId})};
  return {route,context,calls,queries:()=>queries,stale:n=>{stale=n;},business:value=>{business=value;},role:r=>{role=r;},email:value=>{email=value;},offline:()=>{enabled=false;},post:body=>route.POST(new Request('http://localhost/spotlight',{method:'POST',body:JSON.stringify(body)}),context)};
}

test('generic enabled sections use their own scope and settings have no arbitrary selection ceiling',async()=>{
  const id='6cc3a1a7-b931-4934-8c53-f2f7d3478852',f=fixture({sectionId:id,wheelEnabled:true,count:250,admin:false});
  const settings=await f.route.GET(new Request('http://localhost/spotlight?settings=1'),f.context);assert.equal(settings.status,200);assert.equal((await settings.json()).count,250);
  const saved=await f.route.PUT(new Request('http://localhost/spotlight',{method:'PUT',body:JSON.stringify({count:1000000,epoch:'epoch'})}),f.context);assert.equal(saved.status,200);assert.equal(f.calls[0].sectionId,id);assert.equal(f.calls[0].count,1000000);
  assert.equal((await f.post({slide:0,epoch:'epoch',requestId:crypto.randomUUID()})).status,200);assert.equal(f.calls.at(-1).sectionId,id);
  f.role('learner');assert.equal((await f.route.GET(new Request('http://localhost/spotlight?settings=1'),f.context)).status,403);assert.equal((await f.route.PUT(new Request('http://localhost/spotlight',{method:'PUT',body:JSON.stringify({count:2,epoch:'epoch'})}),f.context)).status,403);
  const disabled=fixture({sectionId:id,wheelEnabled:false});assert.equal((await disabled.post({slide:0,epoch:'epoch',requestId:crypto.randomUUID()})).status,403);assert.equal(disabled.calls.length,0);
});

test('target settings only accept bounded session IDs from teaching and pass them to the authorized mutation',async()=>{
 const f=fixture(),save=targetSubjects=>f.route.PUT(new Request('http://localhost/spotlight',{method:'PUT',body:JSON.stringify({count:3,epoch:'epoch',targetSubjects})}),f.context);
 for(const bad of ['name',['same','same'],[null],['a'.repeat(201)],Array.from({length:1201},(_,i)=>String(i))])assert.equal((await save(bad)).status,400);
 assert.equal(f.calls.length,0);assert.equal((await save(['session-a','session-b'])).status,200);assert.deepEqual(Array.from(f.calls[0].targetSubjects),['session-a','session-b']);
 f.role('learner');assert.equal((await save(['session-a'])).status,403);assert.equal((await f.route.GET(new Request('http://localhost/spotlight?settings=1'),f.context)).status,403);
});
test('the API checks access and scope and starts a ready classroom draw without rebuilding or rereading its roster',async()=>{
  const f=fixture(),body={slide:5,epoch:'epoch',requestId:crypto.randomUUID(),subject:'forged',username:'Forged'};
  f.role('learner');assert.equal((await f.post(body)).status,403);assert.equal(f.calls.length,0);
  f.role('teacher');assert.equal((await f.post({...body,epoch:'stale'})).status,409);assert.equal((await f.post({...body,slide:6})).status,400);
  assert.equal((await f.post(null)).status,400);
  const response=await f.post(body);assert.equal(response.status,200);assert.equal(f.calls.length,1);assert.equal(f.calls[0].subject,undefined);assert.equal(f.calls[0].username,undefined);assert.equal((await response.json()).draw.subject,'real-session');assert.equal(f.queries(),0);
});
test('the case study on slide 10 uses the authorized shared draw endpoint',async()=>{
  const f=fixture(),body={slide:10,epoch:'epoch',requestId:crypto.randomUUID()};
  const response=await f.post(body);assert.equal(response.status,200);assert.equal(f.calls[0].slide,10);
  f.role('learner');assert.equal((await f.post({...body,requestId:crypto.randomUUID()})).status,403);assert.equal(f.calls.length,1);
});

test('a stale classroom is refreshed at most once, retrying the identical request instead of starting another round',async()=>{
  for(const stale of [1,2]){
    const f=fixture();f.stale(stale);const requestId=crypto.randomUUID();const response=await f.post({slide:5,epoch:'epoch',requestId});
    assert.equal(response.status,stale===1?200:409);assert.equal(f.calls.filter(c=>c==='roster').length,1);
    assert.deepEqual(f.calls.filter(c=>c!=='roster').map(c=>c.requestId),[requestId,requestId]);
  }
});
test('busy or empty draws return actionable errors without a roster rebuild or retry loop',async()=>{
  for(const code of ['DRAW_BUSY','NO_LEARNERS']){const f=fixture();f.business({code,message:'Please wait'});const response=await f.post({slide:5,epoch:'epoch',requestId:crypto.randomUUID()});assert.equal(response.status,409);assert.equal((await response.json()).code,code);assert.equal(f.calls.length,1);assert.equal(f.queries(),0);}
});
test('context checks do not fetch a redundant Convex snapshot',async()=>{
  const f=fixture();const response=await f.route.GET(new Request('http://localhost/spotlight?context=1'),f.context);const data=await response.json();
  assert.equal(data.teaching,true);assert.equal(data.viewerSubject,'teacher');assert.equal(data.snapshot,undefined);assert.equal(f.queries(),0);
});

test('teaching prepare synchronizes the scoped classroom before returning its roster; learners cannot trigger it',async()=>{
 const f=fixture();const response=await f.route.GET(new Request('http://localhost/spotlight?prepare=1'),f.context);
 assert.equal(response.status,200);assert.deepEqual(f.calls,['roster']);assert.equal(f.queries(),1);assert.equal((await response.json()).snapshot.ready,true);
 f.role('learner');await f.route.GET(new Request('http://localhost/spotlight?prepare=1'),f.context);assert.deepEqual(f.calls,['roster']);
});

test('wheel reset checks teaching, origin, rate, password and epoch before passing the checkbox to its scoped reset',async()=>{
 const f=fixture(),body={password:'valid-test',epoch:'epoch',requestId:crypto.randomUUID(),clearNames:true};
 const reset=(value=body,headers={})=>f.route.DELETE(new Request('http://localhost/spotlight',{method:'DELETE',headers,body:JSON.stringify(value)}),f.context);
 f.role('learner');assert.equal((await reset()).status,403);f.role('teacher');
 assert.equal((await reset(body,{origin:'https://other.test'})).status,403);
 assert.equal((await reset({...body,password:'wrong'})).status,401);
 assert.equal((await reset({...body,clearNames:'yes'})).status,400);
 assert.equal((await reset({...body,epoch:'old'})).status,409);assert.equal(f.calls.length,0);
 assert.equal((await reset()).status,200);assert.equal(f.calls[0].reset.clearNames,true);assert.equal(f.calls[0].reset.sectionId,sectionId);assert.equal(f.calls[0].reset.password,undefined);
 const limited=fixture({rateLimited:true});assert.equal((await limited.route.DELETE(new Request('http://localhost/spotlight',{method:'DELETE',body:JSON.stringify(body)}),limited.context)).status,429);assert.equal(limited.calls.length,0);
});
test('a named classroom requires a name but does not force email when the global form is disabled',async()=>{
  const policy=loadTS('lib/learningIdentity.ts');
  const scope={sections:[{id:sectionId,course_id:courseId,section_key:'mis311-week7-session2'}],courses:[{id:courseId}]};
  const route=loadTS('app/api/auth/access/route.ts',{
    'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status||200,cookies:{set(){}}})}},
    '@/lib/supabase/server':{getSupabaseAdmin:()=>({})},'@/lib/auth/courseAccessStorage':{getCoursesAndSectionsData:async()=>({learningIdentityPolicy:{enabled:false,fields:[]}})},
    '@/lib/auth/passcodes':{hashPasscode:()=>'',resolvePasscode:()=>scope},'@/lib/auth/session':{},'@/lib/learningIdentity':policy,
    '@/lib/mis301Practice':{MIS301_SECTION_ID:'mis301'},'@/lib/mis311Spotlight':common,
  });
  const response=await route.POST(new Request('http://localhost/auth',{method:'POST',body:JSON.stringify({passcode:'ABCD'})}));
  assert.equal(response.data.requiresInformation,true);assert.deepEqual(Array.from(response.data.fields,f=>f.id),['name']);
});
test('MIS 301 and MIS 311 honor name-only settings and only validate email when it is configured',async()=>{
  const policy=loadTS('lib/learningIdentity.ts');
  for(const id of ['mis301',sectionId])for(const collectEmail of [false,true]){
    const logs=[];const fields=[{id:'name',label:'Name',type:'text'},...(collectEmail?[{id:'email',label:'Email',type:'email'}]:[])];
    const scope={sections:[{id,course_id:courseId,section_key:'section'}],courses:[{id:courseId}]};
    const query={insert(row){logs.push(row);return this;},select(){return this;},async single(){return {data:{id:1},error:null};}};
    const route=loadTS('app/api/auth/access/route.ts',{
      'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status||200,cookies:{set(){}}})}},
      '@/lib/supabase/server':{getSupabaseAdmin:()=>({from:()=>query})},'@/lib/auth/courseAccessStorage':{getCoursesAndSectionsData:async()=>({learningIdentityPolicy:{enabled:true,fields}})},
      '@/lib/auth/passcodes':{hashPasscode:()=>'',resolvePasscode:()=>scope},'@/lib/auth/session':{createAccessSession:()=>'',sessionCookieOptions:()=>({})},'@/lib/learningIdentity':policy,
      '@/lib/mis301Practice':{MIS301_SECTION_ID:'mis301'},'@/lib/mis311Spotlight':common,
    });
    const request=information=>new Request('http://localhost/auth',{method:'POST',body:JSON.stringify({passcode:'ABCD',...(information?{information}:{})})});
    const form=await route.POST(request());assert.deepEqual(Array.from(form.data.fields,f=>f.id),fields.map(f=>f.id));assert.equal(form.data.fields[0].label,'Name');
    if(collectEmail){assert.equal((await route.POST(request({name:'An'}))).status,400);assert.equal((await route.POST(request({name:'An',email:'bad'}))).status,400);}
    const response=await route.POST(request({name:'An',email:collectEmail?'an@example.com':'ignored@example.com'}));
    assert.equal(response.data.success,true);assert.equal(logs[0].details.information.name,'An');
    if(collectEmail)assert.equal(logs[0].details.email,'an@example.com');
    else{assert.equal(logs[0].details.information.email,undefined);assert.match(logs[0].details.email,/@passcode\.eiu$/);assert.deepEqual(Array.from(logs[0].details.fields,f=>f.id),['name']);}
  }
});
test('a named learner without a collected email can access the spotlight API',async()=>{
  const f=fixture();f.role('learner');f.email('signed-session@passcode.eiu');
  assert.equal((await f.route.GET(new Request('http://localhost/spotlight'),f.context)).status,200);
});
test('the shared MIS 311 roster reads only existing entry identities and never practice-answer storage',async()=>{
  const calls=[],rows=[{details:{sessionId:'new-session',email:'AN@example.com',information:{name:'An'}}},{details:{sessionId:'old-session',email:'an@example.com',information:{name:'An'}}},{details:{sessionId:'anonymous',email:'anonymous@passcode.eiu',name:'Anonymous'}}];
  const query={select(){return this;},eq(){return this;},contains(_,scope){calls.push(scope);return this;},gte(){return this;},lte(){return this;},order(){return this;},limit(){return this;},async maybeSingle(){return {data:null,error:null};},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve);}};
  let reads=0;
  const projection=loadTS('lib/realtime/classroom.ts',{'@/lib/auth/courseAccessStorage':{getCoursesAndSectionsData:async()=>({courses:[],sections:[]})},'next/server':{after(){}},'@/lib/supabase/server':{getSupabaseAdmin:()=>({from(){reads++;return query;}})},'@/lib/mis301Practice':{MIS301_SECTION_ID:'mis301',MIS301_COURSE_ID:'course301',mis301Part:()=>false},'@/lib/sectionTermination':{readSectionTermination:async()=>null},'./server':{realtimeConfigured:()=>true},'@/lib/mis311Spotlight':common});
  const snapshot=await projection.classroomSnapshot(undefined,projection.spotlightScope);
  assert.equal(reads,2);assert.equal(calls[0].sectionId,sectionId);assert.deepEqual(Array.from(snapshot.members,m=>m.subject),['new-session','old-session'],'shared email must not merge two signed sessions');assert.deepEqual(Array.from(snapshot.answers),[]);
});
test('name-only learners stay eligible in both rosters without merging distinct sessions by their name',async()=>{
  const rows=[{details:{sessionId:'one',email:'one@passcode.eiu',information:{name:'An'}}},{details:{sessionId:'one',email:'one@passcode.eiu',information:{name:'An'}}},{details:{sessionId:'two',information:{name:'An'}}},{details:{sessionId:'anonymous',email:'anonymous@passcode.eiu',name:'Learner anonymous'}}];
  const projection=loadTS('lib/realtime/classroom.ts',{'@/lib/auth/courseAccessStorage':{getCoursesAndSectionsData:async()=>({courses:[],sections:[]})},'next/server':{after(){}},'@/lib/supabase/server':{getSupabaseAdmin:()=>({from(){let action;return {select(){return this;},eq(_,value){action=value;return this;},contains(){return this;},gte(){return this;},lte(){return this;},order(){return this;},limit(){return this;},async maybeSingle(){return {data:null,error:null};},then(resolve){return Promise.resolve({data:action==='SECTION_OPENED'?rows:[],error:null}).then(resolve);}};}})},'@/lib/mis301Practice':{MIS301_SECTION_ID:'mis301',MIS301_COURSE_ID:'course301',mis301Part:()=>false},'@/lib/sectionTermination':{readSectionTermination:async()=>null},'./server':{realtimeConfigured:()=>true},'@/lib/mis311Spotlight':common});
  for(const scope of [undefined,projection.spotlightScope]){
    const snapshot=await projection.classroomSnapshot(undefined,scope);
    assert.deepEqual(Array.from(snapshot.members,m=>m.subject),['one','two']);assert.equal(snapshot.members[0].username,snapshot.members[1].username);
  }
});
test('MIS 301 accepts a named signed session without email for assigned practice reads and submissions',async()=>{
  const practice=loadTS('lib/mis301Practice.ts'),id=practice.MIS301_SECTION_ID,course=practice.MIS301_COURSE_ID;
  let saved,identity={sessionId:'learner',name:'An',email:'learner@passcode.eiu',information:{name:'An'}};
  const query={select(){return this;},eq(){return this;},contains(){return this;},gt(){return this;},limit(){return this;},async maybeSingle(){return {data:null,error:null};},insert(row){saved=row;return this;},async single(){return {data:{id:1,created_at:new Date().toISOString()},error:null};}};
  const route=loadTS('app/api/sections/[id]/practice/route.ts',{
    'next/server':{NextResponse:{json:(value,options)=>Response.json(value,options)}},'@/lib/auth/currentUser':{currentUserAccess:async()=>({isActive:true,isAdmin:false,learnerIdentity:identity,sections:[{id,courseId:course}],courses:[{id:course}]})},
    '@/lib/supabase/server':{getSupabaseAdmin:()=>({from:()=>query})},'@/lib/sectionTermination':{readSectionTermination:async()=>null},'@/lib/realtime/publish':{notifyRealtime(){}},'@/lib/realtime/classroom':{notifyClassroom(){},notifyClassroomAnswer(){}},'@/lib/mis301Practice':practice,
    '@/lib/mis301Assignment':{readPracticeAssignment:async()=>({question:4,part:4,drawId:'draw',createdAt:1})},
  });
  const context={params:Promise.resolve({id})};
  assert.equal((await route.GET(new Request('http://localhost/practice?context=1'),context)).status,200);
  const response=await route.POST(new Request('http://localhost/practice',{method:'POST',body:JSON.stringify({partId:'scores',submissionId:crypto.randomUUID(),practiceSession:'initial',drawId:'draw',values:{mean:'5.47',code:'df.describe()'}})}),context);
  assert.equal(response.status,200);assert.equal(saved.details.sessionId,'learner');assert.equal(saved.details.name,'An');
  identity={...identity,information:{}};assert.equal((await route.GET(new Request('http://localhost/practice?context=1'),context)).status,403);
});
test('HTTP reads preserve the Supabase identity fallback and never invent a draw during an outage',async()=>{
  const f=fixture();f.offline();const response=await f.route.GET(new Request('http://localhost/spotlight'),f.context),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.snapshot.ready,false);assert.equal(data.snapshot.members[0].username,'Real learner');assert.deepEqual(data.snapshot.draws,[]);
  f.role('learner');const privateData=await (await f.route.GET(new Request('http://localhost/spotlight'),f.context)).json();assert.deepEqual(privateData.snapshot.members,[]);
  f.role('none');assert.equal((await f.route.GET(new Request('http://localhost/spotlight'),f.context)).status,403);
});
test('a committed draw returns its animation labels without a second Convex query',async()=>{
  const f=fixture();f.offline();const response=await f.post({slide:8,epoch:'epoch',requestId:crypto.randomUUID()});
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.draw.subject,'real-session');assert.equal(data.members[0].id,'real-session');assert.equal(f.queries(),0);
});
