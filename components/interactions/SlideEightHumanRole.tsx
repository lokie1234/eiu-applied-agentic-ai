"use client";

type Bullet = {
  id: string;
  tone: "left" | "right";
  bulletX: number;
  bulletY: number;
  lineX: number;
  lineY: number;
  lineWidth: number;
};

const PDF_WIDTH = 960;
const PDF_HEIGHT = 540;

const BULLETS: Bullet[] = [
  { id: "role-1", tone: "left", bulletX: 75.91, bulletY: 210.665, lineX: 94, lineY: 227, lineWidth: 128 },
  { id: "role-2", tone: "right", bulletX: 504.31, bulletY: 210.665, lineX: 523, lineY: 227, lineWidth: 78 },
  { id: "role-3", tone: "left", bulletX: 75.91, bulletY: 279.065, lineX: 94, lineY: 295, lineWidth: 120 },
  { id: "role-4", tone: "right", bulletX: 504.31, bulletY: 279.065, lineX: 523, lineY: 295, lineWidth: 118 },
];

function pxPercent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

export default function SlideEightHumanRole() {
  return (
    <div className="slide-eight-human-role" aria-hidden="true">
      <div className="human-role-soft-glow human-role-soft-glow-a" />
      <div className="human-role-soft-glow human-role-soft-glow-b" />
      <div className="human-role-bridge" />
      <div className="human-role-scan" />

      <svg className="human-role-connector" viewBox="0 0 960 540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="humanRoleLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e9ca8b" stopOpacity="0" />
            <stop offset="20%" stopColor="#e9ca8b" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#2d7fb4" stopOpacity="0.35" />
            <stop offset="80%" stopColor="#e9ca8b" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e9ca8b" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          className="human-role-connector-line"
          d="M244 212 C332 175, 432 176, 515 210 C594 242, 646 245, 710 214"
        />

        <circle className="human-role-connector-dot" r="4">
          <animateMotion dur="4.8s" repeatCount="indefinite" path="M244 212 C332 175, 432 176, 515 210 C594 242, 646 245, 710 214" />
        </circle>
        <circle className="human-role-connector-dot is-secondary" r="3.5">
          <animateMotion dur="5.6s" repeatCount="indefinite" path="M710 282 C645 255, 565 247, 484 278 C404 309, 328 311, 242 280" />
        </circle>
        <path
          className="human-role-connector-line is-secondary"
          d="M710 282 C645 255, 565 247, 484 278 C404 309, 328 311, 242 280"
        />
      </svg>

      {BULLETS.map((item, index) => (
        <div key={item.id} className={`human-role-node human-role-node-${index + 1} tone-${item.tone}`}>
          <span
            className="human-role-ping"
            style={{ left: pxPercent(item.bulletX, PDF_WIDTH), top: pxPercent(item.bulletY, PDF_HEIGHT) }}
          />
          <span
            className="human-role-bullet-core"
            style={{ left: pxPercent(item.bulletX, PDF_WIDTH), top: pxPercent(item.bulletY, PDF_HEIGHT) }}
          />
          <span
            className="human-role-underline"
            style={{
              left: pxPercent(item.lineX, PDF_WIDTH),
              top: pxPercent(item.lineY, PDF_HEIGHT),
              width: pxPercent(item.lineWidth, PDF_WIDTH),
            }}
          />
        </div>
      ))}
    </div>
  );
}
