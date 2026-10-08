// Hero: fine dust rising through the sky, behind the plain HTML emblem and title.
import * as THREE from 'three';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createHero(canvas, { mobile = false, onStop } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const rand = rng(5776132);

  // ---- dust (rising) + faint stars (still, dark mode only) ----
  const tex = dotTexture();
  const ND = mobile ? 140 : 320;
  const dp = new Float32Array(ND * 3), ds = new Float32Array(ND);
  for (let i = 0; i < ND; i++) { dp[i * 3] = (rand() - 0.5) * 26; dp[i * 3 + 1] = (rand() - 0.5) * 16; dp[i * 3 + 2] = -6 + rand() * 8; ds[i] = 0.3 + rand(); }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: mobile ? 0.07 : 0.055, map: tex, color: '#F0D58E', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  dust.frustumCulled = false; scene.add(dust);
  const NS = mobile ? 120 : 260;
  const sp = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) { sp[i * 3] = (rand() - 0.5) * 60; sp[i * 3 + 1] = (rand() - 0.5) * 36; sp[i * 3 + 2] = -30 - rand() * 10; }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 0.16, map: tex, color: '#DCE4FF', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  stars.frustumCulled = false; scene.add(stars);

  // additive glow vanishes on a pale sky, so light mode draws the dust as normal ink
  function setTheme({ dark = false, dust: color } = {}) {
    const m = dust.material;
    m.color.set(color || (dark ? '#F0D58E' : '#B08A3E'));
    m.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.opacity = dark ? 0.75 : 0.5;
    m.size = (mobile ? 0.07 : 0.055) * (dark ? 1 : 1.15);
    m.needsUpdate = true;
    stars.visible = dark;
    S.lastP = -1;
  }

  const D = 12;
  function layout() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  layout();
  const ro = new ResizeObserver(layout); ro.observe(canvas);

  const S = { p: 0, mx: 0, my: 0, cx: 0, cy: 0, active: true, inView: true, level: 0, lastP: -1 };
  const onMove = (e) => { S.mx = (e.clientX / window.innerWidth) * 2 - 1; S.my = (e.clientY / window.innerHeight) * 2 - 1; };
  window.addEventListener('pointermove', onMove, { passive: true });
  const io = new IntersectionObserver(([en]) => { S.inView = en.isIntersecting; }, { threshold: 0 });
  io.observe(canvas);

  function render(t) {
    S.cx += (S.mx - S.cx) * 0.035; S.cy += (S.my - S.cy) * 0.035;
    const pos = dGeo.attributes.position.array;
    for (let i = 0; i < ND; i++) { pos[i * 3 + 1] += 0.004 * ds[i]; pos[i * 3] += Math.sin(t * 0.3 + i) * 0.0015; if (pos[i * 3 + 1] > 8) pos[i * 3 + 1] = -8; }
    dGeo.attributes.position.needsUpdate = true;
    camera.position.x = S.cx * 0.35; camera.position.y = -S.cy * 0.2 - S.p * 1.2;
    camera.lookAt(0, -S.p * 1.2, 0);
    renderer.render(scene, camera);
  }

  let frames = 0, acc = 0, warm = 0, last = 0;
  function govern(dt) {
    warm += dt; if (warm < 2) return;
    frames++; acc += dt; if (acc < 2.5) return;
    const fps = frames / acc; frames = 0; acc = 0;
    if (fps < 40 && S.level === 0) { S.level = 1; dpr = 1; renderer.setPixelRatio(1); layout(); }
    else if (fps < 22 && S.level === 1) { S.level = 2; if (onStop) onStop('fps'); }
  }

  let started = false;
  return {
    tick(time) {
      if (!S.active || !S.inView || document.hidden) { last = time; return; }
      const dt = last ? Math.min(0.1, time - last) : 0.016; last = time;
      if (S.level === 2) { if (S.p !== S.lastP) { S.lastP = S.p; render(time); } return; }
      render(time);
      govern(dt);
      if (!started) { started = true; requestAnimationFrame(() => { canvas.classList.add('is-live'); document.documentElement.classList.add('fx-live'); }); }
    },
    setProgress(p) { S.p = clamp01(p); },
    setTheme,
    destroy() { S.active = false; ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); renderer.dispose(); },
  };
}
