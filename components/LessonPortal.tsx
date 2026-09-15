"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import type { AccessRole } from "@/lib/access";
import styles from "./LessonPortal.module.css";

const SectionOneDeck = dynamic(() => import("./PdfDeck"), { ssr: false });
const SectionTwoDeck = dynamic(() => import("./section2/SectionTwoDeck"), { ssr: false });

type SectionId = "section1" | "section2";
type TerminateStatus = "idle" | "sending" | "success" | "error";

type DeckShellProps = {
  children: ReactNode;
  isAdmin: boolean;
  statusNotice?: string;
  onChooseSection?: () => void;
  onOpenTerminate?: () => void;
  onSignOut: () => void;
};

function DeckShell({
  children,
  isAdmin,
  statusNotice,
  onChooseSection,
  onOpenTerminate,
  onSignOut,
}: DeckShellProps) {
  return (
    <div className={styles.lessonShell}>
      <div className={styles.deckViewport}>{children}</div>

      <aside className={styles.actionBar} aria-label="Session controls">
        <div className={styles.actionBarIdentity} aria-live="polite">
          <span>EIU · APPLIED AGENTIC AI</span>
          <strong>
            {statusNotice || (isAdmin ? "Admin mode" : "Learning session")}
          </strong>
        </div>

        <div className={styles.actionBarButtons}>
          {isAdmin && onChooseSection && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onChooseSection}
            >
              Sections
            </button>
          )}

          {isAdmin && onOpenTerminate && (
            <button
              type="button"
              className={styles.terminateBtn}
              onClick={onOpenTerminate}
            >
              Terminate Section
            </button>
          )}

          <button
            type="button"
            className={styles.signOutButton}
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>
    </div>
  );
}

export default function LessonPortal({ role }: { role: AccessRole }) {
  const [adminSection, setAdminSection] = useState<SectionId | null>(null);
  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateStatus, setTerminateStatus] =
    useState<TerminateStatus>("idle");
  const [terminateNotice, setTerminateNotice] = useState("");
  const section = role === "admin" ? adminSection : role;

  async function signOut() {
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace("/login");
  }

  async function terminateSection() {
    if (role !== "admin" || !section || terminateStatus === "sending") return;

    setTerminateStatus("sending");
    setTerminateNotice("");

    try {
      const response = await fetch("/api/section-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Không thể kết thúc Section.");
      }

      setShowTerminate(false);
      setTerminateStatus("success");
      setTerminateNotice(
        `Đã gửi lệnh kết thúc ${section === "section1" ? "Section 1" : "Section 2"}.`,
      );
      // Admin deliberately remains in the current section.
    } catch (error) {
      setTerminateStatus("error");
      setTerminateNotice(
        error instanceof Error ? error.message : "Không thể kết thúc Section.",
      );
    }
  }

  useEffect(() => {
    const onPageShow = () => {
      const storedRole = localStorage.getItem("eiu-role");
      if (storedRole && storedRole !== role) {
        localStorage.removeItem("eiu-role");
      }
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [role]);

  useEffect(() => {
    if (role === "admin") return;

    let disposed = false;
    let checking = false;
    let baselineToken: string | null = null;

    async function forceUserLogout() {
      await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/login?reason=terminated");
    }

    async function checkTermination() {
      if (disposed || checking) return;
      checking = true;

      try {
        const response = await fetch(
          `/api/section-control?section=${encodeURIComponent(role)}`,
          { cache: "no-store" },
        );

        if (response.status === 401) {
          disposed = true;
          await forceUserLogout();
          return;
        }

        if (!response.ok) return;

        const payload = (await response.json()) as {
          success?: boolean;
          token?: string;
        };
        if (payload.success !== true || !payload.token) return;

        if (baselineToken === null) {
          baselineToken = payload.token;
          return;
        }

        if (payload.token !== baselineToken) {
          disposed = true;
          await forceUserLogout();
        }
      } catch {
        // A temporary connection failure must not unexpectedly sign the user out.
      } finally {
        checking = false;
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkTermination();
    };

    void checkTermination();
    const timer = window.setInterval(() => void checkTermination(), 2000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [role]);

  if (role === "admin" && !section) {
    return (
      <main className={styles.portal}>
        <div className={styles.grid} aria-hidden="true" />

        <div className={styles.selectorActions}>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>

        <section className={styles.panel}>
          <div className={styles.brand}>
            <div className={styles.logoWindow}>
              <Image
                src="/branding/EIU-logo-white.png"
                alt="EIU"
                width={2048}
                height={2048}
                priority
                unoptimized
              />
            </div>
            <div>
              <span>ADMIN ACCESS</span>
              <strong>EIU - Applied Agentic AI</strong>
            </div>
          </div>

          <div className={styles.heading}>
            <span>CHỌN NỘI DUNG</span>
            <h1>Bạn muốn mở Section nào?</h1>
            <p>Mã quản trị 1103 có thể xem và chuyển đổi giữa cả hai phần học.</p>
          </div>

          <div className={styles.cards}>
            <button type="button" onClick={() => setAdminSection("section1")}>
              <span>SECTION 1</span>
              <strong>Từ Prompt đến Web App</strong>
              <small>41 slide · PDF + HTML interactive</small>
              <i>→</i>
            </button>
            <button type="button" onClick={() => setAdminSection("section2")}>
              <span>SECTION 2</span>
              <strong>Từ Prompt đến AI Business Framework</strong>
              <small>39 slide · HTML/CSS/React</small>
              <i>→</i>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <DeckShell
        isAdmin={role === "admin"}
        statusNotice={role === "admin" ? terminateNotice : undefined}
        onChooseSection={role === "admin" ? () => setAdminSection(null) : undefined}
        onOpenTerminate={
          role === "admin"
            ? () => {
                setTerminateStatus("idle");
                setTerminateNotice("");
                setShowTerminate(true);
              }
            : undefined
        }
        onSignOut={signOut}
      >
        {section === "section2" ? (
          <SectionTwoDeck isAdmin={role === "admin"} />
        ) : (
          <SectionOneDeck isAdmin={role === "admin"} />
        )}
      </DeckShell>

      {role === "admin" && section && showTerminate && (
        <div
          className={styles.modalLayer}
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.currentTarget === event.target &&
              terminateStatus !== "sending"
            ) {
              setShowTerminate(false);
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="terminate-title"
          >
            <span>ADMIN ACTION</span>
            <h2 id="terminate-title">Terminate current section?</h2>
            <p>
              Users đang truy cập Section này sẽ được đưa về màn hình đăng nhập.
              Admin vẫn ở lại để tiếp tục kiểm tra.
            </p>
            {terminateStatus === "error" && terminateNotice && (
              <p role="alert">{terminateNotice}</p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowTerminate(false)}
                disabled={terminateStatus === "sending"}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmTerminateButton}
                onClick={() => void terminateSection()}
                disabled={terminateStatus === "sending"}
              >
                {terminateStatus === "sending" ? "Terminating..." : "Terminate"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
