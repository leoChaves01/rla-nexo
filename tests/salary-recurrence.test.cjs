const {test}=require('node:test'),assert=require('node:assert/strict');
const {demoSnapshot,project,salaryOccurrences,salaryOccurrence,salaryParts,salaryScheduleDate}=require('../packages/engine/dist');
const {record,updateSection}=require('../apps/api/dist/personal');
function base(day='2026-09-10'){
 const s=demoSnapshot(day);s.incomes=[];s.commitments=[];s.goals=[];s.bufferCents=0;s.accounts=[{id:'bank',name:'Banco',balanceCents:80000}];
 s.salary={netCents:120000,nextDate:day,payday:14,accountId:'bank',active:true,confirmed:true,occurrences:[]};return s;
}
test('renda recorrente de uma parte separa saldo realizado da previsão',()=>{
 const s=base();const current=salaryOccurrence(s,salaryParts(s)[0],'2026-09');assert.equal(current.scheduledDate,'2026-09-14');assert.equal(current.status,'PENDING');
 const p=project(s,'2026-09-20');assert.equal(p.balanceCents,80000);assert.equal(p.endBalanceCents,200000);assert.equal(p.freeCents,80000);
});
test('salário dividido gera cada ocorrência mensal e indica atrasado sem data próxima passada',()=>{
 const s=base();s.salary={netCents:339000,accountId:'bank',active:true,confirmed:true,occurrences:[],parts:[{id:'one',amountCents:109000,payday:1},{id:'five',amountCents:120000,payday:5},{id:'twenty',amountCents:110000,payday:20}]};
 const occurrences=salaryOccurrences(s,'2026-09-01','2026-09-30');assert.deepEqual(occurrences.map(x=>[x.scheduledDate,x.status]),[['2026-09-01','OVERDUE'],['2026-09-05','OVERDUE'],['2026-09-20','PENDING']]);
 assert.equal(project(s,'2026-09-30').endBalanceCents,190000);
});
test('confirmar recebimento é idempotente, atualiza saldo real e mantém a recorrência',()=>{
 const s=base('2026-09-14');const input={revision:0,kind:'income',salary:true,salaryPartId:'salary',salaryReferenceMonth:'2026-09',accountId:'bank',amountCents:120000,description:'Salário',date:'2026-09-14'};
 const saved=record(s,input,'2026-09-14');assert.equal(saved.accounts[0].balanceCents,200000);assert.equal(saved.salary.occurrences[0].status,'RECEIVED');assert.equal(saved.transactions.filter(t=>t.description==='Salário').length,1);
 assert.equal(salaryOccurrence(saved,salaryParts(saved)[0],'2026-10').scheduledDate,'2026-10-14');assert.equal(project(saved,'2026-10-20').endBalanceCents,320000);assert.throws(()=>record(saved,input,'2026-09-14'),/já foi confirmado/);
});
test('dia 31 usa o último dia válido e mudança de valor não reescreve o histórico',()=>{
 const s=base('2026-02-28');s.salary={netCents:100000,accountId:'bank',active:true,confirmed:true,occurrences:[],parts:[{id:'monthly',amountCents:100000,payday:31}]};
 assert.equal(salaryOccurrence(s,salaryParts(s)[0],'2026-02').scheduledDate,'2026-02-28');
 const received=record(s,{revision:0,kind:'income',salary:true,salaryPartId:'monthly',salaryReferenceMonth:'2026-02',accountId:'bank',amountCents:100000,description:'Salário fevereiro',date:'2026-02-28'},'2026-02-28');
 received.salary.parts[0].amountCents=120000;received.salary.netCents=120000;
 assert.equal(salaryOccurrence(received,salaryParts(received)[0],'2026-02').amountCents,100000);assert.equal(salaryOccurrence(received,salaryParts(received)[0],'2026-03').amountCents,120000);assert.equal(salaryOccurrence(received,salaryParts(received)[0],'2026-03').scheduledDate,'2026-03-31');
});
test('remover parte só afeta ocorrências futuras e outras rendas previstas continuam válidas',()=>{
 const s=base();s.salary={netCents:220000,accountId:'bank',active:true,confirmed:true,occurrences:[],parts:[{id:'a',amountCents:100000,payday:10},{id:'b',amountCents:120000,payday:20}]};
 const got=record(s,{revision:0,kind:'income',salary:true,salaryPartId:'a',salaryReferenceMonth:'2026-09',accountId:'bank',amountCents:100000,description:'Parte A',date:'2026-09-10'},'2026-09-10');
 got.salary.parts=got.salary.parts.filter(p=>p.id!=='b');got.salary.netCents=100000;got.incomes.push({id:'freela',name:'Freela',date:'2026-09-18',amountCents:50000,confirmed:true});
 assert.equal(got.salary.occurrences[0].amountCents,100000);assert.deepEqual(salaryOccurrences(got,'2026-10-01','2026-10-31').map(o=>o.salaryPartId),['a']);assert.equal(project(got,'2026-09-30').endBalanceCents,230000);
});
