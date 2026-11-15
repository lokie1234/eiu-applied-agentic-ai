import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './helpers/mis301-fixture.mjs';
const protocol=loadTS('lib/livePresentationProtocol.ts');
const row={owner:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa',active:true,topic:'secret',expires_at:new Date(Date.now()+120000).toISOString(),sequence:10,document_sequence:8,revision:3,updated_at:new Date().toISOString(),document:'large document'};
function fixture(){const selects=[],calls=[];const db={from:()=>({select(columns){selects.push(columns);return {eq(){return this;},async maybeSingle(){return {data:Object.fromEntries(columns.split(',').map(k=>[k,row[k]]))};}};}}),async rpc(name,args){calls.push({name,args});return {data:row};}};const api=loadTS('lib/livePresentationState.ts',{'./supabase/server':{getSupabaseAdmin:()=>db},'./livePresentationBackup':{liveBackup:async()=>null},'./livePresentationProtocol':protocol},{process:{env:{PASSCODE_SESSION_SECRET:'test-only'}}});return {api,selects,calls};}
test('status/unchanged revision/received frame reads never select the heavy snapshot column',async()=>{
 for(const options of [{status:true},{epoch:row.epoch,since:3},{epoch:row.epoch,after:8}]){const f=fixture();const r=await f.api.readLiveState('section',options);assert.equal(r.document,undefined);assert.equal(f.selects.length,1);assert.ok(!f.selects[0].split(',').includes('document'));}
 const f=fixture();assert.equal((await f.api.readLiveState('section',{epoch:row.epoch,since:2,after:5})).document,'large document');assert.equal(f.selects.length,2);
});
test('heartbeat uses a null document; full checkpoints are validated before any database write',async()=>{
 const f=fixture(),input={deviceId:row.owner,epoch:row.epoch,sequence:11,documentSequence:8};await f.api.saveLiveState('section','heartbeat',input);assert.equal(f.calls[0].args.p_document,null);assert.match(f.calls[0].args.p_topic,/^eiu-live-v2:[a-f0-9]{64}$/);
 await assert.rejects(()=>f.api.saveLiveState('section','update',{...input,document:'{"bad":true}'}));assert.equal(f.calls.length,1);
});
