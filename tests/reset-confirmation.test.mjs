import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function load(path, dependencies) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => name === "@/lib/realtime/publish" ? { notifyRealtime() {} } : name === "@/lib/realtime/server" ? { realtimeConfigured: () => false } : name === "@/lib/realtime/client" ? { listenInteractive: () => () => {}, realtimeReady: () => false, useRealtimeReady: () => false } : name === "@/lib/reports/workbook" ? load("lib/reports/workbook.ts", { exceljs: { default: require("exceljs") } }) : dependencies[name], Date, console, crypto: globalThis.crypto, URL, Response });
  return exports;
}
function fixture(role = "admin", failAudit = false) {
  const writes = [];
  const identity = { name: "Alice", email: "alice@example.test", sessionId: "global", information: { department: "IT" } };
  const tables = {
    section_state: [{ section: "section1" }, { section: "section2" }],
    learner_profiles: [{ ...identity, section: "section1" }],
    ideas: [{ id: "idea", ...identity, section: "section1" }],
    showcase_items: [], quiz_results: [], feedback: [], presence_sessions: [],
    access_audit_logs: [
      { id: 1, action: "PASSCODE_LOGIN", details: { ...identity, sectionKeys: ["section1", "section2"] } },
      { id: 2, action: "PASSCODE_LOGIN", details: { ...identity, sessionId: "single", sectionKeys: ["section1"] } },
      { id: 3, action: "QUIZ_COMPLETED", details: { ...identity, section: "section1" } },
      { id: 4, action: "FEEDBACK_SUBMITTED", details: { ...identity, section: "section2" } },
      { id: 5, action: "PASSCODE_LOGIN_FAILED", details: { fingerprint: "limit" } },
      { id: 6, action: "ADMIN_ACTION", details: {} },
    ],
  };
  const db = { from(table) {
    let kind = "select", patch, start = 0, end = Infinity; const filters = [];
    const value = (row, key) => key.includes("->>") ? row[key.split("->>")[0]]?.[key.split("->>")[1]] : row[key];
    const query = {
      select() { return this; }, order() { return this; }, lte() { return this; }, range(a, b) { start = a; end = b; return this; },
      delete() { kind = "delete"; writes.push({ table, action: kind }); return this; },
      update(data) { kind = "update"; patch = data; writes.push({ table, action: kind }); return this; },
      eq(key, val) { filters.push(row => value(row, key) === val); return this; },
      neq(key, val) { filters.push(row => value(row, key) !== val); return this; },
      like(key, pattern) { filters.push(row => String(value(row,key)).startsWith(pattern.slice(0,-1))); return this; },
      not(key, operator, pattern) { filters.push(row => !String(value(row,key)).startsWith(pattern.slice(0,-1))); return this; },
      in(key, values) { filters.push(row => values.includes(value(row, key))); return this; },
      contains(key, val) { filters.push(row => Object.entries(val).every(([k, values]) => values.every(v => row[key]?.[k]?.includes(v)))); return this; },
      async maybeSingle() { const result = await this; return { ...result, data: result.data?.[0] }; },
      then(resolve, reject) {
        if (failAudit && table === "access_audit_logs" && kind !== "select") return Promise.resolve({ error: { message: "Audit cleanup failed" } }).then(resolve, reject);
        const matches = row => filters.every(filter => filter(row));
        const selected = (tables[table] || []).filter(matches);
        if (kind === "delete") tables[table] = tables[table].filter(row => !matches(row));
        if (kind === "update") selected.forEach(row => Object.assign(row, patch));
        return Promise.resolve({ data: kind === "select" ? selected.slice(start, end + 1) : null }).then(resolve, reject);
      },
    }; return query;
  } };
  const dependencies = {
    "next/server": { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200 }) } },
    "@/lib/resetLearningScope": load("lib/resetLearningScope.ts", {"./courseHierarchy":load("lib/courseHierarchy.ts",{}),"./reportScopes":load("lib/reportScopes.ts",{})}),
    "@/lib/currentRole": { currentRole: async () => role },
    "@/lib/supabase/server": { getSupabaseAdmin: () => db },
  };
  const route = load("app/api/admin/reset/route.ts", dependencies);
  return { writes, tables, dependencies, scoped: (scope,password="Lovekjng123@@")=>route.POST({json:async()=>({...scope,password})}), post: (password, section = "all") => route.POST({ json: async () => ({ password, section }) }) };
}

