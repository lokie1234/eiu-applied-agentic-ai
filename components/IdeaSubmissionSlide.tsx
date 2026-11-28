"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import IdeaSubmissionView, { type IdeaItem } from "./IdeaSubmissionView";
import { listenInteractive } from "@/lib/realtime/client";

export default function IdeaSubmissionSlide({ sectionId, scale, isAdmin }: { sectionId: string; scale: number; isAdmin: boolean }) {
  const [items, setItems] = useState<IdeaItem[]>([]);
  const [message, setMessage] = useState("");
  const [canDelete, setCanDelete] = useState(false);
  const revision = useRef(0);
  const url = `/api/sections/${encodeURIComponent(sectionId)}/ideas`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const requestRevision = ++revision.current;
    try {
      const response = await fetch(url, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Không tải được ý tưởng.");
      if (!signal?.aborted && requestRevision === revision.current) { setItems(data.items); setCanDelete(data.canDelete === true); setMessage(""); }
    } catch (error) { if (!signal?.aborted && requestRevision === revision.current) setMessage(error instanceof Error ? error.message : "Không tải được ý tưởng."); }
  }, [url]);
  useEffect(() => {
    if (!isAdmin) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) void refresh(controller.signal); });
    const stop = listenInteractive(sectionId, "ideas", () => void refresh(controller.signal));
    const onFocus = () => void refresh(controller.signal);
    window.addEventListener("focus", onFocus);
    return () => { controller.abort(); stop(); window.removeEventListener("focus", onFocus); };
  }, [sectionId, isAdmin, refresh]);
  async function submit(idea: string) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Chưa gửi được ý tưởng. Vui lòng thử lại.");
  }
  async function remove(id: string) {
    const response = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json();
    if (!response.ok || data.deletedId !== id) throw new Error(data.message || "Chưa xóa được ý tưởng. Vui lòng thử lại.");
    revision.current++;
    setItems(current => current.filter(item => item.id !== id));
    void refresh();
  }
  return <IdeaSubmissionView scale={scale} presenter={isAdmin} items={items} message={message} onSubmit={submit} onRefresh={() => void refresh()} onDelete={canDelete ? remove : undefined} />;
}
