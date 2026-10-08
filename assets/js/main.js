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

let heroScene = null;
let lenis = null;

/* ---------- theme: palette (sky / sage / dusk) × mode (light / dark) ---------- */
const PALETTES = ['sky', 'sage', 'dusk'];
const css = (v) => getComputedStyle(root).getPropertyValue(v).trim();
function applyTheme() {
  const dark = root.dataset.mode === 'dark';
  $$('[data-mode-toggle]').forEach((b) => b.setAttribute('aria-checked', String(dark)));
  $$('[data-set-palette]').forEach((b) => {
    const on = b.dataset.setPalette === root.dataset.palette;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  const meta = $('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', css('--night'));
  if (heroScene) heroScene.setTheme({ dark, dust: css('--dust') });
}
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
function setPalette(name) { if (!PALETTES.includes(name)) return; root.dataset.palette = name; save('hy-palette', name); applyTheme(); }
$$('[data-mode-toggle]').forEach((b) => b.addEventListener('click', () => {
  root.dataset.mode = root.dataset.mode === 'dark' ? 'light' : 'dark';
  save('hy-mode', root.dataset.mode); applyTheme();
}));
$$('[role="radiogroup"]').forEach((g) => {
  const sw = $$('[data-set-palette]', g);
  sw.forEach((b, i) => {
    b.addEventListener('click', () => setPalette(b.dataset.setPalette));
    b.addEventListener('keydown', (e) => {
      // RTL radiogroup: left/down = next
      const k = e.key; let j = -1;
      if (k === 'ArrowLeft' || k === 'ArrowDown') j = (i + 1) % sw.length;
      if (k === 'ArrowRight' || k === 'ArrowUp') j = (i - 1 + sw.length) % sw.length;
      if (j < 0) return;
      e.preventDefault(); setPalette(sw[j].dataset.setPalette); sw[j].focus();
    });
  });
});
applyTheme();

/* ---------- scroll state: sticky donate bar appears after the hero, steps aside while reading down ---------- */
const hero = $('.hero');
{
  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY, max = root.scrollHeight - innerHeight;
    root.classList.toggle('past-hero', y > hero.offsetHeight * 0.7);
    root.classList.toggle('scrolled', y > 40);
    const hide = y > lastY + 4 && y > 200 && y < max - 200;
    const show = y < lastY - 4 || y <= 200 || y >= max - 200;
    if (hide) root.classList.add('ui-hidden'); else if (show) root.classList.remove('ui-hidden');
    lastY = y;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
}

/* ---------- menu ---------- */
const menu = $('#menu');
function openMenu() { if (typeof menu.showModal === 'function') menu.showModal(); else menu.setAttribute('open', ''); if (lenis) lenis.stop(); }
menu.addEventListener('close', () => { if (lenis) lenis.start(); });
menu.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });
$('[data-open-menu]').addEventListener('click', openMenu);
$$('[data-close]', menu).forEach((b) => b.addEventListener('click', () => menu.close()));
$$('[data-close-nav]', menu).forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  menu.close();
  if (lenis) { e.preventDefault(); lenis.scrollTo(id, { offset: -96 }); }
}));

/* ---------- nav: current section ---------- */
const navLinks = $$('.nav a');
const secIO = new IntersectionObserver((ents) => ents.forEach((en) => {
  if (!en.isIntersecting) return;
  navLinks.forEach((a) => { if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
}), { rootMargin: '-45% 0px -50% 0px' });
['top', 'about', 'timeline', 'pillars', 'contact'].forEach((id) => { const el = document.getElementById(id); if (el) secIO.observe(el); });

/* ---------- reveal + counters ---------- */
const counters = $$('[data-count]');
if (MOTION && 'IntersectionObserver' in window) {
  const rio = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target;
    const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains('reveal')) : [];
    const idx = Math.max(0, sibs.indexOf(el));
    el.style.transitionDelay = (Math.min(idx, 6) * 70) + 'ms';
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
  const lines = ['שם מלא: ' + name.value.trim(), 'טלפון: ' + phone.value.trim()];
  if (form.elements.subject.value) lines.push('נושא: ' + form.elements.subject.value);
  if (form.elements.message.value.trim()) lines.push('הודעה: ' + form.elements.message.value.trim());
  window.open('https://wa.me/9720585555530?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  const btn = $('[data-submit]', form), status = $('[data-status]', form);
  btn.textContent = status.textContent = 'ההודעה נשלחה ✓';
  btn.classList.add('is-sent');
  setTimeout(() => { btn.textContent = 'שלח הודעה'; btn.classList.remove('is-sent'); status.textContent = ''; }, 3000);
});
$$('input, textarea', form).forEach((f) => f.addEventListener('input', () => f.removeAttribute('aria-invalid')));

/* ---------- geometry cache (no per-frame layout reads) ---------- */
const stage = $('.hero-stage');
const G = { heroSpan: 1 };
let dirty = true;
function measure() { G.heroSpan = Math.max(1, stage.offsetHeight * 0.9); dirty = true; kick(); }
new ResizeObserver(measure).observe(document.body);
window.addEventListener('load', measure);

/* ---------- single frame loop ---------- */
let lastY = -1, rafId = 0, usingTicker = false;
function frame(nowMs) {
  if (lenis) lenis.raf(nowMs);
  const y = window.scrollY;
  if (y !== lastY || dirty) {
    lastY = y; dirty = false;
    const p = clamp01(y / G.heroSpan);
    hero.style.setProperty('--hero-p', p.toFixed(3));
    if (heroScene) heroScene.setProgress(p);
  }
  for (const fn of tasks) fn(nowMs);
  if (heroScene) heroScene.tick(nowMs / 1000);
}
const busy = () => !!(heroScene || tasks.size || lenis || dirty || window.scrollY !== lastY);
function rafLoop(now) { rafId = 0; frame(now); if (!usingTicker && busy()) rafId = requestAnimationFrame(rafLoop); }
function kick() { if (!usingTicker && !rafId) rafId = requestAnimationFrame(rafLoop); }
window.addEventListener('scroll', kick, { passive: true });
measure();

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
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -96 } });
      lenis.on('scroll', ScrollTrigger.update);
    }
    usingTicker = true;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add((time) => frame(time * 1000));
    // the timeline's gold thread draws in as you read
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
      heroScene = createHero($('.hero-canvas'), { mobile: MOBILE, onStop: () => {} });
      applyTheme();
      dirty = true; kick();
      window.__hero = heroScene;
    } catch (err) {
      console.warn('3D disabled:', err && err.message);
      root.classList.remove('fx'); measure();
    }
  };
  const evs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
  evs.forEach((ev) => window.addEventListener(ev, boot, { passive: true }));
  // boot shortly after load as well, so the first impression already has depth
  if (new URLSearchParams(location.search).has('boot3d')) boot();
  else if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 1800 });
  else setTimeout(boot, 1200);
}
