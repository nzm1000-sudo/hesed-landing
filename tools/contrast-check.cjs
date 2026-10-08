// WCAG 2.2 AA contrast check for every palette × mode defined in assets/css/site.css.
// Usage: node tools/contrast-check.cjs   (exit code 1 if any pair fails)
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../assets/css/site.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function tokens(selectorTest) {
  const out = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (!selectorTest(m[1].trim())) continue;
    for (const [, k, v] of m[2].matchAll(/(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\b/g)) out[k] = v;
  }
  return out;
}

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground tokens, background tokens, minimum, what]
const TEXT = 4.5, LARGE = 3, UI = 3;
const RULES = [
  [['--ink', '--ink-2', '--ink-3'], ['--ivory', '--ivory-2', '--paper', '--field-bg'], TEXT, 'body text on page/cards/fields'],
  [['--gold-ink'], ['--ivory', '--ivory-2', '--paper'], TEXT, 'gold text on page/cards'],
  [['--on-night', '--on-night-2', '--gold-hi'], ['--night', '--night-2', '--night-3', '--band-card-1', '--band-card-2'], TEXT, 'text on bands'],
  [['--on-gold'], ['--g1', '--g2', '--g3', '--g4'], TEXT, 'button label on every gold stop'],
  [['--ok'], ['--paper'], TEXT, 'form confirmation'],
  [['--title-1', '--title-2'], ['--night', '--night-2', '--night-3'], LARGE, 'hero title gradient (large text)'],
  [['--field-border', '--danger'], ['--field-bg', '--paper'], UI, 'input boundary'],
  [['--gold-lo'], ['--ivory', '--ivory-2', '--paper', '--medal-2'], UI, 'icons / outline buttons on light'],
  [['--gold-hi'], ['--bmedal-1', '--bmedal-2'], UI, 'icons on band medals'],
  [['--focus'], ['--ivory', '--ivory-2', '--paper', '--night', '--night-2', '--band-card-1'], UI, 'focus ring'],
];

const PALETTES = ['sky', 'sage', 'dusk'];
let fails = 0;
for (const p of PALETTES) {
  const light = { ...tokens((s) => s.split(',').map((x) => x.trim()).includes(`:root[data-palette="${p}"]`) || (p === 'sky' && s.startsWith(':root,'))) };
  const dark = { ...light, ...tokens((s) => s === `:root[data-palette="${p}"][data-mode="dark"]`) };
  for (const [mode, t] of [['light', light], ['dark', dark]]) {
    t['--focus'] = t['--gold-ink'];
    let worst = Infinity;
    const bad = [];
    for (const [fgs, bgs, min, what] of RULES) {
      for (const f of fgs) for (const b of bgs) {
        if (!t[f] || !t[b]) { bad.push(`missing ${f} / ${b}`); continue; }
        const r = ratio(t[f], t[b]);
        worst = Math.min(worst, r / min);
        if (r < min) bad.push(`${f} ${t[f]} on ${b} ${t[b]} = ${r.toFixed(2)} < ${min} (${what})`);
      }
    }
    fails += bad.length;
    console.log(`${bad.length ? 'FAIL' : 'pass'}  ${p.padEnd(5)} ${mode.padEnd(5)}  tightest margin ×${worst.toFixed(2)}`);
    bad.forEach((l) => console.log('      ' + l));
  }
}
const wa = ratio('#FFFFFF', '#1FA855');
console.log(`${wa >= UI ? 'pass' : 'FAIL'}  WhatsApp icon ${wa.toFixed(2)}`);
if (wa < UI) fails++;
process.exit(fails ? 1 : 0);
