"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./AdminAccessPortal.module.css";

type UserRow = {
  email: string;
  display_name: string | null;
  is_admin: boolean;
  status: "active" | "suspended";
  auth_user_id: string | null;
  created_at: string;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "active";
};

type SectionRow = {
  id: string;
  course_id: string;
  section_key: string;
  title: string;
  position: number;
  status: "draft" | "active";
};

type GrantRow = { user_email: string; section_id: string; granted_at: string };
type AccessPayload = {
  success: boolean;
  message?: string;
  users?: UserRow[];
  courses?: CourseRow[];
  sections?: SectionRow[];
  grants?: GrantRow[];
};

type Tab = "access" | "catalog";

export default function AdminAccessPortal({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [tab, setTab] = useState<Tab>("access");
  const [newEmail, setNewEmail] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [newSectionTitles, setNewSectionTitles] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const applyPayload = useCallback((payload: AccessPayload) => {
    setUsers(payload.users ?? []);
    setCourses(payload.courses ?? []);
    setSections(payload.sections ?? []);
    setGrants(payload.grants ?? []);
  }, []);

  useEffect(() => {
    let disposed = false;
    void fetch("/api/admin/access", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as AccessPayload;
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || "Không thể tải dữ liệu.");
        }
        if (!disposed) applyPayload(payload);
      })
      .catch((caughtError) => {
        if (!disposed) {
          setError(caughtError instanceof Error ? caughtError.message : "Không thể tải dữ liệu.");
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => { disposed = true; };
  }, [applyPayload]);

  async function mutate(body: Record<string, unknown>, key: string, successMessage: string) {
    setBusyKey(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as AccessPayload;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Không thể cập nhật dữ liệu.");
      }
      applyPayload(payload);
      setNotice(successMessage);
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể cập nhật dữ liệu.");
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function addEmail(event: FormEvent) {
    event.preventDefault();
    const email = newEmail.trim().toLowerCase();
    const succeeded = await mutate(
      { action: "add_user", email },
      `add-user:${email}`,
      `Đã thêm ${email}. Hãy bật section ở bảng bên dưới.`,
    );
    if (succeeded) setNewEmail("");
  }

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    const title = newCourse.trim();
    const succeeded = await mutate(
      { action: "create_course", title },
      "create-course",
      `Đã tạo khóa học “${title}”.`,
    );
    if (succeeded) setNewCourse("");
  }

  async function createSection(event: FormEvent, course: CourseRow) {
    event.preventDefault();
    const title = (newSectionTitles[course.id] ?? "").trim();
    const succeeded = await mutate(
      { action: "create_section", courseId: course.id, title },
      `create-section:${course.id}`,
      `Đã thêm section “${title}” vào ${course.title}.`,
    );
    if (succeeded) {
      setNewSectionTitles((current) => ({ ...current, [course.id]: "" }));
    }
  }

  const grantSet = useMemo(
    () => new Set(grants.map((grant) => `${grant.user_email}:${grant.section_id}`)),
    [grants],
  );
  const filteredUsers = users.filter((user) => {
    const keyword = query.trim().toLowerCase();
    return !keyword || user.email.includes(keyword) || user.display_name?.toLowerCase().includes(keyword);
  });
  const activeSections = sections.filter((section) => section.status === "active");

  function sectionsForCourse(courseId: string) {
    return activeSections
      .filter((section) => section.course_id === courseId)
      .sort((a, b) => a.position - b.position);
  }

  async function signOut() {
    await fetch("/api/signout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/login");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>EIU · ADMIN</span>
          <h1>Quản lý khóa học & quyền xem</h1>
          <p>Đăng nhập với {adminEmail}</p>
        </div>
        <nav>
          <Link href="/">Khóa học</Link>
          <Link href="/admin/ai">AI Knowledge</Link>
          <button type="button" onClick={() => void signOut()}>Đăng xuất</button>
        </nav>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Quản trị khóa học">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "access"}
          className={tab === "access" ? styles.activeTab : ""}
          onClick={() => setTab("access")}
        >
          Phân quyền email
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "catalog"}
          className={tab === "catalog" ? styles.activeTab : ""}
          onClick={() => setTab("catalog")}
        >
          Khóa học & Section
        </button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {tab === "access" ? (
        <>
          <section className={styles.toolbar}>
            <form onSubmit={addEmail}>
              <label htmlFor="new-eiu-email">Thêm email EIU</label>
              <div>
                <input
                  id="new-eiu-email"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  pattern="^[^@\s]+@eiu\.edu\.vn$"
                  placeholder="user@eiu.edu.vn"
                  required
                />
                <button disabled={Boolean(busyKey)}>Thêm email</button>
              </div>
            </form>

            <label className={styles.search}>
              Tìm kiếm
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên hoặc email..." />
            </label>
          </section>

          <section className={styles.tableCard}>
            <div className={styles.tableIntro}>
              <div><strong>{users.length}</strong><span>email được quản lý</span></div>
              <div><strong>{activeSections.length}</strong><span>section khả dụng</span></div>
              <p>Mỗi công tắc là quyền xem đúng một section. Admin luôn có toàn quyền.</p>
            </div>

            {loading ? (
              <div className={styles.empty}>Đang tải danh sách quyền...</div>
            ) : filteredUsers.length === 0 ? (
              <div className={styles.empty}>Không tìm thấy email phù hợp.</div>
            ) : activeSections.length === 0 ? (
              <div className={styles.empty}>Hãy tạo section trước khi phân quyền.</div>
            ) : (
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Trạng thái</th>
                      {courses.flatMap((course) => sectionsForCourse(course.id).map((section) => (
                        <th key={section.id}>
                          <span className={styles.courseLabel}>{course.title}</span>
                          {section.title}
                        </th>
                      )))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.email}>
                        <td>
                          <strong>{user.display_name || user.email.split("@")[0]}</strong>
                          <span>{user.email}</span>
                        </td>
                        <td>
                          <span className={user.auth_user_id ? styles.verified : styles.invited}>
                            {user.auth_user_id ? "Đã đăng nhập" : "Chưa đăng nhập"}
                          </span>
                        </td>
                        {courses.flatMap((course) => sectionsForCourse(course.id).map((section) => {
                          const key = `${user.email}:${section.id}`;
                          const enabled = grantSet.has(key) || user.is_admin;
                          return (
                            <td key={section.id}>
                              <label className={styles.toggle} title={user.is_admin ? "Admin có toàn quyền" : section.title}>
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  disabled={user.is_admin || Boolean(busyKey)}
                                  onChange={() => void mutate({
                                    action: "set_section_access",
                                    email: user.email,
                                    sectionId: section.id,
                                    enabled: !enabled,
                                  }, key, enabled ? `Đã thu hồi ${section.title}.` : `Đã cấp ${section.title}.`)}
                                />
                                <i />
                              </label>
                            </td>
                          );
                        }))}
                        <td>
                          {user.is_admin ? (
                            <span className={styles.adminBadge}>ADMIN</span>
                          ) : (
                            <button
                              type="button"
                              className={styles.remove}
                              disabled={Boolean(busyKey)}
                              onClick={() => {
                                if (window.confirm(`Xóa ${user.email} và toàn bộ quyền section?`)) {
                                  void mutate(
                                    { action: "remove_user", email: user.email },
                                    `remove:${user.email}`,
                                    `Đã xóa ${user.email} khỏi danh sách quyền.`,
                                  );
                                }
                              }}
                            >
                              Xóa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className={styles.catalog}>
          <div className={styles.catalogIntro}>
            <div>
              <span>CẤU TRÚC NỘI DUNG</span>
              <h2>Khóa học chứa các section</h2>
              <p>Tạo cấu trúc tại đây, sau đó quay lại tab Phân quyền email để cấp từng section.</p>
            </div>
            <form onSubmit={createCourse}>
              <label htmlFor="new-course">Tên khóa học mới</label>
              <div>
                <input
                  id="new-course"
                  value={newCourse}
                  onChange={(event) => setNewCourse(event.target.value)}
                  placeholder="Ví dụ: Digital Marketing"
                  maxLength={120}
                  required
                />
                <button disabled={Boolean(busyKey)}>Tạo khóa học</button>
              </div>
            </form>
          </div>

          <div className={styles.courseGrid}>
            {courses.map((course) => {
              const courseSections = sectionsForCourse(course.id);
              const protectedCourse = course.slug === "applied-agentic-ai";
              return (
                <article className={styles.courseCard} key={course.id}>
                  <header>
                    <div>
                      <span>{protectedCourse ? "NỘI DUNG ĐANG DÙNG" : "KHÓA HỌC"}</span>
                      <h3>{course.title}</h3>
                      <small>{courseSections.length} section</small>
                    </div>
                    <button
                      type="button"
                      className={styles.remove}
                      disabled={protectedCourse || Boolean(busyKey)}
                      title={protectedCourse ? "Khóa học đang gắn với nội dung hiện tại" : "Xóa khóa học"}
                      onClick={() => {
                        if (window.confirm(`Xóa khóa học “${course.title}” và toàn bộ section/quyền liên quan?`)) {
                          void mutate(
                            { action: "delete_course", courseId: course.id },
                            `delete-course:${course.id}`,
                            `Đã xóa khóa học “${course.title}”.`,
                          );
                        }
                      }}
                    >
                      Xóa khóa học
                    </button>
                  </header>

                  <ul className={styles.sectionList}>
                    {courseSections.length === 0 && <li className={styles.noSection}>Chưa có section.</li>}
                    {courseSections.map((section) => {
                      const protectedSection = section.section_key === "section1" || section.section_key === "section2";
                      return (
                        <li key={section.id}>
                          <div>
                            <strong>{section.title}</strong>
                            <span>Thứ tự {section.position}</span>
                          </div>
                          <button
                            type="button"
                            className={styles.remove}
                            disabled={protectedSection || Boolean(busyKey)}
                            title={protectedSection ? "Section đang gắn với nội dung hiện tại" : "Xóa section"}
                            onClick={() => {
                              if (window.confirm(`Xóa section “${section.title}” và thu hồi mọi quyền liên quan?`)) {
                                void mutate(
                                  { action: "delete_section", sectionId: section.id },
                                  `delete-section:${section.id}`,
                                  `Đã xóa section “${section.title}”.`,
                                );
                              }
                            }}
                          >
                            Xóa
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <form className={styles.sectionForm} onSubmit={(event) => void createSection(event, course)}>
                    <label htmlFor={`new-section-${course.id}`}>Thêm section</label>
                    <div>
                      <input
                        id={`new-section-${course.id}`}
                        value={newSectionTitles[course.id] ?? ""}
                        onChange={(event) => setNewSectionTitles((current) => ({
                          ...current,
                          [course.id]: event.target.value,
                        }))}
                        placeholder="Tên section"
                        maxLength={120}
                        required
                      />
                      <button disabled={Boolean(busyKey)}>Thêm</button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
