"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ─── Materials (memoised at module level so they're shared across renders) ───

const navyMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#082945"),
  metalness: 0.72,
  roughness: 0.28,
});
const deepNavyMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#041c31"),
  metalness: 0.8,
  roughness: 0.22,
});
const goldMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#e9ca8b"),
  metalness: 0.9,
  roughness: 0.12,
  emissive: new THREE.Color("#c99f55"),
  emissiveIntensity: 0.25,
});
const cyanMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#64a8d3"),
  metalness: 0.5,
  roughness: 0.3,
  emissive: new THREE.Color("#2d7fb4"),
  emissiveIntensity: 0.6,
});
const visorMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#0d3556"),
  metalness: 0.2,
  roughness: 0.05,
  transparent: true,
  opacity: 0.88,
});
const greenMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#69c5a3"),
  emissive: new THREE.Color("#3da87e"),
  emissiveIntensity: 1.2,
  roughness: 0.2,
});
const eyeMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#64a8d3"),
  emissive: new THREE.Color("#2d7fb4"),
  emissiveIntensity: 2.0,
  roughness: 0.1,
});
const chibiNavyMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#0d3a60"),
  metalness: 0.7,
  roughness: 0.3,
});
const whiteMat = new THREE.MeshStandardMaterial({ color: "#ffffff" });

// ─── Chibi Scout Robot ────────────────────────────────────────────────────────

function ChibiRobot({ chibiBobRef }: { chibiBobRef: React.MutableRefObject<THREE.Group | null> }) {
  const chibiRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!chibiRef.current) return;
    const t = clock.getElapsedTime();
    // Slow bob
    chibiRef.current.position.y = Math.sin(t * 1.4 + 1) * 0.04;
    // Chibi wave: rotate a child arm
    const arm = chibiRef.current.getObjectByName("chibiWaveArm");
    if (arm) {
      arm.rotation.z = Math.sin(t * 2.4) * 0.4 - 0.3;
    }
  });

  return (
    <group ref={chibiRef} position={[0.55, 0.38, 0.12]}>
      {/* Helmet */}
      <mesh position={[0, 0.26, 0]} material={chibiNavyMat} castShadow>
        <sphereGeometry args={[0.17, 16, 12]} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 0.24, 0.12]} material={visorMat}>
        <sphereGeometry args={[0.10, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.04, 0.27, 0.18]} material={eyeMat}>
        <sphereGeometry args={[0.022, 8, 6]} />
      </mesh>
      <mesh position={[0.04, 0.27, 0.18]} material={eyeMat}>
        <sphereGeometry args={[0.022, 8, 6]} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 0.09, 0]} material={chibiNavyMat} castShadow>
        <boxGeometry args={[0.22, 0.18, 0.14, 1, 1, 1]} />
      </mesh>
      {/* Chibi antenna */}
      <mesh position={[0.02, 0.44, 0]} material={goldMat}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
      </mesh>
      <mesh position={[0.02, 0.51, 0]} material={cyanMat}>
        <sphereGeometry args={[0.022, 8, 6]} />
      </mesh>
      {/* Waving arm */}
      <group name="chibiWaveArm" position={[0.14, 0.12, 0]}>
        <mesh position={[0.04, 0.04, 0]} material={chibiNavyMat}>
          <capsuleGeometry args={[0.028, 0.08, 4, 6]} />
        </mesh>
        <mesh position={[0.08, 0.08, 0]} material={cyanMat}>
          <sphereGeometry args={[0.036, 6, 4]} />
        </mesh>
      </group>
      {/* Hold-on arm (left) */}
      <mesh position={[-0.14, 0.1, 0.04]} material={chibiNavyMat}>
        <capsuleGeometry args={[0.025, 0.09, 4, 6]} />
      </mesh>
    </group>
  );
}

// ─── Main Guardian Robot ──────────────────────────────────────────────────────

interface GuardianRobotProps {
  /** A ref carrying normalised mouse coords [-1,1], updated externally */
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  onReady?: () => void;
}

