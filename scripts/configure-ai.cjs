const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
const key=(process.env.RLA_OPENAI_SETUP_KEY||'').trim();
if(!key||/[\r\n]/.test(key)){console.error('Chave inválida. Nada foi alterado.');process.exit(1);}
const file=path.join(root,'.env');const source=fs.readFileSync(file,'utf8');
const next=/^OPENAI_API_KEY=.*$/m.test(source)?source.replace(/^OPENAI_API_KEY=.*$/m,()=> 'OPENAI_API_KEY='+key):source+'\nOPENAI_API_KEY='+key+'\n';
fs.writeFileSync(file,next);console.log('Chave salva localmente. Avise no Codex para reiniciar a API e testar a conexão.');
