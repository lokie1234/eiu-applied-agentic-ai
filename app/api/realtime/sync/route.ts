import { bridgeAuthorized, readRealtimeSignals } from "@/lib/realtime/server";
import { classroomSnapshot } from "@/lib/realtime/classroom";
import { getCoursesAndSectionsData } from '@/lib/auth/courseAccessStorage';
import { sectionWheelEnabled, ASSIGNMENT_WHEEL_SECTION_ID, wheelLegacySection } from '@/lib/sectionWheel';
export async function GET(request: Request) {
  if (!bridgeAuthorized(request)) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const requested=JSON.parse(new URL(request.url).searchParams.get('sections')||'[]');
    if(!Array.isArray(requested)||requested.length>500||requested.some(id=>typeof id!=='string'))return Response.json({message:'Invalid scopes'},{status:400});
    const catalog=await getCoursesAndSectionsData(request.signal),active=new Set(requested);
    const scopes=catalog.sections.filter(section=>section.status==='active'&&active.has(section.id)&&section.id!==ASSIGNMENT_WHEEL_SECTION_ID&&sectionWheelEnabled(section.id,catalog.courses.find(course=>course.id===section.course_id)?.metadata.sectionWheel));
    const [rows,classroom]=await Promise.all([readRealtimeSignals(request.signal),classroomSnapshot(request.signal)]);
    const classrooms=[];
    // Repair only active rooms, in bounded batches; enabled idle sections do no work.
    for(let i=0;i<scopes.length;i+=4)classrooms.push(...await Promise.all(scopes.slice(i,i+4).map(section=>classroomSnapshot(request.signal,{sectionId:section.id,courseId:section.course_id,wheelEnabled:true,legacySection:wheelLegacySection(catalog.courses.find(course=>course.id===section.course_id)?.slug,section.section_key)}))));
    return Response.json({ rows, classroom, classrooms }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ message: "Sync unavailable" }, { status: 503 }); }
}
