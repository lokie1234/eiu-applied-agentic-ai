// UI reveal state only, scoped to this loaded JS module. Opaque lesson frames
// cannot use sessionStorage; no learner identity or reportable results live here.
export { SLIDE_STORAGE_KEYS } from "../../../lib/slideStorage";
const values = new Map<string, string>();
export function getSlideStorage(key: string) { return values.get(key) ?? null; }
export function setSlideStorage(key: string, value: string) { values.set(key, value); }
