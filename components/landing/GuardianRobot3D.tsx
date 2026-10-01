"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// ─── Shared material factory (call inside component for hooks compliance) ─────

function useMaterials() {
  return useMemo(() => ({
    navy: new THREE.MeshStandardMaterial({ color: "#082945", metalness: 0.72, roughness: 0.28 }),
    deepNavy: new THREE.MeshStandardMaterial({ color: "#041c31", metalness: 0.8, roughness: 0.22 }),
    midNavy: new THREE.MeshStandardMaterial({ color: "#0d3a60", metalness: 0.65, roughness: 0.32 }),
    gold: new THREE.MeshStandardMaterial({ color: "#e9ca8b", metalness: 0.9, roughness: 0.12, emissive: new THREE.Color("#c99f55"), emissiveIntensity: 0.3 }),
    cyan: new THREE.MeshStandardMaterial({ color: "#64a8d3", metalness: 0.5, roughness: 0.3, emissive: new THREE.Color("#2d7fb4"), emissiveIntensity: 0.55 }),
    visor: new THREE.MeshPhysicalMaterial({ color: "#0d3556", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.88, transmission: 0.15 }),
    green: new THREE.MeshStandardMaterial({ color: "#69c5a3", emissive: "#3da87e", emissiveIntensity: 1.3, roughness: 0.2 }),
    eye: new THREE.MeshStandardMaterial({ color: "#64a8d3", emissive: "#2d7fb4", emissiveIntensity: 2.2, roughness: 0.05 }),
    white: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    chibi: new THREE.MeshStandardMaterial({ color: "#0d3a60", metalness: 0.7, roughness: 0.3 }),
  }), []);
}

// ─── EIU Logo plane on chest ──────────────────────────────────────────────────
function EiuLogoBadge({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const logoTex = useTexture("/branding/EIU-logo-white.png");
  const logoMat = useMemo(() => new THREE.MeshBasicMaterial({
    map: logoTex,
    transparent: true,
    side: THREE.FrontSide,
  }), [logoTex]);

  return (
    <>
      {/* Chest recess panel */}
      <mesh position={[0, 0.08, 0.24]} material={mat.deepNavy}>
        <boxGeometry args={[0.52, 0.26, 0.03]} />
      </mesh>
      {/* Gold corner brackets */}
      {[[-0.24, 0.19], [0.24, 0.19], [-0.24, -0.04], [0.24, -0.04]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.26]} material={mat.gold}>
          <boxGeometry args={[0.042, 0.042, 0.018]} />
        </mesh>
      ))}
      {/* EIU Logo texture plane */}
      <mesh position={[0, 0.08, 0.258]} material={logoMat}>
        <planeGeometry args={[0.46, 0.20]} />
      </mesh>
    </>
  );
}

// ─── Chibi Scout Robot ────────────────────────────────────────────────────────
function ChibiRobot({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const chibiRef = useRef<THREE.Group>(null);
  const waveArmRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (chibiRef.current) {
      chibiRef.current.position.y = Math.sin(t * 1.6 + 1.0) * 0.035;
    }
    if (waveArmRef.current) {
      waveArmRef.current.rotation.z = Math.sin(t * 2.8) * 0.45 - 0.2;
    }
  });

  return (
    <group ref={chibiRef} position={[0.52, 0.34, 0.1]}>
      {/* Helmet */}
      <mesh material={mat.chibi} castShadow>
        <sphereGeometry args={[0.155, 14, 10]} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, -0.018, 0.118]} material={mat.visor}>
        <sphereGeometry args={[0.09, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.042, -0.01, 0.155]} material={mat.eye}>
        <sphereGeometry args={[0.02, 7, 5]} />
      </mesh>
      <mesh position={[0.042, -0.01, 0.155]} material={mat.eye}>
        <sphereGeometry args={[0.02, 7, 5]} />
      </mesh>
      {/* Antenna mast */}
      <mesh position={[0.015, 0.19, 0]} material={mat.gold}>
        <cylinderGeometry args={[0.007, 0.008, 0.1, 6]} />
      </mesh>
      {/* Antenna orb */}
      <mesh position={[0.015, 0.245, 0]} material={mat.cyan}>
        <sphereGeometry args={[0.019, 7, 5]} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, -0.18, 0]} material={mat.chibi} castShadow>
        <boxGeometry args={[0.2, 0.16, 0.13]} />
      </mesh>
      {/* Hold arm (left) */}
      <mesh position={[-0.135, -0.155, 0.02]} rotation={[0, 0, 0.7]} material={mat.chibi}>
        <cylinderGeometry args={[0.022, 0.022, 0.1, 7]} />
      </mesh>
      {/* Waving arm (right) */}
      <group ref={waveArmRef} position={[0.13, -0.13, 0]}>
        <mesh position={[0.055, 0.06, 0]} rotation={[0, 0, -0.6]} material={mat.chibi}>
          <cylinderGeometry args={[0.022, 0.022, 0.1, 7]} />
        </mesh>
        <mesh position={[0.1, 0.09, 0]} material={mat.cyan}>
          <sphereGeometry args={[0.032, 7, 5]} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Main Guardian Robot ──────────────────────────────────────────────────────
