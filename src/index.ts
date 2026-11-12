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
