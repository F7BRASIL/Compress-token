#!/usr/bin/env node
/**
 * Dashboard de prova — lê ~/.compress-token-stats.json e gera uma página
 * HTML estática auto-contida em ~/.compress-token-dashboard.html.
 *
 * Uso:
 *   compress-token-dashboard            # gera e abre no browser
 *   compress-token-dashboard --no-open  # só gera o arquivo
 *   compress-token-dashboard --out PATH # saída custom
 *
 * Nenhuma dependência externa: inline SVG, CSS e dados no HTML.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

interface Stats {
  totalRequests: number;
  totalOriginalTokens: number;
  totalSavedTokens: number;
  averageSavingPercent: number;
}

/* Tabela de preços (USD por 1M tokens de input) — médias oficiais recentes. */
const PRICE_PER_MTOK: Record<string, number> = {
  'claude-opus-4.7': 15,
  'claude-sonnet-4.5': 3,
  'claude-haiku-5.5': 1,
  'gpt-4o': 5,
  'gpt-4o-mini': 0.15,
};

const DEFAULT_MODEL = 'claude-sonnet-4.5';
const USD_TO_BRL = 5.5;

function loadStats(): Stats {
  const file = join(homedir(), '.compress-token-stats.json');
  if (!existsSync(file)) {
    return { totalRequests: 0, totalOriginalTokens: 0, totalSavedTokens: 0, averageSavingPercent: 0 };
  }
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as Stats;
  } catch {
    return { totalRequests: 0, totalOriginalTokens: 0, totalSavedTokens: 0, averageSavingPercent: 0 };
  }
}

function fmtInt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function fmtUsd(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
}

function fmtBrl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

function usdSaved(tokens: number, model: string): number {
  const price = PRICE_PER_MTOK[model] ?? PRICE_PER_MTOK[DEFAULT_MODEL];
  return (tokens / 1_000_000) * price;
}

function renderPriceRows(savedTokens: number): string {
  return Object.entries(PRICE_PER_MTOK)
    .map(([model, price]) => {
      const usd = (savedTokens / 1_000_000) * price;
      const brl = usd * USD_TO_BRL;
      return `<tr><td>${model}</td><td>$${price.toFixed(2)}/MTok</td><td>${fmtUsd(usd)}</td><td>${fmtBrl(brl)}</td></tr>`;
    })
    .join('');
}

function renderBar(percent: number): string {
  /* SVG barra de economia — 0..100 com gradient. */
  const w = 600;
  const h = 20;
  const fill = Math.max(0, Math.min(100, percent)) / 100 * w;
  return `
<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Economia ${percent}%">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--accent)"/>
      <stop offset="1" stop-color="var(--accent2)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="var(--track)"/>
  <rect x="0" y="0" width="${fill}" height="${h}" rx="4" fill="url(#g)"/>
</svg>`;
}

