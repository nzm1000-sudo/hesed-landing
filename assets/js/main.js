// חסד יסובבנו — interactions. All content lives in the HTML; motion and 3D are enhancements.
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const mq = (q) => window.matchMedia(q);
const MOTION = root.classList.contains('motion');
const FX = root.classList.contains('fx');
const MOBILE = mq('(max-width: 767px)').matches || mq('(pointer: coarse)').matches;
const DESKTOP_SMOOTH = mq('(min-width: 1024px) and (pointer: fine)').matches;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------- palette ---------- */
const THEME = { lavender: '#EEEBFA', mint: '#E7F5F1', peach: '#FBF0EA' };
let heroScene = null;
function setPalette(name, save) {
  if (!THEME[name]) return;
  root.dataset.palette = name;
  $$('[data-set-palette]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setPalette === name)));
  const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', THEME[name]);
  if (save) { try { localStorage.setItem('hy-palette', name); } catch (e) { /* storage unavailable */ } }
  if (heroScene) heroScene.setPalette(name);
}
setPalette(root.dataset.palette || 'lavender', false);
const sw = $$('[data-set-palette]');
sw.forEach((b, i) => {
  b.addEventListener('click', () => setPalette(b.dataset.setPalette, true));
  b.addEventListener('keydown', (e) => {
    const k = e.key; let j = -1;
    // radiogroup arrow keys (RTL: left = next)
    if (k === 'ArrowLeft' || k === 'ArrowDown') j = (i + 1) % sw.length;
    if (k === 'ArrowRight' || k === 'ArrowUp') j = (i - 1 + sw.length) % sw.length;
    if (j < 0) return;
    e.preventDefault(); sw[j].focus(); setPalette(sw[j].dataset.setPalette, true);
  });
});
function syncSwatchTabs() { sw.forEach((b) => b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1); }
syncSwatchTabs();
sw.forEach((b) => b.addEventListener('click', syncSwatchTabs));
sw.forEach((b) => b.addEventListener('keyup', syncSwatchTabs));

/* ---------- menu ---------- */
let lenis = null;
const menu = $('#menu');
function openMenu() { if (typeof menu.showModal === 'function') menu.showModal(); else menu.setAttribute('open', ''); if (lenis) lenis.stop(); }
menu.addEventListener('close', () => { if (lenis) lenis.start(); });
menu.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });
$('[data-open-menu]').addEventListener('click', openMenu);
$$('[data-close]', menu).forEach((b) => b.addEventListener('click', () => menu.close()));
$$('[data-close-nav]', menu).forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  menu.close();
  if (lenis) { e.preventDefault(); lenis.scrollTo(id, { offset: -88 }); }
}));

/* ---------- nav: current section ---------- */
const navLinks = $$('.nav a');
const secIO = new IntersectionObserver((ents) => ents.forEach((en) => {
  if (!en.isIntersecting) return;
  navLinks.forEach((a) => { if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
}), { rootMargin: '-45% 0px -50% 0px' });
['about', 'timeline', 'pillars', 'gallery', 'contact'].forEach((id) => { const el = document.getElementById(id); if (el) secIO.observe(el); });

/* ---------- reveal + counters ---------- */
const counters = $$('[data-count]');
if (MOTION && 'IntersectionObserver' in window) {
  const rio = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target;
    const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains('reveal')) : [];
    const idx = Math.max(0, sibs.indexOf(el));
    el.style.transitionDelay = (Math.min(idx, 5) * 70) + 'ms';
    el.classList.add('is-in');
    rio.unobserve(el);
    $$('[data-count]', el).forEach(startCount);
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((el) => rio.observe(el));
  counters.forEach((c) => { c.textContent = '0'; });
} else {
  $$('.reveal').forEach((el) => el.classList.add('is-in'));
}
const tasks = new Set();
function startCount(el) {
  const to = Number(el.dataset.count); const t0 = performance.now();
  tasks.add(function step(now) {
    const k = clamp01((now - t0) / 1400); const e = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(to * e));
    if (k >= 1) tasks.delete(step);
  });
  kick();
}

/* ---------- form → WhatsApp ---------- */
const form = $('[data-form]');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.elements.name, phone = form.elements.phone;
  let ok = true;
  [name, phone].forEach((f) => { const bad = !f.value.trim(); f.setAttribute('aria-invalid', String(bad)); if (bad) ok = false; });
  if (!ok) { (name.value.trim() ? phone : name).focus(); return; }
  const lines = [
    'שם מלא: ' + name.value.trim(),
    'טלפון: ' + phone.value.trim(),
  ];
  if (form.elements.subject.value) lines.push('נושא: ' + form.elements.subject.value);
  if (form.elements.message.value.trim()) lines.push('הודעה: ' + form.elements.message.value.trim());
  window.open('https://wa.me/9720585555530?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  const btn = $('[data-submit]', form);
  btn.textContent = 'ההודעה נשלחה ✓';
  setTimeout(() => { btn.textContent = 'שלח הודעה'; }, 3000);
});
$$('input, textarea', form).forEach((f) => f.addEventListener('input', () => f.removeAttribute('aria-invalid')));

