import fs from 'fs';
import path from 'path';
import os from 'os';

const HOME = os.homedir();
const LOG_DIR = path.join(HOME, '.local-agent', 'logs');

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  // ignore fs errors when ensuring log directory exists
}

const LOG_FILE = path.join(LOG_DIR, 'agent.log');

function write(level, msg, meta) {
  const out = {
    ts: new Date().toISOString(),
    level,
    msg,
    meta: meta || {}
  };

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(out) + '\n');
  } catch {
    // swallow logging errors to avoid breaking caller flows
  }

  if (level === 'error') {
    console.error(msg, meta);
  } else if (level === 'warn') {
    console.warn(msg, meta);
  } else {
    console.log(msg);
  }
}

export const logger = {
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta)
};
