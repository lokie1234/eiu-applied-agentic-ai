"use client";

import { useRef, useState } from "react";
import { site } from "../data/site";
import { saveRegistration } from "../lib/registrations.mjs";

function Arrow() { return <span aria-hidden="true">↗</span>; }

export default function MarketingSite() {
  const dialog = useRef(null);
  const [plan, setPlan] = useState("grow");
  const [tab, setTab] = useState("website");
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState(null);

  function openRegistration(nextPlan = plan) {
    setPlan(nextPlan); setStatus(""); setSaved(null);
    dialog.current?.showModal();
  }
  function submit(event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    try {
      const entry = saveRegistration(window.localStorage, { name: data.get("name"), email: data.get("email"), plan, goal: data.get("goal") });
      setSaved(entry); setStatus(""); event.currentTarget.reset();
    } catch (error) {
      setStatus(error?.message || "Trình duyệt chưa cho phép lưu đăng ký. Vui lòng thử lại.");
    }
  }

  return <>
    <header className="navigation shell">
      <a className="brand" href="#home"><span className="brand-symbol" aria-hidden="true">L<span>✦</span></span>{site.brand}</a>
      <nav aria-label="Điều hướng chính"><a href="#showcase">Khám phá</a><a href="#packages">Các gói</a><a href="#faq">Câu hỏi</a></nav>
      <button className="button small" onClick={() => openRegistration()}>{site.cta}<Arrow /></button>
    </header>
    <main>
      <section className="hero shell" id="home">
        <div className="hero-copy"><p className="eyebrow">{site.eyebrow}</p><h1>{site.headline}<br/><em>{site.highlight}</em></h1><p className="intro">{site.description}</p>
          <div className="hero-actions"><button className="button gold" onClick={() => openRegistration()}>{site.cta}<Arrow /></button><a className="text-link" href="#showcase">Xem website mẫu <span aria-hidden="true">↓</span></a></div>
          <div className="hero-note"><span className="status-dot"/>Không cần tài khoản. Bạn có thể thử ngay.</div>
        </div>
        <div className="hero-art" aria-label="Minh họa một chiến dịch website">
          <div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="hero-spark" aria-hidden="true">✦</span>
          <div className="preview-card"><div className="preview-top"><span className="window-dots">● ● ●</span><span>YOUR NEXT LAUNCH</span></div><div className="preview-content"><span className="mini-eyebrow">HELLO, NEW IDEAS</span><h2>Một câu chuyện<br/>đáng được nhìn thấy.</h2><div className="preview-lines"><i/><i/></div><span className="preview-button">Bắt đầu từ đây ↗</span><div className="preview-shapes"><span/><span/><span/></div></div></div>
          <div className="floating-label label-a"><span>↗</span>Thiết kế có chủ đích</div><div className="floating-label label-b"><span>✓</span>Tương tác thật dễ</div>
        </div>
      </section>
      <section className="principles shell" aria-label="Điểm nổi bật"><div><span>01</span><strong>Nội dung rõ ràng</strong></div><div><span>02</span><strong>Chuyển động vừa đủ</strong></div><div><span>03</span><strong>Đăng ký trong vài bước</strong></div></section>
      <section className="showcase shell section" id="showcase">
        <div className="section-heading"><p className="eyebrow">CHẠM ĐỂ KHÁM PHÁ</p><h2>Một trải nghiệm.<br/><em>Nhiều cách kể chuyện.</em></h2><p>Chọn từng mục để xem các thành phần bạn có thể thay đổi cho chiến dịch của mình.</p></div>
        <div className="showcase-body"><div className="tabs" role="tablist" aria-label="Khám phá website">{[["website", "Website"], ["form", "Đăng ký"], ["mobile", "Điện thoại"]].map(([id, label]) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls="showcase-panel" onClick={() => setTab(id)}>{label}</button>)}</div>
          <div className="showcase-panel" id="showcase-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "website" ? <><div className="panel-art"><span className="panel-sun"/><span className="panel-block"/><span className="panel-pill"/></div><h3>Mở đầu có cá tính</h3><p>Đổi tên thương hiệu, thông điệp, màu sắc và các mục nội dung. Mỗi lần lưu file là một lần thử ý tưởng mới.</p></> : tab === "form" ? <><div className="form-preview"><span>Họ và tên</span><span>Email của bạn</span><span className="form-preview-cta">Đăng ký tư vấn ↗</span></div><h3>Thử một đăng ký thật</h3><p>Form kiểm tra tên và email, chọn gói, lưu trên trình duyệt rồi hiện xác nhận.</p><button className="button" onClick={() => openRegistration()}>Mở form đăng ký<Arrow /></button></> : <><div className="phone-preview"><span className="phone-notch"/><span className="phone-logo">L✦</span><strong>Ý tưởng lớn.<br/>Màn hình nhỏ.</strong><i/><i/><span className="phone-cta">Bắt đầu ↗</span></div><h3>Linh hoạt theo màn hình</h3><p>Thu nhỏ cửa sổ hoặc dùng điện thoại: bố cục, nút bấm và nội dung sẽ thích ứng.</p></>}
          </div>
        </div>
      </section>
      <section className="packages-section section" id="packages"><div className="shell"><div className="packages-heading"><div><p className="eyebrow">GIÁ VÀ GÓI MINH HỌA</p><h2>Chọn điểm bắt đầu<br/><em>phù hợp với bạn.</em></h2></div><p>Ba gói mẫu để thực hành. Bấm chọn gói và thử luồng đăng ký.</p></div><div className="package-grid">{site.packages.map(item => <article key={item.id} className={`package ${plan === item.id ? "selected" : ""}`}><div className="package-top"><h3>{item.name}</h3>{item.id === "grow" && <span>GÓI NỔI BẬT</span>}</div><p>{item.tagline}</p><div className="price">{item.price}<small>{item.id !== "custom" ? "VNĐ / gói mẫu" : "Theo nhu cầu"}</small></div><ul>{item.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul><button className={`button ${plan === item.id ? "gold" : "outline"}`} onClick={() => openRegistration(item.id)}>Chọn {item.name}<Arrow /></button></article>)}</div></div></section>
      <section className="faq shell section" id="faq"><div><p className="eyebrow">TRƯỚC KHI BẮT ĐẦU</p><h2>Bạn muốn biết<br/><em>thêm điều gì?</em></h2></div><div className="faq-list">{site.faqs.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
      <section className="closing shell"><span className="closing-spark" aria-hidden="true">✦</span><div><p className="eyebrow">THỬ NGAY TRÊN MÁY CỦA BẠN</p><h2>Website kế tiếp<br/>mang dấu ấn của bạn.</h2></div><button className="button gold" onClick={() => openRegistration()}>Bắt đầu đăng ký<Arrow /></button></section>
    </main>
    <footer className="footer shell"><span>{site.brand} · Dự án mẫu EIU</span><p>Đăng ký mẫu được lưu trên trình duyệt này; chưa gửi đến doanh nghiệp.</p><a href="#home">Lên đầu trang ↑</a></footer>
    <dialog ref={dialog} className="registration-dialog" aria-labelledby="registration-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <button className="dialog-close" aria-label="Đóng đăng ký" onClick={() => dialog.current?.close()}>×</button>
      {saved ? <div className="confirmation" role="status"><span className="confirmation-mark">✓</span><p className="eyebrow">ĐĂNG KÝ MẪU ĐÃ ĐƯỢC LƯU</p><h2 id="registration-title">Cảm ơn, {saved.name}.</h2><p>Bạn đã chọn gói <strong>{site.packages.find(item => item.id === saved.plan)?.name}</strong>. Thông tin đã được lưu trên trình duyệt này.</p><p className="fine-print">Bản mẫu chưa gửi email hoặc dữ liệu tới một dịch vụ bên ngoài.</p><button className="button" onClick={() => dialog.current?.close()}>Tiếp tục khám phá<Arrow /></button></div> : <><p className="eyebrow">BẮT ĐẦU TỪ MỘT CUỘC TRÒ CHUYỆN</p><h2 id="registration-title">Ý tưởng của bạn<br/>đang chờ được kể.</h2><p>Điền thông tin để thử luồng đăng ký.</p><form onSubmit={submit}><label>Họ và tên<input name="name" autoComplete="name" required maxLength={100} placeholder="Tên của bạn"/></label><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="ban@example.com"/></label><label>Gói bạn quan tâm<select name="plan" value={plan} onChange={event => setPlan(event.target.value)}>{site.packages.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Bạn muốn làm website cho điều gì?<textarea name="goal" rows={3} maxLength={1000} placeholder="Mô tả ngắn ý tưởng của bạn…"/></label>{status && <p className="form-error" role="alert">{status}</p>}<button className="button gold" type="submit">Lưu đăng ký mẫu<Arrow /></button><p className="fine-print">Thông tin chỉ được lưu trong trình duyệt để thực hành.</p></form></>}
    </dialog>
  </>;
}
