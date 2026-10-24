import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import React, { act } from "react";
import { Window } from "happy-dom";

const require = createRequire(import.meta.url);
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(file, "utf8").replace(/^\s*pdfjs.GlobalWorkerOptions.workerSrc =.*$/m, "");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), AbortController, AbortSignal, Uint8Array, crypto: globalThis.crypto, console, ...globals });
  return exports;
}
const metadata = load('lib/compiledSectionMetadata.ts');
const documents = load("lib/tsxDocument.ts");
const compiledCounter = load("lib/sectionSlideCount.ts", { "./compiledSectionMetadata": metadata, "./tsxDocument": documents });
const builtin = load("lib/builtinDeckItems.ts");

test("compiled web section counts match the exact downloadable JS without downloads or hidden frames", async () => {
  const window = new Window();
  let reads = 0;
  const counter = load("lib/sectionSlideCount.ts", { "./compiledSectionMetadata": metadata, "./tsxDocument": documents }, { window, document:window.document, fetch:async()=>{reads++;throw Error('Unnecessary download');} });
  const manifest = JSON.parse(fs.readFileSync('course-content/web-app-development/manifest.json','utf8'));
  for (const [id,metadata] of Object.entries(manifest)) {
    const source=fs.readFileSync(metadata.path,'utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'),metadata.revision);
    for (const admin of [false,true]) {
      const messages=[];
      vm.runInNewContext(documents.createTsxDocument(source,null,'','','count',admin).match(/<script>([\s\S]*?)<\/script>/)[1],{document:window.document,Node:window.Node,parent:{postMessage:message=>messages.push(message)}});
      assert.equal(await counter.readSectionSlideCount(id,'tsx',new AbortController().signal,admin),messages[0].slides);
    }
  }
  assert.equal(reads,0);assert.equal(window.document.querySelector('iframe'),null);
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(counter.readSectionSlideCount(Object.keys(manifest)[0],'tsx',cancelled.signal));
  await window.happyDOM.close();
});

test("built-in selector counts come from the same role-aware items as the decks", () => {
  assert.equal(builtin.buildSectionOneDeckItems(false).length, 41);
  assert.equal(builtin.buildSectionOneDeckItems(true).length, 42);
  assert.equal(builtin.sectionTwoDeckItems.length, 39);
  assert.equal(builtin.buildSectionOneDeckItems(true).filter(item => item.slide === "idea-results").length, 1);
});

test("TSX count mode counts runtime exports without rendering slides or reading a manual total", async () => {
  const window = new Window();
  const messages = [];
  const compiled = 'exports.default = () => Array.from({length:7}, () => () => {throw new Error("Slide must not render");});';
  const html = documents.createTsxDocument(compiled, null, "", "", "request");
  const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(code, { document: window.document, Node: window.Node, parent: { postMessage: message => messages.push(message) } });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "eiu-tsx-ready");
  assert.equal(messages[0].slides, 7);
  assert.equal(messages[0].requestId, "request");
  assert.equal(window.document.querySelector("#error"), null);
  await window.happyDOM.close();
});

test("hidden TSX counting rejects foreign messages and removes its sandbox on success or abort", async () => {
  const window = new Window();
  const counter = load("lib/sectionSlideCount.ts", { "./compiledSectionMetadata": metadata, "./tsxDocument": documents }, { window, document: window.document });
  const controller = new AbortController();
  const promise = counter.countTsxSlides("exports.default=[]", controller.signal);
  const frame = window.document.querySelector("iframe");
  assert.equal(frame.getAttribute("sandbox"), "allow-scripts");
  const requestId = frame.srcdoc.match(/requestId:"([^"]+)"/)[1];
  const emit = (source, id, slides) => window.dispatchEvent(new window.MessageEvent("message", { source, data: { type: "eiu-tsx-ready", requestId: id, slides } }));
  emit(window, requestId, 999);
  emit(frame.contentWindow, "wrong", 999);
  assert.ok(window.document.querySelector("iframe"));
  emit(frame.contentWindow, requestId, 3);
  assert.equal(await promise, 3);
  assert.equal(window.document.querySelector("iframe"), null);
  const second = counter.countTsxSlides("exports.default=[]", controller.signal);
  controller.abort();
  await assert.rejects(second);
  assert.equal(window.document.querySelector("iframe"), null);
  await window.happyDOM.close();
});

