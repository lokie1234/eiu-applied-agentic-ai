import styles from "./CourseToolRow.module.css";

type Tool = { id: string; name: string; url: string };

export default function CourseToolRow({ tools = [] }: { tools?: Tool[] }) {
  if (!tools.length) return null;
  return <div className={styles.row} aria-label="Course tools">
    {tools.map(tool => <span key={tool.id} data-course-tool className={styles.tool} title={tool.name || undefined}>
      <img src={tool.url} alt={tool.name || "Course tool"} width={28} height={28} loading="lazy" decoding="async" draggable={false} />
    </span>)}
  </div>;
}
