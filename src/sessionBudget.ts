import { estimateTokens } from './metrics.js';
import { compress } from './compressor.js';

// Claude Code compacts around 90k tokens context window (conservative threshold)
const COMPACTION_THRESHOLD = 90_000;
const WARN_AT_PERCENT = 0.70;
const CRITICAL_AT_PERCENT = 0.85;

export interface SessionBudgetResult {
  estimatedTokens: number;
  threshold: number;
  usedPercent: number;
  status: 'ok' | 'warn' | 'critical';
  recommendation: string;
  compressedText?: string;
  savedTokens?: number;
}

export function checkSessionBudget(
  conversationText: string,
  autoCompress = false
): SessionBudgetResult {
  const estimatedTokens = estimateTokens(conversationText);
  const usedPercent = estimatedTokens / COMPACTION_THRESHOLD;
  const usedPct = Math.round(usedPercent * 100);

  let status: 'ok' | 'warn' | 'critical';
  let recommendation: string;

  if (usedPercent >= CRITICAL_AT_PERCENT) {
    status = 'critical';
    recommendation =
      `⚠️ Contexto em ${usedPct}% do limite (${estimatedTokens.toLocaleString('pt-BR')} / ${COMPACTION_THRESHOLD.toLocaleString('pt-BR')} tokens estimados). ` +
      `Compactação automática do Claude Code é iminente (~${Math.round((COMPACTION_THRESHOLD - estimatedTokens) / 1000)}k tokens restantes). ` +
      `Chame session_budget com autoCompress=true para compactar agora e evitar a espera.`;
  } else if (usedPercent >= WARN_AT_PERCENT) {
    status = 'warn';
    recommendation =
      `🔶 Contexto em ${usedPct}% do limite (${estimatedTokens.toLocaleString('pt-BR')} / ${COMPACTION_THRESHOLD.toLocaleString('pt-BR')} tokens estimados). ` +
      `Considere chamar session_budget com autoCompress=true para compactar preventivamente.`;
  } else {
    status = 'ok';
    recommendation =
      `✅ Contexto em ${usedPct}% do limite (${estimatedTokens.toLocaleString('pt-BR')} / ${COMPACTION_THRESHOLD.toLocaleString('pt-BR')} tokens estimados). Nenhuma ação necessária.`;
  }

  if (autoCompress && status !== 'ok') {
    const compressed = compress(conversationText, 'auto');
    const savedTokens = Math.max(0, estimatedTokens - estimateTokens(compressed));
    const newPct = Math.round(((estimatedTokens - savedTokens) / COMPACTION_THRESHOLD) * 100);
    recommendation +=
      `\n\n🗜 Compressão aplicada: ${savedTokens.toLocaleString('pt-BR')} tokens economizados.` +
      ` Contexto reduzido para ~${newPct}% do limite.`;
    return { estimatedTokens, threshold: COMPACTION_THRESHOLD, usedPercent, status, recommendation, compressedText: compressed, savedTokens };
  }

  return { estimatedTokens, threshold: COMPACTION_THRESHOLD, usedPercent, status, recommendation };
}
