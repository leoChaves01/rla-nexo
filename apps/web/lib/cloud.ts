import {createClient, SupabaseClient} from '@supabase/supabase-js';
import {Snapshot,SnapshotSchema} from '@rla-nexo/engine';
import {ConflictException,ServiceUnavailableException} from '@nestjs/common';
import {emptySnapshot,today} from '../../api/dist/repository';
import {AssistantPreferences,DEFAULT_PREFERENCES,normalizePreferences} from '../../api/dist/personality';
export const isCloud=()=>process.env.NEXO_CLOUD==='true'||process.env.VERCEL==='1';
export function publicConfig(){
 const cloud=isCloud();let key=process.env.SUPABASE_ANON_KEY||'';
 // Never return a privileged key, even if the operator pastes it into the wrong field.
 if(!key.startsWith('sb_publishable_')){try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role!=='anon')key='';}catch{key='';}}
 return {cloud,url:cloud?process.env.SUPABASE_URL||'':'',key:cloud?key:''};
}
export async function authenticatedClient(token:string){
 const c=publicConfig();if(!c.url||!c.key)throw new ServiceUnavailableException('Configure o Supabase para ativar o acesso online.');
 const client=createClient(c.url,c.key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user)return null;
 return client;
}
export class CloudRepository {
 readonly storage='supabase';
 constructor(private client:SupabaseClient,private token=''){}
 async read(){const {data,error}=await this.client.rpc('nexo_read',{initial_snapshot:emptySnapshot()});if(error)throw new ServiceUnavailableException('Não foi possível carregar seus dados. Confira a configuração do banco.');return {snapshot:SnapshotSchema.parse(data.snapshot),revision:data.revision,consent:'revoked'};}
 async update(revision:number,change:(s:Snapshot)=>Snapshot){
  const current=await this.read();if(current.revision!==revision)throw new ConflictException('Seus dados mudaram em outra tela. Recarregue antes de salvar.');
  const snapshot=SnapshotSchema.parse(change(current.snapshot));snapshot.asOf=today();snapshot.syncedAt=new Date().toISOString();
  const {error}=await this.client.rpc('nexo_save',{expected_revision:revision,new_snapshot:snapshot});
  if(error?.code==='40001')throw new ConflictException('Seus dados mudaram em outra tela. Recarregue antes de salvar.');
  if(error)throw new ServiceUnavailableException('Não foi possível salvar. Seus dados anteriores foram preservados.');
  return {snapshot,revision:revision+1,consent:'revoked'};
 }
 async history(){const {data,error}=await this.client.from('nexo_messages').select('role,text,created_at').order('id',{ascending:false}).limit(100);if(error)throw new ServiceUnavailableException('Não foi possível carregar a conversa.');return (data||[]).reverse().map(m=>({role:m.role,text:m.text,date:m.created_at}));}
 async remember(message:string,reply:string){const {error}=await this.client.rpc('nexo_remember',{user_text:message,assistant_text:reply});if(error)throw new ServiceUnavailableException('Não foi possível salvar a conversa.');}
 async allowChat(){const {data,error}=await this.client.rpc('nexo_chat_allow');return !error&&data===true;}
 private async profilePreferences(){if(!this.token)return DEFAULT_PREFERENCES;const {data}=await this.client.auth.getUser(this.token);return normalizePreferences(data.user?.user_metadata?.nexo_preferences);}
 private async saveProfilePreferences(value:AssistantPreferences){if(!this.token)return false;const c=publicConfig(),response=await fetch(c.url+'/auth/v1/user',{method:'PUT',headers:{Authorization:'Bearer '+this.token,apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({data:{nexo_preferences:value}})});return response.ok;}
 async preferences():Promise<AssistantPreferences>{const {data,error}=await this.client.rpc('nexo_preferences_read');if(error&&['PGRST202','42883'].includes(error.code||''))return this.profilePreferences();if(error)throw new ServiceUnavailableException('Não foi possível carregar a personalização.');if(data?.exists===false)return this.profilePreferences();return data?normalizePreferences({nexoPersonality:data.nexo_personality,responseLength:data.response_length,useEmojis:data.use_emojis}):this.profilePreferences();}
 async savePreferences(value:AssistantPreferences){const {error}=await this.client.rpc('nexo_preferences_save',{personality:value.nexoPersonality,response_length:value.responseLength,use_emojis:value.useEmojis});const missing=error&&['PGRST202','42883'].includes(error.code||'');if(error&&!missing)throw new ServiceUnavailableException('Não foi possível salvar a personalização.');const profileSaved=await this.saveProfilePreferences(value);if(missing&&!profileSaved)throw new ServiceUnavailableException('Não foi possível salvar a personalização.');return value;}
}
