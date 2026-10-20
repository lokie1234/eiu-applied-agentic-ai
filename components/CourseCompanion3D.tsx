"use client";

import { Component, type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

function RoundedBox({
  args = [1, 1, 1],
  radius = 0.05,
  smoothness = 4,
  children,
  ...props
}: {
  args?: [number, number, number];
  radius?: number;
  smoothness?: number;
  position?: [number, number, number];
  children?: ReactNode;
}) {
  const [width, height, depth] = args;
  const geometry = useMemo(
    () => new RoundedBoxGeometry(width, height, depth, smoothness, radius),
    [width, height, depth, smoothness, radius]
  );
  return <mesh geometry={geometry} {...props}>{children}</mesh>;
}

export type CompanionGaze = { x: number; y: number; reducedMotion: boolean; suspended: boolean };
type Props = {
  gazeRef: RefObject<CompanionGaze>;
  wakeRef: RefObject<(() => void) | null>;
  energized: boolean;
  onReady: (ready: boolean) => void;
};

class SceneBoundary extends Component<{ children: ReactNode; onReady: Props["onReady"] }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onReady(false); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Robot({ gazeRef, wakeRef, energized }: Props) {
  const robot = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const pulseStart = useRef<number | null>(null);
  const invalidate = useThree(state => state.invalidate);
  const schedule = useCallback(() => {
    // Fiber coalesces invalidations into the next display frame. A timer here
    // added another frame of latency and made cursor tracking feel stuttery.
    if (!gazeRef.current.suspended) invalidate();
  }, [gazeRef, invalidate]);

  useEffect(() => {
    wakeRef.current = schedule;
    return () => {
      wakeRef.current = null;
    };
  }, [wakeRef, schedule]);

  useEffect(() => {
    pulseStart.current = energized ? performance.now() : null;
    schedule();
  }, [energized, schedule]);

  useFrame((_, delta) => {
    if (gazeRef.current.suspended || !robot.current || !ring.current || !eyes.current) return;
    const { x, y, reducedMotion } = gazeRef.current;
    const elapsed = pulseStart.current === null ? 2 : (performance.now() - pulseStart.current) / 1000;
    const greeting = !reducedMotion && elapsed < 1.4;
    const bounce = greeting ? Math.sin(elapsed / 1.4 * Math.PI) : 0;
    const targetY = -.12 + (reducedMotion ? 0 : x * .85);
    // Browser Y grows downwards; positive Three.js X rotation looks down.
    const targetX = .05 + (reducedMotion ? 0 : y * .5);
    const blend = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 55);
    robot.current.rotation.y = MathUtils.lerp(robot.current.rotation.y, targetY, blend);
    robot.current.rotation.x = MathUtils.lerp(robot.current.rotation.x, targetX, blend);
    robot.current.rotation.z = bounce * Math.sin(elapsed * 12) * .12;
    robot.current.position.y = bounce * .16;
    ring.current.rotation.z = -.3 + bounce * .8;
    eyes.current.position.x = reducedMotion ? 0 : x * .075;
    eyes.current.position.y = reducedMotion ? 0 : -y * .045;
    eyes.current.scale.y = energized ? .65 : 1;
    if (greeting || Math.abs(robot.current.rotation.y - targetY) > .001 || Math.abs(robot.current.rotation.x - targetX) > .001) schedule();
  });

  return <>
    <ambientLight intensity={1.4} />
    <directionalLight position={[-3, 4, 5]} intensity={3} color="#e5f7ff" />
    <directionalLight position={[4, 1, -2]} intensity={4} color="#51c9ef" />
    <pointLight position={[-2, -1, 2]} intensity={8} color="#e9ca8b" />
    <group ref={robot} rotation={[.05, -.22, 0]}>
      <RoundedBox args={[1.38, 1.08, .82]} radius={.29} smoothness={3}>
        <meshStandardMaterial color="#afd7e5" metalness={.6} roughness={.25} />
      </RoundedBox>
      <RoundedBox args={[1.13, .7, .16]} radius={.21} smoothness={3} position={[0, .035, .415]}>
        <meshStandardMaterial color="#041c31" metalness={.35} roughness={.22} />
      </RoundedBox>
      <group ref={eyes} position={[0, 0, .52]}>
        {[-.26, .26].map(x => <mesh key={x} position={[x, .08, 0]}>
          <capsuleGeometry args={[.065, .1, 4, 8]} />
          <meshStandardMaterial color="#a5f1ff" emissive="#51c9ef" emissiveIntensity={energized ? 3 : 1.3} roughness={.25} />
        </mesh>)}
      </group>
      <mesh position={[0, -.13, .52]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[.095, .014, 5, 12, Math.PI]} />
        <meshBasicMaterial color="#79e3ff" />
      </mesh>
      {[-.76, .76].map(x => <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[.17, .17, .17, 12]} />
        <meshStandardMaterial color="#2d7fb4" metalness={.65} roughness={.3} />
      </mesh>)}
      <mesh position={[0, .66, 0]}>
        <cylinderGeometry args={[.025, .035, .25, 8]} />
        <meshStandardMaterial color="#b39159" metalness={.6} roughness={.3} />
      </mesh>
      <mesh position={[0, .82, 0]}>
        <sphereGeometry args={[.09, 12, 8]} />
        <meshStandardMaterial color="#e9ca8b" emissive="#b39159" emissiveIntensity={energized ? 1 : .2} metalness={.45} roughness={.25} />
      </mesh>
      {[-.09, 0, .09].map((x, i) => <mesh key={x} position={[x, -.43, .37]}>
        <sphereGeometry args={[.023, 8, 6]} />
        <meshBasicMaterial color={i === 0 ? "#e9ca8b" : "#18547f"} />
      </mesh>)}
    </group>
    <group ref={ring} rotation={[.6, .15, -.3]} position={[0, -.27, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.04, .009, 4, 48]} />
        <meshBasicMaterial color="#79e3ff" transparent opacity={.5} />
      </mesh>
      <mesh position={[.95, 0, .42]}>
        <sphereGeometry args={[.045, 10, 8]} />
        <meshStandardMaterial color="#e9ca8b" emissive="#e9ca8b" emissiveIntensity={.5} />
      </mesh>
    </group>
  </>;
}

export default function CourseCompanion3D(props: Props) {
  return <SceneBoundary onReady={props.onReady}>
    <Canvas camera={{ position: [0, .12, 4.6], fov: 34 }} dpr={[1, 2]} frameloop="demand"
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      fallback={null}
      onCreated={({ gl }) => {
        props.onReady(true);
        gl.domElement.addEventListener("webglcontextlost", () => props.onReady(false), { once: true });
      }}>
      <Robot {...props} />
    </Canvas>
  </SceneBoundary>;
}
