"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
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

type CompletedLearner = {
  name: string;
  completedAt: string;
};

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

type Props = { scale: number; variant?: QuizVariant; isAdmin?: boolean };

export default function QuizSlide({ scale, variant = "section1", isAdmin = false }: Props) {
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
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [feedbackCountdown, setFeedbackCountdown] = useState(5);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStateStatus, setQuizStateStatus] = useState<"loading" | "ready" | "error">("loading");
  const [completedLearners, setCompletedLearners] = useState<CompletedLearner[]>([]);
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);
  const [openStatus, setOpenStatus] = useState<"idle" | "sending" | "error">("idle");
  const [openMessage, setOpenMessage] = useState("");
  const timerRef = useRef<number | null>(null);
  const autoSubmitStartedRef = useRef(false);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const loadQuizState = useCallback(async () => {
    try {
      const response = await fetch(`/api/quiz-control?section=${variant}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        isOpen?: boolean;
        completedLearners?: CompletedLearner[];
        message?: string;
      };
      if (!response.ok) throw new Error(payload.message || "Không thể tải trạng thái Quiz.");

      setQuizOpen(payload.isOpen === true);
      if (isAdmin) setCompletedLearners(payload.completedLearners ?? []);
      setQuizStateStatus("ready");
    } catch {
      setQuizStateStatus("error");
    }
  }, [isAdmin, variant]);

  useEffect(() => {
    let refreshTimer: number | undefined;
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadQuizState(), 120);
    };

    const initialTimer = window.setTimeout(() => void loadQuizState(), 0);
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      ?.channel(`eiu:quiz:${variant}`)
      .on("broadcast", { event: "quiz_state_changed" }, refresh)
      .on("broadcast", { event: "quiz_results_changed" }, refresh)
      .subscribe();
    const fallbackTimer = window.setInterval(() => void loadQuizState(), 8_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(refreshTimer);
      window.clearInterval(fallbackTimer);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [loadQuizState, variant]);

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

  async function openQuiz() {
    if (!isAdmin || openStatus === "sending") return;
    setOpenStatus("sending");
    setOpenMessage("");

    try {
      const response = await fetch("/api/quiz-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: variant }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "Không thể mở Quiz.");

      setQuizOpen(true);
      setCompletedLearners([]);
      setQuizStateStatus("ready");
      setShowOpenConfirm(false);
      setOpenStatus("idle");
      await loadQuizState();
    } catch (error) {
      setOpenStatus("error");
      setOpenMessage(error instanceof Error ? error.message : "Không thể mở Quiz.");
    }
  }

  const submitResult = useCallback(async () => {
    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: variant,
          score,
          total: questions.length,
          answers,
          completedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Không thể gửi kết quả.");
      setStatus("success");
      setMessage("Kết quả đã được ghi nhận.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể gửi kết quả.");
    }
  }, [answers, questions.length, score, variant]);

  useEffect(() => {
    if (isAdmin || !finished || autoSubmitStartedRef.current) return;
    autoSubmitStartedRef.current = true;
    void submitResult();
  }, [finished, isAdmin, submitResult]);

  useEffect(() => {
    if (status !== "success") return;

    let remaining = 5;
    const countdownTimer = window.setInterval(() => {
      remaining -= 1;
      setFeedbackCountdown(remaining);
      if (remaining === 0) {
        window.clearInterval(countdownTimer);
        setShowFeedbackModal(true);
      }
    }, 1000);

    return () => window.clearInterval(countdownTimer);
  }, [status]);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feedbackStatus === "sending" || !feedbackText.trim()) return;

    setFeedbackStatus("sending");
    setFeedbackMessage("");

    try {
      const response = await fetch("/api/quiz-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: variant,
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
    autoSubmitStartedRef.current = false;
    setStatus("idle");
    setMessage("");
    setFeedbackCountdown(5);
    setShowFeedbackModal(false);
    setFeedbackText("");
    setFeedbackStatus("idle");
    setFeedbackMessage("");
    setFeedbackSubmitted(false);
  }

  const sectionLabel = variant === "section2" ? "Section 2" : "Section 1";
  const rootStyle = {
    transform: `scale(${scale})`,
    fontFamily: '"Segoe UI", "Noto Sans", Arial, sans-serif',
  };

  if (isAdmin) {
    return (
      <section
        className={styles.root}
        style={rootStyle}
        lang="vi"
        data-interactive="true"
        aria-label={`Điều khiển Quiz ${sectionLabel}`}
      >
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.orbA} aria-hidden="true" />
        <div className={styles.orbB} aria-hidden="true" />

        {!quizOpen ? (
          <div className={styles.adminLaunchStage}>
            <span className={styles.adminKicker}>ADMIN CONTROL · {sectionLabel}</span>
            <h1>Quiz chưa được mở</h1>
            <p>Học viên đang chờ tại màn hình Quiz time.</p>

            {quizStateStatus === "error" ? (
              <button type="button" className={styles.stateRetryButton} onClick={() => void loadQuizState()}>
                Thử tải lại trạng thái
              </button>
            ) : (
              <button
                type="button"
                className={styles.openQuizButton}
                onClick={() => {
                  setOpenStatus("idle");
                  setOpenMessage("");
                  setShowOpenConfirm(true);
                }}
                disabled={quizStateStatus === "loading"}
              >
                {quizStateStatus === "loading" ? "Đang kiểm tra..." : "Mở Quiz!!!!"}
              </button>
            )}
          </div>
        ) : (
          <div className={styles.adminResultsStage}>
            <div className={styles.adminResultsHeading}>
              <span className={styles.adminKicker}>QUIZ ĐANG MỞ · {sectionLabel}</span>
              <h1>Học viên đã hoàn thành</h1>
              <p>Danh sách được cập nhật tự động khi học viên nộp bài.</p>
            </div>

            {completedLearners.length > 0 ? (
              <div className={styles.completedCloud} aria-live="polite">
                {completedLearners.map((learner) => (
                  <div className={styles.learnerBubble} key={`${learner.name}-${learner.completedAt}`}>
                    <span className={styles.learnerCheck} aria-hidden="true">✓</span>
                    <strong>{learner.name}</strong>
                    <small>Đã hoàn thành</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.adminEmptyState} aria-live="polite">
                <span aria-hidden="true">···</span>
                <p>Đang chờ học viên đầu tiên hoàn thành.</p>
              </div>
            )}
          </div>
        )}

        {showOpenConfirm && (
          <div className={styles.modalOverlay} role="presentation">
            <section
              className={styles.openConfirmModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="open-quiz-title"
            >
              <span className={styles.adminKicker}>XÁC NHẬN MỞ QUIZ</span>
              <h2 id="open-quiz-title">Mở Quiz cho toàn bộ học viên?</h2>
              <p>Sau khi xác nhận, màn hình chờ của học viên sẽ tự động chuyển sang câu hỏi đầu tiên.</p>
              {openStatus === "error" && openMessage && <p className={styles.openError} role="alert">{openMessage}</p>}
              <div className={styles.openConfirmActions}>
                <button
                  type="button"
                  className={styles.cancelOpenButton}
                  onClick={() => setShowOpenConfirm(false)}
                  disabled={openStatus === "sending"}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className={styles.confirmOpenButton}
                  onClick={() => void openQuiz()}
                  disabled={openStatus === "sending"}
                >
                  {openStatus === "sending" ? "Đang mở Quiz..." : "Đồng ý mở Quiz"}
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    );
  }

  if (!quizOpen) {
    return (
      <section
        className={styles.root}
        style={rootStyle}
        lang="vi"
        data-interactive="true"
        aria-label={`Màn hình chờ Quiz ${sectionLabel}`}
      >
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.orbA} aria-hidden="true" />
        <div className={styles.orbB} aria-hidden="true" />
        <div className={styles.waitingStage} aria-live="polite">
          <span className={styles.waitingKicker}>EIU · APPLIED AGENTIC AI · {sectionLabel}</span>
          <h1>Quiz time!</h1>
          <p>
            {quizStateStatus === "error"
              ? "Đang kết nối lại để kiểm tra trạng thái Quiz..."
              : "Vui lòng chờ Quiz được mở khóa"}
          </p>
          <div className={styles.waitingDots} aria-hidden="true"><i /><i /><i /></div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.root}
      style={rootStyle}
      lang="vi"
      data-interactive="true"
      aria-label={`Bài kiểm tra cuối ${sectionLabel}`}
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

      {!finished ? (
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
            <button
              type="button"
              className={styles.retry}
              onClick={restart}
              disabled={status === "idle" || status === "sending" || (status === "success" && feedbackCountdown > 0)}
            >
              Làm lại
            </button>
          </div>

          {status === "success" ? (
            <div className={styles.submittedCard} aria-live="polite">
              <span className={styles.formKicker}>Ghi nhận kết quả</span>
              <h3>Kết quả đã được ghi nhận.</h3>
              <div className={styles.submittedInfo}>
                <div><span>Học viên:</span> <strong>Đã nhận từ phiên đăng nhập</strong></div>
                <div><span>Điểm số:</span> <strong>{score} / {questions.length}</strong></div>
              </div>
              <p className={styles.submittedNotice}>
                {feedbackSubmitted
                  ? "✓ Cảm ơn bạn đã gửi ý kiến đóng góp cho bài học!"
                  : feedbackCountdown > 0
                    ? `Tự động chuyển sang màn hình feedback sau ${feedbackCountdown} giây.`
                    : "Đang chuyển sang màn hình feedback..."}
              </p>
              {feedbackCountdown === 0 && !showFeedbackModal && !feedbackSubmitted && (
                <button
                  type="button"
                  className={styles.openFeedbackBtn}
                  onClick={() => setShowFeedbackModal(true)}
                >
                  Mở lại màn hình feedback
                </button>
              )}
            </div>
          ) : (
            <div className={styles.formCard} aria-live="polite">
              <span className={styles.formKicker}>Ghi nhận kết quả</span>
              <h3>{status === "error" ? "Chưa thể ghi nhận kết quả" : "Đang ghi nhận kết quả..."}</h3>
              <p>
                {status === "error"
                  ? message
                  : "Kết quả đang được tự động gửi và lưu vào hệ thống."}
              </p>
              {status === "error" && (
                <button type="button" className={styles.submit} onClick={() => void submitResult()}>
                  Thử lại
                </button>
              )}
            </div>
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
                <h2 id="feedback-title">Gửi feedback bài học</h2>
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
