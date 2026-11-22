"use client";
import { useEffect, useRef, useState } from "react";
import { getSlideStorage, setSlideStorage } from "@/lib/slideStorage";
import styles from "./ShowcaseSlide.module.css";

// Local presenter state only: never a learner result or a classroom clock.
export default function PracticeCountdown({ minutes, scope }: { minutes: number; scope: string }) {
  const total = minutes * 60;
  const storageKey = `eiu-practice-timer:${scope}`;
  const [remaining, setRemaining] = useState(() => {
    try { const saved = Number(getSlideStorage(storageKey)); return getSlideStorage(storageKey) !== null && Number.isFinite(saved) && saved >= 0 && saved <= total ? saved : total; } catch { return total; }
  });
  const [running, setRunning] = useState(false);
  const current = useRef(remaining);
  const deadline = useRef(0);
  const update = (seconds: number) => { current.current = seconds; setRemaining(seconds); };

  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      current.current = seconds;
      setRemaining(seconds);
      if (!seconds) setRunning(false);
    };
    const visible = () => {
      clearInterval(timer);
      if (!document.hidden) { tick(); timer = setInterval(tick, 250); }
    };
    document.addEventListener("visibilitychange", visible);
    visible();
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [running]);
  useEffect(() => () => { setSlideStorage(storageKey, String(current.current)); }, [storageKey]);

  const toggle = () => {
    if (running) { update(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))); setRunning(false); }
    else { if (!current.current) update(total); deadline.current = Date.now() + (current.current || total) * 1000; setRunning(true); }
  };
  const reset = () => { setRunning(false); update(total); setSlideStorage(storageKey, String(total)); };
  return <div className={styles.practiceTimer} data-running={running}>
    <button type="button" onClick={toggle} aria-pressed={running} aria-label={`${running ? "Pause" : "Start"} ${minutes}-minute countdown`} title={running ? "Click to pause" : "Click to start"}>
      <span role="timer" aria-live="off">{String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}</span>
    </button>
    {(remaining !== total || running) && <button type="button" className={styles.practiceTimerReset} onClick={reset} aria-label="Reset countdown" title="Reset countdown">↺</button>}
    {remaining === 0 && <span role="status" className={styles.practiceTimeUp}>Time is up</span>}
  </div>;
}
