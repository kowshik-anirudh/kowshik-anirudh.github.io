// Interactive test line for the method page. Without JS the stations read
// as a plain article; with it they become a rail you can step through or run.
// Motion only answers the reader's action, and reduced motion gets the same
// content with no typing or gliding.
(function () {
  'use strict';
  var root = document.querySelector('[data-line]');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stages = Array.prototype.slice.call(root.querySelectorAll('.stage'));
  var FAIL_AT = stages.findIndex(function (s) { return s.hasAttribute('data-fail-log'); });
  var REENTER = 1; // a repaired rack goes back in at Pretest

  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduce ? Math.min(ms, 250) : ms); }); };

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
  var faultLabel = el('label', 'line-fault');
  var fault = el('input'); fault.type = 'checkbox';
  faultLabel.appendChild(fault); faultLabel.appendChild(document.createTextNode(' Show a failure'));
  var status = el('p', 'line-status'); status.setAttribute('aria-live', 'polite');
  ctl.appendChild(run); ctl.appendChild(faultLabel); ctl.appendChild(status);

  var log = el('div', 'line-log'); log.setAttribute('aria-hidden', 'true');

  head.appendChild(scroller); head.appendChild(ctl); head.appendChild(log);
  root.insertBefore(head, stages[0]);
  root.classList.add('is-live');
  var hint = document.querySelector('.line-hint'); if (hint) hint.hidden = false;

  // ---------- state ----------
  var current = 0, runId = 0;

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

  var show = function (i) {
    current = i;
    tabs.forEach(function (b, j) {
      var on = j === i;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('is-current', on);
      stages[j].hidden = !on;
    });
    place(i);
  };

  var print = function (i, failing, id) {
    var name = stages[i].getAttribute('data-short').toLowerCase().replace(/\s+/g, '-');
    var lines = (failing ? stages[i].getAttribute('data-fail-log') : stages[i].getAttribute('data-log')).split('|');
    var checks = Array.prototype.slice.call(stages[i].querySelectorAll('.checks li'));
    checks.forEach(function (c) { c.classList.remove('ok', 'bad'); });
    var k = 0;
    var step = function () {
      if (id !== runId) return Promise.resolve(false);
      if (k >= lines.length) return Promise.resolve(true);
      var text = lines[k];
      var row = el('div', 'line-row');
      var tag = el('span', 'line-tag', '[' + name + ']');
      var msg = el('span', /^PASS/.test(text) ? 'line-pass' : /^FAIL/.test(text) ? 'line-failmsg' : 'line-msg', text);
      row.appendChild(tag); row.appendChild(msg);
      log.appendChild(row);
      while (log.children.length > 7) log.removeChild(log.firstChild);
      // tick a check alongside each finding line
      if (checks[k] && !/^(PASS|FAIL)/.test(text)) checks[k].classList.add(failing && k >= 1 ? 'bad' : 'ok');
      k++;
      return wait(/^(PASS|FAIL)/.test(text) ? 500 : 420).then(step);
    };
    return step();
  };

  // ---------- manual stepping ----------
  var pick = function (i) {
    runId++;
    run.textContent = 'Run the line';
    log.textContent = '';
    tabs.forEach(function (b, j) { mark(j, j < i ? 'pass' : null); });
    status.textContent = '';
    show(i);
    print(i, false, runId);
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
    var failing = fault.checked && FAIL_AT > 0;
    root.classList.remove('has-fault');
    run.textContent = 'Restart';
    log.textContent = '';
    tabs.forEach(function (b, j) { mark(j, null); });
    status.textContent = 'Running the line.';

    var from = function (i, allowFail) {
      if (id !== runId) return Promise.resolve();
      if (i >= stages.length) {
        status.textContent = failing ? 'Shipped after one repair. Every station passed in order on the second pass.' : 'Shipped. Every station passed in order.';
        run.textContent = 'Run it again';
        return Promise.resolve();
      }
      show(i);
      var fails = allowFail && i === FAIL_AT;
      if (fails) root.classList.add('has-fault');
      return wait(250).then(function () { return print(i, fails, id); }).then(function (ok) {
        if (!ok) return;
        if (!fails) { mark(i, 'pass'); return wait(350).then(function () { return from(i + 1, allowFail); }); }
        mark(i, 'fail');
        status.textContent = 'Network blade found a GPU missing from the fabric. The rack goes to debug.';
        return wait(2200).then(function () {
          if (id !== runId) return;
          root.classList.remove('has-fault');
          status.textContent = 'Fixed: the cable cartridge was reseated. The rack re-enters the line at Pretest, so the repair gets tested too.';
          for (var j = REENTER; j < stages.length; j++) mark(j, null);
          return wait(2000).then(function () { return from(REENTER, false); });
        });
      });
    };
    from(0, failing);
  };
  run.addEventListener('click', go);

  window.addEventListener('resize', function () { place(current); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(current); });

  // start on the first station, with its log shown, nothing running
  show(0);
  print(0, false, runId);
})();
