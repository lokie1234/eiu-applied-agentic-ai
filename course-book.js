function mountCourseBook({ stage, svg, read }, value) {
  const { Cam, clamp, facing, fit, proj, rings, prism, solid, put, rrect,
    poly, open, seg, hull, rad, tween, tset, tval, tdone, mk, pointer, register, disposer } = HL;
  const bag = disposer(), C = Cam(45, .5, 1.3);
  fit(C, [[-70, -48, 0], [70, 48, 0], [-70, 48, 0], [70, -48, 0],
    [68, -48, 155], [68, 48, 155]], 200, 166);
  const P = proj(C), front = facing(C), g = mk('g', {}, svg);
  const [coverRing, coverInner] = rings(-68, -47, 68, 47, 5, 2);
  const [pageRing, pageInner] = rings(-63, -42, 63, 42, 3, 1.5);
  const bottom = solid(g), block = solid(g);
  bottom.sil.setAttribute('data-part', 'book-cover');
  block.sil.setAttribute('data-part', 'book-pages');
  put(bottom, prism(P, front, coverRing, coverInner, 0, 4));
  put(block, prism(P, front, pageRing, pageInner, 4, 15));
  mk('path', { class: 'nf lo', d: seg(P(-56, 42, 8), P(59, 42, 8)) + seg(P(63, -35, 10), P(63, 36, 10)) }, g);
  const pages = [0, 1].map(i => ({ i, face: mk('path', { class: 'sil', 'data-part': 'book-page' }, g),
    a: tween(2 + i * 2), last: null }));
  const cover = mk('path', { class: 'sil hi', 'data-part': 'book-cover' }, g);
  const crease = mk('path', { class: 'nf lo' }, g), spine = mk('path', { class: 'nf lo' }, g);
  const bookmark = mk('path', { class: 'sil', 'data-part': 'book-bookmark' }, g);
  const angle = tween(7);
  let amount = clamp(value, 10, 76), active = false, lastAngle = null;
  const pose = (a, z) => {
    const s = Math.sin(rad(a)), c = Math.cos(rad(a));
    return (u, v, dz = 0) => P(-68 + (u + 68) * c, v, z + (u + 68) * s + dz);
  };
  function draw(now) {
    pages.forEach(cd => {
      const a = tval(cd.a, now);
      if (a === cd.last) return;
      cd.last = a;
      const pp = pose(a, 16 + cd.i);
      cd.face.setAttribute('d', poly(pageRing.map(q => pp(q.u, q.v))));
    });
    const a = tval(angle, now);
    if (a === lastAngle) return;
    lastAngle = a;
    const cp = pose(a, 19);
    cover.setAttribute('d', poly(hull(coverRing.flatMap(q => [cp(q.u, q.v), cp(q.u, q.v, 2)]))));
    crease.setAttribute('d', open(coverInner.filter(q => q.v > 0 || q.u > 0).map(q => cp(q.u, q.v, 2))));
    spine.setAttribute('d', seg(cp(-55, -37, 2), cp(-55, 37, 2)));
    bookmark.setAttribute('d', poly(rrect(26, -53, 36, -37, 2, 6).map(q => cp(q.u, q.v, 2))));
    // The host reveals its upright action outside the book as the cover opens.
    cover.setAttribute('data-action-reveal', String(clamp((a-32)/30,0,1)));
  }
  const B = register(stage, (_dt, now) => {
    draw(now); return !tdone(angle, now) || pages.some(cd => !tdone(cd.a, now));
  });
  bag.add(B.unregister);
  function retarget() {
    const now = performance.now(), engaged = active || amount >= 76;
    tset(angle, engaged ? amount : 7, now, 0);
    pages.forEach(cd => tset(cd.a, engaged ? amount * (.07 + cd.i * .06) : 2 + cd.i * 2, now, (2-cd.i)*40));
    read.textContent = engaged ? 'cover' : 'rest'; B.wake();
  }
  function engage(next) { if (next !== active) { active = next; retarget(); } }
  bag.add(pointer(stage, { move: ([x, y]) => engage(x >= 48 && x <= 352 && y >= 70 && y <= 278),
    down: () => engage(true), leave: () => engage(false) }));
  bag.add(() => svg.replaceChildren());
  read.textContent = 'rest'; draw(performance.now());
  return { set: v => { amount = clamp(v, 10, 76); retarget(); }, destroy: bag.dispose };
}
hairline({ name: 'course-book', means: 'A bound book opens its rounded cover; two leaves follow from the spine.',
  rules: [1, 2, 3, 5, 7, 8, 9, 10], range: [40, 58, 76],
  tour: [[205, 145], [285, 215], null], mount: mountCourseBook });
