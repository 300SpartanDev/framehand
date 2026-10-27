// Brief → unique film composition.
// Reads what the brief really says (brand, headline, points, numbers, formula, call to action, kind of
// business, tone), keeps only the looks whose scenes it can fill with real words, then makes a seeded,
// weighted choice that leans toward the best fit. Each film's scene list is written from the brief itself
// — as many scenes as there are real things to say, in a seed-chosen order and pace — so there are never
// placeholder words, invented numbers or bundled stock pictures.
import { createHash } from 'node:crypto';
import * as LX from './lexicon.js';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';

/** The look grammars shipped under templates/. `clip` = drawn by the canvas clip engine (reflows to 9:16). */
export const LOOKS = [
  // warm local-business looks (one grammar, three print styles), all drawn in code
  { id: 'shop-poster', label: 'Shop poster', blurb: 'A riso-printed shop poster: your offer on a big sticker.', clip: 'y6_poster', template: 'shop-poster', style: 'riso' },
  { id: 'menu-board', label: 'Menu board', blurb: 'A café chalkboard: your offer chalked and circled.', clip: 'y6_poster', template: 'shop-poster', style: 'chalk' },
  { id: 'market-stamp', label: 'Market stamp', blurb: 'Kraft paper, rubber stamps and tape labels, like a market stall.', clip: 'y6_poster', template: 'shop-poster', style: 'kraft' },
  { id: 'kinetic-type', label: 'Kinetic type', blurb: 'Big words slam in page by page.', clip: 'y5_kinetic_type' },
  { id: 'keynote-ui', label: 'Keynote launch', blurb: 'Dark glass cards, product shot, big real numbers.', clip: 't2_keynote_ui' },
  { id: 'kurzgesagt', label: 'Flat science', blurb: 'A glowing planet with each idea as a satellite.', clip: 'y1_kurzgesagt' },
  { id: 'whiteboard', label: 'Whiteboard', blurb: 'A marker writes your points and circles the key one.', clip: 'y3_whiteboard' },
  { id: 'math-3b1b', label: 'Math explainer', blurb: 'Your formula written and explained (needs a formula).', clip: 't1_3b1b', needs: 'formula' },
  { id: 'finance-chart', label: 'Finance chart', blurb: 'A clean chart of your own figures (needs 2+ numbers).', clip: 't3_finance_chart', needs: 'series' },
  { id: 'vox-collage', label: 'Collage desk', blurb: 'Your photo taped on a desk with notes (needs a photo).', clip: 'y2_vox', needs: 'image' },
  { id: 'storytime', label: 'Story character', blurb: 'A little character tells your story.', clip: 'y4_storytime', needs: 'story' },
  { id: 'ui-space', label: 'UI in space', blurb: 'Your screenshot floats in 3D (needs a screenshot).', needs: 'screenshot' },
  { id: 'object-3d', label: '3D object', blurb: 'Your screen on a lit studio device (needs a screenshot).', needs: 'screenshot' },
];
export const LOOK_IDS = LOOKS.map((l) => l.id);
const POSTER_DAMP = 1.2; // local briefs: the three poster looks are the majority, kinetic type stays under about 40%
export const POSTER_LOOKS = new Set(LOOKS.filter((l) => l.clip === 'y6_poster').map((l) => l.id));
/** The template folder a look is built from (the three poster looks share one). */
export const templateOf = (id) => LOOKS.find((l) => l.id === id)?.template || id;
/** Looks that can make a real 1080×1920 film (the canvas grammars reflow; the 3D scenes are widescreen only). */
export const VERTICAL_LOOKS = new Set(LOOKS.filter((l) => l.clip).map((l) => l.id));

/** Niche templates kept only as optional copy starters — never the main path. */
export const NICHE_STARTERS = [
  { id: 'local-business', label: 'Local shop vibe', hint: 'café / shop / salon' },
  { id: 'real-estate', label: 'Listing vibe', hint: 'open house / property' },
  { id: 'gym-fitness', label: 'Gym vibe', hint: 'membership / challenge' },
];

const ACCENTS = ['#5b8cff', '#3dd68c', '#ff5c5c', '#ffb020', '#e07a3f', '#a78bfa', '#22d3ee', '#f472b6'];
const PLANETS = ['#F48301', '#3d6bff', '#2dd4a8', '#f5c542', '#c084fc', '#38bdf8'];
const KINETIC_PALETTES = [
  [['#FFD23F', '#111111'], ['#FF5A36', '#FFFFFF'], ['#14213D', '#FFD23F'], ['#F4EFE6', '#111111']],
  [['#0B0D10', '#5B8CFF'], ['#5B8CFF', '#0B0D10'], ['#3DD68C', '#0B0D10'], ['#14181F', '#E8EEF7']],
  [['#1a0a2e', '#e879f9'], ['#e879f9', '#1a0a2e'], ['#f472b6', '#1a0a2e'], ['#0f172a', '#f8fafc']],
  [['#14532d', '#bbf7d0'], ['#22c55e', '#052e16'], ['#052e16', '#4ade80'], ['#f0fdf4', '#14532d']],
  [['#111111', '#F4EFE6'], ['#E63946', '#FFFFFF'], ['#F4EFE6', '#111111'], ['#1D3557', '#F1FAEE']],
];

// ---------- seeded randomness ----------
function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedInt(seed) {
  if (seed == null || seed === '') return (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  if (/^\d+$/.test(String(seed).trim())) return Number(String(seed).trim()) >>> 0;
  return createHash('sha256').update(String(seed)).digest().readUInt32BE(0);
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length) % arr.length];
function weighted(rand, items) {
  const total = items.reduce((a, x) => a + x.w, 0);
  let r = rand() * total;
  for (const x of items) { r -= x.w; if (r <= 0) return x; }
  return items[items.length - 1];
}

// ---------- text helpers ----------
const clean = (s) => String(s ?? '').replace(/\{\{|\}\}/g, '').replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cap1 = (s) => { s = clean(s); return s ? s[0].toLocaleUpperCase() + s.slice(1) : s; };
// a name, a beat or a line never ends (or starts) on punctuation: "Iron Current gym." → "Iron Current gym"
const PUNCT_END = /[\s.,;:!?…–—\-،؛؟。、，！？।]+$/u, PUNCT_START = /^(?:[\s.,;:!?…—،؛؟。、，！？।]|[–-](?![0-9\u0660-\u0669]))+/u;
const stripEnd = (s) => clean(s).replace(PUNCT_END, '').replace(PUNCT_START, '');
// a call to action may keep its "!" ("Book now!")
const stripCta = (s) => clean(s).replace(/[\s.,;:…–—\-،؛。、，]+$/u, '').replace(PUNCT_START, '');
/** A Unicode-aware \b: JavaScript's \b treats é, č, š… as non-letters, so "café" or "dođite" never matched. */
const UB = '(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))';
const ub = (re) => new RegExp(re.source.split('\\b').join(UB), re.flags.includes('u') ? re.flags : re.flags + 'u');
/** Words a beat may not start with: prepositions and conjunctions ("in Velika Plana", "for one before 9", "after 4"), in every language of lexicon.js. */
export const CONNECTORS = new Set(LX.all(LX.CONNECTORS));
/** …and words a cut may not end on: those plus articles and determiners ("…every morning and", "…the"). */
const ENDLESS = new Set([...CONNECTORS, ...LX.all(LX.ARTICLES)]);
const isConnector = (w) => CONNECTORS.has(String(w || '').toLocaleLowerCase().replace(/[^\p{L}\p{M}&+]/gu, ''));
const isDangling = (w) => ENDLESS.has(String(w || '').toLocaleLowerCase().replace(/[^\p{L}\p{M}&+’']/gu, ''));
const words = (s) => clean(s).split(/\s+/).filter(Boolean);
const DANGLING = /\s+(who|that|which|the|a|an|to|and|or|of|for|with|in|on|at|by|from|your|our|my|their|is|are|be|this|these|than|as|&)$/i;
/** Shorten at a word boundary (a clause boundary when there is one), never mid-word, never ending on "and"/"in"/…, never repeating words. */
function clipText(s, n) {
  s = clean(s);
  if (s.length <= n) return s;
  const ws = words(s);
  let out = [];
  for (const w of ws) { if ((out.join(' ') + ' ' + w).trim().length > n) break; out.push(w); }
  while (out.length > 1 && isDangling(out[out.length - 1])) out.pop();
  if (!out.length) out = [ws[0].slice(0, n)];
  return out.join(' ').replace(/[\s,;:–—-]+$/u, '');
}
/** Long clauses keep their first idea: cut before "that / which / so / with / because …" once there are 3+ words. */
const CLAUSE_CUT = /\s+(?:that|which|who|where|so|so that|because|while|plus|and we|and you|with|but)\s+/giu;
function tidyClause(s, max = 48) {
  s = clean(s).replace(/^(?:and|plus|but|so|also|then|or|i|y|et|und|e|и|і|και|ve|en|و)\s+/iu, '');
  if (s.length <= max) return s;
  for (const m of s.matchAll(CLAUSE_CUT)) { const head = s.slice(0, m.index); if (words(head).length >= 3 && head.length <= max) return stripEnd(head); }
  return clipText(s, max);
}
// emoji and pictographs (🔥, ✂️, ☕): kept next to the words they sit beside
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u200D\uFE0F]/u;
const hasLetters = (s) => /[\p{L}\p{N}]/u.test(String(s || ''));

/** Decode the HTML entities a pasted brief (or an earlier escape) may carry: "Leo&#39;s" → "Leo's". */
export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') { const n = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[k] ?? m;
  });
}

