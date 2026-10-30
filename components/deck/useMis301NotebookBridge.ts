"use client";

import { useLayoutEffect, type RefObject } from "react";
import { MIS301_SECTION_ID } from "@/lib/mis301Practice";
import { listenInteractive } from "@/lib/realtime/client";

const files = new Set(["student_data.csv", "Course Offerings.xlsx"]);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z_]\w{0,63}$/.test(value);

type Frame = { name: string; file: string; format: "csv" | "excel"; sep?: string; header?: number | null; sheet?: number | string };
type ViewNode = { text: string } | { tag: string; className: string; children: ViewNode[] };
type Cell = { index: number; code: string; status: string; executed: boolean; output: ViewNode[] };
type Page = { page: number; selected: number; cells: Cell[] };
type Snapshot = { aliases: string[]; files: string[]; frames: Frame[]; execution: number; pages: Page[] };
const pages = new Set([5, 6, 7, 8]);
const viewTags = new Set(['div', 'p', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const storageKey = (sectionId: string) => `eiu:mis301:notebook:v2:${sectionId}`;
const emptyState = (): Snapshot => ({ aliases: [], files: [], frames: [], execution: 0, pages: [] });

export function clearMis301Notebook(sectionId: string, epoch?: string) {
  if (sectionId !== MIS301_SECTION_ID) return;
  try { sessionStorage.removeItem(storageKey(sectionId)); } catch { /* In-memory state remains available. */ }
  window.dispatchEvent(new CustomEvent('eiu-section-terminated', { detail: { sectionId, epoch } }));
}

function validPages(value: unknown): value is Page[] {
  let remaining = 5000;
  function validView(node: ViewNode, depth = 0): boolean {
    if (!node || typeof node !== 'object' || --remaining < 0 || depth > 12) return false;
    if ('text' in node) return typeof node.text === 'string' && node.text.length <= 12000;
    return viewTags.has(node.tag) && typeof node.className === 'string' && /^[a-zA-Z0-9 -]{0,120}$/.test(node.className)
      && Array.isArray(node.children) && node.children.every(child => validView(child, depth + 1));
  }
  return Array.isArray(value) && value.length <= pages.size && new Set(value.map(page => page?.page)).size === value.length
    && value.every(page => page && pages.has(page.page) && Number.isInteger(page.selected) && page.selected >= 0 && page.selected < 32
      && Array.isArray(page.cells) && page.cells.length <= 32 && new Set(page.cells.map((cell: Cell) => cell?.index)).size === page.cells.length
      && page.cells.every((cell: Cell) => cell && Number.isInteger(cell.index) && cell.index >= 0 && cell.index < 32
        && typeof cell.code === 'string' && cell.code.length <= 12000 && typeof cell.status === 'string' && cell.status.length <= 160
        && typeof cell.executed === 'boolean' && Array.isArray(cell.output) && cell.output.every(node => validView(node))));
}

function validSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const state = value as Snapshot;
  return validPages(state.pages) && Array.isArray(state.aliases) && state.aliases.length <= 32 && state.aliases.every(identifier)
    && new Set(state.aliases).size === state.aliases.length
    && Array.isArray(state.files) && state.files.length <= 2 && state.files.every(file => files.has(file))
    && Number.isSafeInteger(state.execution) && state.execution >= 0
    && Array.isArray(state.frames) && state.frames.length <= 64
    && new Set(state.frames.map(frame => frame?.name)).size === state.frames.length
    && state.frames.every(frame => frame && identifier(frame.name) && !state.aliases.includes(frame.name)
      && files.has(frame.file) && state.files.includes(frame.file)
      && (frame.format === "csv" && frame.file.endsWith(".csv")
        && typeof frame.sep === "string" && frame.sep.length === 1
        && (frame.header === null || Number.isSafeInteger(frame.header) && Number(frame.header) >= 0)
        || frame.format === "excel" && frame.file.endsWith(".xlsx")
        && (frame.sheet === 0 || frame.sheet === 1 || frame.sheet === "Instructors" || frame.sheet === "Courses")));
}

// Migrate the previous CSV/Excel/Explore pages without rerunning cells or clearing variables.
function mergeNotebookPages(state: Snapshot): Snapshot {
  const offsets = new Map([[5, 0], [6, 4], [7, 7]]);
  const cells: Cell[] = [];
  let selected = 0;
  for (const page of state.pages) {
    const offset = offsets.get(page.page);
    if (offset === undefined) continue;
    for (const cell of page.cells) if (cell.index < (page.page === 5 ? 4 : page.page === 6 ? 3 : 6)) cells.push({ ...cell, index: offset + cell.index });
    if (page.page === 5) selected = page.selected;
  }
  return { ...state, pages: cells.length ? [{ page: 5, selected, cells }] : [] };
}

// Keep the notebook in this browser session until the server-owned termination epoch changes.
// Only bounded descriptors and native output nodes cross the opaque iframe boundary.
export function useMis301NotebookBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  useLayoutEffect(() => {
    if (sectionId !== MIS301_SECTION_ID) return;
    const controller = new AbortController();
    let state = emptyState(), epoch = '', generation = 0, initialized = false, sessionKey = '';
    let initializing: Promise<void> | undefined, checking: Promise<void> | undefined;
    const persist = () => {
      try { sessionStorage.setItem(storageKey(sectionId), JSON.stringify({ epoch, layout: 'pandas-workspace-v1', state })); } catch { /* Retain in-memory state when browser storage is unavailable. */ }
    };
    function initialize(): Promise<void> {
      if (initialized) return Promise.resolve();
      if (initializing) return initializing;
      const captured = generation;
      const operation = (async () => {
        const response = await fetch(`/api/sections/${encodeURIComponent(sectionId)}/control`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('Unable to verify the notebook session.');
        const control = await response.json();
        if (controller.signal.aborted || captured !== generation) throw Error('The section session has changed.');
        if (!control.success || typeof control.terminationToken !== 'string') throw Error('Unable to verify the section session.');
        epoch = control.terminationToken; state = emptyState();
        try {
          const raw = sessionStorage.getItem(storageKey(sectionId));
          const saved = raw && raw.length <= 500000 ? JSON.parse(raw) : null;
          if (saved?.epoch === epoch && validSnapshot(saved.state)) state = saved.layout === 'pandas-workspace-v1' ? saved.state : mergeNotebookPages(saved.state);
        } catch { /* Invalid snapshots cannot restore a previous section session. */ }
        sessionKey = crypto.randomUUID(); initialized = true; persist();
      })();
      initializing = operation;
      void operation.finally(() => { if (initializing === operation) initializing = undefined; }).catch(() => {});
      return operation;
    }
    const checkEpoch = (): Promise<void> => {
      if (!initialized) return initialize();
      if (checking) return checking;
      const captured = generation;
      const operation = (async () => {
        const response = await fetch(`/api/sections/${encodeURIComponent(sectionId)}/control`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('Unable to verify the notebook session.');
        const control = await response.json();
        if (controller.signal.aborted || captured !== generation) return;
        if (!control.success || typeof control.terminationToken !== 'string') throw Error('Unable to verify the notebook session.');
        if (control.terminationToken !== epoch) clearMis301Notebook(sectionId, control.terminationToken);
      })();
      checking = operation;
      void operation.finally(() => { if (checking === operation) checking = undefined; }).catch(() => {});
      return operation;
    };
    const receive = async (event: MessageEvent) => {
      const target = frame.current;
      const message = event.data;
      if (!target || event.source !== target.contentWindow || message?.type !== 'eiu-notebook-runtime'
        || message.requestId !== target.dataset.requestId
        || message.requestId !== `${sectionId}:5`) return;
      if (message.operation === 'save' && initialized && message.sessionKey === sessionKey && validSnapshot(message.state) && message.state.pages.every((page: Page) => page.page === 5)) {
        state = structuredClone(message.state); persist(); return;
      }
      if (message.operation !== 'load' || typeof message.token !== 'string' || message.token.length > 80) return;
      const captured = generation;
      let error: string | undefined;
      try {
        const restored = initialized;
        await initialize();
        if (restored) await checkEpoch();
      } catch (cause) { error = cause instanceof Error ? cause.message : 'Unable to restore notebook.'; }
      if (controller.signal.aborted || captured !== generation || target !== frame.current || message.requestId !== target.dataset.requestId) return;
      target.contentWindow?.postMessage({ type: 'eiu-notebook-state', requestId: message.requestId, token: message.token, state: { ...state, sessionKey }, error }, '*');
    };
    const terminate = (event: Event) => {
      if ((event as CustomEvent).detail?.sectionId !== sectionId) return;
      generation++; initialized = false; sessionKey = ''; state = emptyState(); initializing = undefined; checking = undefined;
      epoch = typeof (event as CustomEvent).detail.epoch === 'string' ? (event as CustomEvent).detail.epoch : '';
      try { sessionStorage.removeItem(storageKey(sectionId)); } catch { /* Storage is optional. */ }
      const target = frame.current;
      target?.contentWindow?.postMessage({ type: 'eiu-notebook-terminated', requestId: target.dataset.requestId }, '*');
    };
    window.addEventListener('message', receive);
    window.addEventListener('eiu-section-terminated', terminate);
    void initialize().catch(() => {});
    const verify = () => { void checkEpoch().catch(() => { /* Retain state during temporary connection failures. */ }); };
    const stop = listenInteractive(sectionId, 'control', verify);
    window.addEventListener('focus', verify);
    return () => {
      controller.abort(); generation++;
      stop();
      window.removeEventListener('focus', verify);
      window.removeEventListener('message', receive);
      window.removeEventListener('eiu-section-terminated', terminate);
    };
  }, [sectionId, frame]);
}
