// Progressive enhancement only: the page is complete and readable without JS.
// Motion rules: animate transform/opacity only, drive scroll work with
// IntersectionObserver + requestAnimationFrame, read layout before writing,
// skip everything for prefers-reduced-motion, and keep phones light.
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 880;
  var small = window.innerWidth < 720;
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
        if (e.isIntersecting && links[e.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); links[k].removeAttribute('aria-current'); });
          links[e.target.id].classList.add('active');
          links[e.target.id].setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  if (reduce || !hasIO) return; // final state is the default state

  window.__motion = true;
  root.classList.add('motion');

  // ---------- Count-up for impact numbers ----------
  var countUp = function (el) {
    var to = parseFloat(el.getAttribute('data-to'));
    if (!isFinite(to)) return;
    el.style.minWidth = String(to).length + 'ch';
    var start = null, dur = 1300;
    var step = function (t) {
      if (start === null) start = t;
      var k = clamp((t - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * eased);
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  };

  // ---------- Staggered children ----------
  var gap = small ? 14 : 22, cap = small ? 220 : 380;
  document.querySelectorAll('.stagger').forEach(function (list) {
    Array.prototype.forEach.call(list.children, function (c, i) { c.style.setProperty('--d', Math.min(i * gap, cap) + 'ms'); });
  });

  // ---------- One observer for everything that "arrives" ----------
  var arrive = function (el) {
    if (el.classList.contains('count')) countUp(el);
    else if (el.classList.contains('stack')) el.classList.add('on');
    else el.classList.add('in');
  };
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { arrive(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  var targets = document.querySelectorAll('.reveal, .role, .stagger, .stack, .count');
  targets.forEach(function (el) { io.observe(el); });
  // Anything already on screen (or reached via a #hash link) arrives right away,
  // so no text waits on an animation.
  requestAnimationFrame(function () {
    var vh = window.innerHeight, hits = [];
    targets.forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top < vh && r.bottom > 0) hits.push(el); });
    hits.forEach(function (el) { if (!el.classList.contains('count')) { arrive(el); io.unobserve(el); } });
  });

  // ---------- Pause looping animations while off screen ----------
  var loopers = document.querySelectorAll('.hero, .stack');
  var pauser = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle('paused', !e.isIntersecting); });
  });
  loopers.forEach(function (el) { pauser.observe(el); });

  // ---------- Pointer effects: desktop with a fine pointer only ----------
  if (!finePointer) return;
  root.classList.add('pointer');

  // Hero: the eye drifts toward the pointer, a soft light follows it
  var hero = document.querySelector('.hero');
  var eye = hero && hero.querySelector('.eye-svg');
  if (hero && eye) {
    var spot = document.createElement('div');
    spot.className = 'hero-spot';
    spot.setAttribute('aria-hidden', 'true');
    hero.insertBefore(spot, hero.firstChild);
    var heroRect = null, tx = 0, ty = 0, cx = 0, cy = 0, sx = 0, sy = 0, tsx = 0, tsy = 0, running = false;
    var loop = function () {
      cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
      sx += (tsx - sx) * 0.18; sy += (tsy - sy) * 0.18;
      eye.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
      spot.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0)';
      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05 || Math.abs(tsx - sx) > 0.5 || Math.abs(tsy - sy) > 0.5) requestAnimationFrame(loop);
      else running = false;
    };
    var kick = function () { if (!running) { running = true; requestAnimationFrame(loop); } };
    hero.addEventListener('pointerenter', function () { heroRect = hero.getBoundingClientRect(); hero.classList.add('pointing'); });
    hero.addEventListener('pointermove', function (e) {
      if (!heroRect) heroRect = hero.getBoundingClientRect();
      var px = (e.clientX - heroRect.left) / heroRect.width - 0.5;
      var py = (e.clientY - heroRect.top) / heroRect.height - 0.5;
      tx = px * -22; ty = py * -14;
      tsx = e.clientX - heroRect.left; tsy = e.clientY - heroRect.top;
      kick();
    });
    hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; hero.classList.remove('pointing'); heroRect = null; kick(); });
    window.addEventListener('scroll', function () { heroRect = null; }, { passive: true });
  }

  // Cards, portrait, photo tiles: gentle 3D tilt + spotlight
  document.querySelectorAll('.tilt').forEach(function (el) {
    var pending = null, max = el.classList.contains('feature') ? 2.5 : 5;
    var apply = function () {
      var p = pending; pending = null;
      if (!p) return;
      var r = el.getBoundingClientRect(); // one read per frame, then writes
      var mx = p.cx - r.left, my = p.cy - r.top;
      el.style.setProperty('--rx', ((my / r.height - 0.5) * -max).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((mx / r.width - 0.5) * max).toFixed(2) + 'deg');
      el.style.setProperty('--mx', mx.toFixed(0) + 'px');
      el.style.setProperty('--my', my.toFixed(0) + 'px');
    };
    el.addEventListener('pointerenter', function () { el.classList.add('tilting'); });
    el.addEventListener('pointermove', function (e) {
      if (!pending) requestAnimationFrame(apply);
      pending = { cx: e.clientX, cy: e.clientY };
    });
    el.addEventListener('pointerleave', function () {
      pending = null;
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
})();
