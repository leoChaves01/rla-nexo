import { Snapshot, demoSnapshot } from '@rla-nexo/engine';
// Um adaptador real deve normalizar BRL em centavos, deduplicar por IDs do provedor,
// reconciliar faturas para não contar compras e faturas duas vezes e verificar consentimento.
export interface OpenFinanceProvider {
  readonly name:string;
  sync(consentId:string):Promise<Snapshot>;
  revoke(consentId:string):Promise<void>;
}
export class MockOpenFinanceProvider implements OpenFinanceProvider {
  readonly name='mock';
  async sync(_consentId:string){return demoSnapshot();}
  async revoke(_consentId:string){}
}
export function createProvider():OpenFinanceProvider {
  if((process.env.OPEN_FINANCE_PROVIDER || 'mock')!=='mock')
    throw new Error('Provedor real ainda não implementado. Configure um adaptador OpenFinanceProvider.');
  return new MockOpenFinanceProvider();
}

