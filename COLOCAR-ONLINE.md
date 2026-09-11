# RLA Nexo online — configuração gratuita

O código está adaptado para login, PostgreSQL por usuário e motor financeiro nas funções da Vercel. A publicação e o teste real de login/IA dependem das suas contas. Este ZIP não inclui dados pessoais nem chaves e não cria serviços sozinho.

## 1. Banco e login — Supabase Free

Crie um projeto em https://supabase.com/dashboard na organização Free. Guarde a senha do banco em local privado. No SQL Editor, execute o conteúdo de `supabase/schema.sql` uma vez em um projeto novo. Isso cria tabelas, isolamento de usuários e funções de salvamento com controle de versão.

Em Settings / API, copie Project URL e a chave pública publishable (ou anon). **Não use secret/service_role**: ela contorna as regras de isolamento. O aplicativo usa apenas a chave pública e a sessão validada do usuário.

Em Authentication / Users, crie seu usuário pessoal com e-mail e senha. O envio padrão de e-mails do Supabase tem restrições; a criação manual permite começar sem contratar e-mail. Cadastros e recuperação por e-mail dependem da configuração de envio da sua conta. Para uso só seu, depois de criar seu usuário desative novos cadastros nas configurações de Authentication. Para convidar outras pessoas, crie cada usuário; cada um terá seus próprios dados.

## 2. IA — Groq Free

Crie uma conta em https://console.groq.com e uma API key. Mantenha o plano **Free**, sem cadastrar pagamento nem habilitar Developer. Confira os limites disponíveis para `openai/gpt-oss-20b` na sua conta. Não há contratação automática pelo código. Se você mudar a conta para um plano pago, requisições podem ser cobradas; o app não consegue conferir o plano da chave.

A Groq recebe a mensagem atual e até duas perguntas anteriores para interpretar intenção, quantia e data. Não enviamos saldos, nomes de contas nem registros financeiros. A resposta com os valores é montada pelo motor determinístico. Conversa livre é limitada a essas intenções nesta versão: explicar saldo, avaliar gasto, simular cenário e orientar uso. Não é um chat geral irrestrito.

Sem chave, quando houver falha ou cota excedida, o modo guiado continua disponível. O app limita pedidos de interpretação a 30 por usuário/dia e pelo menos 5 segundos entre eles. As cotas do provedor podem ser menores e são compartilhadas pela chave.

## 3. Publicar — Vercel Hobby

Extraia o ZIP, envie o conteúdo para um repositório GitHub privado e importe na Vercel. Use:

- Framework: Next.js.
- Root Directory: `apps/web`.
- Habilite a inclusão de arquivos fora da Root Directory (o motor e a API compartilhada estão no monorepo).
- Install Command: `cd ../.. && npm ci`.
- Build Command: `cd ../.. && npm run build:cloud`.
- Node.js: 22.x.

Cadastre as variáveis do arquivo `.env.cloud.example` na Vercel:

- `NEXO_CLOUD=true`
- `SUPABASE_URL`: URL do projeto.
- `SUPABASE_ANON_KEY`: chave pública publishable/anon.
- `FREE_AI_ENABLED=true`: somente depois de configurar sua conta Groq Free.
- `GROQ_API_KEY`: chave privada da Groq.
- `GROQ_MODEL=openai/gpt-oss-20b`

Não copie `.env` do computador. Não cadastre `OPENAI_API_KEY`, `DATABASE_URL` local ou `API_TOKEN` na versão online: ela não precisa deles. A Vercel executa o motor diretamente, sem servidor NestJS separado. O servidor NestJS continua disponível para o uso local.

Após Deploy, copie o endereço HTTPS gerado. No Supabase, configure Authentication / URL Configuration / Site URL com esse endereço e adicione-o à lista de redirecionamentos autorizados. Entre no Nexo com o usuário criado.

## 4. Validar antes de usar seus dados

Entre pelo celular, cadastre uma conta de teste e salve. Recarregue e confira a persistência. Saia e verifique que o login aparece. Entre com outro usuário e confirme que o cadastro fica vazio. Teste salário dividido, contas parceladas, uma pergunta de saldo e uma pergunta com palavras diferentes para exercitar a IA. Apague apenas o cadastro de teste que você criou, usando a interface.

Se desejar trazer os dados locais, exporte o backup em Meus dados no Nexo do computador e importe em Meus dados na sua conta online. O histórico do chat não faz parte desse backup. As versões local e online terão bancos independentes; não há sincronização automática.

## No celular

Abra o endereço HTTPS e use “Adicionar à tela inicial” no navegador. O ícone abre a interface adaptada ao celular; não é um APK. Precisa de internet. O computador pode ficar desligado após a publicação online. Alertas aparecem ao abrir/atualizar o painel; ainda não há notificações push. Open Finance automático ainda não está implementado.

## Limites gratuitos conferidos em 11/09/2026

Vercel Hobby é para uso pessoal/não comercial. Supabase Free inclui 500 MB de banco e pode pausar projetos de baixa atividade por 7 dias. Groq Free tem cotas por modelo/conta. Não há garantia de disponibilidade ilimitada. Mantenha backups exportados. Estes serviços não foram criados nem publicados automaticamente durante a preparação do código.

Fontes: https://vercel.com/docs/plans/hobby — https://supabase.com/pricing — https://supabase.com/docs/guides/platform/free-project-pausing — https://console.groq.com/docs/billing-faqs — https://console.groq.com/docs/your-data — https://console.groq.com/docs/models
