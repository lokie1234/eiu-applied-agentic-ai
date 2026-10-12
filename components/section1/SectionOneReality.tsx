"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./SectionOneReality.module.css";

type RealityImage = { src: string; alt: string };

export default function SectionOneReality() {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<RealityImage[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    import("./leaveRealityImages").then(({ default: data }) => {
      if (active) setImages([...data].reverse());
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (open && canvas) panel.current?.focus();
  }, [open, canvas]);

  function close() {
    setOpen(false);
    setSelected(null);
    trigger.current?.focus();
  }

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key === "Tab") {
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault(); first?.focus();
      }
    }
    if (selected !== null && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      setSelected((selected + (event.key === "ArrowRight" ? 1 : 3)) % 4);
    }
  }

  return <>
    <button ref={trigger} type="button" className={styles.trigger} data-interactive="true" aria-haspopup="dialog" aria-expanded={open}
      onClick={(event) => { event.stopPropagation(); setFailed(false); setCanvas(trigger.current?.closest<HTMLElement>("[data-section-one-canvas]") ?? null); setOpen(true); }}>
      <span aria-hidden="true">↗</span> Thực trạng
    </button>
    {open && canvas && createPortal(
      <div className={styles.overlay} data-interactive="true" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }} onKeyDown={keyboard}>
        <div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-label="Thực trạng xin nghỉ phép" tabIndex={-1}>
          <header className={styles.header}>
            <h2>Thực trạng</h2>
            <div>{selected !== null && <button type="button" onClick={() => setSelected(null)}>Xem 4 ảnh</button>}<button type="button" onClick={close} aria-label="Đóng Thực trạng">Đóng ×</button></div>
          </header>
          {images.length === 0 ? <p className={styles.status} role="status">{failed ? "Chưa tải được ảnh. Đóng và mở lại để thử lại." : "Đang mở ảnh…"}</p> : selected === null ?
            <div className={styles.gallery}>
              {images.map((image, index) => <button key={image.alt} className={styles.photo} type="button" style={{ "--delay": index * 75 + "ms" } as CSSProperties} onClick={() => setSelected(index)} aria-label={"Xem lớn ảnh " + (index + 1) + ": " + image.alt}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Exact embedded originals; no image service. */}
                <img src={image.src} alt={image.alt} width={960} height={1280} />
                <span>0{index + 1} <span aria-hidden="true">↗</span></span>
              </button>)}
            </div> : <div className={styles.expanded}>
              <button type="button" className={styles.arrow} aria-label="Ảnh trước" onClick={() => setSelected((selected + 3) % 4)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m14 6-6 6 6 6" /></svg></button>
              {/* eslint-disable-next-line @next/next/no-img-element -- Exact embedded original. */}
              <img key={selected} src={images[selected].src} alt={images[selected].alt} width={960} height={1280} />
              <button type="button" className={styles.arrow} aria-label="Ảnh tiếp theo" onClick={() => setSelected((selected + 1) % 4)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m10 6 6 6-6 6" /></svg></button>
              <span className={styles.counter}>{selected + 1} / 4</span>
            </div>}
        </div>
      </div>, canvas)}
  </>;
}
