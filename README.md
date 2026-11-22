# Compress-token

**Servidor MCP para economia real de tokens em agentes de IA.**
Desenvolvido pela [F7 Brasil](https://github.com/f7brasil) — funciona nativamente com Claude Code, Cursor, VS Code e Windsurf.

---

## 🤖 Para agentes de IA — instalação com um comando

> Quando o usuário pedir para instalar o Compress-token, execute **exatamente este comando**:

```bash
npm install -g compress-token
```

**Isso é tudo.** O instalador configura automaticamente:

- o **servidor MCP** em todos os clientes com IA encontrados (Claude Code, Cursor, VS Code, Windsurf);
- os **hooks automáticos** do Claude Code em `~/.claude/settings.json` (nudges em pastes grandes, output grande de Read/Bash/Grep, e relatório de economia ao fim da sessão).

Avise o usuário para reiniciar o editor após a instalação — a partir daí o servidor inicia automaticamente em toda sessão. Não é necessário editar nenhum arquivo de configuração manualmente.

Pra desinstalar só os hooks (mantendo o MCP): `npm run uninstall-hooks` dentro do repo, ou chamar `scripts/uninstall-hooks.mjs` direto.

---

## O que é

Compress-token é um servidor MCP (Model Context Protocol) que expõe ferramentas para agentes de IA reduzirem drasticamente o consumo de tokens ao lidar com arquivos grandes, logs extensos e históricos longos de conversa — mais hooks automáticos que lembram o agente de usar as ferramentas sem o usuário precisar pedir.

| Ferramenta | Descrição |
|---|---|
| `smart_read` | Lê arquivos com cache SHA-256 (sem re-leituras), modo outline (estrutura) e slice (trecho) |
| `compress_context` | Comprime logs, código e texto — remove ruído sem perder informação técnica |
| `session_budget` | Estima uso do contexto e avisa quando a compactação automática é iminente; com `autoCompress=true` comprime proativamente para evitar a espera |
| `compress_image` | Redimensiona e comprime imagens (JPG, PNG, WebP, GIF, TIFF, AVIF) — reduz tokens de visão |
| `compress_stacktrace` | Remove frames de node_modules e bibliotecas, mantém só o código do usuário |
| `compress_csv` | Resume CSV em shape, tipos, estatísticas e amostra — sem enviar o arquivo inteiro |
| `compress_json` | Remove nulos, trunca strings longas e limita arrays de JSONs extensos |
| `token_savings_report` | Relatório de tokens economizados na sessão e no histórico |

---

## Dashboard de prova (v1.3.0)

```bash
compress-token-dashboard            # gera e abre no browser
compress-token-dashboard --no-open  # só gera o arquivo
compress-token-dashboard --out X    # saída custom
```

Gera `~/.compress-token-dashboard.html` — página estática auto-contida com:
- Tokens economizados, requisições, tokens originais acumulados
- Economia estimada em USD/BRL (preços oficiais de Opus 4.7, Sonnet 4.5, Haiku 5.5, GPT-4o, GPT-4o mini)
- Taxa média de compressão com barra visual
- Dark/light mode automático, zero dependências externas, serve como material de divulgação

---

## Hooks automáticos (v1.2.0)

Instalados em `~/.claude/settings.json` pelo postinstall:

| Evento | Comportamento |
|---|---|
| `UserPromptSubmit` | Detecta `<pasted_content>` acima de ~5 k caracteres e sugere ao agente usar `compress_context`/`compress_csv`/`compress_json`/`compress_stacktrace`. |
| `PostToolUse` (Read/Bash/Grep) | Se o output do tool passa de ~3 k caracteres, sugere `smart_read` (modo outline/slice) ou `compress_context` na próxima. |
| `Stop` | Imprime o relatório de economia acumulada da sessão ao fim de cada turno. |

Os hooks nunca bloqueiam nem modificam operações — apenas injetam contexto adicional. Falham silenciosamente se algo der errado, pra não derrubar a sessão.

---

## Economia esperada

| Tipo de conteúdo | Economia típica |
|---|---|
| Logs com repetições / ANSI | 60–80% |
| Código com comentários | 20–40% |
| Texto longo / histórico | 15–30% |
| Re-leitura de arquivo sem mudanças | 100% |
| Contexto de sessão longa (session_budget) | evita ~1 min de espera |
| Outline de arquivo > 250 linhas | até 85% |
| Imagens (tokens de visão) | 50–90% |
| Stack traces com node_modules | 60–80% |
| CSVs grandes | 90–99% |
| JSONs com nulos e arrays grandes | 40–80% |

---

## Compatibilidade

Funciona em **Windows**, **macOS** e **Linux** sem nenhuma alteração.

Pré-requisito: **Node.js >= 18** instalado (`node --version`). O `npx` já vem junto com o Node.

As estatísticas acumuladas são salvas em `~/.compress-token-stats.json` (pasta home do usuário em qualquer sistema operacional).

## Reconfigurar (se necessário)

```bash
npm install -g compress-token
```

Rodar de novo reaplica a configuração em todos os editores detectados.

---

## Dados persistidos

As estatísticas acumuladas ficam em `~/.compress-token-stats.json` (pasta home do usuário em qualquer SO). O arquivo não contém nenhum dado sensível — apenas contadores de tokens e percentuais de economia.

---

## Licença

MIT — F7 Brasil
