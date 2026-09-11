'use client';
import {apiFetch} from '../lib/client';
import {useState,FormEvent} from 'react';
import {addMonths} from '@rla-nexo/engine';
import type {Snapshot} from '@rla-nexo/engine';
type Data={snapshot:Snapshot;revision:number};
type Key='accounts'|'salary'|'commitments'|'incomes'|'goals'|'bufferCents';
type Section='accounts'|'salary'|'commitments'|'incomes'|'planning';
const keys:Key[]=['accounts','salary','commitments','incomes','goals','bufferCents'];
const sectionKeys:Record<Section,Key[]>={accounts:['accounts'],salary:['salary'],commitments:['commitments'],incomes:['incomes'],planning:['goals','bufferCents']};
const saveLabels:Record<Section,string>={accounts:'Salvar contas',salary:'Salvar salário',commitments:'Salvar contas a pagar',incomes:'Salvar receitas',planning:'Salvar metas e margem'};

const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const id=()=>crypto.randomUUID();
async function api(path:string,body?:unknown){
 const r=await apiFetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json();if(!r.ok)throw new Error(d.message||'Não foi possível concluir.');return d;
}
function Money({value,onChange,label,negative=false}:{value:number;onChange:(v:number)=>void;label:string;negative?:boolean}){
 return <label>{label}<input type="number" step="0.01" min={negative?undefined:0} max={100000000} value={value/100} onChange={e=>onChange(Math.round(Number(e.target.value)*100))} required/></label>;
}
export default function Personal({initial,onSaved}:{initial:Data;onSaved:()=>void}){
 const [draft,setDraft]=useState<Snapshot>(()=>structuredClone(initial.snapshot)),[revision,setRevision]=useState(initial.revision);
 const [saved,setSaved]=useState<Snapshot>(initial.snapshot),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [feedback,setFeedback]=useState<Partial<Record<Section,{error:boolean;text:string}>>>({});
 const isDirty=(section:Section)=>sectionKeys[section].some(k=>JSON.stringify(draft[k])!==JSON.stringify(saved[k]));
 const dirty=keys.some(k=>JSON.stringify(draft[k])!==JSON.stringify(saved[k]));
 const [entryFeedback,setEntryFeedback]=useState<{error:boolean;text:string}|null>(null);
 const [installment,setInstallment]=useState({name:'',amountCents:0,firstDate:initial.snapshot.asOf,count:2,start:1});
 const [installmentError,setInstallmentError]=useState('');
 const [pendingBackup,setPendingBackup]=useState<Snapshot|null>(null);
 const [entry,setEntry]=useState({accountId:initial.snapshot.accounts[0]?.id||'',kind:'expense',amountCents:0,description:'',date:initial.snapshot.asOf,commitmentId:undefined as string|undefined,incomeId:undefined as string|undefined,salaryPartId:undefined as string|undefined,salary:false});
 function edit(fn:(s:Snapshot)=>void){setDraft(s=>{const next=structuredClone(s);fn(next);if(next.salary?.parts){next.salary.netCents=next.salary.parts.reduce((n,p)=>n+p.amountCents,0);next.salary.nextDate=next.salary.parts.map(p=>p.nextDate).sort()[0]||next.asOf;}return next});setNotice('');setFeedback({});}
 function adopt(d:Data,changed:Key[]=keys){
  setDraft(current=>{const next=structuredClone(d.snapshot);for(const key of keys)if(!changed.includes(key)&&JSON.stringify(current[key])!==JSON.stringify(saved[key]))Object.assign(next,{[key]:current[key]});return next;});
  setSaved(d.snapshot);setRevision(d.revision);onSaved();
 }
 async function saveSection(e:FormEvent,section:Section){
  e.preventDefault();setBusy(true);setError('');
  try{
   const value=section==='planning'?{goals:draft.goals,bufferCents:draft.bufferCents}:draft[section];
   const result=await api('personal/section',{revision,section,value});
   adopt(result,sectionKeys[section]);
   setFeedback(v=>({...v,[section]:{error:false,text:'Salvo no banco de dados.'}}));
  }catch(e){setFeedback(v=>({...v,[section]:{error:true,text:(e as Error).message}}));}
  finally{setBusy(false);}
 }
 function saveControl(section:Section){
  return <div className="section-save"><button type="submit" className="primary" disabled={busy||!isDirty(section)}>{busy?'Salvando…':saveLabels[section]}</button><span>{isDirty(section)?'Alterações ainda não salvas.':'Dados salvos.'}</span>{feedback[section]&&<p role={feedback[section]!.error?'alert':'status'} className={feedback[section]!.error?'error':'saved-message'}>{feedback[section]!.text}</p>}</div>;
 }
 async function record(e:FormEvent){e.preventDefault();setEntryFeedback(null);if(isDirty('accounts')||(entry.commitmentId&&isDirty('commitments'))||(entry.incomeId&&isDirty('incomes'))||(entry.salary&&isDirty('salary'))){setEntryFeedback({error:true,text:'Salve a conta e a seção deste lançamento antes de registrá-lo.'});return;}setBusy(true);setError('');
 try{adopt(await api('personal/record',{revision,...entry}),['accounts',...(entry.commitmentId?['commitments' as Key]:[]),...(entry.incomeId?['incomes' as Key]:[]),...(entry.salary?['salary' as Key]:[])]);setEntry(v=>({...v,amountCents:0,description:'',commitmentId:undefined,incomeId:undefined,salaryPartId:undefined as string|undefined,salary:false}));setEntryFeedback({error:false,text:'Lançamento salvo. O saldo e a projeção foram atualizados.'});}
 catch(e){setEntryFeedback({error:true,text:(e as Error).message})}finally{setBusy(false);}
 }
 function prepare(values:Partial<typeof entry>){
  setEntryFeedback(null);setNotice('');setError('');
  const source:Section=values.commitmentId?'commitments':values.incomeId?'incomes':values.salary?'salary':'accounts';
  if(isDirty(source)||isDirty('accounts')){
   setFeedback(v=>({...v,[source]:{error:true,text:'Clique em '+saveLabels[isDirty(source)?source:'accounts']+' antes de registrar esta movimentação.'}}));return;
  }
  if(!saved.accounts.length){
   setFeedback(v=>({...v,[source]:{error:true,text:'O cadastro pode ser salvo sem conta bancária. Para registrar o dinheiro pago ou recebido, adicione e salve uma conta em Minhas contas.'}}));return;
  }
  if(values.salary&&!draft.salary?.accountId){
   setFeedback(v=>({...v,salary:{error:true,text:'Escolha uma conta de destino no salário e clique em Salvar salário antes de registrar a entrada.'}}));return;
  }
  setEntry({accountId:draft.accounts[0]?.id||'',kind:'expense',amountCents:0,description:'',date:draft.asOf,commitmentId:undefined,incomeId:undefined,salaryPartId:undefined as string|undefined,salary:false,...values});
  document.getElementById('novo-lancamento')?.scrollIntoView({behavior:'smooth'});
 }
 async function download(){
  setError('');try{const backup=await api('personal/backup');const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='rla-nexo-backup-'+draft.asOf+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError((e as Error).message)}
 }
 async function importBackup(file:File){
  setError('');try{if(file.size>2000000)throw new Error('O backup deve ter no máximo 2 MB.');const b=JSON.parse(await file.text());
  if(b.format!=='rla-nexo-backup'||b.version!==1||!b.snapshot||!Array.isArray(b.snapshot.accounts))throw new Error('Selecione um backup do RLA Nexo.');
  setPendingBackup(b.snapshot);}catch(e){setError((e as Error).message)}
 }
 async function restore(){
  if(!pendingBackup)return;setBusy(true);setError('');
  try{adopt(await api('personal/save',{revision,snapshot:pendingBackup}));setPendingBackup(null);setNotice('Backup restaurado.');}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="personal">
  <div className="personal-intro"><div><h2>Seus números, no seu ritmo.</h2><p>Comece pelo saldo atual. Depois, informe seu salário, contas e o que quer reservar.</p></div><span className="storage-badge">● Memória ativa · PostgreSQL</span></div>
  {error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="saved-message" role="status">{notice}</div>}
  <fieldset disabled={busy}>
   <form className="panel" id="minhas-contas" onSubmit={e=>saveSection(e,'accounts')}><div className="section-title"><h2>1. Minhas contas</h2><button type="button" className="secondary" onClick={()=>edit(s=>{s.accounts.push({id:id(),name:'',balanceCents:0})})}>+ Adicionar conta</button></div><p>Informe o saldo que aparece no banco hoje. Não inclua limite de cartão ou cheque especial.</p>
   {!draft.accounts.length&&<p className="empty-inline">Adicione sua primeira conta para começar.</p>}
   {draft.accounts.map((a,i)=><div className="edit-row" key={a.id}><label>Nome da conta<input value={a.name} maxLength={160} placeholder="Ex.: conta principal" required onChange={e=>edit(s=>{s.accounts[i].name=e.target.value})}/></label><Money label="Saldo atual (R$)" negative value={a.balanceCents} onChange={v=>edit(s=>{s.accounts[i].balanceCents=v})}/><button type="button" className="text-button" onClick={()=>edit(s=>{s.accounts.splice(i,1);if(s.salary?.accountId===a.id)s.salary.accountId=''})}>Remover</button></div>)}
   {saveControl('accounts')}</form>
   <form className="panel salary-settings" onSubmit={e=>saveSection(e,'salary')}><div className="section-title"><h2>2. Meu salário</h2>{!draft.salary?<button type="button" className="secondary" onClick={()=>edit(s=>{s.salary={netCents:0,nextDate:s.asOf,payday:Number(s.asOf.slice(-2)),accountId:s.accounts[0]?.id||'',confirmed:true}})}>Cadastrar salário</button>:<button type="button" className="text-button" onClick={()=>edit(s=>{s.salary=null})}>Remover salário</button>}</div>
   <p>Valor líquido que você recebe por mês. Não cadastre esse mesmo salário novamente em outras receitas.</p>
   {draft.salary&&<>{!draft.accounts.length&&<div className="pending-note" role="status"><p>Você pode salvar seu salário agora, sem cadastrar uma conta. A conta só será necessária para registrar o recebimento e atualizar o saldo.</p><button type="button" className="secondary" onClick={()=>{edit(s=>{const account={id:id(),name:"",balanceCents:0};s.accounts.push(account);});requestAnimationFrame(()=>document.getElementById("minhas-contas")?.scrollIntoView({behavior:"smooth"}))}}>Adicionar conta de destino</button></div>}<p>Escolha um recebimento único ou divida o salário em partes mensais. Total: <strong>{money(draft.salary.netCents)}</strong>.</p>
   {!draft.salary.parts?<><div className="edit-row salary-fields"><Money label="Salário líquido mensal (R$)" value={draft.salary.netCents} onChange={v=>edit(s=>{s.salary!.netCents=v})}/><label>Próximo recebimento<input type="date" required value={draft.salary.nextDate} onChange={e=>edit(s=>{s.salary!.nextDate=e.target.value})}/></label><label>Dia habitual de pagamento<input type="number" min={1} max={31} required value={draft.salary.payday} onChange={e=>edit(s=>{s.salary!.payday=Number(e.target.value)})}/></label></div><button type="button" className="secondary" onClick={()=>edit(s=>{const sal=s.salary!;sal.parts=[{id:id(),amountCents:Math.floor(sal.netCents/2),nextDate:sal.nextDate,payday:sal.payday},{id:id(),amountCents:sal.netCents-Math.floor(sal.netCents/2),nextDate:sal.nextDate,payday:sal.payday}]})}>Dividir salário em partes</button></>:<><p>Ajuste os valores e datas abaixo. Cada parte se repete mensalmente e é recebida separadamente.</p>{draft.salary.parts.map((part,i)=><div className="edit-row" key={part.id}><strong>Parte {i+1}</strong><Money label={'Valor da parte '+(i+1)+' (R$)'} value={part.amountCents} onChange={v=>edit(s=>{s.salary!.parts![i].amountCents=v})}/><label>Próxima data da parte {i+1}<input type="date" required value={part.nextDate} onChange={e=>edit(s=>{s.salary!.parts![i].nextDate=e.target.value})}/></label><label>Dia mensal da parte {i+1}<input type="number" min={1} max={31} required value={part.payday} onChange={e=>edit(s=>{s.salary!.parts![i].payday=Number(e.target.value)})}/></label><button type="button" className="secondary" onClick={()=>prepare({kind:'income',salary:true,salaryPartId:part.id,amountCents:part.amountCents,accountId:draft.salary!.accountId,description:'Salário · parte '+(i+1)})}>Receber parte {i+1}</button><button type="button" className="text-button" disabled={draft.salary!.parts!.length<=1} onClick={()=>edit(s=>{s.salary!.parts!.splice(i,1)})}>Remover parte {i+1}</button></div>)}<button type="button" className="secondary" disabled={draft.salary.parts.length>=12} onClick={()=>edit(s=>{s.salary!.parts!.push({id:id(),amountCents:0,nextDate:s.asOf,payday:Number(s.asOf.slice(-2))})})}>Adicionar parte do salário</button></>}
   <label>Conta de destino (opcional)<select value={draft.salary.accountId} onChange={e=>edit(s=>{s.salary!.accountId=e.target.value})}><option value="">Definir depois</option>{draft.accounts.map(a=><option key={a.id} value={a.id}>{a.name||'Conta sem nome'}</option>)}</select></label><label className="check"><input type="checkbox" checked={draft.salary.confirmed} onChange={e=>edit(s=>{s.salary!.confirmed=e.target.checked})}/>Incluir a previsão mensal na projeção</label><p>Se já recebeu este mês, inclua o valor no saldo atual e escolha a data do próximo salário.</p>
   {!draft.salary.parts&&<div className="entry-actions"><button type="button" className="secondary" onClick={()=>prepare({kind:'income',salary:true,amountCents:draft.salary!.netCents,accountId:draft.salary!.accountId,description:'Salário recebido'})}>Registrar salário recebido</button></div>}<p>Salvar cadastra a previsão. Registrar o recebimento altera o saldo depois da confirmação.</p></>}
   {saveControl('salary')}</form>
   <form className="panel" onSubmit={e=>{e.preventDefault();setInstallmentError('');if(!Number.isInteger(installment.count)||!Number.isInteger(installment.start)||installment.start<1||installment.start>installment.count||installment.count>120||installment.amountCents<=0||!installment.name.trim()){setInstallmentError('Confira descrição, valor positivo e numeração das parcelas.');return;}edit(s=>{for(let n=installment.start;n<=installment.count;n++)s.commitments.push({id:id(),name:installment.name.trim()+' · '+n+'/'+installment.count,amountCents:installment.amountCents,dueDate:addMonths(installment.firstDate,n-installment.start),status:'pending'})});setInstallment(v=>({...v,name:'',amountCents:0}));setNotice('Parcelas adicionadas abaixo. Confira e clique em Salvar contas a pagar.');}}><h2>Adicionar conta parcelada</h2><p>Informe o valor de cada parcela. Se já pagou algumas, comece pela próxima parcela em aberto. Os vencimentos seguintes serão mensais.</p><div className="edit-row"><label>Descrição do parcelamento<input required maxLength={140} value={installment.name} onChange={e=>setInstallment(v=>({...v,name:e.target.value}))}/></label><Money label="Valor de cada parcela (R$)" value={installment.amountCents} onChange={n=>setInstallment(v=>({...v,amountCents:n}))}/><label>Total de parcelas<input type="number" required min={1} max={120} value={installment.count} onChange={e=>setInstallment(v=>({...v,count:Number(e.target.value)}))}/></label><label>Próxima parcela em aberto<input type="number" required min={1} max={installment.count} value={installment.start} onChange={e=>setInstallment(v=>({...v,start:Number(e.target.value)}))}/></label><label>Vencimento da próxima parcela<input type="date" required value={installment.firstDate} onChange={e=>setInstallment(v=>({...v,firstDate:e.target.value}))}/></label></div><p>Total em aberto: {money(installment.amountCents*Math.max(0,installment.count-installment.start+1))}</p><button className="secondary">Gerar parcelas</button>{installmentError&&<p role="alert">{installmentError}</p>}</form>
   <form className="panel" onSubmit={e=>saveSection(e,'commitments')}><div className="section-title"><h2>3. Contas a pagar</h2><button type="button" className="secondary" onClick={()=>edit(s=>{s.commitments.push({id:id(),name:'',amountCents:0,dueDate:s.asOf,status:'pending'})})}>+ Adicionar conta a pagar</button></div><p>Cadastre cada vencimento conhecido. Para cartão, informe a fatura total, sem repetir as compras que já estão nela.</p>
   {draft.commitments.filter(c=>c.status==='pending').length===0&&<p className="empty-inline">Nenhuma conta pendente cadastrada.</p>}
   {draft.commitments.map((c,i)=>c.status==='pending'?<div className="edit-row" key={c.id}><label>Descrição<input required maxLength={160} value={c.name} onChange={e=>edit(s=>{s.commitments[i].name=e.target.value})}/></label><Money label="Valor (R$)" value={c.amountCents} onChange={v=>edit(s=>{s.commitments[i].amountCents=v})}/><label>Vencimento<input type="date" required value={c.dueDate} onChange={e=>edit(s=>{s.commitments[i].dueDate=e.target.value})}/></label><div className="row-actions"><button type="button" className="secondary" onClick={()=>prepare({commitmentId:c.id,amountCents:c.amountCents,description:c.name})}>Registrar pagamento</button><button type="button" className="text-button" onClick={()=>edit(s=>{s.commitments.splice(i,1)})}>Remover</button></div></div>:<div className="data-row" key={c.id}><span>✓ {c.name} · paga</span><strong>{money(c.amountCents)}</strong></div>)}
   {saveControl('commitments')}</form>
   <form className="panel" onSubmit={e=>saveSection(e,'incomes')}><div className="section-title"><h2>4. Outras receitas previstas</h2><button type="button" className="secondary" onClick={()=>edit(s=>{s.incomes.push({id:id(),name:'',date:s.asOf,amountCents:0,confirmed:true})})}>+ Adicionar receita</button></div><p>Freelas, reembolsos ou outras entradas. Previsões não confirmadas ficam fora do cálculo.</p>
   {draft.incomes.map((r,i)=><div className="edit-row" key={r.id}><label>Descrição<input value={r.name} required maxLength={160} onChange={e=>edit(s=>{s.incomes[i].name=e.target.value})}/></label><Money label="Valor (R$)" value={r.amountCents} onChange={v=>edit(s=>{s.incomes[i].amountCents=v})}/><label>Data<input type="date" required value={r.date} onChange={e=>edit(s=>{s.incomes[i].date=e.target.value})}/></label><label className="check"><input type="checkbox" checked={r.confirmed} onChange={e=>edit(s=>{s.incomes[i].confirmed=e.target.checked})}/>Confirmada</label><div className="row-actions"><button type="button" className="secondary" onClick={()=>prepare({kind:'income',incomeId:r.id,amountCents:r.amountCents,description:r.name})}>Registrar recebimento</button><button type="button" className="text-button" onClick={()=>edit(s=>{s.incomes.splice(i,1)})}>Remover</button></div></div>)}
   {saveControl('incomes')}</form>
   <form className="panel" onSubmit={e=>saveSection(e,'planning')}><div className="section-title"><h2>5. Metas e margem de segurança</h2><button type="button" className="secondary" onClick={()=>edit(s=>{s.goals.push({id:id(),name:'',reservedCents:0})})}>+ Adicionar meta</button></div><p>Reserve uma parte do saldo para cada objetivo. Esses valores continuam dentro das contas cadastradas.</p>
   {draft.goals.map((g,i)=><div className="edit-row" key={g.id}><label>Meta<input value={g.name} required maxLength={160} onChange={e=>edit(s=>{s.goals[i].name=e.target.value})}/></label><Money label="Valor protegido (R$)" value={g.reservedCents} onChange={v=>edit(s=>{s.goals[i].reservedCents=v})}/><button type="button" className="text-button" onClick={()=>edit(s=>{s.goals.splice(i,1)})}>Remover</button></div>)}
   <div className="buffer-field"><Money label="Margem de segurança (R$)" value={draft.bufferCents} onChange={v=>edit(s=>{s.bufferCents=v})}/></div>{saveControl('planning')}</form>
  </fieldset>
  <form className="panel" id="novo-lancamento" onSubmit={record}><h2>Registrar movimentação</h2><p>Use para uma despesa ou entrada que realmente aconteceu. O saldo da conta será atualizado.</p>
   {isDirty('accounts')&&<p className="pending-note">Salve suas contas antes de registrar uma movimentação.</p>}
   <fieldset disabled={busy||isDirty('accounts')||!saved.accounts.length}><div className="edit-row"><label>Tipo<select value={entry.kind} disabled={!!entry.commitmentId||!!entry.incomeId||entry.salary} onChange={e=>setEntry(v=>({...v,kind:e.target.value}))}><option value="expense">Despesa</option><option value="income">Entrada</option></select></label><label>Conta<select value={entry.accountId} required disabled={entry.salary} onChange={e=>setEntry(v=>({...v,accountId:e.target.value}))}><option value="">Selecione</option>{draft.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Descrição<input maxLength={160} required value={entry.description} onChange={e=>setEntry(v=>({...v,description:e.target.value}))}/></label><Money label="Valor (R$)" value={entry.amountCents} onChange={n=>setEntry(v=>({...v,amountCents:n}))}/><label>Data<input type="date" max={draft.asOf} required value={entry.date} onChange={e=>setEntry(v=>({...v,date:e.target.value}))}/></label></div><div className="entry-actions"><button className="primary" disabled={entry.amountCents<=0}>Confirmar lançamento</button><button className="secondary" type="button" onClick={()=>prepare({})}>Novo lançamento avulso</button></div></fieldset>
    {entryFeedback&&<p role={entryFeedback.error?'alert':'status'} className={entryFeedback.error?'error':'saved-message'}>{entryFeedback.text}</p>}
  </form>
  <section className="panel"><h2>Backup dos meus dados</h2><p>Baixe uma cópia dos cadastros e lançamentos para guardar em outro local. O histórico de conversa continua salvo no banco e não faz parte deste arquivo.</p><div className="backup-actions"><button className="secondary" onClick={()=>void download()}>Baixar backup</button><label className="secondary file-label">Escolher backup para restaurar<input type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void importBackup(f);e.target.value=''}}/></label></div>
   {pendingBackup&&<div className="restore-review"><h3>Confirmar restauração</h3><p>Este arquivo contém {pendingBackup.accounts.length} conta(s). Restaurar substituirá o cadastro atual. A versão anterior permanece no histórico interno do banco.</p><button disabled={busy} className="secondary" onClick={()=>void restore()}>Restaurar este backup</button><button className="text-button" onClick={()=>setPendingBackup(null)}>Cancelar</button></div>}
  </section>
 </div>
}
