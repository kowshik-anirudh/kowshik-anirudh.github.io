// Progressive enhancement only: the page is complete and readable without JS.
// Motion rules: animate transform/opacity only, drive scroll work with
// IntersectionObserver + requestAnimationFrame, read layout before writing,
// never hide something that is already on screen, and honour
// prefers-reduced-motion (static final state, no loops).
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  // ---------- Scroll progress line + nav state (one rAF-throttled scroll handler) ----------
  var bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  var nav = document.querySelector('.nav');
  var timeline = document.querySelector('.timeline');
  var maxScroll = 1;
  var measure = function () { maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
  var ticking = false;
  var onFrame = function () {
    ticking = false;
    var y = window.scrollY;
    // reads first
    var tl = (!reduce && timeline) ? timeline.getBoundingClientRect() : null;
    var vh = window.innerHeight;
    // then writes
    bar.style.transform = 'scaleX(' + clamp(y / maxScroll, 0, 1) + ')';
    if (nav) nav.classList.toggle('scrolled', y > 8);
    if (tl) timeline.style.setProperty('--p', clamp((vh * 0.7 - tl.top) / tl.height, 0, 1).toFixed(4));
  };
  var request = function () { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', function () { measure(); request(); }, { passive: true });
  window.addEventListener('load', function () { measure(); request(); });
  measure(); onFrame();

  // ---------- Highlight the current section in the nav (home page only) ----------
  var links = {};
  document.querySelectorAll('.nav li a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  if (hasIO && Object.keys(links).length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); links[k].removeAttribute('aria-current'); });
        if (links[e.target.id]) {
          links[e.target.id].classList.add('active');
          links[e.target.id].setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // ---------- Hero scope: a simulated PRBS7 eye diagram on a canvas ----------
  // Without JS the static SVG behind the canvas shows. With JS, the canvas
  // draws one full static frame first; the sweep only runs while the scope is
  // on screen, the tab is visible and reduced motion is off.
  (function scope() {
    var fig = document.querySelector('.scope');
    var canvas = fig && fig.querySelector('.scope-canvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var meas = fig.querySelector('.scope-meas');
    var ehEl = fig.querySelector('[data-eh]');
    var ewEl = fig.querySelector('[data-ew]');
    var hint = fig.querySelector('.hint');

    var W = 0, H = 0, dpr = 1;
    var NOISE = [0.035, 0.11];   // amplitude noise (fraction of swing), calm -> jittery
    var JIT = [0.03, 0.13];      // timing jitter (fraction of a unit interval)
    var heat = 0, heatTarget = 0;

    // PRBS7 (x^7 + x^6 + 1)
    var lfsr = 0x5a;
    var nextBit = function () { var b = ((lfsr >> 6) ^ (lfsr >> 5)) & 1; lfsr = ((lfsr << 1) | b) & 0x7f; return b; };
    var gauss = function () { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732; };
    var bits = [nextBit(), nextBit()];

    // Rolling window of measurements taken from the traces actually drawn
    var WIN = 240, hi = [], lo = [], cross = [];
    var push = function (arr, v) { arr.push(v); if (arr.length > WIN) arr.shift(); };

    // One trace = three bit periods across the 2-UI screen; crossings sit at 1/4 and 3/4.
    var makeTrace = function () {
      bits.push(nextBit());
      if (bits.length > 3) bits.shift();
      var noise = NOISE[0] + (NOISE[1] - NOISE[0]) * heat;
      var jit = JIT[0] + (JIT[1] - JIT[0]) * heat;
      var lv = bits.map(function (b) { return (b ? 1 : -1) * (1 + gauss() * noise); });
      var t1 = 0.5 + gauss() * jit, t2 = 1.5 + gauss() * jit;
      push(bits[1] ? hi : lo, lv[1]);
      if (bits[0] !== bits[1]) push(cross, t1 - 0.5);
      if (bits[1] !== bits[2]) push(cross, t2 - 1.5);
      return { lv: lv, t1: t1, t2: t2 };
    };
    var edge = function (u) { return u <= 0 ? 0 : u >= 1 ? 1 : (1 - Math.cos(Math.PI * u)) / 2; };
    var TR = 0.5; // rise time in UI
    var volt = function (tr, t) {
      var v = tr.lv[0];
      v += (tr.lv[1] - tr.lv[0]) * edge((t - tr.t1) / TR + 0.5);
      v += (tr.lv[2] - tr.lv[1]) * edge((t - tr.t2) / TR + 0.5);
      return v;
    };
    var X = function (t) { return (t / 2) * W; };
    var Y = function (v) { return H / 2 - v * H * 0.32; };

    var stroke = function (tr, t0, t1, alpha) {
      ctx.beginPath();
      var steps = Math.max(2, Math.ceil((t1 - t0) * 40));
      for (var i = 0; i <= steps; i++) {
        var t = t0 + (t1 - t0) * i / steps;
        var px = X(t), py = Y(volt(tr, t));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(124,196,184,' + alpha + ')';
      ctx.stroke();
    };

    var readout = function () {
      if (!meas || !hi.length || !lo.length) return;
      var minHi = Math.min.apply(null, hi), maxLo = Math.max.apply(null, lo);
      var eh = clamp((minHi - maxLo) / 2, 0, 1);
      var ew = 1;
      if (cross.length > 1) ew = clamp(1 - (Math.max.apply(null, cross) - Math.min.apply(null, cross)), 0, 1);
      ehEl.textContent = Math.round(eh * 100) + '%';
      ewEl.textContent = ew.toFixed(2) + ' UI';
      meas.hidden = false;
    };

    var size = function () {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      ctx.lineWidth = 1.1 * dpr;
      ctx.lineJoin = 'round';
    };

    // A full persistence frame: used on load, on resize, and as the reduced-motion view.
    var drawStatic = function () {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 200; i++) stroke(makeTrace(), 0, 2, 0.14);
      readout();
    };

    size();
    drawStatic();
    fig.classList.add('live');

    var running = false, visible = true, beam = 0, active = [], lastRead = 0, raf = 0;
    var BATCH = 28, SWEEP_MS = 1000, last = 0;
    var frame = function (now) {
      if (!running) return;
      var dt = last ? Math.min(now - last, 64) : 16;
      last = now;
      heat += (heatTarget - heat) * 0.06;
      // persistence: fade what is already on screen
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,' + (0.012 * dt / 16).toFixed(4) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      if (!active.length) { active = []; for (var i = 0; i < BATCH; i++) active.push(makeTrace()); }
      var from = beam;
      beam = Math.min(2, beam + 2 * dt / SWEEP_MS);
      for (var j = 0; j < active.length; j++) stroke(active[j], Math.max(0, from - 0.02), beam, 0.22);
      if (beam >= 2) { beam = 0; active = []; }
      if (now - lastRead > 450) { readout(); lastRead = now; }
      raf = requestAnimationFrame(frame);
    };
    var start = function () { if (running || reduce || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    var stop = function () { running = false; cancelAnimationFrame(raf); };

    var resized = function () { size(); if (!running) drawStatic(); };
    if ('ResizeObserver' in window) new ResizeObserver(resized).observe(canvas);
    else window.addEventListener('resize', resized, { passive: true });

    if (reduce) { if (hint) hint.remove(); return; }

    if (hasIO) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    start();

    // Point at it (or tap it) to add jitter; the readout closes up to match.
    var hover = window.matchMedia('(hover: hover)').matches;
    var screen = fig.querySelector('.scope-screen');
    screen.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') heatTarget = 1; });
    screen.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') heatTarget = 0; });
    screen.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') heatTarget = heatTarget ? 0 : 1; });
    if (hint) {
      hint.textContent = hover ? ' Point at it to add jitter.' : ' Tap it to add jitter, and tap again to clear it.';
      hint.hidden = false;
    }
  })();

  if (reduce || !hasIO) return; // final state is the default state

  // ---------- Arrivals: sections and roles fade up as they scroll in ----------
  // Anything already on screen is marked as arrived *before* .motion is added,
  // so content that is visible never disappears.
  var arrive = function (el) { el.classList.add(el.classList.contains('stack') ? 'on' : 'in'); };
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { arrive(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  var vh = window.innerHeight;
  var targets = Array.prototype.slice.call(document.querySelectorAll('.reveal, .role, .stack'));
  var rects = targets.map(function (el) { return el.getBoundingClientRect(); });
  targets.forEach(function (el, i) {
    if (rects[i].top < vh && rects[i].bottom > 0) arrive(el); else io.observe(el);
  });
  root.classList.add('motion');

  // ---------- Pause looping animations while off screen ----------
  var pauser = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle('paused', !e.isIntersecting); });
  });
  document.querySelectorAll('.hero, .stack').forEach(function (el) { pauser.observe(el); });
})();
