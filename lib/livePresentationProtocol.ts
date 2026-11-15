export type LiveNode = { id: number; tag: string; ns?: string; text?: string; attrs?: Record<string, string>; children?: number[]; scroll?: [number, number]; modal?: boolean; animations?: number[] };
export type LiveDocument = { root: number; width: number; height: number; page: number; nodes: LiveNode[] };
export type LivePatch = Omit<LiveDocument, 'nodes'> & { reset?: boolean; nodes: LiveNode[]; removed: number[] };
export const LIVE_MAX_BYTES = 900_000;

export function applyLivePatch(previous: string, encoded: string): string {
  if (encoded.length > LIVE_MAX_BYTES || new TextEncoder().encode(encoded).byteLength > LIVE_MAX_BYTES) throw new Error('Live update is too large.');
  const patch = JSON.parse(encoded) as LivePatch;
  if (!patch || !Number.isSafeInteger(patch.root) || !Number.isInteger(patch.page) || patch.page < 1 || patch.page > 10000 ||
      !Number.isFinite(patch.width) || patch.width < 100 || patch.width > 16000 || !Number.isFinite(patch.height) || patch.height < 100 || patch.height > 16000 ||
      !Array.isArray(patch.nodes) || patch.nodes.length > 2500 || !Array.isArray(patch.removed) || patch.removed.length > 2500) throw new Error('Invalid Live update.');
  const old: LiveDocument = patch.reset || !previous ? { ...patch, nodes: [] } : JSON.parse(previous);
  const map = new Map(old.nodes.map(node => [node.id, node]));
  for (const id of patch.removed) { if (!Number.isSafeInteger(id)) throw new Error('Invalid node.'); map.delete(id); }
  for (const node of patch.nodes) {
    if (!node || !Number.isSafeInteger(node.id) || node.id < 1 || typeof node.tag !== 'string' || node.tag.length > 50 ||
        (node.text !== undefined && (typeof node.text !== 'string' || node.text.length > 120000)) ||
        (node.children && (!Array.isArray(node.children) || node.children.length > 2500 || node.children.some(id => !Number.isSafeInteger(id)))) ||
        (node.attrs && (typeof node.attrs !== 'object' || Object.keys(node.attrs).length > 80 || Object.entries(node.attrs).some(([key,value]) => key.length > 100 || typeof value !== 'string' || value.length > 2000000))) ||
        (node.scroll && (!Array.isArray(node.scroll) || node.scroll.length !== 2 || node.scroll.some(value => !Number.isFinite(value) || value < 0 || value > 1))) ||
        (node.modal !== undefined && typeof node.modal !== 'boolean') ||
        (node.animations && (!Array.isArray(node.animations) || node.animations.length>12 || node.animations.some(time=>!Number.isFinite(time)||time<0)))) throw new Error('Invalid node.');
    map.set(node.id, node);
  }
  const seen = new Set<number>();
  function visit(id: number, depth: number) {
    if (depth > 120 || seen.has(id) || !map.has(id)) throw new Error('Invalid Live tree.');
    seen.add(id); for (const child of map.get(id)!.children || []) visit(child, depth + 1);
  }
  visit(patch.root, 0);
  if (seen.size > 2500) throw new Error('Live slide is too complex.');
  const result = JSON.stringify({ root: patch.root, width: patch.width, height: patch.height, page: patch.page, nodes: [...seen].map(id => map.get(id)!) });
  if (result.length > LIVE_MAX_BYTES || new TextEncoder().encode(result).byteLength > LIVE_MAX_BYTES) throw new Error('Live slide is too large.');
  return result;
}
