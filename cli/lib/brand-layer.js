// Brand layer — puts the user's logo (and screenshot) into EVERY look.
//
// After a look template is created and filled, this module:
//   1. copies the uploaded logo / screenshot into <project>/assets/ (SVGs get explicit width/height so they
//      rasterise crisply; screenshots get a 16:10 cover-cropped copy for looks that assume that frame),
//   2. measures the logo (size, aspect, how light it is) with ffprobe/ffmpeg so it can sit on a chip that
//      contrasts with any background (a transparent dark logo on a dark film would otherwise vanish),
//   3. injects an HTML overlay + its own paused GSAP timeline into index.html:
//        - a corner "bug" (small logo chip) while the film plays, when a logo was given,
//        - a 2.6 s end card after the film: logo (or the brand name as a wordmark), brand, CTA pill, and the
//          screenshot when the look has no place of its own for it.
//      The timeline is registered in window.__timelines, so the renderer seeks it frame by frame like the film.
// With no logo and no screenshot the end card is a clean wordmark + CTA: nothing broken, no empty boxes.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(fileURLToPath(import.meta.url), '../../..');
export const END_CARD_SECONDS = 2.6;

/** Looks whose own scenes already show the screenshot (the end card then skips it). */
export const NATIVE_SCREENSHOT_LOOKS = new Set(['keynote-ui', 'vox-collage', 'ui-space', 'object-3d', 'shop-poster', 'menu-board', 'market-stamp', 'kinetic-type']);
/** Phone-safe margins for 9:16 at 1080 px wide (Reels / TikTok / Shorts overlays); same numbers as runtime/clip/clip.js. */
export const PHONE_SAFE = { top: 220, bottom: 420, left: 60, right: 160 };
/** End-card designs, picked by the seed: dark glow, warm paper, colour block. */
export const END_VARIANTS = ['dark', 'paper', 'block'];
/** Looks that assume a 16:10 screenshot frame (they get a cover-cropped copy, never a stretched one). */
export const WIDE_SCREENSHOT_LOOKS = new Set(['ui-space', 'object-3d']);
/** Where the corner bug sits per look (picked to stay clear of each grammar's own labels and titles). */
const BUG_CORNER = {
  'kinetic-type': 'bottom-left',
  'shop-poster': 'top-right', 'menu-board': 'top-right', 'market-stamp': 'top-right',
  'keynote-ui': 'top-left',
  kurzgesagt: 'top-right',
  whiteboard: 'top-right',
  'math-3b1b': 'top-right',
  'finance-chart': 'top-right',
  'vox-collage': 'top-right',
  storytime: 'top-right',
  'ui-space': 'top-left',
  'object-3d': 'top-right',
};

const mixN = (n, salt) => { let x = (n ^ salt) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0; return (x ^ (x >>> 16)) >>> 0; };
/** The end-card design for a film's variety seed (the same seed always gives the same card). */
export const endVariantFor = (seed) => END_VARIANTS[mixN(Math.abs(Math.floor(Number(seed) || 0)), 0xe7) % END_VARIANTS.length];

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
export const isImagePath = (p) => !!p && IMAGE_EXT.test(p) && existsSync(p);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- measuring ----------

