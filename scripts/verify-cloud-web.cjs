const {spawn}=require('child_process'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3103'],{cwd:path.join(root,'apps/web'),env:{...process.env,NEXO_CLOUD:'true',SUPABASE_URL:'http://127.0.0.1:3104',SUPABASE_ANON_KEY:'sb_publishable_test',GROQ_API_KEY:'',OPENAI_API_KEY:''},windowsHide:true,stdio:'ignore'});
const server=require('http').createServer((req,res)=>{res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'invalid token'}));});
server.listen(3104,'127.0.0.1');
(async()=>{try{
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3103/api/config')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'cloud preview ready');
 const url='http://127.0.0.1:3103';const cfg=await (await fetch(url+'/api/config')).json();assert.equal(cfg.cloud,true);assert.equal(cfg.key,'sb_publishable_test');assert.equal(Object.keys(cfg).length,3);
 for(const route of ['dashboard','personal/backup','conversation/history'])assert.equal((await fetch(url+'/api/'+route)).status,401);
 assert.equal((await fetch(url+'/api/dashboard',{headers:{Authorization:'Bearer forged'}})).status,401);
 assert.equal((await fetch(url+'/api/personal/save',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 const manifest=await (await fetch(url+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');
 assert.equal((await fetch(url)).status,200);
 console.log('PASS: production cloud build, anonymous/forged-token denial, config without secrets, mobile manifest.');
 if(process.argv.includes('--preview')){console.log('Preview: http://127.0.0.1:3103 — fictional configuration, login cannot complete.');await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});}
 }finally{child.kill();server.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
