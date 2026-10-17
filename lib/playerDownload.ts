export type PlayerPackage = { platform: string; name: string; bytes: number; sha256: string; parts: { url: string; bytes: number; sha256: string }[] };

/** Assemble immutable public artifacts without exposing a private repository token. */
export async function downloadPlayerArchive(pkg: PlayerPackage, signal: AbortSignal, progress: (percent: number) => void, read: typeof fetch = fetch) {
  if (!pkg.parts.length || pkg.parts.reduce((sum, part) => sum + part.bytes, 0) !== pkg.bytes) throw new Error("Gói cài chưa sẵn sàng.");
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  progress(0);
  for (const part of pkg.parts) {
    signal.throwIfAborted();
    const response = await read(part.url, { signal });
    if (!response.ok) throw new Error("Không thể tải bộ cài. Vui lòng thử lại.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    signal.throwIfAborted();
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
    if (bytes.length !== part.bytes || hash !== part.sha256) throw new Error("Tệp tải về chưa đầy đủ. Vui lòng thử lại.");
    parts.push(bytes);
    loaded += bytes.length;
    progress(Math.round(loaded / pkg.bytes * 100));
  }
  signal.throwIfAborted();
  return new Blob(parts, { type: "application/zip" });
}
