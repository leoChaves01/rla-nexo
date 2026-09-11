const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {Client}=require('pg');
const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'runtime');
const cluster=path.join(runtime,'postgres');
const bin='C:/Program Files/PostgreSQL/17/bin';
fs.mkdirSync(runtime,{recursive:true});
const configPath=path.join(runtime,'database.json');
let config;
if(fs.existsSync(configPath))config=JSON.parse(fs.readFileSync(configPath,'utf8'));
else{
 config={bin,cluster,port:55432,user:'rla_nexo',password:crypto.randomBytes(32).toString('hex'),database:'rla_nexo'};
 fs.writeFileSync(configPath,JSON.stringify(config),{mode:0o600});
}
function run(name,args){
 const fd=fs.openSync(path.join(runtime,'database-setup.log'),'a');
 const result=spawnSync(path.join(config.bin,name+'.exe'),args,{stdio:['ignore',fd,fd],windowsHide:true,timeout:60000});
 fs.closeSync(fd);
 if(result.status!==0)throw new Error(name+' falhou: '+(result.stderr||result.stdout||result.error?.message||'erro'));
}
async function main(){
 if(!fs.existsSync(path.join(cluster,'PG_VERSION'))){
  const pwfile=path.join(runtime,'init-password.tmp');
  fs.writeFileSync(pwfile,config.password,{mode:0o600});
  try{run('initdb',['-D',cluster,'-U',config.user,'--pwfile='+pwfile,'--auth=scram-sha-256','--encoding=UTF8','--locale=C']);}
  finally{if(fs.existsSync(pwfile))fs.unlinkSync(pwfile);}
 }
 const status=spawnSync(path.join(config.bin,'pg_ctl.exe'),['-D',cluster,'status'],{encoding:'utf8',windowsHide:true});
 if(status.status!==0)run('pg_ctl',['-D',cluster,'-l',path.join(runtime,'postgres.log'),'-o','-p '+config.port+' -h 127.0.0.1','-w','start']);
 const client=new Client({host:'127.0.0.1',port:config.port,user:config.user,password:config.password,database:'postgres'});
 await client.connect();
 if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[config.database])).rowCount)await client.query('CREATE DATABASE rla_nexo');
 await client.end();
 const envFile=path.join(root,'.env');
 let env=fs.existsSync(envFile)?fs.readFileSync(envFile,'utf8'):fs.readFileSync(path.join(root,'.env.example'),'utf8');
 const url='postgresql://'+config.user+':'+config.password+'@127.0.0.1:'+config.port+'/'+config.database;
 for(const [key,value]of Object.entries({DATABASE_URL:url,API_TOKEN:crypto.randomBytes(32).toString('hex')})){
  if(key==='API_TOKEN' && /^API_TOKEN=.{32,}$/m.test(env))continue;
  const re=new RegExp('^'+key+'=.*$','m');env=re.test(env)?env.replace(re,key+'='+value):env+'\n'+key+'='+value;
 }
 fs.writeFileSync(envFile,env,{mode:0o600});
 console.log('PostgreSQL exclusivo do RLA Nexo pronto na porta '+config.port+'. Credenciais salvas somente no computador.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
