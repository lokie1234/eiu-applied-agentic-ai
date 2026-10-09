import styles from "./SectionTwoSaveShare.module.css";

const STEPS = [
  { label: "SAVE", body: "Kiểm tra SKILL rồi chọn Create", action: "Create", icon: "save" },
  { label: "SHARE", body: "Tải SKILL và chia sẻ file cho người khác", action: "SKILL.md", icon: "share" },
  { label: "USE", body: "Mở chat và gọi SKILL bằng /", action: "/ SKILL", icon: "use" },
] as const;

function StepIcon({ kind }: { kind: typeof STEPS[number]["icon"] }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "save" ? <><path d="M6 5h17l4 4v18H5V5h1M10 5v8h12V5M10 27v-8h12v8" /><path d="M18 5v5" /></> : kind === "share" ? <><path d="M8 5h12l5 5v17H8V5M20 5v6h5M16 13v9M12 18l4 4 4-4" /><path d="M4 10v17h4" /></> : <><path d="M5 6h22v17H13l-7 5v-5H5V6" /><path d="m12 12-3 3 3 3m8-6 3 3-3 3m-3-7-2 9" /></>}
  </svg>;
}

export default function SectionTwoSaveShare() {
  return <div className={styles.sequence}>
    <div className={styles.rail} aria-hidden="true" />
    {STEPS.map((step, index) => <article className={`${styles.row} ${index === 1 ? styles.featured : ""}`} key={step.label}>
      <div className={styles.number}>0{index + 1}</div>
      <div className={styles.card}>
        <div className={styles.icon}><StepIcon kind={step.icon} /></div>
        <div className={styles.copy}><h2>{step.label}</h2><p>{step.body}</p></div>
        <div className={styles.preview} aria-hidden="true">
          <span>{index === 0 ? "✓" : index === 1 ? "↓" : "/"}</span><strong>{step.action}</strong>
        </div>
      </div>
    </article>)}
  </div>;
}
