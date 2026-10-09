import styles from "./SlideThirtyFiveDynamicDashboard.module.css";

const SKILL_URL = "/downloads/dynamic-sheet-dashboard/SKILL.md";

const CAPABILITY_GROUPS = [
  {
    number: "01",
    label: "ĐỌC & HIỂU CẤU TRÚC",
    title: "Schema-first",
    items: [
      "Chỉ scan khoảng 10 dòng đầu; file 1.000–5.000+ dòng vẫn xử lý tốt.",
      "Nhận diện header 1 tầng, nhiều tầng và cả header gộp.",
      "Tự phân loại cột: ngày, số, text, category, mã, Họ tên…",
      "Tự loại STT/Số thứ tự khỏi biểu đồ và KPI.",
    ],
  },
  {
    number: "02",
    label: "PHỎNG VẤN & SINH APP",
    title: "Interview-before-code",
    items: [
      "Hỏi từng cột dùng Search, Dropdown hay Không filter trước khi sinh code.",
      "Filter động, đồng bộ KPI, biểu đồ và bảng dữ liệu.",
      "Tự nhận diện cột mới khi cấu trúc Google Sheet thay đổi.",
    ],
  },
  {
    number: "03",
    label: "VẬN HÀNH ỔN ĐỊNH",
    title: "Dynamic & safe",
    items: [
      "Hỗ trợ phân trang cho dữ liệu vài nghìn dòng.",
      "Xuất CSV/Excel toàn bộ hoặc theo dữ liệu đã filter.",
      "Xử lý ngày an toàn, tránh lỗi Date/timeZone.",
      "Google Sheet ở chế độ read-only mặc định, không tự sửa dữ liệu nguồn.",
    ],
  },
] as const;

export default function SlideThirtyFiveDynamicDashboard() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>GEMINI SKILLS · DYNAMIC DASHBOARD</div>
          <h1>Dynamic Sheet Dashboard Architect</h1>
          <p><strong>Đọc Excel/CSV mẫu</strong> và tự nhận diện cấu trúc dữ liệu.</p>
        </div>

        <a className={styles.skillDownload} href={SKILL_URL} download="SKILL.md" data-interactive="true">
          <span className={styles.fileIcon} aria-hidden="true">MD</span>
          <span className={styles.fileName}><strong>SKILL.md</strong></span>
          <span className={styles.downloadArrow} aria-hidden="true">↓</span>
        </a>
      </header>

      <div className={styles.capabilityGrid}>
        {CAPABILITY_GROUPS.map((group, groupIndex) => (
          <article key={group.number} className={groupIndex === 1 ? styles.featuredCard : ""}>
            <div className={styles.cardHead}>
              <span>{group.number}</span>
              <div><small>{group.label}</small><h2>{group.title}</h2></div>
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item}>
                  <p>{item}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <section className={styles.deliveryFlow} aria-label="Luồng tạo dashboard mặc định">
        <div className={styles.flowIntro}>
          <span>AUTO FLOW</span>
          <strong>SKILL tự đi theo cấu trúc Google Sheet</strong>
          <small>Từ dữ liệu nguồn đến Web App hoàn chỉnh</small>
        </div>
        <div className={styles.flowSteps}>
          <div><span>01</span><strong>Google Sheet</strong><small>Live data source</small></div>
          <i aria-hidden="true">→</i>
          <div><span>02</span><strong>Google Apps Script</strong><small>Tự dựng dashboard</small></div>
          <i aria-hidden="true">→</i>
          <div className={styles.outputStep}><span>03</span><strong>Code.gs + Index.html</strong><small>Đầu ra mặc định</small></div>
          <i aria-hidden="true">→</i>
          <div><span>04</span><strong>Deploy Web App</strong><small>Chạy trên Apps Script</small></div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>SCHEMA-FIRST</span><i />
        <span>BULK-DATA</span><i />
        <span>NO-HARDCODE</span><i />
        <span>INTERVIEW-BEFORE-CODE</span>
      </footer>
    </div>
  );
}
