import fs from 'fs-extra';
import path from 'path';
import { sha256 } from 'js-sha256';
import { logger } from '../lib/logger.js';
import { ChunkSchema } from '../lib/schemas.js';
import { v4 as uuidv4 } from 'uuid';

function estimateTokens(text) {
  // Simple heuristic based on average English word/token ratio.
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 1.6));
}

async function writeJsonlEntry(base, entry) {
  const inboxFile = path.join(base, 'data', 'inbox.jsonl');
  await fs.ensureFile(inboxFile);
  await fs.appendFile(inboxFile, JSON.stringify(entry) + '\n');
}

async function listFiles(targetPath, recursive) {
  const results = [];
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    const dirents = await fs.readdir(targetPath, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(targetPath, dirent.name);
      if (dirent.isDirectory()) {
        if (recursive) {
          results.push(...(await listFiles(fullPath, true)));
        }
        continue;
      }
      results.push(fullPath);
    }
  } else {
    results.push(targetPath);
  }
  return results;
}

export async function ingestLocal(targetPath, options = {}) {
  const base = options.basePath
    ? path.resolve(options.basePath)
    : path.resolve('agent_drive');

  await fs.ensureDir(path.join(base, 'data'));

  const absoluteTarget = path.resolve(targetPath);

  let files = [];
  try {
    files = await listFiles(absoluteTarget, options.recursive ?? false);
  } catch (err) {
    logger.error('ingest:stat-error', { targetPath: absoluteTarget, err: err.message });
    return { processed: 0, chunks: 0, cacheHits: 0, jsonlEntries: 0 };
  }

  let processed = 0;
  let chunks = 0;
  let cacheHits = 0;
  let jsonlEntries = 0;

  for (const filePath of files) {
    try {
      if (!(await fs.pathExists(filePath))) {
        continue;
      }

      const content = await fs.readFile(filePath, 'utf8').catch(() => null);
      if (!content) {
        continue;
      }

      processed += 1;

      // Generate chunks by splitting on blank lines.
      const parts = content.split(/\n{2,}/).slice(0, 50);
      const docId = `local-${sha256(filePath).slice(0, 12)}`;

      for (let i = 0; i < parts.length; i += 1) {
        const text = parts[i].trim();
        if (!text) {
          continue;
        }

        const chunkHash = sha256(text);
        const chunk = {
          id: uuidv4(),
          documentId: docId,
          chunkHash,
          text,
          tokenCount: estimateTokens(text),
          position: i,
          createdAt: new Date().toISOString()
        };

        ChunkSchema.parse(chunk);

        await writeJsonlEntry(base, { type: 'chunk', data: chunk });
        jsonlEntries += 1;
        chunks += 1;
      }
    } catch (err) {
      logger.error('ingest:file-error', { filePath, err: err.message });
    }
  }

  return { processed, chunks, cacheHits, jsonlEntries };
}
