// Section B: different shops get different films, local shops lead with the offer, the warm poster looks are used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { composeFromBrief, POSTER_LOOKS, hookOf, PLANS } from '../cli/lib/compose-brief.js';
import { endVariantFor, END_VARIANTS } from '../cli/lib/brand-layer.js';

export const CAFES = [
  ['Harbor Roast', 'weekend flat white, 2 for 1. Visit us on Main St this Saturday'],
  ['Little Owl', 'espresso for one before 9. Come in today'],
  ['Brick Lane Coffee', 'happy hour after 4, half price lattes'],
  ['Sunny Cup', 'free cookie with every coffee this week'],
  ['Northwind', 'new oat latte. Stop by'],
  ['Bean There', '2 for 1 cold brew. Visit us'],
  ['Copper Kettle', '20% off beans this weekend'],
  ['Daily Grind', 'pastries baked daily. Order ahead'],
  ['Moss & Milk', 'live music Friday. Join us'],
  ['Velvet Bean', 'first coffee free for new members'],
];
const cafeBrief = ([n, o]) => `${n} café. ${o}`;

test('10 cafés with the same version number: no look takes more than 6, and the end cards vary', () => {
  for (const seed of [1, 2, 3]) {
    const tally = {}, ends = new Set(), shapes = new Set();
    for (const c of CAFES) {
      const r = composeFromBrief({ brief: cafeBrief(c), seed, format: '9:16' });
      tally[r.look] = (tally[r.look] || 0) + 1; ends.add(endVariantFor(r.variety));
      if (r.spec?.data?.shape) shapes.add(r.spec.data.shape);
    }
    assert.ok(Math.max(...Object.values(tally)) <= 6, `seed ${seed}: ${JSON.stringify(tally)}`);
    assert.ok(Object.keys(tally).length >= 3, `seed ${seed}: only ${Object.keys(tally)}`);
    assert.ok((tally['kinetic-type'] || 0) <= 4, `seed ${seed}: kinetic ${JSON.stringify(tally)}`);
    assert.ok(ends.size >= 2, `seed ${seed}: one end card for all`);
    assert.ok(shapes.size >= 2, `seed ${seed}: one sticker ${[...shapes]}`);
  }
});

test('the same café name and seed always gives the same film; another name usually does not', () => {
  const a = composeFromBrief({ brief: cafeBrief(CAFES[0]), seed: 4, format: '9:16' });
  const b = composeFromBrief({ brief: cafeBrief(CAFES[0]), seed: 4, format: '9:16' });
  assert.deepEqual(a.spec, b.spec);
  const diff = CAFES.slice(1).filter((c) => { const r = composeFromBrief({ brief: cafeBrief(CAFES[0]).replace(CAFES[0][0], c[0]), seed: 4, format: '9:16' }); return r.look !== a.look || JSON.stringify(r.spec?.data) !== JSON.stringify(a.spec?.data); });
  assert.ok(diff.length >= 7, `only ${diff.length} of 9 renamed cafés differ`);
});

test('local shops land on the warm poster looks most of the time, and never on a software launch by chance', () => {
  const briefs = ["Leo's Barbershop fresh fades in Velika Plana. Book today.", 'Iron Current gym. 30-day starter, first week free.', 'Northwind Shop 20% off everything this weekend',
    'Northline Realty. Open house Saturday 11-2. 4 bed waterfront.', 'Maple and Rye bakery on Oak Street. Sourdough and morning buns, baked before 7.', ...CAFES.map(cafeBrief)];
  const blocked = ['whiteboard', 'kurzgesagt', 'math-3b1b', 'keynote-ui', 'ui-space', 'object-3d'];
  let poster = 0, kinetic = 0, n = 0;
  for (const b of briefs) for (let s = 1; s <= 24; s++) {
    const r = composeFromBrief({ brief: b, seed: s, format: '9:16' }); n++;
    if (POSTER_LOOKS.has(r.look)) poster++;
    if (r.look === 'kinetic-type') kinetic++;
    assert.ok(!blocked.includes(r.look), `${b} seed ${s} → ${r.look}`);
  }
  assert.ok(poster / n >= 0.5, `poster share ${(poster / n * 100).toFixed(0)}%`);
  assert.ok(kinetic / n <= 0.4, `kinetic share ${(kinetic / n * 100).toFixed(0)}%`);
});

