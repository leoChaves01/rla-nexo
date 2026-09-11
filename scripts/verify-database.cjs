const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{Client}=require('pg'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');process.loadEnvFile(path.join(root,'.env'));
const name='rla_nexo_check_'+Date.now();const original=new URL(process.env.DATABASE_URL);const testUrl=new URL(original);testUrl.pathname='/'+name;
const admin=new Client({connectionString:original.toString()});
let child,log;
async function launch(){
 log=fs.openSync(path.join(root,'runtime','verification.log'),'a');
 child=spawn(process.execPath,['dist/main.js'],{cwd:path.join(root,'apps/api'),env:{...process.env,DATABASE_URL:testUrl.toString(),PORT:'4002'},windowsHide:true,stdio:['ignore',log,log]});
 for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:4002/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,400));}
 throw new Error('A API de teste não iniciou.');
}
async function stop(){if(child){await new Promise(resolve=>{child.once('exit',resolve);child.kill();});child=undefined;}if(log!==undefined){fs.closeSync(log);log=undefined;}}
async function api(p,body){const r=await fetch('http://127.0.0.1:4002/'+p,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+process.env.API_TOKEN,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
(async()=>{
 await admin.connect();await admin.query('CREATE DATABASE '+name);
 try{
  await launch();
  let d=(await api('dashboard')).data;assert.equal(d.storage,'postgresql');assert.equal(d.snapshot.accounts.length,0);
  d.snapshot.salary={netCents:123456,nextDate:d.snapshot.asOf,payday:5,accountId:'',confirmed:true};
  const salaryOnly=await api('personal/save',{revision:d.revision,snapshot:d.snapshot});
  assert.equal(salaryOnly.status,201);
  await stop();await launch();
  d=(await api('dashboard')).data;
  assert.equal(d.snapshot.salary.netCents,123456);
  assert.equal(d.snapshot.accounts.length,0);
  const bill={id:'tuition',name:'Mensalidade de teste',amountCents:49000,dueDate:d.snapshot.asOf,status:'pending'};
  let section=await api('personal/section',{revision:d.revision,section:'commitments',value:[bill]});
  assert.equal(section.status,201);
  d=section.data;
  section=await api('personal/section',{revision:d.revision,section:'incomes',value:[{id:'extra',name:'Receita de teste',amountCents:555000,date:d.snapshot.asOf,confirmed:true}]});
  assert.equal(section.status,201);
  d=section.data;
  assert.equal(d.snapshot.commitments[0].amountCents,49000);
  assert.equal(d.snapshot.salary.netCents,123456);
  assert.equal(d.snapshot.accounts.length,0);
  const invalid=await api('personal/section',{revision:d.revision,section:'incomes',value:[{id:'bad',name:'',amountCents:1,date:d.snapshot.asOf,confirmed:true}]});
  assert.equal(invalid.status,400);
  await stop();await launch();
  d=(await api('dashboard')).data;
  assert.equal(d.snapshot.commitments[0].name,'Mensalidade de teste');
  assert.equal(d.snapshot.incomes[0].amountCents,555000);
  const snapshot=d.snapshot;
  snapshot.accounts=[{id:'main',name:'Minha conta',balanceCents:200000}];
  snapshot.salary={netCents:350000,nextDate:snapshot.asOf,payday:Number(snapshot.asOf.slice(-2)),accountId:'main',confirmed:true};
  snapshot.commitments=[{id:'rent',name:'Aluguel',amountCents:100000,dueDate:snapshot.asOf,status:'pending'}];
  d=(await api('personal/save',{revision:d.revision,snapshot})).data;
  assert.equal(d.revision,4);
  assert.equal((await api('personal/save',{revision:0,snapshot})).status,409);
  const result=await api('personal/record',{revision:4,accountId:'main',kind:'income',salary:true,amountCents:350000,description:'Salário recebido',date:snapshot.asOf});
  assert.equal(result.status,201);assert.equal(result.data.snapshot.accounts[0].balanceCents,550000);
  await api('conversation',{message:'Quero gastar 500'});
  const backup=(await api('personal/backup')).data;assert.equal(backup.snapshot.salary.netCents,350000);
  await stop();await launch();
  d=(await api('dashboard')).data;
  assert.equal(d.snapshot.accounts[0].balanceCents,550000);assert.equal(d.revision,5);assert.equal(d.snapshot.transactions[0].description,'Salário recebido');
  assert.equal((await api('conversation/history')).data.length,2);
  const count=await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[name]);assert.equal(count.rowCount,1);
  console.log('PASS: PostgreSQL real; cadastro, salário, lançamento, conflito de revisão, backup e conversa preservados após reiniciar a API.');
 }finally{
  await stop();await admin.query('DROP DATABASE '+name+' WITH (FORCE)');await admin.end();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
