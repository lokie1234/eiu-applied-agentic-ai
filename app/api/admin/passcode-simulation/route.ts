import {requireAdminAccess} from '@/lib/auth/currentUser';
import {getCoursesAndSectionsData} from '@/lib/auth/courseAccessStorage';
import {simulationCredentials,simulateCredential} from '@/lib/auth/passcodeSimulation';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
  try{
    if(!await requireAdminAccess(request.signal))return Response.json({message:'Administrator access required.'},{status:403,headers});
    const catalog=await getCoursesAndSectionsData(request.signal);
    return Response.json({success:true,credentials:simulationCredentials(catalog)},{headers});
  }catch{return Response.json({message:'Unable to load passcodes. Please retry.'},{status:500,headers});}
}
export async function POST(request:Request){
  try{
    const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({message:'Invalid request origin.'},{status:403,headers});
    if(!await requireAdminAccess(request.signal))return Response.json({message:'Administrator access required.'},{status:403,headers});
    const reader=request.body?.getReader();if(!reader)return Response.json({message:'Choose a passcode.'},{status:400,headers});
    const parts:Uint8Array[]=[];let size=0;try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>512){await reader.cancel();return Response.json({message:'Invalid selection.'},{status:400,headers});}parts.push(next.value);}}finally{reader.releaseLock();}
    let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return Response.json({message:'Invalid selection.'},{status:400,headers});}
    if(typeof body?.credentialId!=='string'||body.credentialId.length>250)return Response.json({message:'Choose a passcode.'},{status:400,headers});
    const preview=simulateCredential(await getCoursesAndSectionsData(request.signal),body.credentialId);
    if(!preview)return Response.json({message:'This passcode is inactive, ambiguous, or no longer opens any content. Refresh the list.'},{status:409,headers});
    return Response.json({success:true,preview},{headers});
  }catch{return Response.json({message:'Unable to simulate this passcode. Please retry.'},{status:500,headers});}
}
