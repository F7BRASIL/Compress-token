export interface CsvSummary {
  report: string;
  originalLines: number;
  reportLines: number;
}

function parseRow(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectSeparator(firstLine: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  for (const ch of firstLine) {
    if (ch in counts) counts[ch as keyof typeof counts]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function inferType(values: string[]): string {
  const nonEmpty = values.filter((v) => v !== '' && v !== 'null' && v !== 'NULL' && v !== 'N/A');
  if (nonEmpty.length === 0) return 'vazio';
  const allNumeric = nonEmpty.every((v) => !isNaN(Number(v)));
  if (allNumeric) return 'número';
  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
  if (nonEmpty.every((v) => datePattern.test(v))) return 'data';
  const uniq = new Set(nonEmpty);
  if (uniq.size <= Math.min(10, nonEmpty.length * 0.1)) return `categoria (${uniq.size} valores)`;
  return 'texto';
}

function numericStats(values: string[]): string {
  const nums = values.map(Number).filter((n) => !isNaN(n));
  if (nums.length === 0) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return `min=${min.toLocaleString('pt-BR')} max=${max.toLocaleString('pt-BR')} média=${avg.toFixed(2)}`;
}

export function compressCsv(text: string, sampleRows = 5): CsvSummary {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    return { report: '[CSV vazio]', originalLines: 0, reportLines: 1 };
  }

  const sep = detectSeparator(lines[0]);
  const headers = parseRow(lines[0], sep);
  const dataLines = lines.slice(1);
  const totalRows = dataLines.length;

  // Build column data
  const columns: string[][] = headers.map(() => []);
  for (const line of dataLines) {
    const row = parseRow(line, sep);
    headers.forEach((_, i) => {
      columns[i].push(row[i] ?? '');
    });
  }

  const report: string[] = [
    `📊 CSV — ${totalRows.toLocaleString('pt-BR')} linhas × ${headers.length} colunas`,
    `Separador: "${sep === '\t' ? '\\t' : sep}"`,
    '',
    '## Colunas',
  ];

  for (let i = 0; i < headers.length; i++) {
    const vals = columns[i];
    const nullCount = vals.filter((v) => v === '' || v === 'null' || v === 'NULL' || v === 'N/A').length;
    const type = inferType(vals);
    const nullInfo = nullCount > 0 ? ` | nulos: ${nullCount}` : '';
    const stats = type === 'número' ? ` | ${numericStats(vals)}` : '';
    report.push(`  ${i + 1}. ${headers[i]} [${type}${nullInfo}${stats}]`);
  }

  // Sample rows
  const sample = dataLines.slice(0, sampleRows);
  if (sample.length > 0) {
    report.push('', `## Amostra (${sample.length} de ${totalRows} linhas)`);
    report.push(lines[0]); // header
    sample.forEach((l) => report.push(l));
    if (totalRows > sampleRows) {
      report.push(`... mais ${totalRows - sampleRows} linhas omitidas`);
    }
  }

  const reportText = report.join('\n');
  return { report: reportText, originalLines: lines.length, reportLines: report.length };
}
