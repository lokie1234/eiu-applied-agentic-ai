"use client";

const tickerItems = [
  "AI Agents",
  "Multi-step Workflows",
  "Reasoning",
  "Tools",
  "Prompting",
  "Automation",
  "RAG",
  "Orchestration",
  "Business Apps",
  "Integrations",
];

export default function SlideOneAIHero() {
  const repeatedItems = [...tickerItems, ...tickerItems];

  return (
    <div className="slide-one-ai-hero" aria-hidden="true">
      {/* Ambient field: visual only, never duplicates PDF content. */}
      <div className="ai-hero-grid" />
      <div className="ai-hero-scan" />
      <div className="ai-hero-vignette" />

      {/* Focus zone only enhances the existing PDF title. */}
      <div className="ai-title-focus">
        <div className="ai-title-bloom" />
        <div className="ai-title-sweep" />
        <div className="ai-title-spark ai-title-spark-a" />
        <div className="ai-title-spark ai-title-spark-b" />
      </div>

      {/* Animated ring around the existing word “AI” in the PDF title. */}
      <div className="ai-title-ai-orbit">
        <div className="ai-title-ai-ring ai-title-ai-ring-outer" />
        <div className="ai-title-ai-ring ai-title-ai-ring-inner" />
        <div className="ai-title-ai-orbit-rotator">
          <div className="ai-title-ai-dot" />
        </div>
      </div>

      {/* Upward zig-zag AI growth line in the upper-right safe zone. */}
      <svg
        className="ai-growth-arrow"
        viewBox="0 0 520 190"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="aiGrowthGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2d7fb4" stopOpacity="0.22" />
            <stop offset="42%" stopColor="#e9ca8b" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#f4dfb0" stopOpacity="1" />
          </linearGradient>

          <filter id="aiGrowthGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          className="ai-growth-path ai-growth-path-shadow"
          d="M18 158 L94 133 L154 145 L226 103 L286 118 L360 66 L418 80 L492 24"
        />

        <path
          id="aiGrowthMotionPath"
          className="ai-growth-path ai-growth-path-main"
          d="M18 158 L94 133 L154 145 L226 103 L286 118 L360 66 L418 80 L492 24"
          filter="url(#aiGrowthGlow)"
        />

        <g className="ai-growth-nodes">
          <circle cx="94" cy="133" r="4" />
          <circle cx="154" cy="145" r="4" />
          <circle cx="226" cy="103" r="4" />
          <circle cx="286" cy="118" r="4" />
          <circle cx="360" cy="66" r="4" />
          <circle cx="418" cy="80" r="4" />
        </g>

        <circle className="ai-growth-signal" r="5">
          <animateMotion
            dur="3.4s"
            repeatCount="indefinite"
            path="M18 158 L94 133 L154 145 L226 103 L286 118 L360 66 L418 80 L492 24"
          />
        </circle>

        <g className="ai-growth-arrow-head" transform="translate(492 24) rotate(-37)">
          <path d="M0 0 L-22 -11 L-16 0 L-22 11 Z" />
        </g>
      </svg>

      {/* Main Agentic AI orchestration graphic in the empty right side. */}
      <svg
        className="ai-orchestrator"
        viewBox="0 0 520 520"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="aiCoreGradient" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#fff8df" stopOpacity="0.98" />
            <stop offset="30%" stopColor="#e9ca8b" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#b39159" stopOpacity="0.05" />
          </radialGradient>

          <linearGradient id="aiSignalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2d7fb4" stopOpacity="0.08" />
            <stop offset="48%" stopColor="#f4dfb0" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#2d7fb4" stopOpacity="0.08" />
          </linearGradient>

          <filter id="aiCoreGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ai-orbit-shells">
          <circle cx="260" cy="260" r="190" />
          <circle cx="260" cy="260" r="142" />
          <circle cx="260" cy="260" r="94" />
        </g>

        <g className="ai-circuit-arcs">
          <path d="M105 195 C150 88 280 46 376 108" />
          <path d="M395 128 C474 205 459 344 370 410" />
          <path d="M344 427 C234 480 112 414 84 310" />
          <path d="M84 278 C76 245 80 218 91 190" />
        </g>

        <g className="ai-signal-web">
          <path d="M260 260 L164 148 L340 126 L410 258 L330 392 L168 376 Z" />
          <path d="M164 148 L330 392" />
          <path d="M340 126 L168 376" />
          <path d="M410 258 L164 148" />
          <path d="M260 260 L340 126" />
          <path d="M260 260 L410 258" />
          <path d="M260 260 L330 392" />
          <path d="M260 260 L168 376" />
          <path d="M260 260 L164 148" />
        </g>

        <g className="ai-signal-pulses">
          <circle className="ai-pulse ai-pulse-1" r="4">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M260 260 L164 148" />
          </circle>
          <circle className="ai-pulse ai-pulse-2" r="4">
            <animateMotion dur="3.2s" repeatCount="indefinite" path="M164 148 L340 126" />
          </circle>
          <circle className="ai-pulse ai-pulse-3" r="4">
            <animateMotion dur="2.6s" repeatCount="indefinite" path="M340 126 L410 258" />
          </circle>
          <circle className="ai-pulse ai-pulse-4" r="4">
            <animateMotion dur="3.6s" repeatCount="indefinite" path="M410 258 L330 392" />
          </circle>
          <circle className="ai-pulse ai-pulse-5" r="4">
            <animateMotion dur="3.1s" repeatCount="indefinite" path="M330 392 L168 376" />
          </circle>
        </g>

        <g className="ai-agent-nodes">
          <g className="ai-agent-node ai-agent-node-a" transform="translate(164 148)">
            <circle className="ai-agent-halo" r="22" />
            <circle className="ai-agent-dot" r="7" />
          </g>

          <g className="ai-agent-node ai-agent-node-b" transform="translate(340 126)">
            <circle className="ai-agent-halo" r="22" />
            <circle className="ai-agent-dot" r="7" />
          </g>

          <g className="ai-agent-node ai-agent-node-c" transform="translate(410 258)">
            <circle className="ai-agent-halo" r="22" />
            <circle className="ai-agent-dot" r="7" />
          </g>

          <g className="ai-agent-node ai-agent-node-d" transform="translate(330 392)">
            <circle className="ai-agent-halo" r="22" />
            <circle className="ai-agent-dot" r="7" />
          </g>

          <g className="ai-agent-node ai-agent-node-e" transform="translate(168 376)">
            <circle className="ai-agent-halo" r="22" />
            <circle className="ai-agent-dot" r="7" />
          </g>
        </g>

        <g className="ai-core" filter="url(#aiCoreGlow)">
          <circle className="ai-core-wave ai-core-wave-outer" cx="260" cy="260" r="66" />
          <circle className="ai-core-wave ai-core-wave-inner" cx="260" cy="260" r="48" />
          <circle cx="260" cy="260" r="31" fill="url(#aiCoreGradient)" />
          <circle className="ai-core-center" cx="260" cy="260" r="10" />
        </g>

        <g className="ai-orbit-particles">
          <circle className="ai-orbit-particle ai-orbit-particle-1" cx="260" cy="70" r="4" />
          <circle className="ai-orbit-particle ai-orbit-particle-2" cx="450" cy="260" r="3" />
          <circle className="ai-orbit-particle ai-orbit-particle-3" cx="260" cy="450" r="4" />
          <circle className="ai-orbit-particle ai-orbit-particle-4" cx="70" cy="260" r="3" />
        </g>
      </svg>

      {/* Data packets moving across the empty side of the slide. */}
      <div className="ai-data-lane ai-data-lane-1">
        <span />
        <span />
        <span />
      </div>

      <div className="ai-data-lane ai-data-lane-2">
        <span />
        <span />
      </div>

      <div className="ai-data-lane ai-data-lane-3">
        <span />
        <span />
        <span />
      </div>

      {/* Continuous AI marquee in the unused lower space. */}
      <div className="ai-concept-ticker">
        <div className="ai-concept-track">
          {repeatedItems.map((item, index) => (
            <span className="ai-concept-chip" key={`${item}-${index}`}>
              <i />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="ai-ambient-particle ai-ambient-particle-1" />
      <div className="ai-ambient-particle ai-ambient-particle-2" />
      <div className="ai-ambient-particle ai-ambient-particle-3" />
      <div className="ai-ambient-particle ai-ambient-particle-4" />
      <div className="ai-ambient-particle ai-ambient-particle-5" />
      <div className="ai-ambient-particle ai-ambient-particle-6" />
    </div>
  );
}
