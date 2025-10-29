const { spawn } = require('child_process');
const path = require('path');

const projectName = process.argv[2];
if (!projectName) {
  console.error('Usage: node scripts/run-specify-init.js <project-name>');
  process.exit(1);
}

const patchPath = path.resolve(__dirname, 'specify-tty-patch.js');
const env = Object.assign({}, process.env);
const existingNodeOptions = env.NODE_OPTIONS ? env.NODE_OPTIONS + ' ' : '';
const requireArg = '--require ' + patchPath;
env.NODE_OPTIONS = existingNodeOptions + requireArg;

const command = 'npx @specifyapp/cli init ' + projectName;
const child = spawn(command, {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

const questions = [
  { pattern: "Would you like to replace it by the one you're about to create?", answered: false, answer: '\n' },
  { pattern: 'Start a configuration file from scratch or use a template', answered: false, answer: '\n' },
  { pattern: 'Which template would you like to use?', answered: false, answer: '\n' },
  { pattern: 'Which file format would you like to use?', answered: false, answer: '\n' }
];

let buffer = '';

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  buffer += chunk.toString();
  for (const q of questions) {
    if (!q.answered && buffer.indexOf(q.pattern) !== -1) {
      child.stdin.write(q.answer);
      q.answered = true;
    }
  }
  if (buffer.length > 5000) {
    buffer = buffer.slice(-2000);
  }
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

child.on('close', (code) => {
  process.exit(code);
});
