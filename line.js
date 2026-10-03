// Interactive test line on the home page (#test-line). Without JS the stations read
// as a plain article; with it they become a line of seven bays with a rack that
// moves between them, a status strip, a log and one station's detail at a time.
//
// - It powers on when it scrolls into view and then runs once on its own, with
//   the failure switched on. Any click or key press on its controls hands
//   control to the visitor: autoplay never starts after that, and never
//   restarts something they paused or picked.
// - A run only advances while the line is on screen and the tab is visible.
// - Reduced motion: no entrance, no autoplay, no typing or gliding. The resting
//   frame is the failed one, so pass and fail states are both on show.
(function () {
  'use strict';
  var root = document.querySelector('[data-line]');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var stages = Array.prototype.slice.call(root.querySelectorAll('.stage'));
  var LAST = stages.length - 1;
  var FAIL_AT = stages.findIndex(function (s) { return s.hasAttribute('data-fail-log'); });
  var REENTER = 1; // a repaired rack goes back in at Pretest
  var names = stages.map(function (s) { return s.getAttribute('data-short'); });

  // Pace (ms). READ is for a run the visitor started; DEMO is the quicker
  // autoplay. Both hold on the failure and on the repair long enough to read.
  var READ = { char: 22, afterLine: 900, afterPass: 1500, beforeStation: 1000, failHold: 4500, fixHold: 5000, lift: 700, travel: 1000 };
  var DEMO = { char: 8, afterLine: 240, afterPass: 800, beforeStation: 950, failHold: 4500, fixHold: 4500, lift: 700, travel: 1000 };
  var T = READ;

  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

  // ---------- timing that waits while paused, off screen or in a hidden tab ----------
  var runId = 0, paused = false, offscreen = false, waiters = [];
  var held = function () { return paused || offscreen || document.hidden; };
  var release = function () { if (held()) return; var w = waiters; waiters = []; w.forEach(function (r) { r(); }); };
  var gate = function () { return held() ? new Promise(function (r) { waiters.push(r); }) : Promise.resolve(); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }).then(gate); };

  // ---------- build: the floor (bays, rail, rack, repair loop), status strip, log ----------
  var top = el('div', 'line-top');
  var floor = el('div', 'line-floor');
  var rail = el('div', 'line-rail');
  rail.setAttribute('role', 'tablist');
  rail.setAttribute('aria-label', 'Test line stations');
  rail.style.setProperty('--n', stages.length);
  var track = el('span', 'line-track'); track.setAttribute('aria-hidden', 'true');
  var fill = el('span', 'line-fill'); track.appendChild(fill);
  var rack = el('span', 'line-rack'); rack.setAttribute('aria-hidden', 'true');
  rack.innerHTML = '<span class="line-rack-body"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
  rail.appendChild(track);
  if (FAIL_AT > REENTER) {
    var loop = el('span', 'line-loop'); loop.setAttribute('aria-hidden', 'true');
    loop.style.left = ((REENTER + 0.5) / stages.length * 100) + '%';
    loop.style.width = ((FAIL_AT - REENTER) / stages.length * 100) + '%';
    var loopLabel = el('span', 'line-loop-label');
    loopLabel.appendChild(el('b', '', 'Repair'));
    loopLabel.appendChild(el('span', '', ', then back to ' + names[REENTER]));
    loop.appendChild(loopLabel);
    rail.appendChild(loop);
  }
  rail.appendChild(rack);

  var TAGS = { run: 'testing', pass: 'pass', fail: 'fail', redo: 'retest' };
  var tabs = stages.map(function (s, i) {
    var b = el('button', 'line-stop');
    b.type = 'button';
    b.id = s.id + '-tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', s.id);
    b.style.setProperty('--i', i);
    b.innerHTML = '<span class="line-bay" aria-hidden="true"></span><span class="line-node" aria-hidden="true"></span>' +
      '<span class="line-n">' + String(i).padStart(2, '0') + '</span><span class="line-name"></span> <span class="line-tag"></span>';
    b.querySelector('.line-name').textContent = names[i];
    s.setAttribute('role', 'tabpanel');
    s.setAttribute('aria-labelledby', b.id);
    s.tabIndex = 0;
    rail.appendChild(b);
    return b;
  });
  floor.appendChild(rail);

  var bar = el('div', 'line-bar');
  var state = el('div', 'line-state'); state.setAttribute('aria-hidden', 'true');
  var stateWord = el('span', 'line-state-word'), stateAt = el('span', 'line-state-at');
  state.appendChild(el('span', 'line-state-ico')); state.appendChild(stateWord); state.appendChild(stateAt);
  var say = el('div', 'line-say');
  var status = el('p', 'line-status'); status.setAttribute('aria-live', 'polite');
  var note = el('p', 'line-note'); note.setAttribute('aria-hidden', 'true'); // repeats the station's own subtitle
  say.appendChild(status); say.appendChild(note);
  var ctl = el('div', 'line-ctl');
  var run = el('button', 'btn btn-primary line-run', 'Run the line'); run.type = 'button';
  var pause = el('button', 'btn line-pause', 'Pause'); pause.type = 'button'; pause.disabled = true;
  var faultLabel = el('label', 'line-fault');
  var fault = el('input'); fault.type = 'checkbox'; fault.checked = FAIL_AT > 0;
  faultLabel.appendChild(fault); faultLabel.appendChild(el('span', '', 'Show a failure'));
  ctl.appendChild(run); ctl.appendChild(pause); ctl.appendChild(faultLabel);
  bar.appendChild(state); bar.appendChild(say); bar.appendChild(ctl);
  top.appendChild(floor); top.appendChild(bar);

  var body = el('div', 'line-body');
  var con = el('div', 'line-console'); con.setAttribute('aria-hidden', 'true');
  var conHead = el('div', 'line-console-head');
  conHead.appendChild(el('span', '', 'Test log'));
  var conAt = el('span', 'line-console-at'); conHead.appendChild(conAt);
  // the window is fixed; the roll inside it moves up (transform only) once it is full
  var logWin = el('div', 'line-log'), log = el('div', 'line-log-roll');
  logWin.appendChild(log);
  con.appendChild(conHead); con.appendChild(logWin);
  var panels = el('div', 'line-stages');
  root.insertBefore(top, stages[0]);
  root.insertBefore(body, stages[0]);
  body.appendChild(con); body.appendChild(panels);
  stages.forEach(function (s) { panels.appendChild(s); });
  root.classList.add('is-live');
  root.classList.toggle('with-fault', fault.checked);
  var hint = document.querySelector('.line-hint'); if (hint) hint.hidden = false;

  // ---------- state ----------
  var current = 0, pos = 0;
  var slug = function (i) { return names[i].toLowerCase().replace(/\s+/g, '-'); };
  var centre = function (i) { return tabs[i].offsetLeft + tabs[i].offsetWidth / 2; };

  // move the rack to a station, or part-way between two (the repair bay)
  var moveTo = function (p) {
    pos = p;
    var a = Math.floor(p), b = Math.min(LAST, a + 1);
    rack.style.setProperty('--x', (centre(a) + (centre(b) - centre(a)) * (p - a)).toFixed(1) + 'px');
  };

  var mark = function (i, s) {
    var b = tabs[i];
    b.classList.remove('is-run', 'is-pass', 'is-fail', 'is-redo');
    if (s) b.classList.add('is-' + s);
    b.querySelector('.line-tag').textContent = s ? TAGS[s] : '';
  };

  var WORDS = { ready: 'Ready', run: 'Testing', pass: 'Pass', fail: 'Fail', repair: 'To repair', fixed: 'Repaired', shipped: 'Shipped' };
  var setState = function (s, i) {
    root.setAttribute('data-state', s);
    stateWord.textContent = WORDS[s];
    stateAt.textContent = s === 'shipped' ? '' : names[i];
  };

  var clearFx = function () { root.classList.remove('has-fault', 'is-lifted', 'is-fixed'); };

  var resetChecks = function (i) {
    stages[i].querySelectorAll('.checks li').forEach(function (c) { c.classList.remove('ok', 'bad', 'now'); });
  };

  var show = function (i) {
    current = i;
    tabs.forEach(function (b, j) {
      var on = j === i;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('is-current', on);
      if (on && stages[j].hidden) { stages[j].hidden = false; stages[j].classList.remove('enter'); void stages[j].offsetWidth; stages[j].classList.add('enter'); }
      else if (!on) stages[j].hidden = true;
    });
    resetChecks(i);
    conAt.textContent = '[' + slug(i) + ']';
    fill.style.transform = 'scaleX(' + (i / LAST).toFixed(4) + ')';
    moveTo(i);
  };

  var bottom = function () { log.style.transform = 'translateY(' + -Math.max(0, log.offsetHeight - logWin.clientHeight) + 'px)'; };

  // type one line into the log, character by character
  var type = function (span, text, id) {
    if (!T.char) { span.textContent = text; bottom(); return Promise.resolve(id === runId); }
    var n = 0;
    return new Promise(function (done) {
      var tick = function () {
        if (id !== runId) return done(false);
        if (held()) return gate().then(tick);
        n += 2;
        span.textContent = text.slice(0, n);
        bottom();
        if (n >= text.length) return done(true);
        setTimeout(tick, T.char * 2);
      };
      tick();
    });
  };

  var addRow = function (cls, text) {
    var row = el('div', 'line-row ' + cls);
    var msg = el('span', '', text);
    row.appendChild(msg);
    log.appendChild(row);
    bottom();
    return msg;
  };
  var rowClass = function (text, bad) { return /^PASS/.test(text) ? 'is-pass' : /^FAIL/.test(text) ? 'is-fail' : bad ? 'is-bad' : ''; };

  // print a station's log; each finding line lights, then ticks, its matching check
  var print = function (i, failing, id) {
    var lines = (failing ? stages[i].getAttribute('data-fail-log') : stages[i].getAttribute('data-log')).split('|');
    var checks = Array.prototype.slice.call(stages[i].querySelectorAll('.checks li'));
    var k = 0;
    addRow('is-head', '[' + slug(i) + ']');
    var step = function () {
      if (id !== runId) return Promise.resolve(false);
      if (k >= lines.length) return Promise.resolve(true);
      var raw = lines[k], bad = raw.charAt(0) === '!', text = bad ? raw.slice(1) : raw;
      var verdict = /^(PASS|FAIL)/.test(text);
      if (bad) root.classList.add('has-fault');
      var msg = addRow(rowClass(text, bad) + ' is-typing', '');
      var check = !verdict ? checks[k] : null;
      if (check) check.classList.add('now');
      return type(msg, text, id).then(function (ok) {
        msg.parentNode.classList.remove('is-typing');
        if (!ok) return false;
        if (check) { check.classList.remove('now'); check.classList.add(bad ? 'bad' : 'ok'); }
        k++;
        return wait(verdict ? 0 : T.afterLine).then(step);
      });
    };
    return step();
  };

  // write a finished station straight into the log (resting frames)
  var stamp = function (i, failing) {
    addRow('is-head', '[' + slug(i) + ']');
    (failing ? stages[i].getAttribute('data-fail-log') : stages[i].getAttribute('data-log')).split('|').forEach(function (raw) {
      var bad = raw.charAt(0) === '!', text = bad ? raw.slice(1) : raw;
      addRow(rowClass(text, bad), text);
    });
    stages[i].querySelectorAll('.checks li').forEach(function (c) { c.classList.add(failing ? 'bad' : 'ok'); });
  };

  var setPaused = function (v) {
    paused = v;
    pause.textContent = v ? 'Resume' : 'Pause';
    root.classList.toggle('is-paused', v);
    release();
  };

  var FAIL_TEXT = 'Network blade found a GPU missing from the fabric. The rack stops here and goes to debug.';
  var FIX_TEXT = 'Fixed: the cable cartridge was reseated. A repair can disturb anything it touched, so the rack re-enters the line at Pretest.';

  // ---------- manual stepping ----------
  var pick = function (i) {
    var id = ++runId;
    T = READ; if (reduce) T = Object.assign({}, READ, { char: 0 });
    setPaused(false);
    pause.disabled = true;
    run.textContent = 'Run the line';
    clearFx();
    log.textContent = ''; bottom();
    tabs.forEach(function (b, j) { mark(j, j < i ? 'pass' : null); });
    status.textContent = '';
    var sub = stages[i].querySelector('h3 small');
    note.textContent = sub ? sub.textContent : '';
    show(i);
    mark(i, 'run'); setState('run', i);
    print(i, false, id).then(function (ok) { if (ok) { mark(i, 'pass'); setState(i === LAST ? 'shipped' : 'pass', i); } });
  };
  tabs.forEach(function (b, i) {
    b.addEventListener('click', function () { pick(i); });
    b.addEventListener('keydown', function (e) {
      var n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      n = (n + tabs.length) % tabs.length;
      tabs[n].focus();
      pick(n);
    });
  });

  // ---------- run the whole line ----------
  var go = async function (auto) {
    var id = ++runId, live = function () { return id === runId; };
    T = auto ? DEMO : READ; if (reduce) T = Object.assign({}, READ, { char: 0 });
    setPaused(false);
    pause.disabled = false;
    var failing = fault.checked && FAIL_AT > 0, allowFail = failing;
    clearFx();
    run.textContent = 'Restart';
    log.textContent = ''; bottom();
    note.textContent = '';
    tabs.forEach(function (b, j) { mark(j, null); });
    status.textContent = 'Running the line. Each station has to pass before the rack moves on.';

    var i = 0, j;
    while (i <= LAST) {
      show(i); mark(i, 'run'); setState('run', i);
      await wait(T.beforeStation); if (!live()) return;
      var fails = allowFail && i === FAIL_AT;
      if (!(await print(i, fails, id))) return;
      if (!fails) {
        mark(i, 'pass');
        if (i === LAST) break;
        setState('pass', i);
        await wait(T.afterPass); if (!live()) return;
        i++; continue;
      }
      // the failure: hold on it, then the rack leaves the line for repair
      mark(i, 'fail'); setState('fail', i);
      status.textContent = FAIL_TEXT;
      await wait(T.failHold); if (!live()) return;
      setState('repair', i);
      root.classList.add('is-lifted');
      await wait(T.lift); if (!live()) return;
      moveTo((REENTER + FAIL_AT) / 2);
      await wait(T.travel); if (!live()) return;
      root.classList.remove('has-fault'); root.classList.add('is-fixed');
      setState('fixed', i);
      status.textContent = FIX_TEXT;
      // everything from the re-entry point on has to be tested again
      for (j = REENTER; j <= LAST; j++) mark(j, j <= FAIL_AT ? 'redo' : null);
      await wait(T.fixHold); if (!live()) return;
      moveTo(REENTER);
      await wait(T.travel); if (!live()) return;
      root.classList.remove('is-lifted');
      await wait(T.lift); if (!live()) return;
      root.classList.remove('is-fixed');
      allowFail = false; i = REENTER;
    }
    setState('shipped', LAST);
    status.textContent = failing ? 'Shipped after one repair. Every station passed, in order, on the second pass.' : 'Shipped. Every station passed, in order.';
    run.textContent = 'Run it again';
    pause.disabled = true;
  };
  run.addEventListener('click', function () { go(false); });
  pause.addEventListener('click', function () { setPaused(!paused); });
  fault.addEventListener('change', function () { root.classList.toggle('with-fault', fault.checked); });

  // The first click or key press on the controls means the visitor is driving.
  var touched = false;
  ['pointerdown', 'keydown'].forEach(function (t) { top.addEventListener(t, function () { touched = true; }, true); });

  window.addEventListener('resize', function () { moveTo(pos); bottom(); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveTo(pos); });
  document.addEventListener('visibilitychange', release);

  // ---------- resting frame ----------
  show(0);
  if (reduce && FAIL_AT > 0) {
    // static poster: three stations passed, the fourth failed
    tabs.forEach(function (b, j) { if (j < FAIL_AT) mark(j, 'pass'); });
    show(FAIL_AT); mark(FAIL_AT, 'fail'); setState('fail', FAIL_AT);
    root.classList.add('has-fault');
    stamp(FAIL_AT - 1, false); stamp(FAIL_AT, true);
    stages[FAIL_AT - 1].querySelectorAll('.checks li').forEach(function (c) { c.classList.remove('ok'); });
    status.textContent = FAIL_TEXT;
  } else if (!hasIO) {
    // nothing will start it: first station already passed and fully shown
    stamp(0, false); mark(0, 'pass'); setState('pass', 0);
  } else {
    setState('ready', 0);
  }
  if (reduce || !hasIO) return;

  // ---------- only advance while the line is on screen ----------
  new IntersectionObserver(function (entries) {
    offscreen = !entries[entries.length - 1].isIntersecting;
    root.classList.toggle('is-off', offscreen);
    release();
  }).observe(top);

  // ---------- entrance, then one run on its own ----------
  root.classList.add('pre');
  var seen = new IntersectionObserver(function (entries) {
    if (!entries.some(function (e) { return e.isIntersecting; })) return;
    seen.disconnect();
    root.classList.remove('pre');
    root.classList.add('is-on');
    setTimeout(function () { root.classList.remove('is-on'); if (!touched) go(true); }, 1700);
  }, { threshold: 0.4 });
  seen.observe(floor);
})();
