"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import GuardianRobot3D from "./GuardianRobot3D";
import AgentWorld3D from "./AgentWorld3D";

interface HeroSceneProps {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  showCards: boolean;
}

export default function HeroScene({ mouseRef, showCards }: HeroSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows={false}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent", width: "100%", height: "100%" }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 4.8]} fov={42} />

      <Suspense fallback={null}>
        {/* World (orbit rings, star field) — renders behind robot */}
        <AgentWorld3D showCards={showCards} />

        {/* Guardian Robot (with EIU logo + movement) — renders in front */}
        <GuardianRobot3D mouseRef={mouseRef} />
      </Suspense>
    </Canvas>
  );
}
