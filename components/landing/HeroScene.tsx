"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import GuardianRobot3D from "./GuardianRobot3D";
import AgentWorld3D from "./AgentWorld3D";

interface HeroSceneProps {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage: number;
  isCtaHovered?: boolean;
  ctaPulsed?: boolean;
}

export default function HeroScene({
  mouseRef,
  stage,
  isCtaHovered = false,
  ctaPulsed = false,
}: HeroSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows={false}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      style={{
        background: "transparent",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 4.6]} fov={40} />

      <Suspense fallback={null}>
        {/* Spatial AI World Orbits & Signals — renders behind and around robot */}
        <AgentWorld3D stage={stage} />

        {/* EIU Guardian Robot — Hero subject */}
        <GuardianRobot3D
          mouseRef={mouseRef}
          stage={stage}
          isCtaHovered={isCtaHovered}
          ctaPulsed={ctaPulsed}
        />
      </Suspense>
    </Canvas>
  );
}
