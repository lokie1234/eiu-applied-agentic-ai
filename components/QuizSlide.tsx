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
  { question: "Công cụ AI chính trong khóa học là gì?", options: ["Gemini", "Canva", "Excel", "PowerPoint"], answer: 0 },
  { question: "Google Sheets đóng vai trò gì?", options: ["Frontend", "Database", "Hosting", "Trình duyệt"], answer: 1 },
  { question: "Web App trong Lab chạy trên nền tảng nào?", options: ["WordPress", "Figma", "Google Apps Script", "PowerPoint"], answer: 2 },
  { question: "Trước khi viết code, cần làm gì đầu tiên?", options: ["Chọn màu", "Gửi email", "Deploy", "Xác định yêu cầu nghiệp vụ"], answer: 3 },
  { question: "Garbage In dẫn đến điều gì?", options: ["Perfect Output", "Garbage Out", "No Output", "Faster Code"], answer: 1 },
  { question: "Phần nào hiển thị giao diện cho người dùng?", options: ["Database", "Business Logic", "Frontend", "Integration"], answer: 2 },
  { question: "Prompt tốt cần nêu rõ điều gì?", options: ["Chỉ màu sắc", "Mục tiêu và yêu cầu", "Chỉ tên file", "Chỉ mật khẩu"], answer: 1 },
  { question: "Khi chạy ứng dụng lần đầu cần làm gì?", options: ["Xóa Sheet", "Tắt Drive", "Đổi trình duyệt", "Authorize"], answer: 3 },
  { question: "Dấu hiệu gửi dữ liệu thành công là gì?", options: ["Sheets xuất hiện dòng mới", "Máy tự tắt", "File biến mất", "URL đổi màu"], answer: 0 },
  { question: "Chu trình AI gồm Requirement, Generate, Test và gì?", options: ["Delete", "Print", "Improve", "Logout"], answer: 2 },
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
  const [email, setEmail] = useState("");
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
          email,
          website,
          score,
          total: QUESTIONS.length,
          answers,
          completedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Không thể gửi kết quả.");
      setStatus("success");
      setMessage("Đã ghi nhận và gửi kết quả thành công.");
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
    <section className={styles.root} style={{ transform: `scale(${scale})` }} data-interactive="true" aria-label="Quiz time">
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.orbA} aria-hidden="true" />
      <div className={styles.orbB} aria-hidden="true" />
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>EIU · Applied Agentic AI</span>
          <h1>Quiz time</h1>
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
            <p>Bạn đã hoàn thành 10 câu hỏi của phần Applied Agentic AI.</p>
            <button type="button" className={styles.retry} onClick={restart}>Làm lại</button>
          </div>

          <form className={styles.formCard} onSubmit={submitResult}>
            <span className={styles.formKicker}>Ghi nhận kết quả</span>
            <label>Họ và tên<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={160} required /></label>
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
