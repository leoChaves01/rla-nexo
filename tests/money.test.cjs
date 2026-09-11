const test=require('node:test');
const assert=require('node:assert/strict');
const {parseBrlCents}=require('@rla-nexo/engine');
test('valores brasileiros preservam centavos e rejeitam separadores ambíguos',()=>{
 for(const [text,value] of [['500',50000],['500,50',50050],['1.250,50',125050],['0,01',1],[' 10,1 ',1010],['100.000.000,00',10000000000]])assert.equal(parseBrlCents(text),value,text);
 for(const text of ['500.50','1.2.3','1,234','-1','Infinity','','100.000.000,01'])assert.equal(parseBrlCents(text),null,text);
});
