import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase/server';

type ResetScope={courseId:string;sectionId:string;epoch:string;actorSubject:string;requestId:string;clearNames:boolean};
export async function resetSectionWheel(scope:ResetScope){
  const site=process.env.CONVEX_SITE_URL,secret=process.env.REALTIME_BRIDGE_SECRET;
  if(!site||!secret)throw Error('Classroom reset is unavailable.');
  const db=getSupabaseAdmin();
  const identity={courseId:scope.courseId,sectionId:scope.sectionId,actorSubject:scope.actorSubject,requestId:scope.requestId};
  const previous=await db.from('access_audit_logs').select('id,details').eq('action','WHEEL_RESET').contains('details',identity).order('id',{ascending:true}).limit(1).maybeSingle();
  if(previous.error)throw previous.error;
  const details=previous.data?.details||{...identity,epoch:scope.epoch,clearNames:scope.clearNames,status:'requested',requestedAt:Date.now()};
  if(details.epoch!==scope.epoch)throw Error('The section session changed. Reopen the wheel.');
  if(details.clearNames!==scope.clearNames)throw Error('The reset options changed. Reopen the confirmation.');
  if(details.status==='completed')return {success:true,count:details.count,resetAt:details.resetAt};
  let id=previous.data?.id;
  if(!id){
    const saved=await db.from('access_audit_logs').insert({action:'WHEEL_RESET',course_id:scope.courseId,details}).select('id').single();
    if(saved.error)throw saved.error;id=saved.data.id;
  }
  const response=await fetch(site.replace(/\/$/,'')+'/classroom/wheel-reset',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify({sectionId:scope.sectionId,epoch:scope.epoch,requestId:scope.requestId,sequence:String(id),requestedAt:details.requestedAt,clearNames:scope.clearNames}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Unable to reset the classroom. Please retry.');
  const result=await response.json();
  if(result.success!==true||!Number.isFinite(result.resetAt)||!Number.isSafeInteger(result.count)||result.count<1)throw Error(result.message||'The classroom did not confirm this reset.');
  const completed=await db.from('access_audit_logs').update({details:{...details,status:'completed',resetAt:result.resetAt,count:result.count}}).eq('id',id).eq('action','WHEEL_RESET');
  if(completed.error)throw completed.error;
  return result as {success:true;resetAt:number;count:number};
}
