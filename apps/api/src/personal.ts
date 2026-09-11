import { z } from 'zod';
import { SnapshotSchema,cents,dateOnly,Snapshot,salaryDate } from '@rla-nexo/engine';
export const Revision=z.number().int().min(0);
export const SectionSchema=z.discriminatedUnion('section',[
 z.object({revision:Revision,section:z.literal('accounts'),value:SnapshotSchema.shape.accounts}).strict(),
 z.object({revision:Revision,section:z.literal('salary'),value:SnapshotSchema.shape.salary}).strict(),
 z.object({revision:Revision,section:z.literal('commitments'),value:SnapshotSchema.shape.commitments}).strict(),
 z.object({revision:Revision,section:z.literal('incomes'),value:SnapshotSchema.shape.incomes}).strict(),
 z.object({revision:Revision,section:z.literal('planning'),value:z.object({goals:SnapshotSchema.shape.goals,bufferCents:SnapshotSchema.shape.bufferCents}).strict()}).strict()
]);
export function updateSection(snapshot:Snapshot,input:z.infer<typeof SectionSchema>):Snapshot{
 switch(input.section){
  case 'accounts':snapshot.accounts=input.value;
   if(snapshot.salary?.accountId&&!snapshot.accounts.some(a=>a.id===snapshot.salary!.accountId))snapshot.salary.accountId='';
   break;
  case 'salary':snapshot.salary=input.value;break;
  case 'commitments':snapshot.commitments=input.value;break;
  case 'incomes':snapshot.incomes=input.value;break;
  case 'planning':snapshot.goals=input.value.goals;snapshot.bufferCents=input.value.bufferCents;break;
 }
 return SaveSchema.parse({revision:input.revision,snapshot}).snapshot;
}
export const SaveSchema=z.object({revision:Revision,snapshot:SnapshotSchema}).strict().superRefine((value,ctx)=>{
 for(const key of ['accounts','transactions','commitments','incomes','goals'] as const){
  const ids=new Set<string>();
  for(const row of value.snapshot[key]){
   if(!row.id||row.id.length>100||ids.has(row.id))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Identificadores inválidos ou duplicados'});
   ids.add(row.id);const name='name' in row?row.name:row.description;
   if(!name.trim()||name.length>160)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Use nomes entre 1 e 160 caracteres'});
  }
 }
 if(value.snapshot.salary?.accountId && !value.snapshot.accounts.some(a=>a.id===value.snapshot.salary!.accountId))
  ctx.addIssue({code:z.ZodIssueCode.custom,message:'Escolha a conta de destino do salário'});
});
export const RecordSchema=z.object({revision:Revision,accountId:z.string().min(1).max(100),
 kind:z.enum(['expense','income']),amountCents:cents.refine(v=>v>0),
 description:z.string().trim().min(1).max(160),date:dateOnly,
 commitmentId:z.string().optional(),incomeId:z.string().optional(),salary:z.boolean().optional(),salaryPartId:z.string().optional()}).strict();
export function record(snapshot:Snapshot,input:z.infer<typeof RecordSchema>,today:string):Snapshot{
 if(input.date>today)throw new Error('Para datas futuras, cadastre uma conta a pagar ou uma receita prevista.');
 const account=snapshot.accounts.find(a=>a.id===input.accountId);
 if(!account)throw new Error('Escolha uma conta válida.');
 if(input.salaryPartId&&!input.salary)throw new Error('Selecione um recebimento de salário.');
 if([input.commitmentId,input.incomeId,input.salary].filter(Boolean).length>1)throw new Error('Escolha somente uma origem.');
 if(input.commitmentId){
  const bill=snapshot.commitments.find(c=>c.id===input.commitmentId);
  if(!bill||bill.status!=='pending')throw new Error('Esta conta já foi paga ou não existe.');
  if(input.kind!=='expense'||input.amountCents!==bill.amountCents)throw new Error('O valor deve corresponder à conta pendente.');
  bill.status='paid';
 }
 if(input.incomeId){
  const income=snapshot.incomes.find(i=>i.id===input.incomeId);
  if(!income||input.kind!=='income'||input.amountCents!==income.amountCents)throw new Error('Receita inválida ou já recebida.');
  snapshot.incomes=snapshot.incomes.filter(i=>i.id!==input.incomeId);
 }
 if(input.salary){
  const salary=snapshot.salary;
  const part=salary?.parts?salary.parts.find(p=>p.id===input.salaryPartId):salary;
  if(!salary||!part||(!salary.parts&&input.salaryPartId)||input.kind!=='income'||input.amountCents!==('amountCents' in part?part.amountCents:part.netCents)||input.accountId!==salary.accountId)throw new Error('Selecione a parte correta do salário.');
  if(part.nextDate>today)throw new Error('Este recebimento ainda está no futuro. Se recebeu antecipado, ajuste a data primeiro.');
  part.nextDate=salaryDate(part.nextDate,1,part.payday);
  if(salary.parts)salary.nextDate=salary.parts.map(p=>p.nextDate).sort()[0];
 }
 account.balanceCents+=input.amountCents*(input.kind==='expense'?-1:1);
 snapshot.transactions.unshift({id:crypto.randomUUID(),description:input.description,date:input.date,amountCents:input.amountCents*(input.kind==='expense'?-1:1)});
 return SnapshotSchema.parse(snapshot);
}
