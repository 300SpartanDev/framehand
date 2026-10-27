// Post captions people can paste as is: built from the brief's own words (brand, headline, points, call to action),
// with hashtags that fit the business and the place, sized for each platform. Never mentions how the video was made
// unless the user switches "Made with FRAMEHAND" on. The caption is in the brief's language: no English call to action
// or platform phrase ("link in bio") is added to a post written in another language.
import { decodeEntities } from './compose-brief.js';
import { detectLang, NOW_WORDS, wordsRe, all } from './lexicon.js';

export const CAPTION_LIMITS = { x: 280, instagram: 2200, tiktok: 2200, 'youtube-shorts': 100, linkedin: 3000 };
const TAG_COUNT = { x: 2, instagram: 8, tiktok: 5, 'youtube-shorts': 3, linkedin: 3 };

const clean = (s) => decodeEntities(String(s ?? '')).replace(/\s+/g, ' ').trim();
// scripts without capitals join a multi-word tag with "_" (#مقهى_النخيل); the others camel-case it (#JoesPizza)
const UNCASED = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u0E00-\u0E7F\u0900-\u097F]/u;
const camel = (s) => { const ws = clean(s).replace(/[’']/g, '').split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  if (ws.some((w) => UNCASED.test(w))) return ws.join('_');
  return ws.map((w) => (w.length > 1 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w[0].toUpperCase() + w.slice(1))).join(''); };
const T = (s) => s.split('|').filter(Boolean);

/**
 * Topic tags. Each row: what the brief talks about (any language), the tags per language, and an emoji. The post gets
 * the tags of its own language first and one widely used English tag after them (for reach), never only English and
 * never one country's words for everyone. Languages with no row get the English tags.
 */
const TOPICS = [
  { re: /barber|fades?\b|haircut|beard|barbearia|barbería|barberia|barbiere|barbier|berber|šišanj|sisanj|brijanj|berbernic|барбер|бербер|шишањ|бријањ|стрижк|κουρε|حلاق/iu, emoji: '✂️',
    tags: { en: T('barber|barbershop|fade|haircut'), es: T('barberia|barbero|cortedepelo'), pt: T('barbearia|barbeiro|cortemasculino'), fr: T('barbier|coiffurehomme'), de: T('barbier|herrenfriseur'),
      it: T('barbiere|barberia'), nl: T('barbier|kapper'), pl: T('barber|fryzjermeski'), tr: T('berber|erkekkuaför'), sr: T('berbernica|frizer'), 'sr-cyrl': T('берберница|фризер'),
      ru: T('барбершоп|барбер|мужскаястрижка'), uk: T('барбершоп|барбер'), el: T('κουρείο|barber'), ar: T('حلاق|حلاقة') } },
  { re: /salon|hair|peluquer|cabeleireir|coiffeur|coiffure|friseur|parrucchier|kapsalon|kapper|fryzjer|kuaför|kuafor|frizer|фризер|парикмахер|перукар|κομμωτ|صالون/iu, emoji: '💇',
    tags: { en: T('hairsalon|hair|hairstyle'), es: T('peluqueria|peinados'), pt: T('salaodebeleza|cabelo'), fr: T('coiffeur|coiffure'), de: T('friseur|haare'), it: T('parrucchiere|capelli'),
      nl: T('kapsalon|kapper'), pl: T('fryzjer|włosy'), tr: T('kuaför|saç'), sr: T('frizer|frizura'), 'sr-cyrl': T('фризер|фризура'), ru: T('парикмахерская|стрижка'), uk: T('перукарня|зачіска'),
      el: T('κομμωτήριο|μαλλιά'), ar: T('صالون|شعر') } },
  { re: /nails?\b|manicur|uñas|unhas|ongles|nägel|unghie|nagels|paznokc|tırnak|nokti|ногт|νύχια|أظافر/iu, emoji: '💅',
    tags: { en: T('nails|nailart'), es: T('uñas|manicura'), pt: T('unhas|manicure'), fr: T('ongles|manucure'), de: T('nägel|nageldesign'), it: T('unghie|manicure'), nl: T('nagels|nagelstudio'),
      pl: T('paznokcie|manicure'), tr: T('tırnak|manikür'), sr: T('nokti|manikir'), 'sr-cyrl': T('нокти|маникир'), ru: T('маникюр|ногти'), el: T('νύχια|μανικιούρ'), ar: T('أظافر|مانيكير') } },
  { re: /\bspa\b|massage|facial|skin ?care|masaje|massagem|masaż|masaj|masaž|массаж|μασάζ|مساج/iu, emoji: '🌿',
    tags: { en: T('spa|selfcare|skincare'), es: T('spa|masaje'), pt: T('spa|massagem'), fr: T('spa|massage'), de: T('spa|massage'), it: T('spa|massaggio'), pl: T('spa|masaż'), tr: T('spa|masaj'),
      sr: T('spa|masaža'), 'sr-cyrl': T('спа|масажа'), ru: T('спа|массаж'), el: T('spa|μασάζ'), ar: T('سبا|مساج') } },
  { re: /tattoo|tatuaj|tatuag|tatouage|tätowier|tatuaggi|tatoeag|tatuaż|dövme|tetovaž|тату|τατουάζ|وشم/iu, emoji: '🖋️',
    tags: { en: T('tattoo|tattooart'), es: T('tatuaje|tatuajes'), pt: T('tatuagem'), fr: T('tatouage'), de: T('tattoo|tätowierung'), it: T('tatuaggio'), pl: T('tatuaż'), tr: T('dövme'),
      sr: T('tetovaža'), 'sr-cyrl': T('тетоважа'), ru: T('тату|татуировка'), el: T('τατουάζ'), ar: T('وشم') } },
  { re: /coffee|caf[eé]|caffè|espresso|latte|flat white|kahve|kaffee|koffie|kawa|kawiarn|kafa|kafić|kafic|кофе|кафе|кава|кафа|καφ|قهوة|مقهى|كافيه|カフェ|コーヒー|ラテ|咖啡|커피|카페/iu, emoji: '☕',
    tags: { en: T('coffee|cafe|coffeetime'), es: T('café|cafeteria'), pt: T('café|cafeteria'), fr: T('café|pausecafé'), de: T('kaffee|café'), it: T('caffè|bar'), nl: T('koffie|koffietijd'),
      pl: T('kawa|kawiarnia'), tr: T('kahve|kahvekeyfi'), sr: T('kafa|kafić'), 'sr-cyrl': T('кафа|кафић'), ru: T('кофе|кофейня'), uk: T('кава|кавʼярня'), el: T('καφές|καφετέρια'),
      ar: T('قهوة|مقهى'), ja: T('カフェ|コーヒー'), zh: T('咖啡'), ko: T('카페|커피') } },
  { re: /baker|bread|pastr|cake|croissant|viennoiser|panader|padaria|boulanger|pâtisser|patisser|bäckerei|backerei|brötchen|panetter|pasticcer|bakkerij|piekarn|fırın|firin|pekar|пекар|хлеб|φούρνο|مخبز|ベーカリー|パン/iu, emoji: '🥐',
    tags: { en: T('bakery|freshbread|pastry'), es: T('panaderia|pan|bolleria'), pt: T('padaria|pao'), fr: T('boulangerie|viennoiseries'), de: T('bäckerei|brötchen'), it: T('panetteria|pasticceria'),
      nl: T('bakkerij|brood'), pl: T('piekarnia|chleb'), tr: T('fırın|ekmek'), sr: T('pekara|hleb'), 'sr-cyrl': T('пекара|хлеб'), ru: T('пекарня|выпечка'), uk: T('пекарня|випічка'),
      el: T('φούρνος|ψωμί'), ar: T('مخبز|خبز'), ja: T('パン|ベーカリー') } },
  { re: /pizz|пицц|пиц|πίτσα|بيتزا|ピザ/iu, emoji: '🍕',
    tags: { en: T('pizza|foodie'), es: T('pizza|pizzeria'), pt: T('pizza|pizzaria'), fr: T('pizza|pizzeria'), de: T('pizza|pizzeria'), it: T('pizza|pizzeria'), nl: T('pizza'), pl: T('pizza|pizzeria'),
      tr: T('pizza'), sr: T('pica|picerija'), 'sr-cyrl': T('пица|пицерија'), ru: T('пицца|пиццерия'), el: T('πίτσα'), ar: T('بيتزا'), ja: T('ピザ') } },
  { re: /\bpubs?\b|\bpints?\b|beer|cerveza|cerveja|bière|bier\b|birra|piwo|bira\b|pivo|пиво|μπίρα|بيرة/iu, emoji: '🍺',
    tags: { en: T('pub|pubquiz|craftbeer'), es: T('cerveza|bar'), pt: T('cerveja|bar'), fr: T('bière|bar'), de: T('bier|kneipe'), it: T('birra|pub'), nl: T('bier|kroeg'), pl: T('piwo|pub'),
      tr: T('bira|pub'), sr: T('pivo|pab'), 'sr-cyrl': T('пиво|паб'), ru: T('пиво|паб'), el: T('μπίρα|pub') } },
  { re: /restaurant|restoran|ristorant|trattoria|osteria|dinner|lunch|brunch|menu|kitchen|grill|burger|sushi|tacos|ресторан|εστιατόριο|ταβέρνα|مطعم|レストラン|餐厅|식당/iu, emoji: '🍽️',
    tags: { en: T('foodie|restaurant|eatlocal'), es: T('restaurante|gastronomia'), pt: T('restaurante|gastronomia'), fr: T('restaurant|gastronomie'), de: T('restaurant|essen'), it: T('ristorante|cibo'),
      nl: T('restaurant|eten'), pl: T('restauracja|jedzenie'), tr: T('restoran|yemek'), sr: T('restoran|hrana'), 'sr-cyrl': T('ресторан|храна'), ru: T('ресторан|еда'), el: T('εστιατόριο|φαγητό'), ar: T('مطعم|طعام') } },
  { re: /yoga|йога|γιόγκα|يوغا/iu, emoji: '🧘',
    tags: { en: T('yoga|yogaclass|wellness'), es: T('yoga|bienestar'), pt: T('yoga|bemestar'), fr: T('yoga|bienêtre'), de: T('yoga'), it: T('yoga|benessere'), nl: T('yoga'), pl: T('joga|yoga'), tr: T('yoga'),
      sr: T('joga'), 'sr-cyrl': T('јога'), ru: T('йога'), el: T('γιόγκα'), ar: T('يوغا') } },
  { re: /\bgym|fitness|workout|training|crossfit|pilates|boxing|gimnasio|academia|salle de sport|palestra|sportschool|siłowni|silowni|spor salonu|teretan|фитнес|спортзал|теретан|γυμναστήριο|نادي|ジム|健身|헬스/iu, emoji: '💪',
    tags: { en: T('fitness|gym|workout'), es: T('gimnasio|fitness|entrenamiento'), pt: T('academia|treino|fitness'), fr: T('salledesport|fitness'), de: T('fitnessstudio|training'), it: T('palestra|allenamento'),
      nl: T('sportschool|fitness'), pl: T('siłownia|trening'), tr: T('sporsalonu|fitness'), sr: T('teretana|trening'), 'sr-cyrl': T('теретана|тренинг'), ru: T('фитнес|спортзал|тренировка'),
      uk: T('спортзал|тренування'), el: T('γυμναστήριο|fitness'), ar: T('رياضة|لياقة') } },
  { re: /open house|listing|bedroom|apartment|condo|villa|real estate|property|for sale|for rent|inmobiliari|imobili|immobili|makelaar|nieruchomo|emlak|nekretnin|недвижим|некретнин|ακίνητ|عقار/iu, emoji: '🏡',
    tags: { en: T('realestate|openhouse|newlisting'), es: T('inmobiliaria|pisos'), pt: T('imoveis|imobiliaria'), fr: T('immobilier'), de: T('immobilien'), it: T('immobiliare|case'), nl: T('makelaar|woning'),
      pl: T('nieruchomości|mieszkanie'), tr: T('emlak|satılık'), sr: T('nekretnine|stan'), 'sr-cyrl': T('некретнине|стан'), ru: T('недвижимость|квартира'), el: T('ακίνητα'), ar: T('عقارات') } },
  { re: /\bapps?\b|saas|software|platform|dashboard|teams?\b|workflow|productivity|free trial/iu, emoji: '🚀', tags: { en: T('productivity|saas|startup') } },
  { re: /event|concert|festival|party|workshop|meetup|tickets?|quiz|evento|concierto|fiesta|concerto|festa|événement|soirée|konzert|feest|koncert|konser|događaj|концерт|вечеринк|догађај|εκδήλωσ|συναυλ|حفل|فعالية/iu, emoji: '🎉',
    tags: { en: T('event|thingstodo'), es: T('evento|planes'), pt: T('evento|rolê'), fr: T('événement|sortir'), de: T('event|veranstaltung'), it: T('evento|eventi'), nl: T('evenement|uitgaan'),
      pl: T('wydarzenie'), tr: T('etkinlik'), sr: T('dogadjaj|izlazak'), 'sr-cyrl': T('догађај|излазак'), ru: T('событие|афиша'), el: T('εκδήλωση'), ar: T('فعالية') } },
  { re: /launch|new collection|drop|out now|pre-?order/iu, emoji: '✨', tags: { en: T('newrelease|launch') } },
];
/** "Shop local" in the languages where a local tag is widely used; elsewhere none is added. */
const LOCAL_TAG = { en: 'shoplocal', es: 'comerciolocal', pt: 'comerciolocal', fr: 'commercelocal', de: 'kaufelokal', nl: 'steunlokaal', pl: 'kupujlokalnie' };

const langOf = (p, text) => { const l = p.lang || detectLang(text); return l === 'sr' && /\p{Script=Cyrillic}/u.test(text) ? 'sr-cyrl' : l; };
function topicOf(text) {
  for (const t of TOPICS) if (t.re.test(text)) return t;
  return { tags: {}, emoji: '' };
}
const topicTags = (topic, lang) => {
  const own = topic.tags[lang] || topic.tags[lang.split('-')[0]] || [];
  const en = topic.tags.en || [];
  return own.length ? [...own, ...(lang === 'en' ? [] : en.slice(0, 1))] : en;
};

/** Hashtags that fit: the brand, the place, the place + trade, the trade itself (in the post's language). */
export function hashtagsFor(p, platform = 'instagram') {
  const all = [p.brand, p.headline, ...(p.points || []), p.cta, p.offer, p.brief].map(clean).join(' ');
  const lang = langOf(p, all);
  const tags = topicTags(topicOf(all), lang);
  const out = [];
  const add = (t) => { const k = t && t.replace(/^#/, ''); if (k && [...k].length > 1 && [...k].length <= 30 && !out.some((x) => x.toLowerCase() === k.toLowerCase())) out.push(k); };
  if (p.brand) add(camel(p.brand));
  if (p.location) { add(camel(p.location)); if (tags[0]) add(camel(p.location) + (UNCASED.test(tags[0]) ? '_' : '') + tags[0][0].toUpperCase() + tags[0].slice(1)); }
  tags.forEach(add);
  const local = LOCAL_TAG[lang];
  if ((p.category === 'food' || p.category === 'retail') && platform !== 'linkedin' && local) add(local);
  if (platform === 'youtube-shorts') out.splice(Math.max(0, (TAG_COUNT[platform] || 3) - 1), 0, 'Shorts');
  return out.slice(0, TAG_COUNT[platform] || 4).map((t) => `#${t}`);
}

const NOW_END = new RegExp(`(?:${wordsRe(all(NOW_WORDS)).source}|this \\p{L}+)\\s*$`, 'iu');

/**
 * A ready-to-paste caption.
 * @param {object} p  parsed brief: { brand, headline, offer, cta, points[], location, local, lang }
 * @param {{ platform?: string, madeWith?: boolean }} opts
 * @returns {{ caption, title, description, hashtags, max }}
 */
export function writeCaption(p0 = {}, { platform = 'x', madeWith = false } = {}) {
  const lang = langOf(p0, [p0.brand, p0.headline, p0.cta, p0.brief].map(clean).join(' '));
  const cjk = /^(ja|zh|ko)$/.test(lang);
  // German capitalises its nouns, and a name may open the line: only an ordinary capital is lowered ("Scones…" → "scones…")
  const lowerFirst = (s) => (lang !== 'de' && /^\p{Lu}\p{Ll}/u.test(s) && !/^(I|I'm|I've)\b/.test(s) ? s[0].toLocaleLowerCase() + s.slice(1) : s);
  const endDot = (s) => (/[.!?…)。！？؟]$/u.test(s) || cjk ? s : `${s}.`);
  // a short post, not the pasted brief: the hook and every line are cut at a word/clause boundary
  const short = (x, n) => { x = clean(x); if (x.length <= n) return x; const first = x.split(/(?<=[.!?。！？؟])\s*/u)[0]; if (first.length <= n) return first.replace(/[.。]$/u, ''); let o = ''; for (const w of x.split(' ')) { if ((o + ' ' + w).trim().length > n) break; o = (o + ' ' + w).trim(); } return o.replace(/\s+(and|or|with|in|on|at|for|to|of|the|a|an)$/i, '').replace(/[,;:،]$/u, ''); };
  const p = { ...p0, lang: p0.lang, brand: clean(p0.brand), headline: short(p0.headline || p0.offer, 80), cta: clean(p0.cta), points: [...(p0.points || []), ...(p0.facts || [])].map((x) => short(x, 60)).filter(Boolean), location: clean(p0.location) };
  const all = [p.brand, p.headline, ...p.points, p.cta, clean(p0.brief)].join(' ');
  const { emoji } = topicOf(all);
  const pro = platform === 'linkedin';
  const e = pro ? '' : emoji;
  const brandIn = (s) => p.brand && s.toLowerCase().includes(p.brand.toLowerCase());

  // hook: "Leo's Barbershop: fresh fades in Velika Plana ✂️"
  let hook = p.headline || p.brand;
  if (p.brand && p.headline && !brandIn(p.headline)) hook = `${p.brand}${cjk ? '｜' : ': '}${lowerFirst(p.headline)}`;
  hook = `${hook}${e ? ` ${e}` : ''}`;
  // the call to action, said once, in the owner's words: "Book today! 👉" / "¡Ven hoy! 👉" / "Запишись. 👉"
  let ctaLine = '';
  const endsEmoji = /\p{Extended_Pictographic}\uFE0F?$/u.test(p.cta);
  if (p.cta) ctaLine = pro ? endDot(p.cta) : endsEmoji ? p.cta : `${/[!！]$/u.test(p.cta) ? p.cta : `${p.cta.replace(/[.。]$/u, '')}${NOW_END.test(p.cta) ? (cjk ? '！' : '!') : cjk ? '' : '.'}`} 👉`;
  const tags = hashtagsFor({ ...p, lang, local: p0.local, category: p0.category, brief: p0.brief }, platform);
  const made = madeWith ? 'Made with FRAMEHAND' : '';

  const max = CAPTION_LIMITS[platform] || 280;
  const build = (pts, nTags) => {
    const body = pts.length ? (platform === 'x' ? pts.map(endDot).join(' ') : pts.map((s) => `• ${s}`).join('\n')) : '';
    const parts = [hook, body, ctaLine, made, tags.slice(0, nTags).join(' ')].filter(Boolean);
    return parts.join('\n\n');
  };
  let pts = p.points.slice(0, platform === 'x' || platform === 'tiktok' ? 1 : 2), nTags = tags.length, caption = build(pts, nTags);
  while (caption.length > max && (pts.length || nTags)) { if (pts.length) pts = pts.slice(0, -1); else nTags--; caption = build(pts, nTags); }
  if (caption.length > max) caption = caption.slice(0, max - 1).trimEnd() + '…';

  // YouTube: the title is short; the description carries the rest
  const title = [p.brand && !brandIn(p.headline) ? `${p.brand} — ` : '', p.headline || p.cta || p.brand].join('').slice(0, 95);
  const description = platform === 'youtube-shorts' ? [p.headline, ...p.points, ctaLine, made, tags.join(' ')].filter(Boolean).join('\n\n') : null;
  return { caption: platform === 'youtube-shorts' ? title : caption, title, description, hashtags: tags, max };
}
