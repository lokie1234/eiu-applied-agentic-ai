function mountSectionPage({ stage, svg, read }, value) {
  const { Cam, clamp, fit, proj, rrect, poly, open, seg, rad,
    tween, tset, tval, tdone, mk, pointer, register, disposer } = HL;
  const bag = disposer(), C = Cam(45, .5, 1.8);
  fit(C, [[-62, -45, 0], [62, 45, 0], [-62, 45, 0], [62, -45, 0],
    [52, 40, 50]], 200, 166);
  const P = proj(C), g = mk('g', {}, svg);
  const ring = rrect(-60, -43, 60, 43, 4, 6);
  // Keep straight edges intact up to the diagonal hinge, rather than bowing the whole page.
  const foldedRing = ring.flatMap((q, i) => {
    const next = ring[(i+1)%ring.length], a = q.u+q.v-60, b = next.u+next.v-60;
    if (a*b >= 0) return [q];
    const t = a/(a-b);
    return [q, { u: q.u+(next.u-q.u)*t, v: q.v+(next.v-q.v)*t }];
  });
  mk('path', { class: 'sil', 'data-part': 'page-back', d: poly(ring.map(q => P(q.u+3, q.v+3, 0))) }, g);
  mk('path', { class: 'sil', 'data-part': 'page-back', d: poly(ring.map(q => P(q.u-2, q.v+1, 4))) }, g);
  const bodyRing = foldedRing.filter(q => q.u+q.v <= 60.001);
  const cornerRing = foldedRing.filter(q => q.u+q.v >= 59.999);
  const page = mk('path', { class: 'sil', 'data-part': 'page-face' }, g);
  const heading = mk('path', { class: 'nf' }, g), lines = mk('path', { class: 'nf lo' }, g);
  const flap = mk('path', { class: 'sil hi', 'data-part': 'page-face' }, g);
  const fold = mk('path', { class: 'nf lo' }, g);
  const corner = tween(10), lift = tween(0);
  let amount = clamp(value, 28, 76), active = false, last = null;
  function draw(now) {
    const a = tval(corner, now), z = tval(lift, now), state = `${a}:${z}`;
    if (state === last) return;
    last = state;
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    const fp = (u, v) => {
      const d = Math.max(0, (u+v-60)/Math.SQRT2);
      return P(u-d*(1-c)/Math.SQRT2, v-d*(1-c)/Math.SQRT2, 9+z+d*s);
    };
    page.setAttribute('d', poly(bodyRing.map(q => fp(q.u, q.v))));
    flap.setAttribute('d', poly(cornerRing.map(q => fp(q.u, q.v))));
    fold.setAttribute('d', seg(fp(18, 42), fp(59, 1)));
    heading.setAttribute('d', seg(fp(-43, -27), fp(21, -27)));
    lines.setAttribute('d', [-14, -3, 8, 19].map((v,i) => seg(fp(-43, v), fp(i===3 ? -7 : 28, v))).join(''));
    // The host reveals its upright action outside the page after the corner opens.
    flap.setAttribute('data-action-reveal',String(clamp((a-30)/30,0,1)));
  }
  const B = register(stage, (_dt, now) => { draw(now); return !tdone(corner, now) || !tdone(lift, now); });
  bag.add(B.unregister);
  function retarget() {
    const now = performance.now(), engaged = active || amount >= 76;
    tset(corner, engaged ? amount : 10, now, 0);
    tset(lift, engaged ? 3 : 0, now, 40);
    read.textContent = engaged ? 'page' : 'rest'; B.wake();
  }
  function engage(next) { if (next !== active) { active = next; retarget(); } }
  bag.add(pointer(stage, { move: ([x,y]) => engage(x >= 52 && x <= 348 && y >= 60 && y <= 278),
    down: () => engage(true), leave: () => engage(false) }));
  bag.add(() => svg.replaceChildren());
  read.textContent = 'rest'; draw(performance.now());
  return { set: v => { amount = clamp(v, 28, 76); retarget(); }, destroy: bag.dispose };
}
hairline({ name: 'section-page', means: 'A loose page turns up its rounded corner, lifting slightly from the sheets underneath.',
  rules: [1, 2, 3, 5, 7, 8, 9, 10], range: [28, 52, 76],
  tour: [[175, 140], [265, 208], null], mount: mountSectionPage });
