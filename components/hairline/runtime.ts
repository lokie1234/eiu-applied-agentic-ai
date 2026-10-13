export type FigureHandle = { set(value: number): void; destroy(): void };
type HairlineRuntime = {
  inject(root: Document): void;
  mk(tag: string, attributes: Record<string, string>, parent: Element): SVGSVGElement;
  setReducedMotion(value: boolean): void;
};
type Figure = {
  name: string;
  mount(host: { stage: HTMLElement; svg: SVGSVGElement; read: HTMLSpanElement }, value: number): FigureHandle;
};
type HairlineWindow = Window & { HL: HairlineRuntime; hairline?: (figure: Figure) => void };
let runtimeLoading: Promise<HairlineRuntime> | undefined;
let registrationQueue = Promise.resolve();
const figures = new Map<string, Promise<{ runtime: HairlineRuntime; figure: Figure }>>();

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error(`Cannot load ${src}`)); };
    document.head.append(script);
  });
}

function loadRuntime() {
  if (!runtimeLoading) {
    runtimeLoading = (async () => {
      const appWindow = window as unknown as HairlineWindow;
      if (!appWindow.HL) await loadScript("/hairline/kernel.js");
      appWindow.HL.inject(document);
      const motion = window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)");
      const syncMotion = () => appWindow.HL.setReducedMotion(motion.matches);
      syncMotion();
      motion.addEventListener("change", syncMotion);
      return appWindow.HL;
    })().catch(error => { runtimeLoading = undefined; throw error; });
  }
  return runtimeLoading;
}

export function loadHairlineFigure(name: "loading-dots") {
  const existing = figures.get(name);
  if (existing) return existing;
  // Figures register through the same global callback. Serialize registration
  // while sharing one engine and one cached promise for each figure.
  const loading = registrationQueue.then(async () => {
    const runtime = await loadRuntime();
    const appWindow = window as unknown as HairlineWindow;
    let figure: Figure | undefined;
    const previous = appWindow.hairline;
    appWindow.hairline = value => { figure = value; };
    try { await loadScript(`/hairline/${name}.js`); }
    finally { appWindow.hairline = previous; }
    if (!figure) throw new Error(`Hairline ${name} did not register`);
    return { runtime, figure };
  }).catch(error => { figures.delete(name); throw error; });
  figures.set(name, loading);
  registrationQueue = loading.then(() => undefined, () => undefined);
  return loading;
}
