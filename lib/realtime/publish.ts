import "server-only";
import { after } from "next/server";
import { publishRealtimeSignals, realtimeConfigured } from "./server";

export function notifyRealtime() {
  if (!realtimeConfigured()) return;
  after(async () => {
    try { await publishRealtimeSignals(); }
    catch { console.error("Realtime notification pending reconciliation; durable result remains saved."); }
  });
}