// ---------- what kind of brief is this ----------
// Generic, multilingual-ish signals (English first, plus common Spanish / French / German / Serbian / Croatian words).
const CATEGORY_WORDS0 = {
  beauty: /\b(barber(shop)?s?|frizer\w*|fades?|haircuts?|hair|salon|spa|nails?|lash(es)?|brows?|make-?up|skin ?care|facials?|massage|tattoo\w*|beauty|peluquer\w*|coiffeur|friseur|kozmeti\w*)\b/iu,
  food: /\b(caf[eé]s?|coffee|kafa|kafi[cć]|espresso|latte|cold brew|cookies?|pastr\w*|croissants?|flat white|bakery|bakeries|pekar\w*|bread|cake|dessert|restaurant\w*|restoran\w*|pizza\w*|bistro|brunch|menu|burgers?|sushi|tacos|kitchen|grill|deli|diner|pub|bar|wine|beer|cocktails?|food|dinner|lunch|breakfast|panader\w*|boulangerie|b[äa]ckerei)\b/iu,
  fitness: /\b(gym|fitness|workouts?|trainers?|training|yoga|pilates|crossfit|boxing|teretan\w*|gimnasio|membership|classes)\b/iu,
  realestate: /\b(listing|open house|bedrooms?|beds?|baths?|sq ?ft|m²|apartments?|condos?|villa|propert(y|ies)|realtor|real estate|for sale|for rent|stan(ovi)?|nekretnin\w*|inmobiliaria|immobilier)\b/iu,
  saas: /\b(apps?|saas|software|platform|dashboard|api|integrations?|workflows?|teams?|users|free trial|sign ?up|download|ios|android|startup|automation|productivity|tool|crm|analytics|ai)\b/iu,
  event: /\b(events?|concert|festival|meetup|workshop|webinar|conference|party|tickets?|rsvp|grand opening|opening night|tonight|this (friday|saturday|sunday)|live music)\b/iu,
  product: /\b(new collection|collection|drop|edition|pre-?order|shipping|in stock|hardware|device|gadget|launch(es|ing)?|out now|available now)\b/iu,
  edu: /\b(explain\w*|learn\w*|course|lesson|teach\w*|how to|why|guide|tutorial|science|students?|class notes)\b/iu,
  finance: /\b(revenue|profit|growth|invest\w*|stocks?|market cap|yoy|quarter|q[1-4]|arr|mrr|sales|earnings)\b/iu,
  story: /\b(i (tried|asked|spent|made|built|quit)|story|storytime|funny|lol|fail(ed)?|my (first|boss))\b/iu,
  retail: /\b(shop|store|boutique|outlet|clothing|fashion|shoes|sneakers|jewel(le)?ry|gifts?|flowers?|florist|bookstore|prodavnic\w*|butik|tienda|laden|magasin|negozio)\b/iu,
};
const CATEGORY_WORDS = Object.fromEntries(Object.entries(CATEGORY_WORDS0).map(([k, re]) => {
  const extra = [...(LX.BUSINESS[k] || []), ...(LX.TOPIC_WORDS[k] || [])];
  return [k, extra.length ? new RegExp(`${ub(re).source}|${LX.wordsRe(extra).source}`, 'iu') : ub(re)];
}));
const LOCAL = new Set(['beauty', 'food', 'fitness', 'realestate', 'retail']);
const TONE_WORDS0 = {
  bold: /\b(bold|loud|hype|urgent|power|fire|huge|massive|insane|last chance|limited|only today)\b|!{2,}/iu,
  premium: /\b(premium|luxury|elegant|polished|exclusive|flagship|crafted|bespoke)\b/iu,
  playful: /\b(fun|playful|joke|meme|silly|casual|witty|cute)\b/iu,
  calm: /\b(calm|soft|gentle|quiet|slow|mindful|relax\w*|cozy|cosy)\b/iu,
  fresh: /\b(fresh|new|clean|crisp)\b/iu,
  friendly: /\b(friendly|welcome|family|local|neighbou?rhood|community)\b/iu,
};
const TONE_WORDS = Object.fromEntries(Object.entries(TONE_WORDS0).map(([k, re]) => [k, ub(re)]));
const BUSINESS_NOUN0 = ub(/\b(barbershop|barbers?|salon|frizer\w*|spa|studio|caf[eé]|kafi[cć]|pekar[ae]?|teretana|coffee(?: house| shop)?|bakery|bar|bistro|restaurant|pizzeria|kitchen|grill|gym|fitness|clinic|dental|shop|store|boutique|market|realty|homes|properties|agency|academy|school|yoga|nails|tattoo|florist|garage|motors|hotel|hostel|pub|deli|diner|club|co\.?|company|labs?)\b/iu);
const BUSINESS_RE = LX.wordsRe(Object.values(LX.BUSINESS).flat());
const BUSINESS_NOUN = { test: (w) => BUSINESS_NOUN0.test(w) || BUSINESS_RE.test(w) };
// calls to action: every language in lexicon.js (CTA). "Open house Saturday" is one too. Group 1 is what stands before the verb.
const CTA_WORDS = LX.all(LX.CTA);
const CTA_CJK = CTA_WORDS.filter((w) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(w));
const CTA_VERB = new RegExp(`(^|[\\s,.;:!?¡¿—–\\-،؛、，。！？(（「])((?:${LX.alt(CTA_WORDS.filter((w) => !CTA_CJK.includes(w)))})${LX.L1}|${LX.alt(CTA_CJK)})`, 'iu');
const CTA_LEAD = new RegExp(`(?:^|\\s)(${LX.alt(LX.all(LX.CTA_LEAD))})\\s+$`, 'iu');
const NOT_BEFORE_VERB = ub(/\b(every|an|the|my|your|our|per|each|first|one|to|we|they|you|i|can|will|and|could|may|might|should|must|or|da|se)\s*$/iu);
const SENTENCE_START = /^(the|a|an|our|we|you|your|this|that|these|new|now|fresh|weekend|morning|today|tonight|every|all|best|big|hot|free|get|just|revenue|sales|profit|growth|meet|introducing|why|how|what|when|join|come|try|book|visit|shop|order|call|start|save|open|hello|hi|it|its|my|i|in|on|at|for)$/i;
const D = LX.D, PCT = LX.PCT;
const DISCOUNT_ALT = LX.alt(LX.all(LX.DISCOUNT)), FREE_ALT = LX.alt(LX.all(LX.FREE));
/** Deals with a figure in them, in any language: "20% off", "-20%", "%20 indirim", "скидка 20%", "خصم 20٪", "2 for 1", "2x1", "2 für 1", "1+1 δωρεά". */
const NUMDEAL_SRC = `(?:${DISCOUNT_ALT}\\s*[-–−]?\\s*${D}+(?:[.,]${D}+)?\\s*${PCT})`
  + `|(?:[-–−]\\s?)?${D}+(?:[.,]${D}+)?\\s*${PCT}(?:\\s*${DISCOUNT_ALT}${LX.L1})?`
  + `|${PCT}\\s*${D}+(?:\\s*${DISCOUNT_ALT}${LX.L1})?`
  + `|${D}+\\s*(?:${LX.alt(LX.NUM_FOR)})\\s*${D}+(?:\\s*${FREE_ALT}${LX.L1})?`
  + `|${D}+\\s*\\+\\s*${D}+(?:\\s*${FREE_ALT}${LX.L1})?`;
const NUMDEAL_RE = new RegExp(`${LX.L0}(?:${NUMDEAL_SRC})|(?:[-–−]\\s?)${D}+\\s*${PCT}`, 'iu');
/** Deals in words: "half price", "first week free", "pierwszy tydzień gratis", "free coffee", "popust". */
const WORDDEAL_RE = new RegExp(`${LX.L0}(?:${LX.alt(LX.all(LX.DEAL_PHRASES))}|(?:[\\p{L}]+\\s+){1,2}${FREE_ALT}|${FREE_ALT}\\s+[\\p{L}]+|${FREE_ALT}|${DISCOUNT_ALT})${LX.L1}|${LX.alt(LX.all(LX.DEAL_PHRASES).filter((w) => /[\\p{Script=Han}\\p{Script=Katakana}\\p{Script=Hangul}]/u.test(w)))}`, 'iu');
const OFFER_WORDS0 = ub(/\b(free|off|sale|deal|discount|trial|\d+\s*for\s*\d+|two for one|bogo|offer|special|promo|coupon|half price|happy hour)\b|\d+\s*%/iu);
const OFFER_ALL = LX.wordsRe([...LX.all(LX.DISCOUNT), ...LX.all(LX.FREE), ...LX.all(LX.DEAL_PHRASES), ...LX.all(LX.OFFER_WORDS)]);
const OFFER_WORDS = { test: (s) => OFFER_WORDS0.test(s) || OFFER_ALL.test(s) || NUMDEAL_RE.test(s) || LX.PRICE_RE.test(s) };
const DAY_RE = new RegExp(`^(?:${LX.alt(LX.all(LX.WEEKDAYS))})$`, 'iu');
const UNIT_WORDS = /^(users?|customers?|clients?|members?|hours?|hrs?|minutes?|mins?|days?|weeks?|months?|years?|people|teams?|downloads?|stars?|reviews?|orders?|sales|countries|cities|locations|stores|shops|projects|companies|employees|followers|subscribers|times|faster|more|less|seats|students|patients|cups|kg|km|miles|m²|sq|bedrooms?|beds?|baths?|percent)$/iu;

function splitClauses(text) {
  const out = [];
  for (const line of String(text).split(/\n+/)) {
    const l = line.trim().replace(/^[-*•·]+(?![0-9\u0660-\u0669])\s*|^\d+[.)]\s+/u, ''); // a list bullet, not the minus of "-20%"
    if (!l) continue;
    // sentences, then comma lists — but keep "1,200" and "2 for 1" whole
    for (const s of l.split(/(?<=[.!?;؟])\s+|(?<=[。！？।])\s*|(?<!\d),(?!\d)\s*|\s*[،؛，、]\s*|\s+[|·]\s+/u)) {
      const t = stripEnd(s.replace(/[.!?;؟。！？।]+$/u, ''));
      if (!t) continue;
      if (!hasLetters(t) && out.length && EMOJI.test(t)) { out[out.length - 1] = `${out[out.length - 1]} ${t}`; continue; } // "BOOK NOWWW. 🔥🔥"
      out.push(t);
    }
  }
  return out;
}

