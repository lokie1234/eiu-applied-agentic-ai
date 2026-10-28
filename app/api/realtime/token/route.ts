import { currentUserAccess } from "@/lib/auth/currentUser";
import { mintRealtimeToken, realtimeConfigured, readRealtimeSignals } from "@/lib/realtime/server";
export async function GET(request: Request) {
  if (!realtimeConfigured()) return Response.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  const access = await currentUserAccess(request.signal);
  if (!access?.isActive) return Response.json({ message: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  // Do not disable the legacy fallback until the durable change feed exists.
  try { await readRealtimeSignals(request.signal); }
  catch { return Response.json({ message: "Realtime setup pending." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  return Response.json({ enabled: true, token: mintRealtimeToken(access) }, { headers: { "Cache-Control": "private, no-store" } });
}
