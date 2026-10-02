"use client";

import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useTexture, Html } from "@react-three/drei";
import * as THREE from "three";

// ─── EIU DESIGN DNA PALETTE ───────────────────────────────────────────────────
// Navy 950: #041C31 | Navy 900: #082945 | Navy 800: #123F68 | Navy 700: #18547F
// Accent Blue: #2D7FB4 | Gold 700: #9D7944 | Gold 600: #B39159 | Gold 300: #E9CA8B
// Gold 200: #F4DFB0 | Cream: #F7F4ED | Cream soft: #FBFAF7
// ─────────────────────────────────────────────────────────────────────────────

export type RobotInteractionState =
  | "idle"
  | "lookingAtAccess"
  | "typing"
  | "processing"
  | "shakeError"
  | "success";

interface GuardianRobotProps {
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage?: number;
  robotState?: RobotInteractionState;
  isCtaHovered?: boolean;
  ctaPulsed?: boolean;
}

// ─── EIU Crest Badge on Robot Breastplate (Prominently mounted on torso front) ──
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
      // Exact UV crop to wordmark and emblem bounding box (2702 x 752 within 3750 x 3750)
      logoTex.offset.set(524 / 3750, 1499 / 3750);
      logoTex.repeat.set(2702 / 3750, 752 / 3750);
      logoTex.wrapS = THREE.ClampToEdgeWrapping;
      logoTex.wrapT = THREE.ClampToEdgeWrapping;
      logoTex.needsUpdate = true;
    }
  }, [logoTex]);

  const badgeLogoMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: logoTex,
        transparent: true,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false, // Pure radiant white, unhindered by ambient shadows
      }),
    [logoTex]
  );

  return (
    // Mounted prominently in the center of the breastplate:
    // y = -0.07 is cleanly below the helmet chin (y = 0.08) and above the AI core (y = -0.32)
    // z = 0.288 places it flush on the front chest armor shell
    // rotation x = 0.08 matches the chest armor pitch!
    <group position={[0, -0.07, 0.288]} rotation={[0.08, 0, 0]}>
      {/* Recessed beveled badge plate in deep EIU Navy #041C31 */}
      <mesh material={deepNavyMat}>
        <boxGeometry args={[0.56, 0.17, 0.018]} />
      </mesh>

      {/* Gold micro-bezel border in Gold 600 */}
      <mesh position={[0, -0.081, 0.011]} material={goldMat}>
        <boxGeometry args={[0.576, 0.008, 0.015]} />
      </mesh>
      <mesh position={[0, 0.081, 0.011]} material={goldMat}>
        <boxGeometry args={[0.576, 0.008, 0.015]} />
      </mesh>
      <mesh position={[-0.284, 0, 0.011]} material={goldMat}>
        <boxGeometry args={[0.008, 0.17, 0.015]} />
      </mesh>
      <mesh position={[0.284, 0, 0.011]} material={goldMat}>
        <boxGeometry args={[0.008, 0.17, 0.015]} />
      </mesh>

      {/* Gold corner brackets */}
      {[
        [-0.27, 0.07],
        [0.27, 0.07],
        [-0.27, -0.07],
        [0.27, -0.07],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.014]} material={goldMat}>
          <boxGeometry args={[0.026, 0.026, 0.012]} />
        </mesh>
      ))}

      {/* Official White EIU Logo - Physical decal on body, ratio ~3.59 : 1 */}
      <mesh position={[0, 0, 0.016]} material={badgeLogoMat}>
        <planeGeometry args={[0.50, 0.139]} />
      </mesh>

      {/* Dedicated Soft Micro-fill Light ensuring EIU Logo is vividly legible */}
      <pointLight position={[0, 0, 0.22]} intensity={0.65} distance={1.2} color="#FFFFFF" />
    </group>
  );
}

// ─── MASTER PATROL ORBIT GEOMETRY (DOUBLED TO SPAN ENTIRE WEB SPACE) ────────────
export const ORBIT_CENTER_X = 2.0;
export const ORBIT_CENTER_Y = 0.0;
export const ORBIT_RADIUS_X = 4.40;
export const ORBIT_RADIUS_Y = 2.60;
export const ORBIT_RADIUS_Z = 0.88;

export function getMasterOrbitPoint(theta: number): THREE.Vector3 {
  // Doubled orbit scale to span the available space generously across the page:
  // Semi-major X = 4.40, Semi-minor Y = 2.60, Depth Z = 0.88
  const x = ORBIT_CENTER_X + Math.cos(theta) * ORBIT_RADIUS_X + Math.sin(theta) * 0.24;
  const y = ORBIT_CENTER_Y + Math.sin(theta) * ORBIT_RADIUS_Y - Math.cos(theta) * 0.20;
  const z = Math.sin(theta) * ORBIT_RADIUS_Z + Math.cos(theta) * 0.48;
  return new THREE.Vector3(x, y, z);
}

