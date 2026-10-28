import { bridgeAuthorized, readRealtimeSignals } from "@/lib/realtime/server";
import { classroomSnapshot } from "@/lib/realtime/classroom";
export async function GET(request: Request) {
  if (!bridgeAuthorized(request)) return Response.json({ message: "Forbidden" }, { status: 403 });
  try { const [rows, classroom] = await Promise.all([readRealtimeSignals(request.signal), classroomSnapshot(request.signal)]);
    return Response.json({ rows, classroom }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ message: "Sync unavailable" }, { status: 503 }); }
}
