import { revalidatePath } from 'next/cache';
import { currentUserAccess } from '@/lib/auth/currentUser';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getCoursesAndSectionsData, parseCourseMetadata, serializeCourseMetadata, updateFolderGroup } from '@/lib/auth/courseAccessStorage';

export async function PATCH(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  try{
    const origin=request.headers.get('origin');
    if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({message:'Invalid request origin.'},{status:403,headers});
    const access=await currentUserAccess(request.signal);
    if(!access?.isActive||!access.isAdmin)return Response.json({message:'Administrator access required.'},{status:403,headers});
    const reader=request.body?.getReader();if(!reader)return Response.json({message:'Missing changes.'},{status:400,headers});
    const parts:Uint8Array[]=[];let size=0;
    try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>24000){await reader.cancel();return Response.json({message:'Changes are too large.'},{status:413,headers});}parts.push(next.value);}}finally{reader.releaseLock();}
    let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return Response.json({message:'Invalid changes.'},{status:400,headers});}
    if(!body||!['folder','course','section'].includes(body.kind)||typeof body.id!=='string'||!body.id||body.id.length>200||typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>120||typeof body.description!=='string'||body.description.length>4000)return Response.json({message:'Enter a name up to 120 characters and a description up to 4,000 characters.'},{status:400,headers});
    const title=body.title.trim(),description=body.description.trim(),catalog=await getCoursesAndSectionsData(request.signal);
    if(body.kind==='folder'){
      if(!catalog.folderGroups.some(folder=>folder.id===body.id))return Response.json({message:'Folder not found.'},{status:404,headers});
      await updateFolderGroup(body.id,title,description);
    }else{
      const section=body.kind==='section'?catalog.sections.find(section=>section.id===body.id):null;
      const courseId=section?.course_id||(body.kind==='course'?body.id:null);
      if(!courseId||!catalog.courses.some(course=>course.id===courseId))return Response.json({message:'Item not found.'},{status:404,headers});
      const db=getSupabaseAdmin(request.signal),read=await db.from('courses').select('id,description').eq('id',courseId).single();
      if(read.error)throw read.error;
      const metadata=parseCourseMetadata(read.data.description);
      if(body.kind==='section')metadata.sectionDetails={...metadata.sectionDetails,[body.id]:{title,description}};
      else metadata.summary=description;
      let query=db.from('courses').update({...(body.kind==='course'?{title}:{}),description:serializeCourseMetadata(metadata),updated_at:new Date().toISOString()}).eq('id',courseId);
      query=read.data.description===null?query.is('description',null):query.eq('description',read.data.description);
      const write=await query.select('id').maybeSingle();if(write.error)throw write.error;
      if(!write.data)return Response.json({message:'This item changed elsewhere. Refresh and try again.'},{status:409,headers});
    }
    revalidatePath('/learn');revalidatePath('/admin/access');
    return Response.json({success:true,item:{kind:body.kind,id:body.id,title,description}},{headers});
  }catch{return Response.json({message:'Unable to save changes. Please try again.'},{status:500,headers});}
}
