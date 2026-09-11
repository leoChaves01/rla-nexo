const {test}=require('node:test');
const assert=require('node:assert/strict');
const {demoSnapshot,project,assess,simulate,alerts,addMonths}=require('../packages/engine/dist');
const demo=()=>demoSnapshot('2026-09-09');
test('dinheiro livre reserva contas, metas e margem uma vez',()=>{
 const s=demo(),p=project(s);assert.equal(p.balanceCents,1000000);assert.equal(p.commitmentsCents,370000);assert.equal(p.freeCents,280000);
 assert.equal(p.endBalanceCents,1280000);
});
test('classifica gasto seguro, risco às metas e risco às contas',()=>{
 const s=demo();assert.equal(assess(s,50000).status,'safe');assert.equal(assess(s,300000).status,'goals_at_risk');assert.equal(assess(s,700000).status,'bills_at_risk');
 assert.equal(assess(s,280000).after.freeCents,0);
});
test('renda futura não financia caixa anterior nem renda não confirmada',()=>{
 const s=demo();s.accounts=[{id:'a',name:'a',balanceCents:0}];s.incomes[0].confirmed=false;
 assert.equal(project(s).endBalanceCents,-370000);assert.equal(assess(s,100).status,'bills_at_risk');
});
test('entrada confirmada cobre saída na mesma data',()=>{
 const s=demo();s.accounts[0].balanceCents=0;s.accounts[1].balanceCents=0;s.commitments=s.commitments.slice(0,1);
 s.incomes[0].date=s.commitments[0].dueDate;
 assert.equal(project(s).minCashCents,0);
});
test('compromissos pagos e transações passadas não descontam novamente',()=>{
 const s=demo();s.commitments.forEach(c=>c.status='paid');
 assert.equal(project(s).freeCents,650000);
});
test('conta em atraso é descontada imediatamente',()=>{
 const s=demo();s.commitments[0].dueDate='2026-09-01';
 assert.equal(project(s).timeline[0].balanceCents,780000);
});
test('simulação mensal preserva entrada e ajusta fim de mês',()=>{
 const s=demo(),original=JSON.stringify(s);
 const r=simulate(s,{amountCents:50000,date:'2026-09-10',months:3,kind:'expense'});
 assert.equal(r.totalCents,150000);assert.equal(r.baseline.endBalanceCents-r.result.endBalanceCents,150000);assert.equal(JSON.stringify(s),original);
 assert.equal(addMonths('2026-01-31',1),'2026-02-28');
});
test('simulação de entrada futura não melhora disponibilidade anterior',()=>{
 const s=demo();const r=simulate(s,{amountCents:500000,date:'2026-10-10',months:1,kind:'income'});
 assert.equal(r.result.freeCents,r.baseline.freeCents);
});
test('rejeita negativos, frações de centavo, overflow e datas impossíveis',()=>{
 const s=demo();for(const value of [-1,0,1.5,Infinity,1e15])assert.throws(()=>assess(s,value));
 assert.throws(()=>simulate(s,{amountCents:100,date:'2026-02-30',months:1,kind:'expense'}));
 assert.throws(()=>simulate(s,{amountCents:100,date:'2026-08-01',months:1,kind:'expense'}));
});
test('alertas incluem risco, vencimento e dados desatualizados',()=>{
 const s=demo();s.syncedAt='2026-09-01T00:00:00.000Z';s.accounts=[];
 const ids=alerts(s,new Date('2026-09-09')).map(a=>a.id);
 assert.ok(ids.includes('cash-risk'));assert.ok(ids.includes('stale'));assert.ok(ids.includes('due-rent'));
});

