#!/usr/bin/env node
/**
 * Auto-configura compress-token como servidor MCP em todos os clientes instalados.
 * Roda automaticamente via postinstall ao fazer: npm install -g compress-token
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const IS_WIN = process.platform === 'win32';

// Resolve o caminho do binário instalado
function getBinPath() {
  // Se instalado globalmente via npm, o binário fica no PATH
  // Usamos o caminho absoluto do próprio arquivo para derivar o build
  const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const buildPath = path.resolve(scriptDir, '..', 'build', 'index.js');
  return buildPath;
}

function mergeJson(filePath, updater) {
  let obj = {};
  try {
    if (fs.existsSync(filePath)) {
      obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {}
  updater(obj);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function addServer(obj, binPath) {
  if (!obj.mcpServers) obj.mcpServers = {};
  obj.mcpServers['compress-token'] = {
    command: 'node',
    args: [binPath],
    type: 'stdio',
  };
}

const binPath = getBinPath();
const results = [];

// ── Claude Code ────────────────────────────────────────────────────────────
{
  const p = path.join(HOME, '.claude', 'mcp.json');
  try {
    mergeJson(p, (o) => addServer(o, binPath));
    results.push('✓ Claude Code  → ' + p);
  } catch (e) {
    results.push('✗ Claude Code  → ' + e.message);
  }
}

// ── Cursor ─────────────────────────────────────────────────────────────────
{
  const candidates = IS_WIN
    ? [path.join(HOME, '.cursor', 'mcp.json')]
    : [path.join(HOME, '.cursor', 'mcp.json')];
  for (const p of candidates) {
    try {
      mergeJson(p, (o) => addServer(o, binPath));
      results.push('✓ Cursor       → ' + p);
      break;
    } catch (e) {
      results.push('✗ Cursor       → ' + e.message);
    }
  }
}

// ── VS Code (MCP via settings) ─────────────────────────────────────────────
{
  const vscodeConfig = IS_WIN
    ? path.join(HOME, 'AppData', 'Roaming', 'Code', 'User', 'settings.json')
    : process.platform === 'darwin'
    ? path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
    : path.join(HOME, '.config', 'Code', 'User', 'settings.json');

  if (fs.existsSync(path.dirname(vscodeConfig))) {
    try {
      mergeJson(vscodeConfig, (o) => {
        if (!o.mcp) o.mcp = {};
        if (!o.mcp.servers) o.mcp.servers = {};
        o.mcp.servers['compress-token'] = {
          command: 'node',
          args: [binPath],
          type: 'stdio',
        };
      });
      results.push('✓ VS Code      → ' + vscodeConfig);
    } catch (e) {
      results.push('✗ VS Code      → ' + e.message);
    }
  }
}

// ── Windsurf ───────────────────────────────────────────────────────────────
{
  const p = IS_WIN
    ? path.join(HOME, '.codeium', 'windsurf', 'mcp_config.json')
    : path.join(HOME, '.codeium', 'windsurf', 'mcp_config.json');

  if (fs.existsSync(path.dirname(p)) || fs.existsSync(path.join(HOME, '.codeium'))) {
    try {
      mergeJson(p, (o) => addServer(o, binPath));
      results.push('✓ Windsurf     → ' + p);
    } catch (e) {
      results.push('✗ Windsurf     → ' + e.message);
    }
  }
}

// ── Resultado ──────────────────────────────────────────────────────────────
console.log('\n🗜  compress-token MCP — configuração automática\n');
results.forEach((r) => console.log('  ' + r));
console.log('\n  Binário: ' + binPath);
console.log('  Reinicie os editores para ativar o servidor.\n');
