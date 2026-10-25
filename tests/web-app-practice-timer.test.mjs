import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { Window } from "happy-dom";

const documents = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/tsxDocument.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: documents });
const source = fs.readFileSync("course-content/web-app-development/Section1.js", "utf8");

function open(isAdmin, page = 28, reducedMotion = false) {
  const window = new Window(), messages = [], intervals = new Map(), animations = [];
  window.matchMedia = () => ({ matches: reducedMotion });
  window.HTMLElement.prototype.animate = function(frames, options) {
    const animation = { element: this, frames, options, cancelled: false, finished: Promise.resolve(), cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation;
  };
  let now = 1000, nextId = 0, hidden = false;
  window.setInterval = callback => { const id = ++nextId; intervals.set(id, callback); return id; };
  window.clearInterval = id => intervals.delete(id);
  Object.defineProperty(window.document, "hidden", { configurable: true, get: () => hidden });
  window.document.body.innerHTML = '<div id="root"></div>';
  const html = documents.createTsxDocument(source, page, "", "", "practice-test", isAdmin);
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    window, document: window.document, Node: window.Node,
    parent: { postMessage: message => messages.push(message) },
    Date: class extends Date { static now() { return now; } },
  });
  assert.equal(window.document.querySelector("#error"), null);
  return {
    window, messages, intervals, animations, doc: window.document,
    advance(milliseconds) { now += milliseconds; [...intervals.values()].forEach(callback => callback()); },
    hide(value) { hidden = value; window.document.dispatchEvent(new window.Event("visibilitychange")); },
    close: () => window.happyDOM.close(),
  };
}

test("only teaching access sees practice after the agent flow; learners continue to showcase", async () => {
  const admin = open(true), learner = open(false), count = open(false, null);
  try {
    assert.equal(admin.messages[0].slides, 30);
    assert.ok(admin.doc.querySelector(".freeDesignPractice"));
    assert.equal(admin.doc.querySelector('.practiceWorkspace'), null);
    assert.equal(admin.doc.querySelector('.practiceEyebrow'), null);
    assert.equal(admin.doc.querySelector('.practiceBurst').parentElement.className, 'practiceTimerFace');
    assert.equal(learner.messages[0].slides, 29);
    assert.equal(count.messages[0].slides, 29);
    assert.equal(learner.doc.querySelector(".freeDesignPractice"), null);
    assert.ok(learner.doc.querySelector('[data-eiu-showcase]'), "learners proceed to showcase without the teaching timer");
    assert.equal(count.doc.querySelector(".practiceTimer"), null, "count mode never starts a timer");
  } finally { await Promise.all([admin.close(), learner.close(), count.close()]); }
});

test("teaching duration is configurable, validates input, and resets without changing pause or expiry behavior", async () => {
  const f=open(true);
  try {
    const input=f.doc.querySelector('.practiceDuration input');
    const [toggle,reset]=f.doc.querySelectorAll('.practiceTimerControls button');
    const output=f.doc.querySelector('[role=timer]');
    const choose=value=>{input.value=value;input.dispatchEvent(new f.window.Event('change',{bubbles:true}));};
    choose('7');assert.equal(output.textContent,'07:00');assert.equal(f.intervals.size,0);
    for(const invalid of ['0','46','180','1.5','']){choose(invalid);assert.equal(input.value,'7');assert.equal(output.textContent,'07:00');}
    toggle.click();assert.equal(input.disabled,true);f.advance(60_000);assert.equal(output.textContent,'06:00');
    toggle.click();assert.equal(input.disabled,false);assert.equal(f.intervals.size,0);
    choose('2');assert.equal(output.textContent,'02:00');assert.equal(toggle.textContent,'Bắt đầu');
    toggle.click();f.advance(120_000);assert.equal(output.textContent,'00:00');assert.equal(input.disabled,false);
    assert.equal(f.doc.querySelector('.freeDesignPractice').dataset.completed,'true');
    reset.click();assert.equal(output.textContent,'02:00');assert.equal(toggle.disabled,false);
    choose('45');assert.equal(output.textContent,'45:00');
    choose('1');assert.equal(output.textContent,'01:00');
  } finally {await f.close();}
});

