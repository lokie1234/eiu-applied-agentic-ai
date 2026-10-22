"use client";

import { useLearningLanguage } from "@/lib/learningLanguage";

export default function NoCourseAccess() {
  const { t, language } = useLearningLanguage();
  async function signOut() {
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/");
  }

  return (
    <main className="access-empty-page" lang={language}>
      <section className="access-empty-card">
        <span>EIU COURSE ACCESS</span>
        <h1>{t("No course access")}</h1>
        <p>
          {t("This passcode session does not have an active course folder. Please request a valid folder passcode from the administrator.", "Phiên truy cập này chưa có thư mục khóa học đang hoạt động. Vui lòng liên hệ quản trị viên để nhận mã truy cập hợp lệ.")}
        </p>
        <button type="button" onClick={() => void signOut()}>{t("Return to access")}</button>
      </section>
    </main>
  );
}
