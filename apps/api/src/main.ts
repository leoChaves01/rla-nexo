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
import { FinanceCore } from './finance';
@Injectable()
class FinanceService extends FinanceCore { constructor(repo:Repository){super(repo);} }
@Controller()
class ApiController{
 constructor(private readonly finance:FinanceService){}
 @Get('health')health(){return {status:'ok',name:'RLA Nexo',version:'1.0.0'};}
 @Get('dashboard')dashboard(){return this.finance.dashboard();}
 @Post('personal/save')save(@Body()b:unknown){return this.finance.save(b);}
 @Post('personal/section')section(@Body()b:unknown){return this.finance.section(b);}
 @Post('personal/record')record(@Body()b:unknown){return this.finance.record(b);}
 @Get('personal/backup')backup(){return this.finance.backup();}
 @Get('conversation/history')history(){return this.finance.history();}
 @Get('preferences')preferences(){return this.finance.getPreferences();}
 @Post('preferences')savePreferences(@Body()b:unknown){return this.finance.savePreferences(b);}
 @Post('conversation')chat(@Body()b:unknown){return this.finance.chat(b);}
 @Post('scenarios')scenario(@Body()b:unknown){return this.finance.scenario(b);}
 @Get('alerts')alerts(){return this.finance.refreshAlerts();}
 @Post('open-finance/sync')sync(){throw new BadRequestException('A conexão bancária automática ainda não está configurada. Seus dados pessoais foram preservados.');}
}
@Module({controllers:[ApiController],providers:[Repository,FinanceService]})class AppModule{}
async function bootstrap(){
 const host=process.env.HOST||'127.0.0.1',token=process.env.API_TOKEN;
 if(!token||token.length<32)throw new Error('API_TOKEN deve ter pelo menos 32 caracteres.');
 const app=await NestFactory.create(AppModule,{bodyParser:false});
 const express=require('express');app.use(express.json({limit:'2mb'}));
 const limits=new Map<string,{count:number;until:number}>();
 app.use((req:any,res:any,next:any)=>{
  const now=Date.now(),key=req.ip||'local';for(const [k,v]of limits)if(v.until<now)limits.delete(k);
  const limit=limits.get(key)||{count:0,until:now+60000};limit.count++;limits.set(key,limit);
  if(limit.count>120)return res.status(429).json({message:'Aguarde um minuto.'});
  if(req.path!=='/health'){
   const incoming=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
   if(incoming.length!==expected.length||!timingSafeEqual(incoming,expected))return res.status(401).json({message:'Não autorizado'});
  }
  next();
 });
 app.enableShutdownHooks();await app.listen(Number(process.env.PORT)||4000,host);
}
void bootstrap();
