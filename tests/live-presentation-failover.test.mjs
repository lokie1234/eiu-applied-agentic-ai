import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS,deferred} from './helpers/mis301-fixture.mjs';
const protocol=loadTS('lib/livePresentationProtocol.ts'),dom=loadTS('lib/livePresentationDom.ts');
const args={sectionId:'section',deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'};
const state=text=>({root:1,width:960,height:540,page:1,nodes:[{id:1,tag:'div',children:[2]},{id:2,tag:'#text',text}]});
function fixture(){
 let fail=false,rejectStop=false,held;const calls=[],publications=[],storage={room:null};
 const fakeFetch=async(url,options={})=>{
  if(fail)return {ok:false,json:async()=>({message:'Supabase unavailable'})};
  if(options.method!=='POST')return {ok:true,json:async()=>({room:storage.room})};
  const b=JSON.parse(options.body);calls.push(b);
  if(rejectStop&&b.action==='stop')return {ok:false,json:async()=>({message:'Stop unavailable'})};
  if(b.action==='start')storage.room={owner:b.deviceId,epoch:b.epoch,active:true,sequence:0,documentSequence:0,revision:0,document:''};
  if(b.action==='update'){if(held)await held.promise;storage.room={...storage.room,document:b.document,sequence:b.sequence,documentSequence:b.documentSequence,revision:storage.room.revision+1};}
  if(b.action==='heartbeat')storage.room={...storage.room,sequence:b.sequence};
  if(b.action==='stop')storage.room=null;
  return {ok:true,json:async()=>({room:storage.room})};
 };
 const api=loadTS('lib/livePresentationTransport.ts',{'./livePresentationDom':dom,'./livePresentationProtocol':protocol,'./livePresentationRealtime':{primeLiveRoom(){},publishLiveDocument(...a){publications.push(a);},endLiveBroadcast(){},readLiveBackup:async()=>storage.room}},{fetch:fakeFetch});
 return {api,calls,publications,storage,fail:v=>fail=v,failStop:v=>rejectStop=v,hold:()=>held=deferred()};
}
test('Live publishes immediately, coalesces captures into one checkpoint, and sends document-free heartbeats',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);
 for(let i=0;i<30;i++)f.api.stageLiveDocument(args.epoch,state('capture '+i));
 assert.equal(f.calls.length,1,'visual captures must not call the database');assert.equal(f.publications.length,30);
 await f.api.liveCommand('update',{...args,patch:''});assert.equal(f.calls.filter(c=>c.action==='update').length,1);assert.match(f.storage.room.document,/capture 29/);
 const seq=f.storage.room.documentSequence;await f.api.liveCommand('update',{...args,patch:''});const last=f.calls.at(-1);assert.equal(last.action,'heartbeat');assert.equal(last.document,undefined);assert.equal(f.storage.room.documentSequence,seq);
 f.api.stageLiveDocument(args.epoch,state('capture 29'));await f.api.liveCommand('update',{...args,patch:''});assert.equal(f.calls.at(-1).action,'heartbeat');await f.api.liveCommand('stop',args);
});
test('Supabase failure leaves immediate broadcasting operational and retries the newest checkpoint',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);f.fail(true);f.api.stageLiveDocument(args.epoch,state('old'));await assert.rejects(()=>f.api.liveCommand('update',{...args,patch:''}));
 f.api.stageLiveDocument(args.epoch,state('newest'));assert.equal(f.publications.at(-1).at(-1).nodes[1].text,'newest');f.fail(false);await f.api.liveCommand('update',{...args,patch:''});assert.match(f.storage.room.document,/newest/);await f.api.liveCommand('stop',args);
});
test('an older in-flight checkpoint cannot mark a newer capture clean',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);f.api.stageLiveDocument(args.epoch,state('old'));const hold=f.hold(),job=f.api.liveCommand('update',{...args,patch:''});await new Promise(r=>setImmediate(r));f.api.stageLiveDocument(args.epoch,state('new'));hold.resolve();await job;
 await f.api.liveCommand('update',{...args,patch:''});assert.match(f.storage.room.document,/new/);await f.api.liveCommand('stop',args);
});
test('admin recovery releases the known lease and reports a failed release accurately',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);f.failStop(true);await assert.rejects(()=>f.api.endLiveSession(args.sectionId));assert.ok(f.storage.room);f.failStop(false);await f.api.endLiveSession(args.sectionId);assert.equal(f.storage.room,null);
});
