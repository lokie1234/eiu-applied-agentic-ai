"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import styles from "./SectionTwoSlide.module.css";

type Props = { pageNumber: number };

const requirementPrompt = `Hãy đọc đầy đủ ba file tôi vừa tải lên.
Sử dụng file “Gemini-Prompt.txt” làm yêu cầu chính. Hai file “App-01-Source.txt” và “App-02-Source.txt” là hai dự án cần phân tích.`;

function Shell({ children, dark = false, blank = false }: { children?: ReactNode; dark?: boolean; blank?: boolean }) {
  return (
    <section className={`${styles.slide} ${dark ? styles.dark : ""} ${blank ? styles.blank : ""}`}>
      {!blank && <div className={styles.cornerMark} />}
      {children}
    </section>
  );
}

function Title({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return <h1 className={`${styles.title} ${compact ? styles.compactTitle : ""}`}>{children}</h1>;
}

function MiniTitle({ children }: { children: ReactNode }) {
  return <div className={styles.miniTitle}>{children}</div>;
}

function Quote({ children, navy = false }: { children: ReactNode; navy?: boolean }) {
  return <div className={`${styles.quote} ${navy ? styles.quoteNavy : ""}`}><span>“</span>{children}</div>;
}

export default function SectionTwoSlide({ pageNumber }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(requirementPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  switch (pageNumber) {
    case 1:
      return <Shell dark><div className={styles.cover}><h1>Từ thiết kế Prompt<br />đến AI Business Framework</h1><div className={styles.goldRule} /></div></Shell>;
    case 2:
      return <Shell>
        <div className={styles.sectionCompare}>
          <div><MiniTitle>SECTION 1</MiniTitle><h2>Tạo được một Business<br />Web App (demo)</h2></div>
          <div className={styles.compareArrow}>→</div>
          <div><MiniTitle>SECTION 2</MiniTitle><h2>Tạo được cách làm<br />có thể tái sử dụng</h2></div>
        </div>
        <p className={styles.bottomStatement}>Từ một sản phẩm đơn lẻ đến một tiêu chuẩn chung cho nhiều sản phẩm.</p>
      </Shell>;
    case 3:
      return <Shell><Title>Sau Section 2, bạn sẽ làm được</Title><div className={styles.outcomeGrid}>
        {["Viết Requirement có cấu trúc và có thể kiểm thử", "Phân biệt phần dùng chung và phần riêng của từng ứng dụng", "Xây AI Business Framework cho doanh nghiệp", "Đóng gói Framework thành Gem trong Gemini"].map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}
      </div></Shell>;
    case 4:
      return <Shell dark><div className={styles.centerStatement}><h2>Đa số trường hợp, AI không làm sai.</h2><p>AI chỉ làm đúng theo yêu cầu mà bạn mô tả.</p></div></Shell>;
    case 5:
      return <Shell><Title>Sai lầm phổ biến</Title><div className={styles.mistakeBox}>“Tạo giúp tôi một app quản lý.”</div><p className={styles.leadSmall}>AI sẽ phải tự đoán:</p><div className={styles.questionGrid}>{["Quản lý cái gì?", "Có quy trình gì?", "Ai dùng?", "Lưu dữ liệu ở đâu?"].map(item => <span key={item}>{item}</span>)}</div></Shell>;
    case 6:
      return <Shell><Title>“Yêu cầu” quyết định chất lượng đầu ra</Title><div className={styles.twoConcepts}>
        <div><h2>Prompt</h2><p>Chỉ là cách diễn đạt.</p></div><div className={styles.navyCard}><h2>Yêu cầu</h2><p>Mới là điều quyết định chất lượng ứng dụng.</p></div>
      </div></Shell>;
    case 7:
      return <Shell dark><div className={styles.centerStatement}><h2>Đừng bắt đầu bằng “Tạo Web App”.</h2><p>Hãy bắt đầu bằng:</p><strong>“Doanh nghiệp đang gặp vấn đề gì?”</strong></div></Shell>;
    case 8:
      return <Shell><Title>Ví dụ mới: Báo cáo sự cố</Title><div className={styles.exampleColumns}>
        <div><MiniTitle>✕ &nbsp; Chưa rõ</MiniTitle><p>“Tạo app báo cáo sự cố.”</p></div>
        <div className={styles.navyCard}><MiniTitle>✓ &nbsp; Rõ ràng</MiniTitle><p>“Nhân viên đang báo cáo sự cố qua Zalo. Bộ phận an toàn khó theo dõi mức độ và tiến độ xử lý. Cần một Web App tập trung.”</p></div>
      </div></Shell>;
    case 9:
      return <Shell><Title>Users</Title><p className={styles.subtitle}>Xác định: Ai sử dụng? Ai ra quyết định?</p><ul className={styles.goldBullets}>{["Nhân viên", "Bộ phận giám sát an toàn", "Quản lý", "Ban giám đốc"].map(item => <li key={item}>{item}</li>)}</ul></Shell>;
    case 10:
      return <Shell><Title>Quy trình làm việc</Title><div className={styles.workflow}>{["Báo cáo sự cố", "Phân loại", "Duyệt", "Giao xử lý", "Xác nhận hoàn tất", "Đóng sự cố"].map((item, index) => <div className={index % 2 === 0 ? styles.workflowNavy : ""} key={item}>{item}{index < 5 && <span>↓</span>}</div>)}</div></Shell>;
    case 11:
      return <Shell><Title>Dữ liệu</Title><div className={styles.dataGrid}>{["Người báo cáo", "Phòng ban", "Thời gian", "Địa điểm", "Mô tả", "Mức độ", "Người xử lý", "Trạng thái"].map((item, index) => <div className={index % 3 !== 1 ? styles.navyTile : ""} key={item}>{item}</div>)}</div></Shell>;
    case 12:
      return <Shell><Title>Quy tắc nghiệp vụ</Title><div className={styles.ruleGrid}>
        {["Không gửi khi thiếu mô tả hoặc mức độ", "Sự cố nghiêm trọng phải ưu tiên xử lý", "Chỉ người được giao hoặc quản trị viên được cập nhật", "Mỗi lần đổi trạng thái phải lưu thời gian"].map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}
      </div></Shell>;
    case 13:
      return <Shell><Title>Tiêu chí chấp nhận</Title><p className={styles.subtitle}>Mỗi tiêu chí phải kiểm tra được bằng một hành động cụ thể.</p><ul className={styles.checkList}>{["Không thể nộp form nếu thiếu Mức độ", "Sau khi nộp, Google Sheets xuất hiện dòng mới", "Sự cố mức Nghiêm trọng hiển thị ở đầu danh sách", "Dashboard cập nhật sau khi tải lại dữ liệu"].map(item => <li key={item}>●<span>{item}</span></li>)}</ul></Shell>;
    case 14:
      return <Shell><Title>Báo cáo</Title><div className={styles.reportGrid}>{["Tổng số sự cố", "Theo mức độ", "Theo phòng ban", "Theo trạng thái", "Theo thời gian", "Thời gian xử lý"].map((item, index) => <div className={index % 2 === 0 ? styles.navyTile : ""} key={item}>{item}</div>)}</div></Shell>;
    case 15:
      return <Shell blank />;
    case 16:
      return <Shell><Title>Tổng hợp các yêu cầu</Title><div className={styles.requirementSummary}><strong>Ví dụ:</strong><p>Tạo một Web App báo cáo sự cố nội bộ đơn giản, giao diện responsive và dễ sử dụng.</p><ul>
        <li>Người dùng gồm: Nhân viên, Quản lý và Bộ phận an toàn.</li>
        <li>Nhân viên có thể báo cáo sự cố với: Người báo cáo, Phòng ban, Thời gian, Địa điểm, Mô tả và Mức độ.</li>
        <li>Workflow: Báo cáo sự cố → Phân loại → Duyệt → Giao xử lý → Xác nhận hoàn tất → Đóng sự cố.</li>
        <li>Mỗi sự cố lưu thông tin báo cáo, trạng thái và thời gian của mỗi lần thay đổi trạng thái.</li>
        <li>Không cho Submit nếu để trống Mức độ; sự cố nghiêm trọng phải được ưu tiên xử lý.</li>
        <li>Dashboard hiển thị tổng số sự cố, theo mức độ, phòng ban, trạng thái và thời gian xử lý.</li>
        <li>Dùng Google Apps Script + Google Sheets; ưu tiên code tối giản cho app demo nội bộ.</li>
      </ul></div></Shell>;
    case 17:
      return <Shell><div className={styles.frameworkQuestion}><MiniTitle>AI BUSINESS FRAMEWORK</MiniTitle><Title>Tại sao phải làm lại từ đầu?</Title><p>Lần sau xây ứng dụng mới, bạn có muốn viết lại toàn bộ Prompt?</p></div></Shell>;
    case 18:
      return <Shell><Title>Lõi chung và Đặc thù theo ứng dụng</Title><div className={styles.splitHeadings}><MiniTitle>DÙNG CHUNG</MiniTitle><MiniTitle>THAY ĐỔI THEO APP</MiniTitle></div><div className={styles.coreSplit}>
        <div>{["Form", "Xác thực dữ liệu", "Quy trình", "Dashboard", "Báo cáo", "Triển khai"].map(item => <span className={styles.navyTile} key={item}>{item}</span>)}</div>
        <div>{["Các trường dữ liệu", "Quy tắc nghiệp vụ", "Phân quyền", "Tích hợp"].map(item => <span key={item}>{item}</span>)}</div>
      </div></Shell>;
    case 19:
      return <Shell><div className={styles.frameworkHero}><span>Framework</span><div className={styles.goldRule} /><h1>AI Business Framework</h1><p>Một bộ quy tắc để AI luôn xây ứng dụng theo cùng một tiêu chuẩn.</p></div></Shell>;
    case 20:
      return <Shell><Title>Lõi có thể tái sử dụng</Title><p className={styles.subtitle}>Khi tách được phần dùng chung, AI không cần bắt đầu từ một trang trắng.</p><div className={styles.coreFlow}>{["Kiến trúc hệ thống", "Tiêu chuẩn giao diện người dùng", "Quy tắc viết code", "Quy tắc thiết kế cơ sở dữ liệu", "Kiểm thử", "Triển khai"].map((item, index) => <div className={index % 2 === 0 ? styles.navyTile : ""} key={item}>{item}</div>)}</div></Shell>;
    case 21:
      return <Shell dark><div className={styles.gemDefinition}><MiniTitle>GEMINI GEMS</MiniTitle><Title>Gem là gì?</Title><p>Một phiên bản Gemini được tùy chỉnh để luôn làm theo các hướng dẫn và ngữ cảnh lặp lại.</p><em>Các nền tảng AI khác cũng có khái niệm tương tự, dù tên gọi khác nhau.</em></div></Shell>;
    case 22:
      return <Shell><div className={styles.centerLight}><MiniTitle>GEM THỰC CHẤT LÀ GÌ?</MiniTitle><p>Không phải Code. Không phải Plugin.</p><h2>Mà là một bộ hướng dẫn để AI luôn làm đúng.</h2></div></Shell>;
    case 23:
      return <Shell><Title>Framework và Gem</Title><div className={styles.frameworkGem}>
        <div><MiniTitle>AI BUSINESS FRAMEWORK</MiniTitle><h2>Nội dung tiêu chuẩn</h2><p>Kiến trúc hệ thống, giao diện người dùng (UI), mã nguồn, cơ sở dữ liệu, bảo mật, kiểm thử và quy trình triển khai vận hành.</p></div>
        <div className={styles.arrowLarge}>→</div>
        <div className={styles.navyCard}><MiniTitle>GEM</MiniTitle><h2>Cách đóng gói</h2><p>Instructions và Knowledge định hướng Gemini áp dụng chính xác Framework khi tiếp nhận yêu cầu dự án mới.</p></div>
      </div></Shell>;
    case 24:
      return <Shell><Title>Bên trong một Gem</Title><div className={styles.gemGrid}>{[["NAME","Tên và mục đích"],["INSTRUCTIONS","Vai trò và quy tắc"],["KNOWLEDGE","Tài liệu tham chiếu"],["PREVIEW","Kiểm thử trước khi lưu"]].map(([head,body], index) => <div className={index === 1 ? styles.navyCard : ""} key={head}><MiniTitle>{head}</MiniTitle><strong>{body}</strong></div>)}</div></Shell>;
    case 25:
      return <Shell><Title>Công thức Instructions cho Gem</Title><div className={styles.formula}>{["Persona", "Task", "Context", "Format"].map((item, index) => <div key={item} className={index % 2 === 0 ? styles.navyTile : ""}>{item}{index < 3 && <span>+</span>}</div>)}</div><div className={styles.frameworkBar}>+ AI Business Framework</div></Shell>;
    case 26:
      return <Shell><Title>Ví dụ: Business Internal Web App Builder</Title><div className={styles.builderExample}><p>Yêu cầu mới: <strong>“Tạo hệ thống đặt phòng họp.”</strong></p><span>Gem tự áp dụng các tiêu chuẩn đã lưu:</span><div>{["Responsive UI", "Google Sheets Database", "Google Apps Script", "Validation", "Dashboard", "Deployment Guide"].map(item => <b key={item}>● {item}</b>)}</div></div></Shell>;
    case 27:
      return <Shell dark><div className={styles.requirementTransition}><MiniTitle>Phần thay đổi chính</MiniTitle><h1>Requirement</h1><p>Framework giữ tiêu chuẩn chung. Ngoại lệ phải được mô tả rõ trong từng yêu cầu.</p></div></Shell>;
    case 28:
      return <Shell dark><div className={styles.labCover}><MiniTitle>GEMINI GEMS</MiniTitle><h1>Lab 2</h1><p>Xây một Gem áp dụng AI Business Framework của doanh nghiệp.</p></div></Shell>;
    case 29:
      return <Shell><Title>Lộ trình</Title><div className={styles.roadmap}>{["Phân tích 2 apps\nTách Framework", "Cài đặt Gem", "Xem trước\nKiểm thử", "Lưu & Chia sẻ"].map((item, index) => <div key={item}><b>{index + 1}</b><span>{item}</span>{index < 3 && <i>→</i>}</div>)}</div></Shell>;
    case 30:
      return <Shell><Title>Bước 1 · Phân tích và tách Framework</Title><p className={styles.subtitle}>Bỏ source code của 2 app đã tạo vào Gemini, rồi yêu cầu:</p><Quote><p>{requirementPrompt}</p><button type="button" data-interactive="true" onClick={copyPrompt}>{copied ? "Đã copy" : "Copy Prompt"}</button></Quote></Shell>;
    case 31:
      return <Shell><Title>Ví dụ - Design Principles</Title><div className={styles.principles}>{["Responsive", "Có Dashboard", "Có giao diện dùng được cho điện thoại", "Kèm theo hướng dẫn", "Sử dụng Google Sheets", "Tách riêng HTML / CSS / JS"].map(item => <span key={item}>▪ {item}</span>)}</div><p className={styles.bottomNote}>...và các nguyên tắc riêng của doanh nghiệp bạn.</p></Shell>;
    case 32:
      return <Shell><Title>Bước 2 - Tạo Gem trong Gemini</Title><div className={styles.screenshotPair}><div><Image src="/section2/gemini-step-001.png" alt="Mở mục Gems trong Gemini" fill sizes="240px" /></div><div><Image src="/section2/gemini-step-000.png" alt="Gem manager và nút New Gem" fill sizes="650px" /></div></div></Shell>;
    case 33:
      return <Shell><Title>Bước 2 - Tạo Gem trong Gemini</Title><div className={styles.tallScreenshot}><Image src="/section2/gemini-step-002.png" alt="Các trường cài đặt New Gem" fill sizes="420px" /></div></Shell>;
    case 34:
      return <Shell><Title>Bước 3 - Xem trước và kiểm thử</Title><div className={styles.previewLayout}><div className={styles.previewShot}><Image src="/section2/gemini-step-003.png" alt="Cửa sổ Preview của Gem" fill sizes="360px" /></div><div><div className={styles.navyCard}><p>Chạy thử một Requirement mới. Kiểm tra Gem có hỏi đủ thông tin trước khi tạo code hay không.</p></div><Quote><p>Tạo cho tôi một App báo cáo nội bộ.</p></Quote></div></div></Shell>;
    case 35:
      return <Shell><Title>Bước 4 - Lưu và chia sẻ</Title><div className={styles.saveFlow}>{[["SAVE","Lưu Gem sau khi Preview"],["SHARE","Chia sẻ Viewer hoặc Editor"],["USE","Mở New Chat và thử yêu cầu mới"]].map(([head,body], index) => <div className={index === 1 ? styles.navyCard : ""} key={head}><MiniTitle>{head}</MiniTitle><p>{body}</p>{index < 2 && <span>→</span>}</div>)}</div></Shell>;
    case 36:
      return <Shell><Title>Thực hành với Gem vừa tạo</Title><div className={styles.practiceList}>{["Đặt xe công tác", "Đặt phòng họp", "Báo cáo sự cố"].map((item,index) => <div className={index % 2 === 0 ? styles.navyTile : ""} key={item}>{item}</div>)}</div></Shell>;
    case 37:
      return <Shell dark><div className={styles.finalMessage}><MiniTitle>Thông điệp cuối cùng</MiniTitle><p>Đừng xây <strong>100 ứng dụng.</strong></p><h1>Hãy xây 01 AI Business Framework</h1><div className={styles.goldRule} /><p>để AI có thể tạo 100 ứng dụng<br />theo tiêu chuẩn của doanh nghiệp.</p></div></Shell>;
    case 38:
      return <Shell><Title>Tặng kèm khóa học</Title><div className={styles.giftCard}><MiniTitle>Skill tạo phần mềm Web App cho doanh nghiệp</MiniTitle><h2>Xây dựng Web App nội bộ</h2><p>File hướng dẫn bổ sung để tiếp tục áp dụng framework vào bài thực hành.</p><a data-interactive="true" href="/downloads/Xay-dung-web-app-noi-bo.skill" download>Tải file skill</a></div></Shell>;
    default:
      return <Shell />;
  }
}
