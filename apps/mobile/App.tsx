import React,{useState,useEffect} from 'react';
import {SafeAreaView,ScrollView,View,Text,TextInput,Pressable,StyleSheet,ActivityIndicator} from 'react-native';
const base=process.env.EXPO_PUBLIC_API_URL||'http://10.0.2.2:3000/api';
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
async function api(path:string,body?:unknown){
 const r=await fetch(base+'/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json();if(!r.ok)throw new Error(d.message||'Falha no serviço');return d;
}
export default function App(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('Conversa'),[message,setMessage]=useState('');
 const [messages,setMessages]=useState([{role:'Nexo',text:'Olá! Diga “Quero gastar 500” ou consulte seu dinheiro livre.'}]);
 const [value,setValue]=useState('500'),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[months,setMonths]=useState('1'),[result,setResult]=useState<any>(null);
 async function load(){try{setData(await api('dashboard'));setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer)},[]);
 async function send(){if(busy||!message.trim())return;const text=message;setMessage('');setBusy(true);setMessages(v=>[...v,{role:'Você',text}]);try{const r=await api('conversation',{message:text});setMessages(v=>[...v,{role:'Nexo',text:[r.reply,...(r.assessment?.alternatives||[])].join('\n')}])}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function simulate(){setBusy(true);setResult(null);try{
  if(!/^\d+(?:,\d{1,2})?$/.test(value))throw new Error('Use um valor como 500,00.');
  setResult(await api('scenarios',{amountCents:Math.round(Number(value.replace(',','.'))*100),date,months:Number(months),kind:'expense'}));setError('');
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled"><Text style={s.brand}>RLA nexo</Text><Text style={s.muted}>DEMONSTRAÇÃO · Dados fictícios</Text>{error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
 {data?<View style={s.balance}><Text style={s.white}>Dinheiro livre · próximos 30 dias</Text><Text style={s.amount}>{money(data.projection.freeCents)}</Text><Text style={s.white}>Contas, metas e margem consideradas.</Text></View>:<ActivityIndicator/>}
 <View style={s.tabs}>{['Conversa','E se?','Alertas'].map(t=><Pressable key={t} onPress={()=>setTab(t)} style={[s.tab,tab===t&&s.selected]}><Text>{t}</Text></Pressable>)}</View>
 {tab==='Conversa'&&<><Text style={s.title}>Converse com o Nexo</Text>{messages.map((m,i)=><View key={i} style={s.card}><Text style={s.muted}>{m.role}</Text><Text style={s.text}>{m.text}</Text></View>)}<TextInput accessibilityLabel="Mensagem" style={s.input} value={message} onChangeText={setMessage} placeholder="Quero gastar 500" maxLength={2000}/><Pressable disabled={busy} style={s.button} onPress={()=>void send()}><Text style={s.white}>{busy?'Analisando…':'Enviar'}</Text></Pressable></>}
 {tab==='E se?'&&<><Text style={s.title}>Simule um gasto</Text><Text>Valor em reais</Text><TextInput style={s.input} accessibilityLabel="Valor em reais" keyboardType="decimal-pad" value={value} onChangeText={v=>{setValue(v);setResult(null)}}/><Text>Data (AAAA-MM-DD)</Text><TextInput style={s.input} accessibilityLabel="Data" value={date} onChangeText={v=>{setDate(v);setResult(null)}}/><Text>Ocorrências mensais (1 a 12)</Text><TextInput style={s.input} accessibilityLabel="Ocorrências mensais" keyboardType="number-pad" value={months} onChangeText={v=>{setMonths(v);setResult(null)}}/><Pressable style={s.button} disabled={busy} onPress={()=>void simulate()}><Text style={s.white}>{busy?'Calculando…':'Simular'}</Text></Pressable>{result&&<View style={s.card}><Text style={s.title}>{result.status==='safe'?'Dentro do plano':'Atenção ao impacto'}</Text><Text>Dinheiro livre: {money(result.result.freeCents)}</Text>{result.assumptions.map((a:string)=><Text style={s.text} key={a}>{a}</Text>)}</View>}</>}
 {tab==='Alertas'&&<><Text style={s.title}>No seu radar</Text>{data?.alerts.map((a:any)=><View style={s.card} key={a.id}><Text>{a.message}</Text></View>)}<Text style={s.muted}>Alertas atualizados enquanto o aplicativo está aberto. Push não configurado.</Text></>}
 <Pressable onPress={()=>void load()} style={s.tab}><Text>↻ Atualizar</Text></Pressable></ScrollView></SafeAreaView>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#f3f6f5'},body:{padding:24,paddingTop:40},brand:{fontSize:30,fontWeight:'700',color:'#174d49'},muted:{color:'#75867e',fontSize:12,marginVertical:10},balance:{backgroundColor:'#174d49',padding:24,borderRadius:16,marginVertical:22},white:{color:'#fff'},amount:{fontSize:38,color:'#ccf8a5',marginVertical:14},tabs:{flexDirection:'row',gap:8,marginBottom:20},tab:{padding:12,borderRadius:8},selected:{backgroundColor:'#d9eade'},title:{fontSize:22,fontWeight:'600',color:'#274d40',marginBottom:16},card:{padding:18,borderRadius:12,backgroundColor:'#fff',marginBottom:12},text:{fontSize:16,lineHeight:24,marginVertical:6},input:{borderColor:'#cbdad1',borderWidth:1,borderRadius:8,padding:14,backgroundColor:'#fff',marginVertical:12,fontSize:16},button:{padding:16,backgroundColor:'#245d51',borderRadius:8,alignItems:'center',marginBottom:18},error:{backgroundColor:'#ffe7df',padding:15,color:'#8a3627'}});

