"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type Folder = { type: string; id: string; name: string; available: boolean };
let loading: Promise<void> | null = null;

function loadPicker() {
  if (typeof google !== "undefined" && google.picker) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const initialize = () => gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Không tải được Google Picker.")), timeout: 15000, ontimeout: () => reject(new Error("Google Picker tải quá lâu. Thử lại.")) });
    if (typeof gapi !== "undefined") { initialize(); return; }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    const timer = window.setTimeout(() => { script.remove(); reject(new Error("Không tải được Google API. Kiểm tra kết nối mạng.")); }, 15000);
    script.onload = () => { clearTimeout(timer); initialize(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error("Không tải được Google API.")); };
    document.head.appendChild(script);
  }).catch(error => { loading = null; throw error; });
  return loading;
}

async function pickerRequest(payload: object) {
  const response = await fetch("/api/admin/drive/picker", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Không thể truy cập Drive.");
  return result;
}

export default function FolderPicker({ initialFolders, configured }: { initialFolders: Folder[]; configured: boolean }) {
  const [folders, setFolders] = useState(initialFolders);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const activePicker = useRef<google.picker.Picker | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; activePicker.current?.dispose(); };
  }, []);

  async function choose(folder: Folder) {
    setBusy(folder.type); setMessage("");
    try {
      await loadPicker();
      const credentials = await pickerRequest({ action: "open", type: folder.type }) as { accessToken: string; apiKey: string; appId: string; folderId: string };
      if (!mounted.current) return;
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder");
      activePicker.current?.dispose();
      const picker = new google.picker.PickerBuilder().addView(view)
        .setOAuthToken(credentials.accessToken).setDeveloperKey(credentials.apiKey).setAppId(credentials.appId)
        .setOrigin(window.location.origin).setTitle(`Chọn folder ${folder.type.toUpperCase()} đã cung cấp`)
        .setCallback(data => {
          if (data.action === google.picker.Action.CANCEL) { if (mounted.current) setBusy(""); return; }
          if (data.action !== google.picker.Action.PICKED) return;
          const selectedId = data.docs?.[0]?.id;
          void pickerRequest({ action: "verify", type: folder.type, folderId: selectedId }).then(result => {
            if (!mounted.current) return;
            setFolders(current => current.map(item => item.type === folder.type ? result.folder : item));
            setMessage(`Đã xác minh quyền lưu file ${folder.type.toUpperCase()} vào ${result.folder.name}.`);
          }).catch(error => { if (mounted.current) setMessage(error instanceof Error ? error.message : "Không xác minh được folder."); })
            .finally(() => { if (mounted.current) setBusy(""); });
        }).build();
      activePicker.current = picker;
      picker.setVisible(true);
      // The short-lived access token is held in memory only, never persisted.
    } catch (error) {
      if (mounted.current) { setMessage(error instanceof Error ? error.message : "Không mở được Google Picker."); setBusy(""); }
    }
  }

  return <>
    {!configured && <p className={styles.notice}>Bật Google Picker API và thêm API key vào cấu hình local để chọn folder.</p>}
    <div className={styles.folders}>{folders.map(folder => <div key={folder.type}>
      <strong>{folder.type.toUpperCase()}</strong>
      <span>{folder.available ? folder.name : "Chọn folder đã cung cấp để cấp quyền"}<small className={styles.folderId}>ID: {folder.id}</small></span>
      <button className={styles.folderButton} type="button" disabled={!configured || !!busy} onClick={() => void choose(folder)}>{busy === folder.type ? "Đang xác minh…" : folder.available ? "Chọn lại" : "Chọn folder"}</button>
      <b className={styles.folderState}>{folder.available ? "Sẵn sàng" : "Chưa có quyền"}</b>
    </div>)}</div>
    {message && <p className={styles.notice} role="status">{message}</p>}
    <p>Chọn đúng ba folder đã gửi. Web kiểm tra quyền thêm file sau mỗi lựa chọn; folder khác sẽ không thay đổi cấu hình đích.</p>
  </>;
}
