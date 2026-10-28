"use client";

import { useEffect, useState } from "react";

// A shared notice covers API callers whose local error UI is hidden or transient.
// Do not read/consume response bodies or interfere with external requests.
export default function RequestLimitNotice() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const original = window.fetch;
    let active = true;
    const show = (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) return;
      const timestamp = Date.now(); setNow(timestamp);
      setUntil(current => Math.max(current, timestamp + seconds * 1000));
    };
    const convexLimit = (event: Event) => show(Number((event as CustomEvent).detail?.retryAfter));
    window.addEventListener("eiu:rate-limit", convexLimit);
    const wrapped: typeof fetch = async (...args) => {
      const response = await original.apply(window, args);
      const target = args[0] instanceof Request ? args[0].url : String(args[0]);
      const sameOrigin = new URL(target, window.location.href).origin === window.location.origin;
      if (active && sameOrigin && response.status === 429 && response.headers.get("X-EIU-Rate-Limit") === "1") {
        const seconds = Number(response.headers.get("Retry-After"));
        show(seconds);
      }
      return response;
    };
    window.fetch = wrapped;
    return () => { active = false; window.removeEventListener("eiu:rate-limit", convexLimit); if (window.fetch === wrapped) window.fetch = original; };
  }, []);
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= until) setUntil(0);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  if (!until) return null;
  return <aside style={{ position: "fixed", zIndex: 100000, inset: "16px 16px auto auto", maxWidth: "min(400px, calc(100vw - 32px))", padding: "16px 20px", border: "1px solid #e9ca8b", borderRadius: 14, background: "#082945", color: "#f7f4ed", boxShadow: "0 8px 32px #0005", font: "14px/1.5 system-ui" }}>
    <p role="alert" style={{ margin: 0 }}>Bạn thao tác quá nhanh. Vui lòng thử lại sau 2 phút.<br />Please try again in 2 minutes.</p>
    <p aria-live="off" style={{ margin: "8px 0 0", color: "#e9ca8b" }}>Còn {Math.max(0, Math.ceil((until - now) / 1000))} giây · seconds remaining</p>
  </aside>;
}
