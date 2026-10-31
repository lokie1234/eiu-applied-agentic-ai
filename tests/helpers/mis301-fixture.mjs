import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function loadTS(file, deps = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName:file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name in deps ? deps[name] : name === 'server-only' ? {} : require(name), console, Date, Math, crypto:globalThis.crypto, Buffer, URL, Request, Response, AbortController, AbortSignal, setTimeout, clearTimeout, structuredClone, ...globals }, { filename:file });
  return exports;
}
export const practice = loadTS('lib/mis301Practice.ts');
export const sectionId = practice.MIS301_SECTION_ID;
export const courseId = practice.MIS301_COURSE_ID;
export const tick = () => new Promise(resolve => setImmediate(resolve));
export function deferred() { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return {promise,resolve,reject}; }
export function classroomFixture(role = 'admin', subject = 'admin') {
  const tables = { classroom:[], practiceAnswers:[], limits:[] };
  let id = 0;
  const db = {
    query(table) {
      const filters=[];
      const q = { withIndex(_, select) { select?.({eq(key,value){filters.push([key,value]);return this;}});return q; },
        async unique(){ return tables[table].find(row => filters.every(([key,value]) => row[key]===value)) || null; },
        async take(count){ return tables[table].filter(row => filters.every(([key,value]) => row[key]===value)).slice(0,count); },
        async collect(){return q.take(Infinity);} };
      return q;
    },
    async insert(table, value){ const row={_id:`${table}:${++id}`,...structuredClone(value)}; tables[table].push(row); return row._id; },
    async patch(rowId, patch){ const row=Object.values(tables).flat().find(row=>row._id===rowId); if(!row)throw Error('Missing row');for(const [key,value] of Object.entries(patch))if(value===undefined)delete row[key];else row[key]=structuredClone(value); },
    async delete(rowId){for(const rows of Object.values(tables)){const index=rows.findIndex(row=>row._id===rowId);if(index>=0)rows.splice(index,1);}}
  };
  let identity={subject,role,sections:JSON.stringify([sectionId]),teaching:JSON.stringify(role==='admin'?[sectionId]:[])};
  const ctx={db,auth:{getUserIdentity:async()=>identity}};
  const validators=new Proxy({}, {get:()=>()=>({})});
  const classroomModule=loadTS('convex/classroom.ts',{
    'convex/server':{queryGeneric:spec=>spec.handler,mutationGeneric:spec=>spec.handler,internalMutationGeneric:spec=>spec.handler},
    'convex/values':{v:validators,ConvexError:Error},'./schema':{default:{}},'../lib/mis301Practice':practice,
    '../lib/classroomDemo':loadTS('lib/classroomDemo.ts')
  });
  return {tables,db,ctx,module:classroomModule,setIdentity:next=>{identity=next;},async room(overrides={}){const rowId=await db.insert('classroom',{sectionId,version:100,epoch:'old',members:[{subject:'learner',username:'An'}],...overrides});return tables.classroom.find(row=>row._id===rowId);}};
}
