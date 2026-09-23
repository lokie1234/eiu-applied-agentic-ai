"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./QuizSlide.module.css";

type Question = {
  question: string;
  options: string[];
  answer: number;
};

type AnswerRecord = {
  question: string;
  selected: string;
  correct: string;
  isCorrect: boolean;
};

type QuizVariant = "section1" | "section2";

const SECTION_ONE_QUESTIONS: Question[] = [
  { question: "Sau khóa học, bạn sẽ tạo Web App bằng công cụ nào?", options: ["Gemini", "Google Drive", "Gmail", "QR Code"], answer: 0 },
  { question: "Google Sheets giữ vai trò nào trong Web App?", options: ["Frontend", "Business Logic", "Database", "Integrations"], answer: 2 },
  { question: "Theo slide Vai trò của con người, việc nào được nhấn mạnh?", options: ["Hiểu nghiệp vụ", "Viết Framework", "Học thuộc JavaScript", "Quản trị Server"], answer: 0 },
  { question: "Trong ví dụ nhà hàng, Frontend tương ứng với gì?", options: ["Bếp nấu ăn", "Kho nguyên liệu", "Nhân viên nhận order", "GrabFood"], answer: 2 },
  { question: "Trong Web App xin nghỉ, Database là gì?", options: ["Form xin nghỉ", "Kiểm tra phép · Gửi duyệt", "Google Sheets", "Gmail · Google Drive"], answer: 2 },
  { question: "Trong quy trình cơ bản, bước nào đứng ngay sau Google Sheets?", options: ["Gemini", "Google App Script", "Business Web App", "Google Drive"], answer: 1 },
  { question: "BƯỚC ĐẦU TIÊN không phải Code hay Prompt, mà là gì?", options: ["Yêu cầu nghiệp vụ", "Thiết kế giao diện", "Triển khai", "Kiểm thử"], answer: 0 },
  { question: "Nội dung nào thuộc nhóm Prompt tốt cần có?", options: ["Mục tiêu · Người dùng · Dữ liệu cần nhập", "HTML · CSS · JavaScript", "Logo · Email · QR Code", "Copy · Paste · Save"], answer: 0 },
  { question: "Khi Authorize, Google cần xác nhận ứng dụng được phép làm gì?", options: ["Đọc Google Sheets", "Tạo Gems", "Tạo QR Code", "Đổi tên folder"], answer: 0 },
  { question: "Khi kiểm thử, dấu hiệu nào cho thấy Web App thành công?", options: ["Google Sheets xuất hiện dòng mới", "Code.gs bị xóa", "URL đổi màu", "Gemini tự đóng"], answer: 0 },
];

const SECTION_TWO_QUESTIONS: Question[] = [
  { question: "AI Business Framework dùng để làm gì?", options: ["Chuẩn hóa các nguyên tắc dùng chung khi AI xây ứng dụng", "Thay Google Sheets bằng Excel", "Tạo tài khoản Gemini", "Lưu mật khẩu người dùng"], answer: 0 },
  { question: "Trong Section 2, phần nào thay đổi nhiều nhất giữa các ứng dụng?", options: ["Requirement của từng bài toán", "Quy tắc kiểm thử", "Tiêu chuẩn triển khai", "Nguyên tắc giao diện chung"], answer: 0 },
  { question: "Gem trong Gemini được mô tả đúng nhất là gì?", options: ["Một Gemini được tùy chỉnh bằng hướng dẫn và ngữ cảnh lặp lại", "Một file JavaScript", "Một plugin trình duyệt", "Một cơ sở dữ liệu"], answer: 0 },
  { question: "Bên trong một Gem gồm bốn phần nào?", options: ["Name · Instructions · Knowledge · Preview", "HTML · CSS · JS · SQL", "Drive · Sheets · Gmail · Calendar", "Form · Button · Table · Chart"], answer: 0 },
  { question: "Công thức Instructions cho Gem trong bài là gì?", options: ["Persona + Task + Context + Format", "Prompt + Code + Deploy + Test", "Name + Email + URL + Sheet", "Frontend + Backend + API + Server"], answer: 0 },
  { question: "Bước 1 của Lab 2 yêu cầu làm gì?", options: ["Phân tích hai ứng dụng và tách Framework", "Tạo ngay một Gem trống", "Chia sẻ link trước khi kiểm thử", "Xóa source code cũ"], answer: 0 },
  { question: "Knowledge trong Gem có vai trò gì?", options: ["Chứa tài liệu tham chiếu để Gemini áp dụng Framework", "Lưu điểm Quiz", "Thay thế hoàn toàn Instructions", "Chỉ dùng để lưu hình nền"], answer: 0 },
  { question: "Preview được dùng ở bước nào?", options: ["Kiểm thử Gem bằng một Requirement mới trước khi lưu", "Đổi tên Google Sheet", "Tạo mật khẩu admin", "Xuất PDF tự động"], answer: 0 },
  { question: "Nội dung nào thuộc phần có thể tái sử dụng?", options: ["Kiến trúc, UI, quy tắc code, database, kiểm thử và triển khai", "Tên người dùng của từng dự án", "Một yêu cầu nghiệp vụ duy nhất", "Ngày tạo của từng ứng dụng"], answer: 0 },
  { question: "Thông điệp cuối của Section 2 là gì?", options: ["Xây 01 AI Business Framework để AI có thể tạo nhiều ứng dụng theo cùng tiêu chuẩn", "Mỗi ứng dụng phải có một framework hoàn toàn khác", "Không cần kiểm thử khi dùng Gem", "Chỉ dùng Gem cho một dự án"], answer: 0 },
];

