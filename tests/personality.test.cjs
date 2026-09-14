const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {demoSnapshot,assess}=require('../packages/engine/dist');
const {freeConversation}=require('../apps/api/dist/free-conversation');
const {FinanceCore}=require('../apps/api/dist/finance');
const {DEFAULT_PREFERENCES,normalizePreferences,personalityFallback,personalityPrompt,hasOnlyEngineMoney}=require('../apps/api/dist/personality');

const root=path.resolve(__dirname,'..');
const pref=(nexoPersonality,extra={})=>({nexoPersonality,responseLength:'standard',useEmojis:false,...extra});
function withoutOnlineAi(fn){
 const names=['FREE_AI_ENABLED','GEMINI_API_KEY','GROQ_API_KEY'],old=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 names.forEach(n=>delete process.env[n]);
 return Promise.resolve().then(fn).finally(()=>names.forEach(n=>old[n]===undefined?delete process.env[n]:process.env[n]=old[n]));
}

test('personalidade padrão e fallback inválido são Friendly',()=>{
 assert.deepEqual(DEFAULT_PREFERENCES,{nexoPersonality:'friendly',responseLength:'standard',useEmojis:false});
 assert.deepEqual(normalizePreferences(undefined),DEFAULT_PREFERENCES);
 assert.deepEqual(normalizePreferences({nexoPersonality:'unknown'}),DEFAULT_PREFERENCES);
});

test('os cinco modos mudam a linguagem, não o resultado do Financial Engine',async()=>withoutOnlineAi(async()=>{
 const snapshot=demoSnapshot('2026-09-11'),expected=assess(snapshot,5000),results=[];
 for(const personality of ['friendly','direct','calm','analytical','adaptive']){
  const response=await freeConversation('Quero gastar 50 hoje',snapshot,[],async()=>{throw new Error('rede inesperada')},pref(personality));
  assert.deepEqual(response.assessment,expected);
  results.push(response.reply);
 }
 assert.equal(new Set(results).size,5);
 assert.match(results[1],/evitaria|cabe/i);
 assert.match(results[2],/vale|possível|mantém/i);
 assert.match(results[3],/Classificação:|Dinheiro livre:/i);
}));

test('Adaptive acompanha formalidade sem copiar erro de português',()=>{
 const a=assess(demoSnapshot('2026-09-11'),5000);
 const informal=personalityFallback(a,pref('adaptive'),'mano da pra gastar 50 hj?');
 const formal=personalityFallback(a,pref('adaptive'),'Seria seguro realizar uma compra?');
 assert.notEqual(informal,formal);assert.doesNotMatch(informal,/\bhj\b|\bda pra\b/i);
});

test('validador impede que a IA invente valores',()=>{
 const facts={freeMoney:'R$ 680,00',risk:'RISKY'};
 assert.equal(hasOnlyEngineMoney('Você tem R$ 680,00 livres.',facts),true);
 assert.equal(hasOnlyEngineMoney('Você tem R$ 999,00 livres.',facts),false);
});

test('preferência persiste, aplica na mensagem seguinte e não apaga contexto',async()=>withoutOnlineAi(async()=>{
 const snapshot=demoSnapshot('2026-09-11');let saved,history=[{role:'user',text:'quero comprar um tênis de 1200',date:'2026-09-11'}];
 const repo={storage:'test',read:async()=>({snapshot:structuredClone(snapshot),revision:0}),update:async()=>{},history:async()=>structuredClone(history),remember:async(q,a)=>history.push({role:'user',text:q},{role:'assistant',text:a}),preferences:async()=>saved,savePreferences:async v=>(saved=v)};
 const first=new FinanceCore(repo,true);assert.equal((await first.getPreferences()).nexoPersonality,'friendly');
 await first.savePreferences(pref('analytical'));
 const relogin=new FinanceCore(repo,true);assert.equal((await relogin.getPreferences()).nexoPersonality,'analytical');
 assert.equal((await repo.history())[0].text,'quero comprar um tênis de 1200');
 const answer=await relogin.chat({message:'Quero gastar 50'});assert.match(answer.reply,/Classificação:|Dinheiro livre:/i);
 assert.equal((await repo.history())[0].text,'quero comprar um tênis de 1200');
}));

