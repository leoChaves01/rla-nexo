import {z} from 'zod';

export const PersonalitySchema=z.enum(['friendly','direct','calm','analytical','adaptive']);
export type NexoPersonality=z.infer<typeof PersonalitySchema>;
export const PreferencesSchema=z.object({
 nexoPersonality:PersonalitySchema.default('friendly'),
 responseLength:z.enum(['short','standard','detailed']).default('standard'),
 useEmojis:z.boolean().default(false)
}).strict();
export type AssistantPreferences=z.infer<typeof PreferencesSchema>;
export const DEFAULT_PREFERENCES:AssistantPreferences={nexoPersonality:'friendly',responseLength:'standard',useEmojis:false};

export function normalizePreferences(value:unknown):AssistantPreferences{
 const parsed=PreferencesSchema.safeParse(value);return parsed.success?parsed.data:DEFAULT_PREFERENCES;
}

export const BASE_SYSTEM_PROMPT=`Você é Nexo, um assistente financeiro pessoal.
Sua função é ajudar o usuário a entender sua vida financeira e tomar decisões melhores.
Nunca julgue o usuário. Nunca invente saldo, transações, metas, dívidas, compromissos, valores ou datas.
Todo cálculo financeiro vem do Financial Engine. Não faça cálculos financeiros por conta própria quando existir um resultado do motor.
Interprete os dados e explique os resultados. Nunca bloqueie uma decisão: aconselhe e explique as consequências.
Quando um gasto for arriscado, explique o motivo, mostre o impacto e ofereça uma alternativa quando possível.
Quando faltar informação, faça uma pergunta natural. Nunca mande o usuário usar comandos disponíveis.
O usuário pode conversar livremente em linguagem natural.
O resultado estruturado do Financial Engine é imutável. Não mude risco, conclusão, valores, datas ou alternativas.`;

const instructions:Record<NexoPersonality,string>={
 friendly:'PERSONALIDADE ATUAL: FRIENDLY. Fale de maneira próxima, natural e simples. Pode ser levemente informal quando combinar com o usuário. Não force gírias, não seja infantil e não use tom corporativo. Seja firme quando houver risco, sem julgar.',
 direct:'PERSONALIDADE ATUAL: DIRECT. Comece pela conclusão. Responda de forma curta e objetiva. Depois mostre somente os números essenciais.',
 calm:'PERSONALIDADE ATUAL: CALM. Use linguagem tranquila e sem pressão. Explique riscos sem alarmismo e ajude o usuário a entender a situação.',
 analytical:'PERSONALIDADE ATUAL: ANALYTICAL. Priorize os números fornecidos pelo motor, comparações antes e depois e percentuais somente quando constarem no resultado. Explique a lógica sem excesso de informação.',
 adaptive:'PERSONALIDADE ATUAL: ADAPTIVE. Ajuste levemente formalidade, tamanho e linguagem ao estilo do usuário. Não imite erros de português nem exagere em gírias. Preserve integralmente as regras e resultados financeiros.'
};

export function personalityPrompt(preferences:AssistantPreferences){
 const length={short:'Use no máximo 2 frases.',standard:'Responda de forma concisa, normalmente em até 5 frases.',detailed:'Explique com detalhes úteis, sem repetir informações.'}[preferences.responseLength];
 return `${instructions[preferences.nexoPersonality]} ${length} ${preferences.useEmojis?'Pode usar no máximo um emoji discreto quando combinar com a mensagem.':'Não use emojis.'}`;
}

type AssessmentLike={status:string;amountCents:number;limitCents:number;before:{freeCents:number;commitmentsCents:number};after:{freeCents:number};explanation:string;alternatives:string[];requestedPercentOfFree?:number|null};
const brl=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export function assessmentFacts(a:AssessmentLike){return {
 type:'spend_assessment',risk:a.status,requestedExpense:brl(a.amountCents),freeMoneyBefore:brl(a.before.freeCents),freeMoneyAfter:brl(a.after.freeCents),futureCommitments:brl(a.before.commitmentsCents),safeAmount:brl(a.limitCents),requestedPercentOfFree:a.requestedPercentOfFree??null,conclusion:a.explanation,alternatives:a.alternatives
};}

export function personalityFallback(a:AssessmentLike,p:AssistantPreferences,userText=''){
 const requested=brl(a.amountCents),before=brl(a.before.freeCents),after=brl(a.after.freeCents),safe=brl(a.limitCents),commitments=brl(a.before.commitmentsCents);
 const risky=a.status!=='safe';
 switch(p.nexoPersonality){
  case 'direct':return risky?`Eu evitaria esse gasto agora. Você tem ${before} livres, ${commitments} em compromissos e ficaria com ${after}. Um valor mais seguro seria até ${safe}.`:`Esse gasto cabe no plano. Depois de gastar ${requested}, você ainda fica com ${after} livres.`;
  case 'calm':return risky?`Esse gasto reduziria seu dinheiro livre de ${before} para ${after}. Como ainda existem ${commitments} em compromissos, vale esperar uma entrada ou reduzir o valor para até ${safe}.`:`Esse gasto é possível e mantém suas contas protegidas. Depois dele, o dinheiro livre fica em ${after}.`;
  case 'analytical':return `Classificação: ${a.status==='safe'?'seguro':'arriscado'}. Dinheiro livre: ${before} antes e ${after} depois do gasto de ${requested}. Compromissos futuros: ${commitments}. Limite atual calculado pelo motor: ${safe}${a.requestedPercentOfFree!=null?`. O gasto equivale a ${a.requestedPercentOfFree.toLocaleString('pt-BR')}% do dinheiro livre`:''}.`;
  case 'adaptive':{
   const informal=/\b(mano|da pra|dá pra|hj|tipo|vei|véi|cara)\b/i.test(userText);
   if(risky)return informal?`Eu seguraria essa agora. O gasto levaria seu dinheiro livre de ${before} para ${after}; até ${safe} fica mais tranquilo.`:`Eu evitaria esse gasto neste momento. Ele reduziria seu dinheiro livre de ${before} para ${after}; o limite calculado é ${safe}.`;
   return informal?`Dá sim. Depois desse gasto você ainda fica com ${after} livres e as contas continuam cobertas.`:`Sim. Esse gasto mantém as contas cobertas e deixa ${after} de dinheiro livre.`;
  }
  default:return risky?`Eu seguraria esse gasto agora. Seu dinheiro livre iria de ${before} para ${after}, com ${commitments} em compromissos. Se puder reduzir para até ${safe}, fica bem mais tranquilo.`:`Esse gasto cabe no seu plano. Depois de usar ${requested}, ainda ficam ${after} livres e suas contas continuam cobertas.`;
 }
}

export function hasOnlyEngineMoney(text:string,facts:unknown){
 const allowed=new Set((JSON.stringify(facts).match(/R\$\s*[\d.]+,\d{2}/g)||[]).map(v=>v.replace(/\s/g,'')));
 const used=(text.match(/R\$\s*[\d.]+,\d{2}/g)||[]).map(v=>v.replace(/\s/g,''));
 return used.every(v=>allowed.has(v));
}
