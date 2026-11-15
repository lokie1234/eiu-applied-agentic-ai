import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './helpers/mis301-fixture.mjs';
const protocol=loadTS('lib/livePresentationProtocol.ts');
function fixture(){let convex=true,supabase=true,rejectStop=false;const calls=[],storage={room:null};const fakeFetch=async(url,options={})=>{
 if(!supabase)return {ok:false,json:async()=>({message:'Supabase unavailable'})};
 if(options.method==='POST'){const b=JSON.parse(options.body);if(rejectStop&&b.action==='stop')return {ok:false,json:async()=>({message:'Stop unavailable'})};calls.push({provider:'supabase',...b});if(b.action==='start')storage.room={owner:b.deviceId,epoch:b.epoch,document:'',revision:0,sequence:0,active:true,updatedAt:Date.now()};if(b.action==='update')storage.room={...storage.room,document:b.document,sequence:b.sequence,revision:storage.room.revision+1,updatedAt:Date.now()};if(b.action==='stop')storage.room=null;return {ok:true,json:async()=>({revision:storage.room?.revision||0})};}
 return {ok:true,json:async()=>({room:storage.room})};
 };const api=loadTS('lib/livePresentationTransport.ts',{'./realtime/client':{readLiveRoom:async()=>storage.room,realtimeReady:()=>convex,livePresentationCommand:async(action,args)=>{if(!convex)throw Error('Convex disconnected');calls.push({provider:'convex',action,...args});return {revision:calls.length};}},'./livePresentationProtocol':protocol},{fetch:fakeFetch});return {api,calls,storage,convex:v=>convex=v,supabase:v=>supabase=v,failStop:v=>rejectStop=v};}
const args={sectionId:'section',deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'};
const patch=text=>JSON.stringify({root:1,width:960,height:540,page:1,reset:true,removed:[],nodes:[{id:1,tag:'div',children:[2]},{id:2,tag:'#text',text}]});
test('Live switches Convex → Supabase → Convex from the current visual state, without replaying actions',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);await f.api.liveCommand('update',{...args,patch:patch('initial')});f.convex(false);await f.api.liveCommand('update',{...args,patch:patch('fallback')});assert.ok(f.storage.room.document.includes('fallback'));f.convex(true);await f.api.liveCommand('update',{...args,patch:patch('reconnected')});const update=f.calls.filter(c=>c.provider==='convex'&&c.action==='update').at(-1);assert.equal(JSON.parse(update.patch).reset,true);assert.ok(update.patch.includes('reconnected'));await f.api.liveCommand('stop',args);assert.equal(f.storage.room,null);
});
test('a Supabase-only failure does not block the healthy Convex visual stream',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);f.supabase(false);await f.api.liveCommand('update',{...args,patch:patch('still live')});assert.ok(f.calls.some(c=>c.provider==='convex'&&c.patch?.includes('still live')));await f.api.liveCommand('stop',args);
});
test('when both paths fail, the caller receives an error and can retain its last frame',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);f.convex(false);f.supabase(false);await assert.rejects(()=>f.api.liveCommand('update',{...args,patch:patch('not delivered')}));f.supabase(true);await f.api.liveCommand('update',{...args,patch:patch('recovered fallback')});assert.ok(f.storage.room.document.includes('recovered fallback'));await f.api.liveCommand('stop',args);
});

test('backup checkpoints retain the newest capture while an older publish is in flight',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);f.convex(false);
 const latest=JSON.parse(protocol.applyLivePatch('',patch('newest visual')));
 f.api.stageLiveDocument(args.epoch,latest);
 await f.api.liveCommand('update',{...args,patch:patch('older queued publish')});
 assert.ok(f.storage.room.document.includes('newest visual'));
 assert.ok(!f.storage.room.document.includes('older queued publish'));
 await f.api.liveCommand('stop',args);
});


test('an administrator can release an abandoned owner before starting a new controller',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);
 await f.api.endLiveSession(args.sectionId);assert.equal(f.storage.room,null);
 assert.ok(f.calls.some(call=>call.provider==='convex'&&call.action==='stop'&&call.deviceId===args.deviceId));
 await f.api.liveCommand('start',{...args,deviceId:'controller-bbbbbbbb',epoch:'epoch-bbbbbbbbbbbbb'});
 assert.equal(f.storage.room.owner,'controller-bbbbbbbb');
 await f.api.liveCommand('stop',{...args,deviceId:'controller-bbbbbbbb',epoch:'epoch-bbbbbbbbbbbbb'});
});


test('releasing an old session does not report success if its known backup lease could not be removed',async()=>{
 const f=fixture();await f.api.liveCommand('start',args);f.failStop(true);
 await assert.rejects(()=>f.api.endLiveSession(args.sectionId));assert.ok(f.storage.room);
 f.failStop(false);await f.api.endLiveSession(args.sectionId);assert.equal(f.storage.room,null);
});
