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
  opacity = 0.45,
}: {
  radius: number;
  speed: number;
  color: string;
  thickness: number;
  tilt: [number, number, number];
  phase?: number;
  opacity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity, side: THREE.DoubleSide,
  }), [color, opacity]);
  const geo = useMemo(() => new THREE.TorusGeometry(radius, thickness, 6, 64), [radius, thickness]);

  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.z = clock.getElapsedTime() * speed + phase;
  });

  return <mesh ref={meshRef} rotation={tilt} geometry={geo} material={mat} />;
}

// ─── Signal Particle ──────────────────────────────────────────────────────────
function SignalParticle({
  orbitRadius, speed, color, tilt, startAngle = 0,
}: {
  orbitRadius: number; speed: number; color: string;
  tilt: [number, number, number]; startAngle?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const dotRef = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }), [color]);
  const geo = useMemo(() => new THREE.SphereGeometry(0.028, 5, 4), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + startAngle;
    if (dotRef.current) {
      dotRef.current.position.x = Math.cos(t) * orbitRadius;
      dotRef.current.position.y = Math.sin(t) * orbitRadius;
    }
  });

  return (
    <group ref={groupRef} rotation={tilt}>
      <group ref={dotRef}>
        <mesh geometry={geo} material={mat} />
      </group>
    </group>
  );
}

// ─── Background star field ────────────────────────────────────────────────────
function StarField() {
  const { positions, count } = useMemo(() => {
    const count = 120;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 3;
    }
    return { positions, count };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const mat = useMemo(() => new THREE.PointsMaterial({
    color: "#e9ca8b", size: 0.028, transparent: true, opacity: 0.45,
  }), []);

  return <points geometry={geo} material={mat} />;
}

// ─── Main AgentWorld3D ────────────────────────────────────────────────────────
interface AgentWorld3DProps { showCards: boolean; }

export default function AgentWorld3D({ showCards }: AgentWorld3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current)
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.1) * 0.03;
  });

  return (
    <group ref={groupRef}>
      <StarField />

      {/* Orbit rings — rendered before robot (behind in scene order) */}
      <OrbitRing radius={1.62} speed={0.28}  color="#64a8d3" thickness={0.013} tilt={[0.42, 0, 0]}           opacity={0.38} />
      <OrbitRing radius={2.05} speed={-0.15} color="#e9ca8b" thickness={0.009} tilt={[0.2, 0.3, 0.1]}  phase={Math.PI * 0.6} opacity={0.30} />
      <OrbitRing radius={1.28} speed={0.46}  color="#69c5a3" thickness={0.009} tilt={[Math.PI/2-0.15, 0, 0.2]} phase={Math.PI} opacity={0.32} />

      {/* Travelling signal particles */}
      <SignalParticle orbitRadius={1.62} speed={0.55} color="#64a8d3" tilt={[0.42,  0,    0]}    startAngle={0} />
      <SignalParticle orbitRadius={1.62} speed={0.55} color="#e9ca8b" tilt={[0.42,  0,    0]}    startAngle={Math.PI} />
      <SignalParticle orbitRadius={2.05} speed={-0.3} color="#e9ca8b" tilt={[0.2,   0.3,  0.1]} startAngle={0.8} />
      <SignalParticle orbitRadius={1.28} speed={0.9}  color="#69c5a3" tilt={[Math.PI/2-0.15, 0, 0.2]} startAngle={1.5} />
    </group>
  );
}
