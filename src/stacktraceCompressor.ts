const NOISE_PATTERNS = [
  /node_modules/,
  /node:internal/,
  /node:events/,
  /node:async_hooks/,
  /<anonymous>/,
  /runMicrotasks/,
  /processTicksAndRejections/,
  /Module\._/,
  /Object\.<anonymous>/,
  /webpack(:|\/)/,
  /at Generator\./,
  /at new Promise/,
];

function isNoisyFrame(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

function isFrameLine(line: string): boolean {
  return /^\s+at /.test(line);
}

export interface StacktraceResult {
  compressed: string;
  originalLines: number;
  compressedLines: number;
  removedFrames: number;
}

export function compressStacktrace(text: string): StacktraceResult {
  const lines = text.split('\n');
  const result: string[] = [];
  let removedFrames = 0;
  let consecutiveNoise = 0;

  for (const line of lines) {
    if (isFrameLine(line)) {
      if (isNoisyFrame(line)) {
        removedFrames++;
        consecutiveNoise++;
        continue;
      }
      if (consecutiveNoise > 0) {
        result.push(`    ... ${consecutiveNoise} frame(s) internos omitidos`);
        consecutiveNoise = 0;
      }
      result.push(line);
    } else {
      if (consecutiveNoise > 0) {
        result.push(`    ... ${consecutiveNoise} frame(s) internos omitidos`);
        consecutiveNoise = 0;
      }
      result.push(line);
    }
  }

  if (consecutiveNoise > 0) {
    result.push(`    ... ${consecutiveNoise} frame(s) internos omitidos`);
  }

  // Remove duplicate consecutive error blocks
  const deduped: string[] = [];
  let i = 0;
  while (i < result.length) {
    deduped.push(result[i]);
    // Skip exact duplicate lines
    let count = 1;
    while (i + count < result.length && result[i + count] === result[i]) count++;
    if (count > 1) deduped.push(`[linha repetida x${count}]`);
    i += count;
  }

  const compressed = deduped.join('\n').trim();
  return {
    compressed,
    originalLines: lines.length,
    compressedLines: deduped.length,
    removedFrames,
  };
}

export function formatStacktraceReport(r: StacktraceResult): string {
  return (
    r.compressed +
    `\n\n📋 Frames removidos: ${r.removedFrames} internos | ` +
    `Linhas: ${r.originalLines} → ${r.compressedLines}`
  );
}
