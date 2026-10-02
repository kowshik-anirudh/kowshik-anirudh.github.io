// Interactive test line for the method page. Without JS the stations read
// as a plain article; with it they become a rail you can step through or run.
// Paced for reading: each log line types out, its matching check lights up
// and ticks, and there is a beat before the next. Reduced motion gets the
// same sequence with no typing or gliding.
(function () {
  'use strict';
  var root = document.querySelector('[data-line]');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stages = Array.prototype.slice.call(root.querySelectorAll('.stage'));
  var FAIL_AT = stages.findIndex(function (s) { return s.hasAttribute('data-fail-log'); });
  var REENTER = 1; // a repaired rack goes back in at Pretest

  // Reading pace (ms)
  var T = {
    char: reduce ? 0 : 22,     // typing speed per character
    afterLine: 900,            // beat after a line, once its check has ticked
    afterPass: 1500,           // hold on a station's PASS before moving on
    beforeStation: 900,        // the rack glides, the panel settles
    failHold: 4500,            // read the failure
    fixHold: 5000              // read the fix and the re-entry
  };

  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };

  // ---------- pause-aware timing ----------
  var runId = 0, paused = false, resumeWaiters = [];
  var gate = function () { return paused ? new Promise(function (r) { resumeWaiters.push(r); }) : Promise.resolve(); };
  var wait = function (ms) {
    return new Promise(function (r) { setTimeout(r, ms); }).then(gate);
  };

  // ---------- build the rail, controls and console ----------
  var head = el('div', 'line-head');
  var scroller = el('div', 'line-scroll');
  var rail = el('div', 'line-rail');
  rail.setAttribute('role', 'tablist');
  rail.setAttribute('aria-label', 'Test line stations');
  var track = el('span', 'line-track'); track.setAttribute('aria-hidden', 'true');
  var fill = el('span', 'line-fill'); track.appendChild(fill);
  var rack = el('span', 'line-rack'); rack.setAttribute('aria-hidden', 'true');
  rack.innerHTML = '<i></i><i></i><i></i><i></i>';
  rail.appendChild(track); rail.appendChild(rack);

  var tabs = stages.map(function (s, i) {
    var b = el('button', 'line-stop');
    b.type = 'button';
    b.id = s.id + '-tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', s.id);
    b.innerHTML = '<span class="line-n">' + String(i).padStart(2, '0') + '</span><span class="line-dot"></span><span class="line-name"></span>';
    b.querySelector('.line-name').textContent = s.getAttribute('data-short');
    s.setAttribute('role', 'tabpanel');
    s.setAttribute('aria-labelledby', b.id);
    s.tabIndex = 0;
    rail.appendChild(b);
    return b;
  });
  scroller.appendChild(rail);

  var ctl = el('div', 'line-ctl');
  var run = el('button', 'btn btn-primary line-run', 'Run the line'); run.type = 'button';
  var pause = el('button', 'btn line-pause', 'Pause'); pause.type = 'button'; pause.hidden = true;
  var faultLabel = el('label', 'line-fault');
  var fault = el('input'); fault.type = 'checkbox';
  faultLabel.appendChild(fault); faultLabel.appendChild(document.createTextNode(' Show a failure'));
  var status = el('p', 'line-status'); status.setAttribute('aria-live', 'polite');
  ctl.appendChild(run); ctl.appendChild(pause); ctl.appendChild(faultLabel); ctl.appendChild(status);

  var log = el('div', 'line-log'); log.setAttribute('aria-hidden', 'true');

  head.appendChild(scroller); head.appendChild(ctl); head.appendChild(log);
  root.insertBefore(head, stages[0]);
  root.classList.add('is-live');
  var hint = document.querySelector('.line-hint'); if (hint) hint.hidden = false;

  // ---------- state ----------
  var current = 0;

  var place = function (i) {
    var b = tabs[i], rr = rail.getBoundingClientRect(), br = b.getBoundingClientRect();
    var x = br.left - rr.left + br.width / 2;
    rack.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    var t0 = tabs[0].getBoundingClientRect(), tN = tabs[tabs.length - 1].getBoundingClientRect();
    var start = t0.left + t0.width / 2, end = tN.left + tN.width / 2;
    fill.style.transform = 'scaleX(' + ((br.left + br.width / 2 - start) / Math.max(1, end - start)).toFixed(4) + ')';
    // keep the active stop in view on narrow screens
    var sl = scroller.scrollLeft, sw = scroller.clientWidth, bl = b.offsetLeft;
    if (bl < sl + 40 || bl + b.offsetWidth > sl + sw - 40) scroller.scrollTo({ left: bl - sw / 2 + b.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  };

  var mark = function (i, state) {
    tabs[i].classList.remove('is-pass', 'is-fail');
    if (state) tabs[i].classList.add('is-' + state);
  };

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
    place(i);
  };

  // type one line into the console, character by character
  var type = function (span, text, id) {
    if (!T.char) { span.textContent = text; return Promise.resolve(id === runId); }
    var n = 0;
    return new Promise(function (done) {
      var tick = function () {
        if (id !== runId) return done(false);
        if (paused) return gate().then(tick);
        n += 2;
        span.textContent = text.slice(0, n);
        if (n >= text.length) return done(true);
        setTimeout(tick, T.char * 2);
      };
      tick();
    });
  };

  // print a station's log; each finding line lights, then ticks, its matching check
  var print = function (i, failing, id) {
    var name = stages[i].getAttribute('data-short').toLowerCase().replace(/\s+/g, '-');
    var lines = (failing ? stages[i].getAttribute('data-fail-log') : stages[i].getAttribute('data-log')).split('|');
    var checks = Array.prototype.slice.call(stages[i].querySelectorAll('.checks li'));
    var k = 0;
    var step = function () {
      if (id !== runId) return Promise.resolve(false);
      if (k >= lines.length) return Promise.resolve(true);
      var raw = lines[k], bad = raw.charAt(0) === '!', text = bad ? raw.slice(1) : raw;
      var verdict = /^(PASS|FAIL)/.test(text);
      var row = el('div', 'line-row is-typing');
      var tag = el('span', 'line-tag', '[' + name + ']');
      var msg = el('span', /^PASS/.test(text) ? 'line-pass' : /^FAIL/.test(text) ? 'line-failmsg' : bad ? 'line-badmsg' : 'line-msg');
      row.appendChild(tag); row.appendChild(msg);
      log.appendChild(row);
      while (log.children.length > 8) log.removeChild(log.firstChild);
      var check = !verdict ? checks[k] : null;
      if (check) check.classList.add('now');
      return type(msg, text, id).then(function (ok) {
        row.classList.remove('is-typing');
        if (!ok) return false;
        if (check) { check.classList.remove('now'); check.classList.add(bad ? 'bad' : 'ok'); }
        k++;
        return wait(verdict ? 0 : T.afterLine).then(step);
      });
    };
    return step();
  };

  var setPaused = function (v) {
    paused = v;
    pause.textContent = v ? 'Resume' : 'Pause';
    root.classList.toggle('is-paused', v);
    if (!v) { var w = resumeWaiters; resumeWaiters = []; w.forEach(function (r) { r(); }); }
  };
  pause.addEventListener('click', function () { setPaused(!paused); });

  // ---------- manual stepping ----------
  var pick = function (i) {
    runId++;
    setPaused(false);
    pause.hidden = true;
    run.textContent = 'Run the line';
    root.classList.remove('has-fault');
    log.textContent = '';
    tabs.forEach(function (b, j) { mark(j, j < i ? 'pass' : null); });
    status.textContent = '';
    show(i);
    print(i, false, runId).then(function (ok) { if (ok) mark(i, 'pass'); });
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
  var go = function () {
    var id = ++runId;
    setPaused(false);
    pause.hidden = false;
    var failing = fault.checked && FAIL_AT > 0;
    root.classList.remove('has-fault');
    run.textContent = 'Restart';
    log.textContent = '';
    tabs.forEach(function (b, j) { mark(j, null); });
    status.textContent = 'Running the line. Each station has to pass before the rack moves on.';

    var from = function (i, allowFail) {
      if (id !== runId) return Promise.resolve();
      if (i >= stages.length) {
        status.textContent = failing ? 'Shipped after one repair. Every station passed, in order, on the second pass.' : 'Shipped. Every station passed, in order.';
        run.textContent = 'Run it again';
        pause.hidden = true;
        return Promise.resolve();
      }
      show(i);
      var fails = allowFail && i === FAIL_AT;
      return wait(T.beforeStation).then(function () {
        if (fails) root.classList.add('has-fault');
        return print(i, fails, id);
      }).then(function (ok) {
        if (!ok) return;
        if (!fails) { mark(i, 'pass'); return wait(T.afterPass).then(function () { return from(i + 1, allowFail); }); }
        mark(i, 'fail');
        status.textContent = 'Network blade found a GPU missing from the fabric. The rack stops here and goes to debug.';
        return wait(T.failHold).then(function () {
          if (id !== runId) return;
          root.classList.remove('has-fault');
          status.textContent = 'Fixed: the cable cartridge was reseated. A repair can disturb anything it touched, so the rack re-enters the line at Pretest.';
          for (var j = REENTER; j < stages.length; j++) mark(j, null);
          return wait(T.fixHold).then(function () { return from(REENTER, false); });
        });
      });
    };
    from(0, failing);
  };
  run.addEventListener('click', go);

  window.addEventListener('resize', function () { place(current); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(current); });

  // start on the first station, already passed and fully shown, nothing running
  show(0);
  (function () {
    var name = '[pxe-boot]';
    stages[0].getAttribute('data-log').split('|').forEach(function (t) {
      var row = el('div', 'line-row'); row.appendChild(el('span', 'line-tag', name));
      row.appendChild(el('span', /^PASS/.test(t) ? 'line-pass' : 'line-msg', t)); log.appendChild(row);
    });
    stages[0].querySelectorAll('.checks li').forEach(function (c) { c.classList.add('ok'); });
  })();
})();
