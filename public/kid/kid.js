// Kid board. Plain ES5 + fetch so old tablet browsers (Fire OS WebView) can run it.
(function () {
  var RING_R = 66;
  var RING_C = 2 * Math.PI * RING_R;
  var state = { routines: {}, checks: {} };

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function getJSON(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }); }
  function postJSON(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  function parseTarget(hhmm) {
    var parts = hhmm.split(':');
    return { h: Number(parts[0]), m: Number(parts[1]) };
  }
  function displayTime(hhmm) {
    var t = parseTarget(hhmm);
    var h = t.h % 12 || 12;
    return h + (t.m ? ':' + pad(t.m) : '') + (t.h < 12 ? ' AM' : ' PM');
  }

  function ringSvg(id) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ring');
    svg.setAttribute('viewBox', '0 0 160 160');
    ['track', 'fill'].forEach(function (cls) {
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('class', cls);
      c.setAttribute('cx', '80'); c.setAttribute('cy', '80'); c.setAttribute('r', String(RING_R));
      if (cls === 'fill') {
        c.setAttribute('id', id);
        c.setAttribute('stroke-dasharray', String(RING_C));
      }
      svg.appendChild(c);
    });
    return svg;
  }

  function renderCountdowns() {
    var box = $('countdowns');
    clear(box);
    Object.keys(state.routines).forEach(function (name) {
      var r = state.routines[name];
      var card = el('article', 'card countdown-card ' + name);
      card.appendChild(ringSvg('ring-' + name));
      var text = el('div');
      text.appendChild(el('p', 'eyebrow', r.label.toUpperCase()));
      text.appendChild(el('h1', '', displayTime(r.target)));
      var left = el('p', 'countdown-text', '--');
      left.id = 'left-' + name;
      text.appendChild(left);
      card.appendChild(text);
      box.appendChild(card);
    });
  }

  function renderRoutines() {
    var box = $('routines');
    clear(box);
    Object.keys(state.routines).forEach(function (name) {
      var r = state.routines[name];
      var done = state.checks[name] || [];
      var card = el('article', 'card routine-card ' + name);
      var head = el('div', 'routine-heading');
      head.appendChild(el('h2', '', r.label));
      head.appendChild(el('span', '', done.length + ' / ' + r.items.length));
      card.appendChild(head);
      var list = el('ul', 'checklist');
      r.items.forEach(function (label, index) {
        var isDone = done.indexOf(index) !== -1;
        var li = el('li', isDone ? 'done' : '');
        li.appendChild(el('span', 'box', isDone ? '✓' : ''));
        li.appendChild(el('span', 'label', label));
        li.addEventListener('click', function () { toggle(name, index, !isDone); });
        list.appendChild(li);
      });
      card.appendChild(list);
      box.appendChild(card);
    });
  }

  function toggle(name, index, done) {
    var list = state.checks[name] || (state.checks[name] = []);
    if (done) list.push(index); else list.splice(list.indexOf(index), 1);
    renderRoutines();
    postJSON('/api/kid/checks', { routine: name, item: index, done: done }).then(loadChecks, loadChecks);
  }

  function loadChecks() {
    return getJSON('/api/kid/checks').then(function (data) {
      state.checks = data.checks;
      state.day = data.day;
      renderRoutines();
    });
  }

  function tick() {
    var now = new Date();
    var h = now.getHours() % 12 || 12;
    $('clock').textContent = h + ':' + pad(now.getMinutes());
    $('today-date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    Object.keys(state.routines).forEach(function (name) {
      var t = parseTarget(state.routines[name].target);
      var target = new Date(now.getTime());
      target.setHours(t.h, t.m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      var remaining = target - now;
      var fraction = Math.max(0, Math.min(1, remaining / 86400000));
      var mins = Math.floor(remaining / 60000);
      $('left-' + name).textContent = Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
      $('ring-' + name).setAttribute('stroke-dashoffset', String(RING_C * (1 - fraction)));
    });
  }

  getJSON('/api/kid/config').then(function (cfg) {
    state.routines = cfg.routines;
    $('title').textContent = (cfg.kidName + "'s day").toUpperCase();
    renderCountdowns();
    tick();
    setInterval(tick, 1000);
    loadChecks();
    setInterval(loadChecks, 60000); // picks up the overnight reset and other screens
  });
})();
