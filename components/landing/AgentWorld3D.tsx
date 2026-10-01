"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Orbit Ring ───────────────────────────────────────────────────────────────

function OrbitRing({
  radius,
  speed,
  color,
  thickness,
  tilt,
  phase = 0,
}: {
  radius: number;
  speed: number;
  color: string;
  thickness: number;
  tilt: [number, number, number];
  phase?: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z = clock.getElapsedTime() * speed + phase;
  });

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    [color]
  );

  return (
    <mesh ref={ringRef} rotation={tilt} renderOrder={0}>
      <torusGeometry args={[radius, thickness, 6, 64]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ─── Signal Particle ──────────────────────────────────────────────────────────

function SignalParticle({
  orbitRadius,
  speed,
  color,
  tilt,
  startAngle = 0,
}: {
  orbitRadius: number;
  speed: number;
  color: string;
  tilt: [number, number, number];
  startAngle?: number;
}) {
  const particleRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!particleRef.current) return;
    const t = clock.getElapsedTime() * speed + startAngle;
    particleRef.current.position.x = Math.cos(t) * orbitRadius;
    particleRef.current.position.y = Math.sin(t) * orbitRadius;
  });

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
      }),
    [color]
  );

  return (
    <group rotation={tilt}>
      <group ref={particleRef}>
        <mesh material={mat}>
          <sphereGeometry args={[0.028, 6, 4]} />
        </mesh>
      </group>
    </group>
  );
}

// ─── HUD Signal Card (3D billboard) ───────────────────────────────────────────

function HudCard({
  position,
  label,
  subtitle,
  dotColor,
  delay,
  visible,
}: {
  position: [number, number, number];
  label: string;
  subtitle: string;
  dotColor: string;
  delay: number;
  visible: boolean;
}) {
  const cardRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!cardRef.current) return;
    const t = clock.getElapsedTime();
    cardRef.current.position.y =
      position[1] + Math.sin(t * 0.9 + delay) * 0.045;
    // Face camera roughly
    cardRef.current.rotation.y = Math.sin(t * 0.2 + delay) * 0.05;
  });

  if (!visible) return null;

  const panelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#082945"),
        transparent: true,
        opacity: 0.92,
        metalness: 0.4,
        roughness: 0.6,
      }),
    []
  );
  const borderMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#64a8d3"),
        transparent: true,
        opacity: 0.55,
        wireframe: false,
      }),
    []
  );
  const dotMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: new THREE.Color(dotColor) }),
    [dotColor]
  );

  return (
    <group ref={cardRef} position={position}>
      {/* Background panel */}
      <mesh material={panelMat} position={[0, 0, -0.01]}>
        <boxGeometry args={[1.22, 0.52, 0.04]} />
      </mesh>
      {/* Border */}
      <lineSegments>
        <edgesGeometry attach="geometry">
          <boxGeometry args={[1.22, 0.52, 0.04]} />
        </edgesGeometry>
        <lineBasicMaterial color="#64a8d3" transparent opacity={0.4} />
      </lineSegments>
      {/* Status dot */}
      <mesh position={[-0.5, 0.13, 0.04]} material={dotMat}>
        <sphereGeometry args={[0.038, 6, 4]} />
      </mesh>
    </group>
  );
}

// ─── Main AgentWorld3D ────────────────────────────────────────────────────────

interface AgentWorld3DProps {
  showCards: boolean;
}

export default function AgentWorld3D({ showCards }: AgentWorld3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.12) * 0.04;
  });

  return (
    <group ref={groupRef}>
      {/* ── Outer orbit rings (render behind robot via renderOrder) ── */}
      <OrbitRing radius={1.58} speed={0.32} color="#64a8d3" thickness={0.012} tilt={[0.42, 0, 0]} />
      <OrbitRing radius={1.92} speed={-0.18} color="#e9ca8b" thickness={0.008} tilt={[0.2, 0.3, 0.1]} phase={Math.PI * 0.6} />
      <OrbitRing radius={1.24} speed={0.52} color="#69c5a3" thickness={0.009} tilt={[Math.PI / 2 - 0.15, 0, 0.2]} phase={Math.PI} />

      {/* ── Signal particles travelling the rings ── */}
      <SignalParticle orbitRadius={1.58} speed={0.64} color="#64a8d3" tilt={[0.42, 0, 0]} startAngle={0} />
      <SignalParticle orbitRadius={1.58} speed={0.64} color="#e9ca8b" tilt={[0.42, 0, 0]} startAngle={Math.PI} />
      <SignalParticle orbitRadius={1.92} speed={-0.36} color="#e9ca8b" tilt={[0.2, 0.3, 0.1]} startAngle={0.8} />
      <SignalParticle orbitRadius={1.24} speed={1.0} color="#69c5a3" tilt={[Math.PI / 2 - 0.15, 0, 0.2]} startAngle={1.5} />

      {/* ── HUD Signal Cards ── */}
      <HudCard
        position={[-2.6, 0.4, -0.4]}
        label="INPUT"
        subtitle="Intent detected"
        dotColor="#69c5a3"
        delay={0}
        visible={showCards}
      />
      <HudCard
        position={[2.6, 0.55, -0.3]}
        label="PROCESS"
        subtitle="Workflow running"
        dotColor="#64a8d3"
        delay={1.2}
        visible={showCards}
      />
      <HudCard
        position={[2.4, -0.65, -0.2]}
        label="OUTPUT"
        subtitle="Action complete"
        dotColor="#e9ca8b"
        delay={2.5}
        visible={showCards}
      />
    </group>
  );
}
