// SQLite via Node's built-in node:sqlite (Node 22.13+). Database lives in data/ (gitignored).
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'homedash.db'));
db.exec('PRAGMA journal_mode = WAL;');

// Ordered migrations. Append only; never edit a shipped entry.
const migrations = [
  `CREATE TABLE checkmarks (
     day TEXT NOT NULL,
     routine TEXT NOT NULL,
     item INTEGER NOT NULL,
     done INTEGER NOT NULL DEFAULT 1,
     PRIMARY KEY (day, routine, item)
   );`
];

db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);');
const row = db.prepare('SELECT version FROM schema_version').get();
let version = row ? row.version : 0;
if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
while (version < migrations.length) {
  db.exec('BEGIN');
  db.exec(migrations[version]);
  version += 1;
  db.prepare('UPDATE schema_version SET version = ?').run(version);
  db.exec('COMMIT');
}

module.exports = { db, dataDir };
