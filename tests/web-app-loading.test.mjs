import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React, { act } from 'react';
import { createRequire } from 'node:module';
import { Window } from 'happy-dom';
const require = createRequire(import.meta.url);
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(file,'utf8').replace(/^\s*pdfjs.GlobalWorkerOptions.workerSrc =.*$/m,'');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{exports,console,AbortController,AbortSignal,...globals,require:name=>dependencies[name]??(name.endsWith('.css')?new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}):require(name))});
  return exports;
}
const metadata = load('lib/compiledSectionMetadata.ts');
const documents = load('lib/tsxDocument.ts');
const counter = load('lib/sectionSlideCount.ts',{'./compiledSectionMetadata':metadata,'./tsxDocument':documents});
const manifest = JSON.parse(fs.readFileSync('course-content/web-app-development/manifest.json','utf8'));
const ids = Object.keys(manifest);
async function dom() {
  const window = new Window({url:'http://localhost/learn'});
  for(const name of ['window','document','navigator','HTMLElement'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const {createRoot}=await import('react-dom/client');
  const container=window.document.createElement('div');window.document.body.append(container);
  const root=createRoot(container);
  return {window,container,root,close:async()=>{await act(async()=>root.unmount());await window.happyDOM.close();}};
}

test('web course cards immediately show role-aware counts without fetching or evaluating either section',async()=>{
  const f=await dom();let reads=0;
  const {useSectionSlideCounts}=load('components/useSectionSlideCounts.ts',{'@/lib/compiledSectionMetadata':metadata,'@/lib/sectionSlideCount':{
    getCompiledSectionMetadata:counter.getCompiledSectionMetadata,readSectionSlideCount:()=>{reads++;throw Error('Unexpected download');},
  }});
  const sections=ids.map(id=>({id,contentType:'tsx',contentRevision:'stale-upload-reference'}));
  function Harness({admin,open=true}){return React.createElement('pre',null,JSON.stringify(useSectionSlideCounts(manifest[ids[0]].courseId,open?sections:undefined,admin)));}
  try{
    for(const admin of [false,true]){
      await act(async()=>f.root.render(React.createElement(Harness,{admin})));
      const counts=JSON.parse(f.container.textContent);
      for(const id of ids)assert.equal(counts[id],admin?manifest[id].teachingSlides:manifest[id].learnerSlides);
    }
    await act(async()=>f.root.render(React.createElement(Harness,{admin:true,open:false})));
    await act(async()=>f.root.render(React.createElement(Harness,{admin:true})));
    assert.equal(reads,0);assert.equal(f.window.document.querySelector('iframe'),null);
  }finally{await f.close();}
});

test('opening a web lesson fetches content once, skips an ignored default layout and lazy-loads native interactions only on their pages',async()=>{
  const f=await dom();const reads=[],built=[],native=[];let page=8,frameProps;
  let readinessTimeout;
  const schedule=f.window.setTimeout.bind(f.window);
  f.window.setTimeout=(callback,delay,...args)=>{if(delay===15_000)readinessTimeout=callback;return schedule(callback,delay,...args);};
  // Simulate assets that have not finished: content can post ready before load.
  const frameEvents=f.window.HTMLIFrameElement.prototype.addEventListener;
  f.window.HTMLIFrameElement.prototype.addEventListener=function(type,...args){if(type!=='load')return frameEvents.call(this,type,...args);};
  const nativeComponent=kind=>function NativeInteraction(props){native.push(kind);return React.createElement('div',{'data-native':kind,'data-section':props.sectionId});};
  const Deck=load('components/deck/UploadedSectionDeck.tsx',{
    'next/dynamic':{__esModule:true,default:loader=>String(loader).includes('QuizSlide')?nativeComponent('quiz'):String(loader).includes('ShowcaseSlide')?nativeComponent('showcase'):()=>null},
    '@/components/deck/SharedDeckFrame':{__esModule:true,default:props=>{frameProps=props;return props.renderSlide(page,960);}},
    '@/components/HairlineLoading':{__esModule:true,default:()=>React.createElement('i',{'data-loading':true})},
    '@/lib/webDevelopmentQuiz':{WEB_DEVELOPMENT_SECTION_ID:ids[0]},'@/lib/compiledSectionMetadata':counter,'@/lib/sectionSlideCount':counter,
    '@/lib/tsxDocument':{createTsxDocument:(...args)=>{built.push(args);return '<html><body>Section</body></html>';}},
  },{window:f.window,fetch:async url=>{reads.push(url);return {ok:true,text:async()=>'exports.default=[];',json:async()=>({templates:[{id:'custom',background:'data:image/png;base64,AA=='}]})};}}).default;
  const props={sectionId:ids[0],contentType:'tsx',slideCount:1,courseTitle:'Web',sectionTitle:'Section 1',isAdmin:true,templateKey:'eiu-business-v1'};
  const render=(extra={})=>f.root.render(React.createElement(Deck,{...props,...extra}));
  const send=async(interaction,currentPage=page,type='eiu-slide-interaction')=>act(async()=>{
    const frame=f.container.querySelector('iframe');
    f.window.dispatchEvent(new f.window.MessageEvent('message',{source:frame.contentWindow,data:{type,interaction,slides:32,page:currentPage,requestId:`${ids[0]}:${currentPage}`}}));
  });
  try{
    await act(async()=>{render();await new Promise(resolve=>setTimeout(resolve,10));});
    assert.equal(frameProps.navigationReady,true);assert.equal(frameProps.totalSlides,manifest[ids[0]].teachingSlides);
    assert.deepEqual(reads,[`/api/sections/${ids[0]}/content`]);assert.ok(f.container.querySelector('iframe'));
    assert.equal(built.length,1);assert.equal(built[0][1],8,'the restored page is rendered without an intermediate count-only page');
    assert.deepEqual(native,[]);
    assert.ok(f.container.querySelector('[data-loading]'));
    await send(null,page,'eiu-tsx-ready');
    assert.ok(f.container.querySelector('[data-loading]'),'slide counts arrive before the slide is rendered');
    await send(null);
    assert.equal(f.container.querySelector('[data-loading]'),null,'ready slides dismiss loading without waiting for iframe load/assets');
    await act(async()=>render());assert.equal(built.length,1);assert.equal(reads.length,1);
    page=32;await act(async()=>render());assert.ok(f.container.querySelector('[data-native="quiz"]'));
    assert.equal(f.container.querySelector('iframe'),null,'quiz opens directly without rendering the standalone fallback');
    page=31;await act(async()=>render());assert.ok(f.container.querySelector('[data-native="showcase"]'));
    assert.equal(f.container.querySelector('iframe'),null,'showcase opens directly without rendering the standalone fallback');
    assert.equal(built.length,1,'native slides do not build sandbox documents');
    page=8;
    await act(async()=>{render({key:'custom',templateKey:'custom'});await new Promise(resolve=>setTimeout(resolve,10));});
    assert.ok(reads.includes('/api/templates?id=custom'),'custom layouts remain supported');
    assert.equal(built.at(-1)[2],'data:image/png;base64,AA==');
    await send(null,page,'eiu-tsx-error');
    assert.match(f.container.querySelector('[role="alert"]').textContent,/Unable to display/);
    await act(async()=>{render({key:'timeout'});await new Promise(resolve=>setTimeout(resolve,10));});
    assert.ok(f.container.querySelector('[data-loading]'));
    await act(async()=>readinessTimeout());
    assert.match(f.container.querySelector('[role="alert"]').textContent,/too long/,'missing frame readiness ends in an actionable error');
  }finally{await f.close();}
});

test('a contained lesson loader stays inside the player while route loading still uses the page overlay',async()=>{
  const f=await dom();
  const Loader=load('components/HairlineLoading.tsx',{}, {document:f.window.document}).default;
  try{
    await act(async()=>f.root.render(React.createElement(Loader,{contained:true})));
    assert.ok(f.container.querySelector('[role="status"]'),'the player owns the loader');
    await act(async()=>f.root.render(React.createElement(Loader,{})));
    assert.equal(f.container.querySelector('[role="status"]'),null);
    assert.ok(f.window.document.body.querySelector('[role="status"]'),'route loading retains its full-page overlay');
  }finally{await f.close();}
});

test('native pages open directly for both roles while explicit uploaded replacements keep their own runtime',async()=>{
  const f=await dom();let page=31,builds=0,frameProps;
  const native=kind=>function NativePreview(props){return React.createElement('div',{'data-native':kind,'data-admin':String(props.isAdmin)});};
  const Deck=load('components/deck/UploadedSectionDeck.tsx',{
    'next/dynamic':{__esModule:true,default:loader=>String(loader).includes('QuizSlide')?native('quiz'):String(loader).includes('ShowcaseSlide')?native('showcase'):()=>null},
    '@/components/deck/SharedDeckFrame':{__esModule:true,default:props=>{frameProps=props;return props.renderSlide(page,960);}},
    '@/components/HairlineLoading':{__esModule:true,default:()=>React.createElement('i',{'data-loading':true})},
    '@/lib/webDevelopmentQuiz':{WEB_DEVELOPMENT_SECTION_ID:ids[0]},'@/lib/compiledSectionMetadata':metadata,
    '@/lib/tsxDocument':{createTsxDocument:()=>{builds++;return '<html><body>Uploaded lesson</body></html>';}},
  },{window:f.window,fetch:async()=>({ok:true,text:async()=>'exports.default=[];'})}).default;
  const props={sectionId:ids[0],contentType:'tsx',slideCount:32,courseTitle:'Web',sectionTitle:'Section 1'};
  try{
    for(const [isAdmin,pages] of [[true,[31,32]],[false,[30,31]]]){
      for(const [index,target] of pages.entries()){
        page=target;
        await act(async()=>f.root.render(React.createElement(Deck,{...props,isAdmin,key:`${isAdmin}:${page}`})));
        assert.equal(f.container.querySelector('[data-native]').dataset.native,index===0?'showcase':'quiz');
        assert.equal(f.container.querySelector('iframe'),null);
        assert.equal(frameProps.totalSlides,isAdmin?32:31);
        assert.equal(frameProps.slideTransitions,true);
      }
    }
    assert.equal(builds,0,'opening native pages performs zero sandbox evaluations');
    page=31;
    await act(async()=>f.root.render(React.createElement(Deck,{...props,isAdmin:true,uploadedContent:true,key:'override'})));
    assert.ok(f.container.querySelector('iframe'));
    assert.equal(f.container.querySelector('[data-native]'),null,'replacement JS must not inherit project interaction mappings');
    assert.equal(f.container.querySelector('[data-slide-ready]').dataset.slideReady,'false');
  }finally{await f.close();}
});

test('pruned Section 2 retains every slide, embedded image and original-layout marker',async()=>{
  const source=fs.readFileSync(manifest[ids[1]].path,'utf8');
  for(let page=1;page<=manifest[ids[1]].teachingSlides;page++){
    const window=new Window();const document=window.document;document.body.innerHTML='<div id="root"></div>';
    try{
      vm.runInNewContext(documents.createTsxDocument(source,page,'','','',true).match(/<script>([\s\S]*?)<\/script>/)[1],{
        window,document,Node:window.Node,URL:window.URL,parent:{postMessage(){}},setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window),
      });
      assert.equal(document.querySelector('#error'),null,`slide ${page}`);
      assert.ok(document.querySelector('[data-preserve-original="true"]'));
      for(const image of document.querySelectorAll('img'))assert.ok(image.src.startsWith('data:image/'),`missing image on slide ${page}`);
    }finally{await window.happyDOM.close();}
  }
});
