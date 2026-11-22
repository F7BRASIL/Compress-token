/**
 * Semantic-ish cache — v1 sem embeddings externos.
 *
 * Normaliza + extrai n-gramas de caracteres + similaridade Jaccard.
 * Zero-dep: funciona imediatamente, sem download de modelo nem API.
 * v2 vai trocar o matcher por embeddings reais (Voyage/Transformers) atrás
 * da mesma interface — a assinatura das tools MCP permanece.
 *
 * Storage: ~/.compress-token-cache.json
 *   { version, entries: [{ id, prompt, response, model, tags, savedTokens, createdAt, lastHitAt, hits }] }
 *
 * Limites padrão:
 *   - 1000 entries (LRU por `lastHitAt`)
 *   - 50 KB por response
 *   - threshold 0.82 (ajustável por chamada)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { estimateTokens, recordSaved } from './metrics.js';

const CACHE_FILE = join(homedir(), '.compress-token-cache.json');
const MAX_ENTRIES = 1000;
const MAX_RESPONSE_CHARS = 50_000;
/* Threshold combina char-trigrams + word-bigrams (média); 0.55 pega paráfrases
   típicas ("qual taxa Itaú?" vs "qual a taxa do Itaú") sem falsos positivos óbvios. */
const DEFAULT_THRESHOLD = 0.55;
const NGRAM_SIZE = 3;

export interface CacheEntry {
  id: string;
  prompt: string;
  response: string;
  model: string | null;
  tags: string[];
  savedTokens: number;
  createdAt: number;
  lastHitAt: number;
  hits: number;
}

interface CacheFile {
  version: 1;
  entries: CacheEntry[];
}

function emptyFile(): CacheFile {
  return { version: 1, entries: [] };
}

function loadFile(): CacheFile {
  if (!existsSync(CACHE_FILE)) return emptyFile();
  try {
    const parsed = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CacheFile;
    if (!parsed || !Array.isArray(parsed.entries)) return emptyFile();
    return { version: 1, entries: parsed.entries };
  } catch {
    return emptyFile();
  }
}

function saveFile(file: CacheFile): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(file, null, 2), 'utf-8');
  } catch {
    /* home não gravável — silencioso */
  }
}

function hashId(prompt: string, model: string | null): string {
  const h = createHash('sha256');
  h.update(prompt);
  if (model) h.update('\u0000' + model);
  return h.digest('hex').slice(0, 16);
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ngrams(text: string, n: number): Set<string> {
  const out = new Set<string>();
  const t = ' ' + text + ' ';
  if (t.length < n) {
    out.add(t);
    return out;
  }
  for (let i = 0; i <= t.length - n; i++) out.add(t.slice(i, i + n));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/* Stopwords curtas em pt-BR + inglês. Mantém o sinal nas palavras-conteúdo. */
const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'pra', 'com', 'e', 'ou', 'que',
  'se', 'ao', 'aos', 'as', 'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and',
  'or', 'at', 'is', 'be', 'it', 'this', 'that',
]);

function wordBigrams(text: string): Set<string> {
  const words = normalize(text)
    .split(' ')
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  const out = new Set<string>();
  if (words.length === 0) return out;
  if (words.length === 1) {
    out.add(words[0]);
    return out;
  }
  for (let i = 0; i < words.length - 1; i++) out.add(`${words[i]} ${words[i + 1]}`);
  for (const w of words) out.add(w);
  return out;
}

interface SimBundle {
  charGrams: Set<string>;
  wordGrams: Set<string>;
}

function buildSimBundle(text: string): SimBundle {
  return {
    charGrams: ngrams(normalize(text), NGRAM_SIZE),
    wordGrams: wordBigrams(text),
  };
}

function similarityBundle(a: SimBundle, b: SimBundle): number {
  const cs = jaccard(a.charGrams, b.charGrams);
  const ws = jaccard(a.wordGrams, b.wordGrams);
  /* Peso maior nos tokens (palavras-conteúdo) — robusto a stopwords diferentes. */
  return 0.35 * cs + 0.65 * ws;
}

export function similarity(a: string, b: string): number {
  return similarityBundle(buildSimBundle(a), buildSimBundle(b));
}

export interface GetOptions {
  model?: string | null;
  tags?: string[];
  threshold?: number;
}

export interface GetResult {
  hit: boolean;
  entry?: CacheEntry;
  similarity?: number;
  threshold: number;
  checked: number;
}

