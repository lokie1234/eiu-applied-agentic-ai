export type TrackedSection = "section1" | "section2";

interface PresenceEntry {
  section: TrackedSection;
  lastSeen: number;
}

// Global registry preserving presence across hot reloads and lambda invocations
const globalRegistry = globalThis as unknown as {
  __eiu_presence_registry?: Map<string, PresenceEntry>;
};

if (!globalRegistry.__eiu_presence_registry) {
  globalRegistry.__eiu_presence_registry = new Map<string, PresenceEntry>();
}

const store = globalRegistry.__eiu_presence_registry;

// A client is considered active if seen within the last 10 seconds
const ACTIVE_TIMEOUT_MS = 10000;

export function recordPresence(clientId: string, section: TrackedSection) {
  if (!clientId || (section !== "section1" && section !== "section2")) return;
  store.set(clientId, {
    section,
    lastSeen: Date.now(),
  });
}

export function removePresence(clientId: string) {
  if (!clientId) return;
  store.delete(clientId);
}

export function getPresenceCounts(): {
  section1: number;
  section2: number;
  total: number;
} {
  const now = Date.now();
  let countS1 = 0;
  let countS2 = 0;

  for (const [clientId, entry] of store.entries()) {
    if (now - entry.lastSeen > ACTIVE_TIMEOUT_MS) {
      store.delete(clientId);
    } else {
      if (entry.section === "section1") countS1++;
      else if (entry.section === "section2") countS2++;
    }
  }

  return {
    section1: countS1,
    section2: countS2,
    total: countS1 + countS2,
  };
}

