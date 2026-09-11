import { Injectable,OnModuleInit,OnModuleDestroy,ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { Snapshot,SnapshotSchema } from '@rla-nexo/engine';
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function emptySnapshot():Snapshot{return {asOf:today(),syncedAt:new Date().toISOString(),accounts:[],transactions:[],commitments:[],incomes:[],goals:[],bufferCents:0};}
export type State={snapshot:Snapshot;revision:number;consent:string};
@Injectable()
export class Repository implements OnModuleInit,OnModuleDestroy {
 private pool:Pool;
 readonly storage='postgresql';
 constructor(){
  if(!process.env.DATABASE_URL)throw new Error('Configure o banco com o iniciador RLA Nexo. DATABASE_URL é obrigatório.');
  this.pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
 }
 async onModuleInit(){
  await this.pool.query(`CREATE TABLE IF NOT EXISTS financial_state (
   user_id TEXT PRIMARY KEY,snapshot JSONB NOT NULL,consent TEXT NOT NULL,
   alerts JSONB NOT NULL DEFAULT '[]',revision INTEGER NOT NULL DEFAULT 0,updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await this.pool.query('ALTER TABLE financial_state ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0');
  await this.pool.query('INSERT INTO financial_state(user_id,snapshot,consent) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',['personal',JSON.stringify(emptySnapshot()),'revoked']);
  await this.pool.query(`CREATE TABLE IF NOT EXISTS conversation_history (
   id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await this.pool.query(`CREATE TABLE IF NOT EXISTS financial_revisions (
   id BIGSERIAL PRIMARY KEY,user_id TEXT NOT NULL,revision INTEGER NOT NULL,snapshot JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
 }
 async read():Promise<State>{
  const {rows}=await this.pool.query('SELECT snapshot,revision,consent FROM financial_state WHERE user_id=$1',['personal']);
  return {snapshot:SnapshotSchema.parse(rows[0].snapshot),revision:rows[0].revision,consent:rows[0].consent};
 }
 async update(revision:number,change:(snapshot:Snapshot)=>Snapshot):Promise<State>{
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   const {rows}=await client.query('SELECT snapshot,revision,consent FROM financial_state WHERE user_id=$1 FOR UPDATE',['personal']);
   const current=rows[0];
   if(current.revision!==revision)throw new ConflictException('Seus dados mudaram em outra tela. Recarregue antes de salvar.');
   const snapshot=SnapshotSchema.parse(change(SnapshotSchema.parse(current.snapshot)));
   snapshot.asOf=today();snapshot.syncedAt=new Date().toISOString();
   await client.query('INSERT INTO financial_revisions(user_id,revision,snapshot) VALUES ($1,$2,$3)',['personal',revision,current.snapshot]);
   await client.query('UPDATE financial_state SET snapshot=$1,revision=revision+1,updated_at=now() WHERE user_id=$2',[JSON.stringify(snapshot),'personal']);
   await client.query('COMMIT');
   return {snapshot,revision:revision+1,consent:current.consent};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 async history(){
  const {rows}=await this.pool.query('SELECT role,content AS text,created_at AS date FROM (SELECT * FROM conversation_history WHERE user_id=$1 ORDER BY id DESC LIMIT 100) recent ORDER BY id',['personal']);return rows;
 }
 async remember(message:string,reply:string){
  await this.pool.query('INSERT INTO conversation_history(user_id,role,content) VALUES ($1,$2,$3),($1,$4,$5)',['personal','user',message,'assistant',reply]);
 }
 async onModuleDestroy(){await this.pool.end();}
}

