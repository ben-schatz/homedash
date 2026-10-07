// Blocks commits that contain secrets or personal words.
// Personal words live in .blocklist (gitignored), one per line.
// Usage: pre-commit hook runs it on staged files; `npm run check` scans every tracked/untracked file.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const forbiddenFiles = [/^\.env$/, /^config\.json$/, /^data\//, /^\.blocklist$/];
const secretPatterns = [
  { name: 'Google private iCal URL', re: /calendar\.google\.com\/calendar\/ical\/[^\s"']*\/private-/i },
  { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'filled secret in env-style line', re: /^(?:TODOIST_TOKEN|SESSION_SECRET|PARENT_PIN_HASH|AMP_PASSWORD)=\S+/m },
  { name: 'long hex token', re: /\b[a-f0-9]{40}\b/ }
];

function listFiles(all) {
  const cmd = all
    ? 'git ls-files --cached --others --exclude-standard'
    : 'git diff --cached --name-only --diff-filter=ACMR';
  return execSync(cmd, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
}

function readStaged(file, all) {
  if (all) return fs.readFileSync(path.join(root, file), 'utf8');
  return execSync(`git show ":${file}"`, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

const all = process.argv.includes('--all');
const blocklistPath = path.join(root, '.blocklist');
const words = fs.existsSync(blocklistPath)
  ? fs.readFileSync(blocklistPath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  : [];
if (!words.length) console.warn('check-secrets: .blocklist is empty or missing; only secret patterns are checked.');

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = words.length ? new RegExp(`\\b(${words.map(escape).join('|')})\\b`, 'i') : null;

const problems = [];
for (const file of listFiles(all)) {
  const normalized = file.replace(/\\/g, '/');
  if (forbiddenFiles.some(re => re.test(normalized))) {
    problems.push(`${file}: this file must never be committed`);
    continue;
  }
  if (normalized === 'package-lock.json' || /\.(png|jpe?g|gif|ico|woff2?)$/i.test(normalized)) continue;
  let text;
  try { text = readStaged(file, all); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    for (const p of secretPatterns) if (p.re.test(line)) problems.push(`${file}:${i + 1}: ${p.name}`);
    const hit = wordRe && line.match(wordRe);
    if (hit) problems.push(`${file}:${i + 1}: blocklisted word "${hit[1]}"`);
  });
}

if (problems.length) {
  console.error('Commit blocked. Remove these before committing:\n' + problems.map(p => '  ' + p).join('\n'));
  process.exit(1);
}
console.log(`check-secrets: ${all ? 'all files' : 'staged files'} clean.`);
