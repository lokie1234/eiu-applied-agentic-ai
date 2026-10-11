function mountCourseFolder({ stage, svg, read }, value) {
  const { Cam, clamp, fillet, fit, open, poly, proj, rad, rrect, seg,
    tdone, tset, tval, tween, disposer, mk, pointer, register } = HL;
  const bag = disposer();
  const C = Cam(45, .5, 1.5);
  // The broad face looks toward the reader; the camera remains isometric.
  const bounds = [-65, 65].flatMap(u => [-30, 60].flatMap(depth => [0, 150].map(z => [u, -u + depth, z])));
  fit(C, bounds, 200, 166);
  const P = proj(C);
  const g = mk("g", {}, svg);
  const outline = fillet([[-58, 0], [58, 0], [58, 82], [-10, 82],
    [-10, 94], [-48, 94], [-48, 82], [-58, 82]], [4, 4, 4, 2, 3, 3, 2, 4]);
  const back = mk("path", { class: "sil", "data-part": "folder-back" }, g);
  back.setAttribute("d", poly(outline.map(([u, v]) => P(u, -u - 24, v))));
  mk("path", { class: "nf lo", d: seg(P(-48, 24, 82), P(-10, -14, 82)) }, g);
  let amount = clamp(value, 18, 58), active = false, lastAngle = null;
  const selected = () => amount >= 38;
  const papers = Array.from({ length: 3 }, (_, i) => {
    const grp = mk("g", {}, g);
    return { i, face: mk("path", { class: "sil", "data-part": "folder-paper" }, grp),
      crease: mk("path", { class: "nf lo" }, grp), lift: tween((selected() ? 14 : 4) + i * 3),
      lean: tween(-6 + i * 6), spread: tween(0), last: null };
  });
  const cover = mk("path", { class: "sil hi", "data-part": "folder-cover" }, g);
  const crease = mk("path", { class: "nf lo" }, g);
  const rim = mk("path", { class: "nf lo" }, g);
  const angle = tween(selected() ? 18 : 12);
  const paperRing = rrect(-51, 7, 51, 84, 3, 6);
  const coverRing = rrect(-60, 0, 60, 73, 4, 6);

  function draw(now) {
    const a = tval(angle, now);
    papers.forEach(cd => {
      const lift = tval(cd.lift, now);
      const lean = tval(cd.lean, now), spread = tval(cd.spread, now);
      const state = `${lift}:${lean}:${spread}`;
      if (state === cd.last) return;
      cd.last = state;
      const pp = (u, v) => P(u + spread, -u - spread - 16 + cd.i * 9 + v * Math.sin(rad(lean)), v * Math.cos(rad(lean)) + lift);
      cd.face.setAttribute("d", poly(paperRing.map(q => pp(q.u, q.v))));
      cd.crease.setAttribute("d", open([pp(-43, 75), pp(43, 75)]));
    });
    if (a !== lastAngle) {
      lastAngle = a;
      const s = Math.sin(rad(a)), c = Math.cos(rad(a));
      const face = (u, v) => P(u, -u + 26 + v * s, v * c);
      cover.setAttribute("d", poly(coverRing.map(q => face(q.u, q.v))));
      crease.setAttribute("d", open([face(-52, 66), face(52, 66)]));
      rim.setAttribute("d", seg(face(-52, 5), face(52, 5)));
      // The application may position its existing brand asset on this plane.
      const origin = face(-45, 59), x = face(45, 59), y = face(-45, 9);
      cover.setAttribute("data-logo-transform", `matrix(${(x[0] - origin[0]) / 100},${(x[1] - origin[1]) / 100},${(y[0] - origin[0]) / 28},${(y[1] - origin[1]) / 28},${origin[0]},${origin[1]})`);
    }
  }

  const B = register(stage, (_dt, now) => {
    draw(now);
    return !tdone(angle, now) || papers.some(cd => !tdone(cd.lift, now) || !tdone(cd.lean, now) || !tdone(cd.spread, now));
  });
  bag.add(B.unregister);

  function retarget() {
    const now = performance.now();
    const engaged = active || amount > 50;
    tset(angle, engaged ? 22 : selected() ? 18 : 12, now, 0);
    papers.forEach(cd => {
      const delay = Math.abs(cd.i - 1) * 40;
      tset(cd.lift, engaged ? [38, 54, 42][cd.i] : (selected() ? 14 : 4) + cd.i * 3, now, delay);
      tset(cd.lean, engaged ? -12 + cd.i * 12 : -6 + cd.i * 6, now, delay);
      tset(cd.spread, engaged ? (cd.i - 1) * 13 : 0, now, delay);
    });
    read.textContent = engaged ? "open" : "rest";
    B.wake();
  }
  function choose(next) {
    if (active === next) return;
    active = next;
    retarget();
  }
  // A fixed band contains the full resting folder, including its tab.
  bag.add(pointer(stage, {
    move: ([x, y]) => choose(x >= 62 && x <= 338 && y >= 52 && y <= 276),
    down: () => choose(true), leave: () => choose(false),
  }));
  bag.add(() => svg.replaceChildren());
  read.textContent = "rest";
  draw(performance.now());
  return { set: v => { amount = clamp(v, 18, 58); retarget(); }, destroy: bag.dispose };
}

hairline({
  name: "course-folder",
  means: "A tabbed folder fans three sheets upward, with the middle sheet leading the lift.",
  rules: [1, 2, 5, 7, 8, 9, 10],
  range: [18, 38, 58],
  tour: [[140, 140], [260, 180], null],
  mount: mountCourseFolder,
});