test('local shops lead with the offer: the first card is the deal and starts at 0 s', () => {
  const cases = [['Iron Current gym. 30-day starter, first week free. Join today.', /first week free/i], ['FRAMEHAND CAFÉ\nWeekend flat white — 2 for 1\nVisit us on Main St this Saturday', /2 for 1/],
    ['Northwind Shop 20% off everything this weekend', /20% off/]];
  for (const [brief, re] of cases) for (const look of ['shop-poster', 'menu-board', 'market-stamp', 'kinetic-type', 'keynote-ui']) for (const seed of [1, 2, 3]) {
    let r;
    try { r = composeFromBrief({ brief, seed, look, format: '9:16' }); } catch (e) { if (/can't be made/.test(e.message)) continue; throw e; }
    const first = r.spec.cues[0];
    assert.equal(first.at, 0, `${look}: first card at ${first.at}`);
    const words = look === 'keynote-ui' ? `${r.spec.data.title} ${r.spec.data.subtitle || ''}` : `${first.text} ${first.sub || ''}`; // keynote's opening title lives in data
    assert.match(words, re, `${look} ${r.planId}: first card "${words}"`);
  }
});

test('the offer hook puts the deal big and the rest under it', () => {
  assert.deepEqual(hookOf('Weekend flat white — 2 for 1'), { main: '2 for 1', sub: 'Weekend flat white', deal: true });
  assert.deepEqual(hookOf('20% off everything this weekend'), { main: '20% off', sub: 'everything this weekend', deal: true });
  assert.equal(hookOf('30-day starter, first week free').main, 'First week free');
  assert.equal(hookOf('Akcija 2 za 1 na šišanje').main, '2 za 1');
  const day = hookOf('Četvrtak popust');
  assert.equal(day.main, 'Četvrtak');
  assert.equal(day.sub, 'popust');
  assert.ok(!day.deal);
});

test('poster stickers are not all the same rubber stamp', () => {
  const shapes = new Set();
  for (const c of CAFES) for (const seed of [1, 2, 3, 4]) {
    const r = composeFromBrief({ brief: cafeBrief(c), seed, look: 'market-stamp', format: '9:16' });
    shapes.add(r.spec.data.shape);
  }
  assert.ok(shapes.size >= 4, [...shapes].join(','));
  assert.ok(shapes.has('ticket') || shapes.has('tape'), [...shapes].join(','));
});

test('a headline figure is not repeated as a chart, and the photo comes before the button', () => {
  const shot = fileURLToPath(new URL('../docs/media/barber-poster.jpg', import.meta.url));
  const bed = composeFromBrief({ brief: 'Northline Realty. Open house Saturday 11-2. 4 bed waterfront.', look: 'keynote-ui', seed: 1, format: '9:16' });
  assert.ok(!bed.spec.cues.some((q) => q.kind === 'number'), bed.spec.cues.map((q) => q.kind).join(','));
  const shop = composeFromBrief({ brief: 'Northwind Shop 20% off everything this weekend. Shop now', look: 'keynote-ui', seed: 2, screenshotPath: shot, format: '9:16' });
  assert.ok(!shop.spec.cues.some((q) => q.kind === 'number'));
  const photoAt = shop.spec.cues.findIndex((q) => q.image);
  const ctaAt = shop.spec.cues.findIndex((q) => /shop now/i.test(q.text || ''));
  assert.ok(photoAt >= 0 && ctaAt > photoAt, shop.spec.cues.map((q) => `${q.kind}:${q.text || ''}`).join(' | '));
});

test('kinetic type varies its background, transition and timing film to film', () => {
  const bgs = new Set(), trs = new Set(), lens = new Set();
  for (const c of CAFES) { const r = composeFromBrief({ brief: cafeBrief(c), seed: 1, look: 'kinetic-type', format: '9:16' }); bgs.add(r.spec.data.bg); trs.add(r.spec.data.transition); lens.add(r.spec.duration); }
  assert.ok(bgs.size >= 3 && trs.size >= 3 && lens.size >= 5, `${[...bgs]} / ${[...trs]} / ${[...lens]}`);
  for (const p of PLANS['kinetic-type']) if (p.id === 'kinetic-brand-first') assert.equal(p.ok({ local: true }), false);
});

test('three end-card designs exist and each is reachable', () => {
  const seen = new Set(); for (let s = 0; s < 60; s++) seen.add(endVariantFor(s * 7919));
  assert.deepEqual([...seen].sort(), [...END_VARIANTS].sort());
});