/* ---------- geometry cache (no per-frame layout reads) ---------- */
const hero = $('.hero');
const stage = $('.hero-stage');
const marks = $$('.wm').filter((w) => !w.classList.contains('wm--donate'));
const G = { vh: 0, heroSpan: 1, marks: [] };
function measure() {
  G.vh = document.documentElement.clientHeight;
  G.heroSpan = Math.max(1, hero.offsetHeight - stage.offsetHeight);
  G.marks = marks.map((m) => { const s = m.parentElement; let top = 0, el = s; while (el) { top += el.offsetTop; el = el.offsetParent; } return { m, center: top + s.offsetHeight / 2 }; });
  dirty = true; kick();
}
let dirty = true;
new ResizeObserver(measure).observe(document.body);
window.addEventListener('load', measure);

/* ---------- single frame loop ---------- */
let lastY = -1, rafId = 0, usingTicker = false;
const heroCopy = $('[data-hero-copy]');
function frame(nowMs) {
  if (lenis) lenis.raf(nowMs);
  const y = window.scrollY;
  if (y !== lastY || dirty) {
    lastY = y; dirty = false;
    if (FX) {
      const p = clamp01(y / G.heroSpan);
      const copy = 1 - smooth(0.03, 0.17, p);
      const verse = smooth(0.62, 0.78, p);
      hero.style.setProperty('--copy', copy.toFixed(3));
      hero.style.setProperty('--verse', verse.toFixed(3));
      heroCopy.toggleAttribute('data-hidden', copy < 0.02);
      if (heroScene) heroScene.setProgress(p);
    }
    if (MOTION) for (const k of G.marks) {
      const d = (y + G.vh / 2) - k.center;
      if (Math.abs(d) < G.vh * 1.5) k.m.style.translate = '0 ' + (d * -0.08).toFixed(1) + 'px';
    }
  }
  for (const fn of tasks) fn(nowMs);
  if (heroScene) heroScene.tick(nowMs / 1000);
}
// before GSAP arrives (or without it) a rAF loop runs only while something needs it
const busy = () => !!(heroScene || tasks.size || lenis || dirty || window.scrollY !== lastY);
function rafLoop(now) { rafId = 0; frame(now); if (!usingTicker && busy()) rafId = requestAnimationFrame(rafLoop); }
function kick() { if (!usingTicker && !rafId) rafId = requestAnimationFrame(rafLoop); }
window.addEventListener('scroll', kick, { passive: true });
measure();

/* ---------- keyboard focus into hero CTAs restores the copy ---------- */
heroCopy.addEventListener('focusin', () => { if (FX && window.scrollY > 10) window.scrollTo({ top: 0, behavior: 'auto' }); });

/* ---------- motion libs: GSAP + ScrollTrigger (+ Lenis on desktop) ---------- */
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
if (MOTION) {
  (async () => {
    try {
      await loadScript('assets/vendor/gsap.min.js');
      await loadScript('assets/vendor/ScrollTrigger.min.js');
      if (DESKTOP_SMOOTH) await loadScript('assets/vendor/lenis.min.js');
    } catch (e) { return; }
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    if (DESKTOP_SMOOTH && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -88 } });
      lenis.on('scroll', ScrollTrigger.update);
    }
    // one loop: GSAP's ticker drives Lenis, the hero scene and everything else
    usingTicker = true;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add((time) => frame(time * 1000));
    // timeline thread draws in as you read (scrub:true — no lag on top of Lenis)
    const tl = $('.tl');
    if (tl) {
      tl.classList.add('tl--draw');
      gsap.fromTo(tl, { '--draw': 0 }, { '--draw': 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 75%', end: 'bottom 60%', scrub: true } });
    }
    ScrollTrigger.refresh();
  })();
}

/* ---------- lazy 3D ---------- */
if (FX) {
  let booted = false;
  const boot = async () => {
    if (booted) return; booted = true;
    evs.forEach((ev) => window.removeEventListener(ev, boot));
    try {
      const { createHero } = await import('./hero-scene.js');
      heroScene = createHero($('.hero-canvas'), {
        mobile: MOBILE,
        palette: root.dataset.palette,
        onStop: () => { /* governor dropped to on-demand rendering */ },
      });
      dirty = true; kick();
      window.__hero = heroScene;
    } catch (err) {
      console.warn('3D disabled:', err && err.message);
      root.classList.remove('fx'); measure();
    }
  };
  const evs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
  evs.forEach((ev) => window.addEventListener(ev, boot, { passive: true }));
  // the 3D boots on the first interaction (scroll, touch, pointer, key); until then the hero is pure HTML
  if (new URLSearchParams(location.search).has('boot3d')) boot();
}
