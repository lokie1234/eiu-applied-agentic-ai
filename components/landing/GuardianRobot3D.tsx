"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// ─── EIU DESIGN DNA PALETTE ───────────────────────────────────────────────────
// Navy 950: #041C31 | Navy 900: #082945 | Navy 800: #123F68 | Navy 700: #18547F
// Accent Blue: #2D7FB4 | Gold 700: #9D7944 | Gold 600: #B39159 | Gold 300: #E9CA8B
// Gold 200: #F4DFB0 | Cream: #F7F4ED | Cream soft: #FBFAF7
// ─────────────────────────────────────────────────────────────────────────────

interface GuardianRobotProps {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage: number;
  isCtaHovered?: boolean;
  ctaPulsed?: boolean;
}

// ─── EIU Crest Badge on Robot Breastplate ────────────────────────────────────
function EiuCrestBadge({
  goldMat,
  deepNavyMat,
}: {
  goldMat: THREE.Material;
  deepNavyMat: THREE.Material;
}) {
  const logoTex = useTexture("/branding/EIU-logo-white.png");

  useEffect(() => {
    if (logoTex) {
      logoTex.colorSpace = THREE.SRGBColorSpace;
      logoTex.needsUpdate = true;
    }
  }, [logoTex]);

  const badgeLogoMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: logoTex,
        transparent: true,
        opacity: 0.96,
        side: THREE.FrontSide,
        depthWrite: false,
      }),
    [logoTex]
  );

  return (
    <group position={[0, 0.05, 0.285]}>
      {/* Recessed beveled badge plate */}
      <mesh material={deepNavyMat}>
        <boxGeometry args={[0.54, 0.22, 0.02]} />
      </mesh>

      {/* Gold micro-bezel border */}
      <mesh position={[0, 0, 0.012]} material={goldMat}>
        <boxGeometry args={[0.556, 0.008, 0.015]} />
      </mesh>
      <mesh position={[0, 0.106, 0.012]} material={goldMat}>
        <boxGeometry args={[0.556, 0.008, 0.015]} />
      </mesh>
      <mesh position={[-0.274, 0.053, 0.012]} material={goldMat}>
        <boxGeometry args={[0.008, 0.114, 0.015]} />
      </mesh>
      <mesh position={[0.274, 0.053, 0.012]} material={goldMat}>
        <boxGeometry args={[0.008, 0.114, 0.015]} />
      </mesh>

      {/* Gold corner brackets */}
      {[
        [-0.26, 0.09],
        [0.26, 0.09],
        [-0.26, 0.01],
        [0.26, 0.01],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.016]} material={goldMat}>
          <boxGeometry args={[0.032, 0.032, 0.012]} />
        </mesh>
      ))}

      {/* Crisp EIU Logo Texture */}
      <mesh position={[0, 0.052, 0.018]} material={badgeLogoMat}>
        <planeGeometry args={[0.48, 0.17]} />
      </mesh>
    </group>
  );
}

