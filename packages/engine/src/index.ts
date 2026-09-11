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
const SalaryPartSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100).optional(),amountCents:cents.refine(v=>v>0),payday:z.number().int().min(1).max(31),nextDate:dateOnly.optional()});
const SalaryOccurrenceSchema=z.object({id:z.string().min(1).max(160),salaryPartId:z.string().min(1).max(100),referenceMonth:z.string().regex(/^\d{4}-\d{2}$/),scheduledDate:dateOnly,amountCents:cents.refine(v=>v>0),status:z.enum(['PENDING','RECEIVED','OVERDUE']),receivedAt:z.string().datetime().optional(),transactionId:z.string().min(1).max(100).optional()}).superRefine((o,ctx)=>{if(o.status==='RECEIVED'&&(!o.receivedAt||!o.transactionId))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Recebimento confirmado precisa de data e transação.'});});
export const SnapshotSchema = z.object({
  asOf: dateOnly,
  syncedAt: z.string().datetime(),
  accounts: z.array(z.object({id:z.string(),name:z.string(),balanceCents:z.number().int().min(-1e12).max(1e12)})).max(100),
  transactions: z.array(z.object({id:z.string(),description:z.string(),date:dateOnly,amountCents:z.number().int().min(-1e12).max(1e12)})).max(10000),
  commitments: z.array(z.object({id:z.string(),name:z.string(),dueDate:dateOnly,amountCents:cents,status:z.enum(['pending','paid'])})).max(10000),
  incomes: z.array(z.object({id:z.string(),name:z.string(),date:dateOnly,amountCents:cents,confirmed:z.boolean()})).max(1000),
  goals: z.array(z.object({id:z.string(),name:z.string(),reservedCents:cents})).max(100),
  bufferCents:cents,
  salary:z.object({netCents:cents.refine(v=>v>0),nextDate:dateOnly.optional(),payday:z.number().int().min(1).max(31).optional(),accountId:z.string(),confirmed:z.boolean().optional(),active:z.boolean().optional(),parts:z.array(SalaryPartSchema).min(1).max(12).optional(),occurrences:z.array(SalaryOccurrenceSchema).max(2000).default([])}).superRefine((s,ctx)=>{
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
export type SalaryPart={id:string;name?:string;amountCents:number;payday:number;nextDate?:string};
export type SalaryOccurrence={id:string;salaryPartId:string;referenceMonth:string;scheduledDate:string;amountCents:number;status:'PENDING'|'RECEIVED'|'OVERDUE';receivedAt?:string;transactionId?:string};
export function salaryActive(s:Snapshot){return !!s.salary&&(s.salary.active??s.salary.confirmed??true);}
export function salaryParts(s:Snapshot):SalaryPart[]{
 if(!s.salary)return [];
 return s.salary.parts??[{id:'salary',name:'Salário',amountCents:s.salary.netCents,payday:s.salary.payday??Number((s.salary.nextDate??s.asOf).slice(-2)),nextDate:s.salary.nextDate}];
}
export function salaryScheduleDate(referenceMonth:string,payday:number){
 const [year,month]=referenceMonth.split('-').map(Number);const last=new Date(Date.UTC(year,month,0)).getUTCDate();return `${referenceMonth}-${String(Math.min(payday,last)).padStart(2,'0')}`;
}
export function salaryOccurrence(s:Snapshot,part:SalaryPart,referenceMonth:string):SalaryOccurrence{
 const scheduledDate=salaryScheduleDate(referenceMonth,part.payday);
 const saved=s.salary?.occurrences?.find(o=>o.salaryPartId===part.id&&o.referenceMonth===referenceMonth);
 if(saved)return saved;
 return {id:`salary:${part.id}:${referenceMonth}`,salaryPartId:part.id,referenceMonth,scheduledDate,amountCents:part.amountCents,status:scheduledDate<s.asOf?'OVERDUE':'PENDING'};
}
export function salaryOccurrences(s:Snapshot,startDate:string,endDate:string):SalaryOccurrence[]{
 if(!salaryActive(s)||!s.salary)return [];
 const startMonth=startDate.slice(0,7),endMonth=endDate.slice(0,7),result:SalaryOccurrence[]=[];
 for(const part of salaryParts(s))for(let month=startMonth;month<=endMonth;month=addMonths(month+'-01',1).slice(0,7)){
   const occurrence=salaryOccurrence(s,part,month);
   if(occurrence.scheduledDate>=startDate&&occurrence.scheduledDate<=endDate)result.push(occurrence);
 }
 return result.sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate)||a.salaryPartId.localeCompare(b.salaryPartId));
}
export function salaryEvents(s:Snapshot,endDate:string){
 return salaryOccurrences(s,s.asOf,endDate).filter(o=>o.status!=='RECEIVED').map(o=>({date:o.scheduledDate,amountCents:o.amountCents}));
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
  const currentSalary=salaryOccurrences(s,`${s.asOf.slice(0,7)}-01`,s.asOf).filter(o=>o.status==='OVERDUE');
  if(currentSalary.length)result.push({id:'salary-overdue',level:'warning',message:currentSalary.length===1?'Um recebimento do salário aguarda confirmação.':'Há recebimentos do salário aguardando confirmação.'});
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
