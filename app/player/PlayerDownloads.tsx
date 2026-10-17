"use client";
import { useEffect, useRef, useState } from "react";
import { downloadPlayerArchive, type PlayerPackage } from "@/lib/playerDownload";
import releases from "@/public/downloads/player-releases.json";
import styles from "./player.module.css";
const packages: PlayerPackage[] = releases.packages;

export default function PlayerDownloads() {
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => () => request.current?.abort(), []);
  async function download(platform: string) {
    if (request.current) return;
    const pkg = packages.find(pkg => pkg.platform === platform);
    if (!pkg) { setNotice("Gói cài đang được chuẩn bị. Vui lòng thử lại sau."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(platform); setProgress(0); setNotice("");
    try {
      const blob = await downloadPlayerArchive(pkg, controller.signal, value => { if (!controller.signal.aborted) setProgress(value); });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = pkg.name; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("Bộ cài đã sẵn sàng. Mở tệp ZIP vừa tải để bắt đầu.");
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Không thể tải bộ cài.");
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy("");
    }
  }
  function cancel() { request.current?.abort(); request.current = null; setBusy(""); setNotice("Đã dừng tải bộ cài."); }
  return <div className={styles.downloadOptions}>
    <button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={() => void download("windows-x64")}>Tải cho Windows 10/11 <span>↓</span></button>
    <div className={styles.mac}><button type="button" disabled={Boolean(busy)} onClick={() => void download("mac-arm64")}>macOS · Apple Silicon ↗</button><button type="button" disabled={Boolean(busy)} onClick={() => void download("mac-x64")}>macOS · Intel ↗</button></div>
    {busy && <div className={styles.downloadProgress}><progress value={progress} max="100" aria-label="Tiến trình tải bộ cài"/><span>Đang tải bộ cài · {progress}%</span><button type="button" onClick={cancel}>Dừng tải</button></div>}
    <p className={styles.downloadStatus} role="status" aria-live="polite">{notice}</p>
  </div>;
}
