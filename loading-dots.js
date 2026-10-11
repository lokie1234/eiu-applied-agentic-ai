function mountLoadingDots({ stage, svg, read }, value) {
  const { Cam, clamp, facing, fit, prism, proj, rings, solid, put,
    tween, tset, tval, tdone, reducedMotion, pointer, register, disposer } = HL;
  const bag = disposer(), C = Cam(45, .5, 1.6);
  fit(C, [[-80, 80, 0], [80, -80, 50]], 200, 166);
  const P = proj(C), front = facing(C), started = performance.now();
  let amplitude = clamp(value, 8, 24), automatic = false, active = -1;
  const [ring, inner] = rings(-9, -9, 9, 9, 9, 1.2);
  const beads = Array.from({ length: 5 }, (_, i) => {
    const shape = solid(svg);
    shape.sil.setAttribute("data-part", "loading-bead");
    shape.sil.classList.toggle("hi", i === 0);
    return { i, shape, lift: tween(8), last: null };
  });
  function draw(now) {
    beads.forEach(bead => {
      const wave = Math.max(0, Math.sin((now - started) / 1200 * Math.PI * 2 - bead.i * .65));
      const z = automatic ? 8 + (reducedMotion() ? 0 : wave * 18) : tval(bead.lift, now);
      if (z === bead.last) return;
      bead.last = z;
      const u = (bead.i - 2) * 32;
      const at = (x, y, height) => P(x + u, y - u, height);
      put(bead.shape, prism(at, front, ring, inner, z - 4, z + 4));
    });
  }
  const B = register(stage, (_dt, now) => {
    draw(now);
    // Repetition is explicitly required while a section is loading.
    return automatic ? !reducedMotion() : beads.some(bead => !tdone(bead.lift, now));
  });
  bag.add(B.unregister);
  function retarget() {
    const now = performance.now();
    beads.forEach(bead => {
      const distance = Math.abs(bead.i - active);
      tset(bead.lift, active < 0 ? 8 : 8 + amplitude * Math.max(0, 1 - distance / 3), now, distance * 40);
      bead.shape.sil.classList.toggle("hi", bead.i === (active < 0 ? 0 : active));
    });
    read.textContent = active < 0 ? "rest" : `bead ${active + 1}`;
    B.wake();
  }
  function choose(next) {
    if (automatic || active === next) return;
    active = next;
    retarget();
  }
  bag.add(pointer(stage, {
    move: ([x, y]) => choose(x >= 40 && x <= 360 && y >= 110 && y <= 225 ? clamp(Math.round((x - 55) / 72), 0, 4) : -1),
    down: ([x]) => choose(clamp(Math.round((x - 55) / 72), 0, 4)),
    leave: () => choose(-1),
  }));
  bag.add(() => svg.replaceChildren());
  read.textContent = "rest";
  draw(performance.now());
  return { set: v => {
    automatic = v < 0;
    if (automatic) { read.textContent = "loading"; B.wake(); }
    else { amplitude = clamp(v, 8, 24); retarget(); }
  }, destroy: bag.dispose };
}
hairline({
  name: "loading-dots",
  means: "Five rounded beads lift in a wave, with neighbours following the bead under the pointer.",
  rules: [1, 2, 5, 7, 8, 9, 10],
  range: [8, 16, 24],
  tour: [[55, 180], [200, 180], null],
  mount: mountLoadingDots,
});
