// Loads config.example.json as defaults, then overlays config.json (personal, gitignored).
// Top-level keys in config.json replace the defaults, so it only needs what differs.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function loadConfig() {
  const defaults = JSON.parse(fs.readFileSync(path.join(root, 'config.example.json'), 'utf8'));
  const real = path.join(root, 'config.json');
  if (!fs.existsSync(real)) {
    console.warn('No config.json found. Using config.example.json.');
    return defaults;
  }
  return Object.assign({}, defaults, JSON.parse(fs.readFileSync(real, 'utf8')));
}

module.exports = { loadConfig };
