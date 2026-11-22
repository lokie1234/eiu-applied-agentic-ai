// Explicitly scoped binding for the user-requested Week 8 conversion.
// Local registry bytes are authoritative after deployment. Immutable Supabase
// copies let the currently deployed content route serve identical JS meanwhile.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const input=JSON.parse(fs.readFileSync('course-content/advanced-business-analytics/storyboard.json','utf8'));
const registry=JSON.parse(fs.readFileSync('course-content/sources.json','utf8'));
async function main(){
 const selection=process.argv.find(arg=>arg.startsWith('--section='));
 const only=selection?Number(selection.slice(10)):null;
 if(selection&&(!Number.isInteger(only)||only<1||only>input.sections.length))throw Error('Invalid requested section.');
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:course,error}=await db.from('courses').select('id,slug,title,description').eq('id',input.courseId).single();if(error)throw error;
 if(course.slug!=='advanced-business-analytics'||course.title!=='Advanced Business Analytics')throw Error('Course identity changed; no writes performed.');
 const metadata=JSON.parse(course.description||'{}');
 if(metadata.folderGroupName!=='MIS 311'||metadata.templateKey!=='eiu-business-v1')throw Error('Course folder or assigned template changed.');
 const {data:sections,error:e}=await db.from('course_sections').select('*').eq('course_id',course.id).order('position');if(e)throw e;
 for(const [index,target]of input.sections.entries()){
  const current=sections.find(row=>row.id===target.id),occupied=sections.find(row=>row.position===index+1&&row.id!==target.id);
  if(occupied||index===0&&!current)throw Error('Unexpected section identity or position; refusing to create duplicate sections.');
  if(!registry.some(r=>r.courseId===course.id&&r.sectionId===target.id&&r.path===`course-content/advanced-business-analytics/${target.file}`))throw Error('Missing local source binding.');
 }
 if(!process.argv.includes('--apply')){console.log('Verified MIS 311 course, existing Section 1, new/existing Section 2 and EIU Business frame. Use --apply to bind.');return;}
 const backup=path.resolve('.tmp',`advanced-course-before-bind-${Date.now()}.json`);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,JSON.stringify({course,sections},null,2));
 for(const [index,target]of input.sections.entries()){
  if(only&&index+1!==only)continue;
  const bytes=fs.readFileSync(`course-content/advanced-business-analytics/${target.file}`),hash=createHash('sha256').update(bytes).digest('hex');
  const storedPath=`${course.id}/${target.id}/compiled-${hash.slice(0,20)}-${target.file}`;
  const upload=await db.storage.from('course-section-content').upload(storedPath,bytes,{contentType:'text/javascript',upsert:false});
  if(upload.error&&!['409','Duplicate'].includes(String(upload.error.statusCode))&&!/already exists/i.test(upload.error.message))throw upload.error;
  const verify=await db.storage.from('course-section-content').download(storedPath);if(verify.error)throw verify.error;
  const stored=Buffer.from(await verify.data.arrayBuffer());if(!stored.equals(bytes))throw Error('Uploaded lesson bytes do not match source.');
  const current=sections.find(row=>row.id===target.id),values={title:target.title,position:index+1,status:'active',content_type:'tsx',content_path:storedPath,original_content_path:null,source_filename:target.file,slide_count:target.slides.length,updated_at:new Date().toISOString()};
  let write;
  if(current){let query=db.from('course_sections').update(values).eq('id',target.id).eq('course_id',course.id);query=current.content_path?query.eq('content_path',current.content_path):query.is('content_path',null);write=await query.select('id').single();}
  else write=await db.from('course_sections').insert({id:target.id,course_id:course.id,section_key:target.sectionKey,...values}).select('id').single();
  if(write.error)throw write.error;
  console.log(`${target.title}: bound ${target.slides.length} JS slides; stored bytes verified. Original storage objects preserved.`);
 }
 const sectionTemplates={...metadata.sectionTemplates};input.sections.filter((_,index)=>!only||index+1===only).forEach(s=>{sectionTemplates[s.sectionKey]='eiu-business-v1';});
 const update=await db.from('courses').update({description:JSON.stringify({...metadata,sectionTemplates})}).eq('id',course.id).eq('description',course.description).select('id').single();if(update.error)throw update.error;
 console.log(`${only?'Selected section':'Both sections'} explicitly use EIU Business. Private pre-change catalog backup saved in .tmp.`);
}
main().catch(error=>{console.error(error.message||'Binding failed');process.exitCode=1;});
