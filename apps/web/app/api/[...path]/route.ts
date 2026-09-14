import {isCloud,authenticatedClient,CloudRepository} from '../../../lib/cloud';
import {FinanceCore} from '../../../../api/dist/finance';
import {localIntent} from '../../../../api/dist/interpreter';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
import { NextRequest,NextResponse } from 'next/server';
const allowed=new Set(['dashboard','alerts','conversation','conversation/history','preferences','scenarios','personal/save','personal/section','personal/record','personal/backup','open-finance/sync']);
async function proxy(req:NextRequest,context:{params:Promise<{path:string[]}>}){
  const path=(await context.params).path.join('/');
  if(!allowed.has(path))return NextResponse.json({message:'Não encontrado'},{status:404});
  if(isCloud()){
   const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
   try{
    const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if(!token)return json({message:'Entre na sua conta para continuar.'},401);
    const client=await authenticatedClient(token);if(!client)return json({message:'Sua sessão terminou. Entre novamente.'},401);
    const repo=new CloudRepository(client,token),finance=new FinanceCore(repo,true);
    let body:any;
    if(req.method==='POST'){const text=await req.text();if(Buffer.byteLength(text)>2000000)return json({message:'Arquivo muito grande. Limite: 2 MB.'},413);try{body=JSON.parse(text);}catch{return json({message:'Pedido inválido.'},400);}}
    if(req.method==='GET'){
     if(path==='dashboard')return json(await finance.dashboard());
     if(path==='alerts')return json(await finance.refreshAlerts());
     if(path==='conversation/history')return json(await finance.history());
     if(path==='preferences')return json(await finance.getPreferences());
     if(path==='personal/backup')return json(await finance.backup());
    }else{
     if(path==='personal/save')return json(await finance.save(body));
     if(path==='personal/section')return json(await finance.section(body));
     if(path==='personal/record')return json(await finance.record(body));
     if(path==='preferences')return json(await finance.savePreferences(body));
     if(path==='scenarios')return json(await finance.scenario(body));
     if(path==='conversation'){
      if(typeof body?.message==='string'&&localIntent(body.message).action==='clarify'&&!await repo.allowChat())return json({message:'Limite de conversa atingido. Aguarde ou use consultas de saldo, gastos simples e o simulador.'},429);
      return json(await finance.chat(body));
     }
     if(path==='open-finance/sync')return json({message:'Conexão bancária automática ainda não disponível. Use Meus dados.'},400);
    }
    return json({message:'Método não permitido.'},405);
   }catch(e){const error=e as {getStatus?:()=>number;message?:string};const status=error.getStatus?.()||503;return json({message:status<500?error.message:'Não foi possível acessar o serviço. Confira a configuração do Supabase e tente novamente.'},status);}
  }
  if(req.method==='POST'){
    const origin=req.headers.get('origin');
    const port=process.env.PORT||'3000';
    if(origin && !['http://127.0.0.1:'+port,'http://localhost:'+port].includes(origin))return NextResponse.json({message:'Origem inválida'},{status:403});
  }
  try{
    const body=req.method==='POST'?await req.text():undefined;
    if(body && Buffer.byteLength(body)>2000000)return NextResponse.json({message:'Arquivo muito grande. Limite: 2 MB.'},{status:413});
    const response=await fetch((process.env.API_URL||'http://127.0.0.1:4000')+'/'+path,{
      method:req.method,headers:{'Content-Type':'application/json',...(process.env.API_TOKEN?{Authorization:'Bearer '+process.env.API_TOKEN}:{})},
      body,cache:'no-store',signal:AbortSignal.timeout(path==='conversation'?180000:20000)
    });
    return NextResponse.json(await response.json(),{status:response.status});
  }catch{return NextResponse.json({message:'O serviço está indisponível. Abra o iniciador do RLA Nexo e tente novamente.'},{status:503});}
}
export {proxy as GET,proxy as POST};
