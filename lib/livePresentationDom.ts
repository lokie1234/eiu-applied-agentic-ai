import type { LiveDocument, LiveNode, LivePatch } from './livePresentationProtocol';

// Browser-native visuals only: never execute scripts, forms, links or event handlers on a follower.
export function captureLiveDocument(document: Document, page: number, ids: WeakMap<Node, number>, allocate: () => number): LiveDocument {
  const nodes: LiveNode[] = [];
  const visit = (node: Node): number | null => {
    if (node.nodeType !== 1 && node.nodeType !== 3) return null;
    const el = node.nodeType === 1 ? node as Element : null;
    if (el && /^(script|iframe|object|embed|link|meta|base|noscript)$/i.test(el.tagName)) return null;
    let id = ids.get(node);if (!id) { id = allocate();ids.set(node, id); }
    if (!el) { nodes.push({ id, tag: '#text', text: node.textContent || '' });return id; }
    const attrs: Record<string,string> = {};
    for (const attr of el.attributes) {
      if (/^on/i.test(attr.name) || /^(srcdoc|action|formaction)$/i.test(attr.name)) continue;
      if (/^(href|xlink:href)$/i.test(attr.name) && (!['image','use'].includes(el.localName) || !/^(#|data:image\/)/i.test(attr.value))) continue;
      attrs[attr.name] = attr.value;
    }
    if (el instanceof document.defaultView!.HTMLInputElement) {
      delete attrs.value;
      if (el.type === 'password') attrs.value = '';
      else if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) attrs.checked = ''; else delete attrs.checked; }
      else attrs.value = el.value;
    }
    const concealed = el.hasAttribute('hidden') || (el.localName === 'dialog' && !el.hasAttribute('open'));
    const children = concealed ? [] : [...node.childNodes].map(visit).filter((id): id is number => id !== null);
    const html = el as HTMLElement;
    // Fractional layout rounding and browser overscroll can exceed scroll bounds.
    const fraction=(offset:number,extent:number)=>extent>0&&Number.isFinite(offset)?Math.min(1,Math.max(0,offset/extent)):0;
    const left=html.scrollLeft<0&&document.defaultView?.getComputedStyle(el).direction==='rtl'?-html.scrollLeft:html.scrollLeft;
    const scroll: [number,number] = [fraction(left,html.scrollWidth-html.clientWidth),fraction(html.scrollTop,html.scrollHeight-html.clientHeight)];
    const animations = el.getAnimations?.().slice(0,12).map(animation=>{const time=Number(animation.currentTime);return Number.isFinite(time)?Math.max(0,time):0;});
    nodes.push({ id, tag: el.localName, ns: el.namespaceURI || undefined, attrs, children, ...(scroll.some(Boolean) ? { scroll } : {}), ...(animations?.length ? { animations } : {}), ...(el.localName === 'dialog' ? { modal: el.matches(':modal') } : {}) });
    return id;
  };
  const root = visit(document.documentElement)!;
  return { root, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, page, nodes };
}

export function diffLiveDocument(previous: LiveDocument | null, next: LiveDocument): LivePatch {
  const reset = !previous || previous.root !== next.root;
  // Embedded fonts can make a single style node half a megabyte. Compare its
  // text directly rather than allocating two escaped JSON strings on every click.
  const old = new Map((reset ? [] : previous.nodes).map(node => [node.id, node]));
  const equalArray=(a:readonly number[]|undefined,b:readonly number[]|undefined)=>(a?.length||0)===(b?.length||0)&&(a||[]).every((value,index)=>value===b?.[index]);
  const equal=(a:LiveNode|undefined,b:LiveNode)=>{
    if(!a||a.tag!==b.tag||a.ns!==b.ns||a.text!==b.text||a.modal!==b.modal||!equalArray(a.children,b.children)||!equalArray(a.scroll,b.scroll)||!equalArray(a.animations,b.animations))return false;
    const keys=Object.keys(a.attrs||{});return keys.length===Object.keys(b.attrs||{}).length&&keys.every(key=>a.attrs![key]===b.attrs?.[key]);
  };
  const current = new Set(next.nodes.map(node => node.id));
  return { root: next.root, page: next.page, width: next.width, height: next.height, reset, nodes: next.nodes.filter(node => !equal(old.get(node.id),node)), removed: reset ? [] : previous.nodes.filter(node => !current.has(node.id)).map(node => node.id) };
}

export function renderLiveDocument(document: Document, state: LiveDocument, cache: Map<number, Node>) {
  const records = new Map(state.nodes.map(node => [node.id,node]));
  const pending: Array<() => void> = [];
  const blocked = /^(script|iframe|object|embed|link|meta|base)$/i;
  const build = (id: number): Node => {
    const record = records.get(id)!;
    let node = cache.get(id);
    if (!node) { node = record.tag === '#text' ? document.createTextNode('') : blocked.test(record.tag) ? document.createElement('span') : document.createElementNS(record.ns || 'http://www.w3.org/1999/xhtml', record.tag);cache.set(id,node); }
    if (record.tag === '#text') { if(node.textContent !== record.text) node.textContent = record.text || '';return node; }
    const el = node as Element, attrs = record.attrs || {};
    if(record.tag==='dialog'&&(el as HTMLDialogElement).open&&(!('open' in attrs)||(!record.modal&&el.matches(':modal'))))(el as HTMLDialogElement).close();
    for (const attr of [...el.attributes]) if (!(attr.name in attrs)) el.removeAttribute(attr.name);
    for (const [key,value] of Object.entries(attrs)) {
      if (/^on/i.test(key) || /^(srcdoc|action|formaction|autofocus)$/i.test(key) || (key === 'src' && !/^(data:image\/|blob:)/i.test(value))) continue;
      if (/^(href|xlink:href)$/i.test(key) && (!['image','use'].includes(record.tag) || !/^(#|data:image\/)/i.test(value))) continue;
      if (el.getAttribute(key) !== value) { try { if(key==='xlink:href')el.setAttributeNS('http://www.w3.org/1999/xlink',key,value);else el.setAttribute(key,value); } catch { /* Unsupported names are ignored. */ } }
    }
    const children = (record.children || []).map(build);
    children.forEach((child,index) => { if(el.childNodes[index] !== child) el.insertBefore(child,el.childNodes[index] || null); });
    while(el.childNodes.length > children.length) el.lastChild!.remove();
    if (record.tag === 'input' && el instanceof document.defaultView!.HTMLInputElement) { el.value = attrs.value || '';el.checked = 'checked' in attrs; }
    if(record.tag === 'dialog') pending.push(() => {
      const dialog = el as HTMLDialogElement;
      if (record.modal && !dialog.matches(':modal')) { dialog.removeAttribute('open');dialog.showModal(); }
      if (!('open' in attrs) && dialog.open) dialog.close();
    });
    pending.push(() => { const html=el as HTMLElement;const direction=record.scroll?.[0]&&document.defaultView?.getComputedStyle(el).direction==='rtl'?-1:1;html.scrollLeft=direction*(record.scroll?.[0] || 0)*Math.max(0,html.scrollWidth-html.clientWidth);html.scrollTop=(record.scroll?.[1] || 0)*Math.max(0,html.scrollHeight-html.clientHeight); });
    if(record.animations)pending.push(()=>{el.getAnimations?.().forEach((animation,i)=>{const time=record.animations?.[i];if(time!==undefined&&Math.abs(Number(animation.currentTime)-time)>120)animation.currentTime=time;});});
    return el;
  };
  const html = build(state.root);
  if (document.documentElement !== html) { document.removeChild(document.documentElement);document.appendChild(html); }
  for (const id of cache.keys()) if(!records.has(id)) cache.delete(id);
  pending.forEach(run => run());
}
