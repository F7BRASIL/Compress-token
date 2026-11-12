#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { compress } from './compressor.js';
import { calculateMetrics, recordMetrics, formatMetricsReport, loadStats } from './metrics.js';
import { smartRead } from './contextManager.js';
import { compressImage, formatImageReport } from './imageCompressor.js';
import { compressStacktrace, formatStacktraceReport } from './stacktraceCompressor.js';
import { compressCsv } from './csvCompressor.js';
import { compressJson, formatJsonReport } from './jsonCompressor.js';
import { checkSessionBudget } from './sessionBudget.js';

const server = new Server(
  { name: 'compress-token', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'smart_read',
      description:
        'Lê um arquivo com cache SHA-256 para evitar re-leituras. Suporta modo full (comprimido), outline (apenas estrutura: funções, classes, cabeçalhos) e slice (trecho de linhas). Economiza até 85% de tokens em arquivos grandes.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Caminho absoluto ou relativo do arquivo a ser lido.',
          },
          mode: {
            type: 'string',
            enum: ['full', 'outline', 'slice'],
            description:
              'full = conteúdo comprimido (padrão), outline = apenas assinaturas/estrutura, slice = intervalo de linhas.',
          },
          startLine: {
            type: 'number',
            description: 'Linha inicial (modo slice, começa em 1).',
          },
          endLine: {
            type: 'number',
            description: 'Linha final (modo slice, inclusiva).',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'compress_context',
      description:
        'Recebe qualquer texto — log de erro, histórico de conversa, saída de comando, trecho de código — e devolve a versão compactada junto com métricas de economia de tokens.',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Texto a ser comprimido.',
          },
          type: {
            type: 'string',
            enum: ['auto', 'log', 'code', 'text'],
            description:
              'Tipo do conteúdo para escolha da estratégia. auto detecta automaticamente (padrão).',
          },
        },
        required: ['text'],
      },
    },
    {
      name: 'compress_image',
      description:
        'Redimensiona e comprime uma imagem (JPG, PNG, WebP, GIF, TIFF, AVIF) para reduzir tokens de visão enviados ao modelo. Salva o resultado ao lado do original com sufixo _compressed. Retorna o caminho da imagem comprimida e as métricas de economia.',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Caminho absoluto ou relativo da imagem.',
          },
          maxWidth: {
            type: 'number',
            description: 'Largura máxima em pixels (padrão: 1280). A imagem não será ampliada.',
          },
          maxHeight: {
            type: 'number',
            description: 'Altura máxima em pixels (padrão: 1280). A imagem não será ampliada.',
          },
          quality: {
            type: 'number',
            description: 'Qualidade de compressão de 1 a 100 (padrão: 80).',
          },
          outputPath: {
            type: 'string',
            description: 'Caminho de saída personalizado. Se omitido, salva ao lado do original com sufixo _compressed.',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'compress_stacktrace',
      description:
        'Remove frames internos de node_modules, node:internal e bibliotecas de terceiros de um stack trace, mantendo apenas os frames do código do usuário. Ideal para colar erros longos sem poluir o contexto.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Stack trace completo a ser comprimido.' },
        },
        required: ['text'],
      },
    },
    {
      name: 'compress_csv',
      description:
        'Resume um CSV em shape, tipos de coluna, estatísticas básicas e amostra das primeiras linhas — em vez de enviar o arquivo inteiro. Suporta separadores , ; tab |.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Conteúdo do CSV como string.' },
          sampleRows: { type: 'number', description: 'Quantas linhas de amostra incluir (padrão: 5).' },
        },
        required: ['text'],
      },
    },
    {
      name: 'compress_json',
      description:
        'Comprime um JSON removendo campos nulos, truncando strings longas e limitando arrays grandes — mantendo a estrutura legível. Útil para respostas de API extensas.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Conteúdo JSON como string.' },
          maxStringLength: { type: 'number', description: 'Tamanho máximo de strings (padrão: 200).' },
          maxArrayItems: { type: 'number', description: 'Máximo de itens por array (padrão: 5).' },
          removeNulls: { type: 'boolean', description: 'Remove campos nulos (padrão: true).' },
          maxDepth: { type: 'number', description: 'Profundidade máxima de objetos (padrão: 8).' },
        },
        required: ['text'],
      },
    },
    {
      name: 'session_budget',
      description:
        'Analisa o tamanho estimado do contexto da sessão e avisa quando está próximo do limite de compactação automática do Claude Code (~90k tokens). Use isso proativamente para evitar a espera de ~1 minuto que acontece quando o Claude Code força a compactação. Com autoCompress=true, comprime o texto recebido e retorna a versão menor junto com as métricas.',
      inputSchema: {
        type: 'object',
        properties: {
          conversationText: {
            type: 'string',
            description: 'Trecho do histórico ou contexto atual da conversa para estimar o uso.',
          },
          autoCompress: {
            type: 'boolean',
            description: 'Se true e o contexto estiver em nível warn ou critical, comprime o texto automaticamente e retorna a versão reduzida. Padrão: false.',
          },
        },
        required: ['conversationText'],
      },
    },
    {
      name: 'token_savings_report',
      description:
        'Retorna um relatório com o total de tokens economizados na sessão e no histórico persistido em ~/.compress-token-stats.json.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

// Tool handlers
const SmartReadInput = z.object({
  filePath: z.string(),
  mode: z.enum(['full', 'outline', 'slice']).optional().default('full'),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
});

const CompressContextInput = z.object({
  text: z.string(),
  type: z.enum(['auto', 'log', 'code', 'text']).optional().default('auto'),
});

const CompressStacktraceInput = z.object({
  text: z.string(),
});

const CompressCsvInput = z.object({
  text: z.string(),
  sampleRows: z.number().int().positive().optional(),
});

const CompressJsonInput = z.object({
  text: z.string(),
  maxStringLength: z.number().int().positive().optional(),
  maxArrayItems: z.number().int().positive().optional(),
  removeNulls: z.boolean().optional(),
  maxDepth: z.number().int().positive().optional(),
});

const SessionBudgetInput = z.object({
  conversationText: z.string(),
  autoCompress: z.boolean().optional().default(false),
});

const CompressImageInput = z.object({
  filePath: z.string(),
  maxWidth: z.number().int().positive().optional(),
  maxHeight: z.number().int().positive().optional(),
  quality: z.number().int().min(1).max(100).optional(),
  outputPath: z.string().optional(),
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'smart_read') {
    const input = SmartReadInput.parse(args);
    try {
      const result = smartRead(input.filePath, input.mode, input.startLine, input.endLine);
      const lines = [result.content];
      if (!result.fromCache) {
        lines.push('');
        lines.push(`💾 Modo: ${result.mode} | Tokens economizados nesta leitura: ${result.savedTokens}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Erro ao ler arquivo: ${msg}` }], isError: true };
    }
  }

  if (name === 'compress_context') {
    const input = CompressContextInput.parse(args);
    const compressed = compress(input.text, input.type);
    const metrics = calculateMetrics(input.text, compressed);
    recordMetrics(metrics);
    return {
      content: [
        {
          type: 'text',
          text: `${compressed}\n\n---\n${formatMetricsReport(metrics)}`,
        },
      ],
    };
  }

  if (name === 'compress_stacktrace') {
    const input = CompressStacktraceInput.parse(args);
    const result = compressStacktrace(input.text);
    return { content: [{ type: 'text', text: formatStacktraceReport(result) }] };
  }

  if (name === 'compress_csv') {
    const input = CompressCsvInput.parse(args);
    const result = compressCsv(input.text, input.sampleRows);
    const savings = Math.round(((input.text.length - result.report.length) / input.text.length) * 100);
    return {
      content: [{
        type: 'text',
        text: result.report + `\n\n📋 Linhas originais: ${result.originalLines} → resumo em ${result.reportLines} linhas (economizou ~${Math.max(0, savings)}% de chars)`,
      }],
    };
  }

  if (name === 'compress_json') {
    const input = CompressJsonInput.parse(args);
    const result = compressJson(input.text, {
      maxStringLength: input.maxStringLength,
      maxArrayItems: input.maxArrayItems,
      removeNulls: input.removeNulls,
      maxDepth: input.maxDepth,
    });
    return { content: [{ type: 'text', text: formatJsonReport(result) }] };
  }

  if (name === 'compress_image') {
    const input = CompressImageInput.parse(args);
    try {
      const result = await compressImage(input.filePath, {
        maxWidth: input.maxWidth,
        maxHeight: input.maxHeight,
        quality: input.quality,
        outputPath: input.outputPath,
      });
      return { content: [{ type: 'text', text: formatImageReport(result) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text', text: `Erro ao comprimir imagem: ${msg}` }], isError: true };
    }
  }

  if (name === 'session_budget') {
    const input = SessionBudgetInput.parse(args);
    const result = checkSessionBudget(input.conversationText, input.autoCompress);
    const lines = [result.recommendation];
    if (result.compressedText) {
      lines.push('', '--- Texto comprimido ---', result.compressedText);
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  if (name === 'token_savings_report') {
    const stats = loadStats();
    const report = [
      '📈 Relatório de Economia de Tokens — Compress-token',
      '',
      `Total de requisições processadas : ${stats.totalRequests}`,
      `Tokens originais acumulados      : ${stats.totalOriginalTokens.toLocaleString('pt-BR')}`,
      `Tokens economizados (total)      : ${stats.totalSavedTokens.toLocaleString('pt-BR')}`,
      `Percentual médio de economia     : ${stats.averageSavingPercent}%`,
      '',
      `📁 Dados em: ~/.compress-token-stats.json`,
    ].join('\n');
    return { content: [{ type: 'text', text: report }] };
  }

  return {
    content: [{ type: 'text', text: `Ferramenta desconhecida: ${name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until process exits; no console output to avoid corrupting stdio MCP stream
}

main().catch((err) => {
  process.stderr.write(`compress-token fatal: ${String(err)}\n`);
  process.exit(1);
});
