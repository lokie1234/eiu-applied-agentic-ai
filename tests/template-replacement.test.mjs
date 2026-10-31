import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import React, {act} from 'react';
import {Window} from 'happy-dom';
import {loadTS,deferred} from './helpers/mis301-fixture.mjs';
const {applySlideTemplate,createTsxDocument}=loadTS('lib/tsxDocument.ts');
const imageA='data:image/png;base64,QQ==',imageB='data:image/png;base64,Qg==';

test('Changing an embedded template replaces its background without adding another frame',async()=>{
 const window=new Window();try{
 const root=window.document.createElement('div');root.innerHTML='<article data-eiu-template="original" style="background-image:url(original.png)"><main><button>Content</button></main></article>';
 const slide=root.firstChild,button=root.querySelector('button');let clicks=0;button.addEventListener('click',()=>clicks++);
 applySlideTemplate(root,1,imageA,'a');applySlideTemplate(root,1,imageB,'b');button.click();
 assert.equal(root.children.length,1);assert.equal(root.firstChild,slide);assert.equal(clicks,1);
 assert.equal(slide.dataset.eiuTemplate,'b');assert.ok(slide.style.backgroundImage.includes(imageB));assert.ok(!slide.style.backgroundImage.includes(imageA));
 applySlideTemplate(root,1,'','');assert.equal(slide.dataset.eiuTemplate,'original');assert.match(slide.style.backgroundImage,/original.png/);
 }finally{await window.happyDOM.close();}
});

test('Changing or clearing a generic template keeps one frame and preserves the actual slide content',async()=>{
 const window=new Window();try{
 const root=window.document.createElement('div'),content=window.document.createElement('p');content.textContent='Original lesson';root.appendChild(content);
 applySlideTemplate(root,2,imageA,'a');applySlideTemplate(root,2,imageB,'b');
 assert.equal(root.querySelectorAll('p').length,1);assert.equal(root.querySelector('p'),content);
 assert.equal(root.querySelectorAll('[data-eiu-template-content]').length,1);assert.equal(root.querySelectorAll('[data-eiu-template-page]').length,1);
 assert.ok(root.style.background.includes(imageB));assert.ok(!root.style.background.includes(imageA));
 applySlideTemplate(root,2,'','');assert.equal(root.children.length,1);assert.equal(root.firstChild,content);assert.equal(root.style.background,'');
 }finally{await window.happyDOM.close();}
});

test('The actual sandbox document replaces embedded branding with the selected template',async()=>{
 const window=new Window();try{
 window.document.body.innerHTML='<div id="root"></div>';
 const html=createTsxDocument('exports.default=[()=>h("article",{"data-eiu-template":"old",style:{backgroundImage:"url(old.png)"}},h("main",null,"Lesson"))];',1,imageB,'new');
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window,document:window.document,Node:window.Node,parent:{postMessage(){}},console});
 const root=window.document.getElementById('root');assert.equal(root.querySelectorAll('[data-eiu-template]').length,1);assert.equal(root.querySelector('[data-eiu-template]').dataset.eiuTemplate,'new');
 assert.ok(root.querySelector('article').style.backgroundImage.includes(imageB));assert.equal(root.querySelector('[data-eiu-template-content]'),null);assert.match(root.textContent,/Lesson/);
 }finally{await window.happyDOM.close();}
});

test('Switching templates clears the old image immediately and ignores a late previous response',async()=>{
 const window=new Window({url:'http://localhost/learn'});
 for(const name of ['window','document','navigator','HTMLElement'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=await import('react-dom/client');const container=window.document.createElement('div');window.document.body.append(container);const root=createRoot(container);
 const requests=new Map(),built=[];
 const Deck=loadTS('components/deck/UploadedSectionDeck.tsx',{
 'next/dynamic':{__esModule:true,default:()=>()=>null},'./UploadedSectionDeck.module.css':{},
 '@/components/deck/SharedDeckFrame':{__esModule:true,default:props=>props.renderSlide(1,960)},
 '@/components/HairlineLoading':{__esModule:true,default:()=>React.createElement('span',null,'Loading')},
 '@/lib/mis301Practice':{MIS301_SECTION_ID:'mis301'},'@/lib/webDevelopmentQuiz':{WEB_DEVELOPMENT_SECTION_ID:'web'},
 '@/lib/compiledSectionMetadata':{getCompiledSectionMetadata:()=>undefined},'./useLessonPracticeBridge':{useLessonPracticeBridge:()=>null},'./useMis301NotebookBridge':{useMis301NotebookBridge(){}},
 '@/lib/tsxDocument':{createTsxDocument:(...args)=>{built.push(args);return '<html><body>Lesson</body></html>';}}
 },{window,fetch:async url=>{if(url.startsWith('/api/templates')){const key=new URL(url,'http://localhost').searchParams.get('id');const pending=deferred();requests.set(key,pending);return pending.promise;}return {ok:true,text:async()=>'exports.default=[];'};}}).default;
 const props={sectionId:'section',contentType:'tsx',slideCount:1,courseTitle:'Course',sectionTitle:'Section',isAdmin:true};
 const render=key=>root.render(React.createElement(Deck,{...props,templateKey:key}));
 const resolve=(key,image)=>requests.get(key).resolve({ok:true,json:async()=>({templates:[{id:key,background:image}]})});
 try{
 await act(async()=>render('a'));await act(async()=>resolve('a',imageA));assert.equal(built.at(-1)[2],imageA);
 await act(async()=>render('b'));assert.equal(container.querySelector('iframe'),null);
 await act(async()=>render('c'));await act(async()=>resolve('b',imageA));assert.equal(container.querySelector('iframe'),null);
 await act(async()=>resolve('c',imageB));assert.equal(built.at(-1)[2],imageB);
 await act(async()=>render(''));assert.equal(built.at(-1)[2],'');assert.ok(container.querySelector('iframe'));
 }finally{await act(async()=>root.unmount());await window.happyDOM.close();}
});
