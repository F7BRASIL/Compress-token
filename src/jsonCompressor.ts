export interface JsonCompressOptions {
  maxStringLength?: number;  // trunca strings longas (padrão: 200)
  maxArrayItems?: number;    // mostra só N itens de arrays (padrão: 5)
  removeNulls?: boolean;     // remove campos null/undefined (padrão: true)
  maxDepth?: number;         // profundidade máxima (padrão: 8)
}

function truncateString(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `…[+${s.length - max} chars]`;
}

function compressValue(
  value: unknown,
  opts: Required<JsonCompressOptions>,
  depth: number
): unknown {
  if (depth > opts.maxDepth) return '[profundidade máxima atingida]';

  if (value === null || value === undefined) return opts.removeNulls ? undefined : null;

  if (typeof value === 'string') return truncateString(value, opts.maxStringLength);

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    const compressed = value
      .slice(0, opts.maxArrayItems)
      .map((item) => compressValue(item, opts, depth + 1))
      .filter((item) => item !== undefined);
    if (value.length > opts.maxArrayItems) {
      compressed.push(`[...+${value.length - opts.maxArrayItems} itens omitidos]`);
    }
    return compressed;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const compressed = compressValue(val, opts, depth + 1);
      if (compressed !== undefined) {
        result[key] = compressed;
      }
    }
    return result;
  }

  return value;
}

export interface JsonCompressResult {
  compressed: string;
  originalLength: number;
  compressedLength: number;
  savedPercent: number;
}

export function compressJson(
  text: string,
  options: JsonCompressOptions = {}
): JsonCompressResult {
  const opts: Required<JsonCompressOptions> = {
    maxStringLength: options.maxStringLength ?? 200,
    maxArrayItems: options.maxArrayItems ?? 5,
    removeNulls: options.removeNulls ?? true,
    maxDepth: options.maxDepth ?? 8,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not valid JSON — try to compress as text
    const trimmed = text.trim().replace(/\s{2,}/g, ' ');
    return {
      compressed: trimmed,
      originalLength: text.length,
      compressedLength: trimmed.length,
      savedPercent: Math.round(((text.length - trimmed.length) / text.length) * 100),
    };
  }

  const compressedValue = compressValue(parsed, opts, 0);
  const compressed = JSON.stringify(compressedValue, null, 2);
  const savedPercent = Math.round(((text.length - compressed.length) / text.length) * 100);

  return {
    compressed,
    originalLength: text.length,
    compressedLength: compressed.length,
    savedPercent: Math.max(0, savedPercent),
  };
}

export function formatJsonReport(r: JsonCompressResult): string {
  return (
    r.compressed +
    `\n\n📋 JSON: ${r.originalLength.toLocaleString('pt-BR')} → ` +
    `${r.compressedLength.toLocaleString('pt-BR')} chars (economizou ${r.savedPercent}%)`
  );
}
