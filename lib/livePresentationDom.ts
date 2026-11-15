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
    const scroll: [number,number] = [html.scrollWidth > html.clientWidth ? html.scrollLeft / (html.scrollWidth - html.clientWidth) : 0, html.scrollHeight > html.clientHeight ? html.scrollTop / (html.scrollHeight - html.clientHeight) : 0];
    const animations = el.getAnimations?.().slice(0,12).map(animation=>Math.max(0,Number(animation.currentTime)||0));
    nodes.push({ id, tag: el.localName, ns: el.namespaceURI || undefined, attrs, children, ...(scroll.some(Boolean) ? { scroll } : {}), ...(animations?.length ? { animations } : {}), ...(el.localName === 'dialog' ? { modal: el.matches(':modal') } : {}) });
    return id;
  };
  const root = visit(document.documentElement)!;
  return { root, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight, page, nodes };
}

export function diffLiveDocument(previous: LiveDocument | null, next: LiveDocument): LivePatch {
  const reset = !previous || previous.root !== next.root;
  const old = new Map((reset ? [] : previous.nodes).map(node => [node.id, JSON.stringify(node)]));
  const current = new Set(next.nodes.map(node => node.id));
  return { root: next.root, page: next.page, width: next.width, height: next.height, reset, nodes: next.nodes.filter(node => old.get(node.id) !== JSON.stringify(node)), removed: reset ? [] : previous.nodes.filter(node => !current.has(node.id)).map(node => node.id) };
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
    pending.push(() => { const html=el as HTMLElement; html.scrollLeft=(record.scroll?.[0] || 0)*Math.max(0,html.scrollWidth-html.clientWidth);html.scrollTop=(record.scroll?.[1] || 0)*Math.max(0,html.scrollHeight-html.clientHeight); });
    if(record.animations)pending.push(()=>{el.getAnimations?.().forEach((animation,i)=>{const time=record.animations?.[i];if(time!==undefined&&Math.abs(Number(animation.currentTime)-time)>120)animation.currentTime=time;});});
    return el;
  };
  const html = build(state.root);
  if (document.documentElement !== html) { document.removeChild(document.documentElement);document.appendChild(html); }
  for (const id of cache.keys()) if(!records.has(id)) cache.delete(id);
  pending.forEach(run => run());
}
