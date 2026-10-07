"use client";

import AdminAccessPortal from "./admin/AdminAccessPortal";

// One workspace implementation keeps both roles' layout and workflows in sync.
export default function TeacherPortal({ name, initialTab }: { name: string; initialTab?: "layouts" }) {
  return <AdminAccessPortal adminEmail={name} role="teacher" initialTab={initialTab} />;
}
