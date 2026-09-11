const {test}=require('node:test');const assert=require('node:assert/strict');
const {localIntent}=require('../apps/api/dist/interpreter');
test('interpretação local de BRL sem cálculos de decisão',()=>{
 assert.deepEqual(localIntent('Quero gastar R$ 1.250,50'),{action:'spend',amountCents:125050});
 assert.equal(localIntent('Quero gastar 500').amountCents,50000);
 assert.equal(localIntent('Dinheiro livre').action,'balance');
});
test('ambiguidade, negação e parcelas exigem esclarecimento',()=>{
 for(const text of ['Não quero gastar 500','Quero gastar 500 ou 1000','Quero gastar 500 em 3 vezes','E se gastar 500 amanhã','Quero gastar -50','Quero gastar 0','Quero gastar 2.50'])
 assert.equal(localIntent(text).action,'clarify',text);
});

