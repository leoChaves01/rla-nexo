'use client';
import {createClient,SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|null=null;
let initialized:Promise<SupabaseClient|null>|null=null;
export function authClient(){
 if(!initialized)initialized=(async()=>{const r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)throw new Error('Não foi possível verificar o acesso. Recarregue a página.');const c=await r.json();if(!c.cloud)return null;if(!c.url||!c.key)throw new Error('O acesso online precisa ser configurado com o Supabase.');client=createClient(c.url,c.key);return client;})();
 return initialized;
}
export async function apiFetch(url:string,options:RequestInit={}){
 const c=await authClient();const headers=new Headers(options.headers);
 if(c){const {data,error}=await c.auth.getSession();if(error||!data.session)throw new Error('Sua sessão terminou. Entre novamente.');headers.set('Authorization','Bearer '+data.session.access_token);}
 return fetch(url,{...options,headers,cache:'no-store'});
}
