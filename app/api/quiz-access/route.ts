import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { code, section } = await request.json();
  const isSectionTwo = String(section ?? "section1") === "section2";
  const expected = String(
    isSectionTwo
      ? process.env.QUIZ_SECTION_2_ACCESS_CODE ?? "7979"
      : process.env.QUIZ_ACCESS_CODE ?? "7879"
  ).trim();

  if (String(code ?? "").trim() === expected) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false }, { status: 401 });
}
