import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';
const protocol=loadTS('lib/livePresentationProtocol.ts'),dom=loadTS('lib/livePresentationDom.ts');
function doc(){const window=new Window();window.document.head.innerHTML='<style>.box{color:red}</style>';window.document.body.innerHTML='<main><h1>Lesson</h1><button id="reveal">Reveal</button><div id="panel" hidden><p>Answer</p></div><dialog id="details"><h2>Detail</h2></dialog><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="4"/></svg><script>bad()</script><input type="password" value="secret"></main>';Object.defineProperty(window.document.documentElement,'clientWidth',{value:960});Object.defineProperty(window.document.documentElement,'clientHeight',{value:540});let id=0;const ids=new WeakMap();const capture=()=>dom.captureLiveDocument(window.document,2,ids,()=>++id);return {window,capture};}
test('Live patches reconstruct reveal, nested popup, SVG and scroll without executing lesson actions',()=>{
 const {window,capture}=doc(),follower=new Window(),cache=new Map();let previous=capture(),encoded=protocol.applyLivePatch('',JSON.stringify(dom.diffLiveDocument(null,previous)));dom.renderLiveDocument(follower.document,JSON.parse(encoded),cache);
 assert.equal(follower.document.querySelectorAll('script').length,0);assert.equal(follower.document.querySelector('input').value,'');assert.equal(follower.document.querySelector('#panel').children.length,0);const button=follower.document.querySelector('#reveal');
 window.document.querySelector('#panel').hidden=false;window.document.querySelector('#details').showModal();const next=capture(),patch=dom.diffLiveDocument(previous,next);encoded=protocol.applyLivePatch(encoded,JSON.stringify(patch));dom.renderLiveDocument(follower.document,JSON.parse(encoded),cache);
 assert.equal(follower.document.querySelector('#panel').textContent,'Answer');assert.ok(follower.document.querySelector('#details').open);assert.equal(follower.document.querySelector('#reveal'),button);assert.equal(follower.document.querySelector('circle').namespaceURI,'http://www.w3.org/2000/svg');assert.ok(patch.nodes.length<next.nodes.length);window.happyDOM.abort();follower.happyDOM.abort();
});
test('Live rejects malformed graphs, oversized updates, unsafe attributes and invalid geometry',()=>{
 const {window,capture}=doc(),state=capture(),patch=dom.diffLiveDocument(null,state);assert.throws(()=>protocol.applyLivePatch('',JSON.stringify({...patch,width:-1})));assert.throws(()=>protocol.applyLivePatch('',JSON.stringify({...patch,nodes:[{id:1,tag:'div',children:[1]}],root:1})));assert.throws(()=>protocol.applyLivePatch('',JSON.stringify({...patch,nodes:[{id:1,tag:'div',scroll:[5,0]}],root:1})));assert.throws(()=>protocol.applyLivePatch('', 'x'.repeat(900001)));window.happyDOM.abort();
});

test('capture normalizes fractional overscroll and non-finite animation times across courses',()=>{
 const {window,capture}=doc(),panel=window.document.querySelector('#panel');
 panel.hidden=false;
 for(const [key,value]of Object.entries({scrollWidth:200,clientWidth:100,scrollHeight:300,clientHeight:100,scrollLeft:100.25,scrollTop:-.5}))Object.defineProperty(panel,key,{configurable:true,value});
 panel.getAnimations=()=>[{currentTime:Infinity},{currentTime:-1},{currentTime:42}];
 const state=capture(),record=state.nodes.find(node=>node.attrs?.id==='panel');
 assert.deepEqual(Array.from(record.scroll),[1,0]);assert.deepEqual(Array.from(record.animations),[0,0,42]);
 assert.doesNotThrow(()=>protocol.applyLivePatch('',JSON.stringify(dom.diffLiveDocument(null,state))));window.happyDOM.abort();
});

