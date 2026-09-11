# Revisão do RLA Nexo — 10/09/2026

O fluxo web local de cadastro manual foi revisado com dados fictícios em um banco PostgreSQL separado. Os dados pessoais existentes não foram alterados pelos testes.

## Verificado

- Pela interface: salvar contas a pagar e receitas separadamente, mesmo com outra seção incompleta e sem conta bancária; recarregar e recuperar os valores.
- Salário sem conta de destino, cadastro da conta e vínculo posterior do salário.
- Registrar salário recebido, pagar compromisso e receber receita; conferir os saldos resultantes.
- Metas, margem de segurança, dinheiro livre, conversa guiada e simulação sem alteração dos dados reais.
- Integração PostgreSQL: persistência após reiniciar a API, histórico de conversa, exportação de backup, validação de dados e rejeição de revisão desatualizada.
- 18 testes automatizados aprovados, incluindo centavos, datas, salário recorrente, pagamento duplicado, compromissos vencidos e reservas.

## Correções

- O simulador interpretava `500.50` como R$ 50.050,00. Agora valida o formato antes da conversão e pede vírgula nos centavos: `500,50`. Formatos ambíguos são rejeitados.
- A confirmação e os erros de movimentações aparecem junto ao formulário de lançamento.
- Os cadastros têm salvamento por seção, com confirmação explícita no banco.

## Limites atuais

- Open Finance real ainda não está implementado; contas e transações são cadastradas manualmente.
- Sem chave OpenAI configurada, a conversa usa interpretação local de pedidos suportados, como “Quero gastar 500” e “Dinheiro livre”. A integração externa não foi validada ao vivo.
- O projeto mobile é código-fonte; não foi validado em aparelho e não há aplicativo instalável entregue.
- Alertas aparecem no painel. Não há notificações push nem monitoramento com o serviço desligado.
- A memória fica neste computador. Não há hospedagem pública nem sincronização entre dispositivos.
- O backup exporta dados financeiros; não inclui o histórico de conversa. A restauração pela interface não foi exercitada nesta revisão.
- A projeção depende dos compromissos informados e da previsão de salário habilitada; contas recorrentes não cadastradas não são presumidas.

Esta revisão cobre os fluxos descritos; não equivale a uma auditoria completa de segurança ou garantia de ausência de defeitos.
