"use client";

export default function NoCourseAccess({ email }: { email: string }) {
  async function signOut() {
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/login");
  }

  return (
    <main className="access-empty-page">
      <section className="access-empty-card">
        <span>EIU COURSE ACCESS</span>
        <h1>Chưa được cấp khóa học</h1>
        <p>
          Tài khoản <strong>{email}</strong> đã đăng nhập thành công nhưng chưa có quyền xem khóa học.
          Vui lòng liên hệ admin để được cấp quyền.
        </p>
        <button type="button" onClick={() => void signOut()}>Đăng xuất</button>
      </section>
    </main>
  );
}
