"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import styles from "./LandingExperience.module.css";
import AnimatedHeroCopy from "./landing/AnimatedHeroCopy";
import EntranceBootOverlay from "./landing/EntranceBootOverlay";
import type { IdentityField } from "@/lib/learningIdentity";

import { type RobotInteractionState } from "./landing/GuardianRobot3D";

// ── Lazy-load the WebGL scene to avoid SSR hydration issues ──
const HeroScene = dynamic(() => import("./landing/HeroScene"), {
  ssr: false,
  loading: () => null,
});
// Download the SVG fallback only when reduced motion or a renderer failure needs it.
const EiuAgentBot = dynamic(() => import("./EiuAgentBot"), { ssr: false });

// ═══════════════════════════════════════════════════════════════
// AUTH & INTERACTION STATE
// ═══════════════════════════════════════════════════════════════
export default function LandingPage({ googleResult }: { googleResult?: string } = {}) {
  // ── Auth & Robot state ──
  const [passcode, setPasscode] = useState("");
  const [identityFields, setIdentityFields] = useState<IdentityField[]>([]);
  const [information, setInformation] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(googleResult && googleResult !== "connected" ? googleResult === "wrong-account" ? "Google sign-in is available only for the administrator account." : "Google sign-in did not complete. Please try again." : "");
  const [robotState, setRobotState] = useState<RobotInteractionState>("idle");
  const resetRobotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessRequest = useRef<AbortController | null>(null);
  useEffect(() => () => {
    if (resetRobotTimer.current) clearTimeout(resetRobotTimer.current);
    accessRequest.current?.abort();
  }, []);

  function changePasscode(value: string) {
    if (resetRobotTimer.current) clearTimeout(resetRobotTimer.current);
    setPasscode(value);
    setIdentityFields([]);
    setInformation({});
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || accessRequest.current) return;

    const cleanPasscode = passcode.trim();
    if (!/^[0-9]{6}$/.test(cleanPasscode)) {
      setError("Enter your 6-digit passcode.");
      return;
    }
    if (resetRobotTimer.current) clearTimeout(resetRobotTimer.current);
    const controller = new AbortController();
    accessRequest.current = controller;
    setLoading(true);
    setError("");
    setRobotState("loading");

    try {
      const response = await fetch("/api/auth/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        body: JSON.stringify({ passcode: cleanPasscode, ...(identityFields.length ? { information } : {}) }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string; destination?: string; requiresInformation?: boolean; fields?: IdentityField[] };
      if (controller.signal.aborted) return;
      if (payload.requiresInformation && payload.fields?.length) {
        setIdentityFields(payload.fields);
        setLoading(false);
        setRobotState("idle");
        setError(payload.message || "");
        return;
      }
      if (!response.ok || !payload.success) {
        if (response.status === 401) throw new Error("Wrong passcode");
        throw new Error(payload.message || "Unable to sign in. Please check your passcode.");
      }

      // Xác thực thành công: dạng users hoặc đúng pass admin
      // Kính mặt robo hiện loading.... màu xanh
      window.location.replace("/learn");
    } catch (caught) {
      if (controller.signal.aborted) return;
      setRobotState(caught instanceof Error && caught.message === "Wrong passcode" ? "wrongPasscode" : "restricted");
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please verify your credentials.");
      setLoading(false);
      resetRobotTimer.current = setTimeout(() => setRobotState("idle"), 2800);
    } finally {
      if (accessRequest.current === controller) accessRequest.current = null;
    }
  }
  // ═══════════════════════════════════════════════════════════════
  // END AUTH
  // ═══════════════════════════════════════════════════════════════

  // ── 3D & Cinematic Experience State ──
  const prefersReduced = useReducedMotion();

  const pageRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const sync = () => pageRef.current?.toggleAttribute("data-animation-paused", document.hidden || identityFields.length > 0);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, [identityFields.length]);

  // Mouse tracking via ref for zero per-frame React re-renders
  const mouseRef = useRef({ x: 0, y: 0 });
  const pointerFrame = useRef<number | null>(null);
  const pendingPointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const stop = () => {
      if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = null;
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch" || prefersReduced || document.hidden || !e.currentTarget.contains(e.target as Node)) return;
    const surface = e.currentTarget;
    pendingPointer.current.x = e.clientX;
    pendingPointer.current.y = e.clientY;
    if (pointerFrame.current !== null) return;
    pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = null;
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      mouseRef.current.x = ((pendingPointer.current.x - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((pendingPointer.current.y - rect.top) / rect.height) * 2 + 1;
    });
  }, [prefersReduced]);

  // CTA interaction synchronization
  const [isCtaHovered, setIsCtaHovered] = useState(false);
  const accessHovered = useRef(false);
  const accessFocused = useRef(false);
  function syncAccessAttention() {
    const active = accessHovered.current || accessFocused.current;
    setIsCtaHovered(active);
    setRobotState(previous => {
      if (["loading", "processing", "shakeError", "restricted", "wrongPasscode"].includes(previous)) return previous;
      if (active && previous === "idle") return "lookingAtAccess";
      if (!active && (previous === "lookingAtAccess" || previous === "typing")) return "idle";
      return previous;
    });
  }

  // ── Master Cinematic Timeline (Accelerated internal emergence) ──
  // Only advance stages used by copy, orbit activation and data packets.
  const [stage, setStage] = useState(0);
  const reducedMotionReady = Boolean(prefersReduced && stage > 0);

  useEffect(() => {
    if (prefersReduced) {
      const timer = setTimeout(() => setStage(5), 0);
      return () => clearTimeout(timer);
    }

    const timers = [
      setTimeout(() => setStage(1), 150),
      setTimeout(() => setStage(2), 350),
      setTimeout(() => setStage(4), 950),
      setTimeout(() => setStage(5), 1200),
      setTimeout(() => setStage(7), 1800),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [prefersReduced]);


  // ── Initial Entrance Boot State (Single run per page visit) ──
  const [isEntranceActive, setIsEntranceActive] = useState(true);
  const [isOverlayExiting, setIsOverlayExiting] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const handleSceneUnavailable = useCallback(() => { setSceneUnavailable(true); setSceneReady(true); }, []);

  const handleEntranceComplete = useCallback(() => {
    setIsEntranceActive(false);
  }, []);

  const handleEntranceStartExit = useCallback(() => {
    setIsOverlayExiting(true);
  }, []);

  return (
    <main
      ref={pageRef}
      className={styles.page}
      onPointerMoveCapture={handlePointerMove}
      style={{
        opacity: isOverlayExiting || !isEntranceActive ? 1 : 0.94,
        transform: isOverlayExiting || !isEntranceActive ? "scale(1)" : "scale(0.995)",
        transition: "opacity 0.52s cubic-bezier(0.22, 1, 0.36, 1), transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* ── Temporary Initial Page Entrance Boot Layer (Unmounts permanently upon completion) ── */}
      {isEntranceActive && (
        <EntranceBootOverlay
          onComplete={handleEntranceComplete}
          onStartExit={handleEntranceStartExit}
          prefersReduced={prefersReduced}
          ready={sceneReady || reducedMotionReady}
        />
      )}
      {/* ── Background layers (Atmosphere) ── */}
      <div className={styles.aurora} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.dataLanes} aria-hidden="true"><i /><i /><i /></div>
      <div className={styles.campusOrbit} aria-hidden="true">
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
      </div>

      {/* ── Fullscreen WebGL Hero Scene: Guardian Robot 3D + World Orbits (Unconstrained, Spanning Entire Web Space) ── */}
      {stage > 0 && !reducedMotionReady && !sceneUnavailable && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 2,
            pointerEvents: "auto",
          }}
        >
          <HeroScene
            mouseRef={mouseRef}
            stage={stage}
            robotState={robotState}
            isCtaHovered={isCtaHovered}
            enter={isOverlayExiting || !isEntranceActive}
            paused={identityFields.length > 0}
            onReady={handleSceneReady}
            onUnavailable={handleSceneUnavailable}
          />
        </div>
      )}

      {/* ── Static EIU brand lockup ── */}
      <nav className={styles.nav}>
        <div className={styles.logoWrap}>
          <Image
            src="/branding/EIU-logo-white.png"
            alt="Eastern International University"
            width={2048}
            height={2048}
            preload
            unoptimized
          />
        </div>
      </nav>

      {/* ── Hero layout ── */}
      <section className={styles.hero} style={{ position: "relative", zIndex: 5, pointerEvents: "none" }}>
        {/* Left: Copy side with staggered entrance */}
        <div className={styles.copy}>
          <AnimatedHeroCopy
            stage={stage}
            entranceReady={!isEntranceActive}
            passcode={passcode}
            setPasscode={changePasscode}
              identityFields={identityFields}
              information={information}
              onInformationChange={(id, value) => { setInformation(current => ({ ...current, [id]: value })); setError(""); }}
              onInformationCancel={() => { setIdentityFields([]); setInformation({}); setError(""); }}

            loading={loading}
            error={error}
            onSubmit={submit}
              onMethodChange={() => { accessFocused.current = false; syncAccessAttention(); setError(""); setPasscode(""); setIdentityFields([]); setInformation({}); }}
            onInputFocus={() => {
              accessFocused.current = true;
              syncAccessAttention();
            }}
            onInputBlur={() => {
              accessFocused.current = false;
              syncAccessAttention();
            }}
            onInputChange={() => {
              setRobotState((prev) => (prev === "loading" || prev === "processing" ? prev : "typing"));
            }}
            onCtaHover={(hovered) => {
              accessHovered.current = hovered;
              syncAccessAttention();
            }}
          />
        </div>

        {/* Right: Overlays / HUD / Fallback */}
        <div
          className={styles.machine}
          aria-hidden="true"
        >
          {(reducedMotionReady || sceneUnavailable) && <EiuAgentBot reducedMotion={reducedMotionReady} />}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer} style={{ position: "relative", zIndex: 10, pointerEvents: "auto" }}>
        <span>EASTERN INTERNATIONAL UNIVERSITY</span>
        <span>BUSINESS · TECHNOLOGY · TRANSFORMATION</span>
      </footer>

    </main>
  );
}