export function cacheGet(prompt: string, opts: GetOptions = {}): GetResult {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const file = loadFile();
  const requiredTags = new Set(opts.tags ?? []);
  const candidates = file.entries.filter((e) => {
    if (opts.model && e.model && e.model !== opts.model) return false;
    if (requiredTags.size > 0) {
      for (const t of requiredTags) if (!e.tags.includes(t)) return false;
    }
    return true;
  });
  let best: { entry: CacheEntry; sim: number } | null = null;
  const promptBundle = buildSimBundle(prompt);
  for (const entry of candidates) {
    const sim = similarityBundle(promptBundle, buildSimBundle(entry.prompt));
    if (!best || sim > best.sim) best = { entry, sim };
  }
  if (!best || best.sim < threshold) {
    return { hit: false, threshold, checked: candidates.length };
  }
  best.entry.hits += 1;
  best.entry.lastHitAt = Date.now();
  saveFile(file);
  recordSaved(
    best.entry.savedTokens + estimateTokens(prompt),
    estimateTokens(prompt),
  );
  return { hit: true, entry: best.entry, similarity: best.sim, threshold, checked: candidates.length };
}

export interface SetOptions {
  model?: string | null;
  tags?: string[];
}

export function cacheSet(prompt: string, response: string, opts: SetOptions = {}): CacheEntry {
  const file = loadFile();
  const now = Date.now();
  const model = opts.model ?? null;
  const trimmedResponse = response.length > MAX_RESPONSE_CHARS
    ? response.slice(0, MAX_RESPONSE_CHARS) + `\n…[truncado ${response.length - MAX_RESPONSE_CHARS} chars]`
    : response;
  const entry: CacheEntry = {
    id: hashId(prompt, model),
    prompt,
    response: trimmedResponse,
    model,
    tags: opts.tags ?? [],
    savedTokens: estimateTokens(response),
    createdAt: now,
    lastHitAt: now,
    hits: 0,
  };
  const existingIdx = file.entries.findIndex((e) => e.id === entry.id);
  if (existingIdx >= 0) {
    entry.createdAt = file.entries[existingIdx].createdAt;
    entry.hits = file.entries[existingIdx].hits;
    file.entries[existingIdx] = entry;
  } else {
    file.entries.push(entry);
  }
  /* LRU: mantém só MAX_ENTRIES mais recentes por lastHitAt. */
  if (file.entries.length > MAX_ENTRIES) {
    file.entries.sort((a, b) => b.lastHitAt - a.lastHitAt);
    file.entries = file.entries.slice(0, MAX_ENTRIES);
  }
  saveFile(file);
  return entry;
}

export interface CacheReport {
  entries: number;
  totalHits: number;
  totalSavedTokensIfHit: number;
  topHit: CacheEntry | null;
  oldestEntryAt: number | null;
  newestEntryAt: number | null;
}

export function cacheReport(): CacheReport {
  const file = loadFile();
  if (file.entries.length === 0) {
    return {
      entries: 0,
      totalHits: 0,
      totalSavedTokensIfHit: 0,
      topHit: null,
      oldestEntryAt: null,
      newestEntryAt: null,
    };
  }
  let totalHits = 0;
  let totalSaved = 0;
  let top: CacheEntry | null = null;
  let oldest = Number.POSITIVE_INFINITY;
  let newest = 0;
  for (const e of file.entries) {
    totalHits += e.hits;
    totalSaved += e.savedTokens * e.hits;
    if (!top || e.hits > top.hits) top = e;
    if (e.createdAt < oldest) oldest = e.createdAt;
    if (e.createdAt > newest) newest = e.createdAt;
  }
  return {
    entries: file.entries.length,
    totalHits,
    totalSavedTokensIfHit: totalSaved,
    topHit: top,
    oldestEntryAt: Number.isFinite(oldest) ? oldest : null,
    newestEntryAt: newest || null,
  };
}

export function cacheClear(): number {
  const n = loadFile().entries.length;
  saveFile(emptyFile());
  return n;
}

export function formatCacheReport(r: CacheReport): string {
  if (r.entries === 0) return '🗂  Cache vazio.';
  const lines = [
    '🗂  compress-token — semantic cache',
    '',
    `Entradas         : ${r.entries}`,
    `Hits acumulados  : ${r.totalHits}`,
    `Tokens economizados por hits : ${r.totalSavedTokensIfHit.toLocaleString('pt-BR')}`,
  ];
  if (r.topHit) {
    const tagStr = r.topHit.tags.length ? ` (tags: ${r.topHit.tags.join(', ')})` : '';
    lines.push(`Mais quente      : ${r.topHit.hits} hits — "${r.topHit.prompt.slice(0, 60)}${r.topHit.prompt.length > 60 ? '…' : ''}"${tagStr}`);
  }
  return lines.join('\n');
}
