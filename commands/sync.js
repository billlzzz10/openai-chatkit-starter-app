import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { logger } from '../lib/logger.js';

async function readInbox(base) {
  const inboxPath = path.join(base, 'data', 'inbox.jsonl');
  if (!(await fs.pathExists(inboxPath))) {
    return [];
  }
  const raw = await fs.readFile(inboxPath, 'utf8');
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function syncMetadata(config, options = {}) {
  const base = config.agentDrive || path.resolve('agent_drive');
  const entries = await readInbox(base);
  const docs = entries.filter((entry) => entry.type === 'doc').map((entry) => entry.data);
  const chunks = entries.filter((entry) => entry.type === 'chunk').map((entry) => entry.data);

  const documentsSynced = docs.length;
  let chunksSynced = 0;
  let skipped = 0;
  let errors = 0;

  if (options.dryRun) {
    return { documentsSynced, chunksSynced: chunks.length, skipped: 0, errors: 0 };
  }

  const url = `${config.apiUrl.replace(/\/+$/, '')}/jsonrpc`;
  const pageSize = 50;

  for (let i = 0; i < chunks.length; i += pageSize) {
    const batch = chunks.slice(i, i + pageSize);
    const payload = {
      jsonrpc: '2.0',
      id: `sync-${Date.now()}-${i}`,
      method: 'sync.metadata',
      params: {
        userId: config.userId || null,
        chunks: batch
      }
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.auth?.key || ''}`
        },
        body: JSON.stringify(payload),
        timeout: 30000
      });

      if (!res.ok) {
        errors += batch.length;
        logger.error('sync:batch-failed', { status: res.status, url });
        continue;
      }

      await res.json();
      chunksSynced += batch.length;
    } catch (err) {
      errors += batch.length;
      logger.error('sync:exception', { err: err.message });
    }
  }

  return { documentsSynced, chunksSynced, skipped, errors };
}

export async function publishChunks(config, options = {}) {
  const base = config.agentDrive || path.resolve('agent_drive');
  const entries = (
    await fs.readFile(path.join(base, 'data', 'inbox.jsonl'), 'utf8')
  )
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const chunks = entries.filter((entry) => entry.type === 'chunk').map((entry) => entry.data);
  const totalTokens = chunks.reduce((sum, chunk) => sum + (chunk.tokenCount ?? 0), 0);
  const costEstimate = totalTokens * 0.000001;

  if (options.dryRun) {
    return { published: 0, costEstimate, vectorIds: [] };
  }

  const url = `${config.apiUrl.replace(/\/+$/, '')}/jsonrpc`;
  const payload = {
    jsonrpc: '2.0',
    id: `publish-${Date.now()}`,
    method: 'publish.chunks',
    params: { userId: config.userId, chunks }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.auth?.key || ''}`
      },
      body: JSON.stringify(payload)
    });
    await res.json();
    return { published: chunks.length, costEstimate, vectorIds: chunks.slice(0, 3).map((c) => c.id) };
  } catch (err) {
    logger.error('publish:error', { err: err.message });
    throw err;
  }
}