test("reset rejects the old confirmation and incorrect passcodes before any database writes", async () => {
  const f = fixture();
  for (const value of ["RESET", "", "lovekjng123@@", "Lovekjng123@", " Lovekjng123@@", "Lovekjng123@@ ", 123]) {
    assert.equal((await f.post(value)).status, 401);
  }
  assert.equal(f.writes.length, 0);
});

test("the exact fixed passcode permits an administrator to reset data", async () => {
  const f = fixture();
  assert.equal((await f.post("Lovekjng123@@")).status, 200);
  assert.equal(f.writes.filter(write => write.action === "delete").length, 7);
  assert.equal(f.writes.filter(write => write.action === "update").length, 1);
});

test("a facilitator cannot reset data even with the correct passcode", async () => {
  const f = fixture("section1");
  assert.equal((await f.post("Lovekjng123@@")).status, 403);
  assert.equal(f.writes.length, 0);
});

test("reset all clears learner audit sources so a newly exported workbook has no learner names", async () => {
  const f = fixture();
  assert.equal((await f.post("Lovekjng123@@")).status, 200);
  assert.deepEqual(f.tables.access_audit_logs.map(row => row.action), ["PASSCODE_LOGIN_FAILED", "ADMIN_ACTION"]);
  assert.ok(f.tables.section_state.every(row => row.termination_token && row.quiz_open === false));
  const ExcelJS = require("exceljs");
  const report = load("app/api/admin/report/route.ts", { ...f.dependencies, exceljs: { default: ExcelJS }, "@/lib/reportLearners": load("lib/reportLearners.ts", {}), "@/lib/reportScopes": load("lib/reportScopes.ts", {}), "@/lib/courseHierarchy": load("lib/courseHierarchy.ts", {}) });
  const response = await report.GET({ url: "http://localhost/api/admin/report?section=all" });
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  for (const sheet of workbook.worksheets) {
    sheet.eachRow(row => assert.doesNotMatch(row.values.join("|"), /Alice/));
    if (sheet.name.endsWith("Hoc vien") || sheet.name === "Learner activity") assert.equal(sheet.rowCount, 1);
  }
});

test("reset one section removes its activities and login scope but keeps the other section's learner identity", async () => {
  const f = fixture();
  assert.equal((await f.post("Lovekjng123@@", "section1")).status, 200);
  const login = f.tables.access_audit_logs.find(row => row.id === 1);
  assert.deepEqual(login.details.sectionKeys, ["section2"]);
  assert.equal(login.details.name, "Alice"); assert.equal(login.details.information.department, "IT");
  assert.ok(!f.tables.access_audit_logs.some(row => row.id === 2 || row.id === 3));
  assert.ok(f.tables.access_audit_logs.some(row => row.id === 4));
  const { collectReportLearners } = load("lib/reportLearners.ts", {});
  const learners = collectReportLearners(f.tables.learner_profiles, f.tables.access_audit_logs, f.tables.ideas);
  assert.ok(!learners.some(row => row.section === "section1"));
  assert.ok(learners.some(row => row.section === "section2" && row.name === "Alice"));
  assert.equal(f.tables.section_state[1].termination_token, undefined);
});

test("section reset processes more than one page of login records without skipping any", async () => {
  const f = fixture();
  for (let i = 10; i < 1110; i++) f.tables.access_audit_logs.push({ id: i, action: "PASSCODE_LOGIN", details: { sectionKeys: ["section1"] } });
  assert.equal((await f.post("Lovekjng123@@", "section1")).status, 200);
  assert.ok(!f.tables.access_audit_logs.some(row => row.action === "PASSCODE_LOGIN" && row.details.sectionKeys.includes("section1")));
});

test("an audit cleanup failure cannot report a successful reset", async () => {
  const f = fixture("admin", true);
  const result = await f.post("Lovekjng123@@");
  assert.equal(result.status, 500); assert.equal(result.data.success, false);
  assert.equal(f.tables.section_state[0].termination_token, undefined);
});

