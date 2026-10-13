export const REGISTRATION_KEY = "eiu-lumi-demo-registrations";

export function readRegistrations(storage) {
  try {
    const value = JSON.parse(storage.getItem(REGISTRATION_KEY) || "[]");
    return Array.isArray(value) ? value.filter(item => item && typeof item.email === "string") : [];
  } catch { return []; }
}

export function saveRegistration(storage, entry) {
  const name = String(entry.name || "").trim();
  const email = String(entry.email || "").trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Vui lòng nhập tên và email hợp lệ.");
  const item = { name, email, plan: String(entry.plan || "launch"), goal: String(entry.goal || "").trim(), createdAt: new Date().toISOString() };
  const entries = [...readRegistrations(storage), item].slice(-50);
  storage.setItem(REGISTRATION_KEY, JSON.stringify(entries));
  return item;
}
