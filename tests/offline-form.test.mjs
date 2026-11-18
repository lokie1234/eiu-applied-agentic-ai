import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {Window} from 'happy-dom';
import {loadTS} from './helpers/mis301-fixture.mjs';

test('offline forms preserve validation, default submit buttons, submitter and Enter without native form navigation',async()=>{
 const window=new Window();
 for(const name of ['window','document','navigator','HTMLElement'])Object.defineProperty(globalThis,name,{configurable:true,value:name==='window'?window:window[name]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {createRoot}=await import('react-dom/client');
 const Form=loadTS('course-content/applied-agentic-ai/offline/Form.tsx',{}, {Event:window.Event,SubmitEvent:window.SubmitEvent,HTMLInputElement:window.HTMLInputElement}).default;
 const host=window.document.createElement('div');window.document.body.append(host);const root=createRoot(host),submits=[];
 try{
  await act(async()=>root.render(React.createElement(Form,{onSubmit:event=>{event.preventDefault();submits.push(event.nativeEvent.submitter);}},React.createElement('input',{required:true}),React.createElement('button',{name:'save'},'Save'))));
  const input=host.querySelector('input'),button=host.querySelector('button');
  await act(async()=>button.click());assert.equal(submits.length,0);
  input.value='Example';await act(async()=>button.click());assert.deepEqual(submits,[button]);
  await act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));assert.equal(submits.length,2);
 }finally{await act(async()=>root.unmount());await window.happyDOM.close();}
});
