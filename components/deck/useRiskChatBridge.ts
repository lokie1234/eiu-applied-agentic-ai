"use client";

import { useLayoutEffect, type RefObject } from "react";

const SECTION_ID = "961a0a16-0dc0-486e-a501-d965a3f3c7ce";

// Presentation progress only. This closure survives slide iframe recreation,
// and is discarded when the section deck unmounts or changes section.
export function useRiskChatBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  useLayoutEffect(() => {
    if (sectionId !== SECTION_ID) return;
    const limits: Record<string, number> = { chat: 4, privacy: 3, originality: 3, reliance: 3 };
    const progress = new Map<string, { count: number; epoch: string }>();
    const receive = (event: MessageEvent) => {
      const target = frame.current;
      const message = event.data;
      if (!target || event.source !== target.contentWindow || !message
        || message.requestId !== `${sectionId}:2` || message.requestId !== target.dataset.requestId) return;
      const exampleId = message.exampleId ?? "chat";
      if (typeof exampleId !== "string" || !Object.hasOwn(limits, exampleId)) return;
      const state = progress.get(exampleId) ?? { count: 0, epoch: "" };
      if (message.type === "eiu-risk-chat-load") {
        state.epoch = crypto.randomUUID();
        progress.set(exampleId, state);
        target.contentWindow?.postMessage({ type: "eiu-risk-chat-state", requestId: message.requestId, exampleId, ...state }, "*");
      } else if (message.type === "eiu-risk-chat-save" && state.epoch && message.epoch === state.epoch
        && Number.isInteger(message.count) && message.count >= state.count && message.count <= limits[exampleId]) {
        state.count = message.count;
        progress.set(exampleId, state);
      }
    };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); };
  }, [sectionId, frame]);
}
