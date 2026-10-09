import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const section = new URL(request.url).searchParams.get("section");
  if (!["section1", "section2"].includes(section || "")) return Response.json({ message: "Invalid section." }, { status: 400 });
  const number = section === "section2" ? 2 : 1;
  try {
    const pdf = await readFile(path.join(process.cwd(), `public/downloads/eiu-applied-agentic-ai-section-${number}-handout.pdf`));
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="EIU_Applied_Agentic_AI_Section${number}_Handout.pdf"`, "Content-Length": String(pdf.length), "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "The handout is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
