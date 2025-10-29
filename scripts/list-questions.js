const fs = require('fs');
const path = require('path');
const text = fs.readFileSync(path.join(__dirname, '..', 'node_modules', '@specifyapp', 'cli', 'dist_npm', 'index.mjs'), 'utf8');
const regex = /question:\"([^\"]+)/g;
const seen = new Set();
let match;
while ((match = regex.exec(text)) !== null) {
  if (!seen.has(match[1])) {
    console.log(match[1]);
    seen.add(match[1]);
  }
}
