import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React,{act} from "react";
import {Window} from "happy-dom";
const require=createRequire(import.meta.url);
async function fixture(fetch) {
 const window=new Window({url:"http://localhost/admin/access"});
 for(const name of ["window","document","HTMLElement","navigator"]) Object.defineProperty(globalThis,name,{configurable:true,value:name==="window"?window:window[name]});
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const exports={};const code=ts.transpileModule(fs.readFileSync("components/admin/DriveLoad.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,fetch,document:window.document,window,require:n=>n.endsWith(".css")?new Proxy({},{get:(_,k)=>String(k)}):n==="@/lib/googlePicker"?{loadPicker:async()=>{throw Error("Picker not configured");}}:require(n)});
 const {createRoot}=await import("react-dom/client");const container=window.document.createElement("div");window.document.body.append(container);const root=createRoot(container);
 let refreshed=0;await act(async()=>root.render(React.createElement(exports.default,{sections:[{id:"s1",title:"Section 1"},{id:"s2",title:"Section 2",content_path:"legacy"}],onLoaded:async()=>{refreshed++;}})));
 const button=text=>Array.from(container.querySelectorAll("button")).find(button=>button.textContent===text);
 await act(async()=>button("Load from Drive").click());
 async function add(value){await act(async()=>{const input=container.querySelector("input");const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;set.call(input,value);input.dispatchEvent(new window.Event("input",{bubbles:true}));});await act(async()=>container.querySelector("form").dispatchEvent(new window.Event("submit",{bubbles:true,cancelable:true})));}
 return {container,window,button,add,get refreshed(){return refreshed;},close:async()=>{await act(async()=>root.unmount());await window.happyDOM.close();}};
}
test("Drive files are paired to sections, remain editable, and link through the protected section API",async()=>{
 const calls=[];const f=await fixture(async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({success:true,sourceFilename:"lesson.pdf"})};});
 try{await f.add("drive-file-id-12345");assert.equal(f.container.querySelector("select").value,"s1");await act(async()=>f.button("Load selected files into deck").click());assert.equal(calls[0].url,"/api/admin/sections/s1/content");assert.equal(calls[0].body.action,"link");assert.equal(calls[0].body.fileId,"drive-file-id-12345");assert.equal(f.refreshed,1);assert.match(f.container.textContent,/Connected to deck/);}finally{await f.close();}
});
test("Drive connection shows loading until the request finishes and prevents duplicate actions",async()=>{
 let finish;const f=await fixture(()=>new Promise(resolve=>{finish=resolve;}));
 try{await f.add("drive-file-id-12345");await act(async()=>f.button("Load selected files into deck").click());assert.match(f.container.textContent,/loading/);assert.equal(f.button("Browse Drive").disabled,true);assert.equal(f.container.querySelector("select").disabled,true);await act(async()=>finish({ok:false,json:async()=>({message:"Drive unavailable"})}));assert.match(f.container.textContent,/Drive unavailable/);assert.equal(f.button("Browse Drive").disabled,false);}finally{await f.close();}
});
