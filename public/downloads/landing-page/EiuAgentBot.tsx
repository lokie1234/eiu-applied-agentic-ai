"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./EiuAgentBot.module.css";

interface Point {
  x: number;
  y: number;
}

// Cubic Catmull-Rom spline interpolation for C1-continuous, perfectly smooth flight
function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

// Tangent derivative of Catmull-Rom spline to calculate automatic aerodynamic banking
function catmullRomTangent(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  return {
    x:
      0.5 *
      (-p0.x +
        p2.x +
        2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t +
        3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2),
    y:
      0.5 *
      (-p0.y +
        p2.y +
        2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t +
        3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2),
  };
}

// Organic easeInOutCubic for graceful acceleration & smooth landing
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

type BotPhase = "flying" | "docked" | "departing";

export default function EiuAgentBot() {
  const containerRef = useRef<HTMLElement | null>(null);
  const botRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<BotPhase>("flying");
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; tx: string; ty: string; color: string }>>([]);

  const phaseRef = useRef<BotPhase>("flying");

  const animFrameRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const departTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to retrieve exact button coordinates relative to container
  // Positioned strictly BELOW the Access courses button (zero text overlap & no button overlap)
  const getButtonLandingPoint = (): Point => {
    if (typeof window === "undefined" || !containerRef.current) {
      return { x: 120, y: 520 };
    }

    const contRect = containerRef.current.getBoundingClientRect();
    const btn = document.getElementById("landing-access-button");

    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      const btnLeft = btnRect.left - contRect.left;
      const btnTop = btnRect.top - contRect.top;
      const btnHeight = btnRect.height || 72;

      // Positioned strictly BELOW the button:
      // Air gap of 8px beneath the button's bottom edge (no text overlap above, no button overlap)
      return {
        x: Math.round(btnLeft + 24),
        y: Math.round(btnTop + btnHeight + 8),
      };
    }

    return { x: 120, y: 520 };
  };

  // Click interaction: opens course access modal directly
  const handleBotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const btn = document.getElementById("landing-access-button");
    if (btn) {
      btn.click();
    }

    // Celebration burst
    const burst = Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 32 + Math.random() * 24;
      return {
        id: Date.now() + i,
        x: 58,
        y: 66,
        tx: `${Math.cos(angle) * dist}px`,
        ty: `${Math.sin(angle) * dist}px`,
        color: i % 2 === 0 ? "#e9ca8b" : "#64a8d3",
      };
    });
    setSparkles(burst);
    setTimeout(() => setSparkles([]), 650);
  };

  // Run recurring flight loop:
  // Starts near "Build systems that think and move" (KHÔNG ĐÈ CHỮ),
  // loops around Machine layout (Input -> Process -> AI Core -> Output),
  // stops at Access courses button with "Click here" text (KHÔNG ĐÈ NÚT),
  // pauses for ~3.8s, then departs to start a brand new flight loop!
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    let isCancelled = false;

    const startFlight = () => {
      if (isCancelled || !containerRef.current || !botRef.current) return;

      setPhase("flying");
      phaseRef.current = "flying";

      const contRect = containerRef.current.getBoundingClientRect();
      const W = contRect.width;
      const H = contRect.height;
      const landing = getButtonLandingPoint();

      const controlPoints: Point[] = [
        { x: Math.round(W * 0.08), y: Math.round(H * 0.065) }, // P0: Sky above "Build systems that..." (Safe, no text overlap!)
        { x: Math.round(W * 0.34), y: Math.round(H * 0.055) }, // P1: Cruising top sky
        { x: Math.round(W * 0.58), y: Math.round(H * 0.16) },  // P2: Entering Image 1 over INPUT card
        { x: Math.round(W * 0.82), y: Math.round(H * 0.14) },  // P3: Over PROCESS card
        { x: Math.round(W * 0.88), y: Math.round(H * 0.52) },  // P4: Orbiting AI Core down past OUTPUT card
        { x: Math.round(W * 0.74), y: Math.round(H * 0.78) },  // P5: Under OUTPUT card on bottom orbit
        { x: Math.round(W * 0.46), y: Math.round(H * 0.82) },  // P6: Sweeping bottom telemetry lane
        landing,                                               // P7: Final destination atop Access button!
      ];

      const numPoints = controlPoints.length;
      const FLIGHT_DURATION = 8800; // 8.8s smooth aerodynamic flight
      let startTime: number | null = null;

      // Reset styles for flight entry
      if (botRef.current) {
        botRef.current.style.transition = "opacity 0.4s ease-in";
        botRef.current.style.opacity = "1";
      }

      const animate = (timestamp: number) => {
        if (isCancelled) return;
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const rawProgress = Math.min(1, elapsed / FLIGHT_DURATION);
        const progress = easeInOutCubic(rawProgress);

        if (progress < 1) {
          // Calculate position on Catmull-Rom spline
          const totalSegments = numPoints - 1;
          const scaledProgress = progress * totalSegments;
          const segmentIdx = Math.min(totalSegments - 1, Math.floor(scaledProgress));
          const segmentT = scaledProgress - segmentIdx;

          const p0 = controlPoints[Math.max(0, segmentIdx - 1)];
          const p1 = controlPoints[segmentIdx];
          const p2 = controlPoints[Math.min(numPoints - 1, segmentIdx + 1)];
          const p3 = controlPoints[Math.min(numPoints - 1, segmentIdx + 2)];

          const pos = catmullRom(p0, p1, p2, p3, segmentT);
          const tangent = catmullRomTangent(p0, p1, p2, p3, segmentT);

          // Banking tilt
          const angleRad = Math.atan2(tangent.y, tangent.x);
          const bankDeg = Math.max(-20, Math.min(20, (angleRad * 180) / Math.PI * 0.42));
          const isHeadingLeft = tangent.x < -0.15;
          const flipScale = isHeadingLeft ? -1 : 1;

          if (botRef.current) {
            botRef.current.style.transition = "none";
            botRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scaleX(${flipScale}) rotate(${bankDeg * flipScale}deg)`;
          }

          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // -------------------------------------------------------------------
          // DOCKED AT ACCESS COURSES BUTTON: Stop, upright, show "Click here" text
          // -------------------------------------------------------------------
          setPhase("docked");
          phaseRef.current = "docked";

          const finalLanding = getButtonLandingPoint();
          if (botRef.current) {
            botRef.current.style.transition = "transform 0.3s ease-out";
            botRef.current.style.transform = `translate3d(${finalLanding.x}px, ${finalLanding.y}px, 0) scaleX(1) rotate(0deg)`;
          }

          // Dừng 1 xíu (3.8 seconds pause) before departing for the next flight loop
          pauseTimerRef.current = setTimeout(() => {
            if (isCancelled) return;

            // Departing phase: lift off & fade out
            setPhase("departing");
            phaseRef.current = "departing";

            if (botRef.current) {
              botRef.current.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease-out";
              botRef.current.style.transform = `translate3d(${finalLanding.x - 16}px, ${finalLanding.y + 24}px, 0) scale(0.92)`;
              botRef.current.style.opacity = "0";
            }

            departTimerRef.current = setTimeout(() => {
              if (isCancelled) return;
              // Sang vòng lặp mới!
              startFlight();
            }, 550);
          }, 3800);
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    };

    startFlight();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      if (departTimerRef.current) clearTimeout(departTimerRef.current);
    };
  }, []);

  // Window resize handler: maintains exact docking position below button
  useEffect(() => {
    const handleResize = () => {
      if (phaseRef.current === "docked" && botRef.current) {
        const landing = getButtonLandingPoint();
        botRef.current.style.transform = `translate3d(${landing.x}px, ${landing.y}px, 0) scaleX(1) rotate(0deg)`;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <aside ref={containerRef} className={styles.botContainer} aria-hidden="true">
      {/* ===================================================================
          PIGGYBACK DUO: BIG GUARDIAN BOT CARRYING CHIBI SCOUT BOT
          Unified in 1 animation unit ("robo to cõng robo nhỏ dính nhau")
          =================================================================== */}
      <div
        ref={botRef}
        className={`${styles.botWrapper} ${phase === "docked" ? styles.docked : ""}`}
        onClick={handleBotClick}
        title="EIU AI Guardian & Scout Duo (Click to access courses!)"
      >
        {/* "Click here" Speech Bubble / Tooltip (Strictly BELOW Access courses button, zero text overlap) */}
        {phase === "docked" && (
          <div
            className={styles.clickHereBubble}
            onClick={handleBotClick}
            role="button"
            tabIndex={0}
            aria-label="Click here to access courses"
          >
            <span className={styles.pulseRadar} />
            <span className={styles.clickHereText}>Click here</span>
            <svg className={styles.upArrowIcon} viewBox="0 0 14 14" fill="none">
              <path d="M7 12V4M7 4L3.5 7.5M7 4L10.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Click Burst Confetti */}
        {sparkles.map((s) => (
          <div
            key={s.id}
            className={styles.clickSparkle}
            style={
              {
                left: s.x,
                top: s.y,
                "--tx": s.tx,
                "--ty": s.ty,
                backgroundColor: s.color,
                boxShadow: `0 0 10px ${s.color}`,
              } as React.CSSProperties
            }
          />
        ))}

        <div className={styles.botVisualBody}>
          <svg className={styles.robotGraphic} viewBox="0 0 120 136" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Metallic Titanium Navy Armor Gradient */}
              <linearGradient id="bigArmorPlate" x1="0" y1="0" x2="0" y2="100%">
                <stop offset="0%" stopColor="#104470" />
                <stop offset="35%" stopColor="#082945" />
                <stop offset="100%" stopColor="#031625" />
              </linearGradient>

              {/* Polished Metallic EIU Gold Bevel Gradient */}
              <linearGradient id="bigGoldBevel" x1="0" y1="0" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#fff1cf" />
                <stop offset="55%" stopColor="#e9ca8b" />
                <stop offset="85%" stopColor="#c89e50" />
                <stop offset="100%" stopColor="#7a5820" />
              </linearGradient>

              {/* Visor Deep Curved 3D Glass */}
              <linearGradient id="bigVisorGlass" x1="0" y1="0" x2="0" y2="100%">
                <stop offset="0%" stopColor="#0d3556" />
                <stop offset="30%" stopColor="#041624" />
                <stop offset="100%" stopColor="#020b12" />
              </linearGradient>

              {/* Chibi Armor Gradient */}
              <linearGradient id="chibiArmor" x1="0" y1="0" x2="0" y2="100%">
                <stop offset="0%" stopColor="#124f80" />
                <stop offset="60%" stopColor="#093154" />
                <stop offset="100%" stopColor="#041c30" />
              </linearGradient>

              {/* Plasma Jet Flame */}
              <linearGradient id="bigPlasmaFlame" x1="0" y1="0" x2="0" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#fff2cf" />
                <stop offset="50%" stopColor="#e9ca8b" />
                <stop offset="75%" stopColor="#64a8d3" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>

            {/* -------------------------------------------------------------
                1. BIG ROBOT ("Atlas") - LOWER & MAIN CHASSIS
                ------------------------------------------------------------- */}

            {/* Plasma Thruster Exhaust Flames (Active during flight & departing) */}
            {phase !== "docked" && (
              <g className={styles.thrusterFlame}>
                <path d="M46 114 Q43 130 46 136 Q49 130 52 114 Z" fill="url(#bigPlasmaFlame)" />
                <path d="M68 114 Q65 130 68 136 Q71 130 74 114 Z" fill="url(#bigPlasmaFlame)" />
              </g>
            )}

            {/* Heavy-Duty Jetpack Chassis */}
            <rect x="40" y="70" width="40" height="38" rx="8" fill="#041c31" stroke="url(#bigGoldBevel)" strokeWidth="1.6" />
            <circle cx="46" cy="110" r="5" fill="#0d3a60" stroke="#64a8d3" strokeWidth="1.2" />
            <circle cx="74" cy="110" r="5" fill="#0d3a60" stroke="#64a8d3" strokeWidth="1.2" />

            {/* Big Robot Legs - Solid & Proportional */}
            <g className={styles.leftLeg}>
              <rect x="41" y="100" width="10" height="22" rx="5" fill="url(#bigArmorPlate)" stroke="#64a8d3" strokeWidth="1.4" />
              <path d="M38 120 L54 120 L54 126 L36 126 Z" fill="url(#bigGoldBevel)" />
            </g>
            <g className={styles.rightLeg}>
              <rect x="69" y="100" width="10" height="22" rx="5" fill="url(#bigArmorPlate)" stroke="#64a8d3" strokeWidth="1.4" />
              <path d="M66 120 L82 120 L82 126 L64 126 Z" fill="url(#bigGoldBevel)" />
            </g>

            {/* Main Torso Chassis */}
            <rect x="34" y="64" width="52" height="42" rx="12" fill="url(#bigArmorPlate)" stroke="url(#bigGoldBevel)" strokeWidth="2" />

            {/* Recessed Chest Shield for EIU Logo */}
            <rect x="39" y="68" width="42" height="24" rx="6" fill="#041624" stroke="rgba(233,202,139,0.7)" strokeWidth="1.3" />

            {/* Authentic EIU Logo Badge on Chest */}
            <image
              href="/branding/EIU-logo-white.png"
              x="42"
              y="70"
              width="36"
              height="20"
              preserveAspectRatio="xMidYMid meet"
            />

            {/* Corner Decorative Golden Brackets on Chest */}
            <path d="M39 72 L39 68 L43 68" stroke="url(#bigGoldBevel)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M81 72 L81 68 L77 68" stroke="url(#bigGoldBevel)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M39 88 L39 92 L43 92" stroke="url(#bigGoldBevel)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M81 88 L81 92 L77 92" stroke="url(#bigGoldBevel)" strokeWidth="1.6" strokeLinecap="round" />

            {/* Micro Fusion Reactor Core */}
            <circle cx="60" cy="97" r="5" fill="#041624" stroke="#64a8d3" strokeWidth="1.4" />
            <circle cx="60" cy="97" r="2.8" fill="#69c5a3">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite" />
            </circle>

            {/* Big Robot Arms - Normal Proportions (NO long stretched arms) */}
            <g className={styles.leftArm}>
              <rect x="21" y="67" width="10" height="26" rx="5" fill="url(#bigArmorPlate)" stroke="url(#bigGoldBevel)" strokeWidth="1.4" />
              <circle cx="26" cy="95" r="4.5" fill="#64a8d3" />
            </g>
            <g className={styles.rightArm}>
              <rect x="89" y="67" width="10" height="26" rx="5" fill="url(#bigArmorPlate)" stroke="url(#bigGoldBevel)" strokeWidth="1.4" />
              <circle cx="94" cy="95" r="4.5" fill="#64a8d3" />
            </g>

            {/* Big Robot Head & Helmet Group */}
            <g className={styles.robotHead}>
              {/* Antenna Mast */}
              <line x1="60" y1="30" x2="60" y2="14" stroke="url(#bigGoldBevel)" strokeWidth="2.5" strokeLinecap="round" />
              <circle className={styles.antennaOrb} cx="60" cy="13" r="5" fill="#e9ca8b" />

              {/* Ear Fins */}
              <path d="M25 40 L29 34 L29 50 Z" fill="url(#bigGoldBevel)" />
              <path d="M95 40 L91 34 L91 50 Z" fill="url(#bigGoldBevel)" />

              {/* Helmet Shell */}
              <rect x="28" y="30" width="64" height="38" rx="14" fill="url(#bigArmorPlate)" stroke="url(#bigGoldBevel)" strokeWidth="2" />

              {/* Crown Ridge */}
              <path d="M52 34 L68 34" stroke="url(#bigGoldBevel)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M55 36 L65 36" stroke="#64a8d3" strokeWidth="1.2" strokeLinecap="round" />

              {/* Curved 3D Digital Visor Screen */}
              <rect x="34" y="38" width="52" height="26" rx="9" fill="url(#bigVisorGlass)" stroke="#64a8d3" strokeWidth="1.4" />
              <path d="M38 42 Q60 39 82 42" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" fill="none" />

              {/* Visor Eyes: Happy curves ^ ^ when docked at button, bright LEDs in flight */}
              {phase === "docked" ? (
                <g stroke="#69c5a3" strokeWidth="2.8" strokeLinecap="round" fill="none">
                  <path d="M42 52 Q47 45 52 52" />
                  <path d="M68 52 Q73 45 78 52" />
                </g>
              ) : (
                <g fill="#64a8d3">
                  <circle cx="47" cy="51" r="4.5" />
                  <circle cx="73" cy="51" r="4.5" />
                  <circle cx="48.5" cy="49.5" r="1.8" fill="#fff" />
                  <circle cx="74.5" cy="49.5" r="1.8" fill="#fff" />
                </g>
              )}

              {/* Cheeks when docked */}
              {phase === "docked" && (
                <g fill="#e9ca8b" opacity="0.85">
                  <circle cx="40" cy="57" r="2.2" />
                  <circle cx="80" cy="57" r="2.2" />
                </g>
              )}
            </g>

            {/* -------------------------------------------------------------
                2. CHIBI SCOUT ROBOT ("Spark") PIGGYBACKING ON BIG ROBOT'S SHOULDER
                Firmly riding on Big Robot's right shoulder/collar ("dính nhau 1 animation")
                ------------------------------------------------------------- */}
            <g className={styles.chibiRider}>
              {/* Chibi Little Boots resting against Big Robot's shoulder/pack */}
              <rect x="80" y="52" width="6" height="8" rx="3" fill="#082945" stroke="url(#bigGoldBevel)" strokeWidth="1" />
              <rect x="90" y="52" width="6" height="8" rx="3" fill="#082945" stroke="url(#bigGoldBevel)" strokeWidth="1" />

              {/* Chibi Cute Pear-shaped Torso */}
              <rect x="76" y="36" width="24" height="18" rx="8" fill="url(#chibiArmor)" stroke="url(#bigGoldBevel)" strokeWidth="1.4" />

              {/* Chibi Mini EIU Chest Badge */}
              <rect x="80" y="40" width="16" height="10" rx="3" fill="#041624" stroke="rgba(233,202,139,0.5)" strokeWidth="0.8" />
              <image
                href="/branding/EIU-logo-white.png"
                x="81"
                y="41"
                width="14"
                height="8"
                preserveAspectRatio="xMidYMid meet"
              />

              {/* Chibi Left Arm holding tightly onto Big Robot's collar */}
              <path d="M76 40 C70 42 68 48 74 52" stroke="url(#bigGoldBevel)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <circle cx="74" cy="52" r="2.6" fill="#64a8d3" stroke="url(#bigGoldBevel)" strokeWidth="0.8" />

              {/* Chibi Right Arm: Cheerfully waving forward! */}
              <g className={styles.chibiWavingArm}>
                <path d="M100 40 C106 38 110 32 106 26" stroke="url(#bigGoldBevel)" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <circle cx="106" cy="26" r="2.6" fill="#64a8d3" stroke="url(#bigGoldBevel)" strokeWidth="0.8" />
              </g>

              {/* Chibi Spring Antenna */}
              <path d="M88 18 Q90 14 88 10 Q86 7 88 5" stroke="url(#bigGoldBevel)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
              <circle className={styles.chibiAntennaOrb} cx="88" cy="5" r="2.8" fill="#64a8d3" />

              {/* Chibi Round Helmet */}
              <rect x="71" y="14" width="34" height="24" rx="11" fill="url(#chibiArmor)" stroke="url(#bigGoldBevel)" strokeWidth="1.6" />

              {/* Chibi Glossy Visor Screen */}
              <rect x="74" y="17" width="28" height="17" rx="8" fill="#031625" stroke="#64a8d3" strokeWidth="1.2" />
              <path d="M77 20 Q88 17 99 20" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" fill="none" />

              {/* Chibi Visor Eyes: Happy curves ^ ^ always joyful! */}
              <g stroke="#69c5a3" strokeWidth="2.2" strokeLinecap="round" fill="none">
                <path d="M79 26 Q82 21 85 26" />
                <path d="M91 26 Q94 21 97 26" />
              </g>

              {/* Chibi Rosy cheeks */}
              <circle cx="76" cy="28" r="1.5" fill="#e9ca8b" opacity="0.85" />
              <circle cx="99" cy="28" r="1.5" fill="#e9ca8b" opacity="0.85" />
            </g>
          </svg>
        </div>
      </div>
    </aside>
  );
}
