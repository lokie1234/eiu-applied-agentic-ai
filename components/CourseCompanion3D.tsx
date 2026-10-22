"use client";

import { Component, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, MathUtils, Vector3 } from "three";
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
export type CompanionEmotion = "normal" | "angry" | "surprised";
type Props = {
  gazeRef: RefObject<CompanionGaze>;
  wakeRef: RefObject<(() => void) | null>;
  energized: boolean;
  emotion: CompanionEmotion;
  emotionOpen: boolean;
  screenRef: RefObject<HTMLDivElement | null>;
  antennaRef: RefObject<HTMLButtonElement | null>;
  chinRef: RefObject<HTMLDivElement | null>;
  onReady: (ready: boolean) => void;
};

class SceneBoundary extends Component<{ children: ReactNode; onReady: Props["onReady"] }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onReady(false); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Robot({ gazeRef, wakeRef, energized, emotion, emotionOpen, screenRef, antennaRef, chinRef }: Props) {
  const signalColor = emotion === "angry" ? "#ef5144" : emotion === "surprised" ? "#36d484" : "#f4ce65";
  const robot = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const pulseStart = useRef<number | null>(null);
  const screenCorners = useRef([new Vector3(), new Vector3(), new Vector3()]);
  const antennaPosition = useRef(new Vector3());
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

  useEffect(() => { schedule(); }, [emotion, emotionOpen, schedule]);

  useFrame((state, delta) => {
    if (gazeRef.current.suspended || !robot.current || !eyes.current) return;
    const { x, y, reducedMotion } = gazeRef.current;
    const elapsed = pulseStart.current === null ? 2 : (performance.now() - pulseStart.current) / 1000;
    const greeting = !emotionOpen && !reducedMotion && elapsed < 1.4;
    const bounce = greeting ? Math.sin(elapsed / 1.4 * Math.PI) : 0;
    const targetY = -.12 + (reducedMotion || emotionOpen ? 0 : x * .85);
    // Browser Y grows downwards; positive Three.js X rotation looks down.
    const targetX = .05 + (reducedMotion || emotionOpen ? 0 : y * .5);
    const blend = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 55);
    robot.current.rotation.y = MathUtils.lerp(robot.current.rotation.y, targetY, blend);
    robot.current.rotation.x = MathUtils.lerp(robot.current.rotation.x, targetX, blend);
    robot.current.rotation.z = bounce * Math.sin(elapsed * 12) * .12;
    robot.current.position.y = bounce * .16;
    eyes.current.position.x = reducedMotion ? 0 : x * .075;
    eyes.current.position.y = reducedMotion ? 0 : -y * .045;
    eyes.current.scale.y = energized ? .65 : 1;
    robot.current.updateWorldMatrix(true, false);
    if (antennaRef.current) {
      const point = antennaPosition.current.set(0, .82, 0).applyMatrix4(robot.current.matrixWorld).project(state.camera);
      antennaRef.current.style.transform = `translate(${(point.x+1)*state.size.width/2}px,${(1-point.y)*state.size.height/2}px) translate(-50%,-50%)`;
    }
    // Project the real visor into the DOM so its controls stay attached while the head turns.
    if (screenRef.current) {
      const corners = screenCorners.current;
      corners[0].set(-.53, .355, .525);
      corners[1].set(.53, .355, .525);
      corners[2].set(-.53, -.285, .525);
      for (const corner of corners) {
        corner.applyMatrix4(robot.current.matrixWorld).project(state.camera);
        corner.x = (corner.x + 1) * state.size.width / 2;
        corner.y = (1 - corner.y) * state.size.height / 2;
      }
      const [tl, tr, bl] = corners;
      screenRef.current.style.transform = `matrix(${(tr.x-tl.x)/100},${(tr.y-tl.y)/100},${(bl.x-tl.x)/60},${(bl.y-tl.y)/60},${tl.x},${tl.y})`;
    }
    if (chinRef.current) {
      const corners = screenCorners.current;
      corners[0].set(-.12, -.4, .4);
      corners[1].set(.12, -.4, .4);
      corners[2].set(-.12, -.46, .4);
      for (const corner of corners) {
        corner.applyMatrix4(robot.current.matrixWorld).project(state.camera);
        corner.x = (corner.x + 1) * state.size.width / 2;
        corner.y = (1 - corner.y) * state.size.height / 2;
      }
      const [tl, tr, bl] = corners;
      chinRef.current.style.transform = `matrix(${(tr.x-tl.x)/24},${(tr.y-tl.y)/24},${(bl.x-tl.x)/6},${(bl.y-tl.y)/6},${tl.x},${tl.y})`;
    }
    if (greeting || Math.abs(robot.current.rotation.y - targetY) > .001 || Math.abs(robot.current.rotation.x - targetX) > .001) schedule();
  });

  return <>
    <ambientLight intensity={1.4} />
    <directionalLight position={[-3, 4, 5]} intensity={3} color="#e5f7ff" />
    <directionalLight position={[4, 1, -2]} intensity={4} color="#51c9ef" />
    <pointLight position={[-2, -1, 2]} intensity={8} color="#e9ca8b" />
    <group ref={robot} rotation={[.05, -.22, 0]}>
      <RoundedBox args={[1.38, 1.08, .82]} radius={.29} smoothness={5}>
        <meshStandardMaterial color="#afd7e5" metalness={.6} roughness={.25} />
      </RoundedBox>
      <RoundedBox args={[1.13, .7, .16]} radius={.21} smoothness={5} position={[0, .035, .415]}>
        <meshStandardMaterial color="#041c31" metalness={.35} roughness={.22} />
      </RoundedBox>
      <group ref={eyes} position={[0, 0, .52]} visible={!emotionOpen}>
        {[-.26, .26].map(x => <mesh key={x} position={[x, .08, 0]} scale={[emotion === "angry" ? 1.3 : 1, emotion === "angry" ? .4 : 1, 1]} rotation={[0, 0, emotion === "angry" ? Math.sign(x) * .22 : 0]}>
          {emotion === "surprised" ? <sphereGeometry args={[.085, 12, 8]} /> : <capsuleGeometry args={[.065, .1, 4, 8]} />}
          <meshStandardMaterial color="#a5f1ff" emissive="#51c9ef" emissiveIntensity={energized ? 3 : 1.3} roughness={.25} />
        </mesh>)}
      </group>
      {!emotionOpen && <mesh position={[0, emotion === "surprised" ? -.16 : emotion === "angry" ? -.23 : -.13, .52]} rotation={[0, 0, emotion === "angry" ? 0 : Math.PI]}>
        <torusGeometry args={[emotion === "surprised" ? .065 : .095, .014, 5, 16, emotion === "surprised" ? Math.PI * 2 : Math.PI]} />
        <meshBasicMaterial color="#79e3ff" />
      </mesh>}
      {[-.76, .76].map(x => <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[.17, .17, .17, 24]} />
        <meshStandardMaterial color="#2d7fb4" metalness={.65} roughness={.3} />
      </mesh>)}
      <mesh position={[0, .66, 0]}>
        <cylinderGeometry args={[.025, .035, .25, 16]} />
        <meshStandardMaterial color="#b39159" metalness={.6} roughness={.3} />
      </mesh>
      <mesh position={[0, .82, 0]}>
        <sphereGeometry args={[.09, 24, 16]} />
        <meshStandardMaterial color={signalColor} emissive={signalColor} emissiveIntensity={.8} metalness={.45} roughness={.25} />
      </mesh>
      {[-.09, 0, .09].map(x => <mesh key={x} position={[x, -.43, .37]}>
        <sphereGeometry args={[.023, 8, 6]} />
        <meshStandardMaterial color={signalColor} emissive={signalColor} emissiveIntensity={.1} roughness={.3} />
      </mesh>)}
    </group>
  </>;
}

