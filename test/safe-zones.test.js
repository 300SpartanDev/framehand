// Section C: phone-safe zones in 9:16, the end-card button fits, white logo backgrounds are removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { injectBrandLayer, removeLogoBackground, measureImage, PHONE_SAFE, endVariantFor } from '../cli/lib/brand-layer.js';
import { buttonOf } from '../cli/lib/compose-brief.js';

const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0;
const page = () => { const d = mkdtempSync(join(tmpdir(), 'fh-safe-')); writeFileSync(join(d, 'index.html'), '<html><head></head><body><div id="film" data-composition-id="film"></div></body></html>'); return d; };
const css = (html, sel) => (new RegExp(`${sel.replace(/[#.]/g, (c) => '\\' + c)} \\{([^}]*)\\}`).exec(html) || [])[1] || '';
const px = (s, prop) => { const m = new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`).exec(s); return m ? Number(m[1]) : null; };

test('the runtime and the brand layer use the same phone-safe numbers (220 top, 420 bottom, 60 left, 160 right)', () => {
  assert.deepEqual(PHONE_SAFE, { top: 220, bottom: 420, left: 60, right: 160 });
  const clip = readFileSync(new URL('../runtime/clip/clip.js', import.meta.url), 'utf8');
  assert.match(clip, /PHONE_SAFE = \{ top: 220, bottom: 420, left: 60, right: 160 \}/);
});

test('9:16: the corner logo sits inside the safe area for every look and seed', () => {
  for (const look of ['kinetic-type', 'shop-poster', 'keynote-ui', 'whiteboard', 'vox-collage']) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const d = page();
    const r = injectBrandLayer(d, { look, brand: 'Harbor Roast', cta: 'Visit us', logoRel: 'assets/brand-logo.png', logoTone: 'dark', logoAspect: 2, width: 1080, height: 1920, seed });
    const bug = css(readFileSync(join(d, 'index.html'), 'utf8'), '#fh-bug');
    const [v, h] = r.corner.split('-');
    if (v === 'top') assert.ok(px(bug, 'top') >= 220, `${look}/${seed} top ${px(bug, 'top')}`); else assert.ok(px(bug, 'bottom') >= 420, `${look}/${seed} bottom`);
    if (h === 'left') assert.ok(px(bug, 'left') >= 60); else assert.ok(px(bug, 'right') >= 160, `${look}/${seed} right ${px(bug, 'right')}`);
  }
});

test('9:16: the end card keeps clear of the app overlays and the button fits the safe width', () => {
  const d = page();
  const b = buttonOf('Visit us on Main St this Saturday');
  injectBrandLayer(d, { look: 'kinetic-type', brand: 'Northwind Café', cta: 'Visit us on Main St this Saturday', ctaButton: b.button, ctaSub: b.sub, width: 1080, height: 1920, seed: 3 });
  const html = readFileSync(join(d, 'index.html'), 'utf8');
  const pad = /#fh-end \{[^}]*padding: (\d+)px (\d+)px (\d+)px (\d+)px/.exec(html);
  assert.ok(pad, 'end card has explicit padding');
  const [top, right, bottom, left] = pad.slice(1).map(Number);
  assert.ok(top >= 220 && right >= 160 && bottom >= 420 && left >= 60, pad[0]);
  const cta = css(html, '#fh-end .fh-cta');
  assert.ok(px(cta, 'max-width') <= 1080 - 60 - 160, cta);
  assert.match(html, /<div class="fh-cta">Visit us Saturday<\/div>/);
  assert.match(html, /<div class="fh-ctasub">Main St<\/div>/);
});

test('the end card never shows emoji (they render as empty boxes) and never breaks a word', () => {
  const d = page();
  injectBrandLayer(d, { look: 'kinetic-type', brand: 'FRAMEHAND CAFÉ ☕', cta: 'Come in today 🎉', width: 1080, height: 1920, seed: 1 });
  const html = readFileSync(join(d, 'index.html'), 'utf8');
  assert.doesNotMatch(html.split('<div id="fh-brand"')[1], /☕|🎉/u);
  assert.match(css(html, '#fh-end .fh-brand'), /overflow-wrap: normal/);
  const size = px(css(html, '#fh-end .fh-brand'), 'font-size');
  assert.ok(size * 0.72 * 'FRAMEHAND'.length <= 1080 - 60 - 160, `"FRAMEHAND" at ${size}px would not fit one line`);
});

test('three end-card designs by seed', () => {
  const seen = new Set();
  for (let s = 1; s <= 30; s++) { const d = page(); seen.add(injectBrandLayer(d, { look: 'shop-poster', brand: 'X', cta: 'Visit', width: 1080, height: 1920, seed: s }).variant); assert.ok(seen.has(endVariantFor(s))); }
  assert.equal(seen.size, 3);
});

test('a logo on a white background gets the white removed and is trimmed to the mark', { skip: !HAS_FFMPEG && 'ffmpeg not installed' }, () => {
  const d = mkdtempSync(join(tmpdir(), 'fh-logo-'));
  const src = join(d, 'logo.jpg'), out = join(d, 'cut.png');
  // a dark-blue circle and an orange bar on a 600×600 white JPG
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=white:s=600x600', '-vf', "drawbox=x=150:y=250:w=300:h=100:color=0xFF7A00:t=fill,drawbox=x=200:y=180:w=200:h=60:color=0x14213D:t=fill", '-frames:v', '1', src]);
  assert.equal(r.status, 0);
  assert.equal(measureImage(src).hasAlpha, false);
  assert.ok(removeLogoBackground(src, out));
  assert.ok(existsSync(out));
  const info = measureImage(out);
  assert.equal(info.hasAlpha, true);
  assert.ok(info.width < 360 && info.height < 220, `trimmed to the mark: ${info.width}×${info.height}`);
  // a photo-like image (dark edges) is left alone
  const photo = join(d, 'photo.jpg');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=0x334455:s=400x300', '-frames:v', '1', photo]);
  assert.equal(removeLogoBackground(photo, join(d, 'p.png')), false);
});
