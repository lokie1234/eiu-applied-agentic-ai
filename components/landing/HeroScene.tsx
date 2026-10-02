"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import GuardianRobot3D, { type RobotInteractionState } from "./GuardianRobot3D";
import AgentWorld3D from "./AgentWorld3D";

interface HeroSceneProps {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage: number;
  robotState?: RobotInteractionState;
  isCtaHovered?: boolean;
  ctaPulsed?: boolean;
}

export default function HeroScene({
  mouseRef,
  stage,
  robotState = "idle",
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
        pointerEvents: "auto",
      }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 10.5]} fov={50} />

      <Suspense fallback={null}>
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
