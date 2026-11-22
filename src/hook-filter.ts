#!/usr/bin/env node
/**
 * Hook CLI do compress-token.
 *
 * Instalado como `compress-token-hook-filter` via bin. Lê o payload JSON do
 * hook pelo stdin, decide o que fazer com base em `hook_event_name` e imprime
 * `additionalContext` via stdout. NUNCA bloqueia ou modifica o fluxo —
 * apenas injeta nudges e relatórios. Falha silenciosa pra não derrubar sessão.
 *
 * Eventos suportados:
 *   - UserPromptSubmit: se o prompt tem paste gigante, sugere compress_context.
 *   - PostToolUse (Read/Bash/Grep): se o output excede o limite, sugere smart_read.
 *   - Stop: imprime o relatório de economia da sessão.
 */
import { readFileSync } from 'fs';
import { loadStats } from './metrics.js';

const LARGE_PROMPT_CHARS = 5000;
const LARGE_TOOL_OUTPUT_CHARS = 3000;

interface HookPayload {
  hook_event_name?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: { content?: unknown; stdout?: string; output?: string };
}

function readStdin(): string {
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function emit(eventName: string, context: string): void {
  if (!context) return;
  const payload = {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: context,
    },
  };
  /* Claude Code lê stdout JSON do hook; se não for JSON válido, trata como texto plano. */
  process.stdout.write(JSON.stringify(payload));
}

function emitPlain(text: string): void {
  if (text) process.stdout.write(text);
}

function toolOutputText(payload: HookPayload): string {
  const r = payload.tool_response;
  if (!r) return '';
  if (typeof r.output === 'string') return r.output;
  if (typeof r.stdout === 'string') return r.stdout;
  if (typeof r.content === 'string') return r.content;
  if (Array.isArray(r.content)) {
    return r.content
      .map((c: unknown) => {
        if (c && typeof c === 'object' && 'text' in c) return String((c as { text: unknown }).text ?? '');
        return '';
      })
      .join('\n');
  }
  return '';
}

function handleUserPromptSubmit(payload: HookPayload): void {
  const prompt = payload.prompt ?? '';
  if (prompt.length < LARGE_PROMPT_CHARS) return;
  const pastedBlocks = (prompt.match(/<pasted_content[^>]*>[\s\S]*?<\/pasted_content>/g) ?? [])
    .filter((b) => b.length > LARGE_PROMPT_CHARS);
  if (!pastedBlocks.length && prompt.length < LARGE_PROMPT_CHARS * 2) return;
  const biggest = pastedBlocks.length
    ? pastedBlocks.reduce((a, b) => (a.length >= b.length ? a : b))
    : prompt;
  const estTokens = Math.ceil(biggest.length / 4);
  emit(
    'UserPromptSubmit',
    `[compress-token] Paste grande detectado (~${estTokens} tokens). ` +
      `Considere rodar \`compress_context\` ou \`compress_stacktrace\`/\`compress_csv\`/\`compress_json\` ` +
      `conforme o tipo antes de processar.`,
  );
}

function handlePostToolUse(payload: HookPayload): void {
  const tool = payload.tool_name ?? '';
  if (!/^(Read|Bash|Grep)$/.test(tool)) return;
  const output = toolOutputText(payload);
  if (output.length < LARGE_TOOL_OUTPUT_CHARS) return;
  const estTokens = Math.ceil(output.length / 4);
  const hint =
    tool === 'Read'
      ? `use \`smart_read\` (modo outline p/ visão geral ou slice pra trecho específico)`
      : `passe o output por \`compress_context\` antes de reutilizar`;
  emit(
    'PostToolUse',
    `[compress-token] ${tool} devolveu ~${estTokens} tokens. Pra próxima: ${hint}.`,
  );
}

function handleStop(_payload: HookPayload): void {
  const stats = loadStats();
  if (stats.totalRequests === 0) return;
  const lines = [
    '',
    '📈 compress-token — economia acumulada',
    `   Requisições: ${stats.totalRequests} · ` +
      `Tokens originais: ${stats.totalOriginalTokens.toLocaleString('pt-BR')} · ` +
      `Economizados: ${stats.totalSavedTokens.toLocaleString('pt-BR')} (${stats.averageSavingPercent}%)`,
    '',
  ].join('\n');
  emitPlain(lines);
}

function main(): void {
  let payload: HookPayload = {};
  try {
    const raw = readStdin();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch {
    return;
  }
  const event = payload.hook_event_name ?? '';
  try {
    if (event === 'UserPromptSubmit') return handleUserPromptSubmit(payload);
    if (event === 'PostToolUse') return handlePostToolUse(payload);
    if (event === 'Stop') return handleStop(payload);
  } catch {
    /* silencioso — hook nunca derruba a sessão */
  }
}

main();
