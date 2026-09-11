const {spawn,spawnSync}=require('node:child_process');
const {existsSync,mkdirSync,openSync,readFileSync,copyFileSync}=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const logDir=path.join(root,'runtime');mkdirSync(logDir,{recursive:true});
if(existsSync(path.join(logDir,'database.json'))){
 const setup=spawnSync(process.execPath,['scripts/setup-database.cjs'],{cwd:root,windowsHide:true,stdio:'inherit'});
 if(setup.status!==0)process.exit(1);
}
if(!existsSync(path.join(root,'.env')))copyFileSync(path.join(root,'.env.example'),path.join(root,'.env'));
const vars={...process.env};
for(const line of readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)vars[m[1]]=m[2].trim();}
async function ready(url){try{return (await fetch(url,{signal:AbortSignal.timeout(2000)})).ok;}catch{return false;}}
async function start(){
 if(vars.AI_PROVIDER==='ollama'){
  const local=spawnSync(process.execPath,['scripts/start-local-ai.cjs'],{cwd:root,env:vars,windowsHide:true,stdio:'inherit'});
  if(local.status!==0)throw new Error('A IA local não iniciou.');
 }

 if(!existsSync(path.join(root,'apps/web/.next/BUILD_ID')))throw new Error('Execute npm install e npm run build para preparar este pacote.');
 const apiPort=vars.PORT||'4000';
 if(!await ready('http://127.0.0.1:'+apiPort+'/health')){
 const fd=openSync(path.join(logDir,'api.log'),'a');
 const child=spawn(process.execPath,['dist/main.js'],{cwd:path.join(root,'apps/api'),env:vars,detached:true,windowsHide:true,stdio:['ignore',fd,fd]});child.unref();
 }
 if(!await ready('http://127.0.0.1:3000')){
 const fd=openSync(path.join(logDir,'web.log'),'a');
 const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3000'],{cwd:path.join(root,'apps/web'),env:{...vars,PORT:'3000',API_URL:'http://127.0.0.1:'+apiPort},detached:true,windowsHide:true,stdio:['ignore',fd,fd]});child.unref();
 }
 for(let i=0;i<40;i++){if(await ready('http://127.0.0.1:3000/api/dashboard')){
 console.log('RLA Nexo pronto: http://127.0.0.1:3000');
 if(process.platform==='win32'&&!process.argv.includes('--no-browser'))spawn('rundll32.exe',['url.dll,FileProtocolHandler','http://127.0.0.1:3000'],{detached:true,windowsHide:true,stdio:'ignore'}).unref();
 return;
 }await new Promise(r=>setTimeout(r,1000));}
 throw new Error('Os serviços não responderam. Consulte os arquivos em runtime.');
}
start().catch(e=>{console.error(e.message);process.exitCode=1;});
