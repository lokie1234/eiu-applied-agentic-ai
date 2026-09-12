"use client";

const PDF_WIDTH = 960;
const PDF_HEIGHT = 540;

type MarkSpec = {
  id: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  variant: "gold" | "navy" | "outline";
  rotate: number;
};

/*
  Page 4 real PDF size: 960 × 540 pt.
  Subtitle block “Bạn muốn AI làm việc gì?” occupies:
  x = 322.27 → 637.34
  y = 307.32 → 331.71

  The animated question marks are intentionally placed BELOW that block,
  starting from y ≈ 345 pt so they never touch the subtitle line.
*/
const MARKS: MarkSpec[] = [
  { id: "q1", x: 110, y: 360, size: 58, delay: 0.0, duration: 5.8, variant: "outline", rotate: -8 },
  { id: "q2", x: 210, y: 420, size: 76, delay: 0.35, duration: 6.6, variant: "gold", rotate: -4 },
  { id: "q3", x: 330, y: 372, size: 68, delay: 0.7, duration: 6.1, variant: "navy", rotate: 5 },
  { id: "q4", x: 445, y: 434, size: 92, delay: 0.15, duration: 7.2, variant: "gold", rotate: 0 },
  { id: "q5", x: 575, y: 374, size: 64, delay: 0.55, duration: 5.9, variant: "outline", rotate: -6 },
  { id: "q6", x: 690, y: 426, size: 84, delay: 0.9, duration: 6.8, variant: "navy", rotate: 6 },
  { id: "q7", x: 810, y: 362, size: 56, delay: 0.25, duration: 5.6, variant: "gold", rotate: 8 },
  { id: "q8", x: 835, y: 458, size: 48, delay: 1.0, duration: 5.2, variant: "outline", rotate: -9 },
];

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

export default function SlideFourQuestionMarks() {
  return (
    <div className="slide-four-question-fx" aria-hidden="true">
      <div className="slide-four-question-sweep" />
      <div className="slide-four-question-dots" />

      {MARKS.map((mark) => (
        <span
          key={mark.id}
          className={`slide-four-question-mark is-${mark.variant}`}
          style={{
            left: percent(mark.x, PDF_WIDTH),
            top: percent(mark.y, PDF_HEIGHT),
            fontSize: `${mark.size}px`,
            animationDelay: `${mark.delay}s`,
            animationDuration: `${mark.duration}s`,
            rotate: `${mark.rotate}deg`,
          }}
        >
          ?
          <i className="question-mark-glow" />
        </span>
      ))}
    </div>
  );
}
