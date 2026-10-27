// Round 6: FRAMEHAND is for shops everywhere, not one country. The same rules (brand, offer, call to action, hashtags,
// wrapping, fonts, direction) hold for briefs in 15 languages; nothing English or Serbian is added to a post in
// another language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { parseBrief, composeFromBrief, hookOf, extractNumbers, CONNECTORS } from '../cli/lib/compose-brief.js';
import { writeCaption, hashtagsFor } from '../cli/lib/caption.js';
import { detectLang, PRICE_RE, parseAmount, isRtl } from '../cli/lib/lexicon.js';
import { END_SCRIPTS } from '../cli/lib/brand-layer.js';

const root = (p) => new URL(`../${p}`, import.meta.url);

// brief → what a person reading it would take from it
export const WORLD = [
  { id: 'en-US', lang: 'en', brief: "Joe's Pizza Brooklyn. 2 slices + soda $5 today only. Order now", brand: "Joe's Pizza Brooklyn", deal: '$5', cta: 'Order now', tag: '#pizza' },
  { id: 'en-UK', lang: 'en', brief: 'The Crown pub quiz Thursday, £2 pints. Book a table', brand: 'The Crown', deal: '£2 pints', cta: 'Book a table', tag: '#pub' },
  { id: 'es', lang: 'es', brief: 'Panadería Luna, 2x1 en croissants este sábado. ¡Ven hoy!', brand: 'Panadería Luna', deal: '2x1', cta: '¡Ven hoy!', tag: '#panaderia' },
  { id: 'pt-BR', lang: 'pt', brief: 'Barbearia do Zé, corte + barba R$45. Agende já', brand: 'Barbearia do Zé', deal: 'R$45', cta: 'Agende já', tag: '#barbearia' },
  { id: 'fr', lang: 'fr', brief: 'Café des Amis, -20% sur les viennoiseries ce week-end. Venez nous voir', brand: 'Café des Amis', deal: '-20%', cta: 'Venez nous voir', tag: '#café' },
  { id: 'de', lang: 'de', brief: 'Bäckerei Müller, 2 für 1 Brötchen am Samstag. Jetzt vorbeikommen', brand: 'Bäckerei Müller', deal: '2 für 1', cta: 'Jetzt vorbeikommen', tag: '#bäckerei' },
  { id: 'it', lang: 'it', brief: 'Pizzeria Da Mario, sconto 15% martedì. Prenota ora', brand: 'Pizzeria Da Mario', deal: 'Sconto 15%', cta: 'Prenota ora', tag: '#pizza' },
  { id: 'nl', lang: 'nl', brief: 'Kapsalon Mooi, 10% korting deze week. Boek nu', brand: 'Kapsalon Mooi', deal: '10% korting', cta: 'Boek nu', tag: '#kapsalon' },
  { id: 'pl', lang: 'pl', brief: 'Siłownia Moc, pierwszy tydzień gratis. Zapisz się', brand: 'Siłownia Moc', deal: 'Pierwszy tydzień gratis', cta: 'Zapisz się', tag: '#siłownia' },
  { id: 'tr', lang: 'tr', brief: 'İstanbul Kahve, %20 indirim cuma. Hemen gel', brand: 'İstanbul Kahve', deal: '%20 indirim', cta: 'Hemen gel', tag: '#kahve' },
  { id: 'ru', lang: 'ru', brief: 'Барбершоп Лев, скидка 20% в четверг. Запишись', brand: 'Барбершоп Лев', deal: 'Скидка 20%', cta: 'Запишись', tag: '#барбершоп' },
  { id: 'sr-Cyrl', lang: 'sr', brief: 'Фризерски салон Луна, попуст четвртак. Дођите данас', brand: 'Фризерски салон Луна', deal: 'Попуст', cta: 'Дођите данас', tag: '#фризер' },
  { id: 'el', lang: 'el', brief: 'Καφέ Αθήνα, 1+1 δωρεά το Σάββατο. Έλα σήμερα', brand: 'Καφέ Αθήνα', deal: '1+1 δωρεά', cta: 'Έλα σήμερα', tag: '#καφές' },
  { id: 'ar', lang: 'ar', brief: 'مقهى النخيل، خصم 20٪ يوم الجمعة. زورونا اليوم', brand: 'مقهى النخيل', deal: 'خصم 20٪', cta: 'زورونا اليوم', tag: '#قهوة' },
  { id: 'ja', lang: 'ja', brief: 'さくらカフェ 週末ラテ半額 今すぐ来店', brand: 'さくらカフェ', deal: '週末ラテ半額', cta: '今すぐ来店', tag: '#カフェ' },
];
const ENGLISH_ADDS = /\b(book now|order now|visit us|link in bio|shop now|learn more|today only|come in)\b/i;
const SERBIAN = /\b(popust|dođite|danas|akcija|frizer|kafić|#kupujlokalno)\b|попуст|дођите/iu;

test('G1: every brief is read in its own language: brand, offer, call to action', () => {
  for (const w of WORLD) {
    const p = parseBrief({ brief: w.brief });
    assert.equal(detectLang(w.brief), w.lang, `${w.id}: language`);
    assert.equal(p.brand, w.brand, `${w.id}: brand`);
    assert.equal(p.cta, w.cta, `${w.id}: call to action`);
    assert.equal(p.ctaAuto, false, `${w.id}: nothing invented`);
    assert.ok(p.local, `${w.id}: a local shop (${p.category})`);
    const h = hookOf(p.headline);
    assert.ok(h.main.startsWith(w.deal) || h.main === w.deal, `${w.id}: offer sticker "${h.main}" should open on "${w.deal}"`);
  }
});

test('G2: no fragment cards, no English or Serbian leaking into a film in another language', () => {
  for (const w of WORLD) for (const look of ['shop-poster', 'market-stamp', 'menu-board', 'kinetic-type', 'keynote-ui']) for (const seed of [1, 2, 3]) {
    let r;
    try { r = composeFromBrief({ brief: w.brief, seed, look, format: '9:16' }); } catch (e) { if (/can't be made/.test(e.message)) continue; throw e; }
    const cues = r.spec.cues.filter((q) => q.text);
    for (const q of cues) {
      const first = q.text.split(/\s+/)[0].toLowerCase();
      assert.ok(!CONNECTORS.has(first) || /^\d/.test(q.text), `${w.id} ${look}/${seed}: card starts on "${first}": ${q.text}`);
      assert.ok(/[\p{L}\p{N}]/u.test(q.text), `${w.id} ${look}/${seed}: empty card "${q.text}"`);
      assert.ok([...q.text].length > 1, `${w.id} ${look}/${seed}: one-letter card`);
    }
    const all = cues.map((q) => `${q.text} ${q.sub || ''}`).join(' | ') + JSON.stringify(r.spec.data || {});
    if (w.lang !== 'en') assert.doesNotMatch(all, ENGLISH_ADDS, `${w.id} ${look}: English on screen: ${all}`);
    if (w.lang !== 'sr') assert.doesNotMatch(all, SERBIAN, `${w.id} ${look}: Serbian on screen`);
    assert.ok(cues.some((q) => q.text.includes(w.brand) || (q.sub || '').includes(w.brand)) || look === 'keynote-ui', `${w.id} ${look}: brand on screen`);
    assert.ok(cues.some((q) => `${q.text} ${q.sub || ''}`.includes(w.cta.replace(/[¡!]/g, ''))) || look === 'keynote-ui' && r.spec.cues.some((q) => (q.text || '').includes(w.cta.replace(/[¡!]/g, ''))), `${w.id} ${look}: call to action on screen`);
  }
});

test('G3: the post is in the brief\'s language, with tags of that language and no forced English', () => {
  for (const w of WORLD) {
    const p = parseBrief({ brief: w.brief });
    for (const platform of ['instagram', 'tiktok', 'x']) {
      const c = writeCaption(p, { platform });
      assert.ok(c.caption.includes(w.brand), `${w.id} ${platform}: brand in post`);
      assert.ok(c.caption.includes(w.cta.replace(/!$/, '')), `${w.id} ${platform}: the owner's own call to action`);
      if (w.lang !== 'en') assert.doesNotMatch(c.caption.replace(/#\S+/g, ''), ENGLISH_ADDS, `${w.id}: English words added: ${c.caption}`);
      if (w.lang !== 'sr') assert.doesNotMatch(c.caption, SERBIAN, `${w.id}: Serbian in post`);
    }
    const tags = hashtagsFor({ ...p }, 'instagram');
    assert.ok(tags.includes(w.tag), `${w.id}: ${w.tag} in ${tags.join(' ')}`);
    if (w.lang !== 'en') assert.ok(!tags.includes('#shoplocal'), `${w.id}: #shoplocal is English`);
    // the brief's own language comes first (an English tag may follow it for reach, never lead)
    assert.equal(tags[1], w.tag, `${w.id}: ${tags.join(' ')}`);
  }
});

test('G4: offers in every language are offers (deal words, percent signs, 2x1 / 2 für 1 / 1+1)', () => {
  const offers = ['Četvrtak popust', '20% off everything', 'Kaffee gratis', '10% Rabatt', '15% de descuento', '-30% de réduction', 'sconto 10%', '20% desconto', '10% korting', '%15 indirim', 'скидка 15%', 'promo latte', 'Summer sale', 'BOGO burgers', '2x1 en tacos', '2 por 1 en café', '2 für 1 Brötchen', '1+1 δωρεά', 'خصم 20٪', '半額'];
  for (const s of offers) {
    const p = parseBrief({ brief: `Shop Name. ${s}. Visit` });
    assert.equal(p.offer.toLowerCase(), s.toLowerCase().replace(/^./, (c) => c), `"${s}" is the offer`);
  }
  for (const [s, main] of [['2 por 1 en café', '2 por 1'], ['2 für 1 Brötchen am Samstag', '2 für 1'], ['%20 indirim bugün ve yarın', '%20 indirim'], ['Скидка 20% в четверг', 'Скидка 20%'], ['-20% sur tout le magasin', '-20%']])
    assert.equal(hookOf(s).main, main, s);
});

test('G5: money and numbers are read in both styles (10€ / €10, 1.299,00 / 1,299.00)', () => {
  for (const s of ['$5', '€10', '10€', '10 €', '£2', '¥500', '₹199', 'R$45', '45 zł', '99 kr', 'CHF 12', '12 CHF', '500 din', '1.200 RSD', '50 AED', '₺80', '₽500'])
    assert.ok(PRICE_RE.test(`only ${s} today`), s);
  assert.equal(parseAmount('1.299,00'), 1299); assert.equal(parseAmount('1,299.00'), 1299); assert.equal(parseAmount('4,5'), 4.5); assert.equal(parseAmount('1 299'), 1299); assert.equal(parseAmount('٢٠'), 20);
  const n = extractNumbers('Sofa 1.299,00 din this week. Chairs 10€ each. Brazil R$45.');
  assert.deepEqual(n.map((x) => [x.value, x.prefix, x.suffix.trim()]), [[1299, '', 'din'], [10, '', '€'], [45, 'R$', '']]);
  assert.deepEqual(extractNumbers('%20 indirim').map((x) => [x.value, x.suffix]), [[20, '%']]);
  assert.equal(extractNumbers('1+1 δωρεά').length, 0, '1+1 is a deal, not a figure');
});

// the canvas wrapping and letter animation code, in a sandbox with a fixed-width "font"
const TYctx = () => { const ctx = { window: {}, Intl, U: { clamp: (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp: (a, b, t) => a + (b - a) * t } }; vm.createContext(ctx); vm.runInContext(readFileSync(root('runtime/clip/lib/typo.js'), 'utf8'), ctx); return ctx.window.TY; };
test('G6: lines break between words in every script, never inside one (Thai by its word breaks, Han and kana per character)', () => {
  const TY = TYctx();
  const c = { font: '', save() {}, restore() {}, measureText: (s) => ({ width: [...s].length * 10 }) };
  const wrap = (s, w) => [...TY.wrap(c, s, w)];
  assert.deepEqual(wrap('خصم 20٪ يوم الجمعة', 80), ['خصم 20٪', 'يوم', 'الجمعة']);
  assert.deepEqual(wrap('שלום עולם יפה', 60), ['שלום', 'עולם', 'יפה']);
  assert.deepEqual(wrap('नमस्ते दुनिया आज', 80), ['नमस्ते', 'दुनिया', 'आज']);
  assert.deepEqual(wrap('할인 이벤트 오늘만', 60), ['할인 이벤트', '오늘만']);
  assert.deepEqual(wrap('Скидка 20% в четверг', 80), ['Скидка', '20% в', 'четверг']);
  assert.deepEqual(wrap('İstanbul Kahve', 80), ['İstanbul', 'Kahve']);
  assert.deepEqual(wrap('今天特价', 20), ['今天', '特价']);
  const th = wrap('ส่วนลดพิเศษวันศุกร์นี้', 60);
  assert.ok(th.length > 1 && th.join('') === 'ส่วนลดพิเศษวันศุกร์นี้', th.join('|'));
  // letter-by-letter animation: joined scripts move as one piece, emoji and accents stay whole
  assert.ok(TY.joined('مقهى') && TY.joined('नमस्ते') && !TY.joined('Café'));
  assert.deepEqual([...TY.graphemes('👨‍👩‍👧ẹ́')].length, 2);
});

test('G7: right-to-left briefs are marked, posters centre them, the button arrow points left', () => {
  const p = parseBrief({ brief: WORLD.find((w) => w.id === 'ar').brief });
  assert.ok(p.rtl && isRtl('مقهى') && isRtl('קפה') && !isRtl('Café'));
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = composeFromBrief({ brief: WORLD.find((w) => w.id === 'ar').brief, look: 'shop-poster', seed, format: '9:16' });
    assert.equal(r.spec.data.align, 'center'); assert.equal(r.spec.data.rtl, true);
  }
  assert.match(readFileSync(root('runtime/clip/grammars/y6_poster.js'), 'utf8'), /'←' : '→'/);
  assert.match(readFileSync(root('runtime/clip/clip.js'), 'utf8'), /this\.direction = 'rtl'/);
});

test('G8: the script fallback fonts are bundled, small, licensed and copied into every clip project', () => {
  const dir = root('fonts/scripts/');
  const files = readdirSync(dir).filter((f) => f.endsWith('.woff'));
  const clip = readFileSync(root('runtime/clip/clip.js'), 'utf8');
  const listed = [...new Set([...clip.matchAll(/file: '([^']+)'/g)].map((m) => m[1]))];
  for (const f of new Set([...listed, ...END_SCRIPTS.map((s) => s.file)])) assert.ok(files.includes(f), `fonts/scripts/${f}`);
  const total = files.reduce((a, f) => a + statSync(new URL(f, dir)).size, 0);
  assert.ok(total < 5 * 1024 * 1024, `${(total / 1048576).toFixed(1)} MB`);
  const lic = readFileSync(root('fonts/LICENSES.md'), 'utf8');
  for (const f of files) assert.ok(lic.includes(f), `${f} in LICENSES.md`);
  for (const t of readdirSync(root('templates'))) {
    const meta = root(`templates/${t}/template.json`);
    if (!existsSync(meta)) continue;
    const copy = JSON.parse(readFileSync(meta, 'utf8')).copy || {};
    if (copy['runtime/clip/clip.js']) assert.equal(copy['fonts/scripts'], 'assets/fonts/scripts', `${t} copies the script fonts`);
  }
});
