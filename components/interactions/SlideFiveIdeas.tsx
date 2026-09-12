"use client";

import { useEffect, useState } from "react";

/*
  Slide 5 is 960 x 540 pt in the source PDF.
  All hotspots below are defined from the REAL PDF drawing rectangles,
  then converted to percentages at render time.

  This keeps the interaction layer aligned with the PDF at any responsive size.
*/

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Idea = {
  id: string;
  title: string;
  rect: PdfRect;
  steps: string[];
};

function rectToPercent(rect: PdfRect) {
  return {
    left: `${(rect.x / SLIDE_WIDTH) * 100}%`,
    top: `${(rect.y / SLIDE_HEIGHT) * 100}%`,
    width: `${(rect.width / SLIDE_WIDTH) * 100}%`,
    height: `${(rect.height / SLIDE_HEIGHT) * 100}%`,
  };
}

const IDEAS: Idea[] = [
  {
    id: "leave",
    title: "Xin nghỉ phép",
    rect: {
      x: 73.44,
      y: 154.8,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Đơn xin nghỉ",
      "Quản lý duyệt",
      "HR xác nhận",
      "Dashboard / Cập nhật quỹ phép",
    ],
  },
  {
    id: "incident",
    title: "Báo cáo sự cố",
    rect: {
      x: 365.04,
      y: 154.8,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Tạo báo cáo sự cố",
      "Giao người xử lý",
      "Nghiệm thu khắc phục",
      "Dashboard / Báo cáo sự cố",
    ],
  },
  {
    id: "vehicle",
    title: "Đặt xe",
    rect: {
      x: 656.64,
      y: 154.8,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Phiếu yêu cầu đặt xe",
      "Đội xe điều phối",
      "Quản lý duyệt",
      "Dashboard / Báo cáo lịch trình",
    ],
  },
  {
    id: "attendance",
    title: "Quản lý chấm công",
    rect: {
      x: 73.44,
      y: 252,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Dữ liệu chấm công",
      "Gửi giải trình (nếu có)",
      "Quản lý chốt công",
      "Bảng công tổng hợp",
    ],
  },
  {
    id: "content",
    title: "Phê duyệt nội dung",
    rect: {
      x: 365.04,
      y: 252,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Tạo bản nháp nội dung",
      "Biên tập viên kiểm duyệt",
      "Trưởng phòng phê duyệt",
      "Dashboard / Lịch xuất bản",
    ],
  },
  {
    id: "probation",
    title: "Đánh giá thử việc",
    rect: {
      x: 656.64,
      y: 252,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Phiếu tự đánh giá",
      "Quản lý nhận xét",
      "HR & Ban Giám đốc duyệt",
      "Quyết định chính thức",
    ],
  },
  {
    id: "work",
    title: "Theo dõi công việc",
    rect: {
      x: 73.44,
      y: 349.2,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Khởi tạo & Giao việc",
      "Cập nhật tiến độ",
      "Quản lý nghiệm thu",
      "Dashboard / Báo cáo hiệu suất",
    ],
  },
  {
    id: "results",
    title: "Báo cáo kết quả",
    rect: {
      x: 365.04,
      y: 349.2,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Nhập kết quả công việc",
      "Quản lý thẩm định",
      "Duyệt báo cáo",
      "Dashboard / Tổng hợp KPI",
    ],
  },
  {
    id: "course",
    title: "Đăng ký môn học",
    rect: {
      x: 656.64,
      y: 349.2,
      width: 266.4,
      height: 72,
    },
    steps: [
      "Phiếu đăng ký môn",
      "Kiểm tra điều kiện tiên quyết",
      "Phòng đào tạo xác nhận",
      "Thời khóa biểu cá nhân",
    ],
  },
];

export default function SlideFiveIdeas() {
  const [active, setActive] = useState<Idea | null>(null);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActive(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="ideas-interaction-layer" data-interactive="true">
      {IDEAS.map((idea) => (
        <button
          key={idea.id}
          type="button"
          className="ideas-hotspot"
          aria-label={`Mở quy trình ${idea.title}`}
          style={rectToPercent(idea.rect)}
          onClick={() => setActive(idea)}
        >
          <span className="ideas-hotspot-glow" />
        </button>
      ))}

      {active && (
        <div
          className="ideas-modal-backdrop"
          onMouseDown={() => setActive(null)}
        >
          <section
            className="ideas-modal"
            role="dialog"
            aria-modal="true"
            aria-label={active.title}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="ideas-modal-close"
              aria-label="Đóng"
              onClick={() => setActive(null)}
            >
              ×
            </button>

            <div className="ideas-modal-eyebrow">QUY TRÌNH GỢI Ý</div>
            <h2>{active.title}</h2>

            <div className="ideas-workflow-grid">
              {active.steps.map((step, index) => (
                <div className="ideas-workflow-step" key={step}>
                  <div className="ideas-workflow-node">
                    <span className="ideas-workflow-dot" />
                    <strong>{step}</strong>
                  </div>

                  {index < active.steps.length - 1 && (
                    <span className="ideas-workflow-arrow">→</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
