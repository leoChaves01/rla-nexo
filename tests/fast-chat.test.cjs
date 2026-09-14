const {test}=require('node:test'),assert=require('node:assert/strict');
const {demoSnapshot}=require('../packages/engine/dist');
const {converseLocal}=require('../apps/api/dist/local-conversation');
test('consultas diretas não aguardam modelo e usam snapshot atual',async()=>{const s=demoSnapshot('2026-09-10');const never=async()=>{throw Error('Não deve chamar IA');};const first=await converseLocal('Queria gastar 20 reais',s,[],never);assert.match(first.reply,/20,00/);const balance=await converseLocal('pq meu saldo ta negativo?',s,[],never);s.accounts[0].balanceCents+=10000;const changed=await converseLocal('Dinheiro livre',s,[],never);assert.equal(changed.projection.balanceCents-balance.projection.balanceCents,10000);});
