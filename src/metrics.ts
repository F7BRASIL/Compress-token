import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const STATS_FILE = join(homedir(), '.compress-token-stats.json');

interface Stats {
  totalRequests: number;
  totalOriginalTokens: number;
  totalSavedTokens: number;
  averageSavingPercent: number;
}

function emptyStats(): Stats {
  return {
    totalRequests: 0,
    totalOriginalTokens: 0,
    totalSavedTokens: 0,
    averageSavingPercent: 0,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function loadStats(): Stats {
  try {
    if (!existsSync(STATS_FILE)) return emptyStats();
    return JSON.parse(readFileSync(STATS_FILE, 'utf-8')) as Stats;
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: Stats): void {
  try {
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
  } catch {
    // silently ignore if home dir is not writable
  }
}

export interface CompressionMetrics {
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  savingPercent: number;
}

export function calculateMetrics(original: string, compressed: string): CompressionMetrics {
  const originalTokens = estimateTokens(original);
  const compressedTokens = estimateTokens(compressed);
  const savedTokens = Math.max(0, originalTokens - compressedTokens);
  const savingPercent = originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;
  return { originalTokens, compressedTokens, savedTokens, savingPercent };
}

export function recordMetrics(metrics: CompressionMetrics): void {
  const stats = loadStats();
  stats.totalRequests += 1;
  stats.totalOriginalTokens += metrics.originalTokens;
  stats.totalSavedTokens += metrics.savedTokens;
  stats.averageSavingPercent =
    stats.totalOriginalTokens > 0
      ? Math.round((stats.totalSavedTokens / stats.totalOriginalTokens) * 100)
      : 0;
  saveStats(stats);
}

export function formatMetricsReport(metrics: CompressionMetrics): string {
  return (
    `📊 Tokens originais: ${metrics.originalTokens} | ` +
    `Após compressão: ${metrics.compressedTokens} | ` +
    `Economizados: ${metrics.savedTokens} (${metrics.savingPercent}%)`
  );
}
