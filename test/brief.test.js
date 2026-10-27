// Brief → parsed facts, look choice, captions and share URLs: the honesty rules the app promises.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBrief, extractNumbers, lookBlocker, pickLook, composeFromBrief, decodeEntities, VERTICAL_LOOKS } from '../cli/lib/compose-brief.js';
import { writeCaption, CAPTION_LIMITS } from '../cli/lib/caption.js';
import { openUrl, videoFor } from '../cli/lib/share-pack.js';

const BARBER = "Leo's Barbershop fresh fades in Velika Plana book today";
const TASKLY = 'Taskly saves teams 6 hours a week, 2,400 users, start your free trial';

test('a one-line local brief gives a brand, a headline, a location and the CTA', () => {
  const p = parseBrief({ brief: BARBER });
  assert.equal(p.brand, "Leo's Barbershop");
  assert.equal(p.headline, 'Fresh fades in Velika Plana');
  assert.equal(p.cta, 'Book today');
  assert.equal(p.location, 'Velika Plana');
  assert.ok(p.local);
});

test('CTA verbs include DM and visit; explicit Brand:/CTA: lines win', () => {
  assert.equal(parseBrief({ brief: 'Glow Studio\nLash lifts this week\nDM us to book' }).cta, 'DM us to book');
  const p = parseBrief({ brief: 'Brand: Corner Bakery\nOffer: 2 for 1 croissants\nCTA: Visit us Saturday' });
  assert.equal(p.brand, 'Corner Bakery'); assert.equal(p.cta, 'Visit us Saturday');
});

test('HTML entities are decoded (Leo&#39;s → Leo\'s)', () => {
  assert.equal(decodeEntities('Leo&#39;s &amp; Co'), "Leo's & Co");
  assert.equal(parseBrief({ brief: 'Leo&#39;s Barbershop fresh fades book today' }).brand, "Leo's Barbershop");
});

test('only real numbers count: units, %, currency — not "2 for 1", years or phone numbers', () => {
  const n = extractNumbers(TASKLY).map((x) => x.text);
  assert.deepEqual(n, ['6 hours', '2,400 users']);
  assert.deepEqual(extractNumbers('Weekend flat white 2 for 1, since 2019, call 555 0199'), []);
  assert.equal(extractNumbers('Save 20% today')[0].text, '20%');
});

test('number scenes only come from the brief; a brief without figures has none', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = composeFromBrief({ brief: BARBER, seed });
    const json = JSON.stringify(r.spec || r.sets);
    assert.ok(!/"kind":"number"/.test(json), `seed ${seed} invented a number scene`);
  }
  const t = composeFromBrief({ brief: TASKLY, look: 'keynote-ui', seed: 1 });
  const nums = t.spec.cues.filter((c) => c.kind === 'number').map((c) => c.data.value);
  for (const v of nums) assert.ok([6, 2400].includes(v), `unexpected number ${v}`);
});