function RobotViewport() {
  const get = useThree(state => state.get);
  const height = useThree(state => state.size.height);
  useLayoutEffect(() => {
    const { camera, invalidate } = get();
    // The transparent drawing surface extends 36px farther above and below.
    // Compensate for those extra pixels so the avatar keeps its existing size.
    camera.zoom = Math.max(1, height - 72) / Math.max(1, height);
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, height]);
  return null;
}

function subscribeDisplay(callback: () => void) {
  window.addEventListener("resize", callback, { passive: true });
  return () => window.removeEventListener("resize", callback);
}
function displayResolution() {
  // Render sharply at the final CSS size, with modest supersampling on low-density displays.
  return Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 1));
}
const serverResolution = () => 1.5;

export default function CourseCompanion3D(props: Props) {
  const pixelRatio = useSyncExternalStore(subscribeDisplay, displayResolution, serverResolution);
  return <SceneBoundary onReady={props.onReady}>
    <Canvas camera={{ position: [0, .12, 4.6], fov: 34, zoom: 2 / 3 }} dpr={pixelRatio} frameloop="demand"
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      fallback={null}
      onCreated={({ gl }) => {
        props.onReady(true);
        gl.domElement.addEventListener("webglcontextlost", () => props.onReady(false), { once: true });
      }}>
      <RobotViewport />
      <Robot {...props} />
    </Canvas>
  </SceneBoundary>;
}
