import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module,Controller,Get,Post,Body,Injectable,BadRequestException,ConflictException,ServiceUnavailableException,OnModuleInit,OnModuleDestroy } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { assess,project,simulate,alerts,brl,ScenarioSchema } from '@rla-nexo/engine';
import { Repository,today } from './repository';
import { SaveSchema,SectionSchema,updateSection,RecordSchema,record } from './personal';
import { interpret } from './interpreter';
import { converse } from './conversation';
import { converseLocal } from './local-conversation';
import { explainBalance } from './explanation';
import {freeConversation} from './free-conversation';
export type FinanceRepository=Pick<Repository,'read'|'update'|'history'|'remember'> & {storage:string};
export class FinanceCore implements OnModuleInit,OnModuleDestroy{
 private timer?:NodeJS.Timeout;
 constructor(private readonly repo:FinanceRepository, private readonly cloud=false){}
 async onModuleInit(){this.timer=setInterval(()=>void this.refreshAlerts().catch(()=>console.error('Falha ao verificar alertas')),60000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async current(){const state=await this.repo.read();state.snapshot.asOf=today();return state;}
 async refreshAlerts(){return alerts((await this.current()).snapshot);}
 async dashboard(){const state=await this.current();return {...state,projection:project(state.snapshot),alerts:alerts(state.snapshot),
  provider:'manual',storage:this.repo.storage,demo:false,conversationMode:this.cloud?(process.env.FREE_AI_ENABLED==='true'&&process.env.GROQ_API_KEY?'groq':'local'):process.env.AI_PROVIDER==='ollama'?'ollama':process.env.OPENAI_API_KEY?'openai':'local'};}
 async save(body:unknown){
  const parsed=SaveSchema.safeParse(body);
  if(!parsed.success)throw new BadRequestException(parsed.error.issues.map(i=>i.message).slice(0,3).join('. '));
  await this.repo.update(parsed.data.revision,()=>parsed.data.snapshot);return this.dashboard();
 }
 async record(body:unknown){
  const parsed=RecordSchema.safeParse(body);if(!parsed.success)throw new BadRequestException('Lançamento inválido. Confira valor, data e conta.');
  try{await this.repo.update(parsed.data.revision,s=>record(s,parsed.data,today()));}
  catch(e){if(e instanceof ConflictException)throw e;throw new BadRequestException((e as Error).message);}
  return this.dashboard();
 }
 async section(body:unknown){
  const parsed=SectionSchema.safeParse(body);
  if(!parsed.success)throw new BadRequestException('Confira os campos desta seção: descrição, valor e data.');
  try{await this.repo.update(parsed.data.revision,s=>updateSection(s,parsed.data));}
  catch(e){
   if(e instanceof z.ZodError)throw new BadRequestException(e.issues.map(i=>i.message).slice(0,3).join('. '));
   throw e;
  }
  return this.dashboard();
 }
 async backup(){return {format:'rla-nexo-backup',version:1,exportedAt:new Date().toISOString(),snapshot:(await this.current()).snapshot};}
 async history(){return this.repo.history();}
 async scenario(body:unknown){
  const parsed=ScenarioSchema.safeParse(body);if(!parsed.success)throw new BadRequestException('Cenário inválido. Confira valor, data e ocorrências.');
  try{return simulate((await this.current()).snapshot,parsed.data);}catch(e){throw new BadRequestException((e as Error).message);}
 }
 async chat(body:unknown){
  const parsed=z.object({message:z.string().trim().min(1).max(2000)}).strict().safeParse(body);
  if(!parsed.success)throw new BadRequestException('Envie uma mensagem de até 2.000 caracteres.');
  if(this.cloud){const response=await freeConversation(parsed.data.message,(await this.current()).snapshot,await this.repo.history());await this.repo.remember(parsed.data.message,response.reply);return response;}
  if(process.env.AI_PROVIDER==='ollama'||process.env.OPENAI_API_KEY){
   try{const response=await (process.env.AI_PROVIDER==='ollama'?converseLocal:converse)(parsed.data.message,(await this.current()).snapshot,await this.repo.history());await this.repo.remember(parsed.data.message,response.reply);return response;}
   catch(e){throw new ServiceUnavailableException((e as Error).message||'A IA está indisponível.');}
  }
  let interpretation;
  try{interpretation=await interpret(parsed.data.message);}catch{throw new ServiceUnavailableException('Não foi possível interpretar. Use o simulador ou tente novamente.');}
  const {intent,mode}=interpretation;const {snapshot}=await this.current();
  let response:any;
  if(!snapshot.accounts.length)response={mode,reply:'Antes de avaliar um gasto, cadastre seu saldo, salário e compromissos em Meus dados.'};
  else if(intent.action==='clarify')response={mode,reply:'A conversa com IA ainda não está ativada: falta configurar a chave OpenAI. No modo local, posso explicar seu saldo e avaliar pedidos como “Quero gastar 500”. Para hipóteses, use E se?.'};
  else if(intent.action==='balance'){
   response={mode,...explainBalance(snapshot)};
  }else{
   const assessment=assess(snapshot,intent.amountCents!);
   response={mode,reply:assessment.explanation+' Após gastar '+brl(assessment.amountCents)+', o dinheiro livre projetado fica em '+brl(assessment.after.freeCents)+'.',assessment,
    warning:Date.now()-Date.parse(snapshot.syncedAt)>86400000?'Confira se seus saldos e compromissos estão atualizados.':null};
  }
  await this.repo.remember(parsed.data.message,[response.reply,response.warning,...(response.assessment?.alternatives||[])].filter(Boolean).join('\n'));
  return response;
 }
}
