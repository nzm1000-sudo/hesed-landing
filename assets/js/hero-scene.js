// Hero: twelve frosted-glass tiles (the חסד יסובבנו emblem) drift in soft light and
// assemble into the emblem grid on scroll; a glass orb (כזוהר הרקיע) then circles behind
// them and is refracted through the tiles. One render per tick, driven by main.js.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/addons/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/three/addons/RoundedBoxGeometry.js';

export const SCENE_PALETTES = {
  lavender: { top: '#F8F6FE', bot: '#EEEBFA', b: ['#C8B6F2', '#A9BCF5', '#F2CFE6', '#BEE3F2'] },
  mint: { top: '#F5FBF9', bot: '#E7F5F1', b: ['#A6E3CF', '#9CD6E4', '#D3F0DC', '#BFD4F4'] },
  peach: { top: '#FFF9F5', bot: '#FBF0EA', b: ['#FFC9A6', '#F4BFCD', '#F9E3A3', '#E3CBEE'] },
};
// logo colours, row-major as drawn (left → right, top → bottom)
const TILE_COLORS = ['#BF1931', '#2AA64E', '#22804C', '#1445C6', '#1F74E8', '#F9F2E2', '#E8BE07', '#81A231', '#9335C9', '#C37B19', '#1C1B19', '#C42E16'];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const BG_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const BG_FRAG = /* glsl */`
uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uB1; uniform vec3 uB2; uniform vec3 uB3; uniform vec3 uB4;
uniform float uTime; uniform float uAspect;
varying vec2 vUv;
float blob(vec2 p, vec2 c, float r) { vec2 d = p - c; d.x *= uAspect; return exp(-dot(d, d) / (r * r)); }
void main() {
  vec3 col = mix(uBot, uTop, smoothstep(0.0, 1.0, vUv.y));
  float t = uTime * 0.06;
  col = mix(col, uB1, 0.80 * blob(vUv, vec2(0.80 + 0.07 * sin(t * 1.3), 0.86 + 0.05 * cos(t)), 0.46));
  col = mix(col, uB2, 0.75 * blob(vUv, vec2(0.16 + 0.06 * cos(t * 0.9), 0.20 + 0.06 * sin(t * 1.1)), 0.50));
  col = mix(col, uB3, 0.60 * blob(vUv, vec2(0.30 + 0.10 * sin(t * 0.7), 0.66 + 0.07 * sin(t * 1.4)), 0.34));
  col = mix(col, uB4, 0.55 * blob(vUv, vec2(0.74 + 0.08 * cos(t * 1.2), 0.30 + 0.08 * cos(t * 0.8)), 0.34));
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createHero(canvas, { mobile = false, palette = 'lavender', onStop } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (mobile) renderer.transmissionResolutionScale = 0.6;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.05;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // ---- background: soft drifting light (opaque, so the glass refracts it) ----
  const P0 = SCENE_PALETTES[palette] || SCENE_PALETTES.lavender;
  const bgU = {
    uTop: { value: new THREE.Color(P0.top) }, uBot: { value: new THREE.Color(P0.bot) },
    uB1: { value: new THREE.Color(P0.b[0]) }, uB2: { value: new THREE.Color(P0.b[1]) },
    uB3: { value: new THREE.Color(P0.b[2]) }, uB4: { value: new THREE.Color(P0.b[3]) },
    uTime: { value: 0 }, uAspect: { value: 1 },
  };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: bgU, vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthWrite: false, depthTest: false }));
  bg.frustumCulled = false; bg.renderOrder = -10;
  scene.add(bg);
  const target = { top: new THREE.Color(P0.top), bot: new THREE.Color(P0.bot), b: P0.b.map((h) => new THREE.Color(h)) };

  // ---- tiles ----
  const root = new THREE.Group();
  scene.add(root);
  const emblem = new THREE.Group();
  root.add(emblem);
  const TW = 1.0, TH = 0.92, TD = 0.3, GX = 1.3, GY = 1.12;
  const geo = new RoundedBoxGeometry(TW, TH, TD, mobile ? 2 : 4, 0.11);
  const white = new THREE.Color('#ffffff');
  const rand = rng(5776132);
  const order = [...Array(12).keys()].sort(() => rand() - 0.5);
  const tiles = TILE_COLORS.map((hex, i) => {
    const c = new THREE.Color(hex);
    const dark = hex === '#1C1B19', light = hex === '#F9F2E2';
    const m = new THREE.MeshPhysicalMaterial({
      color: dark ? new THREE.Color('#8a8794') : c.clone().lerp(white, light ? 0.7 : 0.38),
      metalness: 0,
      roughness: 0.36,
      transmission: 1,
      thickness: 0.7,
      ior: 1.42,
      attenuationColor: light ? new THREE.Color('#FFF6E4') : dark ? new THREE.Color('#55525e') : c,
      attenuationDistance: dark ? 0.8 : light ? 3 : 1.1,
      iridescence: 0.35,
      iridescenceIOR: 1.28,
      iridescenceThicknessRange: [120, 420],
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
      specularIntensity: 1,
    });
    const mesh = new THREE.Mesh(geo, m);
    const col = i % 3, row = Math.floor(i / 3);
    const home = new THREE.Vector3((col - 1) * GX, (1.5 - row) * GY, 0);
    emblem.add(mesh);
    return {
      mesh, home,
      scatter: new THREE.Vector3(),
      rot0: new THREE.Euler((rand() - 0.5) * 1.6, (rand() - 0.5) * 1.8, (rand() - 0.5) * 1.2),
      spin: (rand() - 0.5) * 0.25,
      phase: rand() * Math.PI * 2,
      start: 0.05 + order.indexOf(i) * 0.02,
      r: [rand(), rand(), rand(), rand()],
    };
  });

  // gold frame (thin rounded outline) + four corner rings, as in the emblem
  const FW = 4.5, FH = 5.15;
  const frameShape = roundedRectShape(FW, FH, 0.28);
  frameShape.holes.push(roundedRectShape(FW - 0.12, FH - 0.12, 0.23));
  const gold = new THREE.MeshPhysicalMaterial({ color: '#D8B160', metalness: 1, roughness: 0.28, clearcoat: 0.6, transparent: true, opacity: 0 });
  const frame = new THREE.Group();
  const frameMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: mobile ? 6 : 10 }), gold);
  frameMesh.position.z = -0.05;
  frame.add(frameMesh);
  const ringGeo = new THREE.TorusGeometry(0.075, 0.016, 8, mobile ? 18 : 28);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const r = new THREE.Mesh(ringGeo, gold); r.position.set(sx * (FW / 2 - 0.17), sy * (FH / 2 - 0.17), 0); frame.add(r);
  }
  emblem.add(frame);

  // ---- כזוהר הרקיע: glass orb with a blue core and a champagne ring ----
  const orb = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, mobile ? 32 : 48, mobile ? 24 : 32), new THREE.MeshPhysicalMaterial({
    color: '#ffffff', metalness: 0, roughness: 0.04, transmission: 1, thickness: 1.2, ior: 1.5, iridescence: 0.25, clearcoat: 1, clearcoatRoughness: 0.05,
    attenuationColor: new THREE.Color('#EAF4FF'), attenuationDistance: 4,
  }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#2F6FB4', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#1E4F8C', emissiveIntensity: 0.25 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.014, 8, mobile ? 64 : 120), new THREE.MeshPhysicalMaterial({ color: '#D9CFB4', metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0.9 }));
  ring.rotation.set(1.18, 0.2, 0.3);
  orb.add(core, shell, ring);
  orb.visible = false;
  root.add(orb);

  // ---- motes ----
  const NM = mobile ? 70 : 140;
  const mp = new Float32Array(NM * 3), ms = new Float32Array(NM);
  for (let i = 0; i < NM; i++) { mp[i * 3] = (rand() - 0.5) * 22; mp[i * 3 + 1] = (rand() - 0.5) * 16; mp[i * 3 + 2] = -4 + rand() * 7; ms[i] = rand(); }
  const mgeo = new THREE.BufferGeometry();
  mgeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mgeo, new THREE.PointsMaterial({ size: mobile ? 0.07 : 0.06, map: dotTexture(), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffffff' }));
  motes.frustumCulled = false;
  scene.add(motes);

  // ---- layout ----
  const L = { vw: 10, vh: 10, portrait: false, orbR: 3.4 };
  function layout() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    L.portrait = camera.aspect < 0.9;
    // emblem ≈ 48% of the height, never wider than 62% of the width
    const vhNeeded = Math.max(FH / 0.48, FW / ((L.portrait ? 0.7 : 0.62) * camera.aspect));
    const D = vhNeeded / (2 * tan);
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    L.vh = 2 * D * tan; L.vw = L.vh * camera.aspect;
    L.orbR = Math.min(FW * 0.5 + 1.1, L.vw * 0.42);
    bgU.uAspect.value = camera.aspect;
    // scatter tiles around the copy, leaving the centre clear
    tiles.forEach((t, i) => {
      const [a, b, c, d] = t.r;
      let ang;
      if (L.portrait) {
        const top = i % 2 === 0;
        ang = (top ? 0.5 : 1.5) * Math.PI + (a - 0.5) * 1.9;   // upper and lower bands only
      } else {
        ang = (i / 12) * Math.PI * 2 + (a - 0.5) * 0.35;
      }
      const rx = L.vw * (L.portrait ? 0.36 : 0.36 + b * 0.08);
      const ry = L.vh * (L.portrait ? 0.34 + b * 0.08 : 0.3 + b * 0.1);
      t.scatter.set(Math.cos(ang) * rx, Math.sin(ang) * ry, -2.6 + c * 3.6);
      if (L.portrait) t.scatter.x = (d - 0.5) * L.vw * 0.8;
    });
  }
  layout();
  const ro = new ResizeObserver(layout); ro.observe(canvas);

  // ---- state ----
  const S = { p: 0, mx: 0, my: 0, cx: 0, cy: 0, active: true, inView: true, level: 0, needsFrame: true, lastP: -1 };
  const onMove = (e) => { S.mx = (e.clientX / window.innerWidth) * 2 - 1; S.my = (e.clientY / window.innerHeight) * 2 - 1; };
  window.addEventListener('pointermove', onMove, { passive: true });
  const io = new IntersectionObserver(([en]) => { S.inView = en.isIntersecting; }, { threshold: 0 });
  io.observe(canvas);

  const q0 = new THREE.Quaternion(), qI = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  function render(t) {
    const p = S.p;
    bgU.uTime.value = t;
    // palette crossfade
    const k = 0.06;
    bgU.uTop.value.lerp(target.top, k); bgU.uBot.value.lerp(target.bot, k);
    bgU.uB1.value.lerp(target.b[0], k); bgU.uB2.value.lerp(target.b[1], k); bgU.uB3.value.lerp(target.b[2], k); bgU.uB4.value.lerp(target.b[3], k);

    S.cx += (S.mx - S.cx) * 0.04; S.cy += (S.my - S.cy) * 0.04;
    const A = smooth(0.4, 0.66, p);
    root.position.y = L.vh * 0.035 * A;
    emblem.rotation.y = S.cx * 0.22 + Math.sin(t * 0.28) * 0.1 * A;
    emblem.rotation.x = S.cy * 0.12 + Math.sin(t * 0.21) * 0.04 * A;

    tiles.forEach((tile, i) => {
      const a = smooth(tile.start, tile.start + 0.34, p);
      const float = (1 - a);
      v.copy(tile.scatter).lerp(tile.home, a);
      v.z += Math.sin(a * Math.PI) * 1.4;
      v.y += Math.sin(t * 0.55 + tile.phase) * 0.14 * float + Math.sin(t * 0.8 + i) * 0.015 * a;
      tile.mesh.position.copy(v);
      e.set(tile.rot0.x + t * tile.spin * float, tile.rot0.y + t * tile.spin * 0.7 * float, tile.rot0.z);
      q0.setFromEuler(e);
      tile.mesh.quaternion.copy(q0).slerp(qI, a);
    });

    const f = smooth(0.46, 0.64, p);
    gold.opacity = f;
    frame.visible = f > 0.001;
    frame.scale.setScalar(0.94 + 0.06 * f);

    const o = smooth(0.52, 0.8, p);
    orb.visible = o > 0.001;
    if (orb.visible) {
      const phi = t * 0.22 + 2.2;
      const s = (L.portrait ? 0.8 : 1) * (0.2 + 0.8 * o);
      orb.scale.setScalar(s);
      // the orb only ever travels behind the emblem, so it is seen through (and refracted by) the glass
      orb.position.set(Math.cos(phi) * L.orbR, 0.25 * Math.sin(t * 0.5) - (1 - o) * 4, -Math.abs(Math.sin(phi)) * 2.2 - 0.7);
      ring.rotation.z = t * 0.15;
    }
    motes.rotation.y = t * 0.01;
    const pos = mgeo.attributes.position.array;
    for (let i = 0; i < NM; i++) { pos[i * 3 + 1] += 0.0025 * (0.4 + ms[i]); if (pos[i * 3 + 1] > 8) pos[i * 3 + 1] = -8; }
    mgeo.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  // FPS governor
  let frames = 0, acc = 0, warm = 0, last = 0;
  function govern(dt) {
    warm += dt; if (warm < 2) return;
    frames++; acc += dt; if (acc < 2.5) return;
    const fps = frames / acc; frames = 0; acc = 0;
    if (fps < 40 && S.level === 0) { S.level = 1; dpr = 1; renderer.setPixelRatio(1); renderer.transmissionResolutionScale = 0.5; layout(); }
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
      if (!started) { started = true; requestAnimationFrame(() => canvas.classList.add('is-live')); }
    },
    setProgress(p) { S.p = p; },
    setPalette(name) {
      const P = SCENE_PALETTES[name]; if (!P) return;
      target.top.set(P.top); target.bot.set(P.bot); P.b.forEach((h, i) => target.b[i].set(h));
    },
    destroy() { S.active = false; ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); renderer.dispose(); },
  };
}
