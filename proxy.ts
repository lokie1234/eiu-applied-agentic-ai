import { NextResponse, type NextRequest } from "next/server";

// Authorization is verified close to protected pages, data, and API mutations.
// Keeping this proxy local avoids an auth network round-trip on every request.
export function proxy(request: NextRequest) {
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