function renderHtml(stats: Stats): string {
  const costUsd = usdSaved(stats.totalSavedTokens, DEFAULT_MODEL);
  const costBrl = costUsd * USD_TO_BRL;
  const generatedAt = new Date().toLocaleString('pt-BR');
  const avg = stats.averageSavingPercent || 0;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>compress-token — economia acumulada</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #0b1020;
    --bg2: #111830;
    --card: #141c37;
    --text: #e8ecff;
    --muted: #8892b0;
    --line: #26305a;
    --accent: #60a5fa;
    --accent2: #22d3ee;
    --track: #1b2446;
    --ok: #4ade80;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --bg: #f7f9fc;
      --bg2: #eef2fb;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
      --accent: #2563eb;
      --accent2: #06b6d4;
      --track: #e2e8f0;
      --ok: #16a34a;
    }
  }
  :root[data-theme="light"] {
    --bg: #f7f9fc; --bg2: #eef2fb; --card: #ffffff; --text: #0f172a; --muted: #475569;
    --line: #e2e8f0; --accent: #2563eb; --accent2: #06b6d4; --track: #e2e8f0; --ok: #16a34a;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: radial-gradient(ellipse at top, var(--bg2), var(--bg)) fixed;
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh;
    padding: 32px 16px 64px;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  header h1 { margin: 0; font-size: 28px; letter-spacing: -0.01em; }
  header .brand { color: var(--accent); font-weight: 600; }
  header .sub { color: var(--muted); font-size: 14px; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
  .card .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
  .card .value { font-size: 32px; font-weight: 700; margin-top: 6px; letter-spacing: -0.01em; }
  .card .hint { color: var(--muted); font-size: 12px; margin-top: 4px; }
  .highlight { background: linear-gradient(135deg, var(--card), color-mix(in oklab, var(--accent) 12%, var(--card))); }
  .bar-section { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px; margin-bottom: 24px; }
  .bar-section h2 { margin: 0 0 8px; font-size: 16px; }
  .bar-section .pct { color: var(--ok); font-weight: 700; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
  tbody tr:last-child td { border-bottom: 0; }
  td:nth-child(3), td:nth-child(4) { font-variant-numeric: tabular-nums; }
  footer { color: var(--muted); font-size: 12px; margin-top: 24px; text-align: center; }
  footer a { color: var(--accent); text-decoration: none; }
  .theme-toggle {
    margin-left: auto; border: 1px solid var(--line); background: var(--card); color: var(--text);
    border-radius: 8px; padding: 6px 12px; cursor: pointer; font: inherit;
  }
  .empty { background: var(--card); border: 1px dashed var(--line); border-radius: 14px; padding: 28px; text-align: center; color: var(--muted); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1><span class="brand">compress-token</span> — economia acumulada</h1>
    <span class="sub">${generatedAt}</span>
    <button class="theme-toggle" onclick="toggleTheme()">tema</button>
  </header>

  ${stats.totalRequests === 0 ? `
  <div class="empty">
    Ainda não há dados. Rode qualquer tool do compress-token (ex.: <code>compress_context</code>)
    e abra o dashboard de novo.
  </div>` : `
  <section class="grid">
    <div class="card highlight">
      <div class="label">Tokens economizados</div>
      <div class="value">${fmtInt(stats.totalSavedTokens)}</div>
      <div class="hint">no total acumulado</div>
    </div>
    <div class="card">
      <div class="label">Requisições processadas</div>
      <div class="value">${fmtInt(stats.totalRequests)}</div>
      <div class="hint">tools chamadas</div>
    </div>
    <div class="card">
      <div class="label">Tokens originais</div>
      <div class="value">${fmtInt(stats.totalOriginalTokens)}</div>
      <div class="hint">antes da compressão</div>
    </div>
    <div class="card highlight">
      <div class="label">Economia estimada (Sonnet 4.5)</div>
      <div class="value">${fmtUsd(costUsd)}</div>
      <div class="hint">≈ ${fmtBrl(costBrl)} (USD→BRL ${USD_TO_BRL.toFixed(2)})</div>
    </div>
  </section>

  <section class="bar-section">
    <h2>Taxa média de compressão <span class="pct">${avg}%</span></h2>
    ${renderBar(avg)}
  </section>

  <section class="bar-section">
    <h2>Economia por modelo</h2>
    <table>
      <thead>
        <tr><th>Modelo</th><th>Preço input</th><th>USD economizado</th><th>BRL equivalente</th></tr>
      </thead>
      <tbody>
        ${renderPriceRows(stats.totalSavedTokens)}
      </tbody>
    </table>
  </section>`}

  <footer>
    gerado por <code>compress-token-dashboard</code> · dados de <code>~/.compress-token-stats.json</code> ·
    <a href="https://github.com/F7BRASIL/Compress-token">GitHub</a>
  </footer>
</div>
<script>
  function toggleTheme() {
    const r = document.documentElement;
    const now = r.getAttribute('data-theme');
    const next = now === 'light' ? 'dark' : (now === 'dark' ? '' : 'light');
    if (next) r.setAttribute('data-theme', next); else r.removeAttribute('data-theme');
    try { localStorage.setItem('ct-theme', next || ''); } catch {}
  }
  try {
    const saved = localStorage.getItem('ct-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  } catch {}
</script>
</body>
</html>`;
}

function parseArgs(argv: string[]): { open: boolean; out: string } {
  let open = true;
  let out = join(homedir(), '.compress-token-dashboard.html');
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-open') open = false;
    else if (a === '--out' && argv[i + 1]) { out = argv[i + 1]; i++; }
  }
  return { open, out };
}

function openInBrowser(file: string): void {
  const url = 'file://' + file.replace(/\\/g, '/');
  const plat = platform();
  try {
    if (plat === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (plat === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* silencioso */
  }
}

function main(): void {
  const { open, out } = parseArgs(process.argv.slice(2));
  const stats = loadStats();
  const html = renderHtml(stats);
  writeFileSync(out, html, 'utf-8');
  process.stdout.write(`Dashboard gerado: ${out}\n`);
  if (open) openInBrowser(out);
}

main();
