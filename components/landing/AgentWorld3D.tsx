"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── EIU DESIGN DNA PALETTE ───────────────────────────────────────────────────
// Navy 950: #041C31 | Accent Blue: #2D7FB4 | Gold 600: #B39159 | Gold 300: #E9CA8B
// ─────────────────────────────────────────────────────────────────────────────

interface AgentWorld3DProps {
  stage: number;
}

// ─── Smooth Orbit Ring with Dynamic Opacity & Speed ───────────────────────────
function DynamicOrbitRing({
  radius,
  thickness,
  tilt,
  color,
  targetOpacity,
  targetSpeed,
  stage,
  phase = 0,
}: {
  radius: number;
  thickness: number;
  tilt: [number, number, number];
  color: string;
  targetOpacity: number;
  targetSpeed: number;
  stage: number;
  phase?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const currentSpeed = useRef(0);
  const currentRot = useRef(phase);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    [color]
  );

  const geo = useMemo(
    () => new THREE.TorusGeometry(radius, thickness, 8, 80),
    [radius, thickness]
  );

  useFrame((_, delta) => {
    // Orbits activate at stage >= 4 ("move" word reveals)
    const active = stage >= 4;
    const targetOp = active ? targetOpacity : 0;
    const targetSpd = active ? targetSpeed : 0;

    // Smooth ramp-up of opacity and speed from zero
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOp, delta * 2.2);
    currentSpeed.current = THREE.MathUtils.lerp(
      currentSpeed.current,
      targetSpd,
      delta * 1.8
    );

    currentRot.current += currentSpeed.current * delta;

    if (meshRef.current) {
      meshRef.current.rotation.z = currentRot.current;
    }
  });

  return <mesh ref={meshRef} rotation={tilt} geometry={geo} material={mat} />;
}

// ─── Traveling Signal Data Packet ─────────────────────────────────────────────
function SignalDataPacket({
  radius,
  tilt,
  color,
  speed,
  stage,
  activationStage = 5,
  size = 0.034,
  startAngle = 0,
}: {
  radius: number;
  tilt: [number, number, number];
  color: string;
  speed: number;
  stage: number;
  activationStage?: number;
  size?: number;
  startAngle?: number;
}) {
  const nodeRef = useRef<THREE.Group>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const angleRef = useRef(startAngle);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0,
      }),
    [color]
  );

  const geo = useMemo(() => new THREE.SphereGeometry(size, 8, 6), [size]);

  useFrame((_, delta) => {
    const isReady = stage >= activationStage;
    const targetOp = isReady ? 0.95 : 0;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOp, delta * 3.0);

    if (isReady && dotRef.current) {
      angleRef.current += speed * delta;
      dotRef.current.position.x = Math.cos(angleRef.current) * radius;
      dotRef.current.position.y = Math.sin(angleRef.current) * radius;
    }
  });

  return (
    <group ref={nodeRef} rotation={tilt}>
      <mesh ref={dotRef} geometry={geo} material={mat} />
    </group>
  );
}

// ─── Ambient Academic Data Dust ──────────────────────────────────────────────
function AcademicDataDust({ stage }: { stage: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, count } = useMemo(() => {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 8.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 7.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5.0 - 1.2;
    }
    return { positions, count };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#E9CA8B",
        size: 0.024,
        transparent: true,
        opacity: 0,
      }),
    []
  );

  useFrame((_, delta) => {
    const targetOp = stage >= 1 ? 0.42 : 0;
    mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOp, delta * 1.5);
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.015;
    }
  });

  return <points ref={pointsRef} geometry={geo} material={mat} />;
}

// ─── Main AgentWorld3D Component ──────────────────────────────────────────────
export default function AgentWorld3D({ stage }: AgentWorld3DProps) {
  const worldRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (worldRef.current) {
      const t = clock.getElapsedTime();
      worldRef.current.rotation.y = Math.sin(t * 0.12) * 0.025;
    }
  });

  return (
    <group ref={worldRef}>
      {/* Subtle Data Dust in EIU Gold 300 */}
      <AcademicDataDust stage={stage} />

      {/* ─── 3D ORBIT SYSTEM (Spatial Depth Layering) ─── */}
      {/* Orbit 1: Equatorial Blue Horizon Ring (passes behind robot) */}
      <DynamicOrbitRing
        radius={1.72}
        thickness={0.009}
        tilt={[0.42, 0, 0]}
        color="#2D7FB4"
        targetOpacity={0.34}
        targetSpeed={0.22}
        stage={stage}
        phase={0}
      />

      {/* Orbit 2: Tilted Gold Halo Trajectory (sweeps behind top, in front of bottom) */}
      <DynamicOrbitRing
        radius={2.18}
        thickness={0.011}
        tilt={[0.34, 0.28, -0.12]}
        color="#E9CA8B"
        targetOpacity={0.38}
        targetSpeed={-0.14}
        stage={stage}
        phase={Math.PI * 0.45}
      />

      {/* Orbit 3: Inner Vertical Workflow Loop */}
      <DynamicOrbitRing
        radius={1.38}
        thickness={0.008}
        tilt={[Math.PI / 2 - 0.18, 0, 0.22]}
        color="#64A8D3"
        targetOpacity={0.28}
        targetSpeed={0.32}
        stage={stage}
        phase={Math.PI}
      />

      {/* ─── SPATIAL SIGNAL PACKETS (Synchronized Flow) ─── */}
      {/* Signal 1: Intent Data Packet (travels toward robot on Orbit 1) */}
      <SignalDataPacket
        radius={1.72}
        tilt={[0.42, 0, 0]}
        color="#64A8D3"
        speed={0.48}
        stage={stage}
        activationStage={5}
        size={0.038}
        startAngle={Math.PI * 0.8}
      />

      {/* Signal 2: Gold Processing Resonance Pulse on Orbit 2 */}
      <SignalDataPacket
        radius={2.18}
        tilt={[0.34, 0.28, -0.12]}
        color="#E9CA8B"
        speed={-0.34}
        stage={stage}
        activationStage={6}
        size={0.034}
        startAngle={0.4}
      />

      {/* Signal 3: Output Execution Pulse on Orbit 3 */}
      <SignalDataPacket
        radius={1.38}
        tilt={[Math.PI / 2 - 0.18, 0, 0.22]}
        color="#2D7FB4"
        speed={0.62}
        stage={stage}
        activationStage={7}
        size={0.032}
        startAngle={1.8}
      />
    </group>
  );
}
