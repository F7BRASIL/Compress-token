#!/usr/bin/env node
/**
 * Instala hooks do compress-token em ~/.claude/settings.json.
 *
 * Adiciona três hooks que apontam para `compress-token-hook-filter`:
 *   - UserPromptSubmit: detecta pastes grandes
 *   - PostToolUse (Read|Bash|Grep): avisa quando output é grande
 *   - Stop: imprime relatório da sessão
 *
 * Idempotente: se já existem entradas com o mesmo `command`, não duplica.
 * Roda via postinstall. Pra desfazer: `npm run uninstall-hooks`.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const SETTINGS = path.join(HOME, '.claude', 'settings.json');

function resolveHookFilterBin() {
  const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const buildPath = path.resolve(scriptDir, '..', 'build', 'hook-filter.js');
  return buildPath;
}

function buildCommand(binPath) {
  /* Usa `node <path>` pra funcionar em qualquer OS sem depender do shebang. */
  const quoted = binPath.includes(' ') ? `"${binPath}"` : binPath;
  return `node ${quoted}`;
}

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS)) return {};
    const raw = fs.readFileSync(SETTINGS, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('[compress-token] settings.json inválido, abortando install-hooks:', err.message);
    process.exit(0);
  }
}

function saveSettings(obj) {
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function ensureEventArray(settings, event) {
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks[event])) settings.hooks[event] = [];
  return settings.hooks[event];
}

function hookExists(entries, command) {
  return entries.some((entry) =>
    Array.isArray(entry.hooks) && entry.hooks.some((h) => h && h.command === command),
  );
}

function addHook(settings, event, command, matcher) {
  const entries = ensureEventArray(settings, event);
  if (hookExists(entries, command)) return false;
  const newEntry = matcher
    ? { matcher, hooks: [{ type: 'command', command }] }
    : { hooks: [{ type: 'command', command }] };
  entries.push(newEntry);
  return true;
}

function main() {
  const binPath = resolveHookFilterBin();
  if (!fs.existsSync(binPath)) {
    /* Build ainda não rodou — o prepare do npm vai rodar tsc antes do postinstall. */
    console.log('[compress-token] hook-filter ainda não construído; pulando install-hooks.');
    return;
  }
  const command = buildCommand(binPath);
  const settings = loadSettings();
  const added = [];
  if (addHook(settings, 'UserPromptSubmit', command)) added.push('UserPromptSubmit');
  if (addHook(settings, 'PostToolUse', command, 'Read|Bash|Grep')) added.push('PostToolUse');
  if (addHook(settings, 'Stop', command)) added.push('Stop');
  if (!added.length) {
    console.log('[compress-token] hooks já instalados em ~/.claude/settings.json');
    return;
  }
  saveSettings(settings);
  console.log('[compress-token] hooks instalados:', added.join(', '));
  console.log('   Arquivo: ' + SETTINGS);
  console.log('   Pra desfazer: npm run uninstall-hooks');
}

main();
