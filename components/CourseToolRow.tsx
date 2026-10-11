"use client";

import { useEffect, useRef } from "react";
import styles from "./CourseToolRow.module.css";

type Tool = { id: string; name: string; url: string };

export default function CourseToolRow({ tools = [] }: { tools?: Tool[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !tools.length) return;
    let visible = false;
    const sync = () => { row.dataset.moving = String(visible && document.visibilityState === "visible"); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(row);
    document.addEventListener("visibilitychange", sync);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [tools.length]);

  if (!tools.length) return null;
  return <div ref={rowRef} className={styles.row} data-moving="false" aria-label="Course tools">
    {tools.map(tool => <span key={tool.id} data-course-tool className={styles.tool} title={tool.name || undefined}>
      <img src={tool.url} alt={tool.name || "Course tool"} width={28} height={28} loading="lazy" decoding="async" draggable={false} />
    </span>)}
  </div>;
}
