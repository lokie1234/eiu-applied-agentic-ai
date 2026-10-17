"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { learningIcons, subscribeLearningIcons, type LearningIconEntry } from "./learningIconRegistry";

type IconModel = {
  root: THREE.Group;
  lid: THREE.Group;
  cards: THREE.Group;
  files: THREE.Group[];
  signals: THREE.Mesh[];
  arrow: THREE.Group;
  glow: THREE.MeshStandardMaterial;
  openness: number;
  activity: number;
};
type IconLayout = {
  entry: LearningIconEntry; surface: HTMLElement; bounds: DOMRect; surfaceBounds: DOMRect;
  left: number; right: number; top: number; bottom: number; alpha: number;
};

/** All library icons share one WebGL context, with a clipped viewport per icon. */
export default function LearningIcon3DLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch { return; }
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, .1, 20);
    camera.position.set(0, .12, 5.5);
    camera.lookAt(0, .12, 0);
    scene.add(new THREE.AmbientLight("#dcefff", 2));
    const key = new THREE.DirectionalLight("#f7f4ed", 3.5);
    key.position.set(-3, 5, 6);
    const rim = new THREE.DirectionalLight("#51c9ef", 3);
    rim.position.set(4, 2, -3);
    scene.add(key, rim);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    function material(color: string, metalness = .45, roughness = .3) {
      const value = new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: true });
      materials.add(value);
      return value;
    }
    const navy = material("#123f68"), blue = material("#397fa8"), ice = material("#9bd5e8"), gold = material("#e9ca8b"), cream = material("#f7f4ed", .1);
    const surfaces = [navy, blue, ice, gold, cream];
    const geometryCache = new Map<string, THREE.BufferGeometry>();
    const fileMeshCache = new Map<number, { geometry: THREE.BufferGeometry; material: THREE.Material }[]>();
    function box(w: number, h: number, d: number, radius = .07) {
      const key = `${w}/${h}/${d}/${radius}`;
      if (!geometryCache.has(key)) {
        const geometry = new RoundedBoxGeometry(w, h, d, 2, radius);
        geometries.add(geometry);
        geometryCache.set(key, geometry);
      }
      return geometryCache.get(key)!;
    }
    function mesh(geometry: THREE.BufferGeometry, surface: THREE.Material, x = 0, y = 0, z = 0) {
      const result = new THREE.Mesh(geometry, surface);
      result.position.set(x, y, z);
      return result;
    }
    function batchFile(file: THREE.Group, index: number) {
      let cached = fileMeshCache.get(index);
      if (!cached) {
        const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
        for (const child of file.children) {
          if (!(child instanceof THREE.Mesh)) continue;
          child.updateMatrix();
          const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
          geometry.applyMatrix4(child.matrix);
          const surface = child.material as THREE.Material;
          const bucket = buckets.get(surface) ?? [];
          bucket.push(geometry);
          buckets.set(surface, bucket);
        }
        cached = [];
        for (const [surface, parts] of buckets) {
          const merged = mergeGeometries(parts);
          parts.forEach(part => part.dispose());
          if (merged) { geometries.add(merged); cached.push({ geometry: merged, material: surface }); }
        }
        fileMeshCache.set(index, cached);
      }
      file.clear();
      cached.forEach(part => file.add(mesh(part.geometry, part.material)));
    }
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-.22, -.26);
    arrowShape.lineTo(.26, 0);
    arrowShape.lineTo(-.22, .26);
    arrowShape.closePath();
    const arrowGeometry = new THREE.ExtrudeGeometry(arrowShape, { depth: .09, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .035, bevelThickness: .025 });
    geometries.add(arrowGeometry);
    const sphere = new THREE.SphereGeometry(.07, 12, 8);
    const stem = new THREE.CylinderGeometry(.025, .025, .18, 8);
    const bulb = new THREE.SphereGeometry(.14, 12, 8);
    const orbit = new THREE.TorusGeometry(.9, .012, 4, 40);
    [sphere, stem, bulb, orbit].forEach(value => geometries.add(value));
    const models = new Map<HTMLSpanElement, IconModel>();

    function createModel(entry: LearningIconEntry): IconModel {
      const root = new THREE.Group(), lid = new THREE.Group(), cards = new THREE.Group(), arrow = new THREE.Group();
      const files: THREE.Group[] = [], signals: THREE.Mesh[] = [];
      const glow = material("#79e3ff");
      glow.emissive.set("#51c9ef");
      glow.emissiveIntensity = .35;
      if (entry.kind === "folder") {
        root.add(mesh(box(1.7, 1.13, .15), blue, 0, -.08, -.22));
        root.add(mesh(box(.65, .26, .15), blue, -.47, .54, -.22));
        root.add(mesh(box(1.65, .15, .57), navy, 0, -.6));
        // Five separate files share their geometry and materials, with distinct
        // document, code, image, chart and slide details inside the folder.
        for (let index = 0; index < 5; index++) {
          const file = new THREE.Group();
          file.add(mesh(box(.52, .78, .065, .035), [cream, navy, blue, cream, navy][index]));
          file.add(mesh(box(.14, .055, .02, .012), index % 2 ? ice : gold, -.1, .29, .045));
          if (index === 0) {
            for (let line = 0; line < 3; line++) file.add(mesh(box(line === 2 ? .19 : .32, .032, .015, .008), blue, line === 2 ? -.06 : 0, .12 - line * .12, .044));
          } else if (index === 1) {
            for (const side of [-1, 1]) for (const slope of [-1, 1]) {
              const stroke = mesh(box(.14, .025, .02, .008), ice, side * .1, slope * .045, .044);
              stroke.rotation.z = side * slope * .7;
              file.add(stroke);
            }
          } else if (index === 2) {
            for (const side of [-1, 1]) {
              const peak = mesh(arrowGeometry, side < 0 ? gold : ice, side * .07, -.03, .044);
              peak.rotation.z = Math.PI / 2;
              peak.scale.set(.35, .35, .18);
              file.add(peak);
            }
            const sun = mesh(sphere, gold, .12, .16, .045);
            sun.scale.setScalar(.42);
            file.add(sun);
          } else if (index === 3) {
            for (let bar = 0; bar < 3; bar++) {
              const height = .12 + bar * .075;
              file.add(mesh(box(.065, height, .02, .01), bar === 2 ? gold : blue, -.12 + bar * .12, -.16 + height / 2, .044));
            }
          } else {
            file.add(mesh(box(.34, .25, .02, .025), ice, 0, .03, .043));
            const play = mesh(arrowGeometry, gold, 0, .03, .06);
            play.scale.set(.28, .28, .15);
            file.add(play);
          }
          batchFile(file, index);
          file.position.set((index - 2) * .23, .02, -.17 + index * .055);
          file.rotation.z = -(index - 2) * .06;
          files.push(file);
          cards.add(file);
        }
        cards.add(mesh(stem, gold, 0, .8, .13));
        cards.add(mesh(bulb, gold, 0, .97, .13));
        for (let index = 0; index < 3; index++) {
          const signal = mesh(sphere, index === 1 ? gold : glow);
          signal.scale.setScalar(.32);
          signal.visible = false;
          signals.push(signal);
          root.add(signal);
        }
        lid.position.set(0, -.62, .27);
        lid.add(mesh(box(1.77, .95, .14, .09), blue, 0, .47, 0));
        lid.add(mesh(box(1.43, .025, .02, .01), ice, 0, .85, .08));
        const emblem = mesh(box(.24, .24, .045, .035), gold, 0, .48, .09);
        emblem.rotation.z = Math.PI / 4;
        lid.add(emblem, mesh(sphere, glow, .59, .29, .09));
        root.add(cards, lid);
      } else {
        root.add(mesh(box(1.8, .94, .32, .3), navy, 0, -.06, -.12));
        root.add(mesh(box(1.8, .94, .29, .3), blue, 0, .02, .05));
        root.add(mesh(box(1.46, .65, .06, .25), navy, 0, .02, .21));
        root.add(mesh(box(.83, .025, .025, .01), ice, -.1, .39, .22));
        arrow.add(mesh(arrowGeometry, gold, .02, .02, .29));
        root.add(arrow);
        root.add(mesh(sphere, glow, -.61, .02, .29));
        if (entry.electric) {
          const ring = mesh(orbit, glow);
          ring.rotation.x = 1.1;
          ring.position.y = -.15;
          root.add(ring);
        }
      }
      root.rotation.set(.14, -.3, 0);
      root.visible = false;
      scene.add(root);
      return { root, lid, cards, files, signals, arrow, glow, openness: 0, activity: 0 };
    }

    let frame = 0, previous = 0, settleUntil = 0, interactionUntil = 0, animationTime = 0;
    let disposed = false, lost = false, layoutDirty = true, layoutUntil = 0;
    let modalOpen = false;
    let qualityCap = 2;
    const qualitySample = { elapsed: 0, frames: 0, rate: 0 };
    let layouts: IconLayout[] = [];
    let pointerPose: { surface: Element; x: number; y: number } | null = null;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function wake(event?: Event) {
      if (disposed || lost) return;
      const now = performance.now();
      if (event?.type === "pointermove") {
        const pointer = event as PointerEvent;
        const surface = (event.target as Element | null)?.closest?.("[data-icon-surface]");
        if (!surface || pointer.pointerType !== "mouse") return;
        pointerPose = { surface, x: pointer.clientX, y: pointer.clientY };
      } else {
        if (event?.type === "pointerout") {
          const related = ((event as PointerEvent).relatedTarget as Element | null)?.closest?.("[data-icon-surface]");
          if (related !== pointerPose?.surface) pointerPose = null;
        } else if (event?.type === "scroll" || event?.type === "visibilitychange" || event?.type === "blur") pointerPose = null;
        layoutDirty = true;
        layoutUntil = media.matches ? 0 : now + 260;
      }
      interactionUntil = now + 220;
      settleUntil = now + 350;
      if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
    }
    function updateResolution() {
      // Retina detail, bounded by a pixel budget rather than an unbounded full-screen buffer.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityCap, Math.sqrt(6_000_000 / Math.max(1, window.innerWidth * window.innerHeight))));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
    function resize() {
      updateResolution();
      wake();
    }
    function resetFallbacks() {
      learningIcons.forEach(entry => { delete entry.element.dataset.webglReady; });
    }
    function measureLayout() {
      modalOpen = Boolean(host!.querySelector('[aria-modal="true"]'));
      const next: IconLayout[] = [];
      const styleCache = new Map<HTMLElement, CSSStyleDeclaration>();
      const boundsCache = new Map<HTMLElement, DOMRect>();
      function styleFor(element: HTMLElement) {
        let style = styleCache.get(element);
        if (!style) { style = getComputedStyle(element); styleCache.set(element, style); }
        return style;
      }
      function boundsFor(element: HTMLElement) {
        let bounds = boundsCache.get(element);
        if (!bounds) { bounds = element.getBoundingClientRect(); boundsCache.set(element, bounds); }
        return bounds;
      }
      for (const entry of learningIcons.values()) {
        const element = entry.element;
        const bounds = boundsFor(element);
        if (!bounds.width || !bounds.height || bounds.bottom <= 0 || bounds.top >= window.innerHeight) continue;
        const surface = element.closest<HTMLElement>("[data-icon-surface]");
        if (!surface) continue;
        let left = Math.max(0, bounds.left), right = Math.min(window.innerWidth, bounds.right);
        let top = Math.max(0, bounds.top), bottom = Math.min(window.innerHeight, bounds.bottom);
        let alpha = 1;
        for (let ancestor: HTMLElement | null = element; ancestor && ancestor !== host; ancestor = ancestor.parentElement) {
          const style = styleFor(ancestor);
          if (style.display === "none" || style.visibility === "hidden") { alpha = 0; break; }
          alpha *= Number(style.opacity);
          if (/(hidden|auto|scroll|clip)/.test(style.overflowX + style.overflowY)) {
            const clip = boundsFor(ancestor);
            if (/(hidden|auto|scroll|clip)/.test(style.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
            if (/(hidden|auto|scroll|clip)/.test(style.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
          }
        }
        if (alpha < .05 || right <= left || bottom <= top) continue;
        next.push({ entry, surface, bounds, surfaceBounds: boundsFor(surface), left, right, top, bottom, alpha });
      }
      layouts = next;
      layoutDirty = false;
    }
    function draw(now: number) {
      frame = 0;
      if (disposed || lost || document.hidden) return;
      // Direct manipulation gets display-paced frames; ambient folders use 30 fps.
      // The tolerance avoids a 59.94 Hz screen accidentally dropping to 20 fps.
      const rate = now < interactionUntil ? 60 : 30;
      const interval = 1000 / rate;
      if (now - previous < interval - 1) { frame = requestAnimationFrame(draw); return; }
      const elapsed = (now - previous) / 1000;
      if (qualitySample.rate !== rate || elapsed > .25) {
        qualitySample.elapsed = 0; qualitySample.frames = 0; qualitySample.rate = rate;
      } else {
        qualitySample.elapsed += elapsed;
        qualitySample.frames++;
        if (qualitySample.elapsed >= 2) {
          if (qualitySample.frames / qualitySample.elapsed < rate * .75 && renderer.getPixelRatio() > 1.1) {
            // Lower only after sustained slow frames; never oscillate quality per hover.
            qualityCap = Math.max(1, renderer.getPixelRatio() - .25);
            updateResolution();
          }
          qualitySample.elapsed = 0; qualitySample.frames = 0;
        }
      }
      const delta = Math.min((now - previous) / 1000, .05);
      previous = now;
      animationTime += delta;
      if (layoutDirty || now < layoutUntil) measureLayout();
      if (modalOpen) return;
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);
      let moving = false;
      for (const [element, model] of models) {
        if (!learningIcons.has(element)) { scene.remove(model.root); materials.delete(model.glow); model.glow.dispose(); models.delete(element); }
      }
      for (const { entry, surface, bounds, surfaceBounds, left, right, top, bottom, alpha } of layouts) {
        const element = entry.element;
        if (!element.isConnected) continue;
        let model = models.get(element);
        if (!model) { model = createModel(entry); models.set(element, model); }
        const disabled = surface.dataset.disabled === "true";
        const hovered = !disabled && (surface.hasAttribute("data-pointer-active") || surface.matches(":hover, :focus-within"));
        const selected = entry.kind === "folder" && surface.getAttribute("aria-pressed") === "true";
        const running = !media.matches && (hovered || selected || entry.active);
        const phase = animationTime;
        const opening = media.matches ? Number(selected || hovered) : running ? .6 + Math.sin(phase * 2.2) * .18 : 0;
        const ease = media.matches ? 1 : 1 - Math.exp(-delta * 24);
        model.activity = THREE.MathUtils.lerp(model.activity, running ? 1 : 0, ease);
        const activity = media.matches ? 0 : model.activity;
        model.openness = THREE.MathUtils.lerp(model.openness, opening, ease);
        const tracksPointer = !media.matches && !disabled && pointerPose?.surface === surface;
        const px = tracksPointer ? THREE.MathUtils.clamp(((pointerPose!.x - surfaceBounds.left) / Math.max(1, surfaceBounds.width) - .5) * 2, -1, 1) : 0;
        const py = tracksPointer ? THREE.MathUtils.clamp(((pointerPose!.y - surfaceBounds.top) / Math.max(1, surfaceBounds.height) - .5) * 2, -1, 1) : 0;
        const strength = entry.kind === "folder" ? 1 : 1.4;
        const tiltX = -py * 8 * strength, tiltY = px * 11 * strength;
        model.root.rotation.x = THREE.MathUtils.lerp(model.root.rotation.x, .14 - tiltX * Math.PI / 180, ease);
        model.root.rotation.y = THREE.MathUtils.lerp(model.root.rotation.y, -.3 + tiltY * Math.PI / 180, ease);
        model.root.position.y = (entry.kind === "folder" ? -.15 : 0) + Math.sin(phase * 2.2) * .025 * activity;
        model.root.scale.setScalar(!disabled && surface.matches(":active") ? .92 : 1);
        model.lid.rotation.x = model.openness * .85;
        model.cards.position.y = model.openness * .24;
        model.cards.rotation.z = Math.sin(phase * 2.2) * .025 * activity;
        model.files.forEach((file, index) => {
          const lift = THREE.MathUtils.smootherstep(model.openness, .12 + index * .06, .68 + index * .03);
          file.position.x = (index - 2) * (.23 + lift * .14);
          file.position.y = .02 + lift * (.22 + (2 - Math.abs(index - 2)) * .12) + Math.sin(phase * 2.2 + index * .7) * .025 * lift * activity;
          file.rotation.z = -(index - 2) * (.06 + lift * .1);
          file.rotation.y = Math.sin(phase * 2 + index) * .05 * lift * activity;
        });
        model.signals.forEach((signal, index) => {
          signal.visible = activity > .03 && model.openness > .2;
          const progress = (phase * .6 + index / 3) % 1;
          signal.position.set(Math.sin(progress * Math.PI) * (index === 1 ? -.55 : .45), -.2 + progress * 1.45, .4);
          signal.scale.setScalar(.32 * Math.sin(progress * Math.PI) * activity);
        });
        model.arrow.position.x = (Math.sin(phase * 3.6) + 1) * .065 * activity;
        model.arrow.rotation.y = Math.sin(phase * 2.6) * .08 * activity;
        model.glow.emissiveIntensity = .25 + (.45 + Math.sin(phase * 3.6) * .2) * activity;
        camera.aspect = bounds.width / bounds.height;
        camera.zoom = entry.kind === "folder" ? 1.18 : 1.12;
        camera.updateProjectionMatrix();
        renderer.setViewport(bounds.left, window.innerHeight - bounds.bottom, bounds.width, bounds.height);
        renderer.setScissor(left, window.innerHeight - bottom, right - left, bottom - top);
        surfaces.forEach(surface => { surface.opacity = alpha; });
        model.glow.opacity = alpha;
        model.root.visible = true;
        renderer.render(scene, camera);
        model.root.visible = false;
        if (!element.dataset.webglReady) element.dataset.webglReady = "true";
        moving ||= running || Math.abs(model.openness - opening) > .005 || (!running && model.activity > .005);
      }
      renderer.setScissorTest(false);
      if (moving || now < settleUntil) frame = requestAnimationFrame(draw);
    }
    function contextLost(event: Event) {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      frame = 0;
      resetFallbacks();
    }
    function contextRestored() { lost = false; renderer.resetState(); resize(); }
    const resizeObserver = new ResizeObserver(() => wake());
    function syncIcons() {
      resizeObserver.disconnect();
      resizeObserver.observe(host!);
      learningIcons.forEach(({ element }) => {
        const surface = element.closest<HTMLElement>("[data-icon-surface]");
        if (surface) resizeObserver.observe(surface);
      });
      wake();
    }
    const mutations = new MutationObserver(() => wake());
    mutations.observe(host, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["class", "aria-pressed", "aria-busy", "data-disabled", "data-pointer-active", "hidden"] });
    const unsubscribe = subscribeLearningIcons(syncIcons);
    const events = ["pointermove", "pointerover", "pointerout", "pointerdown", "pointerup", "focusin", "focusout", "click", "transitionrun"];
    events.forEach(event => host.addEventListener(event, wake, { passive: true }));
    document.addEventListener("scroll", wake, { capture: true, passive: true });
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("resize", resize);
    window.addEventListener("blur", wake);
    media.addEventListener("change", wake);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);
    syncIcons();
    resize();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      unsubscribe();
      resizeObserver.disconnect();
      mutations.disconnect();
      events.forEach(event => host.removeEventListener(event, wake));
      document.removeEventListener("scroll", wake, true);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", wake);
      media.removeEventListener("change", wake);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      resetFallbacks();
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 4, pointerEvents: "none" }} />;
}
