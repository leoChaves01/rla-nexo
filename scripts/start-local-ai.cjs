const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),runtime=path.join(root,'runtime');
async function ready(){try{return (await fetch('http://127.0.0.1:11435/api/version',{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}}
(async()=>{if(await ready()){console.log('IA local já iniciada.');return;}
const executable=path.join(runtime,'ollama','ollama.exe');if(!fs.existsSync(executable))throw Error('Ollama local não instalado.');
const models=path.join(runtime,'ollama-models');fs.mkdirSync(models,{recursive:true});
const fd=fs.openSync(path.join(runtime,'ollama.log'),'a');
const child=spawn(executable,['serve'],{cwd:root,env:{...process.env,OLLAMA_HOST:'127.0.0.1:11435',OLLAMA_MODELS:models,OLLAMA_NO_CLOUD:'1',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_CONTEXT_LENGTH:'4096',OLLAMA_KEEP_ALIVE:'3m'},windowsHide:true,detached:true,stdio:['ignore',fd,fd]});child.unref();fs.closeSync(fd);
for(let i=0;i<30;i++){if(await ready()){console.log('IA local pronta na porta 11435.');return;}await new Promise(r=>setTimeout(r,500));}throw Error('Ollama não iniciou. Consulte runtime/ollama.log.');})().catch(e=>{console.error(e.message);process.exitCode=1;});
