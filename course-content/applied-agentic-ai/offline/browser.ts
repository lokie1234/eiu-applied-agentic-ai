// @ts-expect-error Build-only embedded asset provided by the offline compiler.
import emergencyAsset from "eiu:emergency";

export async function offlineCopy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Opaque-origin lesson frames may have no Clipboard API.
    const active = document.activeElement as HTMLElement | null;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:0;top:0;opacity:0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    active?.focus();
    if (!copied) throw new Error("Không thể sao chép. Hãy chọn nội dung và nhấn Ctrl+C.");
  }
}

export async function offlineEmergencyFetch(_url: string, options: RequestInit) {
  const input = JSON.parse(String(options.body));
  if (input.file !== "config") return new Response(null, { status: 400 });
  const bytes=Uint8Array.from(atob(emergencyAsset.bytes), character=>character.charCodeAt(0));
  return new Response(bytes, { headers: { "Content-Type": emergencyAsset.mime } });
}
