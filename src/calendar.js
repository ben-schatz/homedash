// Reads a private Google Calendar iCal feed and expands recurring events with ical.js.
// Fetched every 15 minutes; on failure the last good copy keeps serving.
const ICAL = require('ical.js');

const REFRESH_MS = 15 * 60 * 1000;
const WINDOW_DAYS = 90;

function startOfDay(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

// Expand every VEVENT into concrete occurrences overlapping [from, to).
function expand(icsText, from, to) {
  const root = new ICAL.Component(ICAL.parse(icsText));
  for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz);

  const masters = new Map();
  const loose = [];
  const exceptions = [];
  for (const vevent of root.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else if (event.isRecurring()) masters.set(event.uid, event);
    else loose.push(event);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    else loose.push(ex);
  }

  const out = [];
  function add(item, start, end) {
    if (String(item.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return;
    const s = start.toJSDate();
    const e = end ? end.toJSDate() : s;
    if (e <= from || s >= to) return;
    out.push({
      title: item.summary || '',
      description: item.description || '',
      start: s.getTime(),
      end: e.getTime(),
      allDay: start.isDate
    });
  }

  for (const event of loose) add(event, event.startDate, event.endDate);

  const stop = ICAL.Time.fromJSDate(to, false);
  for (const event of masters.values()) {
    const it = event.iterator();
    let next;
    let guard = 0;
    while ((next = it.next()) && next.compare(stop) < 0 && guard++ < 20000) {
      const details = event.getOccurrenceDetails(next);
      add(details.item, details.startDate, details.endDate);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function createCalendar(url) {
  let cache = { fetchedAt: 0, events: [], error: null };
  let inflight = null;

  async function refresh() {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`calendar feed returned ${res.status}`);
    const text = await res.text();
    const today = startOfDay(new Date());
    cache = { fetchedAt: Date.now(), events: expand(text, addDays(today, -1), addDays(today, WINDOW_DAYS)), error: null };
  }

  async function events() {
    if (!url) return { events: [], stale: false, configured: false };
    if (Date.now() - cache.fetchedAt > REFRESH_MS) {
      inflight = inflight || refresh().catch(error => {
        console.error('Calendar refresh failed:', error.message);
        cache.error = error.message;
        cache.fetchedAt = Date.now() - REFRESH_MS + 60 * 1000; // retry in a minute
      }).finally(() => { inflight = null; });
      if (!cache.events.length) await inflight;
    }
    return { events: cache.events, stale: Boolean(cache.error), configured: true };
  }

  return { events };
}

module.exports = { createCalendar, expand, startOfDay, addDays };
