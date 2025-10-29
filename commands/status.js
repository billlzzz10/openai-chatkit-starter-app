import fs from 'fs-extra';
import path from 'path';

export async function showStatus(options={}) {
  const base = path.resolve('agent_drive');
  const inbox = path.join(base, 'data', 'inbox.jsonl');
  const inboxSize = (await fs.pathExists(inbox)) ? (await fs.stat(inbox)).size : 0;
  const docsDir = path.join(base, 'docs');
  const localDocs = (await fs.pathExists(docsDir)) ? (await fs.readdir(docsDir)).length : 0;
  // count chunks by reading inbox
  const chunks = (await fs.pathExists(inbox)) ? (await fs.readFile(inbox, 'utf8')).split('\n').filter(Boolean).map(l=>JSON.parse(l)).filter(e=>e.type==='chunk') : [];
  const totalChunks = chunks.length;
  const synced = chunks.filter(c=>c.synced).length;
  const pendingSync = totalChunks - synced;
  const published = chunks.filter(c=>c.published).length || 0;
  const detailed = { sampleChunks: chunks.slice(0,5) };
  return {
    drivePath: base,
    initialized: await fs.pathExists(base),
    localDocs,
    totalChunks,
    synced,
    pendingSync,
    published,
    inboxSize,
    detailed
  };
}
