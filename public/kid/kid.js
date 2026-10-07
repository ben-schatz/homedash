// Kid board. Plain ES5 + fetch so old tablet browsers (Fire OS WebView) can run it.
// States: "chunk" (a schedule chunk is running), "day" (between chunks), "sleep" (before wake / after last chunk).
(function () {
  var SVG = 'http://www.w3.org/2000/svg';
  var RING_C = 2 * Math.PI * 66;
  var cfg = null;
  var checks = {};
  var today = { home: null, noSchool: false, events: [], countdowns: [] };
  var EVENT_WINDOW = 60; // minutes the ring spans when counting down to a calendar event
  var audio = null;

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  function getJSON(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw r; return r.json(); }); }
  function toMin(hhmm) { var p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function nowMin(d) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function shortTime(d) { return (d.getHours() % 12 || 12) + ':' + pad(d.getMinutes()); }

  // ---------- schedule ----------
  function todaysChunks(date) {
    if (today.home === false) return []; // away day: no routines
    var school = cfg.schoolDays.indexOf(date.getDay()) !== -1 && !today.noSchool;
    return cfg.chunks.filter(function (c) { return school || !c.schoolOnly; });
  }

  function nextEvent(date) {
    for (var i = 0; i < today.events.length; i++) {
      var e = today.events[i];
      if (!e.allDay && e.start > date.getTime()) return e;
    }
    return null;
  }

  function currentState(date) {
    var m = nowMin(date);
    var chunks = todaysChunks(date);
    var lastEnd = 0;
    for (var i = 0; i < cfg.chunks.length; i++) lastEnd = Math.max(lastEnd, toMin(cfg.chunks[i].end));
    if (m < toMin(cfg.wake) || m >= lastEnd) return { mode: 'sleep' };
    for (var j = 0; j < chunks.length; j++) {
      var c = chunks[j];
      if (m >= toMin(c.start) && m < toMin(c.end)) return { mode: 'chunk', chunk: c, minute: m, id: 'c:' + c.id };
    }
    var ev = nextEvent(date);
    if (ev) return { mode: 'event', event: ev, id: 'e:' + ev.start };
    return { mode: 'day' };
  }

  // ---------- clock ----------
  function polar(r, minuteOfHalfDay) {
    var a = (minuteOfHalfDay / 720) * 2 * Math.PI;
    return { x: 100 + r * Math.sin(a), y: 100 - r * Math.cos(a) };
  }
  function arcPath(r, startMin, endMin) {
    var s = polar(r, startMin % 720);
    var e = polar(r, endMin % 720);
    var large = (endMin - startMin) > 360 ? 1 : 0;
    return 'M ' + s.x + ' ' + s.y + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + e.x + ' ' + e.y;
  }

  function drawClock(date, activeId) {
    var svg = $('clock');
    clear(svg);
    svg.appendChild(svgEl('circle', { 'class': 'face', cx: 100, cy: 100, r: 97 }));

    // Arcs for chunks in the current half of the day (AM or PM).
    var pm = date.getHours() >= 12;
    todaysChunks(date).forEach(function (c) {
      var s = toMin(c.start), e = toMin(c.end);
      if ((s >= 720) !== pm) return;
      var path = svgEl('path', { 'class': 'arc' + (c.id === activeId ? ' active' : ''), d: arcPath(86, s, e), stroke: c.color });
      svg.appendChild(path);
    });

    for (var i = 0; i < 60; i++) {
      var major = i % 5 === 0;
      var p1 = polar(major ? 70 : 74, i * 12), p2 = polar(78, i * 12);
      svg.appendChild(svgEl('line', { 'class': 'tick' + (major ? ' major' : ''), x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
    }
    for (var h = 1; h <= 12; h++) {
      var p = polar(59, h * 60);
      var t = svgEl('text', { 'class': 'num', x: p.x, y: p.y });
      t.textContent = String(h);
      svg.appendChild(t);
    }

    var m = nowMin(date);
    var hourEnd = polar(48, m % 720);
    var minEnd = polar(72, (m % 60) * 12);
    svg.appendChild(svgEl('line', { 'class': 'hour', x1: 100, y1: 100, x2: hourEnd.x, y2: hourEnd.y }));
    svg.appendChild(svgEl('line', { 'class': 'minute', x1: 100, y1: 100, x2: minEnd.x, y2: minEnd.y }));
    svg.appendChild(svgEl('circle', { 'class': 'pin', cx: 100, cy: 100, r: 5 }));
  }

  // ---------- chunk panel ----------
  function renderChecks(chunk) {
    var list = $('checks');
    clear(list);
    var done = checks[chunk.id] || [];
    (chunk.items || []).forEach(function (text, index) {
      var isDone = done.indexOf(index) !== -1;
      var li = el('li', isDone ? 'done' : '');
      li.appendChild(el('span', 'box', isDone ? '✓' : ''));
      li.appendChild(el('span', 'text', text));
      li.addEventListener('click', function () { toggle(chunk, index, !isDone); });
      list.appendChild(li);
    });
  }

  function renderToday(list, date) {
    clear(list);
    today.events.forEach(function (e) {
      var past = !e.allDay && e.end < date.getTime();
      var li = el('li', past ? 'past' : '');
      if (!e.allDay) li.appendChild(el('span', 'when', shortTime(new Date(e.start))));
      li.appendChild(el('span', 'text', e.title));
      list.appendChild(li);
    });
    if (!today.events.length) list.appendChild(el('li', 'past', 'Nothing on the calendar'));
  }

  function loadToday() {
    return getJSON('/api/kid/today').then(function (data) {
      today = data;
      sidePanelFor = null; // redraw the side panel with fresh events
    }, function () {});
  }

  function toggle(chunk, index, done) {
    var list = checks[chunk.id] || (checks[chunk.id] = []);
    if (done) list.push(index); else list.splice(list.indexOf(index), 1);
    renderChecks(chunk);
    fetch('/api/kid/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routine: chunk.id, item: index, done: done })
    }).then(loadChecks, loadChecks);
  }

  function loadChecks() {
    return getJSON('/api/kid/checks').then(function (data) {
      checks = data.checks;
      var s = currentState(new Date());
      if (s.mode === 'chunk') renderChecks(s.chunk);
    });
  }

  function updateTimer(state, date) {
    var total, left, color;
    if (state.mode === 'chunk') {
      var c = state.chunk;
      total = toMin(c.end) - toMin(c.start);
      left = toMin(c.end) - state.minute;
      color = c.color;
    } else {
      left = (state.event.start - date.getTime()) / 60000;
      total = Math.max(left, EVENT_WINDOW); // ring stays full until the last hour
      color = '#ffd166';
    }
    var fill = $('ring-fill');
    fill.setAttribute('stroke', color);
    fill.setAttribute('stroke-dasharray', String(RING_C));
    fill.setAttribute('stroke-dashoffset', String(RING_C * (1 - Math.max(0, left) / total)));
    var whole = Math.ceil(left);
    if (whole > 60) {
      $('left').textContent = Math.floor(whole / 60) + ':' + pad(whole % 60);
      $('left-unit').textContent = 'hours';
    } else {
      $('left').textContent = String(whole);
      $('left-unit').textContent = whole === 1 ? 'minute' : 'minutes';
    }
  }

  // ---------- beep ----------
  function unlockAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audio) audio = new Ctx();
    if (audio.state === 'suspended') audio.resume();
  }
  function beep() {
    if (!audio) return;
    [0, 0.45, 0.9].forEach(function (offset) {
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audio.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + offset + 0.35);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(audio.currentTime + offset);
      osc.stop(audio.currentTime + offset + 0.4);
    });
  }
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('click', unlockAudio);

  // ---------- weather ----------
  function loadWeather() {
    getJSON('/api/weather/simple').then(function (w) {
      var box = $('weather');
      clear(box);
      box.appendChild(document.createTextNode(w.icon + ' ' + w.temp + '°'));
      box.appendChild(el('span', 'phrase', w.phrase));
    }, function () { $('weather').textContent = ''; });
  }

  // ---------- main loop ----------
  var lastId = null;
  var sidePanelFor = null;

  function tick() {
    var now = new Date();
    var state = currentState(now);
    var id = state.id || null;

    if (lastId && id !== lastId) beep();
    lastId = id;

    var sideKey = (state.id || state.mode) + '|' + now.getHours() + ':' + Math.floor(now.getMinutes() / 5);
    if (sideKey !== sidePanelFor) {
      sidePanelFor = sideKey;
      var list = $('checks');
      if (state.mode === 'chunk') {
        $('label').textContent = state.chunk.label;
        list.className = 'checklist';
        renderChecks(state.chunk);
      } else if (state.mode === 'event') {
        $('label').textContent = state.event.title;
        list.className = 'checklist today-list';
        renderToday(list, now);
      } else if (state.mode === 'day') {
        renderToday($('today'), now);
      }
    }

    $('sleep').hidden = state.mode !== 'sleep';
    $('sleep-time').textContent = shortTime(now);
    $('now-panel').hidden = !(state.mode === 'chunk' || state.mode === 'event');
    $('day-panel').hidden = state.mode !== 'day';
    $('date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

    var cd = today.countdowns && today.countdowns[0];
    $('big-countdown').hidden = !cd || state.mode === 'sleep';
    if (cd) $('big-countdown').textContent = cd.days === 0 ? cd.title + ' is today!' : cd.days + (cd.days === 1 ? ' day' : ' days') + ' until ' + cd.title;

    if (state.mode === 'chunk' || state.mode === 'event') updateTimer(state, now);
    if (state.mode !== 'sleep') drawClock(now, state.mode === 'chunk' ? state.chunk.id : null);
  }

  getJSON('/api/kid/config').then(function (data) {
    cfg = data;
    document.title = cfg.kidName + "'s board";
    loadToday().then(function () {
      tick();
      setInterval(tick, 1000);
    });
    setInterval(loadToday, 5 * 60000);
    loadChecks();
    setInterval(loadChecks, 60000);
    loadWeather();
    setInterval(loadWeather, 10 * 60000);
  });
})();
