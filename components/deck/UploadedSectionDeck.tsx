"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import SharedDeckFrame from "@/components/deck/SharedDeckFrame";
import styles from "./UploadedSectionDeck.module.css";
import PptxSectionDeck from "./PptxSectionDeck";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Props = {
  sectionId: string;
  contentType: "pdf" | "tsx" | "pptx";
  slideCount: number | null;
  courseTitle: string;
  sectionTitle: string;
};

function createTsxDocument(compiledCode: string, pageNumber: number) {
  const encodedCode = JSON.stringify(compiledCode).replace(/</g, "\\u003c");
  // Compiled TSX runs via Function inside an opaque-origin sandbox. Network
  // access stays blocked; allow-downloads supports locally embedded datasets.
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:"><style>
    *{box-sizing:border-box}html,body,#root{width:100%;height:100%;margin:0;overflow:hidden}
    body{font-family:Inter,Arial,sans-serif;background:#fff;color:#082945}
    #root>*,.slide{width:100%;height:100%}button,a,[role=button]{cursor:pointer}
    #error{padding:32px;white-space:pre-wrap;color:#8b1e1e;background:#fff3f1;font:14px/1.5 Consolas,monospace}
  </style></head><body><div id="root"></div><script>
  (()=>{
    const root=document.getElementById('root');
    const Fragment=Symbol('Fragment');
    const append=(parent,value)=>{if(value==null||value===false||value===true)return;if(Array.isArray(value)){value.forEach(v=>append(parent,v));return;}if(value instanceof Node){parent.appendChild(value);return;}parent.appendChild(document.createTextNode(String(value)));};
    const h=(type,props,...children)=>{props=props||{};if(type===Fragment)return children;if(typeof type==='function')return type({...props,children});const svgTags=new Set(['svg','path','circle','rect','line','polyline','polygon','g','text','defs','linearGradient','stop']);const el=svgTags.has(type)?document.createElementNS('http://www.w3.org/2000/svg',type):document.createElement(type);Object.entries(props).forEach(([key,value])=>{if(key==='children'||value==null)return;if(key==='className'){el.setAttribute('class',String(value));return;}if(key==='style'&&typeof value==='object'){Object.assign(el.style,value);return;}if(key==='dangerouslySetInnerHTML')return;if(/^on[A-Z]/.test(key)&&typeof value==='function'){el.addEventListener(key.slice(2).toLowerCase(),value);return;}const attr=key==='htmlFor'?'for':key;try{if(attr in el&&typeof value!=='object')el[attr]=value;else el.setAttribute(attr,String(value));}catch{el.setAttribute(attr,String(value));}});append(el,children);return el;};
    const React={createElement:h,Fragment};
    try{const module={exports:{}};const exports=module.exports;new Function('module','exports','h','Fragment','React',${encodedCode})(module,exports,h,Fragment,React);let candidate=module.exports.default??module.exports.slides??module.exports;if(typeof candidate==='function')candidate=candidate();const slides=Array.isArray(candidate)?candidate:[candidate];parent.postMessage({type:'eiu-tsx-ready',slides:slides.length},'*');const active=slides[${Math.max(0, pageNumber - 1)}];const rendered=typeof active==='function'?active():active;append(root,rendered??h('div',{id:'error'},'Slide is empty.'));}catch(error){root.innerHTML='<div id="error"></div>';document.getElementById('error').textContent=error&&error.stack?error.stack:String(error);}
  })();
  <\/script></body></html>`;
}

export default function UploadedSectionDeck({ sectionId, contentType, slideCount, courseTitle, sectionTitle }: Props) {
  const [totalSlides, setTotalSlides] = useState(slideCount ?? 1);
  const [tsxCode, setTsxCode] = useState("");
  const [error, setError] = useState("");
  const contentUrl = `/api/sections/${encodeURIComponent(sectionId)}/content`;

  useEffect(() => {
    if (contentType !== "tsx") return;
    let disposed = false;
    fetch(contentUrl, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load TSX section content.");
        return response.text();
      })
      .then((code) => { if (!disposed) setTsxCode(code); })
      .catch((reason) => { if (!disposed) setError(reason instanceof Error ? reason.message : "Unable to load content."); });
    return () => { disposed = true; };
  }, [contentType, contentUrl]);

  useEffect(() => {
    if (contentType !== "tsx") return;
    function onMessage(event: MessageEvent) {
      const payload = event.data as { type?: string; slides?: number };
      if (payload?.type === "eiu-tsx-ready" && Number(payload.slides) > 0) setTotalSlides(Number(payload.slides));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [contentType]);

  const renderPdf = (pageNumber: number, renderWidth: number) => (
    <Document
      className={styles.pdfDocument}
      file={contentUrl}
      loading={<div className={styles.message}>Loading PDF…</div>}
      error={<div className={styles.message}>Unable to display this PDF.</div>}
      onLoadSuccess={({ numPages }) => setTotalSlides(numPages)}
    >
      <Page
        className={styles.pdfPage}
        pageNumber={pageNumber}
        width={renderWidth}
        renderTextLayer={false}
        renderAnnotationLayer
      />
    </Document>
  );

  const frameDocument = useMemo(() => {
    if (!tsxCode) return "";
    return createTsxDocument(tsxCode, 1);
  }, [tsxCode]);

  if (contentType === "pptx") {
    return <PptxSectionDeck sectionId={sectionId} courseTitle={courseTitle} sectionTitle={sectionTitle} />;
  }

  return (
    <SharedDeckFrame
      courseTitle={courseTitle}
      sectionTitle={sectionTitle}
      totalSlides={totalSlides}
      frameClassName={styles.frame}
      transitionClassName={styles.slide}
      renderSlide={(pageNumber, renderWidth) => {
        if (error) return <div className={styles.message}>{error}</div>;
        if (contentType === "pdf") return renderPdf(pageNumber, renderWidth);
        if (!tsxCode) return <div className={styles.message}>Loading TSX section…</div>;
        return (
          <iframe
            className={styles.tsxFrame}
            sandbox="allow-scripts allow-downloads"
            title={`${sectionTitle} · slide ${pageNumber}`}
            srcDoc={pageNumber === 1 ? frameDocument : createTsxDocument(tsxCode, pageNumber)}
          />
        );
      }}
    />
  );
}