test("reset removes matching modern login scopes so exported learners cannot reappear", async () => {
  const f = fixture();
  f.tables.access_audit_logs.push({ id: 9999, action: "PASSCODE_LOGIN", details: { sessionId: "modern", name: "Modern", email: "modern@example.test", sectionKeys: ["section1", "section2"], scopes: [{ courseId: "c", sectionId: "s1", section: "section1" }, { courseId: "c", sectionId: "s2", section: "section2" }] } });
  assert.equal((await f.post("Lovekjng123@@", "section1")).status, 200);
  const login = f.tables.access_audit_logs.find(row => row.id === 9999);
  assert.deepEqual(login.details.scopes.map(scope => scope.sectionId), ["s2"]);
  const { collectReportLearners } = load("lib/reportLearners.ts", {});
  assert.deepEqual(Array.from(collectReportLearners([], [login], []), row => row.section), ["section2"]);
});


function scopedFixture(role='admin',failAudit=false){
  const f=fixture(role,failAudit);
  const folderGroups=[{id:'ai',name:'AI Training',order:1},{id:'web',name:'Web Training',order:2}];
  f.tables.courses=[{id:'core',slug:'applied-agentic-ai',title:'Applied AI',description:JSON.stringify({folderGroups,folderGroupId:'ai'})},...['web1','web2','web3'].map(id=>({id,slug:id,title:id,description:JSON.stringify({folderGroupId:'web'})}))];
  f.tables.course_sections=[{id:'core1',course_id:'core',section_key:'section1',title:'Core 1'},{id:'core2',course_id:'core',section_key:'section2',title:'Core 2'},...Array.from({length:4},(_,i)=>({id:'web1s'+(i+1),course_id:'web1',section_key:'section'+(i+1),title:'Web '+(i+1)})),{id:'web2s1',course_id:'web2',section_key:'section1',title:'Web 2.1'},{id:'web3s1',course_id:'web3',section_key:'section1',title:'Web 3.1'}];
  const scopes=f.tables.course_sections.map(s=>({courseId:s.course_id,sectionId:s.id,section:s.section_key}));
  const identity={sessionId:'shared',name:'Shared learner',email:'shared@example.test'};
  f.tables.access_audit_logs.push({id:100,action:'PASSCODE_LOGIN',details:{...identity,scopes,sectionKeys:['section1','section2','section3','section4']}});
  scopes.forEach((scope,i)=>f.tables.access_audit_logs.push({id:200+i,action:'SECTION_OPENED',course_id:scope.courseId,details:{...identity,...scope}}));
  scopes.forEach(scope=>f.tables.presence_sessions.push({client_id:'v2:'+scope.sectionId+':session:tab',section:scope.section==='section2'?'section2':'section1'}));
  f.tables.presence_sessions.push({client_id:'legacy',section:'section1'});
  return f;
}

test('scoped reset uses actual section IDs and preserves other courses sharing section1',async()=>{
  const f=scopedFixture();const scope={folderId:'web',courseId:'web1',sectionId:'web1s1'};
  for (const [index, action] of ['SECTION_TERMINATED','QUIZ_OPENED','QUIZ_COMPLETED','FEEDBACK_SUBMITTED'].entries()) f.tables.access_audit_logs.push({id:500+index,action,course_id:'web1',details:{courseId:'web1',sectionId:'web1s1',section:'section1',submissionStorage:'audit'}});
  assert.equal((await f.scoped(scope)).status,200);
  assert.ok(f.tables.learner_profiles.length&&f.tables.ideas.length,'legacy Applied AI rows remain');
  assert.ok(!f.tables.access_audit_logs.some(row=>row.details.sectionId==='web1s1'));
  assert.ok(f.tables.access_audit_logs.some(row=>row.details.sectionId==='core1'));
  const login=f.tables.access_audit_logs.find(row=>row.id===100);assert.equal(login.details.scopes.length,7);assert.ok(login.details.scopes.some(s=>s.sectionId==='core1'));assert.ok(!login.details.scopes.some(s=>s.sectionId==='web1s1'));
  assert.ok(f.tables.presence_sessions.some(row=>row.client_id==='legacy'));assert.ok(!f.tables.presence_sessions.some(row=>row.client_id.startsWith('v2:web1s1:')));assert.ok(f.tables.presence_sessions.some(row=>row.client_id.startsWith('v2:core1:')));
  assert.ok(f.tables.section_state.every(row=>!row.termination_token));
});

