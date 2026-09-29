import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const EMERGENCY_CODE = "7878";
const FILES = {
  config: { source: "GEM_CONFIG.txt", download: "GEM_CONFIG.txt" },
  knowledge: { source: "KNOWLEDGE_ALL.txt", download: "KNOWLEDGE_ALL.txt" },
} as const;

type FileKey = keyof typeof FILES;

export async function POST(request: Request) {
  let body: { code?: unknown; file?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.code !== EMERGENCY_CODE) {
    return Response.json({ error: "Invalid code." }, { status: 401 });
  }

  if (body.file === undefined) {
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  if (typeof body.file !== "string" || !(body.file in FILES)) {
    return Response.json({ error: "Invalid file." }, { status: 400 });
  }

  const file = FILES[body.file as FileKey];
  const filePath = path.join(process.cwd(), "assets", "emergency", file.source);

  try {
    const contents = await readFile(filePath);
    return new Response(contents, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${file.download}"`,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return Response.json({ error: "File unavailable." }, { status: 404 });
  }
}
