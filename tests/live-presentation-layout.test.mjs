import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';

test('Live controls never occupy a deck row; presenter slide remains the only viewport child',async()=>{
  const window=new Window({url:'http://localhost/learn'});
  const previous=new Map();
  for(const key of ['window','document','HTMLElement','navigator','IS_REACT_ACT_ENVIRONMENT']){
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='window'?window:window[key]});
  }
  const {createRoot}=await import('react-dom/client');
  let stopped=0;
  const language=loadTS('lib/learningLanguage.ts',{}, {window});
  window.localStorage.setItem(language.LEARNING_LANGUAGE_KEY,'vi');
  const live=loadTS('components/LivePresentation.tsx',{
    '@/lib/learningLanguage':language,
    '@/lib/realtime/client':{realtimeReady:()=>true,watchRealtimeReady:()=>()=>{},watchLivePresentation:()=>()=>{}},
    '@/lib/livePresentationTransport':{resumeLiveSession:async()=>{},readLiveBackup:async()=>null,liveCommand:async()=>{}},
    '@/lib/livePresentationProtocol':{},'@/lib/livePresentationDom':{renderLiveDocument:()=>{}},
    '@/lib/livePresentationPeer':{createLivePeerController:()=>({close(){}}),createLivePeerFollower:()=>({close(){}})},
    './LivePresentation.module.css':new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)}),
  },{window,document:window.document,sessionStorage:window.sessionStorage,ResizeObserver:class{observe(){}disconnect(){}}});
  const host=window.document.createElement('div');window.document.body.appendChild(host);
  const root=createRoot(host),selection={sectionId:'section',deviceId:'device',epoch:'epoch',mode:'control'};
  try{
    await act(async()=>root.render(React.createElement('main',{'data-viewport':true},React.createElement(live.LiveController,{selection,onStop:()=>stopped++}),React.createElement('div',{'data-normal-deck':true},'Visible slide'))));
    const viewport=host.querySelector('main');
    assert.equal(viewport.children.length,1,'a Live banner must not push the slide into a second full-height row');
    assert.ok(viewport.firstElementChild.hasAttribute('data-normal-deck'));
    const indicator=window.document.querySelector('[data-live-indicator]');
    assert.ok(indicator.getAttribute('aria-label').includes('Điều khiển'));
    assert.equal(viewport.contains(indicator),false);
    assert.equal(indicator.closest('details').open,false,'session controls stay collapsed by default');
    await act(async()=>indicator.closest('details').querySelector('button').click());assert.equal(stopped,1);
    await act(async()=>root.render(React.createElement('main',{'data-viewport':true},React.createElement(live.LiveFollower,{selection:{...selection,mode:'follow'},title:'Section',onStop:()=>stopped++}))));
    assert.equal(host.querySelector('main').children.length,1);
    assert.equal(host.querySelectorAll('button').length,0,'no Live toolbar consumes slide space');
    assert.ok(host.querySelector('iframe[title="Live Section"]'));
    assert.ok(window.document.querySelector('[data-live-indicator]').getAttribute('aria-label').includes('Theo dõi'));
    const fullscreenSurface=host.querySelector('iframe').parentElement;
    Object.defineProperty(window.document,'fullscreenElement',{configurable:true,value:fullscreenSurface});
    await act(async()=>window.document.dispatchEvent(new window.Event('fullscreenchange')));
    assert.ok(fullscreenSurface.querySelector('[data-live-indicator]'),'the only Live icon stays visible in follower fullscreen');
    Object.defineProperty(window.document,'fullscreenElement',{configurable:true,value:null});
    await act(async()=>window.document.dispatchEvent(new window.Event('fullscreenchange')));
    let selected;
    await act(async()=>root.render(React.createElement('article',{'data-section-card':true},React.createElement(live.LiveSectionControl,{sectionId:'section',onSelect:value=>{selected=value;}}))));
    assert.equal(host.querySelector('input[type=checkbox]'),null,'section entry uses a button, not a separate checkbox panel');
    assert.deepEqual([...host.querySelectorAll('button')].map(button=>button.textContent),['Live']);
    await act(async()=>host.querySelector('button').click());
    assert.equal(host.querySelector('button').getAttribute('aria-expanded'),'true');
    assert.deepEqual([...host.querySelectorAll('[role=group] button')].map(button=>button.textContent),['Điều khiển','Theo dõi']);
    await act(async()=>{window.localStorage.setItem(language.LEARNING_LANGUAGE_KEY,'en');window.dispatchEvent(new window.Event('eiu:learning-language'));});
    assert.deepEqual([...host.querySelectorAll('[role=group] button')].map(button=>button.textContent),['Control','Follow']);
    await act(async()=>host.querySelectorAll('[role=group] button')[1].click());
    assert.equal(selected.mode,'follow');assert.equal(selected.sectionId,'section');
    await act(async()=>host.querySelector('[data-live-section]').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(host.querySelector('[role=group]'),null,'Escape closes choices without leaving the course');
  }finally{
    await act(async()=>root.unmount());await new Promise(resolve=>setTimeout(resolve,300));await window.happyDOM.abort();
    for(const [key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
  }
});
