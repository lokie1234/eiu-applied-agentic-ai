export const MIS311_MODELLING_SECTION_ID = 'b7bd6b13-c654-412b-badb-12853350e148';
const storageKey = 'eiu:mis311:modelling:presentation:v1';
type Snapshot = Record<string, Record<string, boolean | number>>;

// Leaving the course, ending the section or a successful login starts fresh.
export function resetMis311Presentation() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(storageKey); } catch { /* Navigation remains available when storage is disabled. */ }
  window.dispatchEvent(new window.Event('eiu-mis311-presentation-reset'));
}

function clean(page: number, value: unknown): Record<string, boolean | number> {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const flag = (key: string) => input[key] === true;
  const index = (key: string, max: number) => Number.isInteger(input[key]) && Number(input[key]) >= 0 && Number(input[key]) <= max ? Number(input[key]) : 0;
  if (page === 2) return { treeOpen: flag('treeOpen'), scenarioOpen: flag('scenarioOpen'), processOpen: flag('processOpen'), activeRole: index('activeRole', 3) };
  if (page === 3) return { revealed: flag('revealed'), definitionOpen: flag('definitionOpen') };
  if (page === 4) return { technique: index('technique', 3), view: index('view', 1) };
  if (page === 6) return { stage: index('stage', 4) };
  if (page === 7) return { built: flag('built') };
  return {};
}

export function readMis311Presentation(sectionId: string): Snapshot {
  if (sectionId !== MIS311_MODELLING_SECTION_ID || typeof window === 'undefined') return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    return Object.fromEntries([2, 3, 4, 6, 7].filter(page => stored[page]).map(page => [page, clean(page, stored[page])]));
  } catch { return {}; }
}

export function saveMis311PresentationState(sectionId: string, activePage: number, page: number, value: unknown) {
  if (sectionId !== MIS311_MODELLING_SECTION_ID || typeof window === 'undefined' ||
      !({ 2: [2, 3], 3: [4], 5: [6], 6: [7] } as Record<number, number[]>)[activePage]?.includes(page)) return false;
  const states = readMis311Presentation(sectionId);
  const next = clean(page, value);
  // Revealing is monotonic within the current course visit.
  if (page === 3) next.revealed = next.revealed || states[page]?.revealed === true;
  if (page === 6) next.stage = Math.max(Number(states[page]?.stage || 0), Number(next.stage));
  if (page === 7) next.built = next.built || states[page]?.built === true;
  if (Object.keys(next).every(key => states[page]?.[key] === next[key])) return true;
  states[page] = next;
  try { window.localStorage.setItem(storageKey, JSON.stringify(states)); } catch { /* Keep the current frame usable if storage is unavailable. */ }
  return true;
}
