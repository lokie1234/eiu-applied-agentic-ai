"use client";

import { useLayoutEffect, type RefObject } from "react";
import { MIS301_SECTION_ID } from "@/lib/mis301Practice";

const files = new Set(["student_data.csv", "Course Offerings.xlsx"]);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z_]\w{0,63}$/.test(value);

type Frame = { name: string; file: string; format: "csv" | "excel"; sep?: string; header?: number | null; sheet?: number | string };
type ViewNode = { text: string } | { tag: string; className: string; children: ViewNode[] };
type Cell = { index: number; code: string; status: string; executed: boolean; output: ViewNode[] };
type Page = { page: number; selected: number; cells: Cell[] };
type Snapshot = { aliases: string[]; files: string[]; frames: Frame[]; execution: number; pages: Page[] };
const pages = new Set([5]);
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

// The demo contains local bundled data only. Its lifetime is this mounted section;
// practice authorization and remote termination remain owned by the root bridge.
export function useMis301NotebookBridge(sectionId: string, frame: RefObject<HTMLIFrameElement | null>) {
  useLayoutEffect(() => {
    if (sectionId !== MIS301_SECTION_ID) return;
    let state = emptyState(), sessionKey = crypto.randomUUID();
    // Discard snapshots created by older releases. Never restore or persist them.
    const discardStorage = () => {
      try { sessionStorage.removeItem(storageKey(sectionId)); } catch { /* Storage is optional. */ }
    };
    discardStorage();
    const receive = (event: MessageEvent) => {
      const target = frame.current, message = event.data;
      if (!target || event.source !== target.contentWindow || message?.type !== 'eiu-notebook-runtime'
        || message.requestId !== target.dataset.requestId || message.requestId !== `${sectionId}:5`) return;
      if (message.operation === 'edit' && message.sessionKey === sessionKey
        && Number.isInteger(message.index) && message.index >= 0 && message.index < 32
        && typeof message.code === 'string' && message.code.length <= 12000) {
        const cell = state.pages.find(page => page.page === 5)?.cells.find(cell => cell.index === message.index);
        if (cell) cell.code = message.code;
        return;
      }
      if (message.operation === 'save' && message.sessionKey === sessionKey && validSnapshot(message.state)) {
        // postMessage already cloned the payload across the sandbox boundary.
        state = message.state; return;
      }
      if (message.operation !== 'load' || typeof message.token !== 'string' || message.token.length > 80) return;
      target.contentWindow?.postMessage({ type: 'eiu-notebook-state', requestId: message.requestId,
        token: message.token, state: { ...state, sessionKey } }, '*');
    };
    const reset = () => { state = emptyState(); sessionKey = crypto.randomUUID(); discardStorage(); };
    const terminate = (event: Event) => {
      if ((event as CustomEvent).detail?.sectionId !== sectionId) return;
      reset();
      const target = frame.current;
      target?.contentWindow?.postMessage({ type: 'eiu-notebook-terminated', requestId: target.dataset.requestId }, '*');
    };
    window.addEventListener('message', receive);
    window.addEventListener('eiu-section-terminated', terminate);
    // Also clear a page kept in the browser's back/forward cache.
    window.addEventListener('pagehide', reset);
    const resume = (event: PageTransitionEvent) => {
      const target = frame.current;
      if (event.persisted && target?.dataset.requestId === `${sectionId}:5`) {
        reset();
        // The browser may preserve the old iframe DOM together with this page.
        target.srcdoc = target.srcdoc;
      }
    };
    window.addEventListener('pageshow', resume);
    return () => {
      reset();
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('message', receive);
      window.removeEventListener('eiu-section-terminated', terminate);
    };
  }, [sectionId, frame]);
}
