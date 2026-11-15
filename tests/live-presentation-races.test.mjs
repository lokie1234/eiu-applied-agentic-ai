import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS,deferred} from './helpers/mis301-fixture.mjs';
const protocol=loadTS('lib/livePresentationProtocol.ts'),dom=loadTS('lib/livePresentationDom.ts');
test('an in-flight old room read cannot revive a stopped session or replace a new controller',async()=>{
 const held=deferred(),rooms=[];
 const api=loadTS('lib/livePresentationRealtime.ts',{'./supabase/browser':{getSupabaseBrowserClient:()=>null},'./livePresentationProtocol':protocol,'./livePresentationDom':dom},{fetch:()=>held.promise});
 const stop=api.watchLivePresentation('section',r=>rooms.push(r));
 const newer={owner:'new-controller',epoch:'new-epoch',active:false,topic:'',expiresAt:0,sequence:0,documentSequence:0,revision:0,updatedAt:Date.now()};
 try{api.primeLiveRoom('section',newer);held.resolve({ok:true,json:async()=>({room:{...newer,epoch:'old-epoch',active:true}})});await new Promise(r=>setImmediate(r));assert.equal(rooms.at(-1).epoch,'new-epoch');assert.equal(rooms.at(-1).active,false);}finally{stop();}
});
