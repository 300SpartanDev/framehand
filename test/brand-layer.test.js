// Brand layer: the uploaded logo reaches every look (corner bug + end card), with nothing broken when absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { injectBrandLayer, toneOf, measureImage, NATIVE_SCREENSHOT_LOOKS, stripSvgWhitePlate } from '../cli/lib/brand-layer.js';
import { composeFromBrief, LOOK_IDS } from '../cli/lib/compose-brief.js';

const film = (inner = '<canvas id="c"></canvas>') => `<!doctype html><html><head><title>t</title></head><body>
<div id="film" data-composition-id="film" data-width="1920" data-height="1080"><div class="a"><div>x</div></div>${inner}</div>
<script>window.__timelines = { film: gsap.timeline({ paused: true }) };</script>
</body></html>`;
const project = (html = film()) => { const d = mkdtempSync(join(tmpdir(), 'fh-brand-')); writeFileSync(join(d, 'index.html'), html); return d; };

test('with a logo: corner bug + end card inside the composition root, timeline registered', () => {
  const d = project();
  const r = injectBrandLayer(d, { look: 'kinetic-type', brand: 'ACME <b>', cta: 'Start now', logoRel: 'assets/brand-logo.png', logoTone: 'dark', logoAspect: 3, screenshotRel: 'assets/brand-shot.png', showShot: true });
  assert.equal(r.injected, true); assert.equal(r.logo, true); assert.equal(r.shot, true);
  const html = readFileSync(join(d, 'index.html'), 'utf8');
  const root = html.indexOf('data-composition-id'), layer = html.indexOf('id="fh-brand"'), rootEnd = html.indexOf('</div>\n<script>');
  assert.ok(root < layer && layer < rootEnd, 'layer is the last child of the root');
  assert.match(html, /id="fh-bug" class="fh-chip light"/); // dark logo → light chip
  assert.match(html, /window\.__timelines\['fh-brand'\] = tl/);
  assert.match(html, /ACME &lt;b&gt;/, 'brand is escaped');
  assert.match(html, /fh-shot/);
  assert.equal(injectBrandLayer(d, { look: 'kinetic-type' }).injected, false, 'idempotent');
});

test('without a logo: no image tags, wordmark end card still there', () => {
  const d = project();
  const r = injectBrandLayer(d, { look: 'object-3d', brand: 'ACME', cta: 'Go', showShot: false });
  assert.equal(r.logo, false);
  const html = readFileSync(join(d, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /id="fh-bug"/);
  assert.match(html, /class="fh-brand">ACME</);
});

test('tone picks a chip that contrasts', () => {
  assert.equal(toneOf(0.05), 'dark');
  assert.equal(toneOf(0.9), 'light');
  assert.equal(toneOf(0.3), 'mid');
  assert.equal(toneOf(null), 'mid');
});

test('svg logos are measured from their viewBox and fills', () => {
  const d = mkdtempSync(join(tmpdir(), 'fh-svg-'));
  const f = join(d, 'l.svg');
  writeFileSync(f, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><rect width="300" height="100" fill="#ffffff"/></svg>');
  const m = measureImage(f);
  assert.equal(m.aspect, 3);
  assert.equal(toneOf(m.lum), 'light');
});

test('every look gets the logo path from a brief (the collage shows the photo, never the logo, as its picture)', () => {
  const d = mkdtempSync(join(tmpdir(), 'fh-logo-'));
  const logo = join(d, 'logo.png'); writeFileSync(logo, 'x');
  const shot = join(d, 'shot.png'); writeFileSync(shot, 'x');
  const made = [];
  for (const look of LOOK_IDS) {
    let r;
    // a look that needs something this brief lacks (a formula, figures, a story) says so in plain words instead
    try { r = composeFromBrief({ brief: 'ACME\nFresh coffee daily\nFriendly staff\nStart now', look, seed: 1, logoPath: logo, screenshotPath: shot }); }
    catch (e) { assert.match(e.message, /can't be made from this brief: it needs/, look); continue; }
    assert.equal(r.assets.logoRel, 'assets/brand-logo.png', look);
    made.push(look);
  }
  for (const look of ['kinetic-type', 'keynote-ui', 'whiteboard', 'vox-collage', 'ui-space', 'object-3d']) assert.ok(made.includes(look), look);
  assert.throws(() => composeFromBrief({ brief: 'ACME\nFresh coffee daily\nStart now', look: 'vox-collage', seed: 1, logoPath: logo }), /needs a photo/);
  const vox = composeFromBrief({ brief: 'ACME\nFresh coffee daily\nStart now', look: 'vox-collage', seed: 1, logoPath: logo, screenshotPath: shot });
  assert.ok(vox.spec.cues.some((c) => c.kind === 'image' && c.image === 'assets/brand-shot.png'), 'vox shows the photo');
  assert.ok(!vox.spec.cues.some((c) => c.image === 'assets/brand-logo.png'), 'vox never blows the logo up into a picture');
  assert.ok(NATIVE_SCREENSHOT_LOOKS.has('keynote-ui'));
});

test('a white plate behind an SVG wordmark is removed, a small white mark is kept', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 180"><rect width="512" height="180" fill="#FFFFFF"/><text fill="#111111">NORTHWIND</text></svg>';
  const out = stripSvgWhitePlate(svg);
  assert.doesNotMatch(out, /<rect/);
  assert.match(out, /NORTHWIND/);
  const mark = '<svg viewBox="0 0 64 64"><rect width="12" height="12" fill="#fff"/><path fill="#111"/></svg>';
  assert.match(stripSvgWhitePlate(mark), /<rect/);
});

test('a dark wordmark whose white plate was removed sits on light paper without a white chip', () => {
  const d = project(film());
  const r = injectBrandLayer(d, { look: 'market-stamp', brand: 'Northwind', cta: 'Shop now', logoRel: 'assets/brand-logo.svg', logoTone: 'dark', logoBgRemoved: true, width: 1080, height: 1920 });
  assert.equal(r.chipCorner, 'none');
  const html = readFileSync(join(d, 'index.html'), 'utf8');
  assert.match(html, /id="fh-bug" class="fh-chip none"/);
});

test('poster and kinetic films hold the last frame instead of fading in the flat end card', () => {
  const d = project(film());
  const r = injectBrandLayer(d, { look: 'shop-poster', brand: 'Harbor Roast', cta: 'Come by', holdEnd: true, width: 1080, height: 1920 });
  assert.equal(r.holdEnd, true);
  const html = readFileSync(join(d, 'index.html'), 'utf8');
  assert.match(html, /var HOLD = true/);
  assert.match(html, /if \(!HOLD && end\)/);
});
