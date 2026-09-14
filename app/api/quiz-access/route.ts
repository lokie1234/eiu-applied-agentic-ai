import { NextResponse } from "next/server";

export async function POST(request: Request){
 const {code}=await request.json();
 const expected=String(process.env.QUIZ_ACCESS_CODE ?? "7879").trim();
 if(String(code??"").trim()===expected) return NextResponse.json({success:true});
 return NextResponse.json({success:false},{status:401});
}
