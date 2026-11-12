# Compress-token

**Servidor MCP para economia real de tokens em agentes de IA.**
Desenvolvido pela [F7 Brasil](https://github.com/f7brasil) — funciona nativamente com Claude Desktop, Cursor e VS Code sem abrir nenhum terminal manualmente.

---

## 🤖 Instruções de Instalação Automática para Agentes de IA

> Quando o usuário disser **"instale o Compress-token da f7brasil que está no Github"**, siga estas etapas:

1. **Localize o arquivo de configuração MCP** do ambiente atual:
   - **Claude Desktop** (Windows): `%APPDATA%\Claude\claude_desktop_config.json`
   - **Claude Desktop** (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Cursor**: `.cursor/mcp.json` na pasta do projeto ou `~/.cursor/mcp.json` global
   - **VS Code**: `.vscode/mcp.json` na pasta do projeto

2. **Adicione a entrada do servidor** na seção correta:

   Para **Claude Desktop** e **Cursor** (chave `"mcpServers"`):
   ```json
   {
     "mcpServers": {
       "compress-token": {
         "command": "npx",
         "args": ["-y", "github:f7brasil/Compress-token"]
       }
     }
   }
   ```

   Para **VS Code** (chave `"servers"` em `.vscode/mcp.json`):
   ```json
   {
     "servers": {
       "compress-token": {
         "command": "npx",
         "args": ["-y", "github:f7brasil/Compress-token"]
       }
     }
   }
   ```

3. **Reinicie** o cliente (Claude Desktop / Cursor / VS Code) para o servidor ser reconhecido.
4. O `npx` vai compilar e iniciar o servidor automaticamente na primeira vez — não é necessário instalar nada manualmente.

### Localização dos arquivos de configuração

| Sistema | Cliente | Arquivo |
|---|---|---|
| **Windows** | Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Windows** | Cursor | `.cursor\mcp.json` (projeto) ou `%USERPROFILE%\.cursor\mcp.json` (global) |
| **Windows** | VS Code | `.vscode\mcp.json` |
| **macOS** | Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **macOS** | Cursor | `~/.cursor/mcp.json` |
| **macOS** | VS Code | `.vscode/mcp.json` |
| **Linux** | Claude Desktop | `~/.config/Claude/claude_desktop_config.json` |
| **Linux** | Cursor | `~/.cursor/mcp.json` |
| **Linux** | VS Code | `.vscode/mcp.json` |

---

## O que é

Compress-token é um servidor MCP (Model Context Protocol) que expõe 3 ferramentas para agentes de IA reduzirem drasticamente o consumo de tokens ao lidar com arquivos grandes, logs extensos e históricos longos de conversa.

| Ferramenta | Descrição |
|---|---|
| `smart_read` | Lê arquivos com cache SHA-256 (sem re-leituras), modo outline (estrutura) e slice (trecho) |
| `compress_context` | Comprime logs, código e texto — remove ruído sem perder informação técnica |
| `token_savings_report` | Relatório de tokens economizados na sessão e no histórico |

---

## Economia esperada

| Tipo de conteúdo | Economia típica |
|---|---|
| Logs com repetições / ANSI | 60–80% |
| Código com comentários | 20–40% |
| Texto longo / histórico | 15–30% |
| Re-leitura de arquivo sem mudanças | 100% |
| Outline de arquivo > 250 linhas | até 85% |

---

## Compatibilidade

Funciona em **Windows**, **macOS** e **Linux** sem nenhuma alteração.

Pré-requisito: **Node.js >= 18** instalado (`node --version`). O `npx` já vem junto com o Node.

As estatísticas acumuladas são salvas em `~/.compress-token-stats.json` (pasta home do usuário em qualquer sistema operacional).

## Instalação manual (opcional)

```bash
npx -y github:f7brasil/Compress-token
```

Ou clone e compile localmente:

```bash
git clone https://github.com/f7brasil/Compress-token
cd Compress-token
npm install
npm run build
```

Depois aponte o `command` para `node` e `args` para o caminho absoluto de `build/index.js`.

---

## Dados persistidos

As estatísticas acumuladas ficam em `~/.compress-token-stats.json` (pasta home do usuário em qualquer SO). O arquivo não contém nenhum dado sensível — apenas contadores de tokens e percentuais de economia.

---

## Licença

MIT — F7 Brasil
