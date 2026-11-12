import { existsSync, statSync } from 'fs';
import { dirname, extname, basename, join } from 'path';

// sharp is a native module — import dynamically to give a clear error if not installed
async function getSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch {
    throw new Error('Dependência "sharp" não encontrada. Execute: npm install sharp');
  }
}

export interface ImageCompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 1–100, padrão 80
  outputPath?: string; // se omitido, salva ao lado do original com sufixo _compressed
}

export interface ImageCompressResult {
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercent: number;
  originalDimensions: { width: number; height: number };
  finalDimensions: { width: number; height: number };
  // Tokens de visão estimados (modelo Claude: tiles 512x512 ~1600 tokens cada)
  estimatedOriginalTokens: number;
  estimatedCompressedTokens: number;
  estimatedSavedTokens: number;
}

function estimateVisionTokens(width: number, height: number): number {
  // Claude resize: encaixa em 1568x1568 mantendo proporção
  const maxDim = 1568;
  let w = width;
  let h = height;
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  const tilesX = Math.ceil(w / 512);
  const tilesY = Math.ceil(h / 512);
  return tilesX * tilesY * 1600;
}

function resolveOutputPath(inputPath: string, outputPath?: string): string {
  if (outputPath) return outputPath;
  const dir = dirname(inputPath);
  const ext = extname(inputPath);
  const name = basename(inputPath, ext);
  const outExt = ext.toLowerCase() === '.png' ? '.png' : '.jpg';
  return join(dir, `${name}_compressed${outExt}`);
}

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.avif']);

export async function compressImage(
  inputPath: string,
  options: ImageCompressOptions = {}
): Promise<ImageCompressResult> {
  if (!existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  const ext = extname(inputPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Formato não suportado: ${ext}. Formatos aceitos: ${[...SUPPORTED_EXTENSIONS].join(', ')}`
    );
  }

  const sharp = await getSharp();
  const { maxWidth = 1280, maxHeight = 1280, quality = 80 } = options;
  const outputPath = resolveOutputPath(inputPath, options.outputPath);
  const originalSize = statSync(inputPath).size;

  const image = sharp(inputPath);
  const meta = await image.metadata();
  const origW = meta.width ?? 0;
  const origH = meta.height ?? 0;

  let pipeline = image.resize(maxWidth, maxHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (ext === '.png') {
    pipeline = pipeline.png({ quality, compressionLevel: 9 });
  } else if (ext === '.webp' || ext === '.avif') {
    pipeline = pipeline.webp({ quality });
  } else {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  const outputBuffer = await pipeline.toBuffer({ resolveWithObject: true });
  await sharp(outputBuffer.data).toFile(outputPath);

  const compressedSize = statSync(outputPath).size;
  const savedBytes = Math.max(0, originalSize - compressedSize);
  const savedPercent = Math.round((savedBytes / originalSize) * 100);

  const finalW = outputBuffer.info.width;
  const finalH = outputBuffer.info.height;

  const estimatedOriginalTokens = estimateVisionTokens(origW, origH);
  const estimatedCompressedTokens = estimateVisionTokens(finalW, finalH);
  const estimatedSavedTokens = Math.max(0, estimatedOriginalTokens - estimatedCompressedTokens);

  return {
    outputPath,
    originalSize,
    compressedSize,
    savedBytes,
    savedPercent,
    originalDimensions: { width: origW, height: origH },
    finalDimensions: { width: finalW, height: finalH },
    estimatedOriginalTokens,
    estimatedCompressedTokens,
    estimatedSavedTokens,
  };
}

export function formatImageReport(r: ImageCompressResult): string {
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  return [
    `🖼️  Arquivo salvo em: ${r.outputPath}`,
    `📐 Dimensões: ${r.originalDimensions.width}×${r.originalDimensions.height} → ${r.finalDimensions.width}×${r.finalDimensions.height}`,
    `💾 Tamanho: ${kb(r.originalSize)} → ${kb(r.compressedSize)} (economizou ${kb(r.savedBytes)} · ${r.savedPercent}%)`,
    `🪙 Tokens de visão estimados: ${r.estimatedOriginalTokens.toLocaleString('pt-BR')} → ${r.estimatedCompressedTokens.toLocaleString('pt-BR')} (economizou ${r.estimatedSavedTokens.toLocaleString('pt-BR')} tokens)`,
  ].join('\n');
}