test('tool calling usa o motor e injeta a personalidade atual',async()=>{
 const old={enabled:process.env.FREE_AI_ENABLED,key:process.env.GROQ_API_KEY};process.env.FREE_AI_ENABLED='true';process.env.GROQ_API_KEY='test';
 try{
  const bodies=[];
  const request=async(_url,options)=>{const body=JSON.parse(options.body);bodies.push(body);const interpreting=Boolean(body.response_format);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:interpreting?JSON.stringify({action:'spend',value:'50,00',date:null,months:null,kind:null}):'Eu evitaria esse gasto agora.'}}]}));};
  const r=await freeConversation('posso comprar um item de cinquenta reais hoje?',demoSnapshot('2026-09-11'),[{role:'user',text:'estávamos falando de um tênis'}],request,pref('direct'));
  assert.equal(r.assessment.amountCents,5000);assert.equal(bodies.length,2);
  assert.match(bodies[1].messages[0].content,/PERSONALIDADE ATUAL: DIRECT/);
  assert.match(bodies[1].messages.at(-1).content,/Resultado imutável do Financial Engine/);
  assert.ok(bodies[0].messages.some(m=>m.content==='estávamos falando de um tênis'));
 }finally{old.enabled===undefined?delete process.env.FREE_AI_ENABLED:process.env.FREE_AI_ENABLED=old.enabled;old.key===undefined?delete process.env.GROQ_API_KEY:process.env.GROQ_API_KEY=old.key;}
});

test('resposta com valor inventado cai no texto determinístico',async()=>{
 const old={enabled:process.env.FREE_AI_ENABLED,key:process.env.GROQ_API_KEY};process.env.FREE_AI_ENABLED='true';process.env.GROQ_API_KEY='test';
 try{
  const request=async(_url,options)=>{const body=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:body.response_format?JSON.stringify({action:'spend',value:'50,00',date:null,months:null,kind:null}):'Você terá R$ 999,00 livres.'}}]}));};
  const r=await freeConversation('posso comprar um item de cinquenta reais hoje?',demoSnapshot('2026-09-11'),[],request,pref('friendly'));
  assert.doesNotMatch(r.reply,/999/);assert.equal(r.assessment.amountCents,5000);
 }finally{old.enabled===undefined?delete process.env.FREE_AI_ENABLED:process.env.FREE_AI_ENABLED=old.enabled;old.key===undefined?delete process.env.GROQ_API_KEY:process.env.GROQ_API_KEY=old.key;}
});

test('banco e API isolam preferências pelo usuário autenticado',()=>{
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20260914_assistant_personality.sql'),'utf8');
 const cloud=fs.readFileSync(path.join(root,'apps/web/lib/cloud.ts'),'utf8');
 assert.match(sql,/enable row level security/i);assert.match(sql,/user_id\s*=\s*\(select auth\.uid\(\)\)/i);
 assert.match(sql,/nexo_preferences_save/);assert.doesNotMatch(cloud,/savePreferences\([^)]*userId/i);
});

test('interface oferece cards, prévia e os cinco modos',()=>{
 const ui=fs.readFileSync(path.join(root,'apps/web/app/PersonalitySettings.tsx'),'utf8');
 for(const name of ['friendly','direct','calm','analytical','adaptive'])assert.match(ui,new RegExp("id:'"+name+"'"));
 assert.match(ui,/PRÉ-VISUALIZAÇÃO INSTANTÂNEA/);assert.match(ui,/Quero gastar R\$ 1\.000/);
});

test('prompts de todos os modos reafirmam somente estilo',()=>{
 for(const personality of ['friendly','direct','calm','analytical','adaptive'])assert.match(personalityPrompt(pref(personality)),new RegExp('PERSONALIDADE ATUAL: '+personality.toUpperCase()));
});
