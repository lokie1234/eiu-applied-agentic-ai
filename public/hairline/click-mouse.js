function mountClickMouse({ stage, svg, read }, value) {
  const { Cam, clamp, facing, fit, prism, proj, rings, solid, put,
    tween, tset, tval, tdone, pointer, register, disposer } = HL;
  const bag = disposer(), C = Cam(45, .5, 1.85);
  fit(C, [[-45, -76, 0], [45, 76, 0], [-45, -76, 44], [45, 76, 44]], 200, 166);
  const P = proj(C), front = facing(C);
  const body = solid(svg), left = solid(svg), right = solid(svg), wheel = solid(svg);
  body.sil.setAttribute("data-part", "mouse-body");
  left.sil.setAttribute("data-part", "mouse-left");
  right.sil.setAttribute("data-part", "mouse-right");
  wheel.sil.setAttribute("data-part", "mouse-wheel");
  const [bodyRing, bodyInner] = rings(-45, -76, 45, 76, 42, 16);
  const [leftRing, leftInner] = rings(-37, -67, -5, -8, 10, 1.4);
  const [rightRing, rightInner] = rings(5, -67, 37, -8, 10, 1.4);
  const [wheelRing, wheelInner] = rings(-3, -44, 3, -20, 3, 1);
  put(body, prism(P, front, bodyRing, bodyInner, 4, 28));
  put(right, prism(P, front, rightRing, rightInner, 28, 32));
  // Paint the nearer right button last; it does not overlap the left button.
  right.g.parentNode.appendChild(right.g);
  wheel.g.parentNode.appendChild(wheel.g);
  left.sil.classList.add("hi");
  const press = tween(0), roll = tween(0);
  let pressure = clamp(value, 0, 12), active = false, lastPress = null, lastRoll = null;
  function draw(now) {
    const depth = tval(press, now), shift = tval(roll, now);
    if (depth !== lastPress) {
      lastPress = depth;
      put(left, prism(P, front, leftRing, leftInner, 28 - depth, 32 - depth));
    }
    if (shift !== lastRoll) {
      lastRoll = shift;
      const moved = wheelRing.map(q => ({ ...q, v: q.v + shift }));
      const inside = wheelInner.map(q => ({ ...q, v: q.v + shift }));
      put(wheel, prism(P, front, moved, inside, 32, 40));
    }
  }
  const B = register(stage, (_dt, now) => {
    draw(now);
    return !tdone(press, now) || !tdone(roll, now);
  });
  bag.add(B.unregister);
  function retarget() {
    const now = performance.now(), engaged = active || pressure >= 12;
    tset(press, engaged ? clamp(pressure, 4, 12) : 0, now, 0);
    tset(roll, engaged ? 5 : 0, now, 40);
    read.textContent = engaged ? "pressed" : "rest";
    B.wake();
  }
  function engage(next) {
    if (active === next) return;
    active = next;
    retarget();
  }
  bag.add(pointer(stage, {
    move: ([x, y]) => engage(x >= 60 && x <= 340 && y >= 60 && y <= 270),
    down: () => engage(true), leave: () => engage(false),
  }));
  bag.add(() => svg.replaceChildren());
  read.textContent = "rest";
  draw(performance.now());
  return { set: v => { pressure = clamp(v, 0, 12); retarget(); }, destroy: bag.dispose };
}
hairline({
  name: "click-mouse",
  means: "A rounded wireless mouse presses its left button; the scroll wheel follows a moment later.",
  rules: [1, 2, 5, 7, 8, 9, 10],
  range: [0, 6, 12],
  tour: [[155, 125], [240, 175], null],
  mount: mountClickMouse,
});