interface GuardianRobotProps {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}

export default function GuardianRobot3D({ mouseRef }: GuardianRobotProps) {
  const mat = useMaterials();
  const rootRef = useRef<THREE.Group>(null);  // handles flight path
  const bodyRef = useRef<THREE.Group>(null);  // handles breathing
  const headRef = useRef<THREE.Group>(null);  // handles cursor tracking
  const coreRef = useRef<THREE.Mesh>(null);
  const antennaOrbRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const blinkTimer = useRef(0);
  const blinkOpen = useRef(true);
  const blinkDelay = useRef(3.5 + Math.random() * 3);

  // Core and antenna materials need to be mutable — create them separately
  const coreMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#69c5a3", emissive: "#3da87e", emissiveIntensity: 1.2, roughness: 0.2,
  }), []);
  const antennaMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#e9ca8b", emissive: "#c99f55", emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.1,
  }), []);
  const thrusterMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#64a8d3", emissive: "#2d7fb4", emissiveIntensity: 1.5, roughness: 0.1,
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // ── Flight path: smooth figure-8 (lemniscate) within canvas ──
    if (rootRef.current) {
      const px = Math.sin(t * 0.38) * 0.72;
      const py = Math.sin(t * 0.76) * 0.28;
      rootRef.current.position.x += (px - rootRef.current.position.x) * 0.025;
      rootRef.current.position.y += (py - rootRef.current.position.y) * 0.025;
      // Subtle banking on horizontal movement
      const vx = Math.cos(t * 0.38) * 0.38;
      rootRef.current.rotation.z += (-vx * 0.08 - rootRef.current.rotation.z) * 0.06;
    }

    // ── Body breath ──
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 0.95) * 0.028;
    }

    // ── Head cursor tracking ──
    if (headRef.current) {
      headRef.current.rotation.x += (-mouseRef.current.y * 0.2 - headRef.current.rotation.x) * 0.07;
      headRef.current.rotation.y += (mouseRef.current.x * 0.26 - headRef.current.rotation.y) * 0.07;
    }

    // ── Arms gentle swing ──
    if (leftArmRef.current) leftArmRef.current.rotation.z = Math.sin(t * 0.85) * 0.06 + 0.06;
    if (rightArmRef.current) rightArmRef.current.rotation.z = -Math.sin(t * 0.85 + 1) * 0.06 - 0.06;

    // ── AI Core pulse ──
    coreMat.emissiveIntensity = 0.9 + Math.sin(t * 2.4) * 0.6;

    // ── Antenna pulse ──
    antennaMat.emissiveIntensity = 0.55 + Math.sin(t * 3.2) * 0.52;

    // ── Thruster glow ──
    thrusterMat.emissiveIntensity = 1.2 + Math.sin(t * 4.0) * 0.6;

    // ── Blink ──
    blinkTimer.current += 0.016;
    if (blinkTimer.current >= blinkDelay.current) {
      blinkOpen.current = false;
      setTimeout(() => { blinkOpen.current = true; }, 110);
      blinkTimer.current = 0;
      blinkDelay.current = 3 + Math.random() * 4;
    }
    const targetEyeScaleY = blinkOpen.current ? 1 : 0.05;
    if (leftEyeRef.current) leftEyeRef.current.scale.y += (targetEyeScaleY - leftEyeRef.current.scale.y) * 0.32;
    if (rightEyeRef.current) rightEyeRef.current.scale.y += (targetEyeScaleY - rightEyeRef.current.scale.y) * 0.32;
  });

  return (
    <group ref={rootRef}>
      {/* ── Scene lighting ── */}
      <ambientLight intensity={0.5} color="#8ab8d4" />
      <directionalLight position={[3, 5, 4]} intensity={1.2} color="#f4dfb0" />
      <pointLight position={[-2.5, 1, 2]} intensity={0.75} color="#64a8d3" />
      <pointLight position={[0, -1, 2]} intensity={0.45} color="#e9ca8b" />
      <pointLight position={[0, 0, -2]} intensity={0.2} color="#082945" />

      {/* ─────────── BODY GROUP ─────────── */}
      <group ref={bodyRef}>

        {/* Jetpack / Thruster pack */}
        <mesh position={[0, -0.5, -0.17]} material={mat.deepNavy} castShadow>
          <boxGeometry args={[0.5, 0.4, 0.2]} />
        </mesh>
        {/* Thruster nozzle L */}
        <mesh position={[-0.13, -0.7, -0.14]} rotation={[Math.PI / 2, 0, 0]} material={mat.navy}>
          <cylinderGeometry args={[0.065, 0.085, 0.11, 10]} />
        </mesh>
        {/* Thruster nozzle R */}
        <mesh position={[0.13, -0.7, -0.14]} rotation={[Math.PI / 2, 0, 0]} material={mat.navy}>
          <cylinderGeometry args={[0.065, 0.085, 0.11, 10]} />
        </mesh>
        {/* Thruster glow rings */}
        <mesh ref={coreRef} position={[-0.13, -0.77, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.018, 6, 12]} />
          <primitive object={thrusterMat} attach="material" />
        </mesh>
        <mesh position={[0.13, -0.77, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.018, 6, 12]} />
          <primitive object={thrusterMat} attach="material" />
        </mesh>

        {/* Legs */}
        <mesh position={[-0.185, -0.75, 0]} material={mat.navy} castShadow>
          <cylinderGeometry args={[0.07, 0.085, 0.26, 10]} />
        </mesh>
        <mesh position={[0.185, -0.75, 0]} material={mat.navy} castShadow>
          <cylinderGeometry args={[0.07, 0.085, 0.26, 10]} />
        </mesh>
        {/* Boot gold trim */}
        <mesh position={[-0.185, -0.9, 0.042]} material={mat.gold}>
          <boxGeometry args={[0.19, 0.055, 0.17]} />
        </mesh>
        <mesh position={[0.185, -0.9, 0.042]} material={mat.gold}>
          <boxGeometry args={[0.19, 0.055, 0.17]} />
        </mesh>

        {/* Main torso */}
        <mesh position={[0, -0.2, 0]} material={mat.navy} castShadow>
          <boxGeometry args={[0.76, 0.56, 0.44]} />
        </mesh>
        {/* Torso gold border ring */}
        <mesh position={[0, -0.2, 0.225]} material={mat.gold}>
          <torusGeometry args={[0.33, 0.011, 4, 28]} />
        </mesh>

        {/* EIU Logo Badge on chest */}
        <EiuLogoBadge mat={mat} />

        {/* AI Core sphere */}
        <mesh position={[0, -0.36, 0.25]}>
          <sphereGeometry args={[0.072, 14, 10]} />
          <primitive object={coreMat} attach="material" />
        </mesh>
        {/* Core ring */}
        <mesh position={[0, -0.36, 0.245]} rotation={[Math.PI / 2, 0, 0]} material={mat.cyan}>
          <torusGeometry args={[0.092, 0.011, 6, 16]} />
        </mesh>

        {/* Arms */}
        <group ref={leftArmRef} position={[-0.5, -0.2, 0]}>
          {/* Shoulder pad */}
          <mesh position={[0, 0.18, 0]} material={mat.gold}>
            <sphereGeometry args={[0.098, 10, 7]} />
          </mesh>
          {/* Upper arm */}
          <mesh position={[0, 0, 0]} material={mat.navy} castShadow>
            <cylinderGeometry args={[0.078, 0.072, 0.28, 10]} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.2, 0]} material={mat.cyan}>
            <sphereGeometry args={[0.072, 10, 7]} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.5, -0.2, 0]}>
          <mesh position={[0, 0.18, 0]} material={mat.gold}>
            <sphereGeometry args={[0.098, 10, 7]} />
          </mesh>
          <mesh position={[0, 0, 0]} material={mat.navy} castShadow>
            <cylinderGeometry args={[0.078, 0.072, 0.28, 10]} />
          </mesh>
          <mesh position={[0, -0.2, 0]} material={mat.cyan}>
            <sphereGeometry args={[0.072, 10, 7]} />
          </mesh>
        </group>
      </group>

      {/* ─────────── HEAD GROUP ─────────── */}
      <group ref={headRef} position={[0, 0.3, 0]}>
        {/* Helmet shell */}
        <mesh material={mat.navy} castShadow>
          <boxGeometry args={[0.7, 0.56, 0.54]} />
        </mesh>
        {/* Crown ridge gold */}
        <mesh position={[0, 0.295, 0]} material={mat.gold}>
          <boxGeometry args={[0.26, 0.028, 0.54]} />
        </mesh>
        {/* Helmet gold border */}
        <mesh position={[0, 0, 0.278]} material={mat.gold}>
          <torusGeometry args={[0.27, 0.011, 4, 24]} />
        </mesh>
        {/* Ear fins */}
        <mesh position={[-0.375, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mat.gold}>
          <coneGeometry args={[0.065, 0.16, 3]} />
        </mesh>
        <mesh position={[0.375, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={mat.gold}>
          <coneGeometry args={[0.065, 0.16, 3]} />
        </mesh>

        {/* Visor glass */}
        <mesh position={[0, -0.025, 0.278]} material={mat.visor}>
          <boxGeometry args={[0.52, 0.29, 0.038]} />
        </mesh>
        {/* Visor gloss highlight */}
        <mesh position={[0, 0.075, 0.305]} material={mat.white}>
          <boxGeometry args={[0.45, 0.016, 0.008]} />
        </mesh>

        {/* Eyes */}
        <mesh ref={leftEyeRef} position={[-0.135, -0.025, 0.305]} material={mat.eye}>
          <sphereGeometry args={[0.058, 10, 8]} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.135, -0.025, 0.305]} material={mat.eye}>
          <sphereGeometry args={[0.058, 10, 8]} />
        </mesh>
        {/* Eye glints */}
        <mesh position={[-0.122, 0.0, 0.36]} material={mat.white}>
          <sphereGeometry args={[0.02, 6, 4]} />
        </mesh>
        <mesh position={[0.148, 0.0, 0.36]} material={mat.white}>
          <sphereGeometry args={[0.02, 6, 4]} />
        </mesh>

        {/* Antenna mast */}
        <mesh position={[0, 0.42, 0]} material={mat.gold}>
          <cylinderGeometry args={[0.014, 0.018, 0.24, 6]} />
        </mesh>
        {/* Antenna orb */}
        <mesh ref={antennaOrbRef} position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.04, 10, 8]} />
          <primitive object={antennaMat} attach="material" />
        </mesh>
      </group>

      {/* ─────────── CHIBI SCOUT ─────────── */}
      <ChibiRobot mat={mat} />
    </group>
  );
}
