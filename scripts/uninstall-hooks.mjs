#!/usr/bin/env node
/**
 * Remove os hooks do compress-token de ~/.claude/settings.json.
 * Mantém entradas de outros hooks intactas.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

function isCompressTokenHook(entry) {
  if (!entry || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some((h) => h && typeof h.command === 'string' && /hook-filter\.js/.test(h.command));
}

function main() {
  if (!fs.existsSync(SETTINGS)) {
    console.log('[compress-token] settings.json não encontrado — nada a remover.');
    return;
  }
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  } catch (err) {
    console.error('[compress-token] settings.json inválido:', err.message);
    process.exit(1);
  }
  if (!settings.hooks) {
    console.log('[compress-token] nenhum hook configurado.');
    return;
  }
  const removed = [];
  for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event];
    if (!Array.isArray(before)) continue;
    const after = before.filter((entry) => !isCompressTokenHook(entry));
    if (after.length !== before.length) removed.push(event);
    if (after.length === 0) delete settings.hooks[event];
    else settings.hooks[event] = after;
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  if (!removed.length) {
    console.log('[compress-token] nenhum hook do compress-token encontrado.');
    return;
  }
  console.log('[compress-token] hooks removidos:', removed.join(', '));
}

main();
