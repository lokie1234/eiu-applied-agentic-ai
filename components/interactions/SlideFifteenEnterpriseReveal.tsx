"use client";

import { useState } from "react";

type RevealCard = {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
};

const PDF_WIDTH = 960;
const PDF_HEIGHT = 540;

const ITEMS: RevealCard[] = [
  { id: "leave-form", rect: { x: 342, y: 160, width: 118, height: 38 } },
  { id: "approval", rect: { x: 342, y: 243, width: 198, height: 38 } },
  { id: "sheets", rect: { x: 342, y: 326, width: 126, height: 38 } },
  { id: "gmail-drive", rect: { x: 342, y: 409, width: 170, height: 38 } },
];

function rectToPercent(rect: RevealCard["rect"]) {
  return {
    left: `${(rect.x / PDF_WIDTH) * 100}%`,
    top: `${(rect.y / PDF_HEIGHT) * 100}%`,
    width: `${(rect.width / PDF_WIDTH) * 100}%`,
    height: `${(rect.height / PDF_HEIGHT) * 100}%`,
  };
}

export default function SlideFifteenEnterpriseReveal() {
  const [revealed, setRevealed] = useState<string[]>([]);

  return (
    <div className="reveal-layer" data-interactive="true">
      {ITEMS.map((item, index) => {
        const isRevealed = revealed.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`reveal-mask ${isRevealed ? "is-revealed" : ""}`}
            style={rectToPercent(item.rect)}
            onClick={() => setRevealed((current) => (current.includes(item.id) ? current : [...current, item.id]))}
            aria-label="Hiện nội dung"
          >
            <span className="reveal-mask-shimmer" style={{ animationDelay: `${index * 0.18}s` }} />
            <span className="reveal-mask-label">Bấm để hiện</span>
          </button>
        );
      })}
    </div>
  );
}
