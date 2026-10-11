function mountEnterKey({ stage, svg, read }, value) {
  const { Cam, clamp, facing, fit, hull, open, poly, prism, proj, ringAt,
    rings, run, solid, put, tween, tset, tval, tdone, pointer, register, disposer } = HL;

    const bag = disposer(), C = Cam(45, .5, 1.65);
    fit(C, [[-86, -43, 0], [86, 43, 0], [-86, -43, 70], [86, 43, 70]], 200, 166);
    const P = proj(C), front = facing(C);
    const socket = solid(svg), collar = solid(svg), cap = solid(svg);
    socket.sil.setAttribute("data-part", "key-socket");
    collar.sil.setAttribute("data-part", "key-sleeve");
    cap.sil.setAttribute("data-part", "key-cap");
    const [socketRing, socketInner] = rings(-86, -43, 86, 43, 7, 1.8);
    const [collarRing, collarInner] = rings(-74, -32, 74, 32, 5, 1.5);
    const [foot] = rings(-79, -36, 79, 36, 6, 1.8);
    const [top, inner] = rings(-72, -29, 72, 29, 6, 1.8);
    put(socket, prism(P, front, socketRing, socketInner, 0, 7));
    cap.sil.classList.add("hi");
    const depression = tween(0), sleeve = tween(0);
    let pressure = clamp(value, 0, 24), active = false, lastCap = null, lastSleeve = null;

    function draw(now) {
      const d = tval(depression, now), s = tval(sleeve, now);
      if (s !== lastSleeve) {
        lastSleeve = s;
        put(collar, prism(P, front, collarRing, collarInner, 8, 29 - s));
      }
      if (d !== lastCap) {
        lastCap = d;
        put(cap, {
          sil: poly(hull(ringAt(P, foot, 32 - d).concat(ringAt(P, top, 56 - d)))),
          crease: open(ringAt(P, run(inner, front), 56 - d)),
        });
        // Host lettering uses the same projected plane as the top of the cap.
        const label = P(0, 0, 56 - d), x = P(1, 0, 56 - d), y = P(0, 1, 56 - d);
        cap.sil.setAttribute("data-label-transform", `matrix(${x[0] - label[0]},${x[1] - label[1]},${y[0] - label[0]},${y[1] - label[1]},${label[0]},${label[1]})`);
      }
    }

    const B = register(stage, (_dt, now) => {
      draw(now);
      return !tdone(depression, now) || !tdone(sleeve, now);
    });
    bag.add(B.unregister);

    function retarget() {
      const now = performance.now(), pressed = active || pressure >= 24;
      const depth = pressed ? clamp(pressure, 6, 24) : 0;
      tset(depression, depth, now, 0);
      tset(sleeve, depth * .25, now, 40);
      read.textContent = pressed ? "pressed" : "rest";
      B.wake();
    }
    function engage(next) {
      if (active === next) return;
      active = next;
      retarget();
    }
    bag.add(pointer(stage, {
      move: ([x, y]) => engage(x >= 55 && x <= 345 && y >= 65 && y <= 255),
      down: () => engage(true), leave: () => engage(false),
    }));
    bag.add(() => svg.replaceChildren());
    read.textContent = "rest";
    draw(performance.now());
    return { set: v => { pressure = clamp(v, 0, 24); retarget(); }, destroy: bag.dispose };
}

  hairline({
    name: "enter-key",
    means: "A wide mechanical key presses into its socket; its inner sleeve follows the cap a moment later.",
    rules: [1, 2, 3, 5, 7, 8, 9, 10],
    range: [0, 12, 24],
    tour: [[200, 125], [280, 180], null],
    mount: mountEnterKey,
  });
