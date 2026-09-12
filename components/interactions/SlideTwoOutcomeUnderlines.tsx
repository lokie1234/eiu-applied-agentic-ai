"use client";

const PDF_WIDTH = 960;
const PDF_HEIGHT = 540;

type UnderlineSpec = {
  id: string;
  x: number;
  y: number;
  width: number;
  delay: number;
};

/*
  Page 2 is 960 × 540 pt.
  The coordinates below come from the actual PDF text bounding boxes,
  not from a browser screenshot.

  Text baselines / extents:
  - Tạo Web App bằng Gemini: x 115.20 → 294.90, yMax 171.99
  - Deploy lên Google Apps Script: x 540.00 → 743.31, yMax 171.99
  - Google Sheets làm Database: x 115.20 → 311.03, yMax 243.99
  - Chia sẻ ứng dụng cho cả công ty: x 540.00 → 760.04, yMax 243.99
  - Google Drive lưu trữ file: x 115.20 → 275.21, yMax 315.99
  - Tạo Gems để tái sử dụng: x 540.00 → 710.00, yMax 315.99

  Each underline sits ~7.5 pt below the text to avoid touching glyphs.
*/
const UNDERLINES: UnderlineSpec[] = [
  {
    id: "gemini",
    x: 115.2,
    y: 179.5,
    width: 179.7,
    delay: 0,
  },
  {
    id: "apps-script",
    x: 540,
    y: 179.5,
    width: 203.31,
    delay: 0.14,
  },
  {
    id: "sheets",
    x: 115.2,
    y: 251.5,
    width: 195.825,
    delay: 0.28,
  },
  {
    id: "share",
    x: 540,
    y: 251.5,
    width: 220.035,
    delay: 0.42,
  },
  {
    id: "drive",
    x: 115.2,
    y: 323.5,
    width: 160.005,
    delay: 0.56,
  },
  {
    id: "gems",
    x: 540,
    y: 323.5,
    width: 169.995,
    delay: 0.7,
  },
];

function percent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

export default function SlideTwoOutcomeUnderlines() {
  return (
    <div className="slide-two-outcomes-fx" aria-hidden="true">
      {UNDERLINES.map((line) => (
        <span
          key={line.id}
          className="slide-two-gold-underline"
          style={{
            left: percent(line.x, PDF_WIDTH),
            top: percent(line.y, PDF_HEIGHT),
            width: percent(line.width, PDF_WIDTH),
            animationDelay: `${line.delay}s`,
          }}
        >
          <i
            className="slide-two-underline-spark"
            style={{ animationDelay: `${1.05 + line.delay}s` }}
          />
        </span>
      ))}
    </div>
  );
}
