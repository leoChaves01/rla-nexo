import { z } from 'zod';

// Limite por registro mantém as somas de até 10.000 eventos dentro de MAX_SAFE_INTEGER.
export const cents = z.number().int().min(0).max(10_000_000_000);
// Valide o formato antes de remover os separadores de milhar.
export function parseBrlCents(input:string):number|null {
  const raw=input.trim();
  if(!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(raw))return null;
  const [whole,fraction='']=raw.split(',');
  const value=Number(whole.replace(/\./g,''))*100+Number(fraction.padEnd(2,'0'));
  return cents.safeParse(value).success?value:null;
}
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v;
}, 'Data inválida');
export const SnapshotSchema = z.object({
  asOf: dateOnly,
  syncedAt: z.string().datetime(),
  accounts: z.array(z.object({id:z.string(),name:z.string(),balanceCents:z.number().int().min(-1e12).max(1e12)})).max(100),
  transactions: z.array(z.object({id:z.string(),description:z.string(),date:dateOnly,amountCents:z.number().int().min(-1e12).max(1e12)})).max(10000),
  commitments: z.array(z.object({id:z.string(),name:z.string(),dueDate:dateOnly,amountCents:cents,status:z.enum(['pending','paid'])})).max(10000),
  incomes: z.array(z.object({id:z.string(),name:z.string(),date:dateOnly,amountCents:cents,confirmed:z.boolean()})).max(1000),
  goals: z.array(z.object({id:z.string(),name:z.string(),reservedCents:cents})).max(100),
  bufferCents:cents,
  salary:z.object({netCents:cents.refine(v=>v>0),nextDate:dateOnly,payday:z.number().int().min(1).max(31),accountId:z.string(),confirmed:z.boolean(),parts:z.array(z.object({id:z.string().min(1).max(100),amountCents:cents.refine(v=>v>0),nextDate:dateOnly,payday:z.number().int().min(1).max(31)})).min(1).max(12).optional()}).superRefine((s,ctx)=>{
    if(s.parts&&(new Set(s.parts.map(p=>p.id)).size!==s.parts.length||s.parts.reduce((n,p)=>n+p.amountCents,0)!==s.netCents))ctx.addIssue({code:z.ZodIssueCode.custom,message:'As partes do salário devem ter identificadores únicos e somar o total mensal.'});
  }).nullable().optional()
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
export const ScenarioSchema = z.object({
  amountCents:cents.refine(v=>v>0,'Informe um valor positivo'),
  date:dateOnly,
  months:z.number().int().min(1).max(12).default(1),
  kind:z.enum(['expense','income']).default('expense')
}).strict();
export type Scenario = z.infer<typeof ScenarioSchema>;
export const brl = (value:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
export const addDays = (date:string,days:number) => new Date(new Date(date+'T00:00:00Z').getTime()+days*86400000).toISOString().slice(0,10);
export function addMonths(date:string,months:number) {
  const [y,m,d] = date.split('-').map(Number);
  const end = new Date(Date.UTC(y,m+months,0)).getUTCDate();
  return new Date(Date.UTC(y,m-1+months,Math.min(d,end))).toISOString().slice(0,10);
}
export function salaryDate(anchor:string,months:number,payday:number){
 const [y,m]=anchor.split('-').map(Number);
 const day=Math.min(payday,new Date(Date.UTC(y,m+months,0)).getUTCDate());
 return new Date(Date.UTC(y,m-1+months,day)).toISOString().slice(0,10);
}
export function salaryEvents(s:Snapshot,endDate:string){
 if(!s.salary?.confirmed)return [];
 const events:{date:string;amountCents:number}[]=[];
 for(const part of s.salary.parts??[{nextDate:s.salary.nextDate,payday:s.salary.payday,amountCents:s.salary.netCents}])for(let n=0;n<36;n++){
  const date=n===0?part.nextDate:salaryDate(part.nextDate,n,part.payday);
  if(date>endDate)break;
  if(date>=s.asOf)events.push({date,amountCents:part.amountCents});
 }
 return events;
}
export function project(input:Snapshot,endDate=addDays(input.asOf,30),extra:{date:string;amountCents:number}[]=[]) {
  const s = SnapshotSchema.parse(input); dateOnly.parse(endDate);
  if(endDate<s.asOf) throw new Error('Horizonte anterior à data-base');
  const balanceCents=s.accounts.reduce((n,a)=>n+a.balanceCents,0);
  const reservedCents=s.goals.reduce((n,g)=>n+g.reservedCents,0);
  const events = [
    ...s.commitments.filter(c=>c.status==='pending' && c.dueDate<=endDate).map(c=>({date:c.dueDate<s.asOf?s.asOf:c.dueDate,amountCents:-c.amountCents})),
    ...s.incomes.filter(i=>i.confirmed && i.date>=s.asOf && i.date<=endDate).map(i=>({date:i.date,amountCents:i.amountCents})),
    ...salaryEvents(s,endDate),
    ...extra.filter(e=>e.date>=s.asOf && e.date<=endDate)
  ];
  const dates=[...new Set([s.asOf,endDate,...events.map(e=>e.date)])].sort();
  let cash=balanceCents;
  // Saldo disponível agora também limita o gasto: salário futuro não financia o presente.
  let minCashCents=balanceCents, minDate=s.asOf;
  const timeline=dates.map(date=>{
    // Projeção diária: entradas confirmadas e saídas da mesma data se compensam.
    const day=events.filter(e=>e.date===date);
    cash+=day.reduce((n,e)=>n+e.amountCents,0);
    if(cash<minCashCents){minCashCents=cash;minDate=date;}
    const lowestCents=cash;
    return {date,balanceCents:cash,lowestCents,freeCents:cash-reservedCents-s.bufferCents};
  });
  return {asOf:s.asOf,endDate,balanceCents,reservedCents,bufferCents:s.bufferCents,
    commitmentsCents:s.commitments.filter(c=>c.status==='pending'&&c.dueDate<=endDate).reduce((n,c)=>n+c.amountCents,0),
    minCashCents,minDate,freeCents:minCashCents-reservedCents-s.bufferCents,endBalanceCents:cash,timeline};
}
export function assess(s:Snapshot,amountCents:number) {
  cents.refine(v=>v>0).parse(amountCents);
  const before=project(s);
  const after=project(s,before.endDate,[{date:s.asOf,amountCents:-amountCents}]);
  const status=after.minCashCents<0?'bills_at_risk':after.freeCents<0?'goals_at_risk':'safe';
  const limitCents=Math.max(0,before.freeCents);
  const explanation=status==='safe'
    ?'Esse gasto cabe na projeção. Contas, reservas das metas e margem de segurança continuam cobertas.'
    :status==='bills_at_risk'?'Esse gasto deixa o caixa negativo antes do fim do período e pode comprometer contas.'
    :'As contas ficam cobertas, mas o gasto utiliza valores protegidos para metas ou margem de segurança.';
  return {status,amountCents,limitCents,before,after,explanation,
    alternatives:status==='safe'?[]:[
      limitCents>0?'Reduza o gasto para até '+brl(limitCents)+'.':'Adie o gasto até existir dinheiro livre.',
      'Simule outra data; uma entrada futura só ajuda depois de recebida.'
    ]};
}
export function simulate(s:Snapshot,input:Scenario) {
  const scenario=ScenarioSchema.parse(input);
  if(scenario.date<s.asOf || scenario.date>addMonths(s.asOf,12)) throw new Error('Escolha uma data nos próximos 12 meses');
  const events=Array.from({length:scenario.months},(_,i)=>({date:addMonths(scenario.date,i),amountCents:scenario.amountCents*(scenario.kind==='expense'?-1:1)}));
  const endDate=addDays(events[events.length-1].date,30);
  const baseline=project(s,endDate),result=project(s,endDate,events);
  return {scenario,baseline,result,totalCents:scenario.amountCents*scenario.months,
    status:result.minCashCents<0?'bills_at_risk':result.freeCents<0?'goals_at_risk':'safe',
    assumptions:['Considera os eventos cadastrados e a previsão mensal de salário habilitada. Despesas não se repetem automaticamente.',
      'Receitas não confirmadas são excluídas. Entradas e saídas da mesma data são compensadas no saldo diário; horários bancários não são considerados.',
      'Metas são reservas dentro do saldo bancário, descontadas uma única vez.']};
}
export function alerts(s:Snapshot,now=new Date()) {
  const p=project(s);
  const result:{id:string;level:string;message:string}[]=[];
  if(s.accounts.length===0)result.push({id:'onboarding',level:'info',message:'Cadastre sua conta e seu salário em Meus dados para começar.'});
  if(s.salary && (s.salary.parts??[s.salary]).some(p=>p.nextDate<s.asOf))result.push({id:'salary-overdue',level:'warning',message:'Um recebimento do salário ainda não foi registrado. Confirme a entrada ou atualize a próxima data.'});
  if(now.getTime()-new Date(s.syncedAt).getTime()>86400000)
    result.push({id:'stale',level:'warning',message:'Dados sem atualização há mais de 24 horas. Sincronize antes de decidir.'});
  if(p.minCashCents<0) result.push({id:'cash-risk',level:'danger',message:'Projeção de caixa negativo em '+p.minDate+'. Revise os compromissos.'});
  else if(p.freeCents<0) result.push({id:'goal-risk',level:'warning',message:'As reservas de metas e a margem de segurança não estão totalmente cobertas.'});
  else if(p.freeCents>0) result.push({id:'available',level:'info',message:'Há '+brl(p.freeCents)+' livres na projeção de 30 dias. Você pode simular um aporte às metas.'});
  for(const c of s.commitments.filter(c=>c.status==='pending'&&c.dueDate<=addDays(s.asOf,3))) result.push({
    id:'due-'+c.id,level:'warning',message:c.name+': '+brl(c.amountCents)+(c.dueDate<s.asOf?' em atraso.':' vence em '+c.dueDate+'.')
  });
  return result;
}
export function demoSnapshot(asOf=new Date().toISOString().slice(0,10)):Snapshot {
  return {asOf,syncedAt:new Date().toISOString(),
    accounts:[{id:'bank-1',name:'Conta principal · demonstração',balanceCents:820000},{id:'bank-2',name:'Conta digital · demonstração',balanceCents:180000}],
    transactions:[{id:'t1',description:'Supermercado',date:addDays(asOf,-1),amountCents:-28690},{id:'t2',description:'Salário recebido',date:addDays(asOf,-4),amountCents:650000},{id:'t3',description:'Transporte',date:addDays(asOf,-2),amountCents:-4200}],
    commitments:[{id:'rent',name:'Aluguel',dueDate:addDays(asOf,2),amountCents:220000,status:'pending'},
      {id:'card',name:'Fatura do cartão',dueDate:addDays(asOf,8),amountCents:135000,status:'pending'},
      {id:'internet',name:'Internet',dueDate:addDays(asOf,12),amountCents:15000,status:'pending'}],
    incomes:[{id:'salary',name:'Próximo salário',date:addDays(asOf,26),amountCents:650000,confirmed:true}],
    goals:[{id:'emergency',name:'Reserva de emergência',reservedCents:200000},{id:'travel',name:'Próxima viagem',reservedCents:100000}],
    bufferCents:50000};
}
