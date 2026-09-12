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

const QUESTIONS: Question[] = [
  { question: "Trong khóa học, trí tuệ nhân tạo giúp người học làm gì?", options: ["Biến ý tưởng thành ứng dụng", "Chỉ thay đổi màu sắc", "Chỉ lưu hình ảnh", "Chỉ trình chiếu nội dung"], answer: 0 },
  { question: "Bảng tính trực tuyến giữ vai trò nào trong ứng dụng?", options: ["Trang trí giao diện", "Lưu trữ dữ liệu", "Kiểm tra mật khẩu", "Phát video"], answer: 1 },
  { question: "Nền tảng lập trình của Google được dùng để làm gì?", options: ["Tạo và triển khai ứng dụng", "Soạn thảo văn bản", "Vẽ sơ đồ", "Chỉnh sửa hình ảnh"], answer: 0 },
  { question: "Trước khi tạo mã nguồn, cần làm gì đầu tiên?", options: ["Chọn màu", "Gửi thư", "Đăng tải ứng dụng", "Xác định yêu cầu nghiệp vụ"], answer: 3 },
  { question: "Dữ liệu đầu vào kém thường tạo ra kết quả như thế nào?", options: ["Hoàn hảo", "Kém chất lượng", "Nhanh hơn", "Không thay đổi"], answer: 1 },
  { question: "Phần giao diện có nhiệm vụ gì?", options: ["Lưu dữ liệu", "Xử lý quy tắc", "Hiển thị và nhận thao tác", "Kết nối thư điện tử"], answer: 2 },
  { question: "Một Prompt tốt cần nêu rõ điều gì?", options: ["Chỉ màu sắc", "Mục tiêu và yêu cầu", "Chỉ tên tệp", "Chỉ mật khẩu"], answer: 1 },
  { question: "Khi chạy ứng dụng lần đầu, người dùng cần làm gì?", options: ["Xóa bảng dữ liệu", "Tắt ổ lưu trữ", "Đổi trình duyệt", "Cấp quyền truy cập"], answer: 3 },
  { question: "Dấu hiệu gửi dữ liệu thành công là gì?", options: ["Bảng dữ liệu có dòng mới", "Máy tính tự tắt", "Tệp bị xóa", "Địa chỉ đổi màu"], answer: 0 },
  { question: "Sau khi kiểm thử, bước tiếp theo trong chu trình là gì?", options: ["Xóa ứng dụng", "In tài liệu", "Tiếp tục cải thiện", "Đăng xuất"], answer: 2 },
];

function resultLabel(score: number) {
  if (score >= 9) return "Xuất sắc";
  if (score >= 7) return "Hoàn thành tốt";
  if (score >= 5) return "Đã nắm phần chính";
  return "Nên xem lại bài";
}

type Props = { scale: number };

export default function QuizSlide({ scale }: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const score = answers.filter((item) => item.isCorrect).length;
  const current = QUESTIONS[index];

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
      if (index === QUESTIONS.length - 1) {
        setFinished(true);
      } else {
        setIndex((value) => value + 1);
        setSelected(null);
      }
      timerRef.current = null;
    }, 620);
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/quiz-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          website,
          score,
          total: QUESTIONS.length,
          completedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Không thể gửi kết quả.");
      setStatus("success");
      setMessage("Đã lưu kết quả vào bảng dữ liệu.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Không thể gửi kết quả.");
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
  }

  return (
    <section
      className={styles.root}
      style={{ transform: `scale(${scale})`, fontFamily: '"Segoe UI", "Noto Sans", Arial, sans-serif' }}
      lang="vi"
      data-interactive="true"
      aria-label="Bài kiểm tra cuối bài"
    >
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.orbA} aria-hidden="true" />
      <div className={styles.orbB} aria-hidden="true" />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EIU · Ứng dụng trí tuệ nhân tạo tác nhân</span>
          <h1>Kiểm tra cuối bài</h1>
        </div>
        <div className={styles.counter}>{finished ? "Hoàn thành" : `Câu ${index + 1} / ${QUESTIONS.length}`}</div>
      </header>

      {!finished ? (
        <div className={styles.quizBody}>
          <div className={styles.progress} aria-hidden="true">
            <span style={{ width: `${((index + (selected === null ? 0 : 1)) / QUESTIONS.length) * 100}%` }} />
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
            <div className={styles.score}><strong>{score}</strong><span>/ {QUESTIONS.length}</span></div>
            <h2>{resultLabel(score)}</h2>
            <p>Bạn đã hoàn thành 10 câu hỏi của bài học.</p>
            <button type="button" className={styles.retry} onClick={restart}>Làm lại</button>
          </div>

          <form className={styles.formCard} onSubmit={submitResult}>
            <span className={styles.formKicker}>Ghi nhận kết quả</span>
            <p>Nhập họ tên để lưu kết quả vào bảng dữ liệu của lớp.</p>
            <label>Họ và tên<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
            <label className={styles.honeypot} aria-hidden="true">Website<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
            <button type="submit" className={styles.submit} disabled={status === "sending" || status === "success"}>
              {status === "sending" ? "Đang gửi..." : status === "success" ? "Đã gửi" : "Gửi kết quả"}
            </button>
            {message && <p className={`${styles.message} ${status === "error" ? styles.error : ""}`} role="status">{message}</p>}
          </form>
        </div>
      )}
    </section>
  );
}
