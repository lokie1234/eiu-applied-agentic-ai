import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { currentUserAccess } from '@/lib/auth/currentUser';
import { readSectionTermination } from '@/lib/sectionTermination';
import { mintRealtimeToken, realtimeConfigured } from '@/lib/realtime/server';
import { classroomSnapshot, publishClassroom } from '@/lib/realtime/classroom';
import { MIS311_SPOTLIGHT_SECTION_ID, spotlightSlide, type SpotlightView } from '@/lib/mis311Spotlight';
import { ASSIGNMENT_WHEEL_SECTION_ID, sectionWheelEnabled, validWheelCount, wheelLegacySection } from '@/lib/sectionWheel';
type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'private, no-store' };
async function resolve(request: Request, context: Context) {
  const [{ id }, access] = await Promise.all([context.params, currentUserAccess(request.signal)]);
  const section = access?.sections.find(row => row.id === id);
  const course = access?.courses.find(row => row.id === section?.courseId);
  if (!access?.isActive || !section || !course || !(section.wheelEnabled ?? sectionWheelEnabled(section.id)) || (!access.isAdmin && (section.hidden || course.hidden))) return null;
  const legacySection=wheelLegacySection(course.slug,section.sectionKey);
  const termination = await readSectionTermination(course.id, section.id, request.signal,legacySection);
  const teaching = access.isAdmin || section.canFacilitate === true;
  if (!teaching && !access.learnerIdentity?.information.name) return null;
  return { access, teaching, sectionId:section.id, projection:{sectionId:section.id,courseId:course.id,wheelEnabled:true,legacySection}, epoch: termination?.details.token || 'initial' };
}
function connection(access: NonNullable<Awaited<ReturnType<typeof resolve>>>['access'], signal: AbortSignal) {
  if (!realtimeConfigured() || !process.env.NEXT_PUBLIC_CONVEX_URL) throw Error('The classroom is reconnecting.');
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL, { logger: false,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }) });
  client.setAuth(mintRealtimeToken(access));return client;
}
// Both mutations use the same bounded recovery path and the same request ID.
async function withClassroomRetry<T extends { code?: string }>(mutate: () => Promise<T>, scope: NonNullable<Awaited<ReturnType<typeof resolve>>>, signal: AbortSignal) {
  const result = await mutate();
  if (result.code !== 'STALE_CLASSROOM') return result;
  await publishClassroom(signal, scope.projection);
  return mutate();
}
export async function GET(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope) return Response.json({ message: 'Sign in to Learning with your name, or use Teaching Access.' }, { status: 403, headers });
    if(new URL(request.url).searchParams.get('settings')==='1'){
      if(!scope.teaching)return Response.json({message:'Teaching access required.'},{status:403,headers});
      const settings=await connection(scope.access,request.signal).query(makeFunctionReference<'query',{sectionId:string},{count:number;targetSubjects?:string[]}>('spotlight:settings'),{sectionId:scope.sectionId});
      const roster=await classroomSnapshot(request.signal,scope.projection);
      return Response.json({epoch:scope.epoch,count:settings.count,targetSubjects:settings.targetSubjects||[],members:roster.members.map(member=>({id:member.subject,username:member.username}))},{headers});
    }
    if (new URL(request.url).searchParams.get('context') === '1') return Response.json({ epoch: scope.epoch, viewerSubject: scope.access.authUserId, teaching: scope.teaching }, { headers });
    let snapshot: SpotlightView;
    try {
      // Prepare the scoped projection on section entry, before opening the wheel.
      if (scope.teaching && new URL(request.url).searchParams.get('prepare') === '1') await publishClassroom(request.signal, scope.projection);
      snapshot = await connection(scope.access, request.signal).query(makeFunctionReference<'query', { sectionId: string }, SpotlightView>('spotlight:view'), { sectionId: scope.sectionId });
    }
    catch {
      // Existing Supabase identities remain readable during a realtime outage.
      // Selection never falls back to a second random authority.
      const roster = scope.teaching ? await classroomSnapshot(request.signal, scope.projection) : null;
      snapshot = { ready: false, count:scope.sectionId===ASSIGNMENT_WHEEL_SECTION_ID?7:1, teaching: scope.teaching, viewerSubject: scope.access.authUserId, epoch: scope.epoch, draws: [],
        members: roster?.members.map(row => ({ id: row.subject, username: row.username })) || [] };
    }
    return Response.json({ epoch: scope.epoch, snapshot }, { headers });
  } catch { return Response.json({ message: 'Unable to verify this classroom.' }, { status: 503, headers }); }
}
export async function POST(request: Request, context: Context) {
  try {
    const scope = await resolve(request, context);
    if (!scope?.teaching) return Response.json({ message: 'Teaching access required.' }, { status: 403, headers });
    const raw = await request.text();
    if (raw.length > 1000) return Response.json({ message: 'Invalid draw settings.' }, { status: 400, headers });
    let body;
    try { body = JSON.parse(raw); } catch { return Response.json({ message: 'Invalid draw settings.' }, { status: 400, headers }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ message: 'Invalid draw settings.' }, { status: 400, headers });
    if (scope.sectionId===ASSIGNMENT_WHEEL_SECTION_ID || !(body.slide===0 || scope.sectionId===MIS311_SPOTLIGHT_SECTION_ID&&spotlightSlide(body.slide)) || typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) return Response.json({ message: 'Invalid draw settings.' }, { status: 400, headers });
    if (body.epoch !== scope.epoch) return Response.json({ message: 'The section session changed. Reopen the slide.' }, { status: 409, headers });
    const client = connection(scope.access, request.signal);
    const args = { sectionId: scope.sectionId, slide: body.slide, requestId: body.requestId, epoch: scope.epoch };
    const mutate = () => client.mutation(makeFunctionReference<'mutation'>('spotlight:draw'), args);
    const draw = await withClassroomRetry(mutate, scope, request.signal);
    if (draw.retryAfter) return Response.json({ message: `Please wait ${draw.retryAfter} seconds.`, retryAfter: draw.retryAfter }, { status: 429, headers });
    if (draw.message) return Response.json({ code: draw.code, message: draw.message }, { status: 409, headers });
    const { members = [], ...selected } = draw;
    return Response.json({ draw: selected, members }, { headers });
  } catch { return Response.json({ message: 'Unable to draw. Wait for any current spin, then check that learners have opened this section.' }, { status: 503, headers }); }
}
export async function PUT(request:Request, context:Context){
  try{
    const scope=await resolve(request,context);
    if(!scope?.teaching)return Response.json({message:'Teaching access required.'},{status:403,headers});
    const raw=await request.text();if(raw.length>100000)return Response.json({message:'Invalid settings.'},{status:400,headers});
    let body;try{body=JSON.parse(raw);}catch{return Response.json({message:'Invalid settings.'},{status:400,headers});}
    if(!body||!validWheelCount(body.count))return Response.json({message:'Choose a positive whole number of learners.'},{status:400,headers});
    if(body.targetSubjects!==undefined&&(!Array.isArray(body.targetSubjects)||body.targetSubjects.length>1200||new Set(body.targetSubjects).size!==body.targetSubjects.length||body.targetSubjects.some((id:unknown)=>typeof id!=='string'||!id||id.length>200)))return Response.json({message:'Choose existing learner names.'},{status:400,headers});
    if(body.epoch!==scope.epoch)return Response.json({message:'The section session changed. Reopen settings.'},{status:409,headers});
    const client=connection(scope.access,request.signal),args={sectionId:scope.sectionId,epoch:scope.epoch,count:body.count,...(body.targetSubjects!==undefined?{targetSubjects:body.targetSubjects}:{})};
    const configure=()=>client.mutation(makeFunctionReference<'mutation'>('spotlight:configure'),args);
    const result=await withClassroomRetry(configure,scope,request.signal);
    if(result.retryAfter)return Response.json({message:'Please wait before saving again.'},{status:429,headers});
    if(result.message)return Response.json({message:result.message},{status:409,headers});
    return Response.json({count:result.count},{headers});
  }catch{return Response.json({message:'Unable to save wheel settings.'},{status:503,headers});}
}
