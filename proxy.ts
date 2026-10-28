import { NextResponse, type NextRequest } from "next/server";
import { consumeRateLimit, RATE_COOKIE, requestIdentity, requestPolicy } from "@/lib/security/rateLimit";

// Authorization remains in the routes. This shared gate runs before expensive work.
export async function proxy(request: NextRequest) {
  const policy = requestPolicy(request.nextUrl.pathname, request.method, request.headers);
  if (!policy) return NextResponse.next();
  try {
    const identity = requestIdentity(request.cookies.get(RATE_COOKIE)?.value);
    const result = await consumeRateLimit(identity.id, policy, request.headers, request.signal);
    let response: NextResponse;
    if (result.allowed) response = NextResponse.next();
    else {
      const message = `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${result.retry_after} giây.`;
      const headers = { "Retry-After": String(result.retry_after), "Cache-Control": "private, no-store", "X-EIU-Rate-Limit": "1" };
      response = request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ success: false, message, retryAfter: result.retry_after }, { status: 429, headers })
        : new NextResponse(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vui lòng thử lại sau · EIU</title><body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#041c31;color:#f7f4ed;font:18px/1.6 system-ui"><main role="alert" style="max-width:520px;padding:32px"><p>EIU · Learning Space</p><h1 style="font-size:28px">Vui lòng thử lại sau</h1><p>${message}</p><p>Please wait ${result.retry_after} seconds before trying again.</p><a href="" style="color:#e9ca8b">Thử lại / Try again</a></main></body></html>`, { status: 429, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
    }
    if (identity.fresh) response.cookies.set(RATE_COOKIE, identity.cookie, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400,
    });
    return response;
  } catch {
    // Do not silently replace distributed enforcement with per-instance memory.
    return NextResponse.json({ success: false, message: "Hệ thống bảo vệ tạm thời chưa sẵn sàng. Vui lòng thử lại sau." }, {
      status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "30" },
    });
  }
}

export const config = {
  matcher: ["/", "/learn/:path*", "/admin/:path*", "/api/:path*"],
};