// ─── Autonomous Satellite Companion Drone ────────────────────────────────────
function CompanionDrone({
  mouseRef,
  stage,
  goldMat,
  navyMat,
  visorMat,
  accentBlueMat,
}: {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage: number;
  goldMat: THREE.Material;
  navyMat: THREE.Material;
  visorMat: THREE.Material;
  accentBlueMat: THREE.Material;
}) {
  const droneRef = useRef<THREE.Group>(null);
  const droneEyeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2D7FB4",
        emissive: "#2D7FB4",
        emissiveIntensity: 1.8,
        roughness: 0.1,
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!droneRef.current) return;
    const t = clock.getElapsedTime();

    // Subtle independent hovering orbit around the right shoulder
    const targetX = 0.88 + Math.cos(t * 0.9) * 0.08;
    const targetY = 0.52 + Math.sin(t * 1.4) * 0.09;
    const targetZ = 0.15 + Math.sin(t * 0.7) * 0.06;

    droneRef.current.position.x += (targetX - droneRef.current.position.x) * 0.05;
    droneRef.current.position.y += (targetY - droneRef.current.position.y) * 0.05;
    droneRef.current.position.z += (targetZ - droneRef.current.position.z) * 0.05;

    // Follow cursor curiosity
    droneRef.current.rotation.y = mouseRef.current.x * 0.35 + Math.sin(t * 1.2) * 0.1;
    droneRef.current.rotation.x = -mouseRef.current.y * 0.25;
    droneRef.current.rotation.z = Math.sin(t * 1.1) * 0.08;

    // Drone light pulse
    const dronePulse = stage >= 3 ? 1.6 + Math.sin(t * 3.0) * 0.6 : 0.2;
    droneEyeMat.emissiveIntensity = dronePulse;
  });

  return (
    <group ref={droneRef} position={[0.88, 0.52, 0.15]} scale={0.78}>
      {/* Sleek Spherical Pod Chassis */}
      <mesh material={navyMat} castShadow>
        <sphereGeometry args={[0.13, 24, 20]} />
      </mesh>

      {/* Gold Equatorial Halo Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
        <torusGeometry args={[0.138, 0.009, 8, 32]} />
      </mesh>

      {/* Curved Mini Visor */}
      <mesh position={[0, 0.015, 0.088]} material={visorMat}>
        <sphereGeometry args={[0.075, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
      </mesh>

      {/* Expressive Drone Eye Sensor */}
      <mesh position={[0, 0.015, 0.132]} material={droneEyeMat}>
        <sphereGeometry args={[0.024, 12, 10]} />
      </mesh>

      {/* Top Antenna Beacon */}
      <mesh position={[0, 0.15, 0]} material={goldMat}>
        <cylinderGeometry args={[0.005, 0.008, 0.08, 8]} />
      </mesh>
      <mesh position={[0, 0.195, 0]} material={accentBlueMat}>
        <sphereGeometry args={[0.016, 8, 8]} />
      </mesh>

      {/* Micro-thruster exhaust */}
      <mesh position={[0, -0.13, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
        <cylinderGeometry args={[0.025, 0.038, 0.03, 12]} />
      </mesh>
      <mesh position={[0, -0.15, 0]} material={accentBlueMat}>
        <sphereGeometry args={[0.015, 8, 8]} />
      </mesh>
    </group>
  );
}

// ─── Main Guardian Robot 3D ───────────────────────────────────────────────────
export default function GuardianRobot3D({
  mouseRef,
  stage,
  isCtaHovered = false,
  ctaPulsed = false,
}: GuardianRobotProps) {
  // Master hierarchy refs
  const rootRef = useRef<THREE.Group>(null);
  const hoverGroupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  // Dynamic mesh elements
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const aiCoreRef = useRef<THREE.Mesh>(null);
  const aiRingRef = useRef<THREE.Mesh>(null);
  const antennaOrbRef = useRef<THREE.Mesh>(null);
  const thrusterHaloL = useRef<THREE.Mesh>(null);
  const thrusterHaloR = useRef<THREE.Mesh>(null);

  // Eye blink physics
  const blinkTimer = useRef(0);
  const blinkOpen = useRef(true);
  const nextBlink = useRef(4.0);

  // Lighting refs
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const corePointLightRef = useRef<THREE.PointLight>(null);

  // ─── MATERIALS (EIU DESIGN DNA) ─────────────────────────────────────────────
  const materials = useMemo(() => {
    return {
      // Primary Navy 900 armor with smooth satin sheen
      navyArmor: new THREE.MeshStandardMaterial({
        color: "#082945",
        metalness: 0.74,
        roughness: 0.24,
      }),
      // Deepest Navy 950 for structural recesses and chassis joints
      deepNavy: new THREE.MeshStandardMaterial({
        color: "#041C31",
        metalness: 0.85,
        roughness: 0.2,
      }),
      // Secondary Navy 800 for layered flank cowlings
      navyFlank: new THREE.MeshStandardMaterial({
        color: "#123F68",
        metalness: 0.68,
        roughness: 0.28,
      }),
      // Navy 700 for interactive articulated joints
      navyJoint: new THREE.MeshStandardMaterial({
        color: "#18547F",
        metalness: 0.6,
        roughness: 0.32,
      }),
      // Primary Gold 600 for precision chassis trims
      goldPrimary: new THREE.MeshStandardMaterial({
        color: "#B39159",
        metalness: 0.92,
        roughness: 0.14,
        emissive: new THREE.Color("#B39159"),
        emissiveIntensity: 0.18,
      }),
      // Warm Gold 300 for highlights and beacons
      goldHighlight: new THREE.MeshStandardMaterial({
        color: "#E9CA8B",
        metalness: 0.9,
        roughness: 0.12,
        emissive: new THREE.Color("#E9CA8B"),
        emissiveIntensity: 0.35,
      }),
      // Accent Blue for AI data energy channels
      accentBlue: new THREE.MeshStandardMaterial({
        color: "#2D7FB4",
        metalness: 0.45,
        roughness: 0.25,
        emissive: new THREE.Color("#2D7FB4"),
        emissiveIntensity: 0.8,
      }),
      // High-grade curved optical glass visor (tinted dark indigo)
      visorGlass: new THREE.MeshPhysicalMaterial({
        color: "#031422",
        metalness: 0.2,
        roughness: 0.05,
        transmission: 0.22,
        thickness: 0.5,
        ior: 1.48,
        transparent: true,
        opacity: 0.94,
        reflectivity: 0.9,
      }),
      // Matte Cream for soft ambient interior housing
      creamMat: new THREE.MeshStandardMaterial({
        color: "#F7F4ED",
        roughness: 0.4,
        metalness: 0.1,
      }),
      // Specular white for eye glints and micro reflections
      whiteSpec: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
    };
  }, []);

  // ─── DYNAMIC SHADER/EMISSIVE MATERIALS ──────────────────────────────────────
  const eyeEmissiveMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2D7FB4",
        emissive: "#64A8D3",
        emissiveIntensity: 0,
        roughness: 0.08,
      }),
    []
  );

  const coreEmissiveMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2D7FB4",
        emissive: "#2D7FB4",
        emissiveIntensity: 0,
        roughness: 0.15,
      }),
    []
  );

  const antennaEmissiveMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#E9CA8B",
        emissive: "#E9CA8B",
        emissiveIntensity: 0,
        metalness: 0.8,
        roughness: 0.1,
      }),
    []
  );

  const thrusterGlowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#2D7FB4",
        transparent: true,
        opacity: 0.65,
      }),
    []
  );

  // ─── FRAME UPDATE: MOTION, PHYSICS & POWER-ON SEQUENCE ──────────────────────
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // 1. STAGED POWER-ON TRANSITIONS (0.0s -> 3.5s)
    // Stage 0: 0.0s - 0.5s: Environment awake, robot in dark silhouette
    // Stage 1: 0.5s - 1.2s: Robot emergence, body lighting increases
    // Stage 2: 1.2s - 1.6s: Visor awakens
    // Stage 3: 1.6s: "think" word -> Eye ignition + Core breath pulse!
    // Stage 4: 2.0s: "move" word -> Antenna beacon active, full idle
    const powerLevel = Math.min(1.0, Math.max(0.05, (t - 0.4) / 1.4));

    // Dynamic light ramp-up
    if (keyLightRef.current) {
      keyLightRef.current.intensity = THREE.MathUtils.lerp(
        keyLightRef.current.intensity,
        0.3 + powerLevel * 1.15,
        0.08
      );
    }
    if (rimLightRef.current) {
      rimLightRef.current.intensity = THREE.MathUtils.lerp(
        rimLightRef.current.intensity,
        0.2 + powerLevel * 0.95,
        0.08
      );
    }

    // Emergence translation: emerges softly from translateY: 0.22 -> 0.0
    if (rootRef.current) {
      const targetY = stage >= 1 ? 0 : -0.22;
      const targetScale = stage >= 1 ? 1.0 : 0.96;
      rootRef.current.position.y += (targetY - rootRef.current.position.y) * 0.05;
      rootRef.current.scale.x += (targetScale - rootRef.current.scale.x) * 0.05;
      rootRef.current.scale.y = rootRef.current.scale.x;
      rootRef.current.scale.z = rootRef.current.scale.x;
    }

    // 2. CALM ORGANIC HOVERING PHYSICS (AFTER INITIALIZATION)
    if (hoverGroupRef.current) {
      // Gentle floating levitation (slow sine period ~3.8s)
      const hoverY = Math.sin(t * 1.65) * 0.038;
      const hoverRoll = Math.cos(t * 0.85) * 0.018;
      hoverGroupRef.current.position.y = hoverY;
      hoverGroupRef.current.rotation.z = hoverRoll;
    }

    // 3. CURSOR & CTA TRACKING INTERACTION (LERP / SPRING)
    if (headRef.current) {
      let targetYaw = 0;
      let targetPitch = 0;

      if (isCtaHovered) {
        // Robot gracefully directs gaze toward the CTA button (bottom-left)
        targetYaw = -0.32;
        targetPitch = -0.16;
      } else {
        // Natural cursor following with bounded range (+/- 16 degrees)
        targetYaw = mouseRef.current.x * 0.28;
        targetPitch = -mouseRef.current.y * 0.18;
      }

      // Smooth organic lerp
      headRef.current.rotation.y += (targetYaw - headRef.current.rotation.y) * 0.065;
      headRef.current.rotation.x += (targetPitch - headRef.current.rotation.x) * 0.065;
    }

    // Subtle torso banking with mouse movement
    if (torsoRef.current) {
      const targetTorsoYaw = mouseRef.current.x * 0.09;
      const targetTorsoRoll = -mouseRef.current.x * 0.04;
      torsoRef.current.rotation.y += (targetTorsoYaw - torsoRef.current.rotation.y) * 0.04;
      torsoRef.current.rotation.z += (targetTorsoRoll - torsoRef.current.rotation.z) * 0.04;
    }

    // Arm postures: welcoming gesture when CTA hovered
    if (rightArmRef.current) {
      const targetArmZ = isCtaHovered ? -0.34 : Math.sin(t * 1.2) * 0.04 - 0.08;
      const targetArmX = isCtaHovered ? 0.24 : 0;
      rightArmRef.current.rotation.z += (targetArmZ - rightArmRef.current.rotation.z) * 0.07;
      rightArmRef.current.rotation.x += (targetArmX - rightArmRef.current.rotation.x) * 0.07;
    }
    if (leftArmRef.current) {
      const targetArmZ = Math.sin(t * 1.2 + 1.2) * 0.04 + 0.08;
      leftArmRef.current.rotation.z += (targetArmZ - leftArmRef.current.rotation.z) * 0.07;
    }

    // 4. INTELLIGENT AI CORE & EMISSIVE ENERGY PULSES
    if (stage >= 3) {
      // Base organic respiration pulse (warm gold-blue)
      const basePulse = Math.sin(t * 2.2) * 0.35 + 0.95;
      // Pulse resonance when "think" occurs or CTA clicked
      const clickBoost = ctaPulsed ? 2.5 : isCtaHovered ? 1.4 : 1.0;
      coreEmissiveMat.emissiveIntensity = basePulse * clickBoost;

      if (corePointLightRef.current) {
        corePointLightRef.current.intensity = 0.8 * basePulse * clickBoost;
      }
    } else {
      coreEmissiveMat.emissiveIntensity = 0.1;
    }

    // Antenna pulse (activates at stage >= 4)
    if (stage >= 4) {
      antennaEmissiveMat.emissiveIntensity = 0.9 + Math.sin(t * 3.6) * 0.6;
    } else {
      antennaEmissiveMat.emissiveIntensity = 0.05;
    }

    // Ion thruster pulse
    thrusterGlowMat.opacity = 0.5 + Math.sin(t * 4.2) * 0.25;

    // 5. NATURAL EYE BLINK & SACCADES
    if (stage >= 3) {
      eyeEmissiveMat.emissiveIntensity = 2.4;
      blinkTimer.current += 0.016;
      if (blinkTimer.current >= nextBlink.current) {
        blinkOpen.current = false;
        setTimeout(() => {
          blinkOpen.current = true;
        }, 115);
        blinkTimer.current = 0;
        nextBlink.current = 3.5 + Math.random() * 4.0;
      }
    } else {
      eyeEmissiveMat.emissiveIntensity = 0;
    }

    const eyeScaleY = blinkOpen.current ? 1.0 : 0.06;
    if (leftEyeRef.current) {
      leftEyeRef.current.scale.y += (eyeScaleY - leftEyeRef.current.scale.y) * 0.35;
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.scale.y += (eyeScaleY - rightEyeRef.current.scale.y) * 0.35;
    }
  });

  return (
    <group ref={rootRef}>
      {/* ─── LIGHTING RIG (Cinematic Studio Hierarchy) ───────────────────── */}
      <ambientLight intensity={0.48} color="#8AB8D4" />

      {/* Key Warm Sunlight */}
      <directionalLight
        ref={keyLightRef}
        position={[3.8, 4.5, 4.2]}
        intensity={1.25}
        color="#F4DFB0"
      />

      {/* Rim Accent Blue Light */}
      <directionalLight
        ref={rimLightRef}
        position={[-4.2, 1.8, -2.5]}
        intensity={1.1}
        color="#2D7FB4"
      />

      {/* Soft Gold Fill from Lower-Right */}
      <pointLight position={[2.5, -1.2, 2.2]} intensity={0.42} color="#E9CA8B" />

      {/* AI Core Internal Point Light */}
      <pointLight
        ref={corePointLightRef}
        position={[0, -0.32, 0.38]}
        intensity={0.8}
        distance={2.8}
        color="#2D7FB4"
      />

      {/* ─── HOVER SUSPENSION GROUP ───────────────────────────────────────── */}
      <group ref={hoverGroupRef}>
        {/* ───────────── TORSO CHASSIS ───────────── */}
        <group ref={torsoRef}>
          {/* Cybernetic Neck Ring */}
          <mesh position={[0, 0.22, 0]} material={materials.deepNavy}>
            <cylinderGeometry args={[0.16, 0.19, 0.12, 24]} />
          </mesh>
          <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
            <torusGeometry args={[0.185, 0.009, 8, 32]} />
          </mesh>

          {/* Sculpted Main Breastplate (Rounded Aerodynamic Armor) */}
          <mesh position={[0, -0.15, 0.04]} material={materials.navyArmor} castShadow>
            <cylinderGeometry args={[0.42, 0.38, 0.58, 32]} />
          </mesh>

          {/* Deep Navy Backplate & Reactor Mount */}
          <mesh position={[0, -0.15, -0.06]} material={materials.deepNavy}>
            <cylinderGeometry args={[0.39, 0.36, 0.56, 24]} />
          </mesh>

          {/* Front Sculpted Armor Shell (Curved Chest Contour) */}
          <mesh position={[0, -0.06, 0.18]} rotation={[0.08, 0, 0]} material={materials.navyArmor}>
            <boxGeometry args={[0.68, 0.36, 0.18]} />
          </mesh>

          {/* Gold Perimeter Pinstriping on Chest */}
          <mesh position={[0, -0.06, 0.272]} material={materials.goldPrimary}>
            <boxGeometry args={[0.7, 0.009, 0.015]} />
          </mesh>

          {/* Flank Armor Cowlings (Layered Aerodynamic Panels) */}
          <mesh position={[-0.38, -0.14, 0.06]} rotation={[0, 0.22, -0.08]} material={materials.navyFlank}>
            <boxGeometry args={[0.12, 0.46, 0.32]} />
          </mesh>
          <mesh position={[0.38, -0.14, 0.06]} rotation={[0, -0.22, 0.08]} material={materials.navyFlank}>
            <boxGeometry args={[0.12, 0.46, 0.32]} />
          </mesh>

          {/* EIU Crest Badge on Breastplate */}
          <EiuCrestBadge
            goldMat={materials.goldHighlight}
            deepNavyMat={materials.deepNavy}
          />

          {/* ─── CENTRAL AI CORE REACTOR ─── */}
          <group position={[0, -0.32, 0.23]}>
            {/* Outer Concentric Gold Bezel */}
            <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
              <torusGeometry args={[0.115, 0.014, 12, 36]} />
            </mesh>
            {/* Secondary Inner Bezel */}
            <mesh position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
              <torusGeometry args={[0.086, 0.008, 8, 32]} />
            </mesh>
            {/* Dark Optical Recess */}
            <mesh position={[0, 0, -0.01]} material={materials.deepNavy}>
              <cylinderGeometry args={[0.105, 0.105, 0.03, 24]} />
            </mesh>
            {/* Luminous Pulsing AI Core Heart */}
            <mesh ref={aiCoreRef} position={[0, 0, 0.02]}>
              <sphereGeometry args={[0.062, 24, 20]} />
              <primitive object={coreEmissiveMat} attach="material" />
            </mesh>
            {/* Core Optical Outer Halo Ring */}
            <mesh ref={aiRingRef} position={[0, 0, 0.025]} rotation={[0, 0, Math.PI / 4]}>
              <torusGeometry args={[0.072, 0.006, 6, 24]} />
              <primitive object={coreEmissiveMat} attach="material" />
            </mesh>
          </group>

          {/* Articulated Lower Spine Segments */}
          {[-0.46, -0.54].map((y, i) => (
            <mesh key={i} position={[0, y, 0]} material={materials.navyJoint}>
              <cylinderGeometry args={[0.26 - i * 0.02, 0.28 - i * 0.02, 0.06, 24]} />
            </mesh>
          ))}

          {/* ─── LEVITATING REPULSOR DRIVE (STREAMLINED HOVER FIN) ─── */}
          {/* Replaces clunky block feet with a sleek, aerodynamic hover propulsion chassis */}
          <group position={[0, -0.66, 0]}>
            {/* Base Repulsor Chassis */}
            <mesh material={materials.deepNavy}>
              <cylinderGeometry args={[0.24, 0.14, 0.22, 24]} />
            </mesh>

            {/* Twin Vector Thruster Nozzles */}
            {[-0.14, 0.14].map((x, i) => (
              <group key={i} position={[x, -0.1, -0.02]}>
                {/* Thruster Bell */}
                <mesh material={materials.navyArmor}>
                  <cylinderGeometry args={[0.075, 0.095, 0.14, 20]} />
                </mesh>
                {/* Gold Trim Ring */}
                <mesh position={[0, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                  <torusGeometry args={[0.096, 0.012, 8, 24]} />
                </mesh>
                {/* Glowing Ion Exhaust Disk */}
                <mesh
                  ref={i === 0 ? thrusterHaloL : thrusterHaloR}
                  position={[0, -0.082, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <circleGeometry args={[0.088, 24]} />
                  <primitive object={thrusterGlowMat} attach="material" />
                </mesh>
              </group>
            ))}

            {/* Aerodynamic Lateral Stabilizer Fins with Gold Edge */}
            {[-0.26, 0.26].map((x, i) => (
              <group key={i} position={[x, -0.02, 0]} rotation={[0, 0, i === 0 ? 0.32 : -0.32]}>
                <mesh material={materials.navyArmor}>
                  <boxGeometry args={[0.025, 0.22, 0.16]} />
                </mesh>
                <mesh position={[i === 0 ? -0.014 : 0.014, 0, 0]} material={materials.goldPrimary}>
                  <boxGeometry args={[0.008, 0.224, 0.015]} />
                </mesh>
              </group>
            ))}
          </group>

          {/* ─── ARTICULATED ERGONOMIC ARMS ─── */}
          {/* Left Arm */}
          <group ref={leftArmRef} position={[-0.48, 0.02, 0.04]}>
            {/* Shoulder Bell (Pauldron) */}
            <mesh material={materials.navyArmor} castShadow>
              <sphereGeometry args={[0.145, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
            </mesh>
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
              <torusGeometry args={[0.138, 0.009, 8, 24]} />
            </mesh>
            {/* Upper Arm Bone */}
            <mesh position={[-0.04, -0.16, 0]} material={materials.navyFlank}>
              <cylinderGeometry args={[0.065, 0.058, 0.2, 16]} />
            </mesh>
            {/* Elbow Joint */}
            <mesh position={[-0.04, -0.27, 0]} material={materials.navyJoint}>
              <sphereGeometry args={[0.06, 14, 12]} />
            </mesh>
            {/* Forearm & Hand */}
            <mesh position={[-0.04, -0.39, 0.03]} rotation={[0.22, 0, 0]} material={materials.navyArmor}>
              <cylinderGeometry args={[0.058, 0.05, 0.22, 16]} />
            </mesh>
            <mesh position={[-0.04, -0.51, 0.06]} material={materials.accentBlue}>
              <sphereGeometry args={[0.052, 12, 10]} />
            </mesh>
          </group>

          {/* Right Arm (Responsive Welcoming Arm) */}
          <group ref={rightArmRef} position={[0.48, 0.02, 0.04]}>
            <mesh material={materials.navyArmor} castShadow>
              <sphereGeometry args={[0.145, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
            </mesh>
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
              <torusGeometry args={[0.138, 0.009, 8, 24]} />
            </mesh>
            <mesh position={[0.04, -0.16, 0]} material={materials.navyFlank}>
              <cylinderGeometry args={[0.065, 0.058, 0.2, 16]} />
            </mesh>
            <mesh position={[0.04, -0.27, 0]} material={materials.navyJoint}>
              <sphereGeometry args={[0.06, 14, 12]} />
            </mesh>
            <mesh position={[0.04, -0.39, 0.03]} rotation={[0.22, 0, 0]} material={materials.navyArmor}>
              <cylinderGeometry args={[0.058, 0.05, 0.22, 16]} />
            </mesh>
            <mesh position={[0.04, -0.51, 0.06]} material={materials.accentBlue}>
              <sphereGeometry args={[0.052, 12, 10]} />
            </mesh>
          </group>
        </group>

        {/* ───────────── AERODYNAMIC SCULPTED HEAD ───────────── */}
        <group ref={headRef} position={[0, 0.44, 0]}>
          {/* Main Helmet Dome (Smooth Contoured Shell) */}
          <mesh material={materials.navyArmor} castShadow>
            <sphereGeometry args={[0.38, 32, 24]} />
          </mesh>

          {/* Top Aerodynamic Brow & Crown Ridge */}
          <mesh position={[0, 0.28, 0]} rotation={[0.1, 0, 0]} material={materials.navyArmor}>
            <boxGeometry args={[0.26, 0.12, 0.44]} />
          </mesh>
          <mesh position={[0, 0.34, 0]} material={materials.goldPrimary}>
            <boxGeometry args={[0.042, 0.016, 0.42]} />
          </mesh>

          {/* Rear Occipital Head Shell */}
          <mesh position={[0, 0.02, -0.14]} material={materials.deepNavy}>
            <sphereGeometry args={[0.34, 24, 20]} />
          </mesh>

          {/* Curved Panoramic Optical Visor */}
          <mesh position={[0, 0.02, 0.14]} rotation={[0.06, 0, 0]} material={materials.visorGlass}>
            <sphereGeometry args={[0.32, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
          </mesh>

          {/* Gold Visor Perimeter Bezel */}
          <mesh position={[0, 0.02, 0.26]} rotation={[Math.PI / 2 - 0.06, 0, 0]} material={materials.goldPrimary}>
            <torusGeometry args={[0.278, 0.009, 8, 32]} />
          </mesh>

          {/* Visor Glaze Reflection Highlight Bar */}
          <mesh position={[0, 0.12, 0.31]} rotation={[0, 0, 0.04]} material={materials.whiteSpec}>
            <boxGeometry args={[0.32, 0.012, 0.004]} />
          </mesh>

          {/* ─── INTELLIGENT DIGITAL APERTURE EYES ─── */}
          <group position={[0, 0.025, 0.305]}>
            {/* Left Eye */}
            <group position={[-0.115, 0, 0]}>
              <mesh ref={leftEyeRef}>
                <capsuleGeometry args={[0.024, 0.065, 8, 16]} />
                <primitive object={eyeEmissiveMat} attach="material" />
              </mesh>
              {/* Eye Glint */}
              <mesh position={[-0.012, 0.016, 0.024]} material={materials.whiteSpec}>
                <sphereGeometry args={[0.01, 8, 8]} />
              </mesh>
            </group>

            {/* Right Eye */}
            <group position={[0.115, 0, 0]}>
              <mesh ref={rightEyeRef}>
                <capsuleGeometry args={[0.024, 0.065, 8, 16]} />
                <primitive object={eyeEmissiveMat} attach="material" />
              </mesh>
              {/* Eye Glint */}
              <mesh position={[0.012, 0.016, 0.024]} material={materials.whiteSpec}>
                <sphereGeometry args={[0.01, 8, 8]} />
              </mesh>
            </group>
          </group>

          {/* ─── SIDE NEURAL SENSOR PODS (EARS) ─── */}
          {[-0.38, 0.38].map((x, i) => (
            <group key={i} position={[x, 0.02, 0]} rotation={[0, 0, i === 0 ? Math.PI / 2 : -Math.PI / 2]}>
              {/* Cylindrical Sensor Housing */}
              <mesh material={materials.navyArmor}>
                <cylinderGeometry args={[0.09, 0.105, 0.06, 24]} />
              </mesh>
              {/* Concentric Gold Sensor Rim */}
              <mesh position={[0, 0.032, 0]} material={materials.goldPrimary}>
                <torusGeometry args={[0.088, 0.009, 8, 24]} />
              </mesh>
              {/* Blue Indicator Status Slit */}
              <mesh position={[0, 0.036, 0]} material={materials.accentBlue}>
                <boxGeometry args={[0.07, 0.006, 0.016]} />
              </mesh>
            </group>
          ))}

          {/* ─── TOP NEURAL SPIRE & BEACON ─── */}
          <group position={[0, 0.38, 0]}>
            {/* Tapered Mast in Gold 600 */}
            <mesh material={materials.goldPrimary}>
              <cylinderGeometry args={[0.009, 0.018, 0.22, 16]} />
            </mesh>
            {/* Base Bezel Ring */}
            <mesh position={[0, -0.09, 0]} material={materials.goldHighlight}>
              <cylinderGeometry args={[0.032, 0.042, 0.02, 16]} />
            </mesh>
            {/* Luminous Neural Beacon Orb */}
            <mesh ref={antennaOrbRef} position={[0, 0.125, 0]}>
              <sphereGeometry args={[0.034, 16, 14]} />
              <primitive object={antennaEmissiveMat} attach="material" />
            </mesh>
            {/* Dual Micro-Halo Rings on Antenna */}
            <mesh position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
              <torusGeometry args={[0.046, 0.005, 6, 20]} />
            </mesh>
          </group>
        </group>

        {/* ───────────── SATELLITE COMPANION DRONE ───────────── */}
        <CompanionDrone
          mouseRef={mouseRef}
          stage={stage}
          goldMat={materials.goldPrimary}
          navyMat={materials.navyArmor}
          visorMat={materials.visorGlass}
          accentBlueMat={materials.accentBlue}
        />
      </group>
    </group>
  );
}
