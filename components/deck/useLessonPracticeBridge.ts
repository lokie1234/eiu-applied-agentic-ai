"use client";
import { useEffect, useState, type RefObject } from "react";
import { MIS301_SECTION_ID } from "@/lib/mis301Practice";
import { clearMis301Notebook } from "./useMis301NotebookBridge";
import { listenInteractive, realtimeReady, refreshRealtimeAuthentication, watchClassroom, drawClassroom, resetClassroomDraw, configureClassroomQuestions, type ClassroomView } from "@/lib/realtime/client";

type PracticeContext = { teaching: boolean; learner?: { subject?: string; name: string; email: string } | null; practiceSession: string; assignment?: ClassroomView['assignment']; allowed?: boolean };
type PracticeAccess = { sectionId: string; teaching: boolean; assignment: ClassroomView['assignment']; practiceSession: string };

// One root connection and fallback for the opaque section frame. Never send credentials.
export function useLessonPracticeBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  const [practiceAccess, setPracticeAccess] = useState<PracticeAccess | null>(null);
  useEffect(() => {
    if (sectionId !== MIS301_SECTION_ID) return;
    const controller = new AbortController();
    let generation = 0, expectedEpoch = '', changingEpoch = false;
    let pendingToken: string | null = null, snapshot: ClassroomView | null = null, context: PracticeContext | null = null;
    let refreshing: Promise<void> | undefined;
    let authRefreshSubject = '';
    let fallback: { data: Record<string, unknown>; time: number } | null = null;
    const currentSnapshot = () => context && snapshot?.ready && snapshot.practiceSession === expectedEpoch && snapshot.teaching === context.teaching
      && (context.teaching || !context.learner?.subject || snapshot.viewerSubject === context.learner.subject) ? snapshot : null;
    const post = (value: Record<string, unknown>) => {
      const target = frame.current;
      target?.contentWindow?.postMessage({ ...value, requestId: target.dataset.requestId }, '*');
    };
    function announce() {
      if (!context) return;
      const live = currentSnapshot();
      setPracticeAccess({ sectionId, teaching: context.teaching, practiceSession: expectedEpoch, assignment: live ? live.assignment || null : context.assignment || null });
      if (live) post({ type: 'eiu-classroom-state', snapshot: { ...live } });
    }
    function install(data: PracticeContext, captured: number) {
      if (controller.signal.aborted || captured !== generation || typeof data.practiceSession !== 'string') return false;
      const candidate = snapshot;
      if (expectedEpoch && expectedEpoch !== data.practiceSession) {
        changingEpoch = true;
        clearMis301Notebook(sectionId, data.practiceSession);
        changingEpoch = false;
      }
      expectedEpoch = data.practiceSession;
      context = { teaching: data.teaching, learner: data.learner, practiceSession: data.practiceSession, assignment: data.assignment, allowed: data.allowed };
      if (candidate?.practiceSession === expectedEpoch) snapshot = candidate;
      const subject = data.learner?.subject;
      if (!data.teaching && subject && candidate?.viewerSubject !== subject && authRefreshSubject !== subject) {
        authRefreshSubject = subject; refreshRealtimeAuthentication();
      }
      announce(); return true;
    }
    function refreshAccess() {
      if (refreshing) return refreshing;
      const captured = generation, full = !realtimeReady();
      const operation = (async () => {
        const response = await fetch(`/api/sections/${encodeURIComponent(sectionId)}/practice${full ? '' : '?context=1'}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!response.ok) throw Error('Unable to verify this section session.');
        const data = await response.json();
        if (install(data, captured) && full) fallback = { data, time: Date.now() };
      })();
      refreshing = operation;
      void operation.finally(() => { if (refreshing === operation) refreshing = undefined; }).catch(() => {});
      return operation;
    }
    const invalidate = () => {
      void refreshAccess().catch(() => {}).finally(() => post({ type: 'eiu-practice-changed' }));
    };
    const terminate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.sectionId !== sectionId) return;
      generation++; pendingToken = null; context = null; snapshot = null; fallback = null; refreshing = undefined;
      expectedEpoch = typeof detail.epoch === 'string' ? detail.epoch : '';
      setPracticeAccess({ sectionId, teaching: false, assignment: null, practiceSession: expectedEpoch || `ended:${generation}` });
      post({ type: 'eiu-section-terminated' });
      if (!changingEpoch) void refreshAccess().catch(() => {});
    };
    window.addEventListener('eiu-section-terminated', terminate);
    const classroom = watchClassroom(sectionId, value => {
      snapshot = value;
      if (!value.ready) {
        if (context) setPracticeAccess({ sectionId, teaching: context.teaching, assignment: null, practiceSession: expectedEpoch });
        return;
      }
      if (currentSnapshot()) announce();
      else if (value.ready) void refreshAccess().catch(() => {});
    });
    const stop = listenInteractive(sectionId, 'quiz', () => { if (!currentSnapshot() || !realtimeReady()) invalidate(); });
    window.addEventListener('focus', invalidate);
    const timer = window.setInterval(() => { if (!realtimeReady() && !document.hidden) invalidate(); }, 15_000);
    void refreshAccess().catch(() => {});
    const onMessage = async (event: MessageEvent) => {
      const target = frame.current, payload = event.data;
      if (!target || event.source !== target.contentWindow || payload?.type !== 'eiu-practice-request'
        || payload.requestId !== target.dataset.requestId || typeof payload.token !== 'string' || payload.token.length > 80
        || !['load', 'submit', 'draw', 'resetDraw', 'configureQuestions'].includes(payload.operation)) return;
      const captured = generation;
      const reply = (response: Record<string, unknown>) => {
        if (controller.signal.aborted || frame.current !== target || target.dataset.requestId !== payload.requestId) return;
        target.contentWindow?.postMessage({ type: 'eiu-practice-response', requestId: payload.requestId, token: payload.token,
          response: captured === generation ? response : { success: false, message: 'This section session has ended. Reopen it to continue.' } }, '*');
      };
      if (pendingToken) { reply({ success: false, message: 'Please wait for the current request to finish.' }); return; }
      pendingToken = payload.token;
      try {
        if (!context) await refreshAccess();
        if (captured !== generation || !context) { reply({ success: false }); return; }
        if (payload.operation === 'configureQuestions') {
          if (!Array.isArray(payload.questions) || payload.questions.length !== 7) { reply({ success: false, message: 'Invalid part setup.' }); return; }
          reply({ ...await configureClassroomQuestions(sectionId, payload.questions), success: true }); return;
        }
        if (payload.operation === 'resetDraw') { reply({ ...await resetClassroomDraw(sectionId), success: true }); return; }
        if (payload.operation === 'draw') { reply({ ...await drawClassroom(sectionId, Array.isArray(payload.excluded) ? payload.excluded : [], String(payload.submissionId || '')), success: true }); return; }
        const live = currentSnapshot();
        if (payload.operation === 'load' && live && realtimeReady()) { reply({ ...context, ...live, success: true }); return; }
        if (payload.operation === 'load' && fallback && Date.now() - fallback.time < 1000) { reply({ ...fallback.data, draw: live?.draw, questionSetup: live?.questionSetup, classroomStale: true, success: true }); return; }
        const response = await fetch(`/api/sections/${encodeURIComponent(sectionId)}/practice`, {
          method: payload.operation === 'submit' ? 'POST' : 'GET', cache: 'no-store',
          headers: payload.operation === 'submit' ? { 'Content-Type': 'application/json' } : undefined,
          body: payload.operation === 'submit' ? JSON.stringify({ partId: payload.partId, values: payload.values, submissionId: payload.submissionId, practiceSession: payload.practiceSession, drawId: payload.drawId }) : undefined,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const data = await response.json();
        if (captured !== generation) { reply({ success: false }); return; }
        if (payload.operation === 'load' && response.ok) install(data, captured);
        const latest = currentSnapshot();
        reply({ ...data, ...(payload.operation === 'load' && latest && realtimeReady() ? latest : {}),
          ...(payload.operation === 'load' && data.teaching && latest && !realtimeReady() ? { draw: latest.draw, questionSetup: latest.questionSetup, classroomStale: true } : {}), success: response.ok });
      } catch { reply({ success: false, message: 'Unable to connect. Your input is kept; please retry.' }); }
      finally { if (pendingToken === payload.token) pendingToken = null; }
    };
    window.addEventListener('message', onMessage);
    return () => { controller.abort(); generation++; stop(); classroom(); clearInterval(timer); window.removeEventListener('focus', invalidate); window.removeEventListener('eiu-section-terminated', terminate); window.removeEventListener('message', onMessage); };
  }, [sectionId, frame]);
  return practiceAccess?.sectionId === sectionId ? practiceAccess : null;
}
