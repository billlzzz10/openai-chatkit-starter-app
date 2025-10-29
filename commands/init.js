import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export async function initAgentDrive(customPath) {
  const base = path.resolve(customPath || path.join(process.cwd(), 'agent_drive'));
  await fs.ensureDir(base);
  await fs.ensureDir(path.join(base, 'docs'));
  await fs.ensureDir(path.join(base, 'data'));
  await fs.ensureDir(path.join(base, 'logs'));

  const configFile = path.join(base, 'config.json');
  if (!fs.existsSync(configFile)) {
    const cfg = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      drivePath: base,
      localOnly: true
    };
    await fs.writeJson(configFile, cfg, { spaces: 2 });
  }

  const inbox = path.join(base, 'data', 'inbox.jsonl');
  if (!fs.existsSync(inbox)) {
    await fs.writeFile(inbox, '');
  }

  const meta = path.join(base, 'data', 'meta.json');
  if (!fs.existsSync(meta)) {
    await fs.writeJson(meta, { docs: [], chunks: [] }, { spaces: 2 });
  }

  return { path: base };
}
