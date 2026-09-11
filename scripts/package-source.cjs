const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'..','rla-nexo-online-'+new Date().toISOString().replace(/[:.]/g,'-'));
const skip=new Set(['node_modules','runtime','.next','dist','.git','.vercel']);
function copy(src,dst){fs.mkdirSync(dst,{recursive:true});for(const e of fs.readdirSync(src,{withFileTypes:true})){if(skip.has(e.name)||e.name.endsWith('.tsbuildinfo')||e.name.endsWith('.log')||(e.name.startsWith('.env')&&!['.env.example','.env.cloud.example'].includes(e.name)))continue;const a=path.join(src,e.name),b=path.join(dst,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory())copy(a,b);else fs.copyFileSync(a,b);}}
copy(root,out);
fs.writeFileSync(path.join(out,'COMECE-AQUI.txt'),'RLA Nexo online\n\nLeia COLOCAR-ONLINE.md.\n\nEste pacote requer configuração das suas contas gratuitas Supabase, Groq e Vercel. Não contém suas chaves nem dados pessoais. Não foi publicado automaticamente.\n');
console.log(out);
