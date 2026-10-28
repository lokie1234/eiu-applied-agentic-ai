"use client";
import { useEffect, type RefObject } from "react";
import { MIS301_SECTION_ID } from "@/lib/mis301Practice";
import { listenInteractive, realtimeReady, watchClassroom, drawClassroom, resetClassroomDraw, type ClassroomView } from "@/lib/realtime/client";

// The opaque lesson frame never receives credentials or chooses an API URL.
export function useLessonPracticeBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  useEffect(() => {
    if (sectionId !== MIS301_SECTION_ID) return;
    const controller = new AbortController();
    let pending = false;
    let snapshot: ClassroomView | null = null;
    let context: Record<string, unknown> | null = null;
    let demoMode = true;
    try { demoMode = localStorage.getItem("eiu:mis301:wheel-demo") !== "off"; } catch { /* Browser storage is optional. */ }
    const classroom = watchClassroom(sectionId, value => {
      snapshot = value;
      const target = frame.current;
      target?.contentWindow?.postMessage({ type: "eiu-classroom-state", requestId: target.dataset.requestId, snapshot: { ...value, demoMode } }, "*");
    });
    const invalidate = () => {
      const target = frame.current;
      target?.contentWindow?.postMessage({ type: "eiu-practice-changed", requestId: target.dataset.requestId }, "*");
    };
    const stop = listenInteractive(sectionId, "quiz", () => { if (!snapshot?.ready || !realtimeReady()) invalidate(); });
    window.addEventListener("focus", invalidate);
    // One deck-level fallback; no client/connection/timer per exercise.
    const timer = window.setInterval(() => { if (!realtimeReady() && !document.hidden) invalidate(); }, 15_000);
    const onMessage = async (event: MessageEvent) => {
      const target = frame.current;
      const payload = event.data;
      if (!target || event.source !== target.contentWindow || payload?.type !== "eiu-practice-request"
        || payload.requestId !== target.dataset.requestId || typeof payload.token !== "string" || payload.token.length > 80
        || !["load", "submit", "draw", "resetDraw", "demoMode"].includes(payload.operation)) return;
      const reply = (response: unknown) => {
        if (!controller.signal.aborted && frame.current === target) target.contentWindow?.postMessage({ type: "eiu-practice-response", requestId: payload.requestId, token: payload.token, response }, "*");
      };
      if (pending) { reply({ success: false, message: "Please wait for the current request to finish." }); return; }
      pending = true;
      try {
        if (payload.operation === "demoMode") {
          demoMode = payload.enabled === true;
          try { localStorage.setItem("eiu:mis301:wheel-demo", demoMode ? "on" : "off"); } catch { /* Browser storage is optional. */ }
          reply({ ...context, ...snapshot, demoMode, success: true }); return;
        }
        if (payload.operation === "resetDraw") { const result = await resetClassroomDraw(sectionId, payload.demo === true); reply({ success: true, ...result }); return; }
        if (payload.operation === "draw") {
          const result = await drawClassroom(sectionId, Number(payload.count), Array.isArray(payload.excluded) ? payload.excluded : [], String(payload.submissionId || ""), payload.demo === true);
          reply({ success: true, ...result }); return;
        }
        if (payload.operation === "load" && context && snapshot?.ready && realtimeReady()) {
          reply({ ...context, ...snapshot, demoMode, success: true }); return;
        }
        const response = await fetch(`/api/sections/${encodeURIComponent(sectionId)}/practice${payload.operation === "load" && snapshot?.ready && realtimeReady() ? "?context=1" : ""}`, {
          method: payload.operation === "submit" ? "POST" : "GET", cache: "no-store",
          headers: payload.operation === "submit" ? { "Content-Type": "application/json" } : undefined,
          body: payload.operation === "submit" ? JSON.stringify({ partId: payload.partId, values: payload.values, submissionId: payload.submissionId, practiceSession: payload.practiceSession }) : undefined,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const data = await response.json();
        if (payload.operation === "load" && response.ok) context = { teaching: data.teaching, learner: data.learner, practiceSession: data.practiceSession };
        reply({ ...data, ...(payload.operation === "load" && snapshot?.ready && realtimeReady() ? snapshot : {}), demoMode, success: response.ok });
      } catch { reply({ success: false, message: "Unable to connect. Please try again; your input is kept." }); }
      finally { pending = false; }
    };
    window.addEventListener("message", onMessage);
    return () => { controller.abort(); stop(); classroom(); clearInterval(timer); window.removeEventListener("focus", invalidate); window.removeEventListener("message", onMessage); };
  }, [sectionId, frame]);
}
