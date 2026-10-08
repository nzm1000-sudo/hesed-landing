/*
 * Regenerates the static assets (the site itself needs no build step).
 *   npm i three@0.180.0 gsap@3.15.0 lenis@1.3.26 @fontsource/frank-ruhl-libre @fontsource/assistant sharp
 *   node tools/build-assets.cjs [folder-with-graded-photos]
 * Photos: AI-generated (Gemini), QA'd by hand, film-graded; the graded 1200x800 JPEGs are not committed.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..');
const out = (...p) => path.join(ROOT, 'assets', ...p);
const mk = (d) => fs.mkdirSync(d, { recursive: true });
const nm = (p) => require.resolve(p);
const strip = (p) => fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m, ''));

// vendor
mk(out('vendor', 'three', 'addons'));
const threeRoot = path.resolve(path.dirname(nm('three')), '..');
for (const f of ['three.module.min.js', 'three.core.min.js']) fs.copyFileSync(path.join(threeRoot, 'build', f), out('vendor', 'three', f));
for (const f of ['environments/RoomEnvironment.js', 'geometries/RoundedBoxGeometry.js']) {
  fs.copyFileSync(path.join(threeRoot, 'examples', 'jsm', f), out('vendor', 'three', 'addons', path.basename(f)));
}
const gsapDir = path.dirname(nm('gsap/dist/gsap.min.js'));
for (const f of ['gsap.min.js', 'ScrollTrigger.min.js']) fs.copyFileSync(path.join(gsapDir, f), out('vendor', f));
fs.copyFileSync(path.join(path.dirname(nm('lenis')), 'lenis.min.js'), out('vendor', 'lenis.min.js'));
for (const f of fs.readdirSync(out('vendor'))) if (f.endsWith('.js')) strip(out('vendor', f));
for (const f of fs.readdirSync(out('vendor', 'three'))) if (f.endsWith('.js')) strip(out('vendor', 'three', f));

// fonts
mk(out('fonts'));
const fsrc = (pkg, f) => path.join(path.dirname(nm(`@fontsource/${pkg}/package.json`)), 'files', f);
const fonts = [
  ...[400, 500].flatMap((w) => ['hebrew', 'latin'].map((s) => ['frank-ruhl-libre', `frank-ruhl-libre-${s}-${w}-normal.woff2`])),
  ...[400, 600].flatMap((w) => ['hebrew', 'latin'].map((s) => ['assistant', `assistant-${s}-${w}-normal.woff2`])),
];
for (const [pkg, f] of fonts) fs.copyFileSync(fsrc(pkg, f), out('fonts', f));

(async () => {
  // icons: the stone plaque cut from the original logo (assets/img/mark.png)
  const mark = out('img', 'mark.png');
  const fit = (box) => sharp(mark).resize({ width: box, height: box, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp(await fit(32)).toFile(path.join(ROOT, 'favicon-32.png'));
  // apple-touch-icon on ivory (iOS does not keep transparency)
  await sharp({ create: { width: 180, height: 180, channels: 4, background: '#F8F6F0' } }).composite([{ input: await fit(136), gravity: 'center' }]).png().toFile(path.join(ROOT, 'apple-touch-icon.png'));

  const SRC = process.argv[2];
  if (!SRC) return console.log('vendor/fonts/icons done (no photo folder given)');
  mk(out('img', 'photos'));
  for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.jpg'))) {
    const name = f.replace(/\.jpg$/, '');
    for (const w of [480, 800, 1200]) {
      const r = sharp(path.join(SRC, f)).resize(w);
      await r.clone().avif({ quality: 50, effort: 6 }).toFile(out('img', 'photos', `${name}-${w}.avif`));
      await r.clone().webp({ quality: 72, effort: 6 }).toFile(out('img', 'photos', `${name}-${w}.webp`));
    }
    console.log('photo', name);
  }
})();
