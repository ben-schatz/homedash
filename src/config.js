// Loads config.json (personal, gitignored). Falls back to config.example.json so a fresh clone runs.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function loadConfig() {
  const real = path.join(root, 'config.json');
  const example = path.join(root, 'config.example.json');
  const file = fs.existsSync(real) ? real : example;
  if (file === example) console.warn('No config.json found. Using config.example.json.');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { loadConfig };