function svgInfo(text) {
  const vb = /viewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/i.exec(text);
  const wa = /<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i.exec(text), ha = /<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i.exec(text);
  let w = vb ? Number(vb[3]) : wa ? Number(wa[1]) : 100, h = vb ? Number(vb[4]) : ha ? Number(ha[1]) : 100;
  if (!(w > 0) || !(h > 0)) { w = 100; h = 100; }
  // tone from the fills it declares (hex only — enough to pick a chip)
  const hexes = [...text.matchAll(/(?:fill|stop-color|color)\s*[:=]\s*["']?\s*#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)].map((m) => m[1]);
  let L = null;
  if (hexes.length) {
    const ls = hexes.map((h6) => {
      const x = h6.length === 3 ? h6.split('').map((c) => c + c).join('') : h6;
      return relLum([0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)));
    });
    L = ls.reduce((a, b) => a + b, 0) / ls.length;
  } else if (!/fill\s*[:=]\s*["']?\s*(?!none)/i.test(text)) L = 0; // default SVG fill is black
  return { width: w, height: h, aspect: w / h, lum: L, hasAlpha: true, svg: true };
}

function relLum([r, g, b]) {
  const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Script faces for the end card (fonts/scripts/, see runtime/clip/clip.js SCRIPT_FALLBACKS for the canvas side). */
export const END_SCRIPTS = [
  { file: 'FHScript-CyrGreekViet.woff', test: /[\u0370-\u03FF\u1F00-\u1FFF\u0400-\u052F\u1EA0-\u1EF9]/u, range: 'U+0370-03FF, U+1F00-1FFF, U+0400-052F, U+1C80-1C8F, U+A640-A69F, U+1EA0-1EF9, U+01A0-01A1, U+01AF-01B0' },
  { file: 'FHScript-Arabic.woff', test: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u, range: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF' },
  { file: 'FHScript-Hebrew.woff', test: /[\u0590-\u05FF\uFB1D-\uFB4F]/u, range: 'U+0590-05FF, U+FB1D-FB4F' },
  { file: 'FHScript-Devanagari.woff', test: /[\u0900-\u097F]/u, range: 'U+0900-097F, U+A8E0-A8FF, U+1CD0-1CFF' },
  { file: 'FHScript-Thai.woff', test: /[\u0E00-\u0E7F]/u, range: 'U+0E00-0E7F' },
  { file: 'FHScript-Hangul.woff', test: /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/u, range: 'U+AC00-D7A3, U+1100-11FF, U+3130-318F' },
  { file: 'FHScript-Japanese.woff', test: /[\u3040-\u30FF]/u, range: 'U+3000-30FF, U+31F0-31FF, U+FF01-FF9F, U+4E00-9FFF' },
];

export function stripSvgWhitePlate(text) {
  const white = /^(?:#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i;
  return String(text).replace(/<rect\b([^>]*?)\/?>/gi, (full, attrs) => {
    const fill = /(?:\bfill\s*=\s*["']([^"']+)["']|\bfill\s*:\s*([^;"']+))/i.exec(attrs);
    const f = (fill?.[1] || fill?.[2] || '').trim();
    if (!white.test(f)) return full;
    const num = (name) => { const a = new RegExp(`\\b${name}\\s*=\\s*["']([\\d.]+)`, 'i').exec(attrs); return a ? Number(a[1]) : null; };
    const w = num('width'), h = num('height');
    const pct = /width\s*=\s*["']100%/i.test(attrs) || /height\s*=\s*["']100%/i.test(attrs);
    if (pct || (w != null && h != null && w >= 64 && h >= 64)) return '';
    return full;
  });
}
export function measureImage(path) {
  if (/\.svg$/i.test(path)) return svgInfo(readFileSync(path, 'utf8'));
  const info = { width: 0, height: 0, aspect: 1, lum: null, hasAlpha: false, svg: false };
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', path], { encoding: 'utf8' });
  try {
    const s = JSON.parse(probe.stdout).streams[0];
    info.width = s.width; info.height = s.height; info.aspect = s.width / s.height;
    info.hasAlpha = /a|pal/.test(s.pix_fmt || '') && !/^(yuvj?4|nv)/.test(s.pix_fmt || '');
  } catch { /* unreadable: defaults */ }
  const N = 48;
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-frames:v', '1', '-vf', `scale=${N}:${N},format=rgba`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 22 });
  if (raw.status === 0 && raw.stdout?.length >= N * N * 4) {
    const d = raw.stdout;
    let sum = 0, wsum = 0, transparent = 0;
    for (let i = 0; i < N * N * 4; i += 4) {
      const a = d[i + 3] / 255;
      if (a < 0.5) transparent++;
      if (a < 0.05) continue;
      sum += relLum([d[i], d[i + 1], d[i + 2]]) * a; wsum += a;
    }
    info.lum = wsum ? sum / wsum : null;
    if (transparent > N * N * 0.02) info.hasAlpha = true;
  }
  return info;
}

/** 'dark' logos need a light chip; 'light' logos a dark one; 'mid' (colourful) reads on dark, chip it light in corners. */
export function toneOf(lum) {
  if (lum == null) return 'mid';
  if (lum < 0.18) return 'dark';
  if (lum > 0.6) return 'light';
  return 'mid';
}

// ---------- logo background removal ----------

/**
 * A logo saved as a JPG/PNG on a white (or near-white) background would sit in the film as a white box. This flood-fills
 * from the edges with a tolerance and makes that background transparent (soft 1-2 px edge), so the mark sits on the film.
 * Only runs when the image has no transparency of its own and nearly all of its border is near-white.
 * Returns true when a cleaned PNG was written to `out`.
 */
export function removeLogoBackground(src, out, { tol = 38 } = {}) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', src], { encoding: 'utf8' });
  let w0, h0; try { ({ width: w0, height: h0 } = JSON.parse(probe.stdout).streams[0]); } catch { return false; }
  if (!(w0 > 0 && h0 > 0)) return false;
  const k = Math.min(1, 1200 / Math.max(w0, h0)), w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', src, '-frames:v', '1', '-vf', `scale=${w}:${h},format=rgba`, '-f', 'rawvideo', '-'], { maxBuffer: w * h * 4 + 1024 });
  if (raw.status !== 0 || !raw.stdout || raw.stdout.length < w * h * 4) return false;
  const d = Buffer.from(raw.stdout);
  // the border: how much of it is near-white, and its typical colour
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  const white = (i) => d[i * 4 + 3] > 200 && Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) >= 222;
  const nw = edge.filter(white);
  if (nw.length < edge.length * 0.9) return false;
  const ref = [0, 1, 2].map((c) => nw.reduce((a, i) => a + d[i * 4 + c], 0) / nw.length);
  const dist = (i) => Math.max(Math.abs(d[i * 4] - ref[0]), Math.abs(d[i * 4 + 1] - ref[1]), Math.abs(d[i * 4 + 2] - ref[2]));
  const seen = new Uint8Array(w * h), stack = nw.slice();
  for (const i of stack) seen[i] = 1;
  let cleared = 0;
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i - x) / w;
    d[i * 4 + 3] = 0; cleared++;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0 || seen[j]) continue;
      seen[j] = 1;
      if (dist(j) <= tol) stack.push(j);
      else if (dist(j) <= tol * 2) d[j * 4 + 3] = Math.round(d[j * 4 + 3] * (dist(j) - tol) / tol); // soft edge
    }
  }
  if (cleared > w * h * 0.97) return false; // nothing would be left: keep the original
  // trim the now-empty margins so the mark fills its box (a small logo centred on a big white canvas would shrink to a dot)
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return false;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const enc = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', '-', '-frames:v', '1', '-vf', `crop=${x1 - x0 + 1}:${y1 - y0 + 1}:${x0}:${y0}`, out], { input: d });
  return enc.status === 0 && existsSync(out);
}

/** Does a logo of mean luminance L read on a background of luminance B? (2:1 on the mean: a colourful mark's darkest parts carry it) */
export function readsOn(L, B, min = 2) {
  if (L == null) return false;
  return (Math.max(L, B) + 0.05) / (Math.min(L, B) + 0.05) >= min;
}
const hexLum = (hex) => { const x = String(hex).replace('#', ''); const f = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.slice(0, 6); return relLum([0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0)); };

// ---------- assets into the project ----------

/**
 * Copy + prepare the uploaded assets. Returns rel paths and measurements (empty strings when absent).
 * @returns {{ logoRel, logoInfo, logoTone, screenshotRel, screenshotWideRel, screenshotInfo }}
 */
export function prepareBrandAssets(dir, { logoPath = '', screenshotPath = '' } = {}, onLog = () => {}) {
  const assets = join(dir, 'assets');
  mkdirSync(assets, { recursive: true });
  const out = { logoRel: '', logoInfo: null, logoTone: 'mid', screenshotRel: '', screenshotWideRel: '', screenshotInfo: null };

  if (isImagePath(logoPath)) {
    const ext = extname(logoPath).toLowerCase() === '.jpeg' ? '.jpg' : extname(logoPath).toLowerCase();
    const rel = `assets/brand-logo${ext}`;
    if (ext === '.svg') {
      // explicit pixel size: an SVG without width/height rasterises at 150 px in <img>/textures and looks blurry
      let text = readFileSync(logoPath, 'utf8');
      const beforePlate = text;
      const info = svgInfo(text);
      const H = 512, W = Math.round(H * info.aspect);
      text = stripSvgWhitePlate(text);
      const plateGone = text !== beforePlate;
      text = text.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
        let a = attrs.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
        if (!/viewBox/i.test(a)) a += ` viewBox="0 0 ${info.width} ${info.height}"`;
        return `<svg${a} width="${W}" height="${H}">`;
      });
      writeFileSync(join(dir, rel), text);
      const cut = 'assets/brand-logo-cut.png';
      if (removeLogoBackground(join(dir, rel), join(dir, cut))) {
        out.logoRel = cut; out.logoInfo = measureImage(join(dir, cut)); out.bgRemoved = true;
        onLog(`asset  logo background removed (white plate cleared) → ${cut}\n`);
      } else if (plateGone) out.bgRemoved = true;
    } else copyFileSync(logoPath, join(dir, rel));
    if (!out.logoRel) {
      out.logoRel = rel;
      out.logoInfo = measureImage(join(dir, rel));
    }
    if (ext !== '.svg' && !out.logoInfo.hasAlpha) {
      const cut = 'assets/brand-logo-cut.png';
      if (removeLogoBackground(join(dir, rel), join(dir, cut))) {
        out.logoRel = cut; out.logoInfo = measureImage(join(dir, cut)); out.bgRemoved = true;
        onLog(`asset  logo background removed (white edges made transparent) → ${cut}\n`);
      }
    }
    out.logoTone = toneOf(out.logoInfo.lum);
    onLog(`asset  logo → ${out.logoRel} (${out.logoInfo.width}×${out.logoInfo.height}, ${out.logoTone}${out.logoInfo.hasAlpha ? ', transparent' : ''})\n`);
  }

  if (isImagePath(screenshotPath)) {
    const ext = extname(screenshotPath).toLowerCase() === '.jpeg' ? '.jpg' : extname(screenshotPath).toLowerCase();
    const rel = `assets/brand-shot${ext}`;
    copyFileSync(screenshotPath, join(dir, rel));
    out.screenshotRel = rel;
    out.screenshotInfo = measureImage(join(dir, rel));
    // 16:10 cover crop from the top (a page's top matters most) — never stretched
    const wideRel = 'assets/brand-shot-wide.jpg';
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, rel), '-frames:v', '1', '-vf',
      'scale=1920:1200:force_original_aspect_ratio=increase,crop=1920:1200:(iw-1920)/2:0', '-q:v', '3', join(dir, wideRel)]);
    if (r.status === 0 && existsSync(join(dir, wideRel))) out.screenshotWideRel = wideRel;
    onLog(`asset  screenshot → ${rel}${out.screenshotWideRel ? ` (+ 16:10 crop ${wideRel})` : ''}\n`);
  }
  return out;
}

