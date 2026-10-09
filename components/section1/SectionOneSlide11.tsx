"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
import styles from "./SectionOneSlide11.module.css";

const PARTS = [
  { title: "Frontend", icon: "▤" },
  { title: "Business Logic", icon: "⇢" },
  { title: "Database", icon: "▦" },
  { title: "Integrations", icon: "✉" },
] as const;
type Part = typeof PARTS[number]["title"];
const ROWS = [
  ["NP001", "Nguyễn Minh Anh", "12/10/2026", "1", "Đã duyệt"],
  ["NP002", "Trần Hoàng Nam", "13/10/2026", "2", "Chờ duyệt"],
  ["NP003", "Lê Thanh Hà", "14/10/2026", "1", "Từ chối"],
  ["NP004", "Phạm Gia Huy", "15/10/2026", "3", "Đã duyệt"],
  ["NP005", "Võ Mai Linh", "16/10/2026", "1", "Chờ duyệt"],
];

function Demo({ part }: { part: Part }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (part === "Frontend") return;
    const timer = window.setInterval(() => setTick(value => value + 1), 1400);
    return () => window.clearInterval(timer);
  }, [part]);

  if (part === "Frontend") return (
    <div className={styles.app}>
      <aside><b>EIU</b><span>LEAVE PORTAL</span><strong>＋ Đơn xin nghỉ</strong><small>▤ Đơn của tôi</small></aside>
      <div className={styles.form}>
        <div className={styles.appHeading}><div><small>NHÂN VIÊN</small><h3>Tạo đơn xin nghỉ</h3></div><span className={styles.avatar}>MA</span></div>
        <div className={styles.fields}>
          <label>Họ và tên<div>Nguyễn Minh Anh</div></label><label>Loại nghỉ<div>Nghỉ phép năm <span>⌄</span></div></label>
          <label>Ngày bắt đầu<div>12/10/2026</div></label><label>Ngày kết thúc<div>12/10/2026</div></label>
          <label className={styles.fullField}>Lý do nghỉ<div>Giải quyết việc gia đình.</div></label>
        </div>
        <div className={styles.formFooter}><span>Gửi đơn xin nghỉ →</span></div>
      </div>
    </div>
  );
  if (part === "Business Logic") {
    const step = tick % 4;
    return <div className={styles.logic}>
      <div className={styles.flow}>
        {["Nhân viên", "Phó phòng", "Trưởng phòng"].map((name, index) => <Fragment key={name}>
          {index > 0 && <span className={`${styles.connector} ${step >= index ? styles.passed : ""}`}>→</span>}
          <div className={`${styles.step} ${step === index ? styles.active : ""} ${step > index ? styles.done : ""}`}>
            <span className={styles.stepIcon}>{step > index ? "✓" : `0${index + 1}`}</span><h3>{name}</h3><p>{index === 0 ? "Gửi form xin nghỉ" : "Kiểm tra & phê duyệt"}</p><small>{step > index ? "Hoàn thành" : step === index ? "Đang xử lý…" : "Chờ tiếp nhận"}</small>
          </div>
        </Fragment>)}
      </div>
    </div>;
  }
  if (part === "Database") {
    const count = tick % 8 > 5 ? 5 : tick % 8;
    return <div className={styles.sheet}>
      <div className={styles.sheetHeader}><Image src="/branding/apps/google-sheets.svg" alt="Google Sheets" width={30} height={38} /><div><h3>Quản lý nghỉ phép</h3><small>File　 Edit　 View　 Insert　 Format　 Data　 Tools</small></div><span>Google Sheets</span></div>
      <div className={styles.sheetTools}>↶　↷　 ⎙　 |　 100%　 |　 Arial　 |　 <b>B</b>　 <i>I</i>　 |　 ▦</div>
      <div className={styles.formula}><span>A{Math.max(2, count + 1)}</span><i>fx</i><span>{count ? ROWS[count - 1][0] : ""}</span></div>
      <table><thead><tr><th /><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr></thead><tbody>
        <tr><th>1</th>{["Mã đơn", "Nhân viên", "Ngày nghỉ", "Số ngày", "Trạng thái"].map(label => <th key={label}>{label}</th>)}</tr>
        {ROWS.map((row, index) => <tr key={row[0]} className={index === count - 1 ? styles.newRow : ""} data-filled={index < count}><th>{index + 2}</th>{row.map((cell, col) => <td key={col}>{index < count ? cell : "\u00a0"}</td>)}</tr>)}
      </tbody></table><div className={styles.sheetTabs}>＋　 ☰ <b>Đơn xin nghỉ　⌄</b></div>
    </div>;
  }
  return <div className={styles.mailDemo}>
    <div className={styles.mailGrid}>
      {[true, false].map((approved, index) => <article key={String(approved)} className={`${styles.mail} ${approved ? styles.approved : styles.rejected} ${tick % 2 === index ? styles.mailActive : ""}`}>
        <div className={styles.mailTop}><span>✉</span><div><b>EIU Leave Portal</b><small>Đến: minh.anh@eiu.edu.vn</small></div><small>Vừa xong</small></div>
        <span className={styles.face} role="img" aria-label={approved ? "Mặt cười" : "Mặt giận"}>{approved ? "😊" : "😠"}</span>
        <h3>{approved ? "Đơn xin nghỉ được duyệt" : "Đơn xin nghỉ bị từ chối"}</h3>
        <p>Xin chào Minh Anh,</p><p>{approved ? "Đơn nghỉ ngày 12/10/2026 của bạn đã được Trưởng phòng phê duyệt." : "Đơn nghỉ ngày 12/10/2026 chưa được phê duyệt. Vui lòng trao đổi với quản lý để điều chỉnh lịch nghỉ."}</p>
        <span className={styles.mailStatus}>{approved ? "✓ Đã duyệt" : "× Từ chối"}</span>
      </article>)}
    </div>
  </div>;
}

export default function SectionOneSlide11() {
  const [selected, setSelected] = useState<Part | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
    return () => triggerRef.current?.focus();
  }, [selected]);
  return <>
    <div className={styles.cards}>
      {PARTS.map((part, index) => <button type="button" key={part.title} data-interactive="true" aria-haspopup="dialog" onClick={event => { triggerRef.current = event.currentTarget; setSelected(part.title); }}>
        <div className={styles.cardTop}><span>{part.icon}</span><small>0{index + 1}</small></div><h2>{part.title}</h2><span className={styles.explore} aria-hidden="true">↗</span>
      </button>)}
    </div>
    {selected && <div className={styles.overlay} data-interactive="true" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") setSelected(null);
      if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); }
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="architecture-demo-title">
        <header><h2 id="architecture-demo-title">{selected}</h2><button type="button" ref={closeRef} onClick={() => setSelected(null)}>Close <span>×</span></button></header>
        <Demo key={selected} part={selected} />
      </section>
    </div>}
  </>;
}