function resultLabel(score: number) {
  if (score >= 9) return "Xuất sắc";
  if (score >= 7) return "Hoàn thành tốt";
  if (score >= 5) return "Đã nắm phần chính";
  return "Nên xem lại bài";
}

type Props = { scale: number; variant?: QuizVariant };

export default function QuizSlide({ scale, variant = "section1" }: Props) {
  const questions = variant === "section2" ? SECTION_TWO_QUESTIONS : SECTION_ONE_QUESTIONS;
  const handoutHref = variant === "section2"
    ? "/downloads/eiu-applied-agentic-ai-section-2-handout.pdf"
    : "/downloads/eiu-applied-agentic-ai-section-1-handout.pdf";
  const handoutName = variant === "section2"
    ? "EIU_Applied_Agentic_AI_Section2_Handout.pdf"
    : "EIU_Applied_Agentic_AI_Section1_Handout.pdf";

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const [name, setName] = useState("");
  const [emailLocalPart, setEmailLocalPart] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [quizUnlocked, setQuizUnlocked] = useState(false);
  const [quizCode, setQuizCode] = useState("");
  const [quizError, setQuizError] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const score = answers.filter((item) => item.isCorrect).length;
  const current = questions[index];

  function chooseAnswer(optionIndex: number) {
    if (selected !== null || finished) return;

    setSelected(optionIndex);
    const record: AnswerRecord = {
      question: current.question,
      selected: current.options[optionIndex],
      correct: current.options[current.answer],
      isCorrect: optionIndex === current.answer,
    };
    setAnswers((items) => [...items, record]);

    timerRef.current = window.setTimeout(() => {
      if (index === questions.length - 1) {
        setFinished(true);
      } else {
        setIndex((value) => value + 1);
        setSelected(null);
      }
      timerRef.current = null;
    }, 620);
  }

  async function unlockQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuizError("");
    const response = await fetch("/api/quiz-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: quizCode, section: variant }),
    });
    if (response.ok) setQuizUnlocked(true);
    else setQuizError("Mã truy cập Quiz không đúng.");
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setMessage("");

    const fullEmail = `${emailLocalPart.trim()}@eiu.edu.vn`;
    const fullName = name.trim();

    try {
      const response = await fetch("/api/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: variant,
          name: fullName,
          email: fullEmail,
          website,
          score,
          total: questions.length,
          completedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Không thể gửi kết quả.");
      setSubmittedEmail(fullEmail);
      setSubmittedName(fullName);
      setStatus("success");
      setMessage("Đã lưu kết quả vào bảng dữ liệu.");
      // Tự động chuyển sang cửa sổ gửi feedback sau khi gửi kết quả
      setShowFeedbackModal(true);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể gửi kết quả.");
    }
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feedbackStatus === "sending" || !feedbackText.trim()) return;

    setFeedbackStatus("sending");
    setFeedbackMessage("");

    try {
      const emailToUse = submittedEmail || `${emailLocalPart.trim()}@eiu.edu.vn`;
      const nameToUse = submittedName || name.trim();

      const response = await fetch("/api/quiz-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: variant,
          name: nameToUse,
          email: emailToUse,
          feedback: feedbackText.trim(),
          submittedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Không thể gửi phản hồi.");
      setFeedbackStatus("success");
      setFeedbackSubmitted(true);
      setFeedbackMessage("Cảm ơn bạn đã gửi ý kiến đóng góp!");
      setTimeout(() => {
        setShowFeedbackModal(false);
      }, 1500);
    } catch (error) {
      setFeedbackStatus("error");
      setFeedbackMessage(error instanceof Error ? error.message : "Không thể gửi phản hồi.");
    }
  }

  function restart() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setFinished(false);
    setStatus("idle");
    setMessage("");
    setShowFeedbackModal(false);
    setFeedbackText("");
    setFeedbackStatus("idle");
    setFeedbackMessage("");
    setFeedbackSubmitted(false);
    setSubmittedEmail("");
    setSubmittedName("");
  }

  return (
    <section
      className={styles.root}
      style={{ transform: `scale(${scale})`, fontFamily: '"Segoe UI", "Noto Sans", Arial, sans-serif' }}
      lang="vi"
      data-interactive="true"
      aria-label={`Bài kiểm tra cuối ${variant === "section2" ? "Section 2" : "Section 1"}`}
    >
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.orbA} aria-hidden="true" />
      <div className={styles.orbB} aria-hidden="true" />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EIU - Applied Agentic AI · {variant === "section2" ? "Section 2" : "Section 1"}</span>
          <h1>Quiz time!</h1>
        </div>
        <div className={styles.headerActions}>
          <a
            className={styles.downloadButton}
            href={handoutHref}
            download={handoutName}
          >
            <span aria-hidden="true">↓</span>
            Tải handout
          </a>
          <div className={styles.counter}>{finished ? "Hoàn thành" : `Câu ${index + 1} / ${questions.length}`}</div>
        </div>
      </header>

      {!quizUnlocked ? (
        <div className={styles.questionCard}>
          <h2>Nhập mã để mở Quiz</h2>
          <form onSubmit={unlockQuiz}>
            <input value={quizCode} onChange={(e) => setQuizCode(e.target.value)} placeholder="Mã truy cập" />
            <button type="submit" className={styles.retry}>Bắt đầu Quiz</button>
          </form>
          {quizError && <p>{quizError}</p>}
        </div>
      ) : !finished ? (
        <div className={styles.quizBody}>
          <div className={styles.progress} aria-hidden="true">
            <span style={{ width: `${((index + (selected === null ? 0 : 1)) / questions.length) * 100}%` }} />
          </div>
          <div className={styles.questionCard}>
            <span className={styles.questionNumber}>{String(index + 1).padStart(2, "0")}</span>
            <h2>{current.question}</h2>
            <div className={styles.options}>
              {current.options.map((option, optionIndex) => {
                const isSelected = selected === optionIndex;
                const isCorrect = selected !== null && optionIndex === current.answer;
                const isWrong = isSelected && optionIndex !== current.answer;
                return (
                  <button
                    type="button"
                    key={option}
                    className={`${styles.option} ${isCorrect ? styles.correct : ""} ${isWrong ? styles.wrong : ""}`}
                    onClick={() => chooseAnswer(optionIndex)}
                    disabled={selected !== null}
                  >
                    <span className={styles.check} aria-hidden="true">{isSelected || isCorrect ? "✓" : ""}</span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.resultGrid}>
          <div className={styles.resultCard} aria-live="polite">
            <span className={styles.resultKicker}>Kết quả của bạn</span>
            <div className={styles.score}><strong>{score}</strong><span>/ {questions.length}</span></div>
            <h2>{resultLabel(score)}</h2>
            <p>Bạn đã hoàn thành 10 câu hỏi của {variant === "section2" ? "Section 2" : "Section 1"}.</p>
            <button type="button" className={styles.retry} onClick={restart}>Làm lại</button>
          </div>

          {status === "success" ? (
            <div className={styles.submittedCard} aria-live="polite">
              <span className={styles.formKicker}>Ghi nhận kết quả</span>
              <h3>Đã lưu kết quả bài kiểm tra!</h3>
              <div className={styles.submittedInfo}>
                <div><span>Họ và tên:</span> <strong>{submittedName || name}</strong></div>
                <div><span>Email EIU:</span> <strong>{submittedEmail || `${emailLocalPart}@eiu.edu.vn`}</strong></div>
                <div><span>Điểm số:</span> <strong>{score} / {questions.length}</strong></div>
              </div>
              <p className={styles.submittedNotice}>
                {feedbackSubmitted
                  ? "✓ Cảm ơn bạn đã gửi ý kiến đóng góp cho bài học!"
                  : "Kết quả đã lưu. Bạn có thể mở lại cửa sổ để gửi phản hồi."}
              </p>
              <button
                type="button"
                className={styles.openFeedbackBtn}
                onClick={() => setShowFeedbackModal(true)}
              >
                {feedbackSubmitted ? "Gửi thêm phản hồi" : "Mở cửa sổ gửi feedback"}
              </button>
            </div>
          ) : (
            <form className={styles.formCard} onSubmit={submitResult}>
              <span className={styles.formKicker}>Ghi nhận kết quả</span>
              <p>Nhập họ tên và email EIU để lưu kết quả vào bảng dữ liệu của lớp.</p>
              <label>Họ và tên<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
              <label>Email EIU<div className={styles.emailField}><input value={emailLocalPart} onChange={(event) => setEmailLocalPart(event.target.value.replace(/@.*$/, ""))} maxLength={64} pattern="[A-Za-z0-9._%+\-]+" autoComplete="email" aria-label="Tên tài khoản email EIU" required /><span>@eiu.edu.vn</span></div></label>
              <label className={styles.honeypot} aria-hidden="true">Website<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
              <button type="submit" className={styles.submit} disabled={status === "sending"}>
                {status === "sending" ? "Đang gửi..." : "Gửi kết quả"}
              </button>
              {message && <p className={`${styles.message} ${status === "error" ? styles.error : ""}`} role="status">{message}</p>}
            </form>
          )}
        </div>
      )}

      {showFeedbackModal && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <div className={styles.feedbackModal}>
            <div className={styles.feedbackHeader}>
              <div>
                <span className={styles.eyebrow}>
                  Góp ý & Phản hồi · {variant === "section2" ? "Section 2" : "Section 1"}
                </span>
                <h2 id="feedback-title">Gửi feedback bài học (ẩn danh)</h2>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowFeedbackModal(false)}
                aria-label="Đóng cửa sổ feedback"
              >
                ✕
              </button>
            </div>

            <p className={styles.feedbackSub}>
              Ý kiến của bạn giúp ban tổ chức hoàn thiện và nâng cao chất lượng khóa học.
            </p>

            <form className={styles.feedbackForm} onSubmit={submitFeedback}>
              <textarea
                className={styles.feedbackTextarea}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Nhập ý kiến đóng góp, phản hồi hoặc cảm nghĩ của bạn tại đây..."
                rows={4}
                maxLength={2000}
                required
                autoFocus
              />

              <div className={styles.feedbackActions}>
                <button
                  type="submit"
                  className={styles.submitFeedbackBtn}
                  disabled={feedbackStatus === "sending" || feedbackStatus === "success"}
                >
                  {feedbackStatus === "sending" ? "Đang gửi..." : feedbackStatus === "success" ? "Đã gửi feedback" : "Gửi feedback"}
                </button>
                <button
                  type="button"
                  className={styles.skipBtn}
                  onClick={() => setShowFeedbackModal(false)}
                >
                  {feedbackStatus === "success" ? "Đóng" : "Bỏ qua"}
                </button>
              </div>

              {feedbackMessage && (
                <p className={`${styles.message} ${feedbackStatus === "error" ? styles.error : ""}`} role="status">
                  {feedbackMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
