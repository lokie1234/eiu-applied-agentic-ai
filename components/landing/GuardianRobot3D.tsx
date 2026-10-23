"use client";

import { useRef, useMemo, useEffect, useState, useCallback, memo } from "react";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { DRONE_CONFIGS, createDroneFlight, createRobotObstacle, advanceRobotImpact, stepDroneFlight, updateDroneViewport, type DroneConfig, type DroneFlight, type RobotObstacle } from "@/lib/landingDroneFlight";

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
  | "loading"
  | "shakeError"
  | "restricted"
  | "wrongPasscode"
  | "success";

interface GuardianRobotProps {
  languageIntro?: boolean;
  languageAnchor?: React.RefObject<HTMLDivElement | null>;
  languageScreen?: React.RefObject<HTMLDivElement | null>;
  returningToOrbit?: boolean;
  onOrbitArrival?: () => void;
  onLanguageArrival?: () => void;
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
  stage?: number;
  robotState?: RobotInteractionState;
  isCtaHovered?: boolean;
  enter?: boolean;
}

const BRAND_LOGOS = ["/branding/robot-chest-logo-white.png", "/branding/robot-drone-logo-white.png"];
const compactLogoTextures = new WeakMap<THREE.Texture, THREE.Texture>();
if (typeof window !== "undefined") BRAND_LOGOS.forEach(url => useLoader.preload(THREE.TextureLoader, url));

function compactLogo(source: THREE.Texture) {
  const cached = compactLogoTextures.get(source);
  if (cached) return cached;
  // These PNGs are 3750px square. A shared 1024px GPU texture is ample for decals,
  // using about 1/13 of the texture pixels; don't upload the full-size originals.
  const image = source.image as HTMLImageElement;
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  compactLogoTextures.set(source, texture);
  return texture;
}

// ─── EIU Crest Badge on Robot Breastplate (Prominently mounted on torso front) ──
function useBrandLogoTexture(chest = false) {
  const source = useLoader(THREE.TextureLoader, BRAND_LOGOS[chest ? 0 : 1]);
  const texture = useMemo(() => {
    const cropped = compactLogo(source).clone();
    cropped.colorSpace = THREE.SRGBColorSpace;
    // Preserve the supplied transparent PNG; crop its empty margins using UVs.
    cropped.offset.set((chest ? 260 : 524) / 3750, (chest ? 576 : 1499) / 3750);
    cropped.repeat.set((chest ? 3230 : 2702) / 3750, (chest ? 2598 : 752) / 3750);
    cropped.wrapS = THREE.ClampToEdgeWrapping;
    cropped.wrapT = THREE.ClampToEdgeWrapping;
    cropped.needsUpdate = true;
    return cropped;
  }, [source, chest]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function DroneLogoDecals() {
  const texture = useBrandLogoTexture();
  return (
    <group>
      {/* Top fuselage decal, clear of the nose sensor and thrusters. */}
      <mesh position={[0, 0.096, 0.022]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.20, 0.20 * 752 / 2702]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

type VisorStatus = "error" | "restricted" | "loading";
const VISOR_STYLES = {
  error: { text: "Error....Error.....", font: "bold 104px monospace", color: "#FFD600", glow: "#FFB800", maxWidth: 1180, opacity: .75, pulse: .25, speed: 9 },
  restricted: { text: "Access Restricted!!!", font: "bold 90px 'JetBrains Mono', 'Courier New', monospace", color: "#FF3B30", glow: "#FF2020", maxWidth: 1200, opacity: .82, pulse: .18, speed: 10 },
  loading: { text: "loading....", font: "bold 104px 'JetBrains Mono', 'Courier New', monospace", color: "#00FF88", glow: "#00FF88", maxWidth: 1180, opacity: .82, pulse: .18, speed: 8 },
};

function drawVisorStatus(canvas: HTMLCanvasElement, status: VisorStatus, text: string) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const style = VISOR_STYLES[status];
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = style.font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = style.color;
  context.shadowColor = style.glow;
  context.shadowBlur = 24;
  context.fillText(text, 640, 128, style.maxWidth);
}

function VisorStatusDisplay({ status, text = VISOR_STYLES[status].text }: { status: VisorStatus; text?: string }) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const resources = useRef<{ canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } | null>(null);
  const lastDots = useRef(-1);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 256;
    drawVisorStatus(canvas, status, text);
    const display = new THREE.CanvasTexture(canvas);
    display.colorSpace = THREE.SRGBColorSpace;
    return display;
  }, [status, text]);
  const geometry = useMemo(() => {
    const surface = new THREE.PlaneGeometry(.55, .14, 48, 8);
    const positions = surface.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i);
      positions.setZ(i, Math.sqrt(.32 * .32 - x * x - y * y) + .003);
    }
    surface.computeVertexNormals();
    return surface;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    resources.current = { canvas: texture.image as HTMLCanvasElement, texture };
    lastDots.current = -1;
    return () => { resources.current = null; texture.dispose(); };
  }, [texture]);
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const style = VISOR_STYLES[status];
    if (materialRef.current) materialRef.current.opacity = style.opacity + Math.sin(time * style.speed) * style.pulse;
    if (status !== "loading" || !resources.current) return;
    const dots = (Math.floor(time * 3.5) % 4) + 1;
    if (dots === lastDots.current) return;
    lastDots.current = dots;
    drawVisorStatus(resources.current.canvas, status, "loading" + ".".repeat(dots));
    resources.current.texture.needsUpdate = true;
  });
  return <mesh geometry={geometry} position={[0, .02, .14]} rotation={[.06, 0, 0]}>
    <meshBasicMaterial ref={materialRef} map={texture} transparent depthWrite={false}
      toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
  </mesh>;
}

function EiuCrestBadge() {
  const texture = useBrandLogoTexture(true);
  const geometry = useMemo(() => {
    const decal = new THREE.PlaneGeometry(0.27, 0.27 * 2598 / 3230, 48, 16);
    const positions = decal.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i) - 0.05;
      // Follow the tapered breastplate with only a tiny offset to prevent flicker.
      const radius = 0.30 + ((y + 0.35) / 0.46) * 0.03;
      positions.setXYZ(i, x, y, 0.03 + Math.sqrt(radius * radius - x * x) + 0.002);
    }
    decal.computeVertexNormals();
    return decal;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false}
        polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

// ─── MASTER PATROL ORBIT GEOMETRY (DOUBLED TO SPAN ENTIRE WEB SPACE) ────────────
const ORBIT_CENTER_X = 2.0;
const ORBIT_CENTER_Y = 0.0;
const ORBIT_RADIUS_X = 4.40;
const ORBIT_RADIUS_Y = 2.60;
const ORBIT_RADIUS_Z = 0.88;

function getMasterOrbitPoint(theta: number, target = new THREE.Vector3()): THREE.Vector3 {
  // Doubled orbit scale to span the available space generously across the page:
  // Semi-major X = 4.40, Semi-minor Y = 2.60, Depth Z = 0.88
  const x = ORBIT_CENTER_X + Math.cos(theta) * ORBIT_RADIUS_X + Math.sin(theta) * 0.24;
  const y = ORBIT_CENTER_Y + Math.sin(theta) * ORBIT_RADIUS_Y - Math.cos(theta) * 0.20;
  const z = Math.sin(theta) * ORBIT_RADIUS_Z + Math.cos(theta) * 0.48;
  return target.set(x, y, z);
}

