"use client";
import { useEffect, useState, useRef } from "react";
import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type Scope = { id: string; sectionKey: string; courseId: string; courseSlug?: string };
let client: ConvexClient | null = null;
let ready = false;
let refreshAuthentication: (() => void) | null = null;
export function refreshRealtimeAuthentication() { refreshAuthentication?.(); }
let knownScopes: Scope[] = [];
const READY_EVENT = "eiu:realtime-ready";
const SIGNAL_EVENT = "eiu:interactive-change";
function setReady(value: boolean) { if (ready !== value) { ready = value; window.dispatchEvent(new Event(READY_EVENT)); } }
export function realtimeReady() { return ready; }
export function watchRealtimeReady(callback: () => void) {
  window.addEventListener(READY_EVENT, callback);
  return () => window.removeEventListener(READY_EVENT, callback);
}
export function interactiveSectionId(section: string) {
  return knownScopes.find(scope => scope.id === section)?.id || knownScopes.find(scope => scope.sectionKey === section && scope.courseSlug === "applied-agentic-ai")?.id || section;
}
export function listenInteractive(section: string | null, topic: string, callback: () => void) {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<{ sectionId: string; topic: string }>).detail;
    if (detail.topic === topic && (!section || detail.sectionId === interactiveSectionId(section))) callback();
  };
  window.addEventListener(SIGNAL_EVENT, listener);
  return () => window.removeEventListener(SIGNAL_EVENT, listener);
}
export function useRealtimeReady() {
  const [value, setValue] = useState(false);
  useEffect(() => { const refresh = () => setValue(ready); refresh(); window.addEventListener(READY_EVENT, refresh); return () => window.removeEventListener(READY_EVENT, refresh); }, []);
  return value;
}
export function useCourseRealtime(scopes: Scope[], onCounts: (rows: Array<{ sectionId: string; online: number; subjects: string[] }>) => void, authSubject = "") {
  const key = JSON.stringify(scopes);
  const onCountsRef = useRef(onCounts);
  useEffect(() => { onCountsRef.current = onCounts; }, [onCounts]);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_REALTIME_PROVIDER !== "convex" || !process.env.NEXT_PUBLIC_CONVEX_URL) return;
    knownScopes = JSON.parse(key);
    const current = new ConvexClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    client = current;
    let authenticated = false, hasSignals = false;
    const check = () => setReady(authenticated && hasSignals && current.connectionState().isWebSocketConnected);
    const authenticate = () => current.setAuth(async () => {
      try {
        const response = await fetch("/api/realtime/token", { cache: "no-store", signal: AbortSignal.timeout(12_000) });
        if (!response.ok) return null;
        const payload = await response.json(); return payload.enabled ? payload.token : null;
      } catch { return null; }
    }, value => { authenticated = value; check(); });
    refreshAuthentication = authenticate; authenticate();
    const revisions = new Map<string, number>();
    const signals = current.onUpdate(makeFunctionReference<"query", { sectionIds: string[] }, Array<{ sectionId: string; topic: string; revision: number }>>("realtime:signals"), { sectionIds: knownScopes.map(scope => scope.id) }, rows => {
      hasSignals = true; check();
      for (const row of rows) {
        const id = `${row.sectionId}:${row.topic}`;
        if (revisions.get(id) !== row.revision) window.dispatchEvent(new CustomEvent(SIGNAL_EVENT, { detail: row }));
        revisions.set(id, row.revision);
      }
    }, () => { hasSignals = false; check(); });
    const counts = current.onUpdate(makeFunctionReference<"query", Record<string, never>, Array<{ sectionId: string; online: number; subjects: string[] }>>("realtime:online"), {}, rows => onCountsRef.current(rows), () => {});
    const connection = current.subscribeToConnectionState(check);
    return () => { signals(); counts(); connection(); if (client === current) { client = null; refreshAuthentication = null; } setReady(false); void current.close(); };
  }, [key, authSubject]);
  return useRealtimeReady();
}
export async function pulsePresence(sectionId: string, clientId: string, leave = false) {
  if (!client || !ready) return false;
  try {
    const result = await client.mutation(makeFunctionReference<"mutation", { sectionId: string; clientId: string; leave: boolean }, { retryAfter?: number }>("realtime:pulse"), { sectionId, clientId, leave });
    if (result.retryAfter) window.dispatchEvent(new CustomEvent("eiu:rate-limit", { detail: { retryAfter: result.retryAfter } }));
    return !result.retryAfter;
  } catch { return false; }
}

