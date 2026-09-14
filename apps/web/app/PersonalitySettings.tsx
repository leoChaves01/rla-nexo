'use client';
import {useEffect,useState} from 'react';

export type Personality='friendly'|'direct'|'calm'|'analytical'|'adaptive';
export type UiPreferences={nexoPersonality:Personality;responseLength:'short'|'standard'|'detailed';useEmojis:boolean};
const options:{id:Personality;name:string;description:string;preview:string}[]=[
 {id:'friendly',name:'Amigo',description:'Conversa com você de forma próxima, simples e natural.',preview:'Eu seguraria esse gasto agora. Você tem R$ 680 livres e R$ 1.400 em compromissos. Se reduzir o valor, fica bem mais tranquilo.'},
 {id:'direct',name:'Direto',description:'Vai direto ao ponto, sem enrolação.',preview:'Eu evitaria esse gasto agora. Você tem R$ 680 livres e R$ 1.400 em compromissos futuros.'},
 {id:'calm',name:'Calmo',description:'Explica suas finanças com calma e sem pressão.',preview:'Esse gasto deixaria sua margem negativa. Como ainda existem R$ 1.400 em compromissos, vale reduzir o valor ou esperar uma entrada.'},
 {id:'analytical',name:'Analítico',description:'Mostra mais números, detalhes e comparações.',preview:'Dinheiro livre: R$ 680 antes e -R$ 320 depois do gasto de R$ 1.000. Compromissos futuros: R$ 1.400. Classificação: arriscado.'},
 {id:'adaptive',name:'Adaptativo',description:'O Nexo adapta o jeito de falar ao seu estilo.',preview:'Eu seguraria essa agora. Esse gasto levaria seus R$ 680 livres para -R$ 320, e ainda há R$ 1.400 em compromissos.'}
];

export default function PersonalitySettings({initial,onSave}:{initial:UiPreferences;onSave:(value:UiPreferences)=>Promise<void>}){
 const [draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 useEffect(()=>setDraft(initial),[initial]);
 const selected=options.find(o=>o.id===draft.nexoPersonality)!;
 async function save(){setBusy(true);setError('');setNotice('');try{await onSave(draft);setNotice('Personalidade salva. A próxima resposta já usará este estilo.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="personalization">
  <section className="panel personalization-head"><span className="eyebrow">CONFIGURAÇÕES · PERSONALIZAÇÃO</span><h2>Como você quer que o Nexo fale com você?</h2><p>A escolha muda somente a forma de explicar. Os cálculos, riscos e recomendações continuam vindo do mesmo motor financeiro.</p></section>
  <div className="personality-layout">
   <section className="personality-cards" role="radiogroup" aria-label="Personalidade do Nexo">{options.map(option=><button type="button" role="radio" aria-checked={draft.nexoPersonality===option.id} className={'personality-card panel '+(draft.nexoPersonality===option.id?'selected':'')} key={option.id} onClick={()=>{setDraft(v=>({...v,nexoPersonality:option.id}));setNotice('');}}><span className="personality-check">{draft.nexoPersonality===option.id?'✓':''}</span><strong>{option.name}</strong><p>{option.description}</p><small>Prévia</small><blockquote>{option.preview}</blockquote></button>)}</section>
   <aside className="panel personality-preview" aria-live="polite"><span className="eyebrow">PRÉ-VISUALIZAÇÃO INSTANTÂNEA</span><h2>{selected.name}</h2><div className="preview-question"><small>VOCÊ</small><p>Quero gastar R$ 1.000.</p></div><div className="preview-answer"><small>NEXO</small><p>{selected.preview}</p></div><dl><div><dt>Dinheiro livre</dt><dd>R$ 680</dd></div><div><dt>Compromissos futuros</dt><dd>R$ 1.400</dd></div></dl><p className="preview-note">Cenário fictício usado igualmente em todos os estilos.</p></aside>
  </div>
  <section className="panel preference-details"><h2>Ajustes de resposta</h2><label>Tamanho<select value={draft.responseLength} onChange={e=>setDraft(v=>({...v,responseLength:e.target.value as UiPreferences['responseLength']}))}><option value="short">Curto</option><option value="standard">Equilibrado</option><option value="detailed">Detalhado</option></select></label><label className="check"><input type="checkbox" checked={draft.useEmojis} onChange={e=>setDraft(v=>({...v,useEmojis:e.target.checked}))}/> Permitir um emoji discreto quando combinar</label><button className="primary" disabled={busy} onClick={()=>void save()}>{busy?'Salvando…':'Salvar personalização'}</button>{notice&&<p className="saved-message" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}</section>
 </div>;
}
