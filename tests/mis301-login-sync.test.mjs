import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS,practice} from './helpers/mis301-fixture.mjs';

test('Section entry publishes names immediately and schedules existing reconciliation on failure',async()=>{
 for(const fail of [false,true]){
 const tasks=[],requests=[];
 const query={select(){return this;},eq(){return this;},contains(){return this;},gte(){return this;},lte(){return this;},order(){return this;},async limit(){return {data:[],error:null};}};
 const classroom=loadTS('lib/realtime/classroom.ts',{
 '@/lib/mis301Practice':practice,
 'next/server':{after:task=>tasks.push(task)},'@/lib/supabase/server':{getSupabaseAdmin:()=>({from:()=>query})},
 '@/lib/sectionTermination':{readSectionTermination:async()=>null},'./server':{realtimeConfigured:()=>true}
 },{process:{env:{CONVEX_SITE_URL:'https://example.convex.site',REALTIME_BRIDGE_SECRET:'test'}},fetch:async(url,options)=>{requests.push({url,options});return {ok:!fail};}});
 await classroom.syncClassroomEntry();
 assert.equal(requests.length,1);assert.match(requests[0].url,/\/classroom$/);
 assert.equal(JSON.parse(requests[0].options.body).epoch,'initial');
 assert.equal(requests[0].options.signal.aborted,false);
 assert.equal(tasks.length,fail?1:0);
 }
});