/** Real figures the brief states, with the words around them. Deals ("2 for 1"), times, phones and years are not figures. */
export function extractNumbers(text) {
  const out = [];
  const CUR = LX.CUR_SRC;
  const re = new RegExp(`(${CUR})?\\s?(${LX.PCT})?(${LX.NUM})\\s?(${LX.PCT}|x|×|k|m|bn|\\+|${CUR})?(?![\\p{L}\\p{N}])\\s*([\\p{L}²]+)?`, 'giu');
  const FOR = new RegExp(`^\\s*(?:${LX.alt(LX.NUM_FOR)}|-|–|to|:|\\+)\\s*${LX.D}`, 'iu');
  for (const clause of splitClauses(text)) {
    for (const m of clause.matchAll(re)) {
      const [whole0, cur0, lead, num, suf0, unit] = m;
      const curAfter = suf0 && new RegExp(`^(?:${CUR})$`, 'iu').test(suf0) ? suf0 : '';
      const cur = cur0 || '';
      const suf = curAfter ? '' : (lead ? '%' : suf0 && (/^[%٪﹪％]$/.test(suf0) ? '%' : suf0.toLowerCase()));
      const before = clause.slice(0, m.index), after = clause.slice(m.index + whole0.length);
      if (FOR.test(clause.slice(m.index + cur.length + (lead || '').length + num.length + (suf0 ? suf0.length : 0)))) continue; // 2 for 1, 2x1, 1+1, 11-2, 10:30
      if (/^\s*(?:x|×|\+)\s*$/.test(suf0 || '') && /^\s*\d/.test(after)) continue;
      if (/^(?:am|pm|h)$/i.test(unit || '') || /^[:.]\d/.test(after)) continue; // 10am, 9h (not "each" or "month")
      if (/(#|no\.?|nr\.?|\+|tel|phone|call)\s*$/i.test(before)) continue;
      if (/\d{6,}/.test(LX.asciiDigits(num).replace(/\D/g, '')) && !cur && !curAfter) continue;
      const value = LX.parseAmount(num);
      if (!Number.isFinite(value)) continue;
      if (!cur && !curAfter && !suf && value >= 1900 && value <= 2100 && !unit) continue; // a year
      const unitOk = unit && UNIT_WORDS.test(unit);
      if (!cur && !curAfter && !suf && !unitOk) continue;
      const whole = unitOk ? whole0 : clean(whole0.slice(0, whole0.length - (unit || '').length));
      const asc = LX.asciiDigits(num);
      const decimals = /[.,]\d{1,2}$/.test(asc) && !/\d{1,3}[,.]\d{3}$/.test(asc) ? Math.min(2, asc.split(/[.,]/).pop().length) : 0;
      let suffix = suf === '%' ? '%' : suf === 'x' || suf === '×' ? '×' : suf === 'k' ? 'K' : suf === 'm' ? 'M' : suf === 'bn' ? 'B' : suf === '+' ? '+' : '';
      if (curAfter) suffix = (/^\p{L}/u.test(curAfter) || /\s$/.test(whole0.slice(0, whole0.indexOf(curAfter))) ? ' ' : '') + curAfter;
      if (unitOk) suffix += ` ${unit.toLowerCase()}`;
      const rest = clean(clause.replace(whole, ' ')).replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '');
      const restN = words(rest).length;
      // "max 8 people" → label "Max" over the number; "saves teams 6 hours a week" → the sentence as its caption
      out.push({ value, decimals, prefix: cur, suffix, unit: unitOk ? unit.toLowerCase() : (suf || curAfter || ''), text: clean(whole), clause, at: m.index,
        label: restN >= 1 && restN <= 2 ? cap1(rest) : '', caption: restN >= 3 ? clause : '' });
    }
  }
  return out;
}

/** A formula the brief spells out (e = mc², f(x) = …, √, ∑). */
function extractFormula(text) {
  for (const c of String(text).split(/\n+/)) {
    const m = /([A-Za-zα-ωΑ-Ω∑∫√][\w\sα-ωΑ-Ω()^²³+\-*/·×∑∫√∇=←]{0,40}=[\w\sα-ωΑ-Ω()^²³+\-*/·×∑∫√∇.]{1,40})/u.exec(c);
    if (m && /[a-zα-ω]/iu.test(m[1]) && !/https?:/.test(c)) return clean(m[1]);
  }
  return '';
}

const CAPWORD = /^[\p{Lu}\d&][\p{L}\d'’&.-]*$/u;
const NAME_JOIN = new Set(LX.NAME_JOIN);
/**
 * The business name at the start of a sentence, as written: "Leo's Barbershop", "Northwind café", "Maple and Rye",
 * "Frizerski salon Luna", "BLAZE BARBERS". Stops at sentence punctuation. A lowercase trade word after a
 * multi-word name is dropped ("Maple and Rye bakery" → "Maple and Rye"); a trade word in the middle is kept.
 */
export function nameAtStart(sentence) {
  const raw = clean(sentence);
  const ws = words(raw);
  if (!ws.length || !/^[\p{Lu}\d]/u.test(ws[0])) return null;
  const letters = raw.replace(/[^\p{L}]/gu, '');
  const allCaps = letters.length > 3 && letters === letters.toLocaleUpperCase();
  const bare = (w) => w.replace(/[.,;:!?…]+$/u, '');
  const ends = (w) => /[.,;:!?…]$/u.test(w);
  // a whole short sentence that is only a name: "Iron Current gym." / "Northline Realty." / "Frizerski salon Luna."
  const first = /^[^.!?\n]+[.!?](?=\s|$)/u.exec(raw);
  if (first && !allCaps) {
    const fw = words(stripEnd(first[0]));
    const only = fw.length >= 1 && fw.length <= 5 && !/\d/.test(first[0]) && !CTA_VERB.test(' ' + first[0])
      && fw.every((w, i) => CAPWORD.test(w) || BUSINESS_NOUN.test(w) || (i > 0 && i < fw.length - 1 && NAME_JOIN.has(w.toLowerCase())))
      && fw.some((w) => CAPWORD.test(w)) && (fw.length > 1 || BUSINESS_NOUN.test(fw[0]) || raw.length > first[0].length + 2);
    if (only && (fw.length > 1 || !SENTENCE_START.test(fw[0]))) return { name: stripEnd(first[0]), after: raw.slice(first[0].length), noun: fw.some((w) => BUSINESS_NOUN.test(w)) };
  }
  const name = []; let noun = -1;
  for (let i = 0; i < ws.length && name.length < 6; i++) {
    const w = bare(ws[i]);
    if (!w) break;
    const isNoun = BUSINESS_NOUN.test(w);
    if (allCaps) { name.push(w); if (isNoun) { noun = name.length - 1; break; } if (ends(ws[i])) break; continue; }
    if (CAPWORD.test(w) && !/^\d/.test(w)) name.push(w);
    else if (name.length && NAME_JOIN.has(w.toLowerCase()) && ws[i + 1] && CAPWORD.test(bare(ws[i + 1])) && !/^\d/.test(ws[i + 1])) name.push(w);
    else if (name.length && isNoun) name.push(w);
    else break;
    if (isNoun) noun = name.length - 1;
    if (ends(ws[i])) break;
  }
  if (allCaps && noun < 0) return null;
  if (!name.length) return null;
  if (name.length === 1 && noun < 0 && SENTENCE_START.test(name[0])) return null;
  // the next word must start the rest of the sentence (lowercase, a number, or the end of the sentence)
  const nextRaw = ws[name.length];
  if (noun < 0 && nextRaw && !/^[\p{Ll}\d%€$£]/u.test(nextRaw) && !ends(ws[name.length - 1])) return null;
  let keep = name.slice();
  const last = keep[keep.length - 1];
  if (keep.length >= 3 && noun === keep.length - 1 && /^\p{Ll}/u.test(last)) keep = keep.slice(0, -1); // "Maple and Rye bakery" → "Maple and Rye"
  while (keep.length > 1 && NAME_JOIN.has(keep[keep.length - 1].toLowerCase())) keep.pop();
  // what follows the name (from the original text, so punctuation and emoji survive)
  let pos = 0; for (let i = 0; i < name.length; i++) pos = raw.indexOf(ws[i], pos) + ws[i].length;
  const dropped = name.slice(keep.length).join(' ');
  const nextW = ws[name.length];
  const carryOn = dropped && !ends(ws[name.length - 1]) && nextW && /^\p{Ll}/u.test(nextW) && !isConnector(nextW);
  return { name: keep.join(' '), after: (carryOn ? `${dropped} ` : '') + raw.slice(pos), noun: noun >= 0 };
}

/**
 * The end-card button: short enough for a phone. "Visit us on Main St this Saturday" → button "Visit us Saturday",
 * small line "Main St". Short calls to action stay as they are.
 */
export function buttonOf(cta, max = 22) {
  const c = clean(cta);
  if (!c || c.length <= max) return { button: c, sub: '' };
  let button = c, sub = '';
  const place = ub(/\s+\b(?:on|at|in|near|u|na)\s+((?:[\p{Lu}\d][\p{L}\d'’.-]*\s*){1,4})/u).exec(button);
  if (place) { sub = stripEnd(place[1]); button = clean(button.slice(0, place.index) + ' ' + button.slice(place.index + place[0].length)); }
  button = button.replace(ub(/\b(this|next|on)\s+(?=(mon|tues|wednes|thurs|fri|satur|sun)day\b)/iu), '');
  const time = /\s+(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|h)?\s*[–-]\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm|h)?|\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm))\s*$/iu.exec(button);
  if (time) { sub = clean([sub, time[1].replace(/\s*-\s*/, '–')].filter(Boolean).join(' · ')); button = button.slice(0, time.index); }
  button = clean(button);
  if (button.length > max + 6) { const ws = words(button); let b = ''; for (const w of ws) { if ((b + ' ' + w).trim().length > max) break; b = (b + ' ' + w).trim(); } while (words(b).length > 1 && isDangling(words(b).at(-1))) b = words(b).slice(0, -1).join(' '); sub = clean([clean(button.slice(b.length)), sub].filter(Boolean).join(' · ')); button = b; }
  return { button: stripCta(button), sub: stripEnd(sub) };
}

/** Pull brand / headline / points / numbers / call to action / kind of business out of a freeform brief. Explicit fields win. */
export function parseBrief({ brief = '', brand = '', offer = '', cta = '', brandUrl = '' } = {}) {
  const text = decodeEntities(String(brief || '')).replace(/\r/g, '').trim();
  let brandOut = clean(decodeEntities(brand)), offerOut = clean(decodeEntities(offer)), ctaOut = clean(decodeEntities(cta));
  let lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const kept = [];
  for (const line of lines) {
    const bm = /^brand\s*[:–-]\s*(.+)$/i.exec(line), om = /^(offer|promo|deal|headline)\s*[:–-]\s*(.+)$/i.exec(line), cm = /^(cta|call to action|action)\s*[:–-]\s*(.+)$/i.exec(line);
    if (bm) { if (!brandOut) brandOut = clean(bm[1]); continue; }
    if (om) { if (!offerOut) offerOut = clean(om[2]); continue; }
    if (cm) { if (!ctaOut) ctaOut = clean(cm[2]); continue; }
    kept.push(line);
  }
  lines = kept;
  const body = lines.join('\n');
  const url = String(brandUrl || '').trim();

  // brand: a short first line (when there are several), a standalone name sentence ("Iron Current gym."),
  // a business name ("Leo's Barbershop", "Maple and Rye", "Frizerski salon Luna"), a leading name ("Taskly saves…"), the URL host
  let rest = lines.slice();
  if (!brandOut && lines.length > 1 && words(lines[0]).length <= 6 && lines[0].length <= 48 && !CTA_VERB.test(' ' + lines[0]) && !/\d/.test(lines[0])) {
    brandOut = stripEnd(lines[0]); rest = lines.slice(1);
  }
  if (!brandOut && rest.length) {
    const found = nameAtStart(rest[0]);
    if (found) {
      brandOut = found.name;
      let after = clean(found.after).replace(/^(?:[\s,:—،]|[–-](?![0-9\u0660-\u0669]))+/u, '');
      // "Maple and Rye is a tiny bakery…" → "A tiny bakery…"; "Taskly saves teams…" keeps the whole sentence
      const isA = /^(is|are)\s+(a|an|the|your|our)\s+/iu.exec(after);
      if (isA) after = after.slice(/^(is|are)\s+/iu.exec(after)[0].length);
      const keepWhole = !isA && /^(has|have|helps?|makes?|saves?|gives?|brings?|turns?|lets?|keeps?|does|gets?|now|just|finally)\b|^\p{Ll}+s\b/u.test(after) && !found.noun && !/^\p{Ll}+s\s+(fresh|new|hot|all|every|weekend)\b/u.test(after);
      if (!keepWhole) rest[0] = after;
    }
  }
  // scripts without capitals (Arabic, Hebrew, Japanese, Korean, Thai…): a short first chunk with a trade word in it is the
  // name ("مقهى النخيل، …", "さくらカフェ 週末…")
  if (!brandOut && rest.length && !/[\p{Lu}\p{Ll}]/u.test(rest[0].replace(/[A-Za-z0-9]+/g, '').slice(0, 12)) && /\p{L}/u.test(rest[0])) {
    const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u.test(rest[0]); // no spaces between words: the name ends at the first space
    const chunk = (cjk ? /^[^\s、，。！？,.!?]+/u : /^[^،,.!?؟;؛\n]+/u).exec(rest[0].trim());
    if (chunk && words(chunk[0]).length <= 4 && chunk[0].length < rest[0].trim().length && BUSINESS_NOUN.test(chunk[0])) {
      brandOut = stripEnd(chunk[0]); rest[0] = clean(rest[0].trim().slice(chunk[0].length)).replace(/^[\s,:–—\-،、，]+/u, '');
    }
  }
  // a standalone Title Case clause elsewhere ("Acme Analytics.") is a name
  if (!brandOut) {
    const all = splitClauses(lines.join('\n'));
    const tc = all.find((c) => { const ws = words(c); return ws.length >= 1 && ws.length <= 4 && ws.every((w) => /^[\p{Lu}\d&][\p{L}\d'’&.-]*$/u.test(w)) && !CTA_VERB.test(' ' + c) && !/\d/.test(c) && (ws.length > 1 || c.length > 3); });
    if (tc && all.length > 1) { brandOut = tc; rest = rest.map((l) => clean(l.replace(tc, ' ')).replace(/^[.,;:\s]+|[,;:\s]+$/g, '')).filter(Boolean); }
  }
  if (!brandOut && url) {
    try { brandOut = new URL(/^https?:/.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase()); } catch { /* not a URL */ }
  }
  brandOut = stripEnd(brandOut).slice(0, 48);

  // clauses, then the call to action (searched from the end: "… book today")
  let clauses = splitClauses(rest.join('\n')).filter((c) => norm(c) && norm(c) !== norm(brandOut));
  if (!ctaOut) {
    for (let i = clauses.length - 1; i >= 0 && !ctaOut; i--) {
      const c = clauses[i];
      let best = null;
      for (const m of c.matchAll(new RegExp(CTA_VERB.source, 'giu'))) {
        const at = m.index + m[1].length;
        if (NOT_BEFORE_VERB.test(c.slice(0, at)) && at > 0) continue;
        best = at;
        if (at === 0) break;
      }
      if (best == null) continue;
      const lead = CTA_LEAD.exec(c.slice(0, best));
      if (lead) best = lead.index + (lead[0].length - lead[0].trimStart().length);
      if (best > 0 && /[¡¿]/.test(c[best - 1])) best -= 1;
      const phrase = stripCta(c.slice(best));
      if (words(phrase).length > 9) continue;
      ctaOut = /^[¡¿]/.test(phrase) ? phrase[0] + cap1(phrase.slice(1)) : cap1(phrase);
      if (/^¡/.test(ctaOut) && !/!$/.test(ctaOut)) ctaOut += '!'; // "¡Ven hoy!" keeps its closing mark
      if (/^¿/.test(ctaOut) && !/\?$/.test(ctaOut)) ctaOut += '?';
      const head = stripEnd(c.slice(0, best));
      clauses[i] = head; // what came before the verb stays a line of its own
    }
  }
  clauses = clauses.map((c) => tidyClause(stripEnd(c))).filter((c) => c && norm(c) !== norm(ctaOut));
  // an emoji with no words of its own rides with the call to action (or the last line)
  const lone = clauses.filter((c) => !hasLetters(c) && EMOJI.test(c));
  if (lone.length) { clauses = clauses.filter((c) => !lone.includes(c)); if (ctaOut) ctaOut = `${ctaOut} ${lone.join(' ')}`; else if (clauses.length) clauses[clauses.length - 1] += ` ${lone.join(' ')}`; }

  const numbers = extractNumbers(body);
  const formula = extractFormula(body);
  const numberOnly = (c) => numbers.some((n) => norm(n.clause) === norm(c));

  // headline + offer + points, with no sentence used twice
  const used = new Set([norm(brandOut), norm(ctaOut)].filter(Boolean));
  const take = (s) => { const k = norm(s); if (!k || used.has(k)) return ''; used.add(k); return cap1(s); }; // emoji-only bits were merged above
  if (!offerOut) offerOut = clauses.find((c) => OFFER_WORDS.test(c)) || '';
  // a bare address ("12 Harbor Lane") or a place fragment ("On Oak Street") is a weak hook: kept as a line, not the headline
  const placeOnly = (c) => /^\d+[a-z]?\s+[\p{Lu}]/u.test(c) && words(c).length <= 5 || (isConnector(words(c)[0]) && words(c).length <= 4 && /[\p{Lu}]/u.test(c.slice(1)));
  const headlineSrc = offerOut || clauses.find((c) => !numberOnly(c) && c !== formula && !placeOnly(c)) || clauses.find((c) => numbers.some((n) => norm(n.clause) === norm(c))) || clauses.find((c) => !numberOnly(c) && c !== formula) || '';
  const headline = take(headlineSrc);
  const points = [];
  for (const c of clauses) {
    if ((numberOnly(c) && norm(c) !== norm(headlineSrc)) || c === formula) continue;
    const t = take(c);
    if (t) points.push(t);
  }

  const lower = `${brandOut}\n${body}`.toLowerCase();
  const categories = Object.entries(CATEGORY_WORDS).map(([k, re]) => [k, (lower.match(new RegExp(re.source, 'giu')) || []).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  let category = categories[0]?.[0] || 'general';
  if (category === 'saas' && categories.some(([k]) => LOCAL.has(k)) && !/\b(app|software|saas|platform|dashboard|api)\b/i.test(lower)) category = categories.find(([k]) => LOCAL.has(k))[0];
  const tones = Object.entries(TONE_WORDS).filter(([, re]) => re.test(lower)).map(([k]) => k);
  // the place stops at sentence punctuation: "in Velika Plana. Book today" → "Velika Plana"
  const loc = ub(/\b(?:in|at|near|on|en|em|no|na|à|au|im|w|we|u|в|во|у|σε|στο|στη|στην)\s+((?:[\p{Lu}][\p{L}'’-]+)(?:[ \t]+[\p{Lu}][\p{L}'’-]+){0,2})(?![\p{L}'’-])/u).exec(body);
  const location = loc && !DAY_RE.test(loc[1]) && !/^(Main)$/i.test(loc[1]) && !/\b(St|Street|Ave|Avenue|Road|Rd|Blvd|Lane|Ln|Sq|Square|Mall|Center|Centre|Floor|Unit)\.?$/i.test(loc[1]) && norm(loc[1]) !== norm(brandOut) ? loc[1].replace(/[.,]$/, '') : '';
  // figures said on their own ("2,400 users") don't become points, but a caption can still use them
  const facts = numbers.filter((n) => !norm(headline).includes(norm(n.text)) && !points.some((x) => norm(x).includes(norm(n.text)))).map((n) => cap1(n.clause));

  // a button only when the owner wrote one. Nothing is invented ("Visit Maple and Rye").
  const ctaAuto = false;
  const isLocal = LOCAL.has(category) || /\b(local|neighbou?rhood|near you|walk-?ins?)\b/i.test(lower);
  const btn = buttonOf(ctaOut);
  return {
    brand: brandOut,
    headline: headline || '',
    ctaAuto,
    ctaButton: btn.button,
    ctaSub: btn.sub,
    offer: offerOut ? cap1(offerOut) : (headline || ''),
    cta: ctaOut,
    points: points.slice(0, 6),
    numbers: numbers.slice(0, 6),
    facts: [...new Set(facts)].slice(0, 3),
    // the figure sentences, for looks that have no number scene (whiteboard, planets, desk, story)
    numberLines: [...new Set(numbers.filter((n) => norm(n.clause) !== norm(headline) && !(norm(headline) && norm(n.clause).includes(norm(headline)))).map((n) => cap1(n.clause)))].slice(0, 3),
    formula,
    category,
    categories: categories.map(([k]) => k),
    local: isLocal,
    tones,
    location,
    lang: LX.detectLang(text),
    rtl: LX.isRtl(text),
    brandUrl: url,
    brief: text,
    // older field names, kept for callers
    title: brandOut || headline,
    subtitle: headline,
    bullets: points.slice(0, 6),
  };
}

// ---------- which looks can this brief fill, and how well do they fit ----------
function seriesOf(parsed) {
  const ns = parsed.numbers;
  if (ns.length < 2) return null;
  const key = (n) => `${n.prefix}|${n.unit}`;
  const groups = {};
  for (const n of ns) (groups[key(n)] ||= []).push(n);
  const best = Object.values(groups).sort((a, b) => b.length - a.length)[0];
  if (best.length < 2) return null;
  // each figure needs a label of its own: a year or the word just before it
  const series = best.map((n) => {
    // the year closest to this figure ("$2.0M in 2024"), else the word just before it
    const years = [...n.clause.matchAll(/\b(19|20)\d{2}\b/g)].map((y) => ({ y: y[0], d: Math.abs(y.index - (n.at + n.text.length)) }));
    const y = years.sort((a, b) => a.d - b.d)[0];
    const pre = clean(n.clause.slice(0, n.at)).split(/\s+/).filter((w) => /\p{L}/u.test(w)).slice(-2).join(' ');
    return { label: clipText(y && y.d < 14 ? y.y : pre || n.text, 14), value: n.value };
  });
  if (new Set(series.map((s) => s.label)).size < series.length) return null;
  return { series, prefix: best[0].prefix, suffix: best[0].suffix.trim() === best[0].unit ? '' : best[0].suffix.replace(/\s.*$/, ''), unit: best[0].unit, decimals: Math.max(...best.map((n) => n.decimals)) };
}

/** Why a look can't be made from this brief (null = it can). */
export function lookBlocker(id, parsed, { hasLogo = false, hasScreenshot = false, format = '16:9' } = {}) {
  const meta = LOOKS.find((l) => l.id === id);
  if (!meta) return 'unknown look';
  if (format !== '16:9' && !meta.clip) return 'widescreen only';
  const ideas = allPoints(parsed).length + (parsed.headline ? 1 : 0);
  switch (meta.needs) {
    case 'formula': if (!parsed.formula) return 'needs a formula in the brief'; break;
    case 'series': if (!seriesOf(parsed)) return 'needs two or more figures of the same kind'; break;
    case 'image': if (!hasScreenshot) return 'needs a photo (a logo is never used as the big picture)'; break;
    case 'screenshot': if (!hasScreenshot) return 'needs a screenshot'; break;
    case 'story': if (!(parsed.categories.includes('story') || parsed.tones.includes('playful')) || ideas < 2) return 'needs a personal or funny story'; break;
    default: break;
  }
  if (id === 'kurzgesagt' && allPoints(parsed).length < 2) return 'needs two or more points';
  if (id === 'keynote-ui' && !parsed.points.length && !parsed.numbers.length && !hasScreenshot) return 'needs a point, a number or a screenshot';
  if ((id === 'whiteboard' || id === 'keynote-ui' || id === 'kinetic-type' || POSTER_LOOKS.has(id)) && !ideas && !parsed.cta && !parsed.brand) return 'needs some words';
  return null;
}

// Local shops (café, barber, gym, shop, realty, bakery, salon) lean on the warm poster looks; kinetic type is
// capped for them so it is one option among several, not the default winner.
const FIT = {
  beauty: { 'shop-poster': 6, 'market-stamp': 5.6, 'menu-board': 4.6, 'kinetic-type': 4.2, 'keynote-ui': 3, whiteboard: 0.6, 'vox-collage': 3.5, kurzgesagt: 0.5 },
  food: { 'menu-board': 5.6, 'shop-poster': 5.6, 'market-stamp': 5.6, 'kinetic-type': 4.2, 'keynote-ui': 2.8, whiteboard: 0.8, 'vox-collage': 3.5, kurzgesagt: 0.5 },
  fitness: { 'shop-poster': 6, 'market-stamp': 5.3, 'menu-board': 4.8, 'kinetic-type': 4.4, 'keynote-ui': 3.4, whiteboard: 0.6, 'vox-collage': 2.5, kurzgesagt: 0.8 },
  realestate: { 'shop-poster': 6.4, 'market-stamp': 5.8, 'keynote-ui': 4.8, 'kinetic-type': 4, 'menu-board': 3.5, 'vox-collage': 3.5, whiteboard: 0.4, 'finance-chart': 3 },
  retail: { 'shop-poster': 6, 'market-stamp': 5.6, 'menu-board': 4.6, 'kinetic-type': 4.4, 'keynote-ui': 3.2, 'vox-collage': 3.2, whiteboard: 0.5 },
  saas: { 'keynote-ui': 6, 'ui-space': 6, 'object-3d': 4, 'kinetic-type': 3, whiteboard: 2.5, kurzgesagt: 2.5, 'vox-collage': 2, 'finance-chart': 3, storytime: 3, 'shop-poster': 1 },
  product: { 'keynote-ui': 5, 'object-3d': 5, 'ui-space': 4, 'kinetic-type': 4, 'vox-collage': 2, 'shop-poster': 3.5, 'market-stamp': 2.5 },
  event: { 'kinetic-type': 5.5, 'shop-poster': 5.5, 'keynote-ui': 4, 'menu-board': 3.5, 'vox-collage': 2, whiteboard: 1.5 },
  edu: { whiteboard: 6, kurzgesagt: 6, 'math-3b1b': 6, 'kinetic-type': 2, 'keynote-ui': 2 },
  finance: { 'finance-chart': 7, 'keynote-ui': 4, 'math-3b1b': 3, 'kinetic-type': 2, whiteboard: 2 },
  story: { storytime: 7, 'kinetic-type': 3, whiteboard: 3, 'vox-collage': 2 },
  general: { 'kinetic-type': 4, 'keynote-ui': 4, whiteboard: 3, kurzgesagt: 2, 'vox-collage': 2, 'ui-space': 3, 'object-3d': 3, 'shop-poster': 2.5 },
};
const TONE_FIT = {
  bold: { 'kinetic-type': 1, 'shop-poster': 0.6 }, premium: { 'keynote-ui': 2, 'object-3d': 2, 'ui-space': 1 }, playful: { storytime: 2, 'kinetic-type': 1, whiteboard: 1 },
  calm: { kurzgesagt: 1.5, whiteboard: 1, 'menu-board': 0.6 }, fresh: { 'keynote-ui': 0.3, 'market-stamp': 0.3 }, friendly: { 'menu-board': 0.5, 'market-stamp': 0.5 },
};

function scoreLook(id, parsed, ctx) {
  let s = FIT[parsed.category]?.[id] ?? FIT.general[id] ?? 1;
  for (const k of parsed.categories.slice(1, 3)) s += (LOCAL.has(parsed.category) && id === 'kinetic-type' ? 0 : 0.4) * (FIT[k]?.[id] || 0);
  if (LOCAL.has(parsed.category) && id === 'kinetic-type') s = Math.min(s, 3.8); // posters stay the usual pick; kinetic is the change of pace
  if (LOCAL.has(parsed.category) && POSTER_LOOKS.has(id)) s -= POSTER_DAMP;
  if (LOCAL.has(parsed.category) && (id === 'whiteboard' || id === 'kurzgesagt' || id === 'math-3b1b')) s -= 12; // a half-empty whiteboard is a poor shop ad; still pickable by hand
  for (const t of parsed.tones) s += TONE_FIT[t]?.[id] || 0;
  if (ctx.hasScreenshot && LOCAL.has(parsed.category) && POSTER_LOOKS.has(id)) s += 1.2; // a shop photo belongs on the poster, not a product launch
  if (ctx.hasScreenshot && ['keynote-ui', 'ui-space', 'vox-collage', 'object-3d'].includes(id)) s += LOCAL.has(parsed.category) ? (id === 'vox-collage' ? 0.3 : 0) : 1.5;
  if (parsed.formula && id === 'math-3b1b') s += 4;
  if (seriesOf(parsed) && id === 'finance-chart') s += 3;
  if (parsed.numbers.length && id === 'keynote-ui') s += 1;
  return Math.max(0.2, s);
}

/** Rank the looks this brief can fill, then a seeded choice weighted toward the best fit. */
export function pickLook(parsed, { look = 'auto', seed, hasLogo = false, hasScreenshot = false, format = '16:9', avoid = [] } = {}) {
  const ctx = { hasLogo, hasScreenshot, format };
  const forced = look && look !== 'auto' ? String(look).trim() : null;
  if (forced) {
    const hit = LOOKS.find((l) => l.id === forced);
    if (!hit) throw new Error(`unknown look "${forced}" — try: ${LOOK_IDS.join(', ')}`);
    const why = lookBlocker(hit.id, parsed, ctx);
    if (why) throw new Error(`${hit.label} can't be made from this brief: it ${why}`);
    return { look: hit, reason: 'picked by you', ranked: [hit.id] };
  }
  const rand = mulberry32(seedInt(seed) ^ 0x9e3779b9);
  let ok = LOOKS.filter((l) => !lookBlocker(l.id, parsed, ctx));
  // a shop ad never lands on a whiteboard, a science explainer, or a software-launch look by chance (still pickable by hand)
  const notForShops = ['whiteboard', 'kurzgesagt', 'math-3b1b', 'keynote-ui', 'ui-space', 'object-3d'];
  if (LOCAL.has(parsed.category) && ok.some((l) => !notForShops.includes(l.id))) ok = ok.filter((l) => !notForShops.includes(l.id));
  const scored = ok.map((l) => ({ look: l, score: scoreLook(l.id, parsed, ctx) })).sort((a, b) => b.score - a.score || a.look.id.localeCompare(b.look.id));
  if (!scored.length) throw new Error('write a few words about what you want to promote');
  const best = scored[0].score;
  // weights fall off fast below the best fit; looks far below it are left out
  let pool = scored.filter((x) => x.score >= best - 5 && !avoid.includes(x.look.id));
  if (!pool.length) pool = scored.filter((x) => x.score >= best - 4);
  const items = pool.map((x) => ({ ...x, w: Math.pow(1.6, x.score - best) }));
  const chosen = weighted(rand, items);
  const share = Math.round((chosen.w / items.reduce((a, x) => a + x.w, 0)) * 100);
  return {
    look: chosen.look,
    reason: `fits a ${parsed.category === 'general' ? 'general' : parsed.category} brief (score ${chosen.score.toFixed(1)}, ${share}% chance this seed)`,
    ranked: scored.map((x) => `${x.look.id}:${x.score.toFixed(1)}`),
    skipped: LOOKS.filter((l) => lookBlocker(l.id, parsed, ctx)).map((l) => `${l.id}: ${lookBlocker(l.id, parsed, ctx)}`),
  };
}

// ---------- scene writers (one per look); every scene is a real line from the brief ----------
/** Split a line into a big main phrase and a smaller follow-up (for page-style looks). Word-based: nothing is repeated or lost. */
function mainSub(s, max = 24) {
  s = clean(s);
  if (s.length <= max) return { main: s, sub: '' };
  for (const sep of [' — ', ' – ', ': ', ', ', ' - ']) {
    const i = s.indexOf(sep);
    if (i > 3 && i <= max + 4) return { main: stripEnd(s.slice(0, i)), sub: cap1(stripEnd(s.slice(i + sep.length))) };
  }
  const ws = words(s);
  if (s.length <= max * 1.5 && ws.length <= 7) return { main: s, sub: '' }; // two big lines read better than a cut phrase
  // before a linking word: "Fresh fades" / "in Velika Plana" (the follow-up line sits under the main one, same card)
  let best = -1;
  for (let k = 1; k < ws.length; k++) if (isConnector(ws[k]) && !isDangling(ws[k - 1]) && ws.slice(0, k).join(' ').length <= max && ws.slice(0, k).join(' ').length > 3) best = k;
  let k = best;
  if (k < 0) { k = 0; while (k < ws.length && ws.slice(0, k + 1).join(' ').length <= max) k++; while (k > 1 && isDangling(ws[k - 1])) k--; }
  k = Math.max(1, k);
  return { main: stripEnd(ws.slice(0, k).join(' ')), sub: stripEnd(ws.slice(k).join(' ')) };
}
/**
 * Two beats (two cards) from one headline — only where the sentence itself breaks (a dash, colon or comma) and only
 * when neither half is a fragment: the second card never starts with "in / for / after / u / za…", the first never ends
 * on one. Otherwise the headline stays one card: [whole, ''].
 */
export function splitBeats(s) {
  s = clean(s);
  const ws = words(s);
  if (ws.length < 3) return [stripEnd(s), ''];
  for (const sep of [' — ', ' – ', ': ', ', ', '; ', ' - ', ' + ']) {
    const i = s.indexOf(sep);
    if (i <= 0) continue;
    const a = stripEnd(s.slice(0, i)), b = stripEnd(s.slice(i + sep.length));
    const aw = words(a), bw = words(b);
    if (!aw.length || !bw.length || !hasLetters(a) && !/\d/.test(a)) continue;
    if (isConnector(bw[0]) || isDangling(aw[aw.length - 1])) continue;
    if (bw.length === 1 && !/\d/.test(b) && b.length < 4) continue;
    return [a, b];
  }
  return [stripEnd(s), ''];
}
const allPoints = (p) => [...p.points, ...(p.numberLines || []).filter((x) => !p.points.some((y) => norm(y) === norm(x)))].slice(0, 6);
const keyWordOf = (s) => (words(s).filter((w) => w.length > 3).sort((a, b) => b.length - a.length)[0] || words(s)[0] || '').replace(/[^\p{L}\p{N}'’-]/gu, '');
const ctaVerbWord = (cta) => words(buttonOf(cta).button)[0]?.replace(/[^\p{L}]/gu, '') || '';
const seconds = (s, base = 1.5, perChar = 0.035, max = 3.2) => Math.min(max, base + clean(s).length * perChar);
const numCue = (n) => ({ value: n.value, prefix: n.prefix, suffix: n.suffix, decimals: n.decimals, ...(n.label ? { label: n.label } : {}) });
const numCaption = (n, p) => (n.caption && norm(n.caption) !== norm(p.headline) ? clipText(n.caption, 48) : '');
/** A figure that already is the headline ("4 bed", "20% off") is not shown again as a chart. */
const freshNumbers = (p) => p.numbers.filter((n) => { const h = norm(p.headline || ''); return !h || (!h.includes(norm(n.text)) && !h.includes(norm(n.clause))); });

function kineticSpec(p, rand, plan, assets = {}) {
  const cues = []; let t = 0;
  const tempo = 0.85 + rand() * 0.3; // beat timing varies film to film
  const page = (kind, text, sub = '', data = {}, hold) => {
    if (!clean(text)) return;
    const cue = { at: +t.toFixed(2), kind, text: clipText(text, 40) };
    if (sub) cue.sub = clipText(sub, 60);
    if (Object.keys(data).length) cue.data = data;
    cues.push(cue); t += (hold ?? seconds(text + sub, 1.45, 0.03)) * tempo;
  };
  const pts = p.points.slice(0, 4), nums = freshNumbers(p).slice(0, 2);
  const listy = pts.length >= 2;
  const ptPages = () => pts.forEach((s, i) => { const ms = mainSub(s); page('point', ms.main, ms.sub, listy ? { label: String(i + 1).padStart(2, '0'), ...(ms.sub ? { key: keyWordOf(ms.sub) } : {}) } : {}); });
  const numPages = () => nums.forEach((n) => { t += 0.7; const cap = numCaption(n, p); cues.push({ at: +t.toFixed(2), kind: 'number', ...(cap ? { text: cap } : {}), data: numCue(n) }); t += 1.5; });
  // local shops: the deal is the big word ("2 for 1"), the rest rides under it
  const head = p.local ? hookOf(p.headline || p.offer || '') : mainSub(p.headline || p.offer || '');
  const brand = p.brand;
  if (plan === 'kinetic-offer-first' && (p.headline || p.offer)) {
    const h = hookOf(p.headline || p.offer);
    page('title', h.main, h.sub, {}, 1.35);
    if (brand && norm(brand) !== norm(h.main)) page('title', brand, p.location && p.location.length <= 28 ? p.location : '', {}, 1.25);
    ptPages(); numPages();
  } else if (plan === 'kinetic-split' && head.main) {
    // two cards only when the second can stand alone: "2x1" + "en croissants…" stays one card (main and its line under it)
    const own = head.sub && !isConnector(words(head.sub)[0]);
    const [a, b] = p.local && head.deal && own ? [head.main, head.sub] : p.local && head.deal ? [head.main, ''] : splitBeats(p.headline);
    const under = p.local && head.deal && !own ? head.sub : '';
    page('title', a, under, {}, under ? 1.45 : 1.2);
    if (b) page('title', b, '', {}, 1.3);
    if (brand) page('title', brand, '', {});
    ptPages(); numPages();
  } else if (plan === 'kinetic-number-hook' && nums.length) {
    numPages();
    page('title', brand || head.main, brand ? p.headline : head.sub);
    ptPages();
  } else if (plan === 'kinetic-brand-first') {
    if (brand) { page('title', brand, '', {}, 1.5); if (head.main) page('title', head.main, head.sub); }
    else page('title', head.main, head.sub);
    ptPages(); numPages();
  } else { // headline-first
    if (head.main) page('title', head.main, head.sub || brand, brand && !head.sub ? {} : {});
    else if (brand) page('title', brand);
    ptPages(); numPages();
    if (brand && head.main) page('title', brand, '');
  }
  if (p.cta) {
    const btn = buttonOf(p.cta);
    page('title', btn.button, btn.sub || (plan === 'kinetic-brand-first' || !brand ? '' : brand), {}, 1.7);
    const w = ctaVerbWord(p.cta);
    if (w) { cues.push({ at: +(t - 1.0).toFixed(2), kind: 'highlight', data: { word: w } }); }
  }
  const photo = assets.screenshotRel;
  const data = { palette: pick(rand, KINETIC_PALETTES), bg: pick(rand, ['dots', 'grid', 'stripes', 'grain']), transition: pick(rand, ['wipe', 'push', 'lift', 'zoom']),
    ...(photo ? { image: photo, imageAlpha: +(0.62 + rand() * 0.14).toFixed(2) } : {}) };
  return { grammar: 'y5_kinetic_type', duration: +(t + 0.6).toFixed(2), pace: 1, fps: 30, data, cues };
}

const POSTER_PAL = {
  riso: [{ bg: '#F3EBDD', ink: '#1B1B1B', accent: '#FF4B3E', accent2: '#2D5BFF' }, { bg: '#FFF4E0', ink: '#2B1B4A', accent: '#FF7A00', accent2: '#00A88F' },
    { bg: '#EAF2E3', ink: '#14342B', accent: '#F2C230', accent2: '#E4572E' }, { bg: '#FCE8EC', ink: '#3A1027', accent: '#E0245E', accent2: '#3D5AFE' }, { bg: '#E8F0FA', ink: '#0E2A47', accent: '#FFB000', accent2: '#FF5D8F' }],
  chalk: [{ bg: '#1E2A25', ink: '#F4F1E8', accent: '#FFD45C', accent2: '#FF9DB8' }, { bg: '#24272B', ink: '#F1EEE6', accent: '#7FD8BE', accent2: '#FFB347' }, { bg: '#1C2333', ink: '#F3F0E9', accent: '#FFCF56', accent2: '#9AD1FF' }],
  kraft: [{ bg: '#C9A57A', ink: '#203063', accent: '#B3261E' }, { bg: '#D2B48C', ink: '#2E3B1F', accent: '#8C1C13' }, { bg: '#BF9B6F', ink: '#3B1F2B', accent: '#1F4E79' }],
};
/** The hook for the opening sticker: a real offer ("2 for 1", "20% off", "First week free") goes big, with the rest under it.
 *  A single word with no number ("popust", "gratis") stays where the owner wrote it. */
export function hookOf(s) {
  s = clean(s);
  const m = NUMDEAL_RE.exec(s) || LX.PRICE_RE.exec(s) || WORDDEAL_RE.exec(s);
  const reorder = !!(m && (/[0-9\u0660-\u0669]/.test(m[0]) || words(m[0]).length >= 2));
  const restOf = (m) => { const r = stripEnd(s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s*[—–:;,،]\s*/gu, ' ').replace(/\s{2,}/g, ' ').trim(); return words(r).every(isConnector) ? '' : r; };
  if (reorder && stripEnd(m[0]).length >= stripEnd(s).length - 3) return { main: stripEnd(s), sub: '', deal: true }; // the line is the deal itself
  if (reorder && m[0].length <= 22) {
    const rest = restOf(m), main = stripEnd(m[0]);
    // a short line stays whole when the deal opens it: "£2 pints", "%20 indirim cuma"
    if (m.index === 0 && words(rest).length === 1 && [...s].length <= 18) return { main: stripEnd(s), sub: '', deal: true };
    return { main: cap1(main), sub: words(rest).length <= 6 ? stripEnd(rest) : clipText(rest, 30), deal: true };
  }
  // a long first word ("Četvrtak popust") stays in order, split onto two lines so a sticker does not break it after one letter
  if (!reorder && words(s).length >= 2 && words(s).some((w) => [...w].length >= 8) && [...s].length <= 36) {
    const ws = words(s);
    return { main: ws[0], sub: ws.slice(1).join(' ') };
  }
  if ([...s].length <= 18) return { main: s, sub: '' };
  return mainSub(s, 16);
}
function posterSpec(p, rand, plan, assets, style) {
  const cues = []; let t = 0;
  const beat = 0.8 + rand() * 0.35;
  const hook = hookOf(p.headline || p.offer || p.brand);
  const rest = allPoints(p).filter((x) => norm(x) !== norm(p.headline));
  let offerSub = hook.sub;
  if (!offerSub && rest.length && rest[0].length <= 26 && plan !== 'poster-list') offerSub = rest.shift(); // "2 for 1" / "Weekend flat white"
  cues.push({ at: 0, kind: 'offer', text: clipText(hook.main, 30), // the sticker wraps to three lines; "Pierwszy tydzień gratis" keeps its "gratis"
    ...(offerSub ? { sub: clipText(offerSub, 30) } : {}) });
  t = 1.05 + rand() * 0.35;
  if (p.brand && norm(p.brand) !== norm(hook.main)) { cues.push({ at: +t.toFixed(2), kind: 'title', text: clipText(p.brand, 34) }); t += 0.95 * beat + 0.25; }
  for (const x of rest.slice(0, plan === 'poster-tight' ? 1 : 3)) { cues.push({ at: +t.toFixed(2), kind: 'point', text: clipText(x, 46) }); t += 0.75 * beat; }
  if (p.cta) { const b = buttonOf(p.cta); t += 0.25; cues.push({ at: +t.toFixed(2), kind: 'cta', text: b.button, ...(b.sub ? { sub: b.sub } : {}) }); t += 1.5 + rand() * 0.6; }
  else t += 1.2;
  const pal = pick(rand, POSTER_PAL[style]);
  const photo = assets.screenshotRel;
  const data = { style, palette: pal, accent: pal.accent, seed: Math.floor(rand() * 1e6), deco: style === 'riso' ? pick(rand, ['corner', 'rays', 'stripes']) : 'none',
    shape: pick(rand, ['burst', 'ring', 'stamp', 'ticket', 'tape']),
    align: rand() < 0.5 && !p.rtl ? 'left' : 'center', ...(p.rtl ? { rtl: true } : {}), eyebrow: clipText(p.location || '', 24).toUpperCase(),
    ...(photo ? { image: photo, photoMode: plan === 'poster-photo-bleed' || style === 'chalk' && rand() < 0.5 ? 'bleed' : 'print' } : {}) };
  if (!data.eyebrow) delete data.eyebrow;
  return { grammar: 'y6_poster', duration: +t.toFixed(2), pace: 1, fps: 30, data, cues };
}

const KEYNOTE_ICONS = [[/time|hour|fast|quick|minute|today|now|week/i, 'clock'], [/phone|mobile|app|ios|android/i, 'phone'], [/chart|grow|data|report|analytics|sales|revenue/i, 'chart'], [/code|api|dev|integrat/i, 'code'], [/secure|safe|privacy|lock/i, 'lock'], [/play|video|watch|music/i, 'play'], [/power|energy|boost|speed/i, 'bolt'], [/team|layer|stack|all in one/i, 'layers'], [/free|book|order|start|join|visit|call|get|try/i, 'check']];
const iconFor = (s) => (KEYNOTE_ICONS.find(([re]) => re.test(s)) || [])[1];

function keynoteSpec(p, rand, plan, assets) {
  const cues = []; let t = 0;
  const shot = assets.screenshotRel;
  const eyebrow = p.brand && p.headline ? p.brand.toUpperCase() : p.location ? p.location.toUpperCase() : '';
  // local shops open on the deal ("2 for 1" big, "Weekend flat white" under it)
  const title = p.headline ? (p.local ? hookOf(p.headline) : mainSub(p.headline, 30)) : { main: p.brand, sub: '' };
  const data = { eyebrow: clipText(eyebrow, 28), title: clipText(title.main || p.brand, 40), subtitle: clipText(title.sub || (p.headline ? '' : p.offer !== p.brand ? p.offer : ''), 70), accent: pick(rand, ACCENTS) };
  if (!data.eyebrow) delete data.eyebrow;
  if (!data.subtitle) delete data.subtitle;
  const titleCue = () => { cues.push({ at: +t.toFixed(2), kind: 'title' }); t += 2.1; };
  const pushCard = (s, last) => {
    const ms = clean(s).length <= 34 ? { main: clean(s), sub: '' } : mainSub(s, 30);
    const icon = s === p.cta ? 'check' : iconFor(s);
    cues.push({ at: +t.toFixed(2), kind: 'card', text: ms.main, ...(ms.sub ? { sub: ms.sub } : {}), ...(icon ? { data: { icon } } : {}) });
    t += last ? 2.0 : 0.85;
  };
  const cards = () => { const list = p.points.slice(0, 3); list.forEach((s, i) => pushCard(s, i === list.length - 1)); };
  const ctaCard = () => { if (p.cta && p.points.slice(0, 3).length < 3) pushCard(p.cta, true); };
  const numbers = () => freshNumbers(p).slice(0, 2).forEach((n) => { t += 0.9; const cap = numCaption(n, p); cues.push({ at: +t.toFixed(2), kind: 'number', ...(cap ? { text: cap } : {}), data: numCue(n) }); t += 1.6; });
  const shotCard = () => { if (!shot) return; cues.push({ at: +t.toFixed(2), kind: 'card', text: clipText(p.brand || title.main, 30), ...(p.headline && p.brand ? { sub: clipText(p.headline, 56) } : {}), image: shot }); t += 2.6; };
  if (plan === 'keynote-number-lead' && freshNumbers(p).length) { numbers(); titleCue(); cards(); shotCard(); ctaCard(); }
  else if (plan === 'keynote-shot-first' && shot) { titleCue(); shotCard(); numbers(); cards(); ctaCard(); }
  else { titleCue(); cards(); shotCard(); numbers(); ctaCard(); }
  return { grammar: 't2_keynote_ui', duration: +(t + 0.5).toFixed(2), pace: 1, fps: 30, data, cues };
}

function kurzSpec(p, rand, plan) {
  const cues = []; let t = 0;
  const nodes = allPoints(p).slice(0, 5).map((s) => (clean(s).length <= 24 ? clean(s) : clipText(mainSub(s, 22).main, 22)));
  const title = p.headline || p.brand;
  if (plan !== 'kurz-focus' || p.headline) { cues.push({ at: 0, kind: 'title', text: clipText(title, 44) }); t = 1.6; }
  nodes.forEach((s, i) => { cues.push({ at: +t.toFixed(2), kind: 'point', text: s, ...(rand() < 0.35 ? { data: { color: pick(rand, ['#32BAEE', '#FACC12', '#BE3A95', '#5CD0B3']) } } : {}) }); t += 1.1; });
  if (plan !== 'kurz-chain') { t += 0.3; cues.push({ at: +t.toFixed(2), kind: 'highlight', data: { index: plan === 'kurz-focus' ? 0 : nodes.length - 1 } }); t += 1.8; }
  else t += 1.2;
  return { grammar: 'y1_kurzgesagt', duration: +(t + 0.6).toFixed(2), pace: 1, fps: 30, data: { center: clipText(p.brand || keyWordOf(title), 18), flow: plan === 'kurz-chain', planet: pick(rand, PLANETS) }, cues };
}

const BOARD_ICONS = [[/hair|fade|cut|barber|beauty|salon|person|people|team|staff|customer|client/i, 'person'], [/time|hour|minute|today|week|open|clock/i, 'clock'], [/chat|talk|message|dm|call|review/i, 'chat'], [/idea|new|fresh|tip/i, 'bulb'], [/goal|target|aim|focus/i, 'target'], [/app|screen|online|web|site|dashboard/i, 'screen'], [/grow|sales|data|chart|number/i, 'chart'], [/doc|menu|list|paper|form/i, 'doc'], [/connect|network|together|community/i, 'network'], [/setting|tool|fix|repair|gear/i, 'gear'], [/free|book|done|yes|easy/i, 'check']];
const boardIcon = (s) => (BOARD_ICONS.find(([re]) => re.test(s)) || [])[1];

function whiteboardSpec(p, rand, plan, assets) {
  const cues = []; let t = 0;
  const title = p.brand || p.headline;
  const lines = [...(p.brand && p.headline ? [p.headline] : []), ...allPoints(p).slice(0, 4)];
  if (p.cta) lines.push(p.cta);
  cues.push({ at: 0, kind: 'title', text: clipText(title, 40) }); t = seconds(title, 1.2, 0.12, 3);
  let draws = 0;
  lines.forEach((s, i) => {
    cues.push({ at: +t.toFixed(2), kind: 'point', text: clipText(s, 54) }); t += seconds(s, 0.9, 0.065, 3.2);
    const icon = boardIcon(s);
    if (plan === 'board-doodle' && icon && draws < 3 && i < lines.length - (p.cta ? 1 : 0)) { cues.push({ at: +t.toFixed(2), kind: 'draw', data: { icon, ...(draws ? {} : { arrow: false }) } }); t += 1.2; draws++; }
  });
  if (assets.screenshotRel && plan !== 'board-list') { cues.push({ at: +t.toFixed(2), kind: 'image', image: assets.screenshotRel }); t += 1.8; }
  const target = plan === 'board-circle-title' ? { target: 'title' } : { index: lines.length - 1, ...(rand() < 0.5 ? { style: 'underline' } : {}) };
  cues.push({ at: +t.toFixed(2), kind: 'highlight', data: target }); t += 1.6;
  return { grammar: 'y3_whiteboard', duration: +(t + 0.8).toFixed(2), pace: 1, fps: 30, data: { accent: pick(rand, ['#EF7226', '#2563eb', '#16a34a', '#db2777']) }, cues };
}

function mathSpec(p, rand) {
  const cues = []; let t = 0;
  const title = p.headline || p.brand;
  cues.push({ at: 0, kind: 'title', text: clipText(title, 44) }); t = 1.4;
  cues.push({ at: +t.toFixed(2), kind: 'equation', text: p.formula }); t += 2.2;
  const pts = p.points.filter((s) => norm(s) !== norm(p.formula)).slice(0, 3);
  pts.forEach((s) => { cues.push({ at: +t.toFixed(2), kind: 'point', text: clipText(s, 56) }); t += seconds(s, 1.1, 0.04); });
  if (p.cta) { cues.push({ at: +t.toFixed(2), kind: 'point', text: clipText(p.cta, 56) }); t += 1.6; }
  const n = pts.length + (p.cta ? 1 : 0);
  if (n) { cues.push({ at: +t.toFixed(2), kind: 'highlight', data: { index: n - 1 } }); t += 1.4; }
  return { grammar: 't1_3b1b', duration: +(t + 0.6).toFixed(2), pace: 1, fps: 30, cues };
}

function financeSpec(p, rand, plan) {
  const s = seriesOf(p);
  const hi = s.series.reduce((m, x, i, a) => (x.value > a[m].value ? i : m), 0);
  const kind = plan === 'chart-line' && s.series.length >= 4 ? 'line' : 'bar';
  const fmt = (v) => `${s.prefix}${v.toLocaleString('en-US', { maximumFractionDigits: s.decimals })}${s.suffix}`;
  const data = {
    title: clean(p.headline).length <= 52 ? clean(p.headline) || p.brand : mainSub(p.headline, 44).main,
    unit: p.lang === 'en' ? `${UNIT_WORDS.test(s.unit || '') ? cap1(s.unit) : 'Figures'}${s.prefix || s.suffix ? ` (${s.prefix}${s.suffix})` : ''} · as written in the brief` : `${UNIT_WORDS.test(s.unit || '') ? cap1(s.unit) : ''}${s.prefix || s.suffix ? ` (${s.prefix}${s.suffix})` : ''}`.trim(),
    source: p.lang === 'en' ? `Figures: ${p.brand || 'from your brief'}` : (p.brand || ''),
    chart: kind, series: s.series, decimals: s.decimals, prefix: s.prefix, suffix: s.suffix,
    highlight: { index: hi, text: fmt(s.series[hi].value), sub: s.series[hi].label },
    colors: { main: pick(rand, ['#006ba2', '#3d6bff', '#0f766e']), dim: '#b8c4cc' },
  };
  const cues = [{ at: 0, kind: 'title' }, { at: 1.2, kind }, { at: 1.2 + 0.45 * s.series.length + 1.2, kind: 'highlight' }];
  return { grammar: 't3_finance_chart', duration: +(cues[2].at + 2.2).toFixed(2), pace: 1, fps: 30, data, cues };
}

function voxSpec(p, rand, plan, assets) {
  const cues = []; let t = 0;
  const imgs = [assets.screenshotRel].filter(Boolean); // the logo is never blown up into the hero picture
  // local shops with a deal open on the deal ("2 for 1"); the shop name and the rest become the pinned notes
  const hook = p.local && p.headline ? hookOf(p.headline) : null, dealFirst = !!(hook && hook.deal);
  const notes = dealFirst ? [...(p.brand ? [p.brand] : []), ...(hook.sub ? [hook.sub] : []), ...allPoints(p).filter((x) => norm(x) !== norm(p.headline)).slice(0, 1)]
    : [...(p.headline && p.brand ? [p.headline] : []), ...allPoints(p).slice(0, 2)];
  if (p.cta) notes.push(p.cta);
  const halftone = rand() < 0.4;
  const title = () => { cues.push({ at: +t.toFixed(2), kind: 'title', text: clipText(dealFirst ? hook.main : p.brand || p.headline, 34) }); t += 1.6; };
  const image = (src, label) => { cues.push({ at: +t.toFixed(2), kind: 'image', image: src, ...(label ? { text: clipText(label, 34) } : {}), ...(halftone && src === assets.screenshotRel ? { data: { halftone: true } } : {}) }); t += 1.7; };
  const note = (s) => { cues.push({ at: +t.toFixed(2), kind: 'point', text: clipText(s, 48) }); t += seconds(s, 1.1, 0.04); };
  if (plan === 'vox-notes-first') { title(); notes.slice(0, -1).forEach(note); imgs.forEach((src) => image(src)); if (notes.length) note(notes.at(-1)); }
  else { title(); if (imgs[0]) image(imgs[0]); notes.forEach(note); }
  return { grammar: 'y2_vox', duration: +(t + 0.8).toFixed(2), pace: 1, fps: 30, cues };
}

function storySpec(p, rand, plan) {
  const cues = []; let t = 0;
  const lines = [p.headline, ...allPoints(p)].filter(Boolean).slice(0, 4);
  const poses = ['talk', 'point', 'shrug', 'type'];
  lines.forEach((s, i) => { const short = words(s).length > 7 ? clipText(words(s).slice(0, 6).join(' '), 40) : ''; cues.push({ at: +t.toFixed(2), kind: 'point', text: clipText(s, 70), ...(short ? { sub: short } : {}), data: { pose: poses[(i + (rand() * 4 | 0)) % 4] } }); t += seconds(s, 1.4, 0.06, 3.4);
    if (plan === 'story-react' && i === 0) { cues.push({ at: +t.toFixed(2), kind: 'react' }); t += 1.0; } });
  const n = p.numbers[0];
  if (plan === 'story-insert' && p.categories.includes('saas')) { cues.push({ at: +t.toFixed(2), kind: 'insert', sub: clipText(p.brand || p.headline, 24), text: n ? n.text : clipText(keyWordOf(p.headline) || p.brand, 18), data: n ? { count: Math.round(n.value), unit: n.suffix.startsWith('%') ? '%' : '' } : {} }); t += 2.6; }
  cues.push({ at: +t.toFixed(2), kind: 'highlight', data: { mark: '!' } }); t += 1.2;
  if (p.cta) { cues.push({ at: +t.toFixed(2), kind: 'point', text: clipText(p.cta, 50), data: { pose: 'point' } }); t += 1.8; }
  return { grammar: 'y4_storytime', duration: +(t + 0.6).toFixed(2), pace: 1, fps: 30, cues };
}

function uiSpaceSets(p, rand, assets) {
  return { screen: assets.screenshotWideRel || assets.screenshotRel, comment: clipText(p.points[0] || p.headline || p.brand, 40), reply: clipText(p.cta || p.headline || p.brand, 36),
    title: clipText(p.brand || p.headline, 28), subtitle: clipText(p.brand ? (p.headline || p.cta) : (p.cta || ''), 48), paper: '#f6f5f2', ink: '#1d1b18', accent: pick(rand, ACCENTS), green: '#2f855a', endHold: 1.6 };
}
function object3dSets(p, rand, assets) {
  return { screen: assets.screenshotWideRel || assets.screenshotRel, cursorSvg: 'assets/cursor.svg', bubbleSvg: 'assets/comment.svg', comment: clipText(p.points[0] || p.headline || p.brand, 36),
    title: clipText(p.brand || p.headline, 28), subtitle: clipText(p.brand ? (p.headline || p.cta) : (p.cta || ''), 48), paper: '#0b0d10', ink: '#e8eef7', accent: pick(rand, ACCENTS), body: '#1a2029', endHold: 1.8 };
}

/** Plan variants per look. Each `ok` says when the brief can carry it; each changes scene order / count / layout, not only colors. */
const POSTER_PLANS = [
  { id: 'poster-offer-hero', summary: 'The offer opens as a big sticker, then shrinks into the poster as the name, lines and button pin around it.' },
  { id: 'poster-tight', summary: 'Offer, name, one line and the button: a short, punchy poster.' },
  { id: 'poster-list', summary: 'Offer, name, then up to three lines as labels, then the button.', ok: (p) => allPoints(p).length >= 2 },
  { id: 'poster-photo-bleed', summary: 'Your photo fills the frame under a dark wash; the offer and name sit on top.', ok: (p, a) => !!a.screenshotRel },
];
export const PLANS = {
  'shop-poster': POSTER_PLANS, 'menu-board': POSTER_PLANS, 'market-stamp': POSTER_PLANS,
  'kinetic-type': [
    { id: 'kinetic-offer-first', summary: 'Your offer slams in first (on screen in the first half second), then the shop name, points and the call to action.', ok: (p) => !!p.local },
    { id: 'kinetic-headline-first', summary: 'Headline page, points, brand page, then the call to action with a highlighter.' },
    { id: 'kinetic-brand-first', summary: 'Brand slams in first, the headline rides under it, points, call to action.', ok: (p) => !p.local },
    { id: 'kinetic-split', summary: 'The headline broken into two big beats, then the brand and the call to action.', ok: (p) => !!splitBeats(p.headline)[1] || (p.local && !!hookOf(p.headline || '').deal && !!hookOf(p.headline || '').sub) },
    { id: 'kinetic-number-hook', summary: 'Opens on your real figure, then the brand, points and call to action.', ok: (p) => p.numbers.length > 0 && !p.local },
  ],
  'keynote-ui': [
    { id: 'keynote-title-cards', summary: 'Title → feature cards side by side → your numbers → your screenshot.' },
    { id: 'keynote-shot-first', summary: 'Title → your photo first → numbers → cards.', ok: (p, a) => !!a.screenshotRel },
    { id: 'keynote-number-lead', summary: 'Opens on your big number, then title, cards and screenshot.', ok: (p) => p.numbers.length > 0 && !p.local },
  ],
  kurzgesagt: [
    { id: 'kurz-orbit', summary: 'Title, your points orbit the brand planet, camera pushes into the last one.' },
    { id: 'kurz-chain', summary: 'Your points chained in order with a signal running through them.' },
    { id: 'kurz-focus', summary: 'Points orbit, camera pushes into the first one.' },
  ],
  whiteboard: [
    { id: 'board-list', summary: 'Marker writes title and lines, underlines or circles the call to action.' },
    { id: 'board-doodle', summary: 'Lines with hand-drawn doodles and arrows next to them.', ok: (p) => [p.headline, ...p.points].some((s) => boardIcon(s || '')) },
    { id: 'board-circle-title', summary: 'Lines written, then the brand name circled at the end.', ok: (p) => !!p.brand },
  ],
  'math-3b1b': [{ id: 'math-formula', summary: 'Your formula is written, explained line by line, the key line boxed.' }],
  'finance-chart': [
    { id: 'chart-bars', summary: 'Bars of your own figures grow; the biggest one is labelled.' },
    { id: 'chart-line', summary: 'A line of your own figures draws in; the peak is labelled.', ok: (p) => (seriesOf(p)?.series.length || 0) >= 4 },
  ],
  'vox-collage': [
    { id: 'vox-image-first', summary: 'Your image taped down first, then the notes on index cards.' },
    { id: 'vox-notes-first', summary: 'Notes first, then your images, call to action last.', ok: (p) => p.points.length + (p.headline ? 1 : 0) >= 2 },
  ],
  storytime: [
    { id: 'story-react', summary: 'The character tells it, a reaction close-up, a punchline mark.' },
    { id: 'story-insert', summary: 'The character tells it, cut to the screen, punchline.', ok: (p) => p.categories.includes('saas') },
  ],
  'ui-space': [{ id: 'ui-layers', summary: 'Your screenshot layers fly apart in 3D, then settle on the title.' }],
  'object-3d': [{ id: 'object-hero', summary: 'Your screen on a studio device with a hero camera move.' }],
};

function buildFor(lookId, planId, p, rand, assets) {
  const out = buildRaw(lookId, planId, p, rand, assets);
  if (out.spec) out.spec.quiet = true; // engine notes go to the console, never onto a customer's frame
  return out;
}
function buildRaw(lookId, planId, p, rand, assets) {
  if (POSTER_LOOKS.has(lookId)) return { spec: posterSpec(p, rand, planId, assets, LOOKS.find((l) => l.id === lookId).style) };
  switch (lookId) {
    case 'kinetic-type': return { spec: kineticSpec(p, rand, planId, assets) };
    case 'keynote-ui': return { spec: keynoteSpec(p, rand, planId, assets) };
    case 'kurzgesagt': return { spec: kurzSpec(p, rand, planId) };
    case 'whiteboard': return { spec: whiteboardSpec(p, rand, planId, assets) };
    case 'math-3b1b': return { spec: mathSpec(p, rand, planId) };
    case 'finance-chart': return { spec: financeSpec(p, rand, planId) };
    case 'vox-collage': return { spec: voxSpec(p, rand, planId, assets) };
    case 'storytime': return { spec: storySpec(p, rand, planId) };
    case 'ui-space': return { sets: uiSpaceSets(p, rand, assets) };
    case 'object-3d': return { sets: object3dSets(p, rand, assets) };
    default: throw new Error(`unknown look ${lookId}`);
  }
}

/** Background music direction for the brief (offline synth in sound.js). */
export function musicFor(parsed, seed) {
  const c = parsed.category, t = parsed.tones;
  const product = t.includes('calm') ? 'calm' : t.includes('bold') ? 'hype' : { beauty: 'hype', fitness: 'hype', food: 'consumer', realestate: 'consumer', saas: 'devtool', product: 'hardware', event: 'hype', edu: 'explainer', finance: 'data', story: 'cute' }[c] || 'consumer';
  return { product, seed: seed % 97 };
}

const IMG = /\.(png|jpe?g|webp|gif|svg)$/i;
/**
 * Full composition recipe from a brief.
 * @returns {{ seed, look, lookLabel, lookBlurb, planId, plan, parsed, spec?, sets, assets, accent, music, format, reasons }}
 */
export function composeFromBrief(opts = {}) {
  const { brief = '', brand = '', offer = '', cta = '', brandUrl = '', look = 'auto', seed: seedIn, logoPath = '', screenshotPath = '', format = '16:9', avoid = [] } = opts;
  const seed = seedInt(seedIn);
  const parsed = parseBrief({ brief, brand, offer, cta, brandUrl });
  // the shop's own name is part of the dice: ten cafés with the same version number still get ten different films
  const mix = (seed ^ seedInt(`name:${norm(parsed.brand) || norm(parsed.headline)}`)) >>> 0;
  const rand = mulberry32(mix);
  const hasLogo = !!(logoPath && IMG.test(logoPath) && existsSync(logoPath));
  const hasScreenshot = !!(screenshotPath && IMG.test(screenshotPath) && existsSync(screenshotPath));
  const normExt = (f) => { const e = (extname(f) || '.png').toLowerCase(); return e === '.jpeg' ? '.jpg' : e; };
  // relative paths match what brand-layer.js prepareBrandAssets() writes into the project
  const assets = {
    logoPath: hasLogo ? logoPath : '', screenshotPath: hasScreenshot ? screenshotPath : '',
    logoRel: hasLogo ? `assets/brand-logo${normExt(logoPath)}` : '',
    screenshotRel: hasScreenshot ? `assets/brand-shot${normExt(screenshotPath)}` : '',
    screenshotWideRel: hasScreenshot ? 'assets/brand-shot-wide.jpg' : '',
  };
  const fmt = ['16:9', '9:16', '1:1'].includes(format) ? format : '16:9';
  const { look: lookMeta, reason, ranked, skipped } = pickLook(parsed, { look, seed: mix, hasLogo, hasScreenshot, format: fmt, avoid });
  const plans = PLANS[lookMeta.id].filter((pl) => !pl.ok || pl.ok(parsed, assets));
  const planIdx = Math.floor(rand() * plans.length) % plans.length; // always drawn, so a forced plan keeps the same scene randomness
  let plan = (opts.plan && plans.find((pl) => pl.id === opts.plan)) || null;
  if (!plan && POSTER_LOOKS.has(lookMeta.id) && assets.screenshotRel && plans.some((pl) => pl.id === 'poster-photo-bleed')) {
    plan = weighted(rand, plans.map((pl) => ({ ...pl, w: pl.id === 'poster-photo-bleed' ? 5 : pl.id === 'poster-tight' || pl.id === 'poster-offer-hero' ? 2 : 1 })));
  }
  if (!plan) plan = plans[planIdx];
  const built = buildFor(lookMeta.id, plan.id, parsed, rand, assets);
  const accent = built.spec?.data?.accent || built.sets?.accent || built.spec?.data?.colors?.main || built.spec?.data?.planet || pick(rand, ACCENTS);
  const structure = built.spec ? built.spec.cues.map((q) => q.kind) : ['intro', 'screen', 'title'];
  return {
    seed, variety: mix, look: lookMeta.id, template: templateOf(lookMeta.id), lookLabel: lookMeta.label, lookBlurb: lookMeta.blurb, planId: plan.id,
    plan: { summary: plan.summary, structure },
    format: fmt,
    parsed: { brand: parsed.brand, headline: parsed.headline, offer: parsed.offer, cta: parsed.cta, ctaButton: parsed.ctaButton, ctaSub: parsed.ctaSub, ctaAuto: parsed.ctaAuto, brief: parsed.brief, points: parsed.points, facts: parsed.facts, numbers: parsed.numbers.map((n) => n.text), formula: parsed.formula, category: parsed.category, local: parsed.local, tones: parsed.tones, location: parsed.location, lang: parsed.lang, rtl: parsed.rtl, brandUrl: parsed.brandUrl, title: parsed.title, subtitle: parsed.subtitle, bullets: parsed.points },
    spec: built.spec || null,
    sets: built.sets || {},
    accent,
    music: musicFor(parsed, seed),
    assets,
    reasons: { look: reason, ranked, skipped, plan: plan.summary, structure, tones: parsed.tones, category: parsed.category },
  };
}

/** N unique compositions from one brief: different look+plan each time when the brief allows it. */
export function composeVariants(opts = {}, count = 3) {
  const n = Math.max(1, Math.min(8, Number(count) || 3));
  const baseSeed = seedInt(opts.seed);
  const out = [], used = new Set(), looks = [];
  for (let i = 0; i < n; i++) {
    let recipe, attempt = 0;
    do {
      const seed = (baseSeed + i * 0x9e3779b9 + attempt * 0x85ebca6b) >>> 0;
      recipe = composeFromBrief({ ...opts, seed, avoid: attempt < 6 ? looks : [] });
      attempt++;
    } while (used.has(`${recipe.look}:${recipe.planId}`) && attempt < 16);
    used.add(`${recipe.look}:${recipe.planId}`); looks.push(recipe.look);
    out.push(recipe);
  }
  return out;
}

export function describeRecipe(recipe) {
  return [`look=${recipe.look} (${recipe.lookLabel})`, `plan=${recipe.planId}`, `seed=${recipe.seed}`, `format=${recipe.format || '16:9'}`, `scenes=${(recipe.plan.structure || []).join(' → ')}`, `brand="${recipe.parsed.brand}"`].join(' · ');
}

export function assetDestName(kind, srcPath) {
  const ext = extname(srcPath) || '.png';
  return kind === 'logo' ? `brand-logo${ext}` : `brand-shot${ext}`;
}

export function looksForApi() {
  return LOOKS.map((l) => ({ id: l.id, label: l.label, blurb: l.blurb, needs: l.needs || null, vertical: !!l.clip, wantsScreenshot: l.needs === 'screenshot' }));
}
