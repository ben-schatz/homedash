// Kid board API: schedule chunks and per-day checkmarks stored in SQLite.
const express = require('express');
const { db } = require('../db');
const { localDay } = require('../time');
const { createCalendar, startOfDay, addDays } = require('../calendar');

const COUNTDOWN_TAG = /#countdown\b/i;

// Turns raw calendar occurrences into what the board needs for today.
function summarizeDay(events, markers, now) {
  const dayStart = startOfDay(now).getTime();
  const dayEnd = addDays(startOfDay(now), 1).getTime();
  const lower = list => (list || []).map(s => s.toLowerCase());
  const home = lower(markers.home);
  const away = lower(markers.away);
  const noSchool = lower(markers.noSchool);

  const todays = events.filter(e => e.start < dayEnd && e.end > dayStart);
  const isMarker = e => e.allDay && [...home, ...away, ...noSchool].includes(e.title.trim().toLowerCase());
  const has = (list) => todays.some(e => e.allDay && list.includes(e.title.trim().toLowerCase()));

  const homeToday = has(home) ? true : has(away) ? false : null;

  const countdowns = [];
  const seen = new Set();
  for (const e of events) {
    if (!COUNTDOWN_TAG.test(e.description) || e.start < dayStart || seen.has(e.title)) continue;
    seen.add(e.title);
    countdowns.push({ title: e.title, start: e.start, days: Math.round((startOfDay(new Date(e.start)) - dayStart) / 86400000) });
  }

  return {
    home: homeToday,
    noSchool: has(noSchool),
    events: todays.filter(e => !isMarker(e)).map(e => ({ title: e.title, start: e.start, end: e.end, allDay: e.allDay })),
    countdowns: countdowns.slice(0, 3)
  };
}

module.exports = function kidRoutes(config) {
  const router = express.Router();
  const chunks = config.chunks || [];
  const calendar = createCalendar(process.env.KID_ICS_URL);
  const markers = config.calendarMarkers || {};
  const byId = {};
  for (const chunk of chunks) byId[chunk.id] = chunk;

  router.get('/config', (request, response) => {
    response.json({
      kidName: config.kidName || 'Kiddo',
      schoolDays: config.schoolDays || [1, 2, 3, 4, 5],
      wake: config.wake || '08:00',
      chunks
    });
  });

  router.get('/today', async (request, response) => {
    try {
      const { events, stale, configured } = await calendar.events();
      // ?at=2026-10-13T16:20 pretends it is that time (testing only; read-only).
      const at = request.query.at ? new Date(String(request.query.at)) : null;
      const now = at && !isNaN(at) ? at : new Date();
      response.json(Object.assign({ configured, stale }, summarizeDay(events, markers, now)));
    } catch (error) {
      console.error('Calendar failed:', error.message);
      response.json({ configured: true, stale: true, home: null, noSchool: false, events: [], countdowns: [] });
    }
  });

  router.get('/checks', (request, response) => {
    const day = localDay();
    const rows = db.prepare('SELECT routine, item FROM checkmarks WHERE day = ? AND done = 1').all(day);
    const checks = {};
    for (const row of rows) (checks[row.routine] = checks[row.routine] || []).push(row.item);
    response.json({ day, checks });
  });

  router.post('/checks', (request, response) => {
    const { routine, item, done } = request.body || {};
    const chunk = byId[routine];
    const index = Number(item);
    if (!chunk || !Number.isInteger(index) || index < 0 || index >= (chunk.items || []).length) {
      return response.status(400).json({ error: 'Unknown chunk or item.' });
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

module.exports.summarizeDay = summarizeDay;
