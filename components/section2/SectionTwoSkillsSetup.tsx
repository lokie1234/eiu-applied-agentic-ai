import styles from "./SectionTwoSkillsSetup.module.css";

function SkillsPage() {
  return <div className={styles.manager}>
    <h2>SKILLS</h2><p>Create custom, reusable instructions for more helpful responses. Gemini uses relevant SKILLS automatically, or you can apply them using /. <u>Learn more</u></p>
    <div className={styles.actions}><span>▱ Create with Gemini</span><span>☷ Create manually</span><span className={styles.uploadAction} aria-label="Upload">↥</span></div>
    <div className={styles.empty}><strong>Add your first SKILL</strong><small>Select Create with Gemini, write custom instructions or upload a SKILL</small></div>
    <b className={styles.recommended}>Recommended</b>
    <div className={styles.recommendations}>{[
      ["Match your writing style", "Learns your voice from your real writing across Workspace apps"],
      ["Focus your energy", "Align your workload with your energy instead of your calendar"],
      ["Get more perspectives", "Get 3–5 distinct viewpoints before you commit to a decision"],
      ["Generate fresh ideas", "Turn your existing content into 5 entirely new creative concepts"],
    ].map(([title, body]) => <div key={title}><b>{title}</b><small>{body}</small></div>)}</div>
  </div>;
}

function UploadDialog({ pro = false }: { pro?: boolean }) {
  return <div className={styles.uploadDialog}>
    <h3>Upload a SKILL</h3><p>Make sure that your files meet these requirements:</p>
    <ul><li>Use kebab-case for the SKILL name in SKILL.md</li>{pro && <li>Include a SKILL.md file in the main folder</li>}</ul>
    <p>Follow Gemini’s <u>content guidelines</u> and only upload files from trusted sources. <u>Learn more</u></p>
    <div className={styles.dropZone}><strong>{pro ? "Drag or select images, files or a folder" : "Drag or select file"}</strong><small>{pro ? "to upload PDF, CSV, PY, TXT and MD files" : "SKILL.md"}</small></div>
  </div>;
}

export function SkillsUploadComparison() {
  return <div className={styles.comparison}>
    <p className={styles.planNote}>Quy tắc tải file sẽ thay đổi theo gói AI bạn đang sử dụng.</p>
    <div className={styles.planGrid}>
      <article><h2>Free tier</h2><UploadDialog /><p>Tải file <strong>SKILL.md</strong>.</p></article>
      <article><h2>Google AI Pro</h2><UploadDialog pro /><p>Tải thêm <strong>tài liệu tham khảo</strong>: ảnh, PDF và các định dạng file khác.</p></article>
    </div>
  </div>;
}

export default function SectionTwoSkillsSetup({ upload = false }: { upload?: boolean }) {
  if (upload) return <div className={styles.uploadLesson}>
    <div className={styles.uploadWindow}><div className={styles.dimmed}><SkillsPage /></div><UploadDialog /></div>
    <p className={styles.uploadEmphasis}>Tải file có định dạng <strong>SKILL.md</strong> vào khung</p>
  </div>;
  return <div className={styles.chooseLayout}>
    <div className={styles.menu}>{[
      ["◴", "Activity"], ["✣", "Personal Intelligence"], ["⇥", "Import memory to Gemini"],
      ["♙", "Avatar"], ["◷", "Usage limits"], ["◴", "Scheduled actions"],
      ["▤", "SKILLS"], ["↔", "Your public links"], ["☼", "Theme"], ["✦", "Gemini Spark settings"],
      ["ⓘ", "Manage subscription"], ["✦", "Upgrade to Google AI Ultra"], ["♧", "Gemini Notebook"], ["▣", "Send feedback"], ["?", "Help"],
    ].map(([icon, name]) => <div key={name} className={name === "SKILLS" ? styles.selected : ""}><span>{icon}</span>{name}{name === "SKILLS" && <b>→</b>}</div>)}</div>
    <div className={styles.arrow} aria-hidden="true">→</div><SkillsPage />
  </div>;
}
