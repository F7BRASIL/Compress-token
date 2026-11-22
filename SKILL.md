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

Quando o usuário fizer uma pergunta que **PODE já ter sido respondida antes** (preços de bancos, FAQ
operacional, status de serviços externos, rotinas idempotentes), chame `cache_get` ANTES de buscar/calcular.
Se hit (similaridade ≥ threshold), responda com o cacheado. Se miss, compute e feche com `cache_set`
passando `tags` que ajudem o próximo lookup (ex.: `["banco:itau","produto:cdc"]`).

## Resumo das Ferramentas

| Ferramenta | Quando usar |
|---|---|
| `smart_read` | Ler qualquer arquivo — cache automático, sem re-leituras |
| `compress_context` | Logs, saídas de terminal, histórico de conversa extenso |
| `compress_stacktrace` / `compress_csv` / `compress_json` / `compress_image` | Pelo tipo do conteúdo |
| `cache_get` / `cache_set` | Pergunta repetível — tenta cache primeiro, grava depois |
| `cache_report` | Relatório do cache semântico |
| `session_budget` | Estima uso do contexto; `autoCompress=true` comprime proativamente |
| `token_savings_report` | Relatório de economia acumulada |
