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
          <h1>Quiz time!</h1>
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
