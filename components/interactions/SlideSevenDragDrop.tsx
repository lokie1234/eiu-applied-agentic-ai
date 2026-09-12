"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Stage = {
  id: string;
  label: string;
  tone: "beige" | "navy";
  fixed: boolean;
  area: { x: number; y: number; width: number; height: number };
};

const PDF_WIDTH = 960;
const PDF_HEIGHT = 540;

/*
  Slide 7 real PDF geometry (960 × 540 pt).

  Exact box rectangles extracted from the PDF:
  Row 1:
  - Bài toán kinh doanh: x 50.40 → 243.54, y 172.80 → 244.80
  - Phân tích yêu cầu:  x 272.34 → 465.48, y 172.80 → 244.80
  - Thiết kế:           x 494.28 → 687.42, y 172.80 → 244.80
  - Phát triển:         x 716.22 → 909.36, y 172.80 → 244.80

  Row 2:
  - Kiểm thử:           x 50.40 → 243.54, y 313.20 → 385.20
  - Triển khai:         x 272.34 → 465.48, y 313.20 → 385.20
  - Thu thập phản hồi:  x 494.28 → 687.42, y 313.20 → 385.20
  - Cải tiến:           x 716.22 → 909.36, y 313.20 → 385.20
*/
const STAGES: Stage[] = [
  {
    id: "business",
    label: "Bài toán kinh doanh",
    tone: "beige",
    fixed: true,
    area: { x: 50.4, y: 172.8, width: 193.14, height: 72 },
  },
  {
    id: "analysis",
    label: "Phân tích yêu cầu",
    tone: "beige",
    fixed: false,
    area: { x: 272.34, y: 172.8, width: 193.14, height: 72 },
  },
  {
    id: "design",
    label: "Thiết kế",
    tone: "beige",
    fixed: false,
    area: { x: 494.28, y: 172.8, width: 193.14, height: 72 },
  },
  {
    id: "develop",
    label: "Phát triển",
    tone: "beige",
    fixed: true,
    area: { x: 716.22, y: 172.8, width: 193.14, height: 72 },
  },
  {
    id: "test",
    label: "Kiểm thử",
    tone: "navy",
    fixed: false,
    area: { x: 50.4, y: 313.2, width: 193.14, height: 72 },
  },
  {
    id: "deploy",
    label: "Triển khai",
    tone: "navy",
    fixed: true,
    area: { x: 272.34, y: 313.2, width: 193.14, height: 72 },
  },
  {
    id: "feedback",
    label: "Thu thập phản hồi",
    tone: "navy",
    fixed: false,
    area: { x: 494.28, y: 313.2, width: 193.14, height: 72 },
  },
  {
    id: "improve",
    label: "Cải tiến",
    tone: "navy",
    fixed: true,
    area: { x: 716.22, y: 313.2, width: 193.14, height: 72 },
  },
];

const FILLABLE_IDS = ["feedback", "analysis", "test", "design"];

function toPercent(value: number, total: number) {
  return `${(value / total) * 100}%`;
}