// Check whether drop point (x, y) is inside or near the orbit corridor
function evaluateDropPosition(x: number, y: number): {
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

  const scratch = useMemo(() => ({
    point: new THREE.Vector3(),
    gold: new THREE.Color("#E9CA8B"),
    yellow: new THREE.Color("#FFD600"),
    warmGold: new THREE.Color("#B39159"),
    amber: new THREE.Color("#FFB800"),
    blue: new THREE.Color("#2D7FB4"),
  }), []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const isErr = isErrorRef.current;

    // Pulse bead position moving ahead on track
    if (pulseMeshRef.current) {
      const pulseT = (t * 0.14) % 1.0;
      const pt = curve.getPointAt(pulseT, scratch.point);
      pulseMeshRef.current.position.copy(pt);
    }

    // Dynamic track color & glow
    if (coreMatRef.current) {
      const targetColor = isErr ? scratch.yellow : scratch.gold;
      const targetEmissive = isErr ? scratch.amber : scratch.warmGold;
      coreMatRef.current.color.lerp(targetColor, 1 - Math.exp(-5 * delta));
      coreMatRef.current.emissive.lerp(targetEmissive, 1 - Math.exp(-5 * delta));
      coreMatRef.current.emissiveIntensity = isErr ? 1.4 : 0.65;
    }

    if (auraMatRef.current) {
      const targetAura = isErr ? scratch.amber : scratch.blue;
      auraMatRef.current.color.lerp(targetAura, 1 - Math.exp(-5 * delta));
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
// Shared geometry for free-flight drones and their bounded impact effects.
function createDroneSparks() {
  const points = new Float32Array(48);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI * .7639;
    const length = .35 + (i % 3) * .2;
    for (let end = 0; end < 2; end++) {
      const distance = length * (end ? 1 : .68);
      const offset = i * 6 + end * 3;
      points[offset] = Math.cos(angle) * distance * .65;
      points[offset + 1] = distance;
      points[offset + 2] = Math.sin(angle) * distance * .65;
    }
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(points, 3));
}

function createDroneGeometries() {
  return {
    g0: new THREE.CylinderGeometry(0.135, 0.145, 0.16, 6),
    g1: new THREE.CylinderGeometry(0.142, 0.10, 0.08, 6),
    g2: new THREE.TorusGeometry(0.138, 0.005, 6, 36),
    g3: new THREE.CylinderGeometry(0.075, 0.075, 0.008, 6),
    g4: new THREE.CylinderGeometry(0.004, 0.004, 0.004, 6),
    g5: new THREE.TorusGeometry(0.072, 0.006, 8, 28),
    g6: new THREE.SphereGeometry(0.068, 20, 16),
    g7: new THREE.SphereGeometry(0.048, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.48),
    g8: new THREE.SphereGeometry(0.018, 14, 10),
    g9: new THREE.SphereGeometry(0.0035, 8, 8),
    g10: new THREE.SphereGeometry(0.006, 8, 8),
    g11: new THREE.BoxGeometry(0.06, 0.014, 0.035),
    g12: new THREE.BoxGeometry(0.058, 0.003, 0.032),
    g13: new THREE.SphereGeometry(0.014, 10, 8),
    g14: new THREE.CylinderGeometry(0.024, 0.028, 0.065, 16),
    g15: new THREE.TorusGeometry(0.024, 0.004, 8, 20),
    g16: new THREE.SphereGeometry(0.015, 12, 10),
    g17: new THREE.TorusGeometry(0.158, 0.008, 10, 36),
    g18: new THREE.TorusGeometry(0.150, 0.003, 8, 36),
    g19: new THREE.BoxGeometry(0.022, 0.005, 0.008),
    g20: new THREE.CylinderGeometry(0.032, 0.048, 0.045, 18),
    g21: new THREE.TorusGeometry(0.046, 0.005, 8, 24),
    g22: new THREE.SphereGeometry(0.016, 12, 10),
    g23: new THREE.BoxGeometry(0.004, 0.09, 0.014),
    g24: new THREE.SphereGeometry(0.004, 6, 6),
    flash: new THREE.SphereGeometry(.075, 8, 6),
    sparks: createDroneSparks(),
  };
}

const AutonomousDrone = memo(function AutonomousDrone({
  config, geometries, obstacle, stage = 5, enter = true,
  goldMat, navyMat, deepNavyMat, visorMat, accentBlueMat, whiteSpecMat,
}: {
  config: DroneConfig;
  geometries: ReturnType<typeof createDroneGeometries>;
  obstacle: React.MutableRefObject<RobotObstacle>;
  stage?: number;
  enter?: boolean;
  goldMat: THREE.Material; navyMat: THREE.Material; deepNavyMat: THREE.Material;
  visorMat: THREE.Material; accentBlueMat: THREE.Material; whiteSpecMat: THREE.Material;
}) {
  const droneRef = useRef<THREE.Group>(null);
  const wreckRef = useRef<THREE.Group>(null);
  const burstRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const droneEyeMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const flightRef = useRef<DroneFlight | null>(null);
  if (flightRef.current === null) {
    flightRef.current = createDroneFlight(config);
  }
  const { camera, size } = useThree();
  useEffect(() => {
    const flight = flightRef.current;
    if (!flight || !(camera instanceof THREE.PerspectiveCamera)) return;
    // Use the nearest flight depth so even foreground drones remain inside the canvas.
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(1, camera.position.z - 1.6) / camera.zoom;
    updateDroneViewport(flight, halfHeight * camera.aspect, halfHeight);
  }, [camera, size.width, size.height]);
  const effects = useMemo(() => ({
    wreck: new THREE.MeshStandardMaterial({ color:"#31536a", metalness:.8, roughness:.4, transparent:true, depthWrite:false }),
    flash: new THREE.MeshBasicMaterial({ color:"#fff0c2", transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }),
    sparks: new THREE.LineBasicMaterial({ color:"#b9e6ff", transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }),
  }), []);
  const impactAxes = useMemo(() => ({ up: new THREE.Vector3(0, 1, 0), normal: new THREE.Vector3() }), []);
  const effectsRef = useRef(effects);
  useEffect(() => () => Object.values(effects).forEach(material => material.dispose()), [effects]);

  useFrame((_, delta) => {
    if (!droneRef.current || !enter || !flightRef.current) return;
    const flight = flightRef.current;
    const { wreck: wreckMat, flash: flashMat, sparks: sparksMat } = effectsRef.current;
    stepDroneFlight(flight, obstacle.current, delta);
    const body = droneRef.current;
    body.visible = flight.visible;
    body.position.set(flight.position.x, flight.position.y, flight.position.z);
    body.rotation.set(flight.rotation.x, flight.rotation.y, flight.rotation.z);
    body.scale.setScalar(config.scale * (.85 + .15 * Math.min(1, flight.age / 3.2)));
    if (droneEyeMatRef.current) droneEyeMatRef.current.emissiveIntensity = stage >= 4 ? 1.3 + Math.sin(flight.elapsed * 3.5 + config.id) * .4 : .2;
    if (wreckRef.current) {
      const wreck = flight.wreck;
      wreckRef.current.visible = wreck.active;
      if (wreck.active) {
        wreckRef.current.position.set(wreck.position.x, wreck.position.y, wreck.position.z);
        wreckRef.current.rotation.set(wreck.rotation.x, wreck.rotation.y, wreck.rotation.z);
        wreckMat.opacity = wreck.opacity;
      }
    }
    if (burstRef.current) {
      const burst = flight.burst;
      burstRef.current.visible = burst.active;
      if (burst.active) {
        burstRef.current.position.set(
          burst.position.x + burst.normal.x * burst.age * 1.8,
          burst.position.y + burst.normal.y * burst.age * 1.8 - burst.age * burst.age,
          burst.position.z + burst.normal.z * burst.age * 1.8,
        );
        impactAxes.normal.set(burst.normal.x, burst.normal.y, burst.normal.z);
        burstRef.current.quaternion.setFromUnitVectors(impactAxes.up, impactAxes.normal);
        burstRef.current.scale.setScalar(burst.scale);
        sparksMat.opacity = burst.opacity;
        // Two brief electrical arcs rather than a growing fireball.
        flashMat.opacity = burst.age < .055 ? 1 : burst.age < .09 ? .15 : burst.age < .14 ? .7 : 0;
        if (flashRef.current) {
          const size = Math.max(.001, 1 - burst.age / .14);
          flashRef.current.scale.set(size, size * .3, size);
        }
      }
    }
  });

  return <group name={"drone-actor-" + config.id}>
    <group name={"drone-" + config.id} ref={droneRef} scale={config.scale * .7} position={[(config.id - 3.5) * 1.8, -11, -6.2]}>
      <DroneLogoDecals />
      {/* 1. Precision Faceted Avionics Core Fuselage */}
      <mesh material={navyMat}>
        <primitive object={geometries.g0} attach="geometry" />
      </mesh>
      {/* Lower Chassis Undercarriage Shell */}
      <mesh position={[0, -0.06, 0]} material={deepNavyMat}>
        <primitive object={geometries.g1} attach="geometry" />
      </mesh>
      {/* Equatorial Recessed Panel Seam & Service Channel */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={deepNavyMat}>
        <primitive object={geometries.g2} attach="geometry" />
      </mesh>
      {/* Top Access Service Hatch with Gold Corner Fasteners */}
      <mesh position={[0, 0.082, 0]} material={deepNavyMat}>
        <primitive object={geometries.g3} attach="geometry" />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((idx) => {
        const a = (idx * Math.PI) / 3;
        return (
          <mesh
            key={`fastener-${idx}`}
            position={[Math.cos(a) * 0.065, 0.088, Math.sin(a) * 0.065]}
            material={goldMat}
          >
            <primitive object={geometries.g4} attach="geometry" />
          </mesh>
        );
      })}

      {/* 2. Embedded Nose Gimbal Sensor Turret */}
      <group position={[0, 0.015, 0.09]}>
        {/* Recessed Spherical Socket Collar */}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
          <primitive object={geometries.g5} attach="geometry" />
        </mesh>
        {/* Spherical Sensor Ball Housing */}
        <mesh material={deepNavyMat}>
          <primitive object={geometries.g6} attach="geometry" />
        </mesh>
        {/* Sapphire Optical Lens Element */}
        <mesh position={[0, 0, 0.038]} rotation={[0.06, 0, 0]} material={visorMat}>
          <primitive object={geometries.g7} attach="geometry" />
        </mesh>
        {/* Internal Optical Aperture & Glint */}
        <mesh position={[0, 0, 0.048]}>
          <primitive object={geometries.g8} attach="geometry" />
          <meshStandardMaterial ref={droneEyeMatRef} color="#2D7FB4" emissive="#2D7FB4" emissiveIntensity={1.4} roughness={.12} />
        </mesh>
        <mesh position={[-0.005, 0.005, 0.058]} material={whiteSpecMat}>
          <primitive object={geometries.g9} attach="geometry" />
        </mesh>
        {/* Dual Stereoscopic Laser Rangefinders */}
        {[-0.032, 0.032].map((xL, idx) => (
          <mesh key={`laser-${idx}`} position={[xL, -0.024, 0.035]} material={accentBlueMat}>
            <primitive object={geometries.g10} attach="geometry" />
          </mesh>
        ))}
      </group>

      {/* 3. Quad Cantilevered Outrigger Pylons & Vector Thrusters */}
      {[
        [-0.13, 0.04, 0.04, 0.35],
        [0.13, 0.04, 0.04, -0.35],
        [-0.13, -0.04, -0.04, 0.35],
        [0.13, -0.04, -0.04, -0.35],
      ].map(([xP, yP, zP, rotZ], i) => (
        <group key={`thruster-${i}`} position={[xP, yP, zP]}>
          {/* Aerofoil Pylon Bracket */}
          <mesh rotation={[0, 0, rotZ]} material={navyMat}>
            <primitive object={geometries.g11} attach="geometry" />
          </mesh>
          <mesh position={[0, 0.008, 0]} rotation={[0, 0, rotZ]} material={goldMat}>
            <primitive object={geometries.g12} attach="geometry" />
          </mesh>
          {/* Rotary Vector Trunnion Mount */}
          <mesh position={[i % 2 === 0 ? -0.032 : 0.032, 0, 0]} material={goldMat}>
            <primitive object={geometries.g13} attach="geometry" />
          </mesh>
          {/* Vector Thruster Nacelle Casing */}
          <group position={[i % 2 === 0 ? -0.048 : 0.048, 0, 0]}>
            <mesh material={deepNavyMat}>
              <primitive object={geometries.g14} attach="geometry" />
            </mesh>
            {/* Gold Cowling Intake Lip */}
            <mesh position={[0, 0.032, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
              <primitive object={geometries.g15} attach="geometry" />
            </mesh>
            {/* Ion Exhaust Nozzle Throat */}
            <mesh position={[0, -0.034, 0]} material={accentBlueMat}>
              <primitive object={geometries.g16} attach="geometry" />
            </mesh>
          </group>
        </group>
      ))}

      {/* 4. Dual Precision Beveled Gold Halo Rings with Standoff Brackets */}
      <mesh rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
        <primitive object={geometries.g17} attach="geometry" />
      </mesh>
      <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
        <primitive object={geometries.g18} attach="geometry" />
      </mesh>
      {/* 4 Radial Mechanical Standoff Struts Linking Ring to Fuselage */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((ang, i) => (
        <group key={`strut-${i}`} rotation={[0, ang, 0]}>
          <mesh position={[0.144, 0, 0]} material={goldMat}>
            <primitive object={geometries.g19} attach="geometry" />
          </mesh>
        </group>
      ))}

      {/* 5. Aft Auxiliary Thruster & Telemetry Blade Antennae */}
      <group position={[0, -0.085, -0.04]}>
        {/* Main Rear Thruster Bell */}
        <mesh material={deepNavyMat}>
          <primitive object={geometries.g20} attach="geometry" />
        </mesh>
        <mesh position={[0, -0.023, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
          <primitive object={geometries.g21} attach="geometry" />
        </mesh>
        <mesh position={[0, -0.025, 0]} material={accentBlueMat}>
          <primitive object={geometries.g22} attach="geometry" />
        </mesh>
      </group>

      {/* Canted Telemetry Blade Antennae */}
      {[-0.065, 0.065].map((xA, i) => (
        <group key={`ant-${i}`} position={[xA, 0.08, -0.04]} rotation={[0.2, 0, i === 0 ? 0.35 : -0.35]}>
          <mesh material={goldMat}>
            <primitive object={geometries.g23} attach="geometry" />
          </mesh>
          <mesh position={[0, 0.045, 0]} material={accentBlueMat}>
            <primitive object={geometries.g24} attach="geometry" />
          </mesh>
        </group>
      ))}
    </group>
    {/* A damaged hull shares the live drone's geometry and one fading material. */}
    <group name={"drone-wreck-" + config.id} ref={wreckRef} visible={false} scale={config.scale}>
      <mesh geometry={geometries.g0} material={effects.wreck} />
      <mesh geometry={geometries.g17} material={effects.wreck} rotation={[Math.PI / 2,0,0]} />
      {[-1,1].map(side => <group key={side}>
        <mesh geometry={geometries.g11} material={effects.wreck} position={[side * .11,0,0]} />
        {[-1,1].map(end => <mesh key={end} geometry={geometries.g14} material={effects.wreck} position={[side * .19,0,end * .1]} />)}
      </group>)}
    </group>
    <group name={"drone-burst-" + config.id} ref={burstRef} visible={false}>
      <mesh ref={flashRef} geometry={geometries.flash} material={effects.flash} />
      <lineSegments geometry={geometries.sparks} material={effects.sparks} />
    </group>
  </group>;
});

// ─── 3-FINGERED ARTICULATED ROBOTIC HAND (MINIMAL, ELEGANT, MECHANICAL) ──────
function RoboticHand5Fingers({
  side,
  goldMat,
  navyMat,
  deepNavyMat,
  jointMat,
  accentBlueMat,
}: {
  side: "left" | "right";
  goldMat: THREE.Material;
  navyMat: THREE.Material;
  deepNavyMat: THREE.Material;
  jointMat: THREE.Material;
  accentBlueMat: THREE.Material;
}) {
  const sign = side === "left" ? -1 : 1;

  return (
    <group position={[0, -0.19, 0.04]}>
      {/* 1. Wrist Articulated Gimbal Socket & Collar */}
      <mesh material={jointMat}>
        <sphereGeometry args={[0.040, 14, 12]} />
      </mesh>
      <mesh position={[0, 0.016, 0]} rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
        <torusGeometry args={[0.038, 0.004, 8, 24]} />
      </mesh>

      {/* 2. Angular Palm Chassis (Chiseled Aerospace Housing) */}
      <group position={[0, -0.042, 0]}>
        <mesh material={navyMat}>
          <boxGeometry args={[0.064, 0.048, 0.032]} />
        </mesh>
        {/* Palm Gold Reinforcement Truss */}
        <mesh position={[0, 0, 0.017]} material={goldMat}>
          <boxGeometry args={[0.056, 0.007, 0.003]} />
        </mesh>
        <mesh position={[0, -0.012, 0.017]} material={deepNavyMat}>
          <boxGeometry args={[0.040, 0.014, 0.003]} />
        </mesh>

        {/* 3. Digit 1: Opposing Articulated Thumb (Angled inward) */}
        <group position={[sign * -0.032, 0.008, 0.004]} rotation={[0.12, 0, sign * -0.42]}>
          {/* Carpal / Metacarpal Rotary Hinge */}
          <mesh material={goldMat}>
            <cylinderGeometry args={[0.010, 0.010, 0.016, 12]} />
          </mesh>
          {/* Proximal Phalanx */}
          <mesh position={[0, -0.03, 0]} material={navyMat}>
            <boxGeometry args={[0.016, 0.036, 0.016]} />
          </mesh>
          {/* Interphalangeal Knuckle Joint */}
          <group position={[0, -0.05, 0]}>
            <mesh material={jointMat}>
              <sphereGeometry args={[0.009, 10, 8]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={goldMat}>
              <cylinderGeometry args={[0.005, 0.005, 0.018, 10]} />
            </mesh>
            {/* Distal Phalanx with Tactile Blue Sensor Tip */}
            <mesh position={[0, -0.022, 0.004]} rotation={[-0.15, 0, 0]} material={navyMat}>
              <boxGeometry args={[0.014, 0.026, 0.014]} />
            </mesh>
            <mesh position={[0, -0.034, 0.005]} material={accentBlueMat}>
              <sphereGeometry args={[0.007, 8, 8]} />
            </mesh>
          </group>
        </group>

        {/* Four fingers alongside the opposing thumb */}
        {[-0.024, -0.008, 0.008, 0.024].map((x, index) => (
        <group key={index} position={[sign * x, -0.029, 0]}
          scale={[0.65, [0.94, 1.04, 0.98, 0.8][index], 0.85]}
          rotation={[0, 0, sign * (index - 1.5) * 0.055]}>

          {/* Knuckle Hinge */}
          <mesh rotation={[0, 0, Math.PI / 2]} material={jointMat}>
            <cylinderGeometry args={[0.009, 0.009, 0.018, 12]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} material={goldMat}>
            <cylinderGeometry args={[0.005, 0.005, 0.020, 10]} />
          </mesh>
          {/* Proximal Phalanx */}
          <mesh position={[0, -0.028, 0]} material={navyMat}>
            <boxGeometry args={[0.017, 0.038, 0.017]} />
          </mesh>
          {/* Interphalangeal Knuckle */}
          <group position={[0, -0.05, 0]}>
            <mesh material={jointMat}>
              <sphereGeometry args={[0.009, 10, 8]} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} material={goldMat}>
              <cylinderGeometry args={[0.005, 0.005, 0.019, 10]} />
            </mesh>
            {/* Distal Fingertip with Sensor */}
            <mesh position={[0, -0.024, 0.004]} rotation={[-0.1, 0, 0]} material={navyMat}>
              <boxGeometry args={[0.015, 0.028, 0.015]} />
            </mesh>
            <mesh position={[0, -0.038, 0.005]} material={accentBlueMat}>
              <sphereGeometry args={[0.0075, 8, 8]} />
            </mesh>
          </group>
        </group>
        ))}
      </group>
    </group>
  );
}

// ─── Main Guardian Robot 3D ───────────────────────────────────────────────────
export default function GuardianRobot3D({
  languageIntro = false,
  languageAnchor,
  languageScreen,
  returningToOrbit = false,
  onOrbitArrival,
  onLanguageArrival,
  mouseRef,
  stage = 5,
  robotState = "idle",
  isCtaHovered = false,
  enter = true,
}: GuardianRobotProps) {
  const droneGeometries = useMemo(createDroneGeometries, []);
  const droneObstacle = useRef(createRobotObstacle());
  const collisionScratch = useMemo(() => new THREE.Vector3(), []);
  const device = useRef({ isMobile: false, isReduced: false });
  const orbitScratch = useMemo(() => ({ point: new THREE.Vector3(), next: new THREE.Vector3() }), []);
  const interactionScratch = useMemo(() => ({
    pointer: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    hit: new THREE.Vector3(), hits: [] as THREE.Intersection[],
  }), []);
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => { dragCleanup.current?.(); }, []);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { device.current = { isMobile: mobile.matches, isReduced: reduced.matches }; };
    update();
    mobile.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  // Master hierarchy refs
  const rootRef = useRef<THREE.Group>(null);
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

  // Eye blink & micro-interaction physics
  const blinkTimer = useRef(0);
  const blinkRemaining = useRef(0);
  const nextBlink = useRef(3.8);

  const microTimer = useRef(0);
  const microTilt = useRef(0);

  // Shake error timer
  const shakeTimer = useRef(0);

  // Entrance timer (3.2 seconds)
  const entranceTimer = useRef(0);

  // Damped pointer coordinates with inertia
  const pointerCurrent = useRef({ x: 0, y: 0 });

  // Lighting refs
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const corePointLightRef = useRef<THREE.PointLight>(null);

  const { camera, gl, raycaster } = useThree();
  const introArrived = useRef(false);
  const introTarget = useRef({ x: -.4, y: -.1, left: 0, top: 0, width: 1, height: 1 });
  const screenCorners = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], []);
  const lastScreenTransform = useRef("");
  const returnFlight = useRef({ started: false, elapsed: 0, completed: false, start: new THREE.Vector3(), end: new THREE.Vector3() });
  useEffect(() => {
    if (!returningToOrbit) returnFlight.current.started = false;
  }, [returningToOrbit]);
  useEffect(() => {
    if (!languageIntro) { introArrived.current = false; return; }
    const measure = () => {
      const anchor = languageAnchor?.current?.getBoundingClientRect();
      const canvas = gl.domElement.getBoundingClientRect();
      if (!anchor || !canvas.width || !canvas.height) return;
      introTarget.current = {
        x: ((anchor.left + anchor.width / 2 - canvas.left) / canvas.width - .5),
        y: .5 - (anchor.top + Math.min(230, Math.max(90, anchor.height * .55)) - canvas.top) / canvas.height,
        left: canvas.left - anchor.left, top: canvas.top - anchor.top,
        width: canvas.width, height: canvas.height,
      };
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (languageAnchor?.current) observer.observe(languageAnchor.current);
    observer.observe(gl.domElement);
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); document.removeEventListener("scroll", measure, true); };
  }, [languageIntro, languageAnchor, gl]);

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
  const showLoadingBadge = robotState === "loading" || robotState === "success";
  const showRestrictedBadge = robotState === "restricted" || robotState === "shakeError" || robotState === "wrongPasscode";
  const errorRecoverTarget = useRef(new THREE.Vector3(0, 0, 0));
  const errorRecoverTheta = useRef(0);
  const crawlPhaseRef = useRef(0);

  // Drag hit-box collider ref
  const hitBoxRef = useRef<THREE.Mesh>(null);

  // Core Drag Initiation (Callable from 3D hit or global window raycast)
  const startDrag = useCallback(
    () => {
      if (!enter || languageIntro || returningToOrbit || entranceTimer.current < 3.2 || isDragging.current) return;
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

        const { pointer, plane, hit } = interactionScratch;
        pointer.set(ndcX, ndcY);
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(plane, hit)) {
          // Broad bounds allowing robot to be dragged across ALL sections of the webpage
          hit.x = THREE.MathUtils.clamp(hit.x, -8.8, 8.8);
          hit.y = THREE.MathUtils.clamp(hit.y, -5.5, 5.5);
          dragTargetPos.current.copy(hit);
        }
      };

      const cleanup = () => {
        isDragging.current = false;
        document.body.style.cursor = "auto";
        if (gl.domElement) {
          gl.domElement.style.cursor = "auto";
        }
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", cleanup);
        window.removeEventListener("blur", cleanup);
        dragCleanup.current = null;
      };
      const onPointerUp = () => {
        cleanup();

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
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", cleanup);
      window.addEventListener("blur", cleanup);
      dragCleanup.current = cleanup;
    },
    [camera, gl, raycaster, enter, languageIntro, returningToOrbit, interactionScratch]
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      startDrag();
    },
    [startDrag]
  );

  // Share one hover hit-test per frame; UI surfaces must never drag actors behind them.
  useEffect(() => {
    if (!enter || languageIntro || returningToOrbit) return;
    let hoverFrame: number | null = null;
    let latest: PointerEvent | null = null;
    const blocksDrag = (event: PointerEvent) => (event.target as Element | null)?.closest?.(
      "[data-login-surface], dialog, input, button, a, [role='button'], [role='dialog']"
    );
    const hitRobot = (event: PointerEvent) => {
      if (!enter || languageIntro || returningToOrbit || isDragging.current || blocksDrag(event)) return false;
      const rect = gl.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      const { pointer, hits } = interactionScratch;
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hitObj = hitBoxRef.current || rootRef.current;
      hits.length = 0;
      if (hitObj) raycaster.intersectObject(hitObj, true, hits);
      return hits.length > 0;
    };
    const onWindowPointerMove = (event: PointerEvent) => {
      if (isDragging.current || document.hidden || blocksDrag(event)) {
        if (document.body.style.cursor === "grab") document.body.style.cursor = "auto";
        return;
      }
      latest = event;
      if (hoverFrame !== null) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = null;
        if (!latest || isDragging.current) return;
        if (hitRobot(latest)) document.body.style.cursor = "grab";
        else if (document.body.style.cursor === "grab") document.body.style.cursor = "auto";
      });
    };
    const onWindowPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && hitRobot(event)) startDrag();
    };
    window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
    window.addEventListener("pointerdown", onWindowPointerDown);
    return () => {
      if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerdown", onWindowPointerDown);
      if (document.body.style.cursor === "grab" || document.body.style.cursor === "grabbing") document.body.style.cursor = "auto";
    };
  }, [camera, gl, raycaster, startDrag, enter, languageIntro, returningToOrbit, interactionScratch]);

  // ─── MATERIALS (EIU DESIGN DNA — PHOTOREALISTIC PBR SYSTEM) ───────────────
  const materials = useMemo(() => {
    // Generate subtle client-side procedural micro-texture to eliminate flat CG smoothness
    let microBumpTex: THREE.CanvasTexture | null = null;
    if (typeof document !== "undefined") {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const imgData = ctx.createImageData(128, 128);
          for (let i = 0; i < imgData.data.length; i += 4) {
            const val = 128 + Math.round((Math.random() - 0.5) * 14);
            imgData.data[i] = val;
            imgData.data[i + 1] = val;
            imgData.data[i + 2] = val;
            imgData.data[i + 3] = 255;
          }
          ctx.putImageData(imgData, 0, 0);
          microBumpTex = new THREE.CanvasTexture(canvas);
          microBumpTex.wrapS = THREE.RepeatWrapping;
          microBumpTex.wrapT = THREE.RepeatWrapping;
          microBumpTex.repeat.set(12, 12);
          microBumpTex.needsUpdate = true;
        }
      } catch {
        // Fallback gracefully without bump map if canvas unavailable
      }
    }

    return {
      // Primary Navy 900 armor: aerospace anodized aluminum with satin brushed clearcoat
      navyArmor: new THREE.MeshPhysicalMaterial({
        color: "#082945",
        metalness: 0.82,
        roughness: 0.19,
        clearcoat: 0.48,
        clearcoatRoughness: 0.10,
        reflectivity: 0.85,
        bumpMap: microBumpTex,
        bumpScale: 0.0003,
      }),
      // Deepest Navy 950 for structural recesses and chassis joints
      deepNavy: new THREE.MeshPhysicalMaterial({
        color: "#041C31",
        metalness: 0.88,
        roughness: 0.28,
        clearcoat: 0.16,
        clearcoatRoughness: 0.26,
        bumpMap: microBumpTex,
        bumpScale: 0.0005,
      }),
      // Secondary Navy 800 for layered flank cowlings (matte composite contrast)
      navyFlank: new THREE.MeshPhysicalMaterial({
        color: "#123F68",
        metalness: 0.65,
        roughness: 0.32,
        clearcoat: 0.24,
        clearcoatRoughness: 0.22,
      }),
      // Navy 700 for interactive articulated joints
      navyJoint: new THREE.MeshPhysicalMaterial({
        color: "#18547F",
        metalness: 0.70,
        roughness: 0.22,
        clearcoat: 0.20,
        clearcoatRoughness: 0.18,
      }),
      // Primary Gold 600 for precision chassis trims (real brushed metallic gold)
      goldPrimary: new THREE.MeshPhysicalMaterial({
        color: "#B39159",
        metalness: 0.94,
        roughness: 0.14,
        clearcoat: 0.52,
        clearcoatRoughness: 0.10,
        reflectivity: 0.98,
        emissive: new THREE.Color("#73552C"),
        emissiveIntensity: 0.10,
      }),
      // Warm Gold 300 for highlights, chamfer bezels, and beacons
      goldHighlight: new THREE.MeshPhysicalMaterial({
        color: "#E9CA8B",
        metalness: 0.90,
        roughness: 0.12,
        clearcoat: 0.55,
        clearcoatRoughness: 0.08,
        reflectivity: 0.96,
        emissive: new THREE.Color("#9D7944"),
        emissiveIntensity: 0.14,
      }),
      // Accent Blue for AI data energy channels
      accentBlue: new THREE.MeshPhysicalMaterial({
        color: "#2D7FB4",
        metalness: 0.58,
        roughness: 0.22,
        clearcoat: 0.32,
        clearcoatRoughness: 0.16,
        emissive: new THREE.Color("#18547F"),
        emissiveIntensity: 0.28,
      }),
      // High-grade curved optical glass visor (high refraction + dual-lobe clearcoat)
      visorGlass: new THREE.MeshPhysicalMaterial({
        color: "#031220",
        metalness: 0.88,
        roughness: 0.04,
        transmission: 0.20,
        thickness: 0.45,
        ior: 1.54,
        transparent: true,
        opacity: 0.92,
        clearcoat: 0.92,
        clearcoatRoughness: 0.03,
        reflectivity: 0.95,
      }),
      // Specular white for eye glints and micro reflections
      whiteSpec: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
      // Contact ambient occlusion shadow material for mechanical grounding
      occlusionShadow: new THREE.MeshBasicMaterial({
        color: "#020710",
        transparent: true,
        opacity: 0.60,
        depthWrite: false,
      }),
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

  useEffect(() => {
    const dynamic = dynamicMatsRef.current;
    return () => {
      const textures = new Set<THREE.Texture>();
      for (const material of Object.values(materials)) {
        const bump = (material as THREE.MeshPhysicalMaterial).bumpMap;
        if (bump) textures.add(bump);
        material.dispose();
      }
      textures.forEach(texture => texture.dispose());
      Object.values(droneGeometries).forEach(geometry => geometry.dispose());
      if (dynamic) Object.values(dynamic).forEach(material => material.dispose());
    };
  }, [materials, droneGeometries]);

  // Trigger shake error when robotState is shakeError or restricted
  useEffect(() => {
    if (robotState === "shakeError" || robotState === "restricted" || robotState === "wrongPasscode") {
      shakeTimer.current = 0.65; // 650ms controlled head-shake
    }
  }, [robotState]);

  // ─── FRAME-RATE INDEPENDENT FRAME UPDATE ────────────────────────────────────
  useFrame(({ clock, viewport }, delta) => {
    if (!enter) return;
    delta = Math.min(delta, .05);
    const t = clock.getElapsedTime();

    advanceRobotImpact(droneObstacle.current, delta);

    // Check device / reduced motion constraints
    const { isMobile, isReduced } = device.current;

    // 1. POINTER INERTIA (Snappy damping for high-response tracking)
    const targetMouseX = languageIntro || isReduced || isMobile ? 0 : mouseRef.current.x;
    const targetMouseY = languageIntro || isReduced || isMobile ? 0 : mouseRef.current.y;

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
    const entranceT = Math.min(1.0, entranceTimer.current / 3.2);
    const entranceEase = THREE.MathUtils.smootherstep(entranceT, 0, 1);
    const desiredScale = 4;
    const currentScale = THREE.MathUtils.damp(rootRef.current?.scale.x ?? desiredScale, desiredScale, 4, delta);
    if (rootRef.current) {
      rootRef.current.scale.set(currentScale, currentScale, currentScale);
    }

    let travelVelX = 0;
    let travelVelY = 0;

    if (languageIntro) {
      const x = introTarget.current.x * viewport.width;
      const y = introTarget.current.y * viewport.height + Math.sin(t * 1.6) * .025;
      if (rootRef.current) {
        if (entranceT < 1) rootRef.current.position.set(
          THREE.MathUtils.lerp(-1.5, x, entranceEase),
          THREE.MathUtils.lerp(-12, y, entranceEase),
          THREE.MathUtils.lerp(-6, 0, entranceEase),
        );
        else {
          rootRef.current.position.x = THREE.MathUtils.damp(rootRef.current.position.x, x, 4, delta);
          rootRef.current.position.y = THREE.MathUtils.damp(rootRef.current.position.y, y, 4, delta);
          rootRef.current.position.z = THREE.MathUtils.damp(rootRef.current.position.z, 0, 4, delta);
        }
        if (entranceT >= 1 && !introArrived.current && Math.abs(rootRef.current.position.x - x) < .1 && Math.abs(rootRef.current.position.y - y) < .1) {
          introArrived.current = true;
          onLanguageArrival?.();
        }
      }
    } else if (returningToOrbit && rootRef.current) {
      const flight = returnFlight.current;
      if (!flight.started) {
        flight.started = true;
        flight.elapsed = 0;
        flight.completed = false;
        flight.start.copy(rootRef.current.position);
        getMasterOrbitPoint(progressTheta.current, flight.end);
      }
      flight.elapsed += delta;
      const progress = Math.min(1, flight.elapsed / 4.8);
      const ease = THREE.MathUtils.smootherstep(progress, 0, 1);
      rootRef.current.position.lerpVectors(flight.start, flight.end, ease);
      rootRef.current.position.y += Math.sin(Math.PI * ease) * .55;
      rootRef.current.position.z += Math.sin(Math.PI * ease) * .3;
      travelVelX = (flight.end.x - flight.start.x) * Math.sin(Math.PI * progress) / 4.8;
      travelVelY = (flight.end.y - flight.start.y) * Math.sin(Math.PI * progress) / 4.8;
      if (progress === 1 && !flight.completed) {
        flight.completed = true;
        onOrbitArrival?.();
      }
    } else if (isDragging.current) {
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
      // Return to the nearest point on the robot's patrol path.
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

      const orbitPos = getMasterOrbitPoint(progressTheta.current, orbitScratch.point);
      const nextPos = getMasterOrbitPoint(progressTheta.current + 0.04, orbitScratch.next);
      travelVelX = (nextPos.x - orbitPos.x) / 0.04;
      travelVelY = (nextPos.y - orbitPos.y) / 0.04;

      // Micro buoyant floating
      const microFloatY = Math.sin(t * 1.1) * 0.048 + Math.sin(t * 0.73) * 0.016;
      const microFloatX = Math.sin(t * 0.65 + 1.4) * 0.016;
      const microFloatZ = Math.sin(t * 0.8 + 0.7) * 0.024;

      // Subtle pointer offset
      const pointerLocalOffsetX = px * 0.060;
      const pointerLocalOffsetY = py * 0.045;

      const targetPosX = THREE.MathUtils.lerp(-1.5, orbitPos.x + microFloatX + pointerLocalOffsetX, entranceEase);
      const targetPosY = THREE.MathUtils.lerp(-12, orbitPos.y + microFloatY + pointerLocalOffsetY, entranceEase);
      const targetPosZ = THREE.MathUtils.lerp(-6, orbitPos.z + microFloatZ, entranceEase);

      if (rootRef.current) {
        if (entranceT < 1) {
          rootRef.current.position.set(targetPosX, targetPosY, targetPosZ);
        } else {
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
    }

    // ─── 3. TORSO BODY BANKING & ATTITUDE ───
    const isLookingAtAccess = robotState === "lookingAtAccess";
    const isProcessing = robotState === "processing";
    const isSuccess = robotState === "success";
    const isTyping = robotState === "typing";
    const isLoading = robotState === "loading" || isSuccess;
    const isRestricted = showRestrictedBadge;

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
      if (isProcessing || isLoading) targetTorsoPitch += 0.04;
      if (isRestricted) targetTorsoPitch -= 0.03;
      if (isKeyActive) targetTorsoPitch += Math.sin(keyCountRef.current * 1.5) * 0.015 * keyIntensity;
    }

    const impact = droneObstacle.current;
    const recoil = Math.cos(impact.impactAge * 26) * impact.impact;
    targetTorsoRoll += impact.impactNormal.x * recoil * .07;
    targetTorsoPitch -= impact.impactNormal.z * recoil * .045;
    if (torsoRef.current) {
      torsoRef.current.rotation.y = THREE.MathUtils.damp(torsoRef.current.rotation.y, targetTorsoYaw, 5.0, delta);
      torsoRef.current.rotation.z = THREE.MathUtils.damp(torsoRef.current.rotation.z, targetTorsoRoll, 5.0, delta);
      torsoRef.current.rotation.x = THREE.MathUtils.damp(torsoRef.current.rotation.x, targetTorsoPitch, 5.0, delta);
      // Keep the visor square to the viewer throughout language selection.
      if (languageIntro) torsoRef.current.rotation.set(-impact.impactNormal.z * recoil * .045, 0, impact.impactNormal.x * recoil * .07);
    }

    // ─── 4. HEAD INDEPENDENT STABILIZATION & HIGH-GAIN POINTER TRACKING ───
    // Requirement: "Phần đầu vẫn move theo trỏ chuột."
    let shakeOffset = 0;
    if (shakeTimer.current > 0 || isError.current) {
      shakeTimer.current = Math.max(0, shakeTimer.current - delta);
      shakeOffset = Math.sin(t * 34) * (isError.current ? 0.065 : 0.05);
    }

    let targetHeadYaw = px * 0.68 - travelVelX * 0.03 + shakeOffset;
    let targetHeadPitch = -py * 0.44;

    if (isKeyActive) targetHeadPitch -= keyIntensity * 0.05;

    const targetHeadRoll =
      (torsoRef.current ? -torsoRef.current.rotation.z * 0.65 : 0) - px * 0.12;

    if (isRestricted) {
      targetHeadYaw = shakeOffset;
      targetHeadPitch = -0.06;
    } else if (isLoading) {
      targetHeadYaw = px * 0.25;
      targetHeadPitch = -0.06 - py * 0.15;
    } else if (isLookingAtAccess || isCtaHovered || isTyping) {
      // Bias attention toward sign-in without replacing live pointer tracking.
      targetHeadYaw -= 0.12;
      targetHeadPitch -= 0.05;
    }

    microTimer.current += delta;
    if (microTimer.current > 6.0) {
      microTilt.current = (Math.random() - 0.5) * 0.025;
      microTimer.current = 0;
    }

    if (headRef.current) {
      headRef.current.rotation.y = THREE.MathUtils.damp(headRef.current.rotation.y, targetHeadYaw, 9.2, delta);
      headRef.current.rotation.x = THREE.MathUtils.damp(headRef.current.rotation.x, targetHeadPitch, 9.2, delta);
      headRef.current.rotation.z = THREE.MathUtils.damp(headRef.current.rotation.z, targetHeadRoll + microTilt.current - impact.impactNormal.x * recoil * .035, 7.5, delta);
      if (languageIntro) headRef.current.rotation.set(0, 0, 0);
    }

    // ─── 5. DIGITAL APERTURE EYES (HIGH-GAIN ATTENTION TO POINTER) ───
    let targetEyeX = px * 0.085;
    let targetEyeY = -py * 0.055;
    if (isLookingAtAccess || isCtaHovered || isTyping) {
      targetEyeX -= 0.012;
      targetEyeY -= 0.006;
    }

    if (eyesGroupRef.current) {
      eyesGroupRef.current.position.x = THREE.MathUtils.damp(eyesGroupRef.current.position.x, targetEyeX, 12.0, delta);
      eyesGroupRef.current.position.y = THREE.MathUtils.damp(eyesGroupRef.current.position.y, 0.025 + targetEyeY, 12.0, delta);
    }

    // Natural eye blink physics
    blinkTimer.current += delta;
    blinkRemaining.current = Math.max(0, blinkRemaining.current - delta);
    if (blinkTimer.current >= nextBlink.current) {
      blinkRemaining.current = 0.11;
      blinkTimer.current = 0;
      nextBlink.current = 3.6 + Math.random() * 3.5;
    }

    const eyeScaleY = blinkRemaining.current > 0 ? 0.06 : 1.0;
    if (leftEyeRef.current) {
      leftEyeRef.current.scale.y = THREE.MathUtils.damp(leftEyeRef.current.scale.y, eyeScaleY, 18, delta);
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.scale.y = THREE.MathUtils.damp(rightEyeRef.current.scale.y, eyeScaleY, 18, delta);
    }

    // ─── 6. LATERAL FLOATING SCULLING (BƠI GIƠ TAY SANG NGANG & XOAY VÒNG NHÈ NHẸ) ───
    // Front crawl: opposite arms alternate a long pull and a bent-elbow recovery.
    // Keep shoulder angles unwrapped so every revolution remains continuous.
    if (!isReduced) crawlPhaseRef.current += delta * (isError.current ? 3.1 : 2.35);
    const strokeL = crawlPhaseRef.current;
    const strokeR = strokeL + Math.PI;
    const recoveryL = Math.max(0, -Math.sin(strokeL));
    const recoveryR = Math.max(0, -Math.sin(strokeR));
    const targetPitchL = isReduced ? -0.35 : strokeL - Math.PI;
    const targetPitchR = isReduced ? -0.35 : strokeR - Math.PI;
    const targetRollL = -0.16 - recoveryL * 0.48;
    const targetRollR = 0.16 + recoveryR * 0.48;
    const targetYawL = -0.10 + Math.sin(strokeL) * 0.16;
    const targetYawR = 0.10 - Math.sin(strokeR) * 0.16;
    const targetElbowL = -0.12 - recoveryL * 1.25;
    const targetElbowR = -0.12 - recoveryR * 1.25;
    const targetForearmYawL = 0.08 + recoveryL * 0.24;
    const targetForearmYawR = -0.08 - recoveryR * 0.24;
    const targetForearmRollL = -recoveryL * 0.20;
    const targetForearmRollR = recoveryR * 0.20;

    // Apply Smooth Viscous Damping
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.damp(leftArmRef.current.rotation.x, targetPitchL, 8.0, delta);
      leftArmRef.current.rotation.z = THREE.MathUtils.damp(leftArmRef.current.rotation.z, targetRollL, 8.0, delta);
      leftArmRef.current.rotation.y = THREE.MathUtils.damp(leftArmRef.current.rotation.y, targetYawL, 8.0, delta);
    }
    if (leftForearmRef.current) {
      leftForearmRef.current.rotation.x = THREE.MathUtils.damp(leftForearmRef.current.rotation.x, targetElbowL, 9.0, delta);
      leftForearmRef.current.rotation.y = THREE.MathUtils.damp(leftForearmRef.current.rotation.y, targetForearmYawL, 8.0, delta);
      leftForearmRef.current.rotation.z = THREE.MathUtils.damp(leftForearmRef.current.rotation.z, targetForearmRollL, 8.0, delta);
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.damp(rightArmRef.current.rotation.x, targetPitchR, 8.0, delta);
      rightArmRef.current.rotation.z = THREE.MathUtils.damp(rightArmRef.current.rotation.z, targetRollR, 8.0, delta);
      rightArmRef.current.rotation.y = THREE.MathUtils.damp(rightArmRef.current.rotation.y, targetYawR, 8.0, delta);
    }
    if (rightForearmRef.current) {
      rightForearmRef.current.rotation.x = THREE.MathUtils.damp(rightForearmRef.current.rotation.x, targetElbowR, 9.0, delta);
      rightForearmRef.current.rotation.y = THREE.MathUtils.damp(rightForearmRef.current.rotation.y, targetForearmYawR, 8.0, delta);
      rightForearmRef.current.rotation.z = THREE.MathUtils.damp(rightForearmRef.current.rotation.z, targetForearmRollR, 8.0, delta);
    }

    // ─── 7. LIGHTING & EMISSIVE ENERGY (ALERT ON ERROR, SERENE ON PATROL) ───
    const basePulse = Math.sin(t * 2.0) * 0.35 + 0.95;
    const boost = isLoading ? 3.0 : isProcessing ? 2.2 : isLookingAtAccess ? 1.45 : 1.0;
    const keyCorePulse = isKeyActive ? 1.0 + keyIntensity * 0.7 : 1.0;

    if (isError.current) {
      // Diagnostic Error Warning Yellow Alert!
      coreEmissiveMat.color.set("#FFD600");
      coreEmissiveMat.emissive.set("#FFB800");
      coreEmissiveMat.emissiveIntensity = 2.8 + Math.sin(t * 18) * 1.0;

      eyeEmissiveMat.color.set("#FFD600");
      eyeEmissiveMat.emissive.set("#FFB800");
      eyeEmissiveMat.emissiveIntensity = 3.0 + Math.sin(t * 18) * 1.2;

      antennaEmissiveMat.color.set("#FFD600");
      antennaEmissiveMat.emissive.set("#FFB800");
      antennaEmissiveMat.emissiveIntensity = 3.2;

      thrusterGlowMat.opacity = 0.92;
    } else if (isRestricted) {
      // Access Restricted Red Alert!
      coreEmissiveMat.color.set("#FF3B30");
      coreEmissiveMat.emissive.set("#FF3B30");
      coreEmissiveMat.emissiveIntensity = 2.8 + Math.sin(t * 18) * 1.0;

      eyeEmissiveMat.color.set("#FF3B30");
      eyeEmissiveMat.emissive.set("#FF3B30");
      eyeEmissiveMat.emissiveIntensity = 3.0 + Math.sin(t * 18) * 1.2;

      antennaEmissiveMat.color.set("#FF3B30");
      antennaEmissiveMat.emissive.set("#FF3B30");
      antennaEmissiveMat.emissiveIntensity = 3.2;

      thrusterGlowMat.opacity = 0.92;
    } else if (isLoading) {
      // Active Luminous Cyber Green (User Access or Correct Admin Pass)
      coreEmissiveMat.color.set("#00FF88");
      coreEmissiveMat.emissive.set("#00FF88");
      coreEmissiveMat.emissiveIntensity = 3.2 + Math.sin(t * 8) * 0.8;

      eyeEmissiveMat.color.set("#00FF88");
      eyeEmissiveMat.emissive.set("#00FF88");
      eyeEmissiveMat.emissiveIntensity = 3.2;

      antennaEmissiveMat.color.set("#00FF88");
      antennaEmissiveMat.emissive.set("#00FF88");
      antennaEmissiveMat.emissiveIntensity = 3.4 + Math.sin(t * 8) * 0.8;

      thrusterGlowMat.opacity = 0.75 + Math.sin(t * 6) * 0.15;
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
      if (isError.current) {
        corePointLightRef.current.color.set("#FFB800");
      } else if (isRestricted) {
        corePointLightRef.current.color.set("#FF3B30");
      } else if (isLoading) {
        corePointLightRef.current.color.set("#00FF88");
      } else {
        corePointLightRef.current.color.set("#2D7FB4");
      }
    }

    const antennaTypingBoost = isTyping || isKeyActive ? 2.8 + keyIntensity * 1.5 : 1.0;
    antennaEmissiveMat.emissiveIntensity = (0.85 + Math.sin(t * (isKeyActive ? 8.0 : 3.2)) * 0.45) * antennaTypingBoost;

    if (keyLightRef.current) {
      keyLightRef.current.position.x = 3.8 - px * 0.25;
      const robotPosY = rootRef.current ? rootRef.current.position.y : 0;
      keyLightRef.current.intensity = 1.25 + robotPosY * 0.12;
    }
    const obstacle = droneObstacle.current;
    // Project the actual visor plane into the accessible HTML language buttons.
    // All three corners inherit the robot's head movement and perspective.
    if (languageIntro && languageScreen?.current && headRef.current) {
      headRef.current.updateWorldMatrix(true, false);
      const [a, b, c] = screenCorners;
      a.set(-.245, .10, .36); b.set(.245, .10, .36); c.set(-.245, -.065, .36);
      for (const point of screenCorners) {
        point.applyMatrix4(headRef.current.matrixWorld).project(camera);
        point.x = (point.x * .5 + .5) * introTarget.current.width + introTarget.current.left;
        point.y = (-point.y * .5 + .5) * introTarget.current.height + introTarget.current.top;
      }
      const transform = `matrix(${((b.x-a.x)/220).toFixed(4)},${((b.y-a.y)/220).toFixed(4)},${((c.x-a.x)/64).toFixed(4)},${((c.y-a.y)/64).toFixed(4)},${a.x.toFixed(2)},${a.y.toFixed(2)})`;
      if (transform !== lastScreenTransform.current) {
        languageScreen.current.style.setProperty("--visor-transform", transform);
        lastScreenTransform.current = transform;
      }
    }
    obstacle.active = entranceT >= 1 && !isReduced;
    if (obstacle.active && torsoRef.current && headRef.current) {
      const scale = rootRef.current?.scale.x || 4;
      torsoRef.current.getWorldPosition(collisionScratch);
      obstacle.body.x = collisionScratch.x; obstacle.body.y = collisionScratch.y; obstacle.body.z = collisionScratch.z;
      obstacle.body.radius = scale * .42;
      headRef.current.getWorldPosition(collisionScratch);
      obstacle.head.x = collisionScratch.x; obstacle.head.y = collisionScratch.y; obstacle.head.z = collisionScratch.z;
      obstacle.head.radius = scale * .38;
    }
  });

  return (
    <>
      {/* ─── VISIBLE ROBOT PATROL ORBIT (FULL CLOSED LOOP, NO VERTICAL LINES) ─── */}
      <RobotOrbitTrack curve={masterOrbitCurve} isErrorRef={isError} />

      <group
        name="landing-guardian-robot"
        ref={rootRef}
        position={[-1.5, -12, -6]}
        scale={4}
        onPointerDown={handlePointerDown}
        onPointerOver={() => {
          if (gl.domElement && !languageIntro && !returningToOrbit) gl.domElement.style.cursor = "grab";
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

        {/* ─── LIGHTING RIG (Balanced Studio Hierarchy) ───────────────────── */}
        <ambientLight intensity={0.38} color="#8AB8D4" />

        {/* Key Warm Studio Light */}
        <directionalLight
          ref={keyLightRef}
          position={[3.8, 4.2, 4.2]}
          intensity={1.35}
          color="#FFF9F2"
        />

        {/* Rim Accent Blue Light for sharp silhouette definition */}
        <directionalLight

          position={[-4.5, 3.4, -3.2]}
          intensity={1.65}
          color="#3A94D0"
        />

        {/* Soft Fill Light to lift deep shadows */}
        <directionalLight
          position={[-3.2, -1.8, 3.0]}
          intensity={0.48}
          color="#92B4CE"
        />

        {/* Soft Gold Bounce Fill */}
        <pointLight position={[2.2, -1.8, 2.4]} intensity={0.40} color="#E9CA8B" />

        {/* AI Core Internal Point Light */}
        <pointLight
          ref={corePointLightRef}
          position={[0, -0.32, 0.38]}
          intensity={0.85}
          distance={2.6}
          color="#2D7FB4"
        />

        {/* ─── HOVER SUSPENSION GROUP ───────────────────────────────────────── */}
        <group>
          {/* ───────────── TORSO CHASSIS ───────────── */}
          <group ref={torsoRef} name="landing-guardian-torso">
            {/* ───────────── COMPACT CERVICAL NECK ASSEMBLY ───────────── */}
            {/* Cervical Bulkhead Base Plate with Hexagonal Structural Mount */}
            <mesh position={[0, 0.16, 0]} material={materials.deepNavy}>
              <cylinderGeometry args={[0.16, 0.185, 0.035, 8]} />
            </mesh>
            {/* 6 Gold Peripheral Structural Retaining Bolts */}
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const a = (idx * Math.PI) / 3;
              return (
                <mesh
                  key={`bolt-${idx}`}
                  position={[Math.cos(a) * 0.145, 0.18, Math.sin(a) * 0.145]}
                  material={materials.goldHighlight}
                >
                  <cylinderGeometry args={[0.008, 0.008, 0.005, 6]} />
                </mesh>
              );
            })}

            {/* Stepped Telescopic Neck Collar Ring */}
            <mesh position={[0, 0.20, 0]} material={materials.navyJoint}>
              <cylinderGeometry args={[0.125, 0.14, 0.06, 24]} />
            </mesh>
            <mesh position={[0, 0.215, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
              <torusGeometry args={[0.132, 0.007, 8, 32]} />
            </mesh>

            {/* Central Spherical Neck Gimbal Ball */}
            <mesh position={[0, 0.26, 0]} material={materials.deepNavy}>
              <sphereGeometry args={[0.096, 20, 18]} />
            </mesh>
            {/* Concentric Gimbal Pivot Equator Ring */}
            <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
              <torusGeometry args={[0.100, 0.005, 8, 28]} />
            </mesh>

            {/* Segmented Flexible Accordion Bellow Seal (3 Protective Discs) */}
            {[-0.012, 0.008, 0.028].map((yOff, i) => (
              <mesh key={`bellow-${i}`} position={[0, 0.225 + yOff, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.occlusionShadow}>
                <torusGeometry args={[0.112 - i * 0.005, 0.006, 8, 24]} />
              </mesh>
            ))}

            {/* Twin Lateral Hydraulic Neck Pushrods / Actuators */}
            {[-0.085, 0.085].map((x, i) => (
              <group key={`neck-piston-${i}`} position={[x, 0.21, -0.01]}>
                {/* Lower Cylinder Barrel */}
                <mesh material={materials.deepNavy}>
                  <cylinderGeometry args={[0.011, 0.011, 0.07, 12]} />
                </mesh>
                {/* Upper Polished Gold Pushrod Piston */}
                <mesh position={[0, 0.042, 0]} material={materials.goldPrimary}>
                  <cylinderGeometry args={[0.006, 0.006, 0.05, 12]} />
                </mesh>
                {/* Pivot Mount Bracket */}
                <mesh position={[0, -0.036, 0]} material={materials.goldHighlight}>
                  <sphereGeometry args={[0.010, 10, 8]} />
                </mesh>
              </group>
            ))}

            {/* ───────────── SLIMMER & COMPACT TORSO ARMOR (20-25% REDUCED) ───────────── */}
            {/* Internal Structural Spine Spar */}
            <mesh position={[0, -0.12, -0.02]} material={materials.deepNavy}>
              <boxGeometry args={[0.14, 0.44, 0.25]} />
            </mesh>

            {/* Sculpted Main Breastplate (Aerospace Anodized Navy Armor) */}
            <mesh position={[0, -0.12, 0.03]} material={materials.navyArmor}>
              <cylinderGeometry args={[0.33, 0.30, 0.46, 32]} />
            </mesh>

            {/* Deep Navy Backplate & Reactor Mount */}
            <mesh position={[0, -0.12, -0.05]} material={materials.deepNavy}>
              <cylinderGeometry args={[0.31, 0.28, 0.44, 24]} />
            </mesh>

            {/* Front Sculpted Armor Shell (Curved Chest Contour) */}
            <mesh position={[0, -0.05, 0.145]} rotation={[0.08, 0, 0]} material={materials.navyArmor}>
              <boxGeometry args={[0.53, 0.29, 0.15]} />
            </mesh>

            {/* Dark Recessed Mechanical Seams Between Chest and Flanks */}
            {[-0.255, 0.255].map((x, i) => (
              <mesh key={`seam-${i}`} position={[x, -0.11, 0.08]} rotation={[0, i === 0 ? 0.22 : -0.22, 0]} material={materials.occlusionShadow}>
                <boxGeometry args={[0.010, 0.36, 0.16]} />
              </mesh>
            ))}

            {/* Flanking Gold Accent Trim on Chest (Framing the EIU badge cleanly) */}
            {[-0.25, 0.25].map((x, i) => (
              <mesh key={i} position={[x, -0.05, 0.222]} material={materials.goldPrimary}>
                <boxGeometry args={[0.065, 0.007, 0.012]} />
              </mesh>
            ))}

            {/* Flank Armor Cowlings (Layered Aerodynamic Panels) */}
            <mesh position={[-0.295, -0.11, 0.05]} rotation={[0, 0.22, -0.08]} material={materials.navyFlank}>
              <boxGeometry args={[0.092, 0.37, 0.25]} />
            </mesh>
            <mesh position={[0.295, -0.11, 0.05]} rotation={[0, -0.22, 0.08]} material={materials.navyFlank}>
              <boxGeometry args={[0.092, 0.37, 0.25]} />
            </mesh>

            {/* Flank Armor Structural Retaining Brackets with Gold Fasteners */}
            {[-0.32, 0.32].map((xF, i) => (
              <group key={`flank-mount-${i}`} position={[xF, -0.04, 0.13]}>
                <mesh material={materials.deepNavy}>
                  <boxGeometry args={[0.016, 0.032, 0.032]} />
                </mesh>
                <mesh position={[i === 0 ? -0.009 : 0.009, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.goldHighlight}>
                  <cylinderGeometry args={[0.005, 0.005, 0.003, 6]} />
                </mesh>
              </group>
            ))}

            {/* Official EIU Crest Badge on Robot Breastplate */}
            <EiuCrestBadge />


            {/* ─── CENTRAL AI CORE REACTOR ─── */}
            <group position={[0, -0.26, 0.185]}>
              {/* Outer Concentric Gold Bezel */}
              <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                <torusGeometry args={[0.092, 0.011, 12, 36]} />
              </mesh>
              {/* Secondary Inner Bezel */}
              <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
                <torusGeometry args={[0.068, 0.006, 8, 32]} />
              </mesh>
              {/* Dark Optical Recess */}
              <mesh position={[0, 0, -0.008]} material={materials.deepNavy}>
                <cylinderGeometry args={[0.084, 0.084, 0.024, 24]} />
              </mesh>
              {/* 4 Radial Compression Brackets Securing AI Core */}
              {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((ang, i) => (
                <group key={`core-bracket-${i}`} rotation={[0, 0, ang]}>
                  <mesh position={[0, 0.086, 0.006]} material={materials.goldPrimary}>
                    <boxGeometry args={[0.015, 0.020, 0.006]} />
                  </mesh>
                </group>
              ))}
              {/* Luminous Pulsing AI Core Heart */}
              <mesh position={[0, 0, 0.016]}>
                <sphereGeometry args={[0.050, 24, 20]} />
                <primitive object={coreEmissiveMat} attach="material" />
              </mesh>
              {/* Core Optical Outer Halo Ring */}
              <mesh position={[0, 0, 0.020]} rotation={[0, 0, Math.PI / 4]}>
                <torusGeometry args={[0.058, 0.005, 6, 24]} />
                <primitive object={coreEmissiveMat} attach="material" />
              </mesh>
            </group>

            {/* ─── ARTICULATED LUMBAR VERTEBRAL SPINE & WAIST ─── */}
            {/* 3 Interlocking Vertebral Hubs with Lateral Transverse Wings */}
            {[-0.34, -0.39, -0.45].map((y, i) => (
              <group key={`vert-${i}`} position={[0, y, 0]}>
                {/* Vertebral Central Core */}
                <mesh material={materials.navyJoint}>
                  <cylinderGeometry args={[0.135 - i * 0.012, 0.145 - i * 0.012, 0.038, 20]} />
                </mesh>
                {/* Gold Intervertebral Pivot Ring */}
                <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
                  <torusGeometry args={[0.140 - i * 0.012, 0.004, 6, 24]} />
                </mesh>
                {/* Lateral Spinal Transverse Wings */}
                {[-0.11 + i * 0.008, 0.11 - i * 0.008].map((xW, j) => (
                  <mesh key={`wing-${j}`} position={[xW, 0, 0]} material={materials.deepNavy}>
                    <boxGeometry args={[0.036, 0.022, 0.065]} />
                  </mesh>
                ))}
              </group>
            ))}

            {/* Dual Posterior/Lateral Hydraulic Waist Dampers */}
            {[-0.105, 0.105].map((x, i) => (
              <group key={`waist-damper-${i}`} position={[x, -0.39, -0.025]} rotation={[0, 0, i === 0 ? 0.08 : -0.08]}>
                {/* Upper Heavy Damper Barrel */}
                <mesh material={materials.deepNavy}>
                  <cylinderGeometry args={[0.017, 0.017, 0.10, 14]} />
                </mesh>
                {/* Gold Piston Shaft */}
                <mesh position={[0, -0.06, 0]} material={materials.goldPrimary}>
                  <cylinderGeometry args={[0.010, 0.010, 0.07, 12]} />
                </mesh>
                {/* Mounting Cleats */}
                <mesh position={[0, 0.052, 0]} material={materials.goldHighlight}>
                  <sphereGeometry args={[0.013, 10, 8]} />
                </mesh>
                <mesh position={[0, -0.09, 0]} material={materials.goldHighlight}>
                  <sphereGeometry args={[0.013, 10, 8]} />
                </mesh>
              </group>
            ))}

            {/* Flexible Shielded Power Conduits (Routing Power from Reactor to Repulsor) */}
            {[-0.048, 0.048].map((x, i) => (
              <mesh key={`conduit-${i}`} position={[x, -0.38, 0.095]} rotation={[0.12, 0, i === 0 ? -0.08 : 0.08]} material={materials.occlusionShadow}>
                <cylinderGeometry args={[0.011, 0.011, 0.15, 12]} />
              </mesh>
            ))}

            {/* ─── LEVITATING REPULSOR DRIVE (SLIMMER & VERTICALLY BALANCED) ─── */}
            <group position={[0, -0.55, 0]}>
              {/* Hexagonal Pelvic Bulkhead Chassis */}
              <mesh material={materials.deepNavy}>
                <cylinderGeometry args={[0.21, 0.13, 0.13, 6]} />
              </mesh>
              {/* Perimeter Gold Chassis Retaining Rim */}
              <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                <torusGeometry args={[0.198, 0.006, 8, 30]} />
              </mesh>

              {/* Twin Vector Thruster Nozzles */}
              {[-0.11, 0.11].map((x, i) => (
                <group key={i} position={[x, -0.08, -0.02]}>
                  {/* Two-Axis Gimbal Vector Ring */}
                  <mesh position={[0, 0.032, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                    <torusGeometry args={[0.066, 0.006, 8, 20]} />
                  </mesh>
                  {/* Thruster Outer Bell (Anodized Aerospace Titanium) */}
                  <mesh material={materials.navyArmor}>
                    <cylinderGeometry args={[0.060, 0.078, 0.115, 24]} />
                  </mesh>
                  {/* Inner Ceramic Thermal Shield Sleeve */}
                  <mesh position={[0, -0.006, 0]} material={materials.deepNavy}>
                    <cylinderGeometry args={[0.054, 0.070, 0.105, 20]} />
                  </mesh>
                  {/* Primary Gold Trim Ring */}
                  <mesh position={[0, -0.058, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                    <torusGeometry args={[0.078, 0.008, 8, 24]} />
                  </mesh>
                  {/* Secondary Gold Highlight Lip */}
                  <mesh position={[0, -0.063, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
                    <torusGeometry args={[0.074, 0.004, 8, 24]} />
                  </mesh>
                  {/* Glowing Ion Exhaust Disk */}
                  <mesh                    position={[0, -0.068, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                  >
                    <circleGeometry args={[0.070, 24]} />
                    <primitive object={thrusterGlowMat} attach="material" />
                  </mesh>

                </group>
              ))}

              {/* Aerodynamic Lateral Stabilizer Airfoil Fins with Gold Leading Edge */}
              {[-0.205, 0.205].map((x, i) => (
                <group key={i} position={[x, -0.015, 0]} rotation={[0, 0, i === 0 ? 0.32 : -0.32]}>
                  {/* Fin Root Hinge Bracket */}
                  <mesh position={[i === 0 ? 0.013 : -0.013, 0, 0]} material={materials.deepNavy}>
                    <boxGeometry args={[0.014, 0.13, 0.11]} />
                  </mesh>
                  {/* Airfoil Main Fin Blade */}
                  <mesh material={materials.navyArmor}>
                    <boxGeometry args={[0.020, 0.18, 0.13]} />
                  </mesh>
                  {/* Gold Leading-Edge Blade */}
                  <mesh position={[i === 0 ? -0.011 : 0.011, 0, 0]} material={materials.goldPrimary}>
                    <boxGeometry args={[0.006, 0.184, 0.012]} />
                  </mesh>
                  {/* Hydraulic Pitch Actuator Rod */}
                  <mesh position={[i === 0 ? 0.008 : -0.008, -0.032, -0.04]} rotation={[0.4, 0, 0]} material={materials.goldHighlight}>
                    <cylinderGeometry args={[0.003, 0.003, 0.05, 8]} />
                  </mesh>
                </group>
              ))}
            </group>

            {/* ─── CLAVICLE STRUCTURAL ANCHORS (Connecting Torso to Shoulders) ─── */}
            {[-0.27, 0.27].map((x, i) => (
              <group key={`clavicle-${i}`} position={[x, 0.02, 0.035]}>
                <mesh material={materials.deepNavy}>
                  <boxGeometry args={[0.12, 0.042, 0.062]} />
                </mesh>
                <mesh position={[0, 0.020, 0]} material={materials.goldPrimary}>
                  <boxGeometry args={[0.11, 0.005, 0.055]} />
                </mesh>
                <mesh position={[i === 0 ? -0.045 : 0.045, 0.022, 0]} material={materials.goldHighlight}>
                  <cylinderGeometry args={[0.008, 0.008, 0.003, 12]} />
                </mesh>
              </group>
            ))}

            {/* ─── ARTICULATED ERGONOMIC ARMS (CLOSER TO BODY & PROPORTIONATE) ─── */}
            {/* Left Arm Assembly */}
            <group ref={leftArmRef} position={[-0.375, 0.02, 0.035]}>
              {/* Exposed Spherical Shoulder Ball Socket */}
              <mesh material={materials.navyJoint}>
                <sphereGeometry args={[0.105, 24, 20]} />
              </mesh>
              {/* Layered Pauldron Armored Cowling with Gold Bezel */}
              <mesh position={[-0.016, 0.032, 0]} rotation={[0, 0, 0.12]} material={materials.navyArmor}>
                <sphereGeometry args={[0.125, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              </mesh>
              <mesh position={[-0.016, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                <torusGeometry args={[0.120, 0.007, 8, 28]} />
              </mesh>
              {/* Rotary Deltoid Pivot Hub with Gold Axle Cap */}
              <mesh position={[-0.11, 0.016, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.deepNavy}>
                <cylinderGeometry args={[0.036, 0.042, 0.018, 20]} />
              </mesh>
              <mesh position={[-0.12, 0.016, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.goldHighlight}>
                <cylinderGeometry args={[0.020, 0.020, 0.006, 16]} />
              </mesh>

              {/* Upper Arm Structural Bone Frame */}
              <mesh position={[-0.025, -0.14, 0]} material={materials.navyFlank}>
                <cylinderGeometry args={[0.054, 0.046, 0.17, 20]} />
              </mesh>
              {/* Outer Bicep Armor Shell with Gold Seam */}
              <mesh position={[-0.045, -0.14, 0.01]} material={materials.navyArmor}>
                <boxGeometry args={[0.026, 0.15, 0.064]} />
              </mesh>
              <mesh position={[-0.059, -0.14, 0.01]} material={materials.goldPrimary}>
                <boxGeometry args={[0.003, 0.145, 0.006]} />
              </mesh>
              {/* Posterior Hydraulic Elbow Actuator Cylinder */}
              <group position={[-0.01, -0.13, -0.04]}>
                <mesh material={materials.deepNavy}>
                  <cylinderGeometry args={[0.013, 0.013, 0.09, 14]} />
                </mesh>
                <mesh position={[0, -0.05, 0]} material={materials.goldPrimary}>
                  <cylinderGeometry args={[0.007, 0.007, 0.06, 12]} />
                </mesh>
              </group>

              {/* Left Forearm Articulation (Elbow Flexion Hub) */}
              <group ref={leftForearmRef} position={[-0.025, -0.24, 0]}>
                {/* Central Hinge Cylinder & Gold Axle Pin */}
                <mesh rotation={[0, 0, Math.PI / 2]} material={materials.navyJoint}>
                  <cylinderGeometry args={[0.050, 0.050, 0.056, 20]} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]} material={materials.goldHighlight}>
                  <cylinderGeometry args={[0.026, 0.026, 0.060, 16]} />
                </mesh>
                {/* Floating Elbow Olecranon Guard Cap */}
                <mesh position={[-0.01, 0, -0.04]} material={materials.navyArmor}>
                  <boxGeometry args={[0.054, 0.052, 0.020]} />
                </mesh>

                {/* Tapered Forearm Armor Housing */}
                <mesh position={[0, -0.09, 0.018]} rotation={[0.08, 0, 0]} material={materials.navyArmor}>
                  <cylinderGeometry args={[0.046, 0.036, 0.16, 20]} />
                </mesh>
                {/* Recessed Forearm Service Seam Channel */}
                <mesh position={[0, -0.09, 0.048]} material={materials.occlusionShadow}>
                  <boxGeometry args={[0.007, 0.14, 0.005]} />
                </mesh>
                <mesh position={[0, -0.09, 0.048]} material={materials.accentBlue}>
                  <boxGeometry args={[0.0035, 0.12, 0.003]} />
                </mesh>

                {/* 5-Fingered Articulated Robotic Hand */}
                <RoboticHand5Fingers
                  side="left"
                  goldMat={materials.goldPrimary}
                  navyMat={materials.navyArmor}
                  deepNavyMat={materials.deepNavy}
                  jointMat={materials.navyJoint}
                  accentBlueMat={materials.accentBlue}
                />
              </group>
            </group>

            {/* Right Arm Assembly */}
            <group ref={rightArmRef} position={[0.375, 0.02, 0.035]}>
              {/* Exposed Spherical Shoulder Ball Socket */}
              <mesh material={materials.navyJoint}>
                <sphereGeometry args={[0.105, 24, 20]} />
              </mesh>
              {/* Layered Pauldron Armored Cowling with Gold Bezel */}
              <mesh position={[0.016, 0.032, 0]} rotation={[0, 0, -0.12]} material={materials.navyArmor}>
                <sphereGeometry args={[0.125, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              </mesh>
              <mesh position={[0.016, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                <torusGeometry args={[0.120, 0.007, 8, 28]} />
              </mesh>
              {/* Rotary Deltoid Pivot Hub with Gold Axle Cap */}
              <mesh position={[0.11, 0.016, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.deepNavy}>
                <cylinderGeometry args={[0.036, 0.042, 0.018, 20]} />
              </mesh>
              <mesh position={[0.12, 0.016, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.goldHighlight}>
                <cylinderGeometry args={[0.020, 0.020, 0.006, 16]} />
              </mesh>

              {/* Upper Arm Structural Bone Frame */}
              <mesh position={[0.025, -0.14, 0]} material={materials.navyFlank}>
                <cylinderGeometry args={[0.054, 0.046, 0.17, 20]} />
              </mesh>
              {/* Outer Bicep Armor Shell with Gold Seam */}
              <mesh position={[0.045, -0.14, 0.01]} material={materials.navyArmor}>
                <boxGeometry args={[0.026, 0.15, 0.064]} />
              </mesh>
              <mesh position={[0.059, -0.14, 0.01]} material={materials.goldPrimary}>
                <boxGeometry args={[0.003, 0.145, 0.006]} />
              </mesh>
              {/* Posterior Hydraulic Elbow Actuator Cylinder */}
              <group position={[0.01, -0.13, -0.04]}>
                <mesh material={materials.deepNavy}>
                  <cylinderGeometry args={[0.013, 0.013, 0.09, 14]} />
                </mesh>
                <mesh position={[0, -0.05, 0]} material={materials.goldPrimary}>
                  <cylinderGeometry args={[0.007, 0.007, 0.06, 12]} />
                </mesh>
              </group>

              {/* Right Forearm Articulation (Elbow Flexion Hub) */}
              <group ref={rightForearmRef} position={[0.025, -0.24, 0]}>
                {/* Central Hinge Cylinder & Gold Axle Pin */}
                <mesh rotation={[0, 0, Math.PI / 2]} material={materials.navyJoint}>
                  <cylinderGeometry args={[0.050, 0.050, 0.056, 20]} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]} material={materials.goldHighlight}>
                  <cylinderGeometry args={[0.026, 0.026, 0.060, 16]} />
                </mesh>
                {/* Floating Elbow Olecranon Guard Cap */}
                <mesh position={[0.01, 0, -0.04]} material={materials.navyArmor}>
                  <boxGeometry args={[0.054, 0.052, 0.020]} />
                </mesh>

                {/* Tapered Forearm Armor Housing */}
                <mesh position={[0, -0.09, 0.018]} rotation={[0.08, 0, 0]} material={materials.navyArmor}>
                  <cylinderGeometry args={[0.046, 0.036, 0.16, 20]} />
                </mesh>
                {/* Recessed Forearm Service Seam Channel */}
                <mesh position={[0, -0.09, 0.048]} material={materials.occlusionShadow}>
                  <boxGeometry args={[0.007, 0.14, 0.005]} />
                </mesh>
                <mesh position={[0, -0.09, 0.048]} material={materials.accentBlue}>
                  <boxGeometry args={[0.0035, 0.12, 0.003]} />
                </mesh>

                {/* 5-Fingered Articulated Robotic Hand */}
                <RoboticHand5Fingers
                  side="right"
                  goldMat={materials.goldPrimary}
                  navyMat={materials.navyArmor}
                  deepNavyMat={materials.deepNavy}
                  jointMat={materials.navyJoint}
                  accentBlueMat={materials.accentBlue}
                />
              </group>
            </group>
          </group>

          {/* ───────────── AERODYNAMIC SCULPTED HEAD WITH GIMBAL MOUNT ───────────── */}
          <group ref={headRef} position={[0, 0.41, 0]}>
            {showErrorBadge && <VisorStatusDisplay status="error" />}
            {showRestrictedBadge && !showErrorBadge && <VisorStatusDisplay status="restricted" text={robotState === "wrongPasscode" ? "Wrong passcode" : undefined} />}
            {showLoadingBadge && !showErrorBadge && !showRestrictedBadge && <VisorStatusDisplay status="loading" />}
            {/* Sub-Cranial Occipital Mount & Underside Gimbal Socket */}
            <group position={[0, -0.15, 0]}>
              <mesh material={materials.deepNavy}>
                <cylinderGeometry args={[0.11, 0.13, 0.045, 18]} />
              </mesh>
              <mesh position={[0, -0.024, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldPrimary}>
                <torusGeometry args={[0.116, 0.005, 8, 24]} />
              </mesh>
            </group>

            {/* Chin & Jawline Structural Support Frame with Intake Grille */}
            <group position={[0, -0.075, 0.20]}>
              <mesh material={materials.navyArmor}>
                <boxGeometry args={[0.15, 0.055, 0.075]} />
              </mesh>
              <mesh position={[0, -0.018, 0.039]} material={materials.deepNavy}>
                <boxGeometry args={[0.11, 0.014, 0.004]} />
              </mesh>
              <mesh position={[0, -0.018, 0.041]} material={materials.goldPrimary}>
                <boxGeometry args={[0.09, 0.003, 0.002]} />
              </mesh>
            </group>
          {/* Main Helmet Dome */}
          <mesh material={materials.navyArmor}>
            <sphereGeometry args={[0.38, 48, 32]} />
          </mesh>

          {/* Top Aerodynamic Brow & Crown Ridge with Multi-Tier Gold Inlay */}
          <mesh position={[0, 0.28, 0]} rotation={[0.1, 0, 0]} material={materials.navyArmor}>
            <boxGeometry args={[0.26, 0.12, 0.44]} />
          </mesh>
          <mesh position={[0, 0.34, 0]} material={materials.goldPrimary}>
            <boxGeometry args={[0.042, 0.016, 0.42]} />
          </mesh>
          <mesh position={[0, 0.348, 0]} material={materials.goldHighlight}>
            <boxGeometry args={[0.016, 0.006, 0.40]} />
          </mesh>

          {/* Rear Occipital Head Shell */}
          <mesh position={[0, 0.02, -0.14]} material={materials.deepNavy}>
            <sphereGeometry args={[0.34, 24, 20]} />
          </mesh>

          {/* Curved Panoramic Optical Visor with High-Refraction Sapphire Finish */}
          <mesh position={[0, 0.02, 0.14]} rotation={[0.06, 0, 0]} material={materials.visorGlass}>
            <sphereGeometry args={[0.32, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.46]} />
          </mesh>

          {/* Gold Visor Perimeter Bezel (Dual Chamfer Frame) */}
          <mesh position={[0, 0.02, 0.26]} rotation={[Math.PI / 2 - 0.06, 0, 0]} material={materials.goldPrimary}>
            <torusGeometry args={[0.278, 0.009, 10, 36]} />
          </mesh>
          <mesh position={[0, 0.02, 0.264]} rotation={[Math.PI / 2 - 0.06, 0, 0]} material={materials.goldHighlight}>
            <torusGeometry args={[0.268, 0.004, 8, 36]} />
          </mesh>

          {/* Visor Glaze Reflection Highlight Bar */}
          <mesh position={[0, 0.12, 0.31]} rotation={[0, 0, 0.04]} material={materials.whiteSpec}>
            <boxGeometry args={[0.32, 0.012, 0.004]} />
          </mesh>

          {/* ─── INTELLIGENT DIGITAL APERTURE EYES ─── */}
          <group ref={eyesGroupRef} position={[0, 0.025, 0.305]} visible={!languageIntro && !showErrorBadge && !showLoadingBadge && !showRestrictedBadge}>
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
            <mesh position={[0, 0.125, 0]}>
              <sphereGeometry args={[0.034, 16, 14]} />
              <primitive object={antennaEmissiveMat} attach="material" />
            </mesh>
            <mesh position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.goldHighlight}>
              <torusGeometry args={[0.046, 0.005, 6, 20]} />
            </mesh>
          </group>
        </group>


      </group>
    </group>
    {/* Scene-space siblings: dragging, tilting or scaling the robot cannot move drones. */}
    <group name="landing-drone-constellation" position={[0, 0, 0]}>
        {DRONE_CONFIGS.map((config) => (
          <AutonomousDrone
            key={config.id}
            config={config}
            obstacle={droneObstacle}
            geometries={droneGeometries}
            stage={stage}
            enter={enter}
            goldMat={materials.goldPrimary}
            navyMat={materials.navyArmor}
            deepNavyMat={materials.deepNavy}
            visorMat={materials.visorGlass}
            accentBlueMat={materials.accentBlue}
            whiteSpecMat={materials.whiteSpec}
          />
        ))}
    </group>
    </>
  );
}