test('click deltas omit unchanged large styles while retaining attribute, animation and scroll updates',()=>{
 const previous={root:1,width:960,height:540,page:1,nodes:[{id:1,tag:'div',attrs:{id:'root',class:'old'},children:[2],scroll:[0,0],animations:[10]},{id:2,tag:'#text',text:'x'.repeat(520000)}]};
 const next=structuredClone(previous);next.nodes[0].attrs={class:'new',id:'root'};next.nodes[0].scroll=[0,1];next.nodes[0].animations=[100];
 const patch=dom.diffLiveDocument(previous,next);assert.equal(patch.nodes.length,1);assert.equal(patch.nodes[0].id,1);
 const merged=JSON.parse(protocol.applyLivePatch(JSON.stringify(previous),JSON.stringify(patch)));assert.equal(merged.nodes[1].text.length,520000);assert.equal(merged.nodes[0].attrs.class,'new');assert.equal(merged.nodes[0].scroll[1],1);
 assert.equal(dom.diffLiveDocument(next,structuredClone(next)).nodes.length,0);
});
function convex(){const rows={livePresentations:[],liveSnapshots:[]};let role='admin',allowed=['section'],liveAllowed,n=0;const db={query:table=>{const filters=[];return {withIndex(_,fn){fn({eq(key,value){filters.push([key,value]);return this;}});return this;},async unique(){return rows[table].find(row=>filters.every(([k,v])=>row[k]===v))||null;}};},async insert(table,data){const _id=String(++n);rows[table].push({...data,_id});return _id;},async patch(id,data){for(const table of Object.values(rows)){const row=table.find(row=>row._id===id);if(row)Object.assign(row,data);}},async replace(id,data){for(const table of Object.values(rows)){const i=table.findIndex(row=>row._id===id);if(i>=0)table[i]={...data,_id:id};}},async delete(id){for(const table of Object.values(rows)){const i=table.findIndex(row=>row._id===id);if(i>=0)table.splice(i,1);}}};const functions=loadTS('convex/livePresentation.ts',{'./_generated/server':{query:v=>v,mutation:v=>v},'../lib/livePresentationProtocol':protocol});return {functions,ctx:{db,auth:{getUserIdentity:async()=>({role,sections:JSON.stringify(allowed),...(liveAllowed===undefined?{}:{liveSections:JSON.stringify(liveAllowed)})})}},role:value=>role=value,scopes:value=>allowed=value,liveScopes:value=>liveAllowed=value,rows};}
test('Convex enforces admin scope, one controller, stale-epoch rejection, monotonic sequence and rate limits',async()=>{
 const f=convex(),args={sectionId:'section',deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'};f.role('learner');await assert.rejects(()=>f.functions.start.handler(f.ctx,args));f.role('admin');f.scopes([]);await assert.rejects(()=>f.functions.view.handler(f.ctx,{sectionId:'section'}));f.scopes(['section']);await f.functions.start.handler(f.ctx,args);await assert.rejects(()=>f.functions.start.handler(f.ctx,{...args,deviceId:'controller-bbbbbbbb'}));const {window,capture}=doc(),patch=JSON.stringify(dom.diffLiveDocument(null,capture()));await f.functions.update.handler(f.ctx,{...args,sequence:1,patch});const snap=await f.functions.snapshot.handler(f.ctx,{sectionId:'section'});assert.equal(snap.revision,1);assert.ok(snap.document.includes('Lesson'));await f.functions.update.handler(f.ctx,{...args,sequence:1,patch});assert.equal(f.rows.livePresentations[0].revision,1);await assert.rejects(()=>f.functions.update.handler(f.ctx,{...args,epoch:'old-epoch-aaaaaaaaa',sequence:2,patch}));for(let i=2;i<25;i++)await f.functions.update.handler(f.ctx,{...args,sequence:i,patch:''});await assert.rejects(()=>f.functions.update.handler(f.ctx,{...args,sequence:26,patch:''}));await f.functions.stop.handler(f.ctx,args);assert.equal((await f.functions.view.handler(f.ctx,{sectionId:'section'})).active,false);assert.equal(f.rows.liveSnapshots.length,0);window.happyDOM.abort();
});
test('private Supabase backup has atomic acquisition and rejects a second controller and stale writes',async()=>{
 const files=new Map();const storage={createBucket:async()=>({}),getBucket:async()=>({data:{public:false}}),from:()=>({download:async path=>files.has(path)?{data:new Blob([files.get(path)])}:{error:{message:'not found',status:404}},upload:async(path,bytes,options)=>{if(!options.upsert&&files.has(path))return {error:{message:'already exists'}};files.set(path,bytes.toString());return {};},remove:async paths=>{paths.forEach(path=>files.delete(path));return {};}})};const server=loadTS('lib/livePresentationBackup.ts',{'./supabase/server':{getSupabaseAdmin:()=>({storage})},'./livePresentationProtocol':protocol});const args={deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'};await server.liveBackup('section','start',args);await assert.rejects(()=>server.liveBackup('section','start',{...args,deviceId:'controller-bbbbbbbb'}));const {window,capture}=doc();await new Promise(resolve=>setTimeout(resolve,65));await server.liveBackup('section','update',{...args,sequence:1,document:JSON.stringify(capture())});assert.ok((await server.liveBackup('section','view',{})).document.includes('Lesson'));await assert.rejects(()=>server.liveBackup('section','stop',{...args,epoch:'old-epoch-aaaaaaaaa'}));await server.liveBackup('section','stop',args);assert.equal(await server.liveBackup('section','view',{}),null);await assert.rejects(()=>server.liveBackup('section','update',{...args,sequence:2,document:JSON.stringify(capture())}));await server.liveBackup('section','start',args);assert.equal((await server.liveBackup('section','view',{})).active,true);window.happyDOM.abort();
});

test('peer signaling requires section admin access and only the controller can answer',async()=>{
 const f=convex(),args={sectionId:'section',deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'};
 await f.functions.start.handler(f.ctx,args);
 const offer={...args,deviceId:'follower-aaaaaaaaaa',peerId:'peer-aaaaaaaaaaaaa',kind:'offer',sdp:'offer'};
 f.role('learner');await assert.rejects(()=>f.functions.signal.handler(f.ctx,offer));f.role('admin');
 await f.functions.signal.handler(f.ctx,offer);
 await assert.rejects(()=>f.functions.signal.handler(f.ctx,{...offer,kind:'answer',sdp:'answer'}));
 await f.functions.signal.handler(f.ctx,{...offer,deviceId:args.deviceId,kind:'answer',sdp:'answer'});
 assert.equal((await f.functions.peers.handler(f.ctx,{sectionId:'section'})).peers[0].answer,'answer');
 const resumed=await f.functions.start.handler(f.ctx,args);assert.equal(resumed.sequence,0);
 assert.equal((await f.functions.peers.handler(f.ctx,{sectionId:'section'})).peers.length,1);
 await assert.rejects(()=>f.functions.signal.handler(f.ctx,{...offer,epoch:'other-aaaaaaaaaaaa'}));
});


test('Convex denies sections disabled in current Live grants while retaining stop access',async()=>{
 const f=convex(),args={sectionId:'section',deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'};
 f.liveScopes(['section']);await f.functions.start.handler(f.ctx,args);f.liveScopes([]);
 await assert.rejects(()=>f.functions.view.handler(f.ctx,{sectionId:'section'}));
 await assert.rejects(()=>f.functions.update.handler(f.ctx,{...args,sequence:1,patch:''}));
 await f.functions.stop.handler(f.ctx,args);assert.equal(f.rows.livePresentations[0].active,false);
});

test('restarting Live cannot reset the public mutation rate window',async()=>{
 const f=convex(),args={sectionId:'section',deviceId:'controller-aaaaaaaa',epoch:'epoch-aaaaaaaaaaaaa'};
 for(let i=0;i<25;i++)await f.functions.start.handler(f.ctx,{...args,epoch:`epoch-aaaaaaaaaaa-${i}`});
 await assert.rejects(()=>f.functions.start.handler(f.ctx,{...args,epoch:'epoch-aaaaaaaaaaa-26'}));
});
