# IA local do RLA Nexo

O Nexo está configurado para usar Ollama com Qwen3:4b-instruct neste computador. Não precisa de créditos da OpenAI. A chave antiga permanece guardada, mas não é utilizada enquanto AI_PROVIDER=ollama.

Abra normalmente `Abrir RLA Nexo.cmd`. O iniciador também liga a IA local em 127.0.0.1:11435. Após o download inicial, a conversa local não depende de serviços pagos. Os cálculos permanecem no motor financeiro e a conversa fica no PostgreSQL.

O modelo ocupa aproximadamente 2,5 GB em runtime/ollama-models. O executável está em runtime/ollama. Fechar a aba não encerra o servidor; o modelo é descarregado da memória após dez minutos sem uso.

Neste computador a IA utiliza o processador. A primeira resposta pode demorar mais para carregar o modelo. Perguntas curtas ajudam. Se aparecer uma falha, abra o iniciador novamente; não existe fallback automático para a API paga.

Modelos locais podem interpretar perguntas incorretamente. Confira os resultados do motor exibidos junto às avaliações. O chat não registra pagamentos nem altera seus cadastros.

Referências oficiais: https://docs.ollama.com/windows e https://docs.ollama.com/api/chat

Otimização: consultas diretas de saldo e gastos usam o motor imediatamente, sem aguardar o modelo. Perguntas abertas usam a IA, com quatro mensagens recentes de contexto e respostas curtas. Medições locais de referência: gasto direto 40 ms; consulta de saldo 3 ms (não incluem rede e renderização).