export default function SlideSevenDragDrop() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongTarget, setWrongTarget] = useState<string | null>(null);
  const [successStage, setSuccessStage] = useState<Stage | null>(null);
  const [wrongMessage, setWrongMessage] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  const successTimerRef = useRef<number | null>(null);
  const wrongTimerRef = useRef<number | null>(null);
  const congratsTimerRef = useRef<number | null>(null);

  const fillableStages = useMemo(
    () =>
      FILLABLE_IDS.map((id) => STAGES.find((stage) => stage.id === id)!).filter(
        Boolean
      ),
    []
  );

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
      if (wrongTimerRef.current !== null) {
        window.clearTimeout(wrongTimerRef.current);
      }
      if (congratsTimerRef.current !== null) {
        window.clearTimeout(congratsTimerRef.current);
      }
    };
  }, []);

  function validateDrop(itemId: string, targetId: string) {
    if (!itemId) return;

    if (itemId === targetId) {
      const alreadyDone = completed.includes(targetId);

      if (alreadyDone) {
        setSelected(null);
        return;
      }

      const nextCompleted = [...completed, targetId];
      const stage = STAGES.find((item) => item.id === targetId) ?? null;

      setCompleted(nextCompleted);
      setSelected(null);
      setWrongTarget(null);
      setWrongMessage(false);
      setSuccessStage(stage);

      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = window.setTimeout(() => {
        setSuccessStage(null);
      }, 1200);

      if (nextCompleted.length === FILLABLE_IDS.length) {
        if (congratsTimerRef.current !== null) {
          window.clearTimeout(congratsTimerRef.current);
        }

        // Show "Chính xác" first, then the final congratulations popup.
        congratsTimerRef.current = window.setTimeout(() => {
          setSuccessStage(null);
          setShowCongrats(true);
        }, 850);
      }

      return;
    }

    setSelected(null);
    setWrongTarget(targetId);
    setWrongMessage(true);

    if (wrongTimerRef.current !== null) {
      window.clearTimeout(wrongTimerRef.current);
    }

    wrongTimerRef.current = window.setTimeout(() => {
      setWrongTarget(null);
      setWrongMessage(false);
    }, 850);
  }

  return (
    <div className="dragdrop-layer slide-seven-exact" data-interactive="true">
      {STAGES.filter((stage) => !stage.fixed).map((stage) => {
        const done = completed.includes(stage.id);

        return (
          <button
            type="button"
            key={stage.id}
            className={[
              "dragdrop-target",
              "is-masked",
              `tone-${stage.tone}`,
              done ? "is-complete" : "",
              wrongTarget === stage.id ? "is-wrong" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: toPercent(stage.area.x, PDF_WIDTH),
              top: toPercent(stage.area.y, PDF_HEIGHT),
              width: toPercent(stage.area.width, PDF_WIDTH),
              height: toPercent(stage.area.height, PDF_HEIGHT),
            }}
            aria-label={`Ô ${stage.label}`}
            onDragOver={(event) => {
              if (!done) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();

              if (done) return;

              const itemId = event.dataTransfer.getData("text/plain");
              validateDrop(itemId, stage.id);
            }}
            onClick={() => {
              if (!done && selected) {
                validateDrop(selected, stage.id);
              }
            }}
          >
            {done ? (
              <>
                <span className="dragdrop-target-label">{stage.label}</span>
                <span className="dragdrop-check">✓</span>
              </>
            ) : (
              <>
                <span className="dragdrop-placeholder">Thả vào đây</span>
                <span className="dragdrop-placeholder-line" />
              </>
            )}
          </button>
        );
      })}

      <div className="dragdrop-tray dragdrop-tray-large">
        <div className="dragdrop-tray-label">
          KÉO THẢ NỘI DUNG VÀO ĐÚNG Ô TRỐNG
        </div>

        <div className="dragdrop-chips dragdrop-chips-large">
          {fillableStages.map((stage) => {
            const done = completed.includes(stage.id);

            return (
              <button
                key={stage.id}
                type="button"
                draggable={!done}
                disabled={done}
                className={[
                  "dragdrop-chip",
                  "dragdrop-chip-large",
                  selected === stage.id ? "is-selected" : "",
                  done ? "is-used" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", stage.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setSelected(null)}
                onClick={() => {
                  if (!done) {
                    setSelected((current) =>
                      current === stage.id ? null : stage.id
                    );
                  }
                }}
              >
                {done && <span className="dragdrop-chip-check">✓</span>}
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>

      {successStage && (
        <div className="dragdrop-toast dragdrop-toast-success" role="status">
          <span className="dragdrop-toast-icon">✓</span>
          <div>
            <strong>Chính xác</strong>
            <p>{successStage.label} đã được đặt đúng vị trí.</p>
          </div>
        </div>
      )}

      {wrongMessage && (
        <div className="dragdrop-toast dragdrop-toast-wrong" role="status">
          <span className="dragdrop-toast-icon">!</span>
          <div>
            <strong>Chưa đúng</strong>
            <p>Hãy thử lại một ô khác.</p>
          </div>
        </div>
      )}

      {showCongrats && (
        <div className="dragdrop-congrats-backdrop">
          <div
            className="dragdrop-congrats-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dragdrop-congrats-title"
          >
            <button
              type="button"
              className="dragdrop-congrats-close"
              onClick={() => setShowCongrats(false)}
              aria-label="Đóng"
            >
              ×
            </button>

            <div className="dragdrop-congrats-icon" aria-hidden="true">
              <svg viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="42" />
                <path d="M27 50.5 41.5 65 70 34.5" />
              </svg>
            </div>

            <div className="dragdrop-congrats-kicker">HOÀN THÀNH 4 / 4</div>

            <h2 id="dragdrop-congrats-title">Chúc mừng!</h2>

            <p>
              Bạn đã sắp xếp đúng toàn bộ các giai đoạn còn thiếu trong quy
              trình phát triển phần mềm.
            </p>

            <button
              type="button"
              className="dragdrop-congrats-button"
              onClick={() => setShowCongrats(false)}
            >
              Tuyệt vời
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
