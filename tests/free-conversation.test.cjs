const {test}=require('node:test');const assert=require('node:assert/strict');
const {freeConversation}=require('../apps/api/dist/free-conversation');
const {demoSnapshot,assess}=require('../packages/engine/dist');
test('cloud: saldo e gastos não chamam provedores pagos ou IA',async()=>{
 const s=demoSnapshot('2026-09-11');const no=async()=>{throw new Error('unexpected network');};
 const r=await freeConversation('Quero gastar 50',s,[],no);assert.equal(r.assessment.amountCents,5000);assert.equal(r.assessment.after.freeCents,assess(s,5000).after.freeCents);
 assert.ok((await freeConversation('Dinheiro livre',s,[],no)).reply);
});
test('cloud: interpretação usa reais, não envia cadastros e quota tem fallback',async()=>{
 const key=process.env.GROQ_API_KEY,enabled=process.env.FREE_AI_ENABLED;process.env.GROQ_API_KEY='fake-test';process.env.FREE_AI_ENABLED='true';
 try{const s=demoSnapshot('2026-09-11');s.accounts[0].name='PRIVATE_ACCOUNT';
 const r=await freeConversation('posso comprar um item de cinquenta reais hoje?',s,[],async(url,o)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.ok(!o.body.includes('PRIVATE_ACCOUNT'));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({action:'spend',value:'50,00',date:null,months:null,kind:null})}}]}));});assert.equal(r.assessment.amountCents,5000);
 const limited=await freeConversation('me ajude',s,[],async()=>new Response('',{status:429}));assert.equal(limited.mode,'guided');assert.match(limited.reply,/cota gratuita/);
 const invalid=await freeConversation('me ajude',s,[],async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]})));assert.equal(invalid.mode,'guided');
 }finally{if(key===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=key;if(enabled===undefined)delete process.env.FREE_AI_ENABLED;else process.env.FREE_AI_ENABLED=enabled;}
});
test('cloud: responde perguntas conceituais sem pedir um valor de gasto',async()=>{
 const s=demoSnapshot('2026-09-11');
 const direct=await freeConversation('o que seria os compromissos',s,[],async()=>{throw new Error('não deve chamar a rede')});
 assert.match(direct.reply,/contas, faturas e parcelas/i);
 const key=process.env.GROQ_API_KEY,enabled=process.env.FREE_AI_ENABLED;process.env.GROQ_API_KEY='fake-test';process.env.FREE_AI_ENABLED='true';
 try{
  const explained=await freeConversation('por que é importante ter uma reserva?',s,[],async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({action:'explain',value:null,date:null,months:null,kind:null,reply:'Uma reserva ajuda a absorver imprevistos sem comprometer as contas já planejadas.'})}}]})));
  assert.equal(explained.mode,'groq');assert.match(explained.reply,/imprevistos/);
  const clarified=await freeConversation('quero simular uma compra',s,[],async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({action:'clarify',value:null,date:null,months:null,kind:'expense',reply:'Qual é o valor e em que data você pretende comprar?'})}}]})));
  assert.match(clarified.reply,/Qual é o valor/);
 }finally{if(key===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=key;if(enabled===undefined)delete process.env.FREE_AI_ENABLED;else process.env.FREE_AI_ENABLED=enabled;}
});
