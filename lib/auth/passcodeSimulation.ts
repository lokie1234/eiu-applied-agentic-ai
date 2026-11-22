import 'server-only';
import {catalogCredentials,hashPasscode,resolvePasscode} from './passcodes';
import type {getCoursesAndSectionsData} from './courseAccessStorage';
import type {SimulationCredential,PasscodeSimulation} from '../passcodeSimulationTypes';
type Catalog=Awaited<ReturnType<typeof getCoursesAndSectionsData>>;
export function simulationCredentials(catalog:Catalog):SimulationCredential[]{
  return catalogCredentials(catalog).map(entry=>{
    const section=catalog.sections.find(section=>section.id===entry.id),course=catalog.courses.find(course=>course.id===(entry.kind==='section'?section?.course_id:entry.id));
    const label=entry.kind==='global'?'All courses':entry.kind==='folder'?catalog.folderGroups.find(folder=>folder.id===entry.id)?.name||entry.id:entry.kind==='course'?course?.title||entry.id:`${course?.title||''} / ${section?.title||entry.id}`;
    const allowed=/^[A-Za-z0-9-]{4,32}$/.test(entry.code)?resolvePasscode(catalog,hashPasscode(entry.code)):null;
    return {id:`${entry.kind}:${entry.id}:${entry.mode}`,code:entry.code,kind:entry.kind,label,mode:entry.mode,available:Boolean(allowed),courseCount:allowed?.courses.length||0,sectionCount:allowed?.sections.length||0};
  });
}
export function simulateCredential(catalog:Catalog,id:string):PasscodeSimulation|null{
  const entry=simulationCredentials(catalog).find(entry=>entry.id===id);if(!entry?.available)return null;
  const allowed=resolvePasscode(catalog,hashPasscode(entry.code));if(!allowed)return null;
  return {credentialId:id,label:`${entry.kind==='global'?'Global':entry.kind[0].toUpperCase()+entry.kind.slice(1)} · ${entry.label}`,mode:entry.mode,sections:allowed.sections.map(section=>({id:section.id,canFacilitate:section.canFacilitate}))};
}
