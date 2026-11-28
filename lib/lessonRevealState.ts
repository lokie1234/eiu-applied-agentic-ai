// Local presentation progress only; this is not a learner submission or report.
export const MIS311_RCA_SECTION_ID = '2cbb9354-a267-4103-9d14-99662d0e6bb1';
export const MANAGER_SECTION_ID = '98694749-2879-46e2-82bd-03fd27f23c5e';
export type RevealState = { selected: number; symptom: boolean[]; rootCause: boolean[]; treeRevealed?: boolean; treeStage?: number; processStep?: number; exerciseGroups?: boolean[]; exerciseStage?: number; orientationPlayed?: boolean };
type Session = { epoch: string; state: RevealState; terminationToken?: string | null };
const sessions = new Map<string, Session>();
const key = (sectionId: string) => `eiu:lesson-reveal:v1:${sectionId}`;
export const emptyRevealState = (): RevealState => ({ selected: 0, symptom: [false, false, false], rootCause: [false, false, false] });
export function validRevealState(value: unknown): value is RevealState {
  if (!value || typeof value !== 'object') return false;
  const state = value as RevealState;
  return Number.isInteger(state.selected) && state.selected >= 0 && state.selected < 3
    && (state.treeRevealed === undefined || typeof state.treeRevealed === 'boolean')
    && (state.treeStage === undefined || Number.isInteger(state.treeStage) && state.treeStage >= 0 && state.treeStage <= 2)
    && (state.processStep === undefined || Number.isInteger(state.processStep) && state.processStep >= 0 && state.processStep <= 8)
    && (state.exerciseGroups === undefined || Array.isArray(state.exerciseGroups) && state.exerciseGroups.length === 6 && state.exerciseGroups.every(value => typeof value === 'boolean'))
    && (state.exerciseStage === undefined || Number.isInteger(state.exerciseStage) && state.exerciseStage >= 0 && state.exerciseStage <= 5)
    && (state.orientationPlayed === undefined || typeof state.orientationPlayed === 'boolean')
    && [state.symptom, state.rootCause].every(items => Array.isArray(items) && items.length === 3 && items.every(item => typeof item === 'boolean'));
}
export function getRevealSession(sectionId: string): Session {
  let session = sessions.get(sectionId);
  if (!session) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key(sectionId)) || 'null');
      if (stored && typeof stored.epoch === 'string' && validRevealState(stored.state)) session = stored;
    } catch { /* Storage is optional. */ }
    session ??= { epoch: crypto.randomUUID(), state: emptyRevealState() };
    sessions.set(sectionId, session);
  }
  return session;
}
export function saveRevealState(sectionId: string, epoch: string, state: unknown): boolean {
  const session = getRevealSession(sectionId);
  if (epoch !== session.epoch || !validRevealState(state)) return false;
  const treeStage = Math.max(state.treeStage ?? (state.treeRevealed ? 2 : 0), session.state.treeStage ?? (session.state.treeRevealed ? 2 : 0));
  const processStep = Math.max(state.processStep ?? 0, session.state.processStep ?? 0);
  const previousGroups = session.state.exerciseGroups;
  const orientationPlayed = state.orientationPlayed || session.state.orientationPlayed;
  const exerciseStage = Math.max(state.exerciseStage ?? 0, session.state.exerciseStage ?? 0, state.exerciseGroups?.some(Boolean) || previousGroups?.some(Boolean) ? 5 : 0);
  session.state = { selected: state.selected,
    symptom: state.symptom.map((value, index) => value || session.state.symptom[index]),
    rootCause: state.rootCause.map((value, index) => value || session.state.rootCause[index]),
    ...(treeStage > 0 ? { treeStage, treeRevealed: treeStage === 2 } : {}),
    ...(processStep > 0 ? { processStep } : {}),
    ...(exerciseStage > 0 ? { exerciseStage } : {}) };
  if (state.exerciseGroups || previousGroups) {
    session.state.exerciseGroups = Array.from({ length: 6 }, (_, index) => Boolean(state.exerciseGroups?.[index] || previousGroups?.[index]));
  }
  if (orientationPlayed) session.state.orientationPlayed = true;
  try { sessionStorage.setItem(key(sectionId), JSON.stringify(session)); } catch { /* Keep memory fallback. */ }
  return true;
}
// Reconcile once on section entry, including termination while this tab was away.
export function syncRevealTermination(sectionId: string, token: string | null) {
  let session = getRevealSession(sectionId);
  if (session.terminationToken !== undefined && session.terminationToken !== token) {
    sessions.delete(sectionId);
    try { sessionStorage.removeItem(key(sectionId)); } catch { /* Storage is optional. */ }
    session = getRevealSession(sectionId);
  }
  session.terminationToken = token;
  try { sessionStorage.setItem(key(sectionId), JSON.stringify(session)); } catch { /* Keep memory fallback. */ }
}
export function resetLessonRevealState(sectionId: string) {
  sessions.delete(sectionId);
  try { sessionStorage.removeItem(key(sectionId)); } catch { /* Keep memory fallback. */ }
}
export function clearLessonRevealState(sectionId: string) {
  resetLessonRevealState(sectionId);
  if (sectionId === MIS311_RCA_SECTION_ID || sectionId === MANAGER_SECTION_ID) window.dispatchEvent(new CustomEvent('eiu-section-terminated', { detail: { sectionId } }));
}
