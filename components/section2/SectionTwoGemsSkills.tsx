import styles from "./SectionTwoGemsSkills.module.css";

export default function SectionTwoGemsSkills({ isFinalState = false }: { isFinalState?: boolean }) {
  return (
    <div className={`${styles.comparison} ${isFinalState ? styles.static : ""}`}>
      <div className={styles.cards}>
        <article className={styles.gems}>
          <div className={styles.label}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M8 12v2m8-2v2M9 17h6" /></svg>
            GEMS
          </div>
          <h2>Trợ lý AI cá nhân hóa</h2>
          <ul>
            <li>Cấu hình AI theo vai trò hoặc nhiệm vụ cụ thể.</li>
            <li>Mỗi Gem hoạt động như một trợ lý chuyên biệt.</li>
            <li>Thường được chọn và sử dụng riêng lẻ.</li>
          </ul>
        </article>
        <article className={styles.skills}>
          <div className={styles.label}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 17h7m-3.5-3.5v7" /></svg>
            SKILLS
          </div>
          <h2>Kỹ năng AI tái sử dụng</h2>
          <ul>
            <li>Đóng gói hướng dẫn và quy trình cho nhiệm vụ.</li>
            <li>Có thể kích hoạt linh hoạt theo ngữ cảnh.</li>
            <li>Dễ kết hợp nhiều kỹ năng trong một quy trình.</li>
          </ul>
        </article>
      </div>
      <div className={styles.difference}>
        <span className={styles.eyebrow}>Khác biệt cốt lõi</span>
        <div className={styles.focus}><span>Gems</span><strong>Trợ lý chuyên biệt</strong></div>
        <div className={styles.focus}><span>Skills</span><strong>Linh hoạt và tái sử dụng</strong></div>
      </div>
      <aside className={styles.timeline}>
        <time dateTime="2026-11-17">17/11/2026</time>
        <div>
          <strong>Giai đoạn chuyển đổi từ Gems sang Skills</strong>
          <p>Các Gems đang tồn tại sẽ được <b>tự động chuyển đổi thành Skills.</b></p>
          <p className={styles.timelineNote}>Không khẳng định tất cả Gems ngừng hoạt động vào ngày này.</p>
        </div>
      </aside>
    </div>
  );
}