export default function GuardianRobot3D({ mouseRef }: GuardianRobotProps) {
  const robotRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const antennaOrbRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const chibiBobRef = useRef<THREE.Group>(null);

  // Blinking state
  const blinkTimer = useRef(0);
  const blinkState = useRef(false);
  const blinkDuration = useRef(3 + Math.random() * 4);

  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const dt = clock.getDelta();
    if (!robotRef.current || !headRef.current) return;

    // ── Floating body breath ──
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 0.9) * 0.035;
    }

    // ── Head follows cursor (lerp) ──
    const targetHeadX = -mouseRef.current.y * 0.22;
    const targetHeadY = mouseRef.current.x * 0.28;
    headRef.current.rotation.x += (targetHeadX - headRef.current.rotation.x) * 0.06;
    headRef.current.rotation.y += (targetHeadY - headRef.current.rotation.y) * 0.06;

    // ── Body slight tilt ──
    if (robotRef.current) {
      robotRef.current.rotation.y += (mouseRef.current.x * 0.12 - robotRef.current.rotation.y) * 0.04;
      robotRef.current.rotation.x += (-mouseRef.current.y * 0.06 - robotRef.current.rotation.x) * 0.04;
    }

    // ── Arm gentle swing ──
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = Math.sin(t * 0.8) * 0.06 + 0.05;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = -Math.sin(t * 0.8 + 1) * 0.06 - 0.05;
    }

    // ── AI Core pulse ──
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.8 + Math.sin(t * 2.2) * 0.6;
    }

    // ── Antenna pulse ──
    if (antennaOrbRef.current) {
      const mat = antennaOrbRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(t * 3.1) * 0.5;
    }

    // ── Eye blink ──
    blinkTimer.current += 0.016;
    if (blinkTimer.current >= blinkDuration.current) {
      blinkState.current = true;
      setTimeout(() => {
        blinkState.current = false;
      }, 120);
      blinkTimer.current = 0;
      blinkDuration.current = 3 + Math.random() * 4;
    }
    const eyeScaleY = blinkState.current ? 0.05 : 1;
    if (leftEyeRef.current) leftEyeRef.current.scale.y += (eyeScaleY - leftEyeRef.current.scale.y) * 0.3;
    if (rightEyeRef.current) rightEyeRef.current.scale.y += (eyeScaleY - rightEyeRef.current.scale.y) * 0.3;
  });

  return (
    <group ref={robotRef} position={[0, 0, 0]}>
      {/* ── Lighting ── */}
      <ambientLight intensity={0.55} color="#8ab8d4" />
      <directionalLight position={[3, 5, 3]} intensity={1.1} color="#f4dfb0" castShadow />
      <pointLight position={[-2, 1, 2]} intensity={0.7} color="#64a8d3" />
      <pointLight position={[0, -1, 1.5]} intensity={0.4} color="#e9ca8b" />

      <group ref={bodyRef}>
        {/* ── Jetpack / Thruster pack ── */}
        <mesh position={[0, -0.52, -0.18]} material={deepNavyMat} castShadow>
          <boxGeometry args={[0.52, 0.44, 0.22]} />
        </mesh>
        {/* Thruster nozzles */}
        <mesh position={[-0.14, -0.74, -0.14]} rotation={[Math.PI / 2, 0, 0]} material={navyMat}>
          <cylinderGeometry args={[0.07, 0.09, 0.12, 10]} />
        </mesh>
        <mesh position={[0.14, -0.74, -0.14]} rotation={[Math.PI / 2, 0, 0]} material={navyMat}>
          <cylinderGeometry args={[0.07, 0.09, 0.12, 10]} />
        </mesh>
        {/* Thruster glow rings */}
        <mesh position={[-0.14, -0.81, -0.14]} rotation={[Math.PI / 2, 0, 0]} material={cyanMat}>
          <torusGeometry args={[0.074, 0.016, 6, 12]} />
        </mesh>
        <mesh position={[0.14, -0.81, -0.14]} rotation={[Math.PI / 2, 0, 0]} material={cyanMat}>
          <torusGeometry args={[0.074, 0.016, 6, 12]} />
        </mesh>

        {/* ── Legs ── */}
        <mesh position={[-0.2, -0.78, 0]} material={navyMat} castShadow>
          <capsuleGeometry args={[0.09, 0.22, 6, 10]} />
        </mesh>
        <mesh position={[0.2, -0.78, 0]} material={navyMat} castShadow>
          <capsuleGeometry args={[0.09, 0.22, 6, 10]} />
        </mesh>
        {/* Boot detail gold */}
        <mesh position={[-0.2, -0.94, 0.04]} material={goldMat}>
          <boxGeometry args={[0.2, 0.06, 0.18]} />
        </mesh>
        <mesh position={[0.2, -0.94, 0.04]} material={goldMat}>
          <boxGeometry args={[0.2, 0.06, 0.18]} />
        </mesh>

        {/* ── Main Torso ── */}
        <mesh position={[0, -0.22, 0]} material={navyMat} castShadow>
          <boxGeometry args={[0.78, 0.58, 0.46]} />
        </mesh>
        {/* Gold border trim */}
        <mesh position={[0, -0.22, 0.235]} material={goldMat}>
          <torusGeometry args={[0.34, 0.012, 4, 28]} />
        </mesh>

        {/* Chest shield recessed */}
        <mesh position={[0, -0.12, 0.24]} material={deepNavyMat}>
          <boxGeometry args={[0.52, 0.3, 0.04]} />
        </mesh>
        {/* Chest gold corner brackets (simplified as small cubes) */}
        <mesh position={[-0.26, -0.0, 0.25]} material={goldMat}><boxGeometry args={[0.04, 0.04, 0.02]} /></mesh>
        <mesh position={[0.26, -0.0, 0.25]} material={goldMat}><boxGeometry args={[0.04, 0.04, 0.02]} /></mesh>
        <mesh position={[-0.26, -0.24, 0.25]} material={goldMat}><boxGeometry args={[0.04, 0.04, 0.02]} /></mesh>
        <mesh position={[0.26, -0.24, 0.25]} material={goldMat}><boxGeometry args={[0.04, 0.04, 0.02]} /></mesh>

        {/* AI Core sphere */}
        <mesh ref={coreRef} position={[0, -0.38, 0.26]}>
          <sphereGeometry args={[0.076, 14, 10]} />
          <meshStandardMaterial
            color="#69c5a3"
            emissive="#3da87e"
            emissiveIntensity={1.2}
            roughness={0.2}
          />
        </mesh>
        {/* Core ring */}
        <mesh position={[0, -0.38, 0.255]} rotation={[Math.PI / 2, 0, 0]} material={cyanMat}>
          <torusGeometry args={[0.096, 0.012, 6, 16]} />
        </mesh>

        {/* ── Arms ── */}
        <group ref={leftArmRef} position={[-0.52, -0.22, 0]}>
          <mesh material={navyMat} castShadow>
            <capsuleGeometry args={[0.085, 0.26, 6, 10]} />
          </mesh>
          {/* Gold shoulder pad */}
          <mesh position={[0, 0.18, 0]} material={goldMat}>
            <sphereGeometry args={[0.10, 10, 7]} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.22, 0]} material={cyanMat}>
            <sphereGeometry args={[0.075, 10, 7]} />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.52, -0.22, 0]}>
          <mesh material={navyMat} castShadow>
            <capsuleGeometry args={[0.085, 0.26, 6, 10]} />
          </mesh>
          <mesh position={[0, 0.18, 0]} material={goldMat}>
            <sphereGeometry args={[0.10, 10, 7]} />
          </mesh>
          <mesh position={[0, -0.22, 0]} material={cyanMat}>
            <sphereGeometry args={[0.075, 10, 7]} />
          </mesh>
        </group>
      </group>

      {/* ── Head ── */}
      <group ref={headRef} position={[0, 0.28, 0]}>
        {/* Helmet shell */}
        <mesh material={navyMat} castShadow>
          <boxGeometry args={[0.72, 0.58, 0.56]} />
        </mesh>
        {/* Gold helmet ridge */}
        <mesh position={[0, 0.3, 0]} material={goldMat}>
          <boxGeometry args={[0.28, 0.03, 0.56]} />
        </mesh>
        {/* Gold border frame */}
        <mesh position={[0, 0, 0.285]} material={goldMat}>
          <torusGeometry args={[0.28, 0.012, 4, 24]} />
        </mesh>
        {/* Ear fins */}
        <mesh position={[-0.38, 0, 0]} material={goldMat}>
          <coneGeometry args={[0.07, 0.18, 3]} />
        </mesh>
        <mesh position={[0.38, 0, 0]} material={goldMat}>
          <coneGeometry args={[0.07, 0.18, 3]} />
        </mesh>

        {/* Visor */}
        <mesh position={[0, -0.03, 0.285]} material={visorMat}>
          <boxGeometry args={[0.55, 0.3, 0.04]} />
        </mesh>
        {/* Visor gloss line */}
        <mesh position={[0, 0.07, 0.31]} material={whiteMat}>
          <boxGeometry args={[0.48, 0.018, 0.01]} />
        </mesh>

        {/* Eyes */}
        <mesh ref={leftEyeRef} position={[-0.14, -0.03, 0.31]} material={eyeMat}>
          <sphereGeometry args={[0.062, 10, 8]} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.14, -0.03, 0.31]} material={eyeMat}>
          <sphereGeometry args={[0.062, 10, 8]} />
        </mesh>
        {/* Eye glint */}
        <mesh position={[-0.13, -0.01, 0.368]} material={whiteMat}>
          <sphereGeometry args={[0.022, 6, 4]} />
        </mesh>
        <mesh position={[0.15, -0.01, 0.368]} material={whiteMat}>
          <sphereGeometry args={[0.022, 6, 4]} />
        </mesh>

        {/* Antenna mast */}
        <mesh position={[0, 0.42, 0]} material={goldMat}>
          <cylinderGeometry args={[0.016, 0.02, 0.26, 6]} />
        </mesh>
        {/* Antenna orb */}
        <mesh ref={antennaOrbRef} position={[0, 0.56, 0]}>
          <sphereGeometry args={[0.042, 10, 8]} />
          <meshStandardMaterial
            color="#e9ca8b"
            emissive="#c99f55"
            emissiveIntensity={0.8}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </group>

      {/* ── Chibi Scout on right shoulder ── */}
      <ChibiRobot chibiBobRef={chibiBobRef} />
    </group>
  );
}
