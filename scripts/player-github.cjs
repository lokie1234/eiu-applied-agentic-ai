const cp=require('node:child_process');
module.exports=function githubAccess(){
 let token=process.env.GITHUB_TOKEN;
 if(!token){
  const result=cp.spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
  if(result.status!==0)throw Error('GitHub release access is required.');
  token=result.stdout.match(/^password=(.+)$/m)?.[1].trim();
 }
 if(!token)throw Error('GitHub release access is required.');
 return {base:'https://api.github.com/repos/'+(process.env.GITHUB_REPOSITORY||'lokie1234/eiu-applied-agentic-ai'),headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'}};
};
