"use client";

import { useEffect, useState } from "react";
import styles from "./SlideNineArchitecture.module.css";

type ArchitectureItem = {
  id: string;
  title: string;
  number: string;
  description: string;
  examples: string[];
  rect: { x: number; y: number; width: number; height: number };
};

const PDF_WIDTH = 960;
const PDF_HEIGHT = 540;

function rectToPercent(rect: ArchitectureItem["rect"]) {
  return {
    left: `${(rect.x / PDF_WIDTH) * 100}%`,
    top: `${(rect.y / PDF_HEIGHT) * 100}%`,
    width: `${(rect.width / PDF_WIDTH) * 100}%`,
    height: `${(rect.height / PDF_HEIGHT) * 100}%`,
  };
}

/*
  Exact 960 × 540 slide geometry.
  These hotspot rectangles match the four visible cards and do not alter PDF content.
*/
const ITEMS: ArchitectureItem[] = [
  {
    id: "frontend",
    title: "Frontend",
    number: "1",
    description:
      "Là nơi người dùng tương tác - thu thập dữ liệu và hiển thị kết quả.",
    examples: ["Form", "Dashboard", "Báo cáo", "Biểu đồ", "Danh sách"],
    rect: { x: 39.33, y: 196, width: 205.33, height: 160.67 },
  },
  {
    id: "logic",
    title: "Business Logic",
    number: "2",
    description: "Đây là “bộ não” của hệ thống.",
    examples: [
      "Kiểm tra dữ liệu",
      "Tính toán",
      "Quy trình phê duyệt",
      "Gửi Email",
      "Sinh mã đơn",
    ],
    rect: { x: 264.67, y: 196, width: 205.33, height: 160.67 },
  },
  {
    id: "database",
    title: "Database",
    number: "3",
    description: "Lưu toàn bộ dữ liệu của hệ thống.",
    examples: [
      "Nhân viên",
      "Khách hàng",
      "Đơn nghỉ",
      "Phiếu thanh toán",
      "Báo cáo",
    ],
    rect: { x: 490, y: 196, width: 205.33, height: 160.67 },
  },
  {
    id: "integrations",
    title: "Integrations",
    number: "4",
    description: "Kết nối với hệ thống khác để tự động hóa quy trình.",
    examples: [
      "Gmail",
      "Google Drive",
      "Google Calendar",
      "QR Code",
      "Camera",
      "Google Maps",
    ],
    rect: { x: 715.33, y: 196, width: 205.33, height: 160.67 },
  },
];

export default function SlideNineArchitecture() {
  const [active, setActive] = useState<ArchitectureItem | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActive(null);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className={styles.layer} data-interactive="true">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={styles.hotspot}
          aria-label={`Mở ${item.title}`}
          style={rectToPercent(item.rect)}
          onClick={() => setActive(item)}
        >
          <span className={styles.hotspotOutline} />
        </button>
      ))}

      {active && (
        <div
          className={styles.backdrop}
          onMouseDown={() => setActive(null)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={active.title}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.gridPattern} aria-hidden="true" />
            <div className={styles.cornerGlow} aria-hidden="true" />

            <button
              type="button"
              className={styles.close}
              aria-label="Đóng"
              onClick={() => setActive(null)}
            >
              ×
            </button>

            <div className={styles.numberWrap}>
              <div className={styles.number}>{active.number}</div>
              <span className={styles.numberOrbit} aria-hidden="true" />
            </div>

            <div className={styles.copy}>
              <div className={styles.eyebrow}>THÀNH PHẦN PHẦN MỀM</div>
              <h2>{active.title}</h2>
              <p>{active.description}</p>

              <div className={styles.exampleLabel}>VÍ DỤ</div>
              <div className={styles.exampleGrid}>
                {active.examples.map((example) => (
                  <div className={styles.example} key={example}>
                    <span />
                    {example}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.bottomAccent} aria-hidden="true" />
          </section>
        </div>
      )}
    </div>
  );
}