test("PPTX counts active presentation slides and ignores orphan files", async () => {
  const window = new Window();
  const zip = new JSZip();
  zip.file("ppt/presentation.xml", '<p:presentation xmlns:p="urn:p"><p:sldIdLst><p:sldId id="1"/><p:sldId id="2"/></p:sldIdLst></p:presentation>');
  for (const id of [1, 2, 3]) zip.file(`ppt/slides/slide${id}.xml`, "<slide/>");
  const bytes = await zip.generateAsync({ type: "uint8array" });
  const counter = load("lib/sectionSlideCount.ts", { "./compiledSectionMetadata": metadata, "./tsxDocument": documents }, { DOMParser: window.DOMParser, fetch: async (_, options) => {
    assert.equal(options.cache, "no-store"); return { ok: true, arrayBuffer: async () => bytes.buffer };
  } });
  assert.equal(await counter.readSectionSlideCount("section", "pptx", new AbortController().signal), 2);
  await window.happyDOM.close();
});

test("PDF count uses parsed pages and releases its loading task", async () => {
  let destroyed = 0;
  const counter = load("lib/sectionSlideCount.ts", { "./compiledSectionMetadata": metadata, "./tsxDocument": documents, "pdfjs-dist": {
    getDocument: ({ data }) => { assert.equal(data.byteLength, 3); return { promise: Promise.resolve({ numPages: 12 }), destroy: async () => { destroyed++; } }; },
  } }, { fetch: async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }) });
  assert.equal(await counter.readSectionSlideCount("section", "pdf", new AbortController().signal), 12);
  assert.equal(destroyed, 1);
});

test("counting limits reads to two, refreshes replacements, and cancels reads when the course closes", async () => {
  const window = new Window();
  for (const name of ["window", "document", "HTMLElement", "navigator"]) Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const reads = [];
  const { useSectionSlideCounts } = load("components/useSectionSlideCounts.ts", { "@/lib/compiledSectionMetadata": metadata, "@/lib/sectionSlideCount": { getCompiledSectionMetadata: compiledCounter.getCompiledSectionMetadata, readSectionSlideCount: (id, type, signal) => new Promise(resolve => reads.push({ id, type, signal, resolve })) } });
  function Harness({ sections }) { return React.createElement("pre", null, JSON.stringify(useSectionSlideCounts("course", sections))); }
  const container = window.document.createElement("div"), root = createRoot(container);
  const sections = [1, 2, 3].map(id => ({ id: String(id), contentType: "tsx", contentRevision: "old" }));
  try {
    await act(async () => root.render(React.createElement(Harness, { sections })));
    assert.equal(reads.length, 2);
    await act(async () => root.render(React.createElement(Harness, { sections: sections.map(section => ({ ...section })) })));
    assert.equal(reads.length, 2, "equal catalog refreshes must not restart expensive file reads");
    assert.equal(reads[0].signal.aborted, false);
    await act(async () => reads[0].resolve(8));
    assert.equal(reads.length, 3);
    assert.equal(JSON.parse(container.textContent)["1"], 8);
    const replaced = [{ ...sections[0], contentRevision: "new" }];
    await act(async () => root.render(React.createElement(Harness, { sections: replaced })));
    assert.equal(reads[1].signal.aborted, true);
    assert.equal(JSON.parse(container.textContent)["1"], undefined);
    await act(async () => reads[3].resolve(11));
    assert.equal(JSON.parse(container.textContent)["1"], 11);
    await act(async () => root.render(React.createElement(Harness, {})));
    assert.equal(reads[3].signal.aborted, true);
    assert.equal(container.textContent, "{}");
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});

test("role previews reuse completed slide counts when returning to a role or reopening the section list", async () => {
  const window = new Window();
  for (const name of ["window", "document", "HTMLElement", "navigator"]) Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const reads = [];
  const { useSectionSlideCounts } = load("components/useSectionSlideCounts.ts", { "@/lib/compiledSectionMetadata": metadata, "@/lib/sectionSlideCount": { getCompiledSectionMetadata: compiledCounter.getCompiledSectionMetadata, readSectionSlideCount: async (id, type, signal, isAdmin) => { reads.push({ id, isAdmin }); return isAdmin ? 30 : 29; } } });
  function Harness({ sections, isAdmin }) { return React.createElement("pre", null, JSON.stringify(useSectionSlideCounts("course", sections, isAdmin))); }
  const container = window.document.createElement("div"), root = createRoot(container);
  const sections = [{ id: "s", contentType: "tsx", contentRevision: "v1" }];
  const render = (isAdmin, value = sections) => root.render(React.createElement(Harness, { sections: value, isAdmin }));
  try {
    await act(async () => render(true));
    assert.equal(JSON.parse(container.textContent).s, 30);
    await act(async () => render(false));
    assert.equal(JSON.parse(container.textContent).s, 29);
    await act(async () => render(true));
    assert.equal(JSON.parse(container.textContent).s, 30);
    await act(async () => render(true, null));
    await act(async () => render(false));
    assert.equal(JSON.parse(container.textContent).s, 29);
    assert.equal(reads.length, 2, "each role is counted only once per content revision");
    await act(async () => render(false, [{ ...sections[0], contentRevision: "v2" }]));
    assert.equal(reads.length, 3, "a content replacement still invalidates the cached count");
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});
