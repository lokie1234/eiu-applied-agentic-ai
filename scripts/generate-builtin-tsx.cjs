// Run with PLAYWRIGHT_MODULE pointing to Playwright when it is not installed locally.
const fs = require("node:fs/promises");
const path = require("node:path");
const ts = require("typescript");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    for (const section of [1, 2]) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      await page.goto(`${process.env.EXPORT_ORIGIN || "http://localhost:3000"}/export-deck?section=section${section}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.querySelectorAll('[class*="slidePrintPage"]').length > 30);
      const data = await page.evaluate(async () => {
        const cache = new Map();
        async function embed(url) {
          if (url.startsWith("data:")) return url;
          const absolute = new URL(url, location.href).href;
          if (!cache.has(absolute)) cache.set(absolute, (async () => {
            const response = await fetch(absolute);
            if (!response.ok) throw Error(`Cannot embed ${absolute}`);
            const blob = await response.blob();
            return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
          })());
          return cache.get(absolute);
        }
        let css = [...document.styleSheets].map(sheet => [...sheet.cssRules].map(rule => rule.cssText).join("\n")).join("\n");
        for (const match of [...css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)]) {
          if (match[1].startsWith("#")) continue;
          css = css.replaceAll(match[0], `url("${await embed(match[1])}")`);
        }
        async function node(element) {
          if (element.nodeType === Node.TEXT_NODE) return element.textContent;
          if (element.nodeType !== Node.ELEMENT_NODE) return null;
          const props = {};
          for (const attribute of element.attributes) {
            if (["srcset", "loading", "fetchpriority"].includes(attribute.name) || attribute.name.startsWith("on")) continue;
            props[attribute.name === "class" ? "className" : attribute.name] = attribute.value;
          }
          if (element.tagName === "IMG") props.src = await embed(element.currentSrc || element.src);
          return { tag: element.localName, props, children: (await Promise.all([...element.childNodes].map(node))).filter(child => child !== null) };
        }
        return { css, slides: await Promise.all([...document.querySelectorAll('[class*="slidePrintPage"]')].map(node)) };
      });
      const source = `// EIU Agentic AI · Section ${section} · self-contained presentation snapshot.\n// Quiz, submissions and live application state are kept in the web lesson.\nconst css = ${JSON.stringify(data.css)};\nconst slides = ${JSON.stringify(data.slides)};\nfunction render(node) { if (typeof node === "string") return node; return h(node.tag, node.props, ...node.children.map(render)); }\nexport default slides.map(slide => <svg data-preserve-original="true" width="100%" height="100%" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg"><foreignObject width="960" height="540"><div xmlns="http://www.w3.org/1999/xhtml" style={{width:"960px",height:"540px",overflow:"hidden"}}><style>{css}</style>{render(slide)}</div></foreignObject></svg>);\n`;
      const directory = path.resolve("lib/drive/builtin-decks");
      await fs.mkdir(directory, { recursive: true });
      const compiled = ts.transpileModule(source, {fileName:"section.tsx", compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:"h",jsxFragmentFactory:"Fragment",esModuleInterop:true}}).outputText;
      await fs.writeFile(path.join(directory, `section${section}.js`), compiled);
      console.log(`Section ${section}: ${data.slides.length} slides, ${Buffer.byteLength(source)} bytes`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
