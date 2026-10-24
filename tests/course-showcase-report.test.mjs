import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import ExcelJS from "exceljs";
import { Window } from "happy-dom";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? ((name.startsWith("@/lib/report") || name === "@/lib/courseHierarchy") ? load(name.replace("@/", "") + ".ts") : require(name)), URL, Response, console, Buffer });
  return exports;
}
const courses = [{ id: "c-ai", slug: "applied-agentic-ai", title: "Applied Agentic AI" }, { id: "c-web", slug: "web-development", title: "AI-Powered Web Development" }];
const sections = [{ id: "s-ai", course_id: "c-ai", section_key: "section1", title: "Section 1 · AI" }, { id: "s-web", course_id: "c-web", section_key: "section1", title: "Section 1 · Web" }];
const identity = { sessionId: "session-one", name: "Alice", email: "alice@example.test", information: { department: "IT" }, fields: [{ id: "department", label: "Department" }] };
function database(tables) {
  return { from(table) { const filters = []; let inserted;
    const q = { select() { return q; }, eq(k,v) { filters.push(row=>row[k]===v); return q; }, contains(k,v) { filters.push(row=>Object.entries(v).every(([key,value])=>row[k]?.[key]===value)); return q; },
      gte(k,v) { filters.push(row=>row[k]>=v); return q; }, lte(k,v) { filters.push(row=>row[k]<=v); return q; }, order() { return q; }, limit() { return q; },
      gt(k,v) { filters.push(row=>row[k]>v); return q; },
      insert(row) { inserted={...row,id:77,created_at:"2026-10-21T06:00:00Z"};(tables[table] ||= []).push(inserted);return q; },
      single:async()=>({data:inserted}),range:async()=>({data:(tables[table]||[]).filter(row=>filters.every(f=>f(row)))}),
      maybeSingle:async()=>({data:(tables[table]||[]).filter(row=>filters.every(f=>f(row))).at(-1)||null}),
      then(resolve,reject) { return Promise.resolve({data:(tables[table]||[]).filter(row=>filters.every(f=>f(row)))}).then(resolve,reject); },
    };return q;
  } };
}
function endpoint(tables, access) {
  return load("app/api/sections/[id]/showcase/route.ts", { "next/server": { NextResponse: { json: (data, options={}) => ({ data, status: options.status || 200 }) } },
    "@/lib/sectionTermination": load("lib/sectionTermination.ts", { "server-only": {}, "@/lib/supabase/server": { getSupabaseAdmin:()=>database(tables) } }),
    "@/lib/auth/currentUser": { currentUserAccess: async()=>access }, "@/lib/supabase/server": { getSupabaseAdmin:()=>database(tables) } });
}
const context = id => ({ params: Promise.resolve({ id }) });
const request = body => new Request("http://localhost/api/sections/s-web/showcase",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
function access() { return { isActive:true,isAdmin:false,authUserId:identity.sessionId,displayName:identity.name,email:identity.email,learnerIdentity:identity,courses:courses.slice(1),sections:[{id:"s-web",courseId:"c-web",sectionKey:"section1",title:"Section 1 · Web"}] }; }

test("new showcase binds identity, course and section on the server, accepts HTTPS demo links and stays isolated", async()=>{
  const tables={access_audit_logs:[{id:1,action:"SHOWCASE_SUBMITTED",details:{courseId:"c-ai",sectionId:"s-ai",submissionStorage:"audit",name:"Other",url:"https://other.test"}}]};
  const api=endpoint(tables,access());
  const result=await api.POST(request({url:"https://demo-3000.example.devtunnels.ms",name:"Fake",courseId:"c-ai",sectionId:"s-ai",section:"section2"}),context("s-web"));
  assert.equal(result.status,200);assert.equal(result.data.item.name,"Alice");
  const saved=tables.access_audit_logs.at(-1);assert.equal(saved.course_id,"c-web");assert.equal(saved.details.courseId,"c-web");assert.equal(saved.details.sectionId,"s-web");assert.equal(saved.details.email,identity.email);assert.equal(saved.details.information.department,"IT");
  const list=await api.GET(new Request("http://localhost/api/sections/s-web/showcase"),context("s-web"));
  assert.equal(list.data.items.length,1);assert.equal(list.data.items[0].name,"Alice");assert.equal(list.data.items[0].email,undefined);assert.equal(list.data.items[0].information,undefined);
  assert.equal((await api.POST(request({url:"https://valid.test"}),context("s-ai"))).status,403);
  assert.equal((await api.GET(new Request("http://localhost"),context("s-ai"))).status,403);
  for(const url of ["http://localhost:3000","javascript:alert(1)","https://alice:secret@example.test", "invalid"])
    assert.equal((await api.POST(request({url}),context("s-web"))).status,400);
  const teacher=access();teacher.sections[0].canFacilitate=true;
  assert.equal((await endpoint(tables,teacher).POST(request({url:"https://demo.test"}),context("s-web"))).status,403);
  assert.equal((await endpoint(tables,null).GET(new Request("http://localhost"),context("s-web"))).status,403);
});

test("termination clears only the live board and retains submissions for reports",async()=>{
  const scope={courseId:"c-web",sectionId:"s-web",section:"section1",submissionStorage:"audit"};
  const tables={access_audit_logs:[
    {id:1,action:"SHOWCASE_SUBMITTED",created_at:"2026-10-21T01:00:00Z",details:{...identity,...scope,url:"https://old.test"}},
    {id:2,action:"SECTION_TERMINATED",created_at:"2026-10-21T02:00:00Z",details:{courseId:"c-web",sectionId:"s-web",token:"next"}},
  ]};
  const api=endpoint(tables,access());
  assert.equal((await api.GET(new Request("http://localhost"),context("s-web"))).data.items.length,0);
  await api.POST(request({url:"https://new.test"}),context("s-web"));
  const items=(await api.GET(new Request("http://localhost"),context("s-web"))).data.items;
  assert.equal(items.length,1);assert.equal(items[0].url,"https://new.test");
  assert.equal(tables.access_audit_logs.filter(row=>row.action==="SHOWCASE_SUBMITTED").length,2);
});

test("report keeps identical section keys and learner sessions separate across courses, including legacy work",async()=>{
  const scopes=sections.map(s=>({courseId:s.course_id,sectionId:s.id,section:s.section_key,sectionTitle:s.title,courseTitle:courses.find(c=>c.id===s.course_id).title}));
  const tables={courses,course_sections:sections,section_state:[{section:"section1"}],showcase_items:[{id:"old",section:"section1",name:"Legacy",email:"old@example.test",url:"https://script.google.com/macros/s/old/exec",shared_at:"2026-10-21T03:00:00Z"}],access_audit_logs:[
    {id:2,action:"PASSCODE_LOGIN",created_at:"2026-10-21T01:00:00Z",details:{...identity,sectionKeys:["section1"],scopes}},
    {id:3,action:"SHOWCASE_SUBMITTED",created_at:"2026-10-21T04:00:00Z",details:{...identity,...scopes[1],submissionStorage:"audit",url:"https://web-demo.test"}},
    {id:4,action:"QUIZ_COMPLETED",created_at:"2026-10-21T04:30:00Z",details:{...identity,...scopes[1],submissionStorage:"audit",score:9,total:10,answers:[]}},
    {id:5,action:"FEEDBACK_SUBMITTED",created_at:"2026-10-21T04:40:00Z",details:{...identity,...scopes[1],submissionStorage:"audit",feedback:"Useful Web lesson"}},
  ]};
  const report=load("app/api/admin/report/route.ts",{exceljs:{default:ExcelJS},"@/lib/currentRole":{currentRole:async()=>"admin"},"@/lib/supabase/server":{getSupabaseAdmin:()=>database(tables)}});
  const all=await report.GET(new Request("http://localhost/api/admin/report"));assert.equal(all.status,200);
  const book=new ExcelJS.Workbook();await book.xlsx.load(Buffer.from(await all.arrayBuffer()));
  const learnerSheets=book.worksheets.filter(s=>s.name.endsWith("Hoc vien"));assert.equal(learnerSheets.length,2);
  assert.equal(learnerSheets.filter(s=>s.getCell("A2").value==="Alice").length,2);
  const web=await report.GET(new Request("http://localhost/api/admin/report?courseId=c-web&sectionId=s-web"));assert.equal(web.status,200);
  const webBook=new ExcelJS.Workbook();await webBook.xlsx.load(Buffer.from(await web.arrayBuffer()));
  const work=webBook.getWorksheet("S1 - Bai lam");assert.equal(work.rowCount,2);assert.equal(work.getCell("B2").value,"https://web-demo.test");assert.equal(work.getCell("D2").value,"AI-Powered Web Development");assert.equal(work.getCell("E2").value,"Section 1 · Web");
  const learners=webBook.getWorksheet("S1 - Hoc vien");assert.equal(learners.rowCount,2);assert.equal(learners.getCell("B2").value,identity.email);
  const quiz=webBook.getWorksheet("S1 - Quiz");assert.equal(quiz.rowCount,2);assert.equal(quiz.getCell("A2").value,"Alice");
  assert.ok(quiz.getRow(2).values.includes(9));
  const feedback=webBook.getWorksheet("S1 - Feedback");assert.equal(feedback.rowCount,2);assert.ok(feedback.getRow(2).values.includes("Useful Web lesson"));
  const ai=await report.GET(new Request("http://localhost/api/admin/report?courseId=c-ai"));const aiBook=new ExcelJS.Workbook();await aiBook.xlsx.load(Buffer.from(await ai.arrayBuffer()));assert.equal(aiBook.getWorksheet("S1 - Bai lam").getCell("A2").value,"Legacy");
  assert.equal((await report.GET(new Request("http://localhost/api/admin/report?courseId=c-ai&sectionId=s-web"))).status,400);
  const options=await (await report.GET(new Request("http://localhost/api/admin/report?mode=sections"))).json();assert.equal(options.courses.length,2);assert.equal(options.courseSections.length,2);
});

test("compiled slide 30 requests the native submission board only for its own page and retains the content binding",async()=>{
  const docs=load("lib/tsxDocument.ts");const source=fs.readFileSync("course-content/web-app-development/Section1.js","utf8");
  for(const page of [29,30,31]){const w=new Window();w.document.body.innerHTML='<div id="root"></div>';const messages=[];const html=docs.createTsxDocument(source,page,"","",`s-web:${page}`);vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window:w,document:w.document,Node:w.Node,parent:{postMessage:m=>messages.push(m)},setTimeout:w.setTimeout.bind(w),clearTimeout:w.clearTimeout.bind(w)});assert.equal(w.document.querySelector('#error'),null);const interaction=messages.find(m=>m.type==='eiu-slide-interaction');assert.equal(interaction.interaction,page===30?'showcase':page===31?'quiz':null);assert.equal(interaction.requestId,`s-web:${page}`);assert.equal(messages[0].slides,31);await w.happyDOM.close();}
  const binding=JSON.parse(fs.readFileSync('course-content/sources.json')).find(s=>s.sectionId==='47c1183e-a26e-4c5d-9937-88ec5a755a32');assert.equal(binding.courseId,'a857595d-def0-4543-9216-a680c6abfe26');
});

test("retired final slides and their private renderer and logo assets are removed from the course",()=>{
  const base='course-content/web-app-development/';
  const slides=JSON.parse(fs.readFileSync(base+'storyboard.json')).slides.filter(s=>s.section===1);
  assert.equal(slides.length,32);assert.equal(slides.filter(s=>!s.adminOnly).length,31);assert.equal(slides.at(-2).visual,'git-intro-submission');assert.equal(slides.at(-1).visual,'git-intro-section-quiz');
  assert.equal(fs.existsSync(base+'repo-icons'),false);
  const retired=/git-intro-(?:ai-workflow|skill-defaults|repo-showcase)|effective-vibe-coding|Repo (?:Penpot|Excalidraw|shadcn-ui|n8n)|function (?:skillDefaults|skillInstall|aiWorkflow|repoShowcase)/i;
  for(const file of ['storyboard.json','renderer.tsx.txt','Section1.js','Section2.js','assets.json'])assert.doesNotMatch(fs.readFileSync(base+file,'utf8'),retired,file);
});
