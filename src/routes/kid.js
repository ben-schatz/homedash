// Kid board API: routine config and per-day checkmarks stored in SQLite.
const express = require('express');
const { db } = require('../db');
const { localDay } = require('../time');

module.exports = function kidRoutes(config) {
  const router = express.Router();
  const routines = config.routines || {};

  router.get('/config', (request, response) => {
    response.json({ kidName: config.kidName || 'Kiddo', routines });
  });

  router.get('/checks', (request, response) => {
    const day = localDay();
    const rows = db.prepare('SELECT routine, item FROM checkmarks WHERE day = ? AND done = 1').all(day);
    const checks = {};
    for (const name of Object.keys(routines)) checks[name] = [];
    for (const row of rows) if (checks[row.routine]) checks[row.routine].push(row.item);
    response.json({ day, checks });
  });

  router.post('/checks', (request, response) => {
    const { routine, item, done } = request.body || {};
    const routineConfig = routines[routine];
    const index = Number(item);
    if (!routineConfig || !Number.isInteger(index) || index < 0 || index >= routineConfig.items.length) {
      return response.status(400).json({ error: 'Unknown routine or item.' });
    }
    const day = localDay();
    if (done) {
      db.prepare('INSERT OR REPLACE INTO checkmarks (day, routine, item, done) VALUES (?, ?, ?, 1)').run(day, routine, index);
    } else {
      db.prepare('DELETE FROM checkmarks WHERE day = ? AND routine = ? AND item = ?').run(day, routine, index);
    }
    response.json({ ok: true });
  });

  return router;
};
