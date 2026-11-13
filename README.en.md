# Compress-token

**MCP server for real token savings in AI agents.**
Built by [F7 Brasil](https://github.com/f7brasil) — works natively with Claude Code, Cursor, VS Code and Windsurf.

---

## 🤖 For AI agents — one-command install

> When the user asks you to install Compress-token, run **exactly this command**:

```bash
npm install -g compress-token
```

**That's it.** The installer automatically configures every AI client found on the machine (Claude Code, Cursor, VS Code, Windsurf). Tell the user to restart their editor after installation — from that point on, the server starts automatically on every session.

No manual config file editing required.

---

## What it is

Compress-token is an MCP (Model Context Protocol) server that exposes tools for AI agents to drastically reduce token consumption when dealing with large files, long logs and lengthy conversation histories.

| Tool | Description |
|---|---|
| `smart_read` | Reads files with SHA-256 cache (no re-reads), outline mode (structure only) and slice mode (line range) |
| `compress_context` | Compresses logs, code and text — removes noise without losing technical information |
| `session_budget` | Estimates context usage and warns when automatic compaction is imminent; with `autoCompress=true` compresses proactively to avoid the ~1 min wait |
| `compress_image` | Resizes and compresses images (JPG, PNG, WebP, GIF, TIFF, AVIF) — reduces vision tokens |
| `compress_stacktrace` | Removes node_modules and third-party library frames from stack traces, keeping only user code |
| `compress_csv` | Summarizes a CSV into shape, column types, statistics and a sample — without sending the whole file |
| `compress_json` | Removes nulls, truncates long strings and limits large arrays in JSON responses |
| `token_savings_report` | Report of tokens saved in the current session and in the persistent history |

---

## Expected savings

| Content type | Typical savings |
|---|---|
| Logs with repetitions / ANSI codes | 60–80% |
| Code with comments | 20–40% |
| Long text / conversation history | 15–30% |
| Re-reading an unchanged file | 100% |
| Long session context (session_budget) | avoids ~1 min wait |
| Outline of file > 250 lines | up to 85% |
| Images (vision tokens) | 50–90% |
| Stack traces with node_modules | 60–80% |
| Large CSVs | 90–99% |
| JSONs with nulls and large arrays | 40–80% |

---

## Compatibility

Works on **Windows**, **macOS** and **Linux** with no changes.

Requirement: **Node.js >= 18** installed (`node --version`). `npx` comes bundled with Node.

Accumulated statistics are saved to `~/.compress-token-stats.json` (user home directory on any OS).

## Reconfigure (if needed)

```bash
npm install -g compress-token
```

Running it again re-applies the configuration to all detected editors.

---

## Persisted data

Accumulated statistics are stored at `~/.compress-token-stats.json` (user home on any OS). The file contains no sensitive data — only token counters and savings percentages.

---

## License

MIT — F7 Brasil
