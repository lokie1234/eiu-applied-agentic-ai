"use client";

import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
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
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 4.2]} fov={46} />

      <Suspense fallback={null}>
        {/* World rings render first (behind robot in scene order) */}
        <AgentWorld3D showCards={showCards} />

        {/* Guardian Robot — rendered on top of world rings */}
        <GuardianRobot3D mouseRef={mouseRef} />
      </Suspense>
    </Canvas>
  );
}
