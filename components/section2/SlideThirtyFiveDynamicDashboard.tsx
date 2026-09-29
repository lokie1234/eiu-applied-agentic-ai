"use client";

import { useState } from "react";
import styles from "./SlideThirtyFiveDynamicDashboard.module.css";

const CONFIG_URL = "/downloads/CONFIG_Dynamic_Sheet_Dashboard_Architect_v3.txt";
const KNOWLEDGE_URL = "/downloads/KNOWLEDGE_Dynamic_Sheet_Dashboard_v3.txt";

const CAPABILITY_GROUPS = [
  {
    number: "01",
    label: "ĐỌC & HIỂU CẤU TRÚC",
    title: "Schema-first",
    items: [
      "Chỉ scan khoảng 10 dòng đầu; file 1.000–5.000+ dòng vẫn xử lý tốt.",
      "Nhận diện header 1 tầng, nhiều tầng và cả header gộp.",
      "Tự phân loại cột: ngày, số, text, category, mã, Họ tên…",
      "Tự loại STT/Số thứ tự khỏi biểu đồ và KPI.",
    ],
  },
  {
    number: "02",
    label: "PHỎNG VẤN & SINH APP",
    title: "Interview-before-code",
    items: [
      "Hỏi từng cột dùng Search, Dropdown hay Không filter trước khi sinh code.",
      "Filter động, đồng bộ KPI, biểu đồ và bảng dữ liệu.",
      "Tự nhận diện cột mới khi cấu trúc Google Sheet thay đổi.",
    ],
  },
  {
    number: "03",
    label: "VẬN HÀNH ỔN ĐỊNH",
    title: "Dynamic & safe",
    items: [
      "Hỗ trợ phân trang cho dữ liệu vài nghìn dòng.",
      "Xuất CSV/Excel toàn bộ hoặc theo dữ liệu đã filter.",
      "Xử lý ngày an toàn, tránh lỗi Date/timeZone.",
      "Google Sheet ở chế độ read-only mặc định, không tự sửa dữ liệu nguồn.",
    ],
  },
] as const;

type CopyField = "name" | "description" | "instructions";
type CopyState = CopyField | "error" | null;

function extractConfigField(config: string, field: CopyField) {
  const normalized = config.replace(/\r\n/g, "\n");
  const patterns: Record<CopyField, RegExp> = {
    name: /^NAME\s*\n([\s\S]*?)(?=\n\s*DESCRIPTION\s*\n)/m,
    description: /^DESCRIPTION\s*\n([\s\S]*?)(?=\n\s*INSTRUCTIONS\s*\n)/m,
    instructions: /^INSTRUCTIONS\s*\n([\s\S]*)$/m,
  };
  return normalized.match(patterns[field])?.[1].trim() ?? "";
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function SlideThirtyFiveDynamicDashboard() {
  const [copyState, setCopyState] = useState<CopyState>(null);

  async function copyConfigField(field: CopyField) {
    try {
      const response = await fetch(CONFIG_URL, { cache: "force-cache" });
      if (!response.ok) throw new Error("Config unavailable");
      const value = extractConfigField(await response.text(), field);
      if (!value) throw new Error("Config field missing");
      await writeClipboard(value);
      setCopyState(field);
      window.setTimeout(() => setCopyState((current) => current === field ? null : current), 1600);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState(null), 1800);
    }
  }

  const copyButtons: Array<{ field: CopyField; label: string; detail: string }> = [
    { field: "name", label: "Name", detail: "Copy tên Gem" },
    { field: "description", label: "Description", detail: "Copy mô tả" },
    { field: "instructions", label: "Instructions", detail: "Copy toàn bộ chỉ dẫn" },
  ];

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>GEMINI GEMS · DYNAMIC DASHBOARD</div>
          <h1>Dynamic Sheet Dashboard Architect</h1>
          <p><strong>Đọc Excel/CSV mẫu</strong> và tự nhận diện cấu trúc dữ liệu.</p>
        </div>

        <div className={styles.actions} aria-label="Thiết lập Gem">
          {copyButtons.map((button) => (
            <button
              type="button"
              key={button.field}
              className={copyState === button.field ? styles.copied : ""}
              data-interactive="true"
              onClick={() => copyConfigField(button.field)}
            >
              <span aria-hidden="true">{copyState === button.field ? "✓" : "⧉"}</span>
              <span><strong>{copyState === button.field ? "Đã copy" : button.label}</strong><small>{button.detail}</small></span>
            </button>
          ))}
          <a
            href={KNOWLEDGE_URL}
            download="KNOWLEDGE_Dynamic_Sheet_Dashboard_v3.txt"
            data-interactive="true"
          >
            <span aria-hidden="true">↓</span>
            <span><strong>Knowledge</strong><small>Tải file kiến thức</small></span>
          </a>
        </div>
      </header>

      <div className={styles.capabilityGrid}>
        {CAPABILITY_GROUPS.map((group, groupIndex) => (
          <article key={group.number} className={groupIndex === 1 ? styles.featuredCard : ""}>
            <div className={styles.cardHead}>
              <span>{group.number}</span>
              <div><small>{group.label}</small><h2>{group.title}</h2></div>
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item}>
                  <p>{item}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section className={styles.deliveryFlow} aria-label="Luồng tạo dashboard mặc định">
        <div className={styles.flowIntro}>
          <span>AUTO FLOW</span>
          <strong>Gem tự đi theo cấu trúc Google Sheet</strong>
          <small>Từ dữ liệu nguồn đến Web App hoàn chỉnh</small>
        </div>
        <div className={styles.flowSteps}>
          <div><span>01</span><strong>Google Sheet</strong><small>Live data source</small></div>
          <i aria-hidden="true">→</i>
          <div><span>02</span><strong>Google Apps Script</strong><small>Tự dựng dashboard</small></div>
          <i aria-hidden="true">→</i>
          <div className={styles.outputStep}><span>03</span><strong>Code.gs + Index.html</strong><small>Đầu ra mặc định</small></div>
          <i aria-hidden="true">→</i>
          <div><span>04</span><strong>Deploy Web App</strong><small>Chạy trên Apps Script</small></div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>SCHEMA-FIRST</span><i />
        <span>BULK-DATA</span><i />
        <span>NO-HARDCODE</span><i />
        <span>INTERVIEW-BEFORE-CODE</span>
        <em aria-live="polite">{copyState === "error" ? "Không thể copy · vui lòng thử lại" : ""}</em>
      </footer>
    </div>
  );
}
