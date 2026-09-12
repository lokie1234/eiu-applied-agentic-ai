"use client";

const PDF_WIDTH = 960;
const PDF_HEIGHT = 540;

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

function boxStyle(x: number, y: number, width: number, height: number) {
  return {
    left: percent(x, PDF_WIDTH),
    top: percent(y, PDF_HEIGHT),
    width: percent(width, PDF_WIDTH),
    height: percent(height, PDF_HEIGHT),
  };
}

export default function SlideThreeNotCoding() {
  return (
    <div className="slide-three-not-coding-fx" aria-hidden="true">
      {/*
        Exact slide geometry from the 960 × 540 PDF render:
        left panel  = x 68,  y 155, w 368, h 324
        right panel = x 450, y 155, w 488, h 324

        Existing PDF content is never redrawn. These layers only enhance it.
      */}

      <div
        className="slide-three-panel-pulse slide-three-panel-pulse-left"
        style={boxStyle(68, 155, 368, 324)}
      />

      <div
        className="slide-three-panel-pulse slide-three-panel-pulse-right"
        style={boxStyle(450, 155, 488, 324)}
      />

      {/* Existing red X: bbox ≈ 257,284 → 373,398. */}
      <div
        className="slide-three-error-focus"
        style={boxStyle(235, 263, 160, 158)}
      >
        <span className="slide-three-error-ring slide-three-error-ring-a" />
        <span className="slide-three-error-ring slide-three-error-ring-b" />
        <span className="slide-three-error-scan" />
      </div>

      {/* Existing green check: bbox ≈ 624,292 → 768,404. */}
      <div
        className="slide-three-success-focus"
        style={boxStyle(596, 264, 202, 168)}
      >
        <span className="slide-three-success-ring slide-three-success-ring-a" />
        <span className="slide-three-success-ring slide-three-success-ring-b" />
        <span className="slide-three-success-orbit">
          <i />
        </span>
      </div>

      {/*
        Transformation stream: a visual metaphor from “manual coding” to
        “designing products with AI”. It stays in the empty lower band and gap.
      */}
      <svg
        className="slide-three-transform-stream"
        viewBox="0 0 960 540"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="slideThreeFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b85a4a" stopOpacity="0.18" />
            <stop offset="45%" stopColor="#b39159" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#2d7fb4" stopOpacity="0.28" />
          </linearGradient>
          <filter id="slideThreeFlowGlow" x="-50%" y="-100%" width="200%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          className="slide-three-flow-track"
          d="M350 439 C430 447 500 447 568 431 C610 421 645 411 678 398"
        />

        <path
          className="slide-three-flow-active"
          d="M350 439 C430 447 500 447 568 431 C610 421 645 411 678 398"
          filter="url(#slideThreeFlowGlow)"
        />

        <circle className="slide-three-flow-particle slide-three-flow-particle-a" r="4">
          <animateMotion
            dur="3.6s"
            repeatCount="indefinite"
            path="M350 439 C430 447 500 447 568 431 C610 421 645 411 678 398"
          />
        </circle>

        <circle className="slide-three-flow-particle slide-three-flow-particle-b" r="3">
          <animateMotion
            dur="3.6s"
            begin="1.2s"
            repeatCount="indefinite"
            path="M350 439 C430 447 500 447 568 431 C610 421 645 411 678 398"
          />
        </circle>

        <circle className="slide-three-flow-particle slide-three-flow-particle-c" r="3.5">
          <animateMotion
            dur="3.6s"
            begin="2.4s"
            repeatCount="indefinite"
            path="M350 439 C430 447 500 447 568 431 C610 421 645 411 678 398"
          />
        </circle>
      </svg>

      {/* Small AI network in a truly empty safe-zone of the right card. */}
      <svg
        className="slide-three-ai-network"
        viewBox="0 0 190 120"
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="slide-three-ai-links">
          <path d="M24 79 L68 42 L104 72 L151 31" />
          <path d="M68 42 L121 98 L151 31" />
          <path d="M24 79 L121 98" />
        </g>
        <g className="slide-three-ai-nodes">
          <circle cx="24" cy="79" r="4" />
          <circle cx="68" cy="42" r="5" />
          <circle cx="104" cy="72" r="4" />
          <circle cx="121" cy="98" r="4" />
          <circle cx="151" cy="31" r="5" />
        </g>
        <circle className="slide-three-ai-signal" r="3.5">
          <animateMotion
            dur="3.2s"
            repeatCount="indefinite"
            path="M24 79 L68 42 L104 72 L151 31"
          />
        </circle>
      </svg>
    </div>
  );
}
