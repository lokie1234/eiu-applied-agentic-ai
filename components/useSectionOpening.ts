"use client";

import { useEffect, useRef, useState } from "react";

// The request belongs to the selection pane and is cancelled when it closes.
export function useSectionOpening() {
  const [openingSection, setOpeningSection] = useState<string | null>(null);
  const [sectionOpenError, setSectionOpenError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  function cancelSectionOpening() {
    requestRef.current?.abort();
    requestRef.current = null;
    setOpeningSection(null);
    setSectionOpenError("");
  }

  async function openSection(nextSection: string, onReady: () => void) {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setOpeningSection(nextSection);
    setSectionOpenError("");
    try {
      const response = await fetch("/api/session/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: nextSection }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
      });
      if (!response.ok) throw new Error("Unable to open section.");
      if (!controller.signal.aborted) onReady();
    } catch {
      if (!controller.signal.aborted) setSectionOpenError("Unable to open this section. Please try again.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setOpeningSection(null);
      }
    }
  }

  return { openingSection, sectionOpenError, openSection, cancelSectionOpening };
}
