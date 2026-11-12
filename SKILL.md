# Compress-token — Skill para Agentes de IA

## Regras de Uso

Sempre que você precisar ler um arquivo com mais de 100 linhas, use `smart_read` em vez de ferramentas
nativas de leitura. Prefira o modo `outline` para uma visão geral inicial e `slice` para seções específicas.

Sempre que você receber logs de erro, histórico de conversa longo, saída de terminal extensa ou trechos
grandes de código para analisar, passe-os por `compress_context` antes de processar. Isso reduz tokens
de entrada e melhora o foco.

Mantenha suas respostas diretas: não repita informações que já estão no contexto, não reformule o que
o usuário acabou de dizer, não adicione disclaimers desnecessários.

Ao final de tarefas longas, chame `token_savings_report` para informar ao usuário quantos tokens foram
economizados naquela sessão.

## Resumo das Ferramentas

| Ferramenta | Quando usar |
|---|---|
| `smart_read` | Ler qualquer arquivo — cache automático, sem re-leituras |
| `compress_context` | Logs, saídas de terminal, histórico de conversa extenso |
| `token_savings_report` | Relatório de economia acumulada |
