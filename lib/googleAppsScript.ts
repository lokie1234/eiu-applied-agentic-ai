const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyg7d4m6Ou5EH3KximcaMFHdNM4vvjSPWXUyYhefWTO2w72gpmKkDWrIz1u2biAukVR/exec";

const SETUP_SECRET = "CHANGE_ME";

type AppsScriptMethod = "GET" | "POST";

export type AppsScriptPayload = Record<string, unknown>;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function parsePayload(text: string): AppsScriptPayload {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as AppsScriptPayload;
  } catch {
    const pre = trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (pre) {
      try {
        return JSON.parse(decodeHtmlEntities(pre[1]).trim()) as AppsScriptPayload;
      } catch {
        // Continue to the deployment-specific message below.
      }
    }

    if (/^\s*</.test(trimmed)) {
      throw new Error(
        "Apps Script đang trả về HTML. Hãy cập nhật Code.gs trong patch và triển khai Phiên bản mới với quyền Bất kỳ ai.",
      );
    }

    throw new Error("Apps Script trả về dữ liệu không hợp lệ.");
  }
}

function secretCandidates() {
  const configured = process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim() ?? "";
  return Array.from(new Set([configured, SETUP_SECRET].filter(Boolean)));
}

function isAccessDenied(payload: AppsScriptPayload) {
  return (
    payload.success === false &&
    String(payload.message ?? "").toLowerCase().includes("không có quyền truy cập")
  );
}

function appendGetData(url: URL, data: AppsScriptPayload) {
  for (const [key, value] of Object.entries(data)) {
    if (
      value === undefined ||
      value === null ||
      typeof value === "object"
    ) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

async function requestOnce(
  action: string,
  data: AppsScriptPayload,
  method: AppsScriptMethod,
  secret: string,
) {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("action", action);
  if (secret) url.searchParams.set("secret", secret);
  if (method === "GET") appendGetData(url, data);

  const response = await fetch(url, {
    method,
    headers:
      method === "POST"
        ? {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "text/plain;charset=utf-8",
          }
        : { Accept: "application/json, text/plain, */*" },
    body:
      method === "POST"
        ? JSON.stringify({ ...data, action, secret })
        : undefined,
    cache: "no-store",
    redirect: "follow",
  });

  const payload = parsePayload(await response.text());
  if (!response.ok) {
    throw new Error(
      String(payload.message ?? `Apps Script phản hồi lỗi HTTP ${response.status}.`),
    );
  }

  return payload;
}

export async function callAppsScript(
  action: string,
  data: AppsScriptPayload = {},
  method: AppsScriptMethod = "POST",
) {
  const candidates = secretCandidates();
  let lastPayload: AppsScriptPayload | null = null;

  for (const secret of candidates) {
    const payload = await requestOnce(action, data, method, secret);
    lastPayload = payload;
    if (!isAccessDenied(payload)) return payload;
  }

  return (
    lastPayload ?? {
      success: false,
      message: "Không có quyền truy cập Apps Script.",
    }
  );
}
