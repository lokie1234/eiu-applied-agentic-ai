import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTS} from './helpers/mis301-fixture.mjs';

test('server password verifier accepts the requested confirmation and never ships it through the client',async()=>{
 const api=loadTS('lib/security/wheelResetPassword.ts',{}, {process:{env:{}}});
 const password=fs.readFileSync('app/api/admin/reset/route.ts','utf8').match(/const RESET_CONFIRMATION = "([^"]+)"/)[1];
 assert.equal(await api.verifyWheelResetPassword(password),true);assert.equal(await api.verifyWheelResetPassword('wrong'),false);assert.equal(await api.verifyWheelResetPassword(null),false);
 assert.ok(!fs.readFileSync('components/deck/SectionSpotlight.tsx','utf8').includes(password));assert.ok(!fs.readFileSync('lib/security/wheelResetPassword.ts','utf8').includes(password));
});

test('the reset bridge rejects unauthenticated calls before invoking its internal mutation',async()=>{
 const routes=[],calls=[],router={route:route=>routes.push(route)};
 loadTS('convex/http.ts',{'convex/server':{httpRouter:()=>router,httpActionGeneric:fn=>fn,makeFunctionReference:name=>name}},{process:{env:{EIU_REALTIME_BRIDGE_SECRET:'bridge-fixture'}}});
 const route=routes.find(route=>route.path==='/classroom/wheel-reset'),ctx={runMutation:async(...args)=>{calls.push(args);return {success:true};}};
 assert.equal((await route.handler(ctx,new Request('http://test/classroom/wheel-reset',{method:'POST',body:'{}'}))).status,403);assert.equal(calls.length,0);
 const payload={sectionId:'section',epoch:'epoch',requestId:crypto.randomUUID(),requestedAt:1,clearNames:true};
 assert.equal((await route.handler(ctx,new Request('http://test/classroom/wheel-reset',{method:'POST',headers:{authorization:'Bearer bridge-fixture'},body:JSON.stringify(payload)}))).status,200);assert.equal(calls[0][0],'spotlight:resetWheel');assert.equal(calls[0][1].clearNames,true);
});

test('reset persists one intent before notifying Convex, retries ambiguities and never acknowledges failed writes',async()=>{
 const rows=[],calls=[];let failBridge=true,failAudit=false,failComplete=false;
 const db={from(){let patch,identity,id;const query={select(){return this;},eq(key,value){if(key==='id')id=value;return this;},contains(_,value){identity=value;return this;},order(){return this;},limit(){return this;},insert(value){patch=value;return this;},update(value){patch=value;return this;},async maybeSingle(){return {data:rows.find(row=>Object.entries(identity).every(([key,value])=>row.details[key]===value))||null,error:null};},async single(){calls.push('audit');if(failAudit)return {error:Error('audit failed')};const row={id:rows.length+1,...patch};rows.push(row);return {data:row,error:null};},then(resolve){if(failComplete)return Promise.resolve({error:Error('completion failed')}).then(resolve);Object.assign(rows.find(row=>row.id===id),patch);return Promise.resolve({error:null}).then(resolve);}};return query;}};
 const api=loadTS('lib/resetSectionWheel.ts',{'@/lib/supabase/server':{getSupabaseAdmin:()=>db}},{process:{env:{CONVEX_SITE_URL:'https://test',REALTIME_BRIDGE_SECRET:'bridge'}},fetch:async(_,options)=>{calls.push('bridge');const body=JSON.parse(options.body);assert.equal(body.clearNames,true);return failBridge?Response.json({}, {status:503}):Response.json({success:true,count:1,resetAt:Date.now()});}});
 const scope={courseId:'course',sectionId:'section',epoch:'epoch',actorSubject:'teacher',requestId:crypto.randomUUID(),clearNames:true};
 await assert.rejects(()=>api.resetSectionWheel(scope));assert.deepEqual(calls,['audit','bridge']);assert.equal(rows[0].details.status,'requested');
 failBridge=false;failComplete=true;await assert.rejects(()=>api.resetSectionWheel(scope));assert.equal(rows.length,1);assert.equal(rows[0].details.status,'requested');
 failComplete=false;assert.equal((await api.resetSectionWheel(scope)).success,true);assert.equal(rows[0].details.status,'completed');const count=calls.length;await api.resetSectionWheel(scope);assert.equal(calls.length,count,'completed retries do not reset another draw');
 failAudit=true;await assert.rejects(()=>api.resetSectionWheel({...scope,requestId:crypto.randomUUID()}));assert.equal(calls.at(-1),'audit');assert.equal(rows[0].details.password,undefined);
});

test('cleared names stay absent through reconciliation and return only after a new section entry',async()=>{
 const cutoff=Date.now()-1000,epoch='epoch',courseId='course',sectionId='section',entries=[{created_at:new Date(cutoff-10).toISOString(),details:{sessionId:'old',information:{name:'King'}}},{created_at:new Date(cutoff+10).toISOString(),details:{sessionId:'new',information:{name:'Son'}}}];let deletes=0;
 const projection=loadTS('lib/realtime/classroom.ts',{'@/lib/auth/courseAccessStorage':{},'next/server':{after(){}},'@/lib/supabase/server':{getSupabaseAdmin:()=>({from(){let action,since;const q={select(){return this;},eq(_,value){action=value;return this;},contains(_,value){if(action==='WHEEL_RESET')assert.deepEqual(Object.keys(value).sort(),['clearNames','courseId','sectionId']);return this;},order(){return this;},limit(){return this;},gte(_,value){since=value;return this;},lte(){return this;},delete(){deletes++;return this;},async maybeSingle(){return {data:{details:{requestedAt:cutoff,epoch}},error:null};},then(resolve){return Promise.resolve({data:entries.filter(row=>row.created_at>=since),error:null}).then(resolve);}};return q;}})},'@/lib/mis301Practice':{MIS301_SECTION_ID:'mis301',MIS301_COURSE_ID:'course301',mis301Part:()=>false},'@/lib/sectionTermination':{readSectionTermination:async()=>({details:{token:epoch},created_at:new Date(cutoff-1000).toISOString()})},'./server':{realtimeConfigured:()=>true},'@/lib/mis311Spotlight':{MIS311_SPOTLIGHT_SECTION_ID:'mis311',MIS311_SPOTLIGHT_COURSE_ID:'course311'}});
 const scope={courseId,sectionId,wheelEnabled:true};assert.deepEqual(Array.from((await projection.classroomSnapshot(undefined,scope)).members,member=>member.username),['Son']);
 entries.push({created_at:new Date(cutoff+20).toISOString(),details:{sessionId:'old',information:{name:'King'}}});assert.deepEqual(Array.from((await projection.classroomSnapshot(undefined,scope)).members,member=>member.username),['Son','King']);assert.equal(deletes,0,'reset names must not delete learning/report history');
});