test('folder reset includes three courses and all their sections automatically',async()=>{
  const f=scopedFixture();assert.equal((await f.scoped({folderId:'web',courseId:'all',sectionId:'all'})).status,200);
  const remaining=f.tables.access_audit_logs.filter(row=>row.action==='SECTION_OPENED');assert.deepEqual(remaining.map(row=>row.details.courseId),['core','core']);
  assert.deepEqual(f.tables.access_audit_logs.find(row=>row.id===100).details.scopes.map(s=>s.sectionId),['core1','core2']);
  assert.ok(f.tables.presence_sessions.every(row=>!row.client_id.startsWith('v2:web')));assert.equal(f.tables.ideas.length,1);
});

test('course reset includes four sections and leaves neighboring courses intact',async()=>{
  const f=scopedFixture();assert.equal((await f.scoped({folderId:'web',courseId:'web1',sectionId:'all'})).status,200);
  assert.ok(!f.tables.access_audit_logs.some(row=>row.action==='SECTION_OPENED'&&row.details.courseId==='web1'));
  assert.ok(f.tables.access_audit_logs.some(row=>row.details.sectionId==='web2s1'));assert.ok(f.tables.access_audit_logs.some(row=>row.details.sectionId==='web3s1'));
});

test('Applied AI section reset keeps generic v2 presence even when its compatibility enum is section1',async()=>{
  const f=scopedFixture();assert.equal((await f.scoped({folderId:'ai',courseId:'core',sectionId:'core1'})).status,200);
  assert.equal(f.tables.ideas.length,0);assert.ok(!f.tables.presence_sessions.some(row=>row.client_id==='legacy'||row.client_id.startsWith('v2:core1:')));assert.ok(f.tables.presence_sessions.some(row=>row.client_id.startsWith('v2:web1s1:')));
  assert.ok(f.tables.access_audit_logs.some(row=>row.details.sectionId==='web1s1'));assert.ok(f.tables.section_state[0].termination_token);assert.equal(f.tables.section_state[1].termination_token,undefined);
});

test('invalid hierarchy, missing selectors, wrong passcode and non-admin reset cannot write',async()=>{
  for(const scope of [{folderId:'ai',courseId:'web1',sectionId:'all'},{folderId:'web',courseId:'web1',sectionId:'web2s1'},{folderId:'missing',courseId:'all',sectionId:'all'},{folderId:'web'},{folderId:'web',courseId:'web1',sectionId:'gone'}]){
    const f=scopedFixture();assert.equal((await f.scoped(scope)).status,400);assert.equal(f.writes.length,0);
  }
  const f=scopedFixture();assert.equal((await f.scoped({folderId:'web',courseId:'web1',sectionId:'all'},'wrong')).status,401);assert.equal(f.writes.length,0);
  const teacher=scopedFixture('section1');assert.equal((await teacher.scoped({folderId:'web',courseId:'web1',sectionId:'all'})).status,403);assert.equal(teacher.writes.length,0);
});

test('scoped reset snapshots multiple pages and does not report success on a failed deletion',async()=>{
  const f=scopedFixture();for(let i=1000;i<2105;i++)f.tables.access_audit_logs.push({id:i,action:'SECTION_OPENED',details:{courseId:'web1',sectionId:'web1s1',section:'section1'}});
  assert.equal((await f.scoped({folderId:'web',courseId:'web1',sectionId:'web1s1'})).status,200);assert.ok(!f.tables.access_audit_logs.some(row=>row.details.sectionId==='web1s1'));
  const bad=scopedFixture('admin',true);assert.equal((await bad.scoped({folderId:'web',courseId:'web1',sectionId:'all'})).status,500);
});


test('explicit all-folder all-course all-section reset clears legacy and scoped data',async()=>{
  const f=scopedFixture();const response=await f.scoped({folderId:'all',courseId:'all',sectionId:'all'});assert.equal(response.status,200);
  assert.equal(f.tables.presence_sessions.length,0);assert.equal(f.tables.learner_profiles.length,0);assert.ok(!f.tables.access_audit_logs.some(row=>['PASSCODE_LOGIN','SECTION_OPENED','QUIZ_COMPLETED','FEEDBACK_SUBMITTED'].includes(row.action)));assert.deepEqual(Array.from(response.data.legacySections),['section1','section2']);
});
