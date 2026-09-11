const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{Client}=require('pg');
const root=path.resolve(__dirname,'..');process.loadEnvFile(path.join(root,'.env'));
const name='rla_nexo_review_'+Date.now(),url=new URL(process.env.DATABASE_URL);url.pathname='/'+name;
const admin=new Client({connectionString:process.env.DATABASE_URL});
const runtime=path.join(root,'runtime'),control=path.join(runtime,'review-control');
const token=require('node:crypto').randomBytes(32).toString('hex');
let api,web,timer,closing=false;
function launch(file,args,cwd,env,label){
 const fd=fs.openSync(path.join(runtime,'review-'+label+'.log'),'a');
 const p=spawn(file,args,{cwd,env,windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);
 return p;
}
async function ready(url){for(let n=0;n<120;n++){try{if((await fetch(url,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('Não iniciou: '+url);}
const apiEnv={...process.env,DATABASE_URL:url.toString(),API_TOKEN:token,OPENAI_API_KEY:'',PORT:'4100'};
async function startApi(){api=launch(process.execPath,['dist/main.js'],path.join(root,'apps/api'),apiEnv,'api');await ready('http://127.0.0.1:4100/health');}
async function stop(p){if(!p||p.exitCode!==null)return;await new Promise(resolve=>{p.once('exit',resolve);p.kill();});}
async function cleanup(){
 if(closing)return;closing=true;clearInterval(timer);
 await stop(web);await stop(api);
 await admin.query('DROP DATABASE '+name+' WITH (FORCE)');await admin.end();
 for(const file of [control,path.join(runtime,'review-session.json')])if(fs.existsSync(file))fs.unlinkSync(file);
 console.log('Ambiente de revisão removido. Dados pessoais preservados.');
}
process.on('SIGINT',()=>void cleanup());process.on('SIGTERM',()=>void cleanup());
(async()=>{
 if(fs.existsSync(control))fs.unlinkSync(control);
 await admin.connect();await admin.query('CREATE DATABASE '+name);await startApi();
 web=launch(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3100'],path.join(root,'apps/web'),{...process.env,API_URL:'http://127.0.0.1:4100',API_TOKEN:token,PORT:'3100'},'web');
 await ready('http://127.0.0.1:3100/api/dashboard');
 fs.writeFileSync(path.join(runtime,'review-session.json'),JSON.stringify({name,token,apiPort:4100,webPort:3100}));
 console.log('REVIEW READY: http://127.0.0.1:3100 — banco temporário separado.');
 let processing=false;
 timer=setInterval(async()=>{
  if(processing||!fs.existsSync(control))return;processing=true;
  const command=fs.readFileSync(control,'utf8').trim();fs.unlinkSync(control);
  try{
   if(command==='restart-api'){await stop(api);await startApi();console.log('API de revisão reiniciada.');}
   else if(command==='stop')await cleanup();
  }catch(e){console.error(e.message);}finally{processing=false;}
 },300);
})().catch(async e=>{console.error(e.message);await cleanup();process.exitCode=1;});

