import {Snapshot,project,brl,salaryEvents} from '@rla-nexo/engine';
export function explainBalance(s:Snapshot){
 const p=project(s);
 const date=(v:string)=>v.split('-').reverse().join('/');
 const bills=s.commitments.filter(c=>c.status==='pending'&&c.dueDate<=p.minDate);
 const out=bills.reduce((n,c)=>n+c.amountCents,0);
 const incoming=[...s.incomes.filter(i=>i.confirmed&&i.date>=s.asOf).map(i=>({date:i.date,amountCents:i.amountCents})),...salaryEvents(s,p.endDate)].filter(i=>i.date<=p.minDate).reduce((n,i)=>n+i.amountCents,0);
 const lines=[`Seu saldo atual cadastrado é ${brl(p.balanceCents)}. O menor caixa projetado nos próximos 30 dias é ${brl(p.minCashCents)}, em ${date(p.minDate)}.`];
 if(p.minCashCents<0){
  lines.push(p.balanceCents<0?'O saldo cadastrado já está negativo. Confira os saldos em Meus dados → Minhas contas.':'O negativo é uma previsão de falta de dinheiro antes de cobrir os compromissos; não significa que sua conta bancária esteja negativa agora.');
  if(!(p.minDate===s.asOf&&p.minCashCents===p.balanceCents))lines.push(`Até esse ponto: ${brl(p.balanceCents)} de saldo + ${brl(incoming)} de entradas confirmadas até a data − ${brl(out)} de contas pendentes = ${brl(p.minCashCents)}.`);
  if(bills.length)lines.push('Compromissos considerados: '+bills.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,8).map(c=>`${c.name}: ${brl(c.amountCents)} (${date(c.dueDate)})`).join('; ')+(bills.length>8?`; e mais ${bills.length-8} compromisso(s).`:'.'));
  lines.push('Entradas futuras, incluindo cada parte do salário, só ajudam a partir da data prevista. A projeção compensa entradas e saídas da mesma data; confira o horário do crédito antes de pagar.');
 }
 lines.push(`Dinheiro livre: ${brl(p.minCashCents)} de menor caixa − ${brl(p.reservedCents)} de metas − ${brl(p.bufferCents)} de margem = ${brl(p.freeCents)}.`);
 if(p.minCashCents>=0&&p.freeCents<0)lines.push('O dinheiro livre ficou negativo porque as reservas de metas e a margem superam o menor caixa; o caixa projetado permanece não negativo.');
 if(p.freeCents<0)lines.push('Confira os valores e vencimentos em Meus dados. Registre contas já pagas e recebimentos já ocorridos; se os dados estiverem corretos, use E se? para comparar decisões antes de assumir outro gasto.');
 return {reply:lines.join('\n\n'),projection:p};
}
