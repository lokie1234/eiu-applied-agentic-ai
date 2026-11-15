import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './helpers/mis301-fixture.mjs';
const protocol=loadTS('lib/livePresentationProtocol.ts'),dom=loadTS('lib/livePresentationDom.ts');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const room={owner:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa',active:true,topic:'secret-topic',expiresAt:Date.now()+120000,sequence:0,documentSequence:0,revision:0,updatedAt:Date.now()};
const state=(text='old',size=510000)=>({root:1,width:960,height:540,page:1,nodes:[{id:1,tag:'div',children:[2,3]},{id:2,tag:'#text',text:'x'.repeat(size)},{id:3,tag:'#text',text}]});
function fixture(){
 const channels=[],sent=[];let drop=false;
 const client={channel(topic,config){assert.equal(config.config.private,true);const ch={topic,handlers:new Map(),on(type,{event},fn){ch.handlers.set(event,fn);return ch;},subscribe(fn){ch.status=fn;queueMicrotask(()=>fn('SUBSCRIBED'));return ch;},async send(message){sent.push(message);if(drop&&message.event==='visual'){drop=false;return 'ok';}for(const other of [...channels])if(other!==ch&&other.topic===ch.topic)other.handlers.get(message.event)?.({payload:structuredClone(message.payload)});return 'ok';}};channels.push(ch);return ch;},async removeChannel(ch){const i=channels.indexOf(ch);if(i>=0)channels.splice(i,1);}};
 const load=()=>loadTS('lib/livePresentationRealtime.ts',{'./supabase/browser':{getSupabaseBrowserClient:()=>client},'./livePresentationProtocol':protocol,'./livePresentationDom':dom},{fetch:async()=>({ok:true,json:async()=>({room})})});
 return {controller:load(),follower:load(),channels,sent,drop:()=>drop=true};
}
test('Broadcast chunks the first large frame, sends small click deltas, and repairs a missing delta',async()=>{
 const f=fixture(),frames=[];const stops=[f.controller.watchLiveRealtimeReady('section',()=>{}),f.follower.watchLiveDocument('section',d=>frames.push(JSON.parse(d)))];
 try{
  await pause(20);f.controller.publishLiveDocument('section',room.owner,room.epoch,1,state());await pause(180);assert.equal(frames.at(-1).nodes[1].text.length,510000);
  const initial=f.sent.filter(m=>m.event==='visual');assert.ok(initial.length>=9);assert.ok(initial.every(m=>new TextEncoder().encode(JSON.stringify(m)).byteLength<256000));
  const start=f.sent.length;f.controller.publishLiveDocument('section',room.owner,room.epoch,2,state('click'));await pause(180);assert.equal(frames.at(-1).nodes[2].text,'click');
  const changes=f.sent.slice(start).filter(m=>m.event==='visual');assert.equal(changes.length,1);assert.ok(changes[0].payload.data.length<500,'unchanged large fonts must not be rebroadcast');
  f.drop();f.controller.publishLiveDocument('section',room.owner,room.epoch,3,state('lost'));await pause(180);assert.equal(frames.at(-1).nodes[2].text,'click');
  f.controller.publishLiveDocument('section',room.owner,room.epoch,4,state('recovered'));await pause(420);assert.equal(frames.at(-1).nodes[2].text,'recovered');assert.ok(f.sent.some(m=>m.event==='resync'));
  const encoded=JSON.stringify({reset:true,removed:[],...state('stale')});for(const ch of f.channels)ch.handlers.get('visual')?.({payload:{id:'old',owner:room.owner,epoch:room.epoch,sequence:1,part:0,total:1,data:encoded}});assert.equal(frames.at(-1).nodes[2].text,'recovered');
  for(const ch of f.channels){assert.doesNotThrow(()=>ch.handlers.get('visual')?.({payload:null}));assert.doesNotThrow(()=>ch.handlers.get('peer')?.({payload:null}));}
 }finally{stops.forEach(stop=>stop());}assert.equal(f.channels.length,0);
});
test('old checkpoint metadata cannot roll back a newer Broadcast frame; topic rotation reconnects',async()=>{
 const f=fixture(),frames=[],stop=f.follower.watchLiveDocument('section',d=>frames.push(JSON.parse(d)));
 try{await pause(20);f.follower.primeLiveRoom('section',{...room,document:JSON.stringify(state('new',10)),documentSequence:8,revision:3});
  f.follower.primeLiveRoom('section',{...room,document:JSON.stringify(state('old',10)),documentSequence:5,revision:2});assert.equal(frames.at(-1).nodes[2].text,'new');
  f.follower.primeLiveRoom('section',{...room,topic:'rotated'});await pause(10);assert.equal(f.channels.length,1);assert.equal(f.channels[0].topic,'rotated');
 }finally{stop();}
});