// ---------- the overlay ----------

/**
 * Inject the brand overlay (corner bug + end card) into a project's index.html.
 * opts: { look, brand, cta, accent, logoRel, logoTone, logoAspect, screenshotRel, showShot }
 */
export function injectBrandLayer(dir, opts = {}) {
  const file = join(dir, 'index.html');
  let html = readFileSync(file, 'utf8');
  if (html.includes('id="fh-brand"')) return { injected: false, reason: 'already there' };

  const fontRel = 'assets/fonts/fh-Inter-var.woff', cjkRel = 'assets/fonts/fh-NotoSansSC-800.woff';
  mkdirSync(join(dir, 'assets', 'fonts'), { recursive: true });
  for (const [src, rel] of [['Inter-var.woff', fontRel], ['NotoSansSC-800.woff', cjkRel]]) {
    if (existsSync(join(PKG, 'fonts', src))) copyFileSync(join(PKG, 'fonts', src), join(dir, rel));
  }
  // the end card's words in another script (Cyrillic, Greek, Arabic, Hebrew, Devanagari, Thai, Korean, Japanese) get the
  // matching bundled face, the same ones clip.js uses on the canvas
  const endWords = [opts.brand, opts.cta, opts.ctaButton, opts.ctaSub].filter(Boolean).join(' ');
  const scriptFaces = END_SCRIPTS.filter((f) => f.test.test(endWords) && existsSync(join(PKG, 'fonts', 'scripts', f.file)));
  if (scriptFaces.length) mkdirSync(join(dir, 'assets', 'fonts', 'scripts'), { recursive: true });
  for (const f of scriptFaces) copyFileSync(join(PKG, 'fonts', 'scripts', f.file), join(dir, 'assets', 'fonts', 'scripts', f.file));
  const scriptCss = scriptFaces.map((f) => `@font-face { font-family: "FH Scripts"; src: url("assets/fonts/scripts/${f.file}") format("woff"); font-weight: 100 900; font-style: normal; unicode-range: ${f.range}; }`).join('\n');
  // frame size: portrait / square films get a stacked end card and a corner bug clear of phone UI
  const W = Number(opts.width) || 1920, H = Number(opts.height) || 1080;
  const portrait = H > W, square = H === W;

  const look = opts.look || '';
  // phone-safe margins (9:16 only), scaled to the film width
  const k = portrait ? W / 1080 : 1;
  const SAFE = portrait ? Object.fromEntries(Object.entries(PHONE_SAFE).map(([kk, v]) => [kk, Math.round(v * k)])) : { top: 0, bottom: 0, left: 0, right: 0 };
  const seedN = Number.isFinite(Number(opts.seed)) ? Math.abs(Math.floor(Number(opts.seed))) : 0;
  // the corner bug: one of the corners that stay clear of the look's own labels, picked by the seed
  const CORNERS = portrait
    ? (look === 'kinetic-type' || /poster|board|stamp/.test(look) ? ['top-left', 'top-right'] : [BUG_CORNER[look] && !BUG_CORNER[look].startsWith('bottom') ? BUG_CORNER[look] : 'top-left'])
    : look === 'kinetic-type' ? ['bottom-left', 'bottom-right'] : [BUG_CORNER[look] || 'top-right'];
  const corner = opts.corner && CORNERS.includes(opts.corner) ? opts.corner : CORNERS[mixN(seedN, 0x51) % CORNERS.length];
  const variant = END_VARIANTS.includes(opts.endVariant) ? opts.endVariant : endVariantFor(seedN);
  const holdEnd = !!opts.holdEnd;
  const accent = /^#[0-9a-f]{3,8}$/i.test(opts.accent || '') ? opts.accent : '#5b8cff';
  const logo = opts.logoRel || '';
  const tone = opts.logoTone || 'mid';
  const logoLum = Number.isFinite(opts.logoLum) ? opts.logoLum : { dark: 0.05, light: 0.85, mid: 0.3 }[tone];
  const shot = opts.showShot && opts.screenshotRel ? opts.screenshotRel : '';
  // colour emoji do not render in the headless renderer (they become empty boxes): the end card drops them
  const noEmoji = (x) => String(x || '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, '').replace(/\s{2,}/g, ' ').trim();
  const brand = noEmoji(opts.brand).slice(0, 48);
  const cta = noEmoji(opts.ctaButton || opts.cta).slice(0, 90);
  const ctaSub = noEmoji(opts.ctaButton ? opts.ctaSub : '').slice(0, 48);
  const aspect = Number(opts.logoAspect) > 0 ? Number(opts.logoAspect) : 1;
  // end-card logo box: wide marks get width, tall marks get height, never distorted (object-fit: contain)
  const maxLogoW = portrait ? Math.round(560 * k) : 560;
  const endW = Math.round(Math.min(maxLogoW, 220 * k * Math.max(1, aspect))), endH = Math.round(Math.min(220 * k, maxLogoW / Math.max(1, aspect)));
  // text sizes that fit the column: ~0.6em per character for a heavy sans, never more than two lines
  const colW = portrait ? Math.round(W - SAFE.left - SAFE.right - 40 * k) : square ? 900 : shot ? 820 : 1500;
  const brandBig = portrait ? 150 * k : square ? 110 : 136;
  // the longest word must fit one line (no "FRAMEHA / ND"): capitals are wider, ~0.7 em
  const longest = Math.max(1, ...brand.split(/\s+/).map((w) => w.length * (w === w.toUpperCase() && /\p{L}/u.test(w) ? 0.72 : 0.6)));
  const brandSize0 = Math.round(logo ? Math.min(portrait ? 104 * k : 84, (colW * 1.6) / Math.max(1, brand.length * 0.6))
    : Math.max(56 * k, Math.min(brandBig, (colW * (brand.length > (portrait ? 10 : 16) ? 1.7 : 1)) / Math.max(1, brand.length * 0.6))));
  const brandSize = Math.round(Math.min(brandSize0, (colW * 0.96) / longest));
  // the button: one line when it fits the safe column, otherwise it wraps inside a rounded box (never wider than the column)
  const ctaSize = Math.round(Math.max(30 * k, Math.min(portrait ? 64 * k : 44, (colW - 100 * k) / Math.max(1, cta.length * 0.56))));
  const ctaWraps = cta.length * ctaSize * 0.56 > colW - 100 * k;
  const edgeV = portrait ? SAFE.top + Math.round(16 * k) : 44, edgeB = portrait ? SAFE.bottom + Math.round(16 * k) : 44;
  const edgeL = portrait ? SAFE.left + Math.round(12 * k) : 52, edgeR = portrait ? SAFE.right + Math.round(12 * k) : 52;
  const bugH = Math.round((portrait ? 70 : 58) * k), bugW = Math.round(Math.min(220 * k, bugH * Math.max(0.6, aspect)));
  // end-card colours per variant; the logo gets a chip only when it would not read on that background
  const aL = hexLum(accent);
  const V = {
    dark: { bg: `radial-gradient(1100px 700px at 20% 20%, ${accent}33 0%, transparent 60%), radial-gradient(900px 600px at 90% 95%, ${accent}22 0%, transparent 55%), linear-gradient(160deg, #0b0e14 0%, #06070a 100%)`, lum: 0.01, ink: '#f3f6fb', sub: 'rgba(243,246,251,.72)', btn: accent, btnInk: aL > 0.45 ? '#111' : '#fff', frame: 'none' },
    paper: { bg: `radial-gradient(900px 700px at 80% 10%, ${accent}26 0%, transparent 60%), #F4EEE3`, lum: 0.85, ink: '#1b1a17', sub: 'rgba(27,26,23,.66)', btn: accent, btnInk: aL > 0.45 ? '#111' : '#fff', frame: `${Math.round(6 * k)}px dashed rgba(27,26,23,.18)` },
    block: { bg: `linear-gradient(170deg, ${accent} 0%, ${accent} 70%, rgba(0,0,0,.18) 100%), ${accent}`, lum: aL, ink: aL > 0.4 ? '#111' : '#fff', sub: aL > 0.4 ? 'rgba(17,17,17,.7)' : 'rgba(255,255,255,.8)', btn: aL > 0.4 ? '#111' : '#fff', btnInk: aL > 0.4 ? '#fff' : '#111', frame: 'none' },
  }[variant];
  const chipEnd = readsOn(logoLum, V.lum) ? 'none' : logoLum < 0.3 ? 'light' : 'dark';
  // a wordmark whose white plate was removed is the ink itself. On light paper (kraft, riso) it needs no white chip.
  const lightPaper = /market-stamp|shop-poster/.test(look);
  const chipCorner = opts.logoBgRemoved && tone !== 'light' && lightPaper ? 'none' : tone === 'light' ? 'dark' : 'light';
  const [vEdge, hEdge] = corner.split('-');
  const edgeY = vEdge === 'top' ? edgeV : edgeB, edgeX = hEdge === 'left' ? edgeL : edgeR;
  const endPad = portrait ? `${SAFE.top + Math.round(30 * k)}px ${SAFE.right + Math.round(20 * k)}px ${SAFE.bottom + Math.round(30 * k)}px ${SAFE.left + Math.round(20 * k)}px` : '60px 80px';
  const shotW = portrait ? colW : square ? 640 : 760, shotH = portrait ? Math.round(520 * k) : square ? 380 : 520;

  const style = `
<style id="fh-brand-style">
@font-face { font-family: "FH Inter"; src: url("${fontRel}") format("woff"); font-weight: 100 900; font-style: normal; }
@font-face { font-family: "FH Noto SC"; src: url("${cjkRel}") format("woff"); font-weight: 100 900; font-style: normal; }
${scriptCss ? `${scriptCss}\n` : ''}#fh-brand { position: absolute; inset: 0; pointer-events: none; z-index: 2147483000; font-family: "FH Inter", ${scriptCss ? '"FH Scripts", ' : ''}"FH Noto SC", Inter, system-ui, sans-serif; }
#fh-end .fh-brand, #fh-end .fh-cta, #fh-end .fh-ctasub { unicode-bidi: plaintext; } /* Arabic / Hebrew lines read right to left */
#fh-brand .fh-chip { display: flex; align-items: center; justify-content: center; border-radius: 18px; }
#fh-brand .fh-chip.light { background: rgba(250, 251, 253, 0.96); box-shadow: 0 10px 34px rgba(0,0,0,.28), inset 0 0 0 1px rgba(0,0,0,.06); }
#fh-brand .fh-chip.dark { background: rgba(10, 12, 16, 0.86); box-shadow: 0 10px 34px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.10); }
#fh-brand .fh-chip.none { background: transparent; }
#fh-bug.fh-chip.none img { filter: ${logoLum < 0.4 ? 'drop-shadow(0 0 3px rgba(255,255,255,.95)) drop-shadow(0 0 10px rgba(255,255,255,.55))' : 'drop-shadow(0 0 3px rgba(0,0,0,.8)) drop-shadow(0 2px 10px rgba(0,0,0,.5))'}; }
#fh-brand img { display: block; object-fit: contain; }
#fh-bug { position: absolute; ${vEdge}: ${edgeY}px; ${hEdge}: ${edgeX}px; padding: 12px 16px; opacity: 0; }
#fh-bug img { width: ${bugW}px; height: ${bugH}px; }
#fh-end { position: absolute; inset: 0; opacity: 0; display: flex; flex-direction: ${portrait || square ? 'column' : 'row'}; align-items: center; justify-content: center; gap: ${portrait ? Math.round(56 * k) : square ? 50 : 96}px; padding: ${endPad}; box-sizing: border-box;
  background: ${V.bg}; }
#fh-end::before { content: ""; position: absolute; inset: ${portrait ? `${SAFE.top - Math.round(30 * k)}px ${SAFE.right - Math.round(40 * k)}px ${SAFE.bottom - Math.round(30 * k)}px ${Math.max(16, SAFE.left - Math.round(20 * k))}px` : '36px'}; border: ${V.frame}; border-radius: 28px; pointer-events: none; }
#fh-end .fh-col { display: flex; flex-direction: column; align-items: ${shot && !portrait && !square ? 'flex-start' : 'center'}; text-align: ${shot && !portrait && !square ? 'left' : 'center'}; gap: ${Math.round(30 * k)}px; max-width: ${colW}px; }
#fh-end .fh-mark { padding: ${chipEnd === 'none' ? 0 : 30}px ${chipEnd === 'none' ? 0 : 40}px; border-radius: 30px; }
#fh-end .fh-mark img { width: ${endW}px; height: ${endH}px; }
#fh-end .fh-brand { color: ${V.ink}; font-weight: 800; letter-spacing: -0.03em; line-height: 1.04; font-size: ${brandSize}px; overflow-wrap: normal; word-break: normal; hyphens: none; }
#fh-end .fh-cta { display: inline-block; box-sizing: border-box; color: ${V.btnInk}; background: ${V.btn}; font-weight: 800; font-size: ${ctaSize}px; line-height: 1.18; padding: ${Math.round(20 * k)}px ${Math.round(44 * k)}px; border-radius: ${ctaWraps ? 36 : 999}px; box-shadow: 0 16px 40px rgba(0,0,0,.22); letter-spacing: -0.01em; max-width: ${colW}px; overflow-wrap: anywhere; ${variant === 'paper' ? `outline: ${Math.round(4 * k)}px dashed ${V.btn}; outline-offset: ${Math.round(8 * k)}px;` : ''} }
#fh-end .fh-ctasub { color: ${V.sub}; font-weight: 600; font-size: ${Math.round(ctaSize * 0.66)}px; margin-top: -${Math.round(8 * k)}px; letter-spacing: 0.02em; max-width: ${colW}px; }
#fh-end .fh-shot { width: ${shotW}px; height: ${shotH}px; display: flex; align-items: center; justify-content: center; }
#fh-end .fh-shot img { max-width: ${shotW}px; max-height: ${shotH}px; width: auto; height: auto; border-radius: 22px; box-shadow: 0 40px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08); }
</style>`;

  const layer = `
<div id="fh-brand" data-om-id="brand-layer" aria-hidden="true">
${logo ? `  <div id="fh-bug" class="fh-chip ${chipCorner}" data-om-id="brand-bug"><img src="${esc(logo)}" alt=""></div>\n` : ''}  <div id="fh-end" data-om-id="brand-end">
    <div class="fh-col">
${logo ? `      <div class="fh-mark fh-chip ${chipEnd}"><img src="${esc(logo)}" alt=""></div>\n` : ''}${brand ? `      <div class="fh-brand">${esc(brand)}</div>\n` : ''}${cta ? `      <div class="fh-cta">${esc(cta)}</div>\n` : ''}${cta && ctaSub ? `      <div class="fh-ctasub">${esc(ctaSub)}</div>\n` : ''}    </div>
${shot ? `    <div class="fh-shot"><img src="${esc(shot)}" alt=""></div>\n` : ''}  </div>
</div>`;

  const script = `
<script id="fh-brand-script">
(function () {
  var END = ${END_CARD_SECONDS};
  var HOLD = ${holdEnd ? 'true' : 'false'};
  var tl = gsap.timeline({ paused: true });
  var q = function (s) { return document.querySelector(s); };
  var others = Object.keys((window.__hf && window.__hf.buildReady) || {}).map(function (k) { return window.__hf.buildReady[k]; });
  var build = Promise.all(others).then(function () { return new Promise(function (ok) { setTimeout(ok, 0); }); }).then(function () {
    var D = 0;
    Object.keys(window.__timelines || {}).forEach(function (k) { var t = window.__timelines[k]; if (k !== 'fh-brand' && t && t.duration) D = Math.max(D, t.duration()); });
    if (!(D > 0)) D = 8;
    var bug = q('#fh-bug'), end = q('#fh-end');
    if (bug) {
      tl.fromTo(bug, { opacity: 0, y: ${vEdge === 'top' ? -14 : 14} }, { opacity: 0.97, y: 0, duration: 0.6, ease: 'power3.out' }, 0.5);
      if (!HOLD) tl.to(bug, { opacity: 0, duration: 0.3, ease: 'power1.in' }, Math.max(0.9, D - 0.3));
    }
    if (!HOLD && end) {
      tl.fromTo(end, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }, D);
      var parts = end.querySelectorAll('.fh-mark, .fh-brand, .fh-cta, .fh-ctasub');
      if (parts.length) tl.fromTo(parts, { opacity: 0, y: 26, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'expo.out', stagger: 0.12 }, D + 0.15);
      var shot = end.querySelector('.fh-shot');
      if (shot) tl.fromTo(shot, { opacity: 0, ${portrait || square ? 'y' : 'x'}: 70, rotation: 2.5 }, { opacity: 1, x: 0, rotation: -2, duration: 0.9, ease: 'expo.out' }, D + 0.25);
    }
    tl.to({}, { duration: 0 }, D + END);
    var root = q('[data-composition-id]');
    if (root) root.setAttribute('data-duration', String(+(D + END).toFixed(3)));
  });
  if (window.OM && window.OM.ready) window.OM.ready(build);
  else { window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {}; window.__hf.buildReady['fh-brand'] = build; }
  window.__timelines = window.__timelines || {};
  window.__timelines['fh-brand'] = tl;
})();
</script>`;

  // style into <head>, layer as the last child of the composition root, script before </body>
  html = html.replace(/<\/head>/i, `${style}\n</head>`);
  const rootOpen = /<div\b[^>]*\bdata-composition-id\s*=\s*["'][^"']+["'][^>]*>/i.exec(html);
  if (!rootOpen) throw new Error('index.html has no composition root (data-composition-id)');
  const closeAt = findClosingDiv(html, rootOpen.index);
  html = closeAt > 0 ? html.slice(0, closeAt) + layer + '\n' + html.slice(closeAt) : html.replace(rootOpen[0], rootOpen[0] + layer);
  html = html.replace(/<\/body>/i, `${script}\n</body>`);
  writeFileSync(file, html);
  return { injected: true, corner, variant, logo: !!logo, shot: !!shot, chipEnd, chipCorner, holdEnd };
}

// index of the </div> that closes the <div> opening at `start`
function findClosingDiv(html, start) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') { depth--; if (depth === 0) return m.index; }
    else depth++;
  }
  return -1;
}
