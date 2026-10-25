import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React, { act } from "react";
import { Window } from "happy-dom";
import JSZip from "jszip";
import * as registrations from "../examples/eiu-advertising-starter/lib/registrations.mjs";
import { site } from "../examples/eiu-advertising-starter/data/site.js";
const require = createRequire(import.meta.url);

test("advertising website supports tabs, plan selection, registration and confirmation", async () => {
  const window = new Window({ url: "http://localhost:3000" });
  for (const name of ["window", "document", "HTMLElement", "navigator"]) Object.defineProperty(globalThis, name, { configurable: true, value: name === "window" ? window : window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("examples/eiu-advertising-starter/components/MarketingSite.js", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: "MarketingSite.jsx",
  }).outputText, { exports, window, FormData: window.FormData, require: name => name === "../data/site" ? { site } : name === "../lib/registrations.mjs" ? registrations : require(name) });
  const container = window.document.createElement("div"); window.document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(exports.default)));
    assert.match(container.querySelector("h1").textContent, /Đưa ý tưởng/);
    await act(async () => container.querySelector("#tab-form").click());
    assert.equal(container.querySelector("#tab-form").getAttribute("aria-selected"), "true");
    assert.match(container.querySelector("#showcase-panel").textContent, /Thử một đăng ký thật/);
    const launch = [...container.querySelectorAll("button")].find(button => button.textContent.includes("Chọn Launch"));
    await act(async () => launch.click());
    const dialog = container.querySelector("dialog");
    assert.equal(dialog.open, true);
    assert.equal(container.querySelector('select[name="plan"]').value, "launch");
    container.querySelector('input[name="name"]').value = "An";
    container.querySelector('input[name="email"]').value = "an@example.com";
    await act(async () => container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    assert.match(container.querySelector(".confirmation").textContent, /Cảm ơn, An/);
    assert.equal(registrations.readRegistrations(window.localStorage)[0].plan, "launch");
    await act(async () => container.querySelector(".confirmation button").click());
    assert.equal(dialog.open, false);
    assert.equal(container.querySelectorAll("details").length, 3);
  } finally { await act(async () => root.unmount()); await window.happyDOM.close(); }
});

test("download ZIP contains a runnable source project without dependencies, build outputs or secrets", async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync("public/downloads/eiu-advertising-starter.zip"));
  const entries = Object.keys(zip.files);
  for (const name of ["package.json", "README.md", "app/page.js", "app/globals.css", "components/MarketingSite.js", "lib/registrations.mjs", ".gitignore"])
    assert.ok(zip.file(`eiu-advertising-starter/${name}`));
  assert.ok(entries.every(name => !/(?:^|\/)(?:node_modules|\.next|\.git|\.env)(?:\/|$)/.test(name)));
  const pkg = JSON.parse(await zip.file("eiu-advertising-starter/package.json").async("string"));
  assert.match(pkg.scripts.dev, /3000/);
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.test, "node --test");
});

test("starter lab uses the existing download and completes the local-to-GitHub flow", () => {
  const story = JSON.parse(fs.readFileSync("course-content/web-app-development/storyboard.json", "utf8"));
  const start = story.slides.find(slide => slide.section === 1 && slide.visual === "git-intro-starter").number;
  const end = story.slides.find(slide => slide.section === 1 && slide.visual === "git-intro-pull").number;
  const lab = story.slides.filter(slide => slide.section === 1 && slide.number >= start && slide.number <= end);
  assert.equal(lab.length, 10);
  assert.equal(lab.filter(slide => slide.adminOnly).length, 0);
  assert.equal(lab[0].cards[0].link, "/downloads/eiu-advertising-starter.zip");
  const text = JSON.stringify(lab);
  for (const command of ["npm install", "npm run dev", "npm.cmd run build", "localhost", "git push -u origin main", "git pull --ff-only origin main", "git switch main"])
    assert.ok(text.includes(command), `current lab includes ${command}`);
  assert.ok(text.includes("Search"));
});
