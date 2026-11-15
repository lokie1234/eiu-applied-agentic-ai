// Keep native-content regressions tied to the former slide's content after the
// four RCA pages move into slide 2. Hub integration is tested separately.
export function formerSection2Slide(slides, index) {
  const key={2:'comparison',4:'process',5:'mapping',6:'tools',8:'exercise'}[index];
  if(key){
    const root=slides[1]();root.ownerDocument.body.appendChild(root);
    root.querySelector(`[data-rca-open=${key}]`).click();
    return root.querySelector(`[data-rca-hub-pane=${key}]`);
  }
  if(index===3){const root=slides[1]();root.ownerDocument.body.appendChild(root);root.querySelector('[data-rca-open=comparison]').click();const pane=root.querySelector('[data-rca-hub-pane=comparison]');pane.querySelector('[data-open-tree]').click();return root.querySelector('#mis311-problem-tree-details .mis311-rca-hub-pane');}
  const streamKey={10:'parts',11:'importance'}[index];
  if(streamKey){const root=slides[3]();root.ownerDocument.body.appendChild(root);root.querySelector(`[data-rca-open=${streamKey}]`).click();return root.querySelector(`[data-rca-hub-pane=${streamKey}]`);}
  if(index===14){const root=slides[5]();root.ownerDocument.body.appendChild(root);root.querySelector('[data-rca-open=model]').click();return root.querySelector('[data-rca-hub-pane=model]');}
  return slides[index>=15?index-9:index>=12?index-8:index===9?3:index===7?2:index]();
}
