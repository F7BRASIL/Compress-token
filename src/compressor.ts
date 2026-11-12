// Strip ANSI color/escape codes
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[mGKHF]/g, '');
}

// Collapse consecutive duplicate lines into [xN repetições]
function collapseDuplicateLines(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let count = 1;
    while (i + count < lines.length && lines[i + count] === line) {
      count++;
    }
    if (count > 2) {
      result.push(line);
      result.push(`[x${count} repetições]`);
    } else {
      for (let j = 0; j < count; j++) result.push(line);
    }
    i += count;
  }
  return result.join('\n');
}

// Remove excessive blank lines (more than 1 consecutive)
function removeExcessiveBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

// Remove trailing whitespace from each line
function trimLines(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n');
}

export function compressLog(text: string): string {
  let result = stripAnsi(text);
  result = collapseDuplicateLines(result);
  result = removeExcessiveBlankLines(result);
  result = trimLines(result);
  return result.trim();
}

// Remove block comments (/* ... */) and line comments (//) that are standalone lines
// Preserves inline comments on code lines to avoid breaking syntax
function removeStandaloneComments(text: string): string {
  // Remove block comments
  let result = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove standalone comment lines (line starts with optional whitespace then //)
  result = result
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  return result;
}

export function minifyCode(text: string): string {
  let result = removeStandaloneComments(text);
  result = removeExcessiveBlankLines(result);
  result = trimLines(result);
  return result.trim();
}

// Remove redundant connectives from prose
const REDUNDANT_CONNECTIVES = [
  /\b(basicamente|literalmente|obviamente|claramente|certamente|simplesmente|apenas|somente)\b\s*/gi,
  /\b(como mencionado anteriormente|como dito antes|conforme descrito acima)\b[,.]?\s*/gi,
  /\b(em outras palavras|ou seja|isto é|quer dizer)\b[,]?\s*/gi,
  /\b(a fim de que|com o objetivo de|com a finalidade de)\b\s*/gi,
  /\b(it should be noted that|please note that|note that)\b[,:]?\s*/gi,
];

export function compressText(text: string): string {
  let result = text;
  for (const pattern of REDUNDANT_CONNECTIVES) {
    result = result.replace(pattern, '');
  }
  result = removeExcessiveBlankLines(result);
  result = trimLines(result);
  return result.trim();
}

export type ContentType = 'log' | 'code' | 'text' | 'auto';

function detectContentType(text: string): 'log' | 'code' | 'text' {
  // Detect ANSI or typical log patterns
  // eslint-disable-next-line no-control-regex
  if (/\x1b\[/.test(text) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m.test(text)) return 'log';
  // Detect code by presence of common syntax patterns
  if (
    /^\s*(import|export|function|class|const|let|var|def |public |private |async )/m.test(text) ||
    /[{};]\s*$/.test(text)
  )
    return 'code';
  return 'text';
}

export function compress(text: string, type: ContentType = 'auto'): string {
  const resolved = type === 'auto' ? detectContentType(text) : type;
  if (resolved === 'log') return compressLog(text);
  if (resolved === 'code') return minifyCode(text);
  return compressText(text);
}
