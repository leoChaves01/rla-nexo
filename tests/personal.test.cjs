const {test}=require('node:test'),assert=require('node:assert/strict');
const {demoSnapshot,project,salaryDate}=require('../packages/engine/dist');
const {record,SaveSchema}=require('../apps/api/dist/personal');
test('salário mensal gera previsão sem inflar saldo atual',()=>{
 const s=demoSnapshot('2026-09-09');s.incomes=[];s.salary={netCents:650000,nextDate:'2026-09-30',payday:30,accountId:'bank-1',confirmed:true};
 const p=project(s,'2026-10-31');assert.equal(p.balanceCents,1000000);assert.equal(p.endBalanceCents,1930000);assert.equal(p.freeCents,280000);
 s.salary.confirmed=false;assert.equal(project(s,'2026-10-31').endBalanceCents,630000);
});
test('salário pago atualiza conta e agenda somente o próximo recebimento',()=>{
 const s=demoSnapshot('2026-09-09');s.incomes=[];s.salary={netCents:650000,nextDate:'2026-09-09',payday:9,accountId:'bank-1',confirmed:true};
 const r=record(s,{revision:0,kind:'income',salary:true,accountId:'bank-1',amountCents:650000,description:'Salário',date:'2026-09-09'},'2026-09-09');
 assert.equal(r.accounts[0].balanceCents,1470000);assert.equal(r.salary.nextDate,'2026-10-09');assert.equal(r.transactions[0].amountCents,650000);
 assert.throws(()=>record(r,{revision:1,kind:'income',salary:true,accountId:'bank-1',amountCents:650000,description:'Salário',date:'2026-09-09'},'2026-09-09'));
});
test('fim de mês mantém dia habitual depois de fevereiro',()=>{
 assert.equal(salaryDate('2026-01-31',1,31),'2026-02-28');assert.equal(salaryDate('2026-02-28',1,31),'2026-03-31');
});
test('pagar conta desconta saldo e impede pagamento duplicado',()=>{
 const s=demoSnapshot('2026-09-09');const before=project(s).freeCents;
 const input={revision:0,kind:'expense',accountId:'bank-1',amountCents:220000,description:'Aluguel',date:'2026-09-09',commitmentId:'rent'};
 const r=record(s,input,'2026-09-09');assert.equal(r.accounts[0].balanceCents,600000);assert.equal(r.commitments[0].status,'paid');
 assert.equal(project(r).freeCents,before);assert.throws(()=>record(r,input,'2026-09-09'));
});
test('backup e cadastro rejeitam IDs duplicados e conta de salário inexistente',()=>{
 const s=demoSnapshot('2026-09-09');s.accounts.push(s.accounts[0]);assert.equal(SaveSchema.safeParse({revision:0,snapshot:s}).success,false);
 s.accounts.pop();s.salary={netCents:100,nextDate:'2026-09-09',payday:9,accountId:'missing',confirmed:true};
 assert.equal(SaveSchema.safeParse({revision:0,snapshot:s}).success,false);
});

