import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth/currentUser";
import { driveStatus } from "@/lib/drive/connection";
import styles from "./page.module.css";
import FolderPicker from "./FolderPicker";

export const metadata = { title: "EIU · Google Drive Connection" };

const messages: Record<string, string> = {
  connected: "Đã lưu kết nối Google Drive. Kiểm tra quyền của từng folder bên dưới.",
  cancelled: "Bạn đã hủy cấp quyền. Có thể kết nối lại khi sẵn sàng.",
  "wrong-account": "Chọn đúng tài khoản son.lam@eiu.edu.vn. Kết nối cũ được giữ nguyên.",
  "missing-scope": "Chưa cấp quyền Drive. Kết nối lại và cho phép quyền file đã yêu cầu.",
  failed: "Kết nối chưa hoàn tất. Kiểm tra callback Google Cloud, đăng nhập admin rồi thử lại.",
};

export default async function DriveConnectionPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  if (!(await requireAdminAccess())) redirect("/");
  const query = await searchParams;
  let status: Awaited<ReturnType<typeof driveStatus>> | null = null;
  let error = "";
  try { status = await driveStatus(); }
  catch { error = "Chưa thể kiểm tra kết nối. Kiểm tra cấu hình OAuth hoặc kết nối lại nếu token đã hết hiệu lực."; }
  return <main className={styles.page}>
    <Link className={styles.back} href="/admin/access">← Admin workspace</Link>
    <section className={styles.card}>
      <p className={styles.eyebrow}>EIU / COURSE SOURCE FILES</p>
      <h1>Google Drive Connection</h1>
      <p>Lưu file gốc PDF, PPTX và TSX theo folder khóa học và section.</p>
      {query.result && messages[query.result] && <p className={styles.notice} role="status">{messages[query.result]}</p>}
      {error && <p className={styles.notice} role="alert">{error}</p>}
      <div className={styles.account}><div><span>Tài khoản lưu trữ</span><strong>{status?.email ?? "son.lam@eiu.edu.vn"}</strong></div><b>{status?.connected ? "Đã kết nối" : "Chưa kết nối"}</b></div>
      <a className={styles.button} href="/api/admin/drive/connect">{status?.connected ? "Kết nối lại Google Drive" : "Connect Google Drive"}</a>
      {status?.connected && <><h2>Folder đích</h2><FolderPicker initialFolders={status.folders} configured={Boolean(process.env.GOOGLE_DRIVE_PICKER_API_KEY?.trim())} /></>}
      <p className={styles.note}>Trang này hiện phục vụ kết nối local. Chưa thay đổi luồng upload section; bản gốc chưa tự lưu vào Drive.</p>
    </section>
  </main>;
}
