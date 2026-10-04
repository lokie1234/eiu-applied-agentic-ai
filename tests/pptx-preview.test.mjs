import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import JSZip from "jszip";

test("PPTX preview renders two slides and disposes their DOM without modifying the source", async () => {
  const window = new Window();
  // Happy DOM omits this XML DOM method that real browsers provide.
  window.Element.prototype.lookupNamespaceURI = function (prefix) {
    const attribute = prefix ? `xmlns:${prefix}` : "xmlns";
    if (this.hasAttribute(attribute)) return this.getAttribute(attribute);
    for (let element = this.parentElement; element; element = element.parentElement) {
      if (element.hasAttribute(attribute)) return element.getAttribute(attribute);
    }
    return null;
  };
  for (const key of ["document", "DOMParser", "HTMLElement", "Element", "Node", "CustomEvent", "Event", "EventTarget", "ResizeObserver", "getComputedStyle"]) {
    globalThis[key] = key === "getComputedStyle" ? window.getComputedStyle.bind(window) : window[key];
  }
  globalThis.window = window;
  const { parseZipLazyMedia, buildPresentation, PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import("@aiden0z/pptx-renderer");
  const zip = new JSZip();
  const p = "http://schemas.openxmlformats.org/presentationml/2006/main";
  const a = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const r = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file("ppt/presentation.xml", `<p:presentation xmlns:p="${p}" xmlns:r="${r}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${r}/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="${r}/slide" Target="slides/slide2.xml"/></Relationships>`);
  for (const [index, text] of ["First slide content", "Second slide content"].entries()) {
    zip.file(`ppt/slides/slide${index + 1}.xml`, `<p:sld xmlns:p="${p}" xmlns:a="${a}" xmlns:r="${r}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="6000000" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="2400"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  }
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  const original = new Uint8Array(bytes.slice(0));
  const files = await parseZipLazyMedia(bytes, RECOMMENDED_ZIP_LIMITS);
  const viewer = new PptxViewer(window.document.createElement("div"), { pdfjs: false });
  viewer.load(buildPresentation(files, { lazySlides: true }));
  assert.equal(viewer.slideCount, 2);
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  // Repeated setup/cleanup also covers React Strict Mode and zoom rerenders.
  for (const index of [0, 0, 1, 1, 0]) {
    const text = ["First slide content", "Second slide content"][index];
    container.replaceChildren();
    const handle = viewer.renderSlideToContainer(index, container, 0.5);
    assert.ok(handle);
    await handle.ready;
    assert.match(container.textContent, new RegExp(text));
    assert.equal(container.childElementCount, 1);
    assert.equal(container.textContent.split(text).length - 1, 1);
    handle.dispose();
    handle.element.remove();
    assert.equal(container.childElementCount, 0);
  }
  viewer.destroy();
  assert.deepEqual(new Uint8Array(bytes), original);
  await window.happyDOM.close();
});
