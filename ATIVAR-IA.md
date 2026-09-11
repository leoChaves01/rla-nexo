# Ativar a conversa com IA

A integração usa a Responses API da OpenAI com ferramentas de consulta ao motor financeiro. O modelo conversa usando o histórico recente (até 20 mensagens) e os cadastros atuais. Avaliações de gasto e cenários são calculados pelo motor; o chat não altera cadastros nem movimenta dinheiro.

1. Execute `Configurar IA.cmd` nesta pasta.
2. Cole sua chave da API OpenAI no campo oculto. Ela será salva somente no arquivo `.env` do servidor, não no navegador.
3. Avise no Codex que configurou a chave para reiniciar o serviço e testar a conexão.

Ao ativar e conversar, o aplicativo envia sua pergunta, contexto financeiro e histórico recente à OpenAI para gerar a resposta. A chave deve ter acesso ao modelo definido em OPENAI_MODEL (atualmente gpt-5.5).

Sem chave, o app continua identificado como modo local. Erros de autenticação, limite ou indisponibilidade são mostrados; não são disfarçados de respostas da IA.

Validação realizada: compilação API/web, testes do reconhecimento local, explicação de caixa, histórico enviado, execução determinística de ferramentas, ausência de alteração dos cadastros e tratamento de falha da API. Chamadas externas foram simuladas nos testes. Uma resposta real depende da chave e ainda não foi validada.

Documentação: https://developers.openai.com/api/docs/guides/function-calling