test('looks that need a formula, figures, a story or a screenshot are skipped without one', () => {
  const p = parseBrief({ brief: BARBER });
  assert.match(lookBlocker('math-3b1b', p), /formula/);
  assert.match(lookBlocker('finance-chart', p), /figures/);
  assert.match(lookBlocker('object-3d', p), /screenshot/);
  assert.match(lookBlocker('ui-space', p, { hasScreenshot: true, format: '9:16' }), /widescreen/);
  assert.equal(lookBlocker('kinetic-type', p), null);
  assert.throws(() => composeFromBrief({ brief: BARBER, look: 'math-3b1b', seed: 1 }), /can't be made from this brief/);
});

test('the pick is deterministic per seed and only from eligible looks', () => {
  const p = parseBrief({ brief: BARBER });
  for (const seed of [1, 7, 42]) {
    const a = pickLook(p, { seed, hasLogo: true }), b = pickLook(p, { seed, hasLogo: true });
    assert.equal(a.look.id, b.look.id);
    assert.equal(lookBlocker(a.look.id, p, { hasLogo: true }), null);
  }
  const v = pickLook(p, { seed: 3, format: '9:16' });
  assert.ok(VERTICAL_LOOKS.has(v.look.id));
});

test('captions are human: brand + offer + CTA, decoded, fitting tags, made-with off by default, within limits', () => {
  const p = parseBrief({ brief: BARBER });
  for (const platform of Object.keys(CAPTION_LIMITS)) {
    const c = writeCaption(p, { platform });
    const text = `${c.caption}\n${c.title}\n${c.description}`;
    assert.ok(c.caption.length <= c.max, platform);
    assert.ok(text.includes("Leo's"), platform);
    assert.ok(!/&#39;|&amp;/.test(text), platform);
    assert.ok(!/made with framehand/i.test(text), platform);
  }
  const x = writeCaption(p, { platform: 'x' });
  const xs = x.caption;
  assert.ok(xs.length <= 280);
  assert.match(xs, /Book today/);
  assert.match(xs, /#LeosBarbershop/);
  const mw = writeCaption(p, { platform: 'x', madeWith: true });
  assert.match(mw.caption, /made with framehand/i);
});

test('share: composer URLs open the upload page, and vertical apps get the 9:16 file', () => {
  assert.equal(openUrl('instagram'), 'https://www.instagram.com/create/');
  assert.equal(openUrl('youtube-shorts'), 'https://www.youtube.com/upload');
  assert.equal(openUrl('tiktok'), 'https://www.tiktok.com/upload');
  assert.equal(openUrl('linkedin'), 'https://www.linkedin.com/feed/?shareActive=true');
  assert.match(openUrl('x', 'Hi there'), /^https:\/\/x\.com\/intent\/post\?text=Hi%20there/);
  const d = mkdtempSync(join(tmpdir(), 'fh-share-')), wide = join(d, 'wide.mp4'), tall = join(d, 'tall.mp4');
  writeFileSync(wide, 'x'); writeFileSync(tall, 'x');
  const film = { mp4: wide, mp4Vertical: tall };
  assert.equal(videoFor('tiktok', film).file, tall);
  assert.equal(videoFor('instagram', film).file, tall);
  assert.equal(videoFor('linkedin', film).file, wide);
});

// ---------- round 5: the writing bugs found on real renders (the user's own briefs) ----------
import { splitBeats, buttonOf, nameAtStart, CONNECTORS, LOOKS } from '../cli/lib/compose-brief.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const R5 = {
  barber: "Leo's Barbershop fresh fades in Velika Plana. Book today.",
  cafe: 'Northwind café weekend flat white, 2 for 1. Visit us on Main St this Saturday',
  gym: 'Iron Current gym. 30-day starter, first week free.',
  realty: 'Northline Realty. 12 Harbor Lane. Open house Saturday 11-2. 4 bed waterfront with a private dock.',
  shop: 'Northwind Shop 20% off everything this weekend',
  caps: 'BLAZE BARBERS FRESH CUTS ALL WEEK BOOK NOWWW 🔥🔥',
  capsDot: 'BLAZE BARBERS. FRESH CUTS ALL WEEK. BOOK NOWWW. 🔥🔥',
  maple: 'Maple and Rye is a tiny bakery on Oak Street that bakes sourdough every morning, plus cinnamon morning buns and seasonal fruit tarts, and we open at 7 so you can grab a loaf on the way to work, and on weekends we do a big brunch with coffee from a local roaster.',
  mapleNoCta: 'Maple and Rye bakery on Oak Street. Sourdough and morning buns, baked before 7.',
  serb: 'Frizerski salon Luna. Šišanje i brijanje u Velikoj Plani. Četvrtak popust. Dođite danas.',
};
const cardsOf = (r) => (r.spec?.cues || []).filter((q) => q.text).map((q) => q.text);
const startsWithConnector = (s) => CONNECTORS.has(String(s).split(/\s+/)[0].toLowerCase());

test('A1: no card starts with a dangling connector ("in Velika Plana", "for one before 9", "after 4")', () => {
  assert.deepEqual(splitBeats('Fresh fades in Velika Plana'), ['Fresh fades in Velika Plana', '']);
  assert.deepEqual(splitBeats('Espresso for one before 9'), ['Espresso for one before 9', '']);
  assert.deepEqual(splitBeats('Happy hour after 4'), ['Happy hour after 4', '']);
  assert.deepEqual(splitBeats('Šišanje i brijanje u Velikoj Plani'), ['Šišanje i brijanje u Velikoj Plani', '']);
  assert.deepEqual(splitBeats('Weekend flat white, 2 for 1'), ['Weekend flat white', '2 for 1']);
  assert.deepEqual(splitBeats('Coffee, after 4'), ['Coffee, after 4', '']);
  for (const [k, brief] of Object.entries(R5)) for (let seed = 1; seed <= 12; seed++) for (const format of ['9:16', '16:9']) {
    const r = composeFromBrief({ brief, seed, format });
    // a line may start with "On weekends…" when the brief's own sentence does; a card cut from the middle may not
    const lines = [r.parsed.headline, ...r.parsed.points, r.parsed.cta, r.parsed.brand].filter(Boolean).map((x) => x.toLowerCase());
    for (const t of cardsOf(r)) assert.ok(!startsWithConnector(t) || lines.some((l) => l.startsWith(t.toLowerCase().split(/\s+/).slice(0, 2).join(' '))), `${k} seed ${seed} ${r.look}: card "${t}" starts with a connector`);
  }
});

test('A2: a long paragraph keeps the whole name, cuts at clause boundaries, never repeats words; the caption is a short post', () => {
  const p = parseBrief({ brief: R5.maple });
  assert.equal(p.brand, 'Maple and Rye');
  assert.equal(p.headline, 'A tiny bakery on Oak Street');
  for (const x of [p.headline, ...p.points]) {
    assert.ok(x.length <= 48, `too long: ${x}`);
    const ws = x.toLowerCase().split(/\s+/);
    assert.ok(!/\b(\w+) and \1\b/i.test(x), `repeated word: ${x}`);
    assert.ok(!['and', 'or', 'the', 'a', 'in', 'on', 'with'].includes(ws.at(-1)), `ends on a connector: ${x}`);
  }
  for (let seed = 1; seed <= 10; seed++) {
    const r = composeFromBrief({ brief: R5.maple, seed, format: '9:16' });
    for (const t of cardsOf(r)) assert.ok(!/morning and morning/.test(t), t);
    assert.equal(r.parsed.brand, 'Maple and Rye');
  }
  for (const platform of ['tiktok', 'instagram', 'x']) {
    const c = writeCaption(p, { platform }).caption;
    assert.ok(c.length < 330, `${platform} caption is the whole paragraph (${c.length} chars)`);
    assert.ok(!c.includes('local roaster'), `${platform} caption pasted the whole brief`);
  }
});

test('A3: no trailing period on the brand or the beats', () => {
  assert.equal(parseBrief({ brief: R5.gym }).brand, 'Iron Current gym');
  assert.equal(parseBrief({ brief: R5.shop }).brand, 'Northwind Shop');
  assert.equal(parseBrief({ brief: 'Northwind Shop. 20% off everything this weekend.' }).brand, 'Northwind Shop');
  for (const [k, brief] of Object.entries(R5)) {
    const p = parseBrief({ brief });
    for (const x of [p.brand, p.headline, ...p.points]) assert.ok(!/[.,;:]$/.test(x), `${k}: "${x}" ends with punctuation`);
    for (let seed = 1; seed <= 6; seed++) for (const t of cardsOf(composeFromBrief({ brief, seed, format: '9:16' }))) assert.ok(!/[.,;:]$/.test(t), `${k}: card "${t}"`);
  }
});

test('A4: a place name stops at sentence punctuation (no #VelikaPlanaBook)', () => {
  const p = parseBrief({ brief: R5.barber });
  assert.equal(p.location, 'Velika Plana');
  assert.equal(p.cta, 'Book today');
  const tags = writeCaption(p, { platform: 'instagram' }).hashtags;
  assert.ok(tags.includes('#VelikaPlana'), tags.join(' '));
  assert.ok(!tags.some((t) => /Book/.test(t)), tags.join(' '));
});

test('A5: calls to action beyond English verbs; "Open house Saturday" is the button; a mid-name trade word keeps the full name', () => {
  const s = parseBrief({ brief: R5.serb });
  assert.equal(s.brand, 'Frizerski salon Luna');
  assert.equal(s.cta, 'Dođite danas');
  assert.equal(s.headline, 'Četvrtak popust');
  const r = parseBrief({ brief: R5.realty });
  assert.match(r.cta, /^Open house Saturday/);
  assert.equal(r.ctaButton, 'Open house Saturday');
  assert.match(r.headline, /4 bed waterfront/);
  for (const [brief, cta] of [['Glow Nails. Gel sets this week. Come in today', 'Come in today'], ['Brew Lab coffee. Stop by after work', 'Stop by after work'],
    ['Pizza Roma. Order online tonight', 'Order online tonight'], ['Kafić Mira. Svratite na kafu', 'Svratite na kafu'], ['Pekara Zora. Naručite tortu', 'Naručite tortu'],
    ['Studio Vita. Zakažite termin', 'Zakažite termin'], ['Café Sol. Visítanos hoy', 'Visítanos hoy'], ['Bäckerei Korn. Besuchen Sie uns', 'Besuchen Sie uns'],
    ['Salon Belle. Réservez maintenant', 'Réservez maintenant'], ['Bar Luce. Prenota ora', 'Prenota ora'], ['Kicks Store. New drops. Shop now', 'Shop now'], ['Bloom Florist. Get yours today', 'Get yours today']]) {
    assert.equal(parseBrief({ brief }).cta, cta, brief);
  }
  assert.equal(nameAtStart('Frizerski salon Luna. Šišanje').name, 'Frizerski salon Luna');
  assert.equal(nameAtStart("Leo's Barbershop fresh fades").name, "Leo's Barbershop");
  assert.equal(nameAtStart('Northwind café weekend flat white').name, 'Northwind café');
});

test('A6: emoji next to the call to action survive ("BOOK NOWWW 🔥🔥")', () => {
  assert.equal(parseBrief({ brief: R5.caps }).cta, 'BOOK NOWWW 🔥🔥');
  assert.equal(parseBrief({ brief: R5.capsDot }).cta, 'BOOK NOWWW 🔥🔥');
  assert.equal(parseBrief({ brief: R5.caps }).brand, 'BLAZE BARBERS');
  const r = composeFromBrief({ brief: R5.caps, seed: 3, look: 'kinetic-type', format: '9:16' });
  assert.ok(cardsOf(r).some((t) => t.includes('🔥')), cardsOf(r).join(' | '));
  // and the engine leaves emoji out (no empty box) on a computer without a colour emoji font
  const clip = readFileSync(new URL('../runtime/clip/clip.js', import.meta.url), 'utf8');
  assert.match(clip, /C\.emojiOK/); assert.match(clip, /stripEmoji/);
});

test('A7: the collage never uses the logo as the big picture, and keeps the title inside the phone-safe box', () => {
  const p = parseBrief({ brief: R5.serb });
  assert.match(lookBlocker('vox-collage', p, { hasLogo: true, hasScreenshot: false }), /photo/);
  const dir = mkdtempSync(join(tmpdir(), 'fh-vox-'));
  const logo = join(dir, 'logo.png'), photo = join(dir, 'shop.jpg');
  writeFileSync(logo, 'x'); writeFileSync(photo, 'x');
  const r = composeFromBrief({ brief: R5.serb, look: 'vox-collage', seed: 2, logoPath: logo, screenshotPath: photo, format: '9:16' });
  const imgs = r.spec.cues.filter((q) => q.image).map((q) => q.image);
  assert.ok(imgs.length >= 1 && imgs.every((x) => /brand-shot/.test(x)), imgs.join(','));
  const vox = readFileSync(new URL('../runtime/clip/grammars/y2_vox.js', import.meta.url), 'utf8');
  assert.match(vox, /ctx\.box\.w/);
});

test('A8: the highlighter is measured on the word as drawn and stops before the next word', () => {
  const ctx = { window: {}, U: { clamp: (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp: (a, b, t) => a + (b - a) * t } };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../runtime/clip/lib/typo.js', import.meta.url), 'utf8'), ctx);
  const TY = ctx.window.TY;
  // "Visit us": "Visit" is 600 px wide at 250 px, the space ~62 px; the text is scaled 1.06 about the frame centre
  for (const scale of [1, 1.06]) {
    const x = 240, w = 600, size = 250, ox = 540, space = 0.25 * size;
    const b = TY.markerBox(x, 900, w, size, { scale, ox, pad: 10 });
    const sx = (v) => ox + (v - ox) * scale;
    assert.ok(b.reach[0] <= sx(x), 'covers the start of the word');
    assert.ok(b.reach[1] >= sx(x + w), 'covers the end of the word');
    assert.ok(b.reach[1] < sx(x + w + space), `runs into the next word (${b.reach[1]} vs ${sx(x + w + space)})`);
  }
});

test('A9: no call to action means no invented button', () => {
  const p = parseBrief({ brief: R5.mapleNoCta });
  assert.equal(p.brand, 'Maple and Rye');
  assert.equal(p.cta, '');
  assert.equal(p.ctaAuto, false);
  assert.equal(p.headline, 'Sourdough and morning buns');
});

test('A11: a Serbian line keeps its order and its place, and a barbershop is not tagged as a hair salon', () => {
  const p = parseBrief({ brief: R5.serb });
  const r = composeFromBrief({ brief: R5.serb, look: 'menu-board', seed: 2, format: '9:16' });
  const texts = r.spec.cues.map((q) => `${q.text || ''} ${q.sub || ''}`).join(' | ');
  assert.match(texts, /Četvrtak popust/);
  assert.match(texts, /Plani/);
  const tags = writeCaption(p, { platform: 'instagram' }).hashtags.join(' ');
  assert.match(tags, /#barber|#barbershop/);
  assert.doesNotMatch(tags, /hairsalon/);
  assert.doesNotMatch(tags, /shoplocal/);
  // the sticker measures words: Č stays with "etvrtak", and a Chinese line still breaks per character
  const ctx = { window: {}, U: { clamp: (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp: (a, b, t) => a + (b - a) * t } };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../runtime/clip/lib/typo.js', import.meta.url), 'utf8'), ctx);
  const c = { font: '', save() {}, restore() {}, measureText: (s) => ({ width: [...s].length * 10 }) };
  const wrap = (s, w) => [...ctx.window.TY.wrap(c, s, w, '40px Kalam')];
  assert.deepEqual(wrap('Četvrtak popust', 50), ['Četvrtak', 'popust']);
  assert.deepEqual(wrap('今天特价', 20), ['今天', '特价']);
});

test('A10: the end-card button is short enough for a phone ("Visit us Saturday" + "Main St")', () => {
  assert.deepEqual(buttonOf('Visit us on Main St this Saturday'), { button: 'Visit us Saturday', sub: 'Main St' });
  assert.deepEqual(buttonOf('Open house Saturday 11-2'), { button: 'Open house Saturday', sub: '11–2' });
  assert.deepEqual(buttonOf('Book today'), { button: 'Book today', sub: '' });
  const c = parseBrief({ brief: R5.cafe });
  assert.equal(c.brand, 'Northwind café'); assert.equal(c.headline, '2 for 1'); assert.equal(c.ctaButton, 'Visit us Saturday');
});