// Check whether drop point (x, y) is inside or near the orbit corridor
export function evaluateDropPosition(x: number, y: number): {
  isInside: boolean;
  nearestTheta: number;
  nearestPoint: THREE.Vector3;
  distance: number;
} {
  const relX = x - ORBIT_CENTER_X;
  const relY = y - ORBIT_CENTER_Y;
  const theta0 = Math.atan2(relY / ORBIT_RADIUS_Y, relX / ORBIT_RADIUS_X);
  let bestDist = Infinity;
  let bestTheta = theta0;
  let bestPoint = getMasterOrbitPoint(theta0);

  for (let i = -18; i <= 18; i++) {
    const testTheta = theta0 + (i * Math.PI) / 36;
    const p = getMasterOrbitPoint(testTheta);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestDist) {
      bestDist = d;
      bestTheta = testTheta;
      bestPoint = p;
    }
  }

  // Normalized radius in orbital ellipse
  const rNorm = Math.pow(relX / ORBIT_RADIUS_X, 2) + Math.pow(relY / ORBIT_RADIUS_Y, 2);

  // Inside ellipse corridor or within close corridor to orbit line
  const isInside = (rNorm >= 0.60 && rNorm <= 1.48) || bestDist <= 1.6;
  const normalizedTheta = ((bestTheta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  return {
    isInside,
    nearestTheta: normalizedTheta,
    nearestPoint: bestPoint,
    distance: bestDist,
  };
}

// ─── VISIBLE 3D ORBIT TRACK COMPONENT (DOUBLED FULL CLOSED RING, NO VERTICAL LINES) ──
function RobotOrbitTrack({
  curve,
  isErrorRef,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  isErrorRef: React.MutableRefObject<boolean>;
}) {
  const pulseMeshRef = useRef<THREE.Mesh>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const auraMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const isErr = isErrorRef.current;

    // Pulse bead position moving ahead on track
    if (pulseMeshRef.current) {
      const pulseT = (t * 0.14) % 1.0;
      const pt = curve.getPointAt(pulseT);
      pulseMeshRef.current.position.copy(pt);
    }

    // Dynamic track color & glow
    if (coreMatRef.current) {
      const targetColor = isErr ? "#FF453A" : "#E9CA8B";
      const targetEmissive = isErr ? "#FF3B30" : "#B39159";
      coreMatRef.current.color.lerp(new THREE.Color(targetColor), delta * 5);
      coreMatRef.current.emissive.lerp(new THREE.Color(targetEmissive), delta * 5);
      coreMatRef.current.emissiveIntensity = isErr ? 1.4 : 0.65;
    }

    if (auraMatRef.current) {
      const targetAura = isErr ? "#FF3B30" : "#2D7FB4";
      auraMatRef.current.color.lerp(new THREE.Color(targetAura), delta * 5);
      auraMatRef.current.opacity = isErr ? 0.38 : 0.22;
    }
  });

  return (
    <group>
      {/* 1. Luminous Gold Core Trajectory Tube (Doubled Thickness, Full Closed Loop) */}
      <mesh>
        <tubeGeometry args={[curve, 160, 0.024, 8, true]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#E9CA8B"
          emissive="#B39159"
          emissiveIntensity={0.65}
          roughness={0.2}
          metalness={0.8}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* 2. Soft Outer Glowing Energy Aura */}
      <mesh>
        <tubeGeometry args={[curve, 160, 0.052, 8, true]} />
        <meshBasicMaterial
          ref={auraMatRef}
          color="#2D7FB4"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Cardinal Waypoint Beacons (Coplanar with Trajectory, NO Vertical Lines) */}
      {[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((angle, idx) => {
        const pt = curve.getPointAt(angle / (Math.PI * 2));
        return (
          <group key={idx} position={[pt.x, pt.y, pt.z]}>
            <mesh>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshBasicMaterial color="#E9CA8B" />
            </mesh>
          </group>
        );
      })}

      {/* 4. Traveling Energy Pulse Bead */}
      <mesh ref={pulseMeshRef}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#F4DFB0" blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ─── Autonomous Satellite Companion Drone Orbital Parameters (DOUBLED SIZES) ─
interface DroneOrbitParams {
  id: number;
  radiusX: number;
  radiusZ: number;
  baseY: number;
  speed: number;
  phase: number;
  tiltX: number;
  tiltZ: number;
  bobFreq: number;
  bobAmp: number;
  scale?: number;
}

const DRONE_ORBITS: DroneOrbitParams[] = [
  // Drone 1: Upper-Right Scout Orbit (Doubled)
  {
    id: 1,
    radiusX: 4.20,
    radiusZ: 3.40,
    baseY: 1.80,
    speed: 0.78,
    phase: 0,
    tiltX: 0.22,
    tiltZ: -0.14,
    bobFreq: 1.3,
    bobAmp: 0.28,
    scale: 2.2,
  },
  // Drone 2 (Cloned 1): Mid-Left Counter-Orbit Shield (Doubled)
  {
    id: 2,
    radiusX: 4.72,
    radiusZ: 3.80,
    baseY: 0.20,
    speed: -0.65,
    phase: Math.PI * 0.66,
    tiltX: -0.28,
    tiltZ: 0.22,
    bobFreq: 1.0,
    bobAmp: 0.32,
    scale: 2.15,
  },
  // Drone 3 (Cloned 2): Lower Perimeter Patrol Orbit (Doubled)
  {
    id: 3,
    radiusX: 4.08,
    radiusZ: 3.12,
    baseY: -1.40,
    speed: 0.98,
    phase: Math.PI * 1.33,
    tiltX: 0.32,
    tiltZ: 0.16,
    bobFreq: 1.5,
    bobAmp: 0.26,
    scale: 2.05,
  },
  // Drone 4 (Cloned 3): High Apex Halo Sentinel Orbit (Doubled)
  {
    id: 4,
    radiusX: 3.28,
    radiusZ: 3.28,
    baseY: 3.10,
    speed: -0.88,
    phase: Math.PI * 1.85,
    tiltX: -0.15,
    tiltZ: -0.18,
    bobFreq: 1.6,
    bobAmp: 0.24,
    scale: 2.0,
  },
];

// ─── Autonomous Satellite Companion Drone (Orbiting Constellation) ───────────
function OrbitingCompanionDrone({
  orbit,
  mouseRef,
  stage = 5,
  goldMat,
  navyMat,
  visorMat,
  accentBlueMat,
}: {
  orbit: DroneOrbitParams;
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage?: number;
  goldMat: THREE.Material;
  navyMat: THREE.Material;
  visorMat: THREE.Material;
  accentBlueMat: THREE.Material;
}) {
  const droneRef = useRef<THREE.Group>(null);
  const droneEyeMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  if (!droneEyeMatRef.current) {
    droneEyeMatRef.current = new THREE.MeshStandardMaterial({
      color: "#2D7FB4",
      emissive: "#2D7FB4",
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
  }
  const droneEyeMat = droneEyeMatRef.current;

  useFrame(({ clock }, delta) => {
    if (!droneRef.current) return;
    const t = clock.getElapsedTime();

    // 3D Orbital Trajectory
    const theta = t * orbit.speed + orbit.phase;
    const x0 = Math.cos(theta) * orbit.radiusX;
    const z0 = Math.sin(theta) * orbit.radiusZ;
    const y0 = orbit.baseY + Math.sin(t * orbit.bobFreq + orbit.phase) * orbit.bobAmp;

    // Apply 3D orbital plane inclination
    const targetX = x0 * Math.cos(orbit.tiltZ) - y0 * Math.sin(orbit.tiltZ);
    const targetY = y0 * Math.cos(orbit.tiltX) + z0 * Math.sin(orbit.tiltX);
    const targetZ = z0 * Math.cos(orbit.tiltX) - y0 * Math.sin(orbit.tiltX);

    droneRef.current.position.x = THREE.MathUtils.damp(
      droneRef.current.position.x,
      targetX,
      5.0,
      delta
    );
    droneRef.current.position.y = THREE.MathUtils.damp(
      droneRef.current.position.y,
      targetY,
      5.0,
      delta
    );
    droneRef.current.position.z = THREE.MathUtils.damp(
      droneRef.current.position.z,
      targetZ,
      5.0,
      delta
    );

    // Orientation: blend tangent heading with eager gaze toward cursor
    const tangentHeading = Math.atan2(-Math.sin(theta) * orbit.speed, Math.cos(theta) * orbit.speed);
    const targetRotY = tangentHeading * 0.35 + mouseRef.current.x * 0.55;
    const targetRotX = -mouseRef.current.y * 0.38 + Math.sin(t * 2.2 + orbit.phase) * 0.08;
    const targetRotZ = Math.sin(t * 1.8 + orbit.phase) * 0.10;

    droneRef.current.rotation.y = THREE.MathUtils.damp(
      droneRef.current.rotation.y,
      targetRotY,
      6.0,
      delta
    );
    droneRef.current.rotation.x = THREE.MathUtils.damp(
      droneRef.current.rotation.x,
      targetRotX,
      6.0,
      delta
    );
    droneRef.current.rotation.z = THREE.MathUtils.damp(
      droneRef.current.rotation.z,
      targetRotZ,
      5.0,
      delta
    );

    // Drone light pulse (staggered phases across drones)
    const dronePulse =
      stage >= 4
        ? 1.6 + Math.sin(t * 3.5 + orbit.phase) * 0.75
        : 0.2;
    droneEyeMat.emissiveIntensity = dronePulse;
  });

  const scale = orbit.scale || 0.72;

  return (
    <group ref={droneRef} scale={scale}>
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
  stage = 5,
  robotState = "idle",
  isCtaHovered = false,
  ctaPulsed = false,
}: GuardianRobotProps) {
  // Master hierarchy refs
  const rootRef = useRef<THREE.Group>(null);
  const hoverGroupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const eyesGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftForearmRef = useRef<THREE.Group>(null);
  const rightForearmRef = useRef<THREE.Group>(null);

  // Keyboard responsiveness
  const keyPulseRef = useRef(0);
  const keyCountRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = () => {
      keyPulseRef.current = 0.65; // 650ms active perk on key press
      keyCountRef.current = (keyCountRef.current + 1) % 100;
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dynamic mesh elements
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const aiCoreRef = useRef<THREE.Mesh>(null);
  const aiRingRef = useRef<THREE.Mesh>(null);
  const antennaOrbRef = useRef<THREE.Mesh>(null);
  const thrusterHaloL = useRef<THREE.Mesh>(null);
  const thrusterHaloR = useRef<THREE.Mesh>(null);

  // Eye blink & micro-interaction physics
  const blinkTimer = useRef(0);
  const blinkOpen = useRef(true);
  const nextBlink = useRef(3.8);

  const microTimer = useRef(0);
  const microTilt = useRef(0);

  // Shake error timer
  const shakeTimer = useRef(0);

  // Entrance timer (800ms - 1200ms)
  const entranceTimer = useRef(0);

  // Damped pointer coordinates with inertia
  const pointerCurrent = useRef({ x: 0, y: 0 });

  // Lighting refs
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const corePointLightRef = useRef<THREE.PointLight>(null);

  const { camera, gl, raycaster } = useThree();

  // ─── MASTER PATROL ORBIT CURVE (DOUBLED, COVERS EMPTY SPACE) ─────────────────
  const masterOrbitCurve = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(getMasterOrbitPoint(theta));
    }
    return new THREE.CatmullRomCurve3(points, true, "centripetal");
  }, []);

  // Orbit progression angle theta: 0 -> 2pi
  const progressTheta = useRef(0);

  // Drag and Drop State ("kéo thả robo khi nó đang di chuyển")
  const isDragging = useRef(false);
  const dragTargetPos = useRef(new THREE.Vector3(0, 0, 0));
  const dragVelocity = useRef(new THREE.Vector3(0, 0, 0));
  const prevDragPos = useRef(new THREE.Vector3(0, 0, 0));

  // Error State & Autonomous Recovery ("Error...Error.... xong tự bơi về quỷ đạo")
  const isError = useRef(false);
  const [showErrorBadge, setShowErrorBadge] = useState(false);
  const errorRecoverTarget = useRef(new THREE.Vector3(0, 0, 0));
  const errorRecoverTheta = useRef(0);
  const swimTimer = useRef(0);

  // Drag hit-box collider ref
  const hitBoxRef = useRef<THREE.Mesh>(null);

  // Core Drag Initiation (Callable from 3D hit or global window raycast)
  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      isDragging.current = true;
      isError.current = false;
      setShowErrorBadge(false);

      if (rootRef.current) {
        dragTargetPos.current.copy(rootRef.current.position);
        prevDragPos.current.copy(rootRef.current.position);
      }

      document.body.style.cursor = "grabbing";
      if (gl.domElement) {
        gl.domElement.style.cursor = "grabbing";
      }

      const canvasElement = gl.domElement;

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDragging.current) return;
        const rect = canvasElement.getBoundingClientRect();
        const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

        const pointerVec = new THREE.Vector2(ndcX, ndcY);
        raycaster.setFromCamera(pointerVec, camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hit)) {
          // Broad bounds allowing robot to be dragged across ALL sections of the webpage
          hit.x = THREE.MathUtils.clamp(hit.x, -8.8, 8.8);
          hit.y = THREE.MathUtils.clamp(hit.y, -5.5, 5.5);
          dragTargetPos.current.copy(hit);
        }
      };

      const onPointerUp = () => {
        isDragging.current = false;
        document.body.style.cursor = "auto";
        if (gl.domElement) {
          gl.domElement.style.cursor = "auto";
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);

        const currentPos = rootRef.current
          ? rootRef.current.position
          : dragTargetPos.current;

        const evalResult = evaluateDropPosition(currentPos.x, currentPos.y);

        if (evalResult.isInside) {
          // Dropped within or along orbit -> continue moving!
          progressTheta.current = evalResult.nearestTheta;
          isError.current = false;
          setShowErrorBadge(false);
        } else {
          // Dropped outside orbit -> trigger Error...Error.... and swim back!
          isError.current = true;
          setShowErrorBadge(true);
          errorRecoverTarget.current.copy(evalResult.nearestPoint);
          errorRecoverTheta.current = evalResult.nearestTheta;
          swimTimer.current = 0;
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [camera, gl, raycaster]
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      startDrag(e.clientX, e.clientY);
    },
    [startDrag]
  );

  // Global window listener: hover grab detection & drag initiation from anywhere on webpage
  useEffect(() => {
    const onWindowPointerMove = (ev: PointerEvent) => {
      if (isDragging.current) return;
      const target = ev.target as HTMLElement | null;
      if (target && target.closest("input, button, a, [role='button']")) {
        if (document.body.style.cursor === "grab") {
          document.body.style.cursor = "auto";
        }
        return;
      }

      if (!gl.domElement) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hitObj = hitBoxRef.current || rootRef.current;
      if (hitObj) {
        const hits = raycaster.intersectObject(hitObj, true);
        if (hits.length > 0) {
          document.body.style.cursor = "grab";
          return;
        }
      }
      if (document.body.style.cursor === "grab") {
        document.body.style.cursor = "auto";
      }
    };

    const onWindowPointerDown = (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && target.closest("input, button, a, [role='button']")) {
        return;
      }
      if (!gl.domElement) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hitObj = hitBoxRef.current || rootRef.current;
      if (hitObj) {
        const hits = raycaster.intersectObject(hitObj, true);
        if (hits.length > 0) {
          startDrag(ev.clientX, ev.clientY);
        }
      }
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerdown", onWindowPointerDown);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerdown", onWindowPointerDown);
      if (document.body.style.cursor === "grab" || document.body.style.cursor === "grabbing") {
        document.body.style.cursor = "auto";
      }
    };
  }, [camera, gl, raycaster, startDrag]);

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

  // ─── DYNAMIC EMISSIVE MATERIALS (Created via mutable refs to prevent React 19 memo immutability lints) ───
  const dynamicMatsRef = useRef<{
    eye: THREE.MeshStandardMaterial;
    core: THREE.MeshStandardMaterial;
    antenna: THREE.MeshStandardMaterial;
    thruster: THREE.MeshBasicMaterial;
  } | null>(null);

  if (!dynamicMatsRef.current) {
    dynamicMatsRef.current = {
      eye: new THREE.MeshStandardMaterial({
        color: "#2D7FB4",
        emissive: "#64A8D3",
        emissiveIntensity: 0,
        roughness: 0.08,
      }),
      core: new THREE.MeshStandardMaterial({
        color: "#2D7FB4",
        emissive: "#2D7FB4",
        emissiveIntensity: 0,
        roughness: 0.15,
      }),
      antenna: new THREE.MeshStandardMaterial({
        color: "#E9CA8B",
        emissive: "#E9CA8B",
        emissiveIntensity: 0,
        metalness: 0.8,
        roughness: 0.1,
      }),
      thruster: new THREE.MeshBasicMaterial({
        color: "#2D7FB4",
        transparent: true,
        opacity: 0,
      }),
    };
  }

  const {
    eye: eyeEmissiveMat,
    core: coreEmissiveMat,
    antenna: antennaEmissiveMat,
    thruster: thrusterGlowMat,
  } = dynamicMatsRef.current;

  // Trigger shake error when robotState is shakeError
  useEffect(() => {
    if (robotState === "shakeError") {
      shakeTimer.current = 0.35; // 350ms controlled head-shake
    }
  }, [robotState]);

  // ─── FRAME-RATE INDEPENDENT FRAME UPDATE ────────────────────────────────────
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // Check device / reduced motion constraints
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 1. POINTER INERTIA (Snappy damping for high-response tracking)
    const targetMouseX = isReduced || isMobile ? 0 : mouseRef.current.x;
    const targetMouseY = isReduced || isMobile ? 0 : mouseRef.current.y;

    pointerCurrent.current.x = THREE.MathUtils.damp(
      pointerCurrent.current.x,
      targetMouseX,
      8.5,
      delta
    );
    pointerCurrent.current.y = THREE.MathUtils.damp(
      pointerCurrent.current.y,
      targetMouseY,
      8.5,
      delta
    );

    const px = pointerCurrent.current.x;
    const py = pointerCurrent.current.y;

    // Decay keyboard pulse
    if (keyPulseRef.current > 0) {
      keyPulseRef.current = Math.max(0, keyPulseRef.current - delta);
    }
    const keyIntensity = Math.min(1.0, keyPulseRef.current / 0.65);
    const isKeyActive = keyIntensity > 0.01;

    // 2. ROBOT MASTER ORBIT MOTION & DRAG / RECOVERY KINEMATICS (DOUBLED SIZES)
    const orbitSpeed = isReduced ? 0 : isMobile ? 0.36 : 0.42;

    // Entrance settle & scale doubling (4.0x scale)
    entranceTimer.current += delta;
    const entranceT = Math.min(1.0, entranceTimer.current / 1.0);
    const entranceOffset = (1.0 - entranceT) * -0.35;
    const currentScale = THREE.MathUtils.lerp(0.96, 1.0, entranceT) * 4.0;
    if (rootRef.current) {
      rootRef.current.scale.set(currentScale, currentScale, currentScale);
    }

    let travelVelX = 0;
    let travelVelY = 0;

    if (isDragging.current) {
      // ─── USER IS ACTIVELY DRAGGING THE ROBOT ───
      dragVelocity.current
        .subVectors(dragTargetPos.current, prevDragPos.current)
        .divideScalar(Math.max(0.001, delta));
      prevDragPos.current.copy(dragTargetPos.current);

      travelVelX = dragVelocity.current.x * 0.35;
      travelVelY = dragVelocity.current.y * 0.35;

      if (rootRef.current) {
        rootRef.current.position.x = THREE.MathUtils.damp(
          rootRef.current.position.x,
          dragTargetPos.current.x,
          18.0,
          delta
        );
        rootRef.current.position.y = THREE.MathUtils.damp(
          rootRef.current.position.y,
          dragTargetPos.current.y,
          18.0,
          delta
        );
        rootRef.current.position.z = THREE.MathUtils.damp(
          rootRef.current.position.z,
          0.12,
          12.0,
          delta
        );
      }
    } else if (isError.current) {
      // ─── DROPPED OUTSIDE ORBIT: AUTONOMOUS RECOVERY ("TỰ BƠI VỀ QUỶ ĐẠO") ───
      swimTimer.current += delta;
      const targetPos = errorRecoverTarget.current;
      const currentPos = rootRef.current ? rootRef.current.position : targetPos;
      const dist = currentPos.distanceTo(targetPos);

      const dirX = targetPos.x - currentPos.x;
      const dirY = targetPos.y - currentPos.y;
      travelVelX = dirX * 0.8;
      travelVelY = dirY * 0.8;

      if (dist < 0.15) {
        // Reached orbit! Recovered!
        isError.current = false;
        setShowErrorBadge(false);
        progressTheta.current = errorRecoverTheta.current;
      } else {
        // Swimming towards orbit
        if (rootRef.current) {
          rootRef.current.position.x = THREE.MathUtils.damp(
            rootRef.current.position.x,
            targetPos.x,
            3.4,
            delta
          );
          rootRef.current.position.y = THREE.MathUtils.damp(
            rootRef.current.position.y,
            targetPos.y,
            3.4,
            delta
          );
          rootRef.current.position.z = THREE.MathUtils.damp(
            rootRef.current.position.z,
            targetPos.z,
            3.4,
            delta
          );
        }
      }
    } else {
      // ─── NORMAL ORBIT PATROL AROUND EMPTY SPACE (DOUBLED SIZES) ───
      progressTheta.current += orbitSpeed * delta;
      if (progressTheta.current > Math.PI * 2) {
        progressTheta.current -= Math.PI * 2;
      }

      const orbitPos = getMasterOrbitPoint(progressTheta.current);
      const nextPos = getMasterOrbitPoint(progressTheta.current + 0.04);
      travelVelX = (nextPos.x - orbitPos.x) / 0.04;
      travelVelY = (nextPos.y - orbitPos.y) / 0.04;

      // Micro buoyant floating
      const microFloatY = Math.sin(t * 1.1) * 0.048 + Math.sin(t * 0.73) * 0.016;
      const microFloatX = Math.sin(t * 0.65 + 1.4) * 0.016;
      const microFloatZ = Math.sin(t * 0.8 + 0.7) * 0.024;

      // Subtle pointer offset
      const pointerLocalOffsetX = px * 0.060;
      const pointerLocalOffsetY = py * 0.045;

      const targetPosX = orbitPos.x + microFloatX + pointerLocalOffsetX;
      const targetPosY = orbitPos.y + microFloatY + pointerLocalOffsetY + entranceOffset;
      const targetPosZ = orbitPos.z + microFloatZ;

      if (rootRef.current) {
        rootRef.current.position.x = THREE.MathUtils.damp(
          rootRef.current.position.x,
          targetPosX,
          6.0,
          delta
        );
        rootRef.current.position.y = THREE.MathUtils.damp(
          rootRef.current.position.y,
          targetPosY,
          6.0,
          delta
        );
        rootRef.current.position.z = THREE.MathUtils.damp(
          rootRef.current.position.z,
          targetPosZ,
          5.0,
          delta
        );
      }
    }

    // ─── 3. TORSO BODY BANKING & ATTITUDE ───
    const isLookingAtAccess = robotState === "lookingAtAccess";
    const isProcessing = robotState === "processing";
    const isSuccess = robotState === "success";
    const isTyping = robotState === "typing";

    let targetTorsoYaw = 0;
    let targetTorsoRoll = 0;
    let targetTorsoPitch = 0;

    if (isDragging.current) {
      targetTorsoPitch = -dragVelocity.current.y * 0.18;
      targetTorsoRoll = -dragVelocity.current.x * 0.18;
      targetTorsoYaw = dragVelocity.current.x * 0.14;
    } else if (isError.current) {
      targetTorsoYaw = Math.atan2(travelVelX, 1.0) * 0.65 + Math.sin(t * 30) * 0.06;
      targetTorsoPitch = -travelVelY * 0.28;
      targetTorsoRoll = Math.sin(t * 14) * 0.08;
    } else {
      targetTorsoYaw = travelVelX * 0.10 + px * 0.07;
      targetTorsoRoll = -travelVelX * 0.06;
      targetTorsoPitch = Math.abs(travelVelX) * 0.015 - py * 0.04;

      if (isLookingAtAccess) targetTorsoYaw += -0.15;
      if (isProcessing) targetTorsoPitch += 0.04;
      if (isKeyActive) targetTorsoPitch += Math.sin(keyCountRef.current * 1.5) * 0.015 * keyIntensity;
    }

    if (torsoRef.current) {
      torsoRef.current.rotation.y = THREE.MathUtils.damp(torsoRef.current.rotation.y, targetTorsoYaw, 5.0, delta);
      torsoRef.current.rotation.z = THREE.MathUtils.damp(torsoRef.current.rotation.z, targetTorsoRoll, 5.0, delta);
      torsoRef.current.rotation.x = THREE.MathUtils.damp(torsoRef.current.rotation.x, targetTorsoPitch, 5.0, delta);
    }

    // ─── 4. HEAD INDEPENDENT STABILIZATION & HIGH-GAIN POINTER TRACKING ───
    // Requirement: "Phần đầu vẫn move theo trỏ chuột."
    let shakeOffset = 0;
    if (shakeTimer.current > 0 || isError.current) {
      shakeTimer.current = Math.max(0, shakeTimer.current - delta);
      shakeOffset = Math.sin(t * 34) * (isError.current ? 0.065 : 0.045);
    }

    let targetHeadYaw = px * 0.68 - travelVelX * 0.03 + shakeOffset;
    let targetHeadPitch = -py * 0.44;

    if (isKeyActive) targetHeadPitch -= keyIntensity * 0.05;

    const targetHeadRoll =
      (torsoRef.current ? -torsoRef.current.rotation.z * 0.65 : 0) - px * 0.12;

    if (isLookingAtAccess) {
      targetHeadYaw = -0.48 + shakeOffset;
      targetHeadPitch = -0.18;
    } else if (isCtaHovered) {
      targetHeadYaw = -0.40;
      targetHeadPitch = -0.15;
    }

    microTimer.current += delta;
    if (microTimer.current > 6.0) {
      microTilt.current = (Math.random() - 0.5) * 0.025;
      microTimer.current = 0;
    }

    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.damp(headRef.current.rotation.y, targetHeadYaw, 9.2, delta);
      headRef.current.rotation.x = THREE.MathUtils.damp(headRef.current.rotation.x, targetHeadPitch, 9.2, delta);
      headRef.current.rotation.z = THREE.MathUtils.damp(headRef.current.rotation.z, targetHeadRoll + microTilt.current, 7.5, delta);
    }

    // ─── 5. DIGITAL APERTURE EYES (HIGH-GAIN ATTENTION TO POINTER) ───
    let targetEyeX = px * 0.085;
    let targetEyeY = -py * 0.055;
    if (isLookingAtAccess) {
      targetEyeX = -0.045;
      targetEyeY = -0.020;
    }

    if (eyesGroupRef.current) {
      eyesGroupRef.current.position.x = THREE.MathUtils.damp(eyesGroupRef.current.position.x, targetEyeX, 12.0, delta);
      eyesGroupRef.current.position.y = THREE.MathUtils.damp(eyesGroupRef.current.position.y, 0.025 + targetEyeY, 12.0, delta);
    }

    // Natural eye blink physics
    blinkTimer.current += delta;
    if (blinkTimer.current >= nextBlink.current) {
      blinkOpen.current = false;
      setTimeout(() => {
        blinkOpen.current = true;
      }, 110);
      blinkTimer.current = 0;
      nextBlink.current = 3.6 + Math.random() * 3.5;
    }

    const eyeScaleY = blinkOpen.current ? 1.0 : 0.06;
    if (leftEyeRef.current) {
      leftEyeRef.current.scale.y = THREE.MathUtils.damp(leftEyeRef.current.scale.y, eyeScaleY, 18, delta);
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.scale.y = THREE.MathUtils.damp(rightEyeRef.current.scale.y, eyeScaleY, 18, delta);
    }

    // ─── 6. ROBOT ARMS FIXED STRAIGHT DOWN ALONG TORSO (NO MOVEMENT) ───
    // Requirement: "Tay robo fix lại giữ nguyên thẳng dọc thân, không di chuyển nữa."
    if (rightArmRef.current) {
      rightArmRef.current.rotation.set(0, 0, 0);
    }
    if (rightForearmRef.current) {
      rightForearmRef.current.rotation.set(0, 0, 0);
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.set(0, 0, 0);
    }
    if (leftForearmRef.current) {
      leftForearmRef.current.rotation.set(0, 0, 0);
    }

    // ─── 7. LIGHTING & EMISSIVE ENERGY (ALERT ON ERROR, SERENE ON PATROL) ───
    const basePulse = Math.sin(t * 2.0) * 0.35 + 0.95;
    const boost = isSuccess ? 3.0 : isProcessing ? 2.2 : isLookingAtAccess ? 1.45 : ctaPulsed ? 2.4 : 1.0;
    const keyCorePulse = isKeyActive ? 1.0 + keyIntensity * 0.7 : 1.0;

    if (isError.current) {
      // Diagnostic Error Red Alert!
      coreEmissiveMat.color.set("#FF3B30");
      coreEmissiveMat.emissive.set("#FF3B30");
      coreEmissiveMat.emissiveIntensity = 2.4 + Math.sin(t * 18) * 1.0;

      eyeEmissiveMat.color.set("#FF3B30");
      eyeEmissiveMat.emissive.set("#FF3B30");
      eyeEmissiveMat.emissiveIntensity = 2.8 + Math.sin(t * 18) * 1.2;

      thrusterGlowMat.opacity = 0.92;
    } else {
      // Serene EIU Brand Cyan & Blue
      coreEmissiveMat.color.set("#2D7FB4");
      coreEmissiveMat.emissive.set("#2D7FB4");
      coreEmissiveMat.emissiveIntensity = basePulse * boost * keyCorePulse;

      eyeEmissiveMat.color.set("#2D7FB4");
      eyeEmissiveMat.emissive.set("#64A8D3");
      eyeEmissiveMat.emissiveIntensity = isLookingAtAccess ? 3.0 : isProcessing ? 3.4 : 2.4;

      thrusterGlowMat.opacity = 0.45 + Math.sin(t * 4.0) * 0.2 + (isDragging.current ? 0.45 : 0);
    }

    if (corePointLightRef.current) {
      corePointLightRef.current.intensity = 0.8 * basePulse * boost * keyCorePulse * (isError.current ? 1.8 : 1.0);
    }

    const antennaTypingBoost = isTyping || isKeyActive ? 2.8 + keyIntensity * 1.5 : 1.0;
    antennaEmissiveMat.emissiveIntensity = (0.85 + Math.sin(t * (isKeyActive ? 8.0 : 3.2)) * 0.45) * antennaTypingBoost;

    if (keyLightRef.current) {
      keyLightRef.current.position.x = 3.8 - px * 0.25;
      const robotPosY = rootRef.current ? rootRef.current.position.y : 0;
      keyLightRef.current.intensity = 1.25 + robotPosY * 0.12;
    }
  });

  return (
    <>
      {/* ─── VISIBLE ROBOT PATROL ORBIT (FULL CLOSED LOOP, NO VERTICAL LINES) ─── */}
      <RobotOrbitTrack curve={masterOrbitCurve} isErrorRef={isError} />

      <group
        ref={rootRef}
        onPointerDown={handlePointerDown}
        onPointerOver={() => {
          if (gl.domElement) gl.domElement.style.cursor = "grab";
        }}
        onPointerOut={() => {
          if (gl.domElement && !isDragging.current) gl.domElement.style.cursor = "auto";
        }}
      >
        {/* Invisible Hitbox Collider for Smooth Drag Interaction across full doubled robot body */}
        <mesh ref={hitBoxRef} visible={false} position={[0, 0, 0]}>
          <sphereGeometry args={[2.8, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

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

      {/* Soft Gold Fill */}
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

          {/* Flanking Gold Accent Trim on Chest (Framing the EIU badge cleanly) */}
          {[-0.32, 0.32].map((x, i) => (
            <mesh key={i} position={[x, -0.07, 0.274]} material={materials.goldPrimary}>
              <boxGeometry args={[0.08, 0.008, 0.014]} />
            </mesh>
          ))}

          {/* Flank Armor Cowlings (Layered Aerodynamic Panels) */}
          <mesh position={[-0.38, -0.14, 0.06]} rotation={[0, 0.22, -0.08]} material={materials.navyFlank}>
            <boxGeometry args={[0.12, 0.46, 0.32]} />
          </mesh>
          <mesh position={[0.38, -0.14, 0.06]} rotation={[0, -0.22, 0.08]} material={materials.navyFlank}>
            <boxGeometry args={[0.12, 0.46, 0.32]} />
          </mesh>

          {/* Official EIU Crest Badge on Robot Breastplate */}
          <EiuCrestBadge
            goldMat={materials.goldHighlight}
            deepNavyMat={materials.deepNavy}
          />

          {/* Diagnostic Error Alert Badge displayed directly on robot body / torso ("Cho chữ Error....Error..... to ra, nổi bật lên") */}
          {showErrorBadge && (
            <Html
              position={[0, -0.07, 0.38]}
              center
              distanceFactor={8.5}
              style={{
                pointerEvents: "none",
                userSelect: "none",
                whiteSpace: "nowrap",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.98), rgba(185, 28, 28, 0.98))",
                  backdropFilter: "blur(16px)",
                  color: "#FFFFFF",
                  padding: "10px 24px",
                  borderRadius: "12px",
                  fontSize: "20px",
                  fontWeight: 900,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  boxShadow: "0 0 40px #EF4444, 0 0 80px rgba(239, 68, 68, 0.85), inset 0 0 16px rgba(255, 255, 255, 0.6)",
                  border: "2.5px solid #FEF08A",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  textShadow: "0 0 14px rgba(255, 255, 255, 0.95), 0 0 24px #EF4444",
                  animation: "errorPulseGlow 0.5s ease-in-out infinite alternate",
                }}
              >
                <span style={{ fontSize: "22px", color: "#FEF08A", filter: "drop-shadow(0 0 8px #F59E0B)" }}>⚠</span>
                <span>Error....Error.....</span>
              </div>
            </Html>
          )}

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

          {/* ─── LEVITATING REPULSOR DRIVE ─── */}
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
            <mesh material={materials.navyArmor} castShadow>
              <sphereGeometry args={[0.145, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
            </mesh>
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
              <torusGeometry args={[0.138, 0.009, 8, 24]} />
            </mesh>
            <mesh position={[-0.04, -0.16, 0]} material={materials.navyFlank}>
              <cylinderGeometry args={[0.065, 0.058, 0.2, 16]} />
            </mesh>

            {/* Left Forearm Articulation (Elbow Flexion) */}
            <group ref={leftForearmRef} position={[-0.04, -0.27, 0]}>
              <mesh material={materials.navyJoint}>
                <sphereGeometry args={[0.06, 14, 12]} />
              </mesh>
              <mesh position={[0, -0.12, 0.03]} rotation={[0.22, 0, 0]} material={materials.navyArmor}>
                <cylinderGeometry args={[0.058, 0.05, 0.22, 16]} />
              </mesh>
              <mesh position={[0, -0.24, 0.06]} material={materials.accentBlue}>
                <sphereGeometry args={[0.052, 12, 10]} />
              </mesh>
            </group>
          </group>

          {/* Right Arm */}
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

            {/* Right Forearm Articulation (Elbow Flexion) */}
            <group ref={rightForearmRef} position={[0.04, -0.27, 0]}>
              <mesh material={materials.navyJoint}>
                <sphereGeometry args={[0.06, 14, 12]} />
              </mesh>
              <mesh position={[0, -0.12, 0.03]} rotation={[0.22, 0, 0]} material={materials.navyArmor}>
                <cylinderGeometry args={[0.058, 0.05, 0.22, 16]} />
              </mesh>
              <mesh position={[0, -0.24, 0.06]} material={materials.accentBlue}>
                <sphereGeometry args={[0.052, 12, 10]} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ───────────── AERODYNAMIC SCULPTED HEAD ───────────── */}
        <group ref={headRef} position={[0, 0.44, 0]}>
          {/* Main Helmet Dome */}
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
          <group ref={eyesGroupRef} position={[0, 0.025, 0.305]}>
            {/* Left Eye */}
            <group position={[-0.115, 0, 0]}>
              <mesh ref={leftEyeRef}>
                <capsuleGeometry args={[0.024, 0.065, 8, 16]} />
                <primitive object={eyeEmissiveMat} attach="material" />
              </mesh>
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
              <mesh position={[0.012, 0.016, 0.024]} material={materials.whiteSpec}>
                <sphereGeometry args={[0.01, 8, 8]} />
              </mesh>
            </group>
          </group>

          {/* Side Neural Sensor Pods (Ears) */}
          {[-0.38, 0.38].map((x, i) => (
            <group key={i} position={[x, 0.02, 0]} rotation={[0, 0, i === 0 ? Math.PI / 2 : -Math.PI / 2]}>
              <mesh material={materials.navyArmor}>
                <cylinderGeometry args={[0.09, 0.105, 0.06, 24]} />
              </mesh>
              <mesh position={[0, 0.032, 0]} material={materials.goldPrimary}>
                <torusGeometry args={[0.088, 0.009, 8, 24]} />
              </mesh>
              <mesh position={[0, 0.036, 0]} material={materials.accentBlue}>
                <boxGeometry args={[0.07, 0.006, 0.016]} />
              </mesh>
            </group>
          ))}

          {/* Top Neural Spire & Beacon */}
          <group position={[0, 0.38, 0]}>
            <mesh material={materials.goldPrimary}>
              <cylinderGeometry args={[0.009, 0.018, 0.22, 16]} />
            </mesh>
            <mesh position={[0, -0.09, 0]} material={materials.goldHighlight}>
              <cylinderGeometry args={[0.032, 0.042, 0.02, 16]} />
            </mesh>
            <mesh ref={antennaOrbRef} position={[0, 0.125, 0]}>
              <sphereGeometry args={[0.034, 16, 14]} />
              <primitive object={antennaEmissiveMat} attach="material" />
            </mesh>
            <mesh position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
              <torusGeometry args={[0.046, 0.005, 6, 20]} />
            </mesh>
          </group>
        </group>

        {/* ───────────── 4 SATELLITE COMPANION DRONES (ORBITING CONSTELLATION) ───────────── */}
        {DRONE_ORBITS.map((orbit) => (
          <OrbitingCompanionDrone
            key={orbit.id}
            orbit={orbit}
            mouseRef={mouseRef}
            stage={stage}
            goldMat={materials.goldPrimary}
            navyMat={materials.navyArmor}
            visorMat={materials.visorGlass}
            accentBlueMat={materials.accentBlue}
          />
        ))}
      </group>
    </group>
    </>
  );
}
