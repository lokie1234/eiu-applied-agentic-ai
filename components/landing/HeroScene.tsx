"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import GuardianRobot3D, { type RobotInteractionState } from "./GuardianRobot3D";
import AgentWorld3D from "./AgentWorld3D";

interface HeroSceneProps {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage: number;
  robotState?: RobotInteractionState;
  isCtaHovered?: boolean;
  ctaPulsed?: boolean;
}

// Keep the full scene and interactions; reduce only pixel workload on slower GPUs.
function ScenePerformance({ onDprChange, onRunningChange }: {
  onDprChange: (dpr: number) => void;
  onRunningChange: (running: boolean) => void;
}) {
  const get = useThree((state) => state.get);
  const sample = useRef({ elapsed: 0, frames: 0, warmup: 4 });

  useEffect(() => {
    const { gl, clock, setFrameloop } = get();
    // The visor keeps its physical glass material with a smaller refraction buffer.
    const originalScale = gl.transmissionResolutionScale;
    gl.transmissionResolutionScale = 0.75;
    let inView = true;
    let running = true;
    const syncVisibility = () => {
      const next = !document.hidden && inView;
      if (next === running) return;
      running = next;
      // Fiber resets the clock on loop changes. Preserve animation phase on resume.
      const elapsed = clock.elapsedTime;
      setFrameloop(next ? "always" : "never");
      clock.elapsedTime = elapsed;
      onRunningChange(next);
      sample.current = { elapsed: 0, frames: 0, warmup: 4 };
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
  }, [get, onRunningChange]);

  useFrame((state, delta) => {
    const measurement = sample.current;
    if (measurement.warmup > 0) {
      measurement.warmup -= delta;
      return;
    }
    measurement.elapsed += delta;
    measurement.frames++;
    if (measurement.elapsed < 2) return;
    const fps = measurement.frames / measurement.elapsed;
    // Sustained slow frames lower DPR gradually, without quality oscillation.
    if (fps < 48 && state.viewport.dpr > 0.85) {
      onDprChange(Math.max(0.85, Number((state.viewport.dpr - 0.15).toFixed(2))));
    }
    sample.current = { elapsed: 0, frames: 0, warmup: 2 };
  });
  return null;
}

// ─── PROCEDURAL STUDIO LIGHTING ENVIRONMENT (IBL REFLECTIONS) ─────────────────
// Injects physical studio softbox reflections into scene.environment with 0 network calls.
// Provides realistic Fresnel reflections for anodized metals, gold trims, and glass.
function EiuStudioLightingEnvironment() {
  const { gl, scene } = useThree();

  useEffect(() => {
    const envScene = new THREE.Scene();

    // 1. Spatial hemisphere: Deep navy zenith, dark ink bounce
    const hemiLight = new THREE.HemisphereLight(0x1a3b5c, 0x030d17, 1.4);
    envScene.add(hemiLight);

    // 2. Primary warm studio key softbox
    const keySoftbox = new THREE.DirectionalLight(0xfff6ea, 3.8);
    keySoftbox.position.set(4.5, 4.8, 3.8);
    envScene.add(keySoftbox);

    // 3. Cool cyan/blue studio rim softbox for crisp Fresnel edge reflections
    const rimSoftbox = new THREE.DirectionalLight(0x2d7fb4, 3.0);
    rimSoftbox.position.set(-4.8, 3.4, -3.8);
    envScene.add(rimSoftbox);

    // 4. Warm gold bounce reflector
    const goldSoftbox = new THREE.DirectionalLight(0xe9ca8b, 1.8);
    goldSoftbox.position.set(2.2, -2.4, 2.6);
    envScene.add(goldSoftbox);

    // 5. Diffuse studio softbox reflector panels for realistic specular highlights
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
    pmremGenerator.compileEquirectangularShader();
    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);

    scene.environment = renderTarget.texture;
    scene.environmentIntensity = 0.88;

    return () => {
      scene.environment = null;
      renderTarget.dispose();
      pmremGenerator.dispose();
      panelGeo.dispose();
      pKey.material.dispose();
      pRim.material.dispose();
    };
  }, [gl, scene]);

  return null;
}

export default function HeroScene({
  mouseRef,
  stage,
  robotState = "idle",
  isCtaHovered = false,
  ctaPulsed = false,
}: HeroSceneProps) {
  const [dpr, setDpr] = useState(1.25);
  const [running, setRunning] = useState(true);
  return (
    <Canvas
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
        pointerEvents: "auto",
      }}
    >
      <ScenePerformance onDprChange={setDpr} onRunningChange={setRunning} />
      <PerspectiveCamera makeDefault position={[0, 0, 10.5]} fov={50} />

      <Suspense fallback={null}>
        {/* Procedural Studio Lighting Environment for Photorealistic Reflections */}
        <EiuStudioLightingEnvironment />

        {/* Spatial AI World Orbits & Signals — renders behind and around robot */}
        <AgentWorld3D stage={stage} />

        {/* EIU Guardian Robot — Hero subject */}
        <GuardianRobot3D
          mouseRef={mouseRef}
          stage={stage}
          robotState={robotState}
          isCtaHovered={isCtaHovered}
          ctaPulsed={ctaPulsed}
        />
      </Suspense>
    </Canvas>
  );
}
