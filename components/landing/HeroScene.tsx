"use client";

import { Component, type ReactNode, Suspense, memo, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import GuardianRobot3D, { type RobotInteractionState } from "./GuardianRobot3D";
import AgentWorld3D from "./AgentWorld3D";

interface HeroSceneProps {
  languageIntro?: boolean;
  languageAnchor?: React.RefObject<HTMLDivElement | null>;
  languageScreen?: React.RefObject<HTMLDivElement | null>;
  returningToOrbit?: boolean;
  onOrbitArrival?: () => void;
  onLanguageArrival?: () => void;
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage: number;
  robotState?: RobotInteractionState;
  isCtaHovered?: boolean;
  enter?: boolean;
  paused?: boolean;
  onReady?: () => void;
  onUnavailable?: () => void;
}

class SceneBoundary extends Component<{ children: ReactNode; onUnavailable?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// This mounts only after every Suspense texture has resolved. Prepare the exact
// scene while its canvas is transparent, before starting any entrance movement.
function SceneWarmup({ onReady, onUnavailable }: { onReady: () => void; onUnavailable?: () => void }) {
  const get = useThree(state => state.get);
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    frame = requestAnimationFrame(() => {
      const { gl, scene, camera } = get();
      scene.updateMatrixWorld(true);
      void Promise.resolve().then(() => gl.compileAsync(scene, camera)).then(() => {
        if (cancelled) return;
        frame = requestAnimationFrame(() => {
          if (cancelled) return;
          // Upload even the actors waiting outside the viewport. Otherwise their
          // buffers and transmission shaders would still stall the first fly-in.
          const culling = new Map<THREE.Object3D, boolean>();
          scene.traverse(object => { culling.set(object, object.frustumCulled); object.frustumCulled = false; });
          try { gl.render(scene, camera); }
          catch { onUnavailable?.(); return; }
          finally { culling.forEach((value, object) => { object.frustumCulled = value; }); }
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => { if (!cancelled) onReady(); });
          });
        });
      }).catch(() => {
        // A shader warmup failure must not block sign-in or expose a partial scene.
        if (!cancelled) onUnavailable?.();
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [get, onReady, onUnavailable]);
  return null;
}

// Keep the full scene and interactions; reduce only pixel workload on slower GPUs.
function ScenePerformance({ onDprChange, onRunningChange, active }: {
  onDprChange: (dpr: number) => void;
  onRunningChange: (running: boolean) => void;
  active: boolean;
}) {
  const get = useThree((state) => state.get);
  const sample = useRef({ elapsed: 0, frames: 0, warmup: 1 });

  useEffect(() => {
    const { gl, clock, setFrameloop } = get();
    // The visor keeps its physical glass material with a smaller refraction buffer.
    const originalScale = gl.transmissionResolutionScale;
    gl.transmissionResolutionScale = 0.5;
    let inView = true;
    let running: boolean | null = null;
    const syncVisibility = () => {
      const next = active && !document.hidden && inView;
      if (next === running) return;
      running = next;
      // Fiber resets the clock on loop changes. Preserve animation phase on resume.
      const elapsed = clock.elapsedTime;
      setFrameloop(next ? "always" : "never");
      clock.elapsedTime = elapsed;
      onRunningChange(next);
      sample.current = { elapsed: 0, frames: 0, warmup: 1 };
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncVisibility();
    });
    observer.observe(gl.domElement);
    document.addEventListener("visibilitychange", syncVisibility);
    syncVisibility();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      gl.transmissionResolutionScale = originalScale;
    };
  }, [get, active, onRunningChange]);

  useFrame((state, delta) => {
    const measurement = sample.current;
    if (measurement.warmup > 0) {
      measurement.warmup -= delta;
      return;
    }
    measurement.elapsed += delta;
    measurement.frames++;
    if (measurement.elapsed < 1) return;
    const fps = measurement.frames / measurement.elapsed;
    // Sustained slow frames lower DPR gradually, without quality oscillation.
    if (fps < 48 && state.viewport.dpr > 0.85) {
      onDprChange(Math.max(0.85, Number((state.viewport.dpr - 0.15).toFixed(2))));
    }
    sample.current = { elapsed: 0, frames: 0, warmup: 1 };
  });
  return null;
}

