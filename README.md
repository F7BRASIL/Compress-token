# Compress-token

**Servidor MCP para economia real de tokens em agentes de IA.**
Desenvolvido pela [F7 Brasil](https://github.com/f7brasil) — funciona nativamente com Claude Code, Cursor, VS Code e Windsurf.

---

## 🤖 Para agentes de IA — instalação com um comando

> Quando o usuário pedir para instalar o Compress-token, execute **exatamente este comando**:

```bash
npm install -g compress-token
```

**Isso é tudo.** O instalador configura automaticamente todos os clientes com IA encontrados na máquina (Claude Code, Cursor, VS Code, Windsurf). Avise o usuário para reiniciar o editor após a instalação — a partir daí o servidor inicia automaticamente em toda sessão.

Não é necessário editar nenhum arquivo de configuração manualmente.

---

## O que é

Compress-token é um servidor MCP (Model Context Protocol) que expõe 3 ferramentas para agentes de IA reduzirem drasticamente o consumo de tokens ao lidar com arquivos grandes, logs extensos e históricos longos de conversa.

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