test("only timer controls remain; expiry scatters the icons and reset cancels them", async () => {
  const f = open(true);
  const controls = f.doc.querySelectorAll('.practiceTimerControls button');
  const [toggle, reset] = controls;
  const display = f.doc.querySelector('[role="timer"]');
  try {
    assert.equal(controls.length, 2);
    assert.equal(f.doc.querySelector('.practicePreview'), null);
    const count = f.doc.querySelectorAll('.practiceBurstIcon').length;
    assert.equal(count, 96);
    assert.equal(f.animations.length, 0);
    toggle.click(); f.advance(10_000);
    assert.equal(display.textContent, '14:50');
    assert.equal(f.animations.length, 0);
    f.advance(890_000);
    assert.equal(display.textContent, '00:00'); assert.equal(f.intervals.size, 0);
    assert.equal(f.animations.length, count);
    assert.equal(f.doc.querySelector('.freeDesignPractice').dataset.completed, 'true');
    reset.click(); assert.ok(f.animations.every(animation => animation.cancelled));
    assert.equal(display.textContent, '15:00');
    toggle.click(); f.advance(900_000);
    assert.equal(f.animations.length, count * 2);
    assert.equal(f.doc.querySelectorAll('.practiceBurstIcon').length, count);
    f.window.dispatchEvent(new f.window.Event('pagehide'));
    assert.ok(f.animations.every(animation => animation.cancelled));
  } finally { await f.close(); }
});

test("filled timer keeps the icons still, releases its animations and leaves controls accessible", async () => {
  const f = open(true);
  try {
    f.doc.querySelector('.practiceTimerControls button').click(); f.advance(900_000);
    await Promise.resolve();
    const layer = f.doc.querySelector('.practiceBurst');
    assert.equal(layer.dataset.filled, 'true');
    assert.ok([...layer.children].every(icon => icon.style.opacity === '1'));
    assert.ok(f.animations.every(animation => animation.cancelled), 'finished effects release their animation handles');
    assert.equal(f.doc.querySelectorAll('.practiceBurstIcon').length, 96);
    assert.equal(layer.contains(f.doc.querySelector('.practiceTimerControls')), false);
    f.hide(true); f.hide(false);
    assert.equal(layer.dataset.filled, 'true', 'the completed fill stays visible when returning to the tab');
    assert.equal(f.intervals.size, 0);
    f.doc.querySelector('.practiceTimerControls button:nth-child(2)').click();
    assert.equal(layer.hasAttribute('data-filled'), false, 'reset clears the icons so the clock is readable');
    assert.ok([...layer.children].every(icon => icon.style.opacity === '0'));
    f.doc.querySelector('.practiceTimerControls button:nth-child(2)').click();
    assert.equal(layer.hasAttribute('data-filled'), false);
    assert.ok([...layer.children].every(icon => icon.style.opacity === '0'));
  } finally { f.window.dispatchEvent(new f.window.Event('pagehide')); await f.close(); }
});

test("reduced-motion expiry fades the icons in place without sending them across the slide", async () => {
  const f = open(true, 28, true);
  try {
    f.doc.querySelector('.practiceTimerControls button').click(); f.advance(900_000);
    assert.equal(f.animations.length, 96);
    assert.ok(f.animations.every(animation => animation.frames.every(frame => frame.transform === animation.frames[0].transform)));
    assert.equal(f.intervals.size, 0);
  } finally { f.window.dispatchEvent(new f.window.Event('pagehide')); await f.close(); }
});

test("the 15-minute timer starts on demand, pauses, resumes accurately across hidden tabs, resets and cleans up", async () => {
  const f = open(true);
  const display = f.doc.querySelector('[role="timer"]');
  const [toggle, reset] = f.doc.querySelectorAll(".practiceTimerControls button");
  try {
    assert.equal(display.textContent, "15:00"); assert.equal(f.intervals.size, 0);
    toggle.click(); assert.equal(f.intervals.size, 1);
    f.advance(61_000); assert.equal(display.textContent, "13:59");
    toggle.click(); assert.equal(f.intervals.size, 0);
    f.advance(300_000); assert.equal(display.textContent, "13:59");
    toggle.click(); f.hide(true); assert.equal(f.intervals.size, 0);
    f.advance(120_000); f.hide(false);
    assert.equal(display.textContent, "11:59"); assert.equal(f.intervals.size, 1);
    reset.click(); assert.equal(display.textContent, "15:00"); assert.equal(f.intervals.size, 0);
    toggle.click(); f.advance(900_000);
    assert.equal(display.textContent, "00:00"); assert.equal(toggle.disabled, true);
    assert.equal(f.doc.querySelector('[role="status"]').textContent, "Hết giờ");
    assert.equal(f.intervals.size, 0);
    reset.click(); toggle.click();
    f.window.dispatchEvent(new f.window.Event("pagehide"));
    assert.equal(f.intervals.size, 0);
    f.hide(false); assert.equal(f.intervals.size, 0, "leaving removes the visibility listener too");
  } finally { await f.close(); }
});