export type ClassroomView = {
  ready: boolean; teaching: boolean; viewerSubject?: string; practiceSession?: string;
  assignment?: { subject?: string; username?: string; question: number; part?: number; drawId: string; createdAt: number; config?: { number: number; title?: string; prompt: string; starterCode: string; tasks?: Array<{ label: string; code: string }> } } | null;
  members: Array<{ id: string; username: string }>;
  questionSetup?: Array<{ number: number; title?: string; prompt: string; starterCode: string; tasks?: Array<{ label: string; code: string }> }>;
  items: Array<{ id: string; subject?: string; assignmentPart?: number; questionNumber?: number; drawId?: string; name: string; partId: string; values: Record<string, string>; submittedAt: string }>;
  draw: { names: string[]; subjects?: string[]; requestId: string; createdAt: number; assignmentVersion?: number; parts?: number[]; questions?: Array<{ number: number; title?: string; prompt: string; starterCode: string; tasks?: Array<{ label: string; code: string }> }> } | null;
};
export function watchClassroom(sectionId: string, callback: (value: ClassroomView) => void) {
  let stop: (() => void) | undefined, owner: ConvexClient | null = null;
  const attach = () => {
    if (owner === client && stop && ready) return;
    stop?.(); stop = undefined; owner = null;
    if (!client || !ready) return;
    owner = client;
    stop = client.onUpdate(makeFunctionReference<"query", { sectionId: string }, ClassroomView>("classroom:view"), { sectionId }, callback, () => {});
  };
  const unwatch = watchRealtimeReady(attach); attach();
  return () => { unwatch(); stop?.(); };
}
export async function drawClassroom(sectionId: string, excluded: string[], requestId: string) {
  if (!client || !ready) throw new Error("The live classroom is reconnecting. Please try again shortly.");
  const result = await client.mutation(makeFunctionReference<"mutation", { sectionId: string; excluded: string[]; requestId: string }, { names?: string[]; subjects?: string[]; createdAt?: number; requestId?: string; assignmentVersion?: number; parts?: number[]; retryAfter?: number; message?: string }>("classroom:draw"), { sectionId, excluded, requestId });
  if (result.retryAfter) throw new Error(`Please try again in ${result.retryAfter} seconds.`);
  if (result.message || !result.names) throw new Error(result.message || "Unable to draw names.");
  return result;
}
export async function resetClassroomDraw(sectionId: string) {
  if (!client || !ready) throw new Error("The live classroom is reconnecting. Please try again shortly.");
  const result = await client.mutation(makeFunctionReference<"mutation", { sectionId: string }, { success?: boolean; retryAfter?: number }>("classroom:resetDraw"), { sectionId });
  if (result.retryAfter) throw new Error(`Please try again in ${result.retryAfter} seconds.`);
  return result;
}

export async function configureClassroomQuestions(sectionId: string, questions: Array<{ number: number; title?: string; prompt: string; starterCode: string; tasks?: Array<{ label: string; code: string }> }>) {
  if (!client || !ready) throw new Error('The live classroom is reconnecting.');
  return client.mutation(makeFunctionReference<'mutation', { sectionId: string; questions: Array<{ number: number; title?: string; prompt: string; starterCode: string; tasks?: Array<{ label: string; code: string }> }> }, { success: boolean }>('classroom:configureQuestions'), { sectionId, questions });
}
