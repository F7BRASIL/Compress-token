import { createHash } from 'crypto';
import { readFileSync, statSync, existsSync } from 'fs';
import { compress } from './compressor.js';
import { estimateTokens } from './metrics.js';

interface CacheEntry {
  hash: string;
  readAt: number;
  lineCount: number;
}

const fileCache = new Map<string, CacheEntry>();

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function readFile(filePath: string): string {
  if (!existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`);
  return readFileSync(filePath, 'utf-8');
}

function countLines(content: string): number {
  return content.split('\n').length;
}

// Extract structural outline: functions, classes, interfaces, methods, markdown headers
function extractOutline(content: string): string {
  const lines = content.split('\n');
  const outline: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    const isStructural =
      // Markdown headings
      /^#{1,6}\s/.test(trimmed) ||
      // TypeScript/JS: function declarations, arrow functions assigned to const/let
      /^(export\s+)?(async\s+)?function\s+\w+/.test(trimmed) ||
      /^(export\s+)?(const|let)\s+\w+\s*=\s*(async\s+)?\(/.test(trimmed) ||
      /^(export\s+)?(const|let)\s+\w+\s*=\s*(async\s+)?function/.test(trimmed) ||
      // Classes and interfaces
      /^(export\s+)?(abstract\s+)?class\s+\w+/.test(trimmed) ||
      /^(export\s+)?interface\s+\w+/.test(trimmed) ||
      /^(export\s+)?type\s+\w+\s*=/.test(trimmed) ||
      /^(export\s+)?enum\s+\w+/.test(trimmed) ||
      // Class methods (indented, public/private/protected or plain)
      /^\s*(public|private|protected|static|async)(\s+(public|private|protected|static|async))*\s+\w+\s*\(/.test(line) ||
      // Python def / class
      /^(async\s+)?def\s+\w+/.test(trimmed) ||
      /^class\s+\w+/.test(trimmed);

    if (isStructural) {
      outline.push(`${i + 1}: ${line.trimEnd()}`);
    }
  }

  return outline.length > 0
    ? `[OUTLINE — ${outline.length} símbolos de ${lines.length} linhas]\n` + outline.join('\n')
    : `[OUTLINE vazio — arquivo com ${lines.length} linhas sem símbolos estruturais detectados]`;
}

export type ReadMode = 'full' | 'outline' | 'slice';

export interface ReadResult {
  content: string;
  fromCache: boolean;
  savedTokens: number;
  mode: ReadMode;
}

export function smartRead(
  filePath: string,
  mode: ReadMode = 'full',
  startLine?: number,
  endLine?: number
): ReadResult {
  const raw = readFile(filePath);
  const hash = hashContent(raw);
  const lineCount = countLines(raw);
  const cached = fileCache.get(filePath);

  if (cached && cached.hash === hash && mode === 'full') {
    const originalTokens = estimateTokens(raw);
    fileCache.set(filePath, { hash, readAt: Date.now(), lineCount });
    const msg = `[Arquivo sem alterações desde a última leitura — economia de ${originalTokens} tokens]`;
    return { content: msg, fromCache: true, savedTokens: originalTokens, mode };
  }

  fileCache.set(filePath, { hash, readAt: Date.now(), lineCount });

  if (mode === 'outline') {
    const outline = extractOutline(raw);
    const savedTokens = Math.max(0, estimateTokens(raw) - estimateTokens(outline));
    return { content: outline, fromCache: false, savedTokens, mode };
  }

  if (mode === 'slice') {
    const lines = raw.split('\n');
    const start = Math.max(1, startLine ?? 1);
    const end = Math.min(lines.length, endLine ?? lines.length);
    const slice = lines.slice(start - 1, end).join('\n');
    const compressed = compress(slice, 'auto');
    const savedTokens = Math.max(0, estimateTokens(raw) - estimateTokens(compressed));
    return {
      content: `[Linhas ${start}–${end} de ${lines.length}]\n${compressed}`,
      fromCache: false,
      savedTokens,
      mode,
    };
  }

  // full mode — compress the content
  const compressed = compress(raw, 'auto');
  const savedTokens = Math.max(0, estimateTokens(raw) - estimateTokens(compressed));
  return { content: compressed, fromCache: false, savedTokens, mode };
}

export function clearCache(): void {
  fileCache.clear();
}

export function getCacheSize(): number {
  return fileCache.size;
}