// ─── PROCEDURAL STUDIO LIGHTING ENVIRONMENT (IBL REFLECTIONS) ─────────────────
// Injects physical studio softbox reflections into scene.environment with 0 network calls.
// Provides realistic Fresnel reflections for anodized metals, gold trims, and glass.
function EiuStudioLightingEnvironment() {
  const get = useThree(state => state.get);

  useEffect(() => {
    const { gl, scene } = get();
    const envScene = new THREE.Scene();

    // Emissive panels supply the reflections; lights do not illuminate these BasicMaterials.
    const panelGeo = new THREE.PlaneGeometry(6, 6);
    const pKey = new THREE.Mesh(
      panelGeo,
      new THREE.MeshBasicMaterial({ color: 0xfffcf5, side: THREE.DoubleSide })
    );
    pKey.position.set(4.2, 3.8, 3.2);
    pKey.lookAt(0, 0, 0);
    envScene.add(pKey);

    const pRim = new THREE.Mesh(
      panelGeo,
      new THREE.MeshBasicMaterial({ color: 0x1d5882, side: THREE.DoubleSide })
    );
    pRim.position.set(-4.2, 3.2, -3.2);
    pRim.lookAt(0, 0, 0);
    envScene.add(pRim);

    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const renderTarget = pmremGenerator.fromScene(envScene, 0.04, 0.1, 100, { size: 128 });

    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = renderTarget.texture;
    scene.environmentIntensity = 0.88;

    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      renderTarget.dispose();
      pmremGenerator.dispose();
      panelGeo.dispose();
      pKey.material.dispose();
      pRim.material.dispose();
    };
  }, [get]);

  return null;
}

function HeroScene({
  languageIntro = false,
  languageAnchor,
  languageScreen,
  returningToOrbit = false,
  onOrbitArrival,
  onLanguageArrival,
  mouseRef,
  stage,
  robotState = "idle",
  isCtaHovered = false,
  enter = true,
  paused = false,
  onReady,
  onUnavailable,
}: HeroSceneProps) {
  const [dpr, setDpr] = useState(1);
  const [prepared, setPrepared] = useState(false);
  const [running, setRunning] = useState(false);
  const handleReady = useCallback(() => { setPrepared(true); onReady?.(); }, [onReady]);
  const revealed = prepared && enter;
  return (
    <div style={{ width: "100%", height: "100%", opacity: revealed ? 1 : 0,
      pointerEvents: revealed ? "auto" : "none", transition: "opacity 1.2s cubic-bezier(.22,1,.36,1)" }}>
    <SceneBoundary onUnavailable={onUnavailable}>
    <Canvas
      camera={{ position: [0, 0, 10.5], fov: 50 }}
      dpr={[0.85, dpr]}
      frameloop={running ? "always" : "never"}
      shadows={false}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.06,
      }}
      style={{
        background: "transparent",
        width: "100%",
        height: "100%",
        pointerEvents: revealed ? "auto" : "none",
      }}
    >
      <ScenePerformance onDprChange={setDpr} onRunningChange={setRunning} active={revealed && !paused} />

      <Suspense fallback={null}>
        {/* Procedural Studio Lighting Environment for Photorealistic Reflections */}
        <EiuStudioLightingEnvironment />

        {/* Spatial AI World Orbits & Signals — renders behind and around robot */}
        <AgentWorld3D stage={revealed ? stage : 0} />

        {/* EIU Guardian Robot — Hero subject */}
        <GuardianRobot3D
          languageIntro={languageIntro}
          languageAnchor={languageAnchor}
          languageScreen={languageScreen}
          returningToOrbit={returningToOrbit}
          onOrbitArrival={onOrbitArrival}
          onLanguageArrival={onLanguageArrival}
          mouseRef={mouseRef}
          stage={stage}
          robotState={robotState}
          isCtaHovered={isCtaHovered}
                  enter={revealed}
        />
        <SceneWarmup onReady={handleReady} onUnavailable={onUnavailable} />
      </Suspense>
    </Canvas>
    </SceneBoundary>
    </div>
  );
}

export default memo(HeroScene);
