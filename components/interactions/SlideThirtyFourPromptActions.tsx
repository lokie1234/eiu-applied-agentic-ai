"use client";

import { useEffect, useState } from "react";
import styles from "./SlideThirtyFourPromptActions.module.css";

const PROMPT_TEXT = [
  "Tạo Web App demo quản lý nghỉ phép chạy trên Google Apps Script (chỉ cần 2 file code.gs và Index.html), lưu dữ liệu bằng Google Sheets",
  "Giao diện đơn giản, responsive, dùng tốt trên desktop và mobile, thiết kế theo design DNA đã tải lên",
  "● Nhân viên nhập: Họ tên, ngày bắt đầu, ngày kết thúc, lý do nghỉ và gửi đơn.",
  "● Hiển thị danh sách tất cả đơn nghỉ phép trong một bảng.",
  "● Mỗi đơn chỉ có 3 trạng thái: Chờ duyệt / Đã duyệt / Từ chối.",
  "● Quản lý có nút Duyệt hoặc Từ chối ngay trên bảng.",
  "● Dashboard chỉ hiển thị: Tổng đơn, đơn chờ duyệt, đơn đã duyệt.",
  "Chỉ dùng 1 Google Sheet: Quản lý nghỉ phép để giảm tối đa code và cấu hình.",
  "Không cần đăng nhập, phân quyền, số dư phép, email, lịch nghỉ hoặc chức năng nâng cao.",
  "Ưu tiên code ngắn, dễ hiểu, ít file, dễ deploy",
].join("\n\n");

function copyWithFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function SlideThirtyFourPromptActions() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(PROMPT_TEXT);
      } else {
        copyWithFallback(PROMPT_TEXT);
      }
      setCopied(true);
    } catch (error) {
      console.error("Copy prompt failed:", error);
      copyWithFallback(PROMPT_TEXT);
      setCopied(true);
    }
  }

  return (
    <div className={styles.root}>
      <div className={styles.ambient} aria-hidden="true" />

      <button
        type="button"
        className={`${styles.actionButton} ${styles.copyButton} ${copied ? styles.copied : ""}`}
        onClick={handleCopy}
        data-interactive="true"
        aria-label="Copy prompt"
      >
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="9" y="7" width="10" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
            <rect x="5" y="4" width="10" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" opacity=".8" />
          </svg>
        </span>
        <span>{copied ? "Đã copy" : "Copy prompt"}</span>
      </button>

      <a
        className={`${styles.actionButton} ${styles.downloadButton}`}
        href="/downloads/design-dna.txt"
        download="design-dna.txt"
        data-interactive="true"
        aria-label="Tải design DNA"
      >
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>Tải design DNA</span>
      </a>

      <div className={`${styles.toast} ${copied ? styles.toastVisible : ""}`} aria-hidden={!copied}>
        ✓ Đã copy prompt
      </div>
    </div>
  );
}
