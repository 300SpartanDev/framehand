// Film runners for Framehand UI / CLI.
// Primary path: brief → unique look grammar + composition → render → X draft (never posts).
// Legacy niche batch kept for advanced / back-compat only.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OmError } from './project.js';
import { dataDir } from './user-data.js';
import { prepareBrandAssets, injectBrandLayer, NATIVE_SCREENSHOT_LOOKS, END_CARD_SECONDS } from './brand-layer.js';
import { resizeRoot } from './fork.js';
import {
  composeFromBrief,
  composeVariants,
  describeRecipe,
  LOOK_IDS,
  POSTER_LOOKS,
} from './compose-brief.js';

const PKG = resolve(fileURLToPath(import.meta.url), '../../..');
const OM_JS = join(PKG, 'cli/om.js');

/** Built-in niche pack (copy starters only — not the main product path). */
export const NICHE_PACK = {
  cafe: 'local-business',
  shop: 'local-business',
  salon: 'local-business',
  'local-business': 'local-business',
  gym: 'gym-fitness',
  fitness: 'gym-fitness',
  'gym-fitness': 'gym-fitness',
  realtor: 'real-estate',
  realty: 'real-estate',
  'real-estate': 'real-estate',
  listing: 'real-estate',
};

export const DEFAULT_NICHES = ['cafe', 'gym', 'realtor'];

export function resolveNiche(name) {
  const key = String(name || '').trim().toLowerCase();
  const id = NICHE_PACK[key];
  if (!id) throw new OmError(`unknown niche "${name}" — try: ${DEFAULT_NICHES.join(', ')} (or local-business, real-estate, gym-fitness)`);
  return id;
}

/** Run one `om` step. `signal` (AbortSignal) stops it and everything it started (browsers, encoder). */
export function runOm(args, { cwd, onLog, onLine, signal } = {}) {
  return new Promise((ok, fail) => {
    if (signal?.aborted) return fail(cancelled());
    const child = spawn(process.execPath, [OM_JS, ...args], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32', // own process group: Cancel can stop Chrome and FFmpeg too
    });
    let out = '', err = '', buf = '', stopped = false;
    const lines = (s) => { if (!onLine) return; buf += s; const parts = buf.split('\n'); buf = parts.pop(); for (const l of parts) onLine(l); };
    const kill = () => {
      stopped = true;
      const hit = (sig) => { try { if (process.platform !== 'win32') process.kill(-child.pid, sig); else child.kill(sig); } catch { /* gone */ } };
      hit('SIGTERM');
      setTimeout(() => hit('SIGKILL'), 2500).unref();
    };
    signal?.addEventListener('abort', kill, { once: true });
    child.stdout.on('data', (b) => { const s = b.toString(); out += s; onLog?.(s, 'stdout'); lines(s); });
    child.stderr.on('data', (b) => { const s = b.toString(); err += s; onLog?.(s, 'stderr'); lines(s); });
    child.on('error', fail);
    child.on('close', (code) => {
      signal?.removeEventListener('abort', kill);
      if (stopped) return fail(cancelled());
      if (code === 0) ok({ out: out.trim(), err: err.trim(), code });
      else fail(new OmError(`step failed (${code}): ${(err || out).trim().split('\n').slice(-8).join('\n')}`));
    });
  });
}

function cancelled() { const e = new OmError('Stopped — nothing was saved for this video.'); e.cancelled = true; return e; }

function newestMp4(dir) {
  const out = join(dir, 'out');
  if (!existsSync(out)) return null;
  const vids = readdirSync(out).filter((n) => /\.mp4$/i.test(n)).map((n) => join(out, n));
  if (!vids.length) return null;
  return vids.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function setsToArgs(sets) {
  return Object.entries(sets).map(([k, v]) => {
    if (v == null) return `${k}=`;
    if (typeof v === 'object') return `${k}=${JSON.stringify(v)}`;
    return `${k}=${v}`;
  });
}

export const FORMATS = { '16:9': { width: 1920, height: 1080 }, '9:16': { width: 1080, height: 1920 }, '1:1': { width: 1080, height: 1080 } };

/** Set (or add) one attribute on the composition root tag. */
function setRootAttr(html, name, value) {
  const m = /<div\b[^>]*\bdata-composition-id\s*=\s*["'][^"']+["'][^>]*>/i.exec(html);
  if (!m) return html;
  const re = new RegExp(`(\\s${name}\\s*=\\s*)(["'])[^"']*\\2`, 'i');
  const tag = re.test(m[0]) ? m[0].replace(re, `$1"${value}"`) : m[0].replace(/>$/, ` ${name}="${value}">`);
  return html.slice(0, m.index) + tag + html.slice(m.index + m[0].length);
}

/** The film's scene list, written into the project's clip spec (escaped so no text can close the script tag). */
export function writeClipSpec(dir, spec) {
  const file = join(dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  const json = JSON.stringify(spec, null, 1).replace(/</g, '\\u003c');
  const re = /(<script[^>]*id=["']clip-spec["'][^>]*>)[\s\S]*?(<\/script>)/i;
  if (!re.test(html)) throw new OmError('this look has no clip spec to fill');
  writeFileSync(file, html.replace(re, (m, a, b) => `${a}\n${json}\n${b}`));
}

/** Background music direction for `om sound` (synthesized offline, no samples, no network). */
function injectMusic(dir, music) {
  const file = join(dir, 'index.html');
  const html = readFileSync(file, 'utf8');
  if (html.includes('id="fh-music"')) return;
  const tag = `<script id="fh-music">window.OM && OM.music(${JSON.stringify({ product: music.product, seed: music.seed })});</script>`;
  writeFileSync(file, html.replace(/<script id="fh-brand-script">/i, `${tag}\n<script id="fh-brand-script">`).replace(/(<\/body>)(?![\s\S]*<\/body>)/i, (m) => (html.includes('id="fh-brand-script"') ? m : `${tag}\n${m}`)));
}

/**
 * Build a brief film's project (no render): look + scenes + brand layer + frame size + music direction.
 * Fast — used by the still preview and by runBriefFilm.
 */
export async function buildBriefProject(opts = {}) {
  const { brief = '', brand = '', offer = '', cta = '', brandUrl = '', look = 'auto', seed, logoPath = '', screenshotPath = '', outRoot, name, format = '16:9', music = true, madeWith = false, onLog = () => {}, signal, recipe: recipeIn = null } = opts;
  if (!brief && !brand) throw new OmError('brief or brand is required');
  const recipe = recipeIn || composeFromBrief({ brief, brand, offer, cta, brandUrl, look, seed, logoPath, screenshotPath, format });
  const size = FORMATS[recipe.format] || FORMATS['16:9'];
  const slug = (name || `fh-${recipe.look}-${recipe.seed.toString(36)}-${recipe.format.replace(':', 'x')}`).replace(/[^\w.-]+/g, '-');
  const dir = resolve(outRoot, slug);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });

  onLog(`plan   ${describeRecipe(recipe)}\n`, 'info');
  onLog(`look   ${recipe.lookLabel} — ${recipe.reasons.look}\n`, 'info');
  onLog(`scenes ${recipe.plan.summary}\n`, 'info');
  await runOm(['new', dir, '--template', recipe.template || recipe.look], { onLog, signal });

  const brandAssets = prepareBrandAssets(dir, { logoPath: recipe.assets?.logoPath || '', screenshotPath: recipe.assets?.screenshotPath || '' }, (s) => onLog(s, 'info'));
  const sets = { ...recipe.sets };
  if (!brandAssets.screenshotWideRel && recipe.assets?.screenshotWideRel) {
    for (const [k, v] of Object.entries(sets)) if (v === recipe.assets.screenshotWideRel) sets[k] = brandAssets.screenshotRel;
  }
  if (recipe.look === 'object-3d' && brandAssets.logoRel) {
    sets.logo = brandAssets.logoRel;
    // very wide or very tall marks are clamped to what the 3D chip can hold (the template allows 0.1–12)
    sets.logoAspect = +Math.min(12, Math.max(0.1, brandAssets.logoInfo?.aspect || 1)).toFixed(4);
    sets.logoTone = brandAssets.logoTone;
  }
  if (Object.keys(sets).length) await runOm(['set', ...setsToArgs(sets), dir], { onLog, signal });
  if (recipe.spec) writeClipSpec(dir, recipe.spec);

  // frame size: the canvas looks re-lay themselves out for 9:16 / 1:1 (the root size drives the layout)
  if (size.width !== 1920 || size.height !== 1080) {
    const file = join(dir, 'index.html');
    writeFileSync(file, resizeRoot(readFileSync(file, 'utf8'), size.width, size.height).html);
  }

  // the full length (scenes + end card) on the root up front, so the soundtrack covers the end card too
  // the engine's small "Made with framehand" corner mark: only when the user turns it on
  { const file = join(dir, 'index.html'); writeFileSync(file, setRootAttr(readFileSync(file, 'utf8'), 'data-om-signature', madeWith ? 'auto' : 'off')); }
  if (recipe.spec?.duration) {
    const file = join(dir, 'index.html');
    const total = +(recipe.spec.duration * (recipe.spec.pace || 1) + END_CARD_SECONDS).toFixed(3);
    writeFileSync(file, setRootAttr(readFileSync(file, 'utf8'), 'data-duration', total));
  }
  const holdEnd = POSTER_LOOKS.has(recipe.look) || recipe.look === 'kinetic-type';
  const layer = injectBrandLayer(dir, {
    look: recipe.look, brand: recipe.parsed.brand, cta: recipe.parsed.cta, accent: /^#[0-9a-f]{6}$/i.test(opts.brandColor || '') ? opts.brandColor : recipe.accent,
    logoRel: brandAssets.logoRel, logoTone: brandAssets.logoTone, logoAspect: brandAssets.logoInfo?.aspect,
    ctaButton: recipe.parsed.ctaButton, ctaSub: recipe.parsed.ctaSub, logoLum: brandAssets.logoInfo?.lum, logoBgRemoved: !!brandAssets.bgRemoved,
    seed: recipe.variety ?? recipe.seed,
    screenshotRel: brandAssets.screenshotRel, showShot: !NATIVE_SCREENSHOT_LOOKS.has(recipe.look) && !(recipe.spec?.cues || []).some((q) => q.image) && !recipe.spec?.data?.image,
    width: size.width, height: size.height, holdEnd,
  });
  onLog(`brand  logo ${layer.logo ? `corner (${layer.corner}) + ${holdEnd ? 'held on the last frame' : 'end card'}` : 'none → name on the end card'} · ${holdEnd ? 'the film keeps its own ending' : `end card "${layer.variant}"`}${layer.shot ? ' · screenshot on end card' : ''}\n`, 'info');
  if (music) injectMusic(dir, recipe.music);

  writeFileSync(join(dir, 'composition.json'), JSON.stringify({
    product: 'framehand', createdAt: new Date().toISOString(),
    recipe: { seed: recipe.seed, look: recipe.look, lookLabel: recipe.lookLabel, planId: recipe.planId, plan: recipe.plan, format: recipe.format, size, endCard: layer.variant, logoCorner: layer.corner, music: music ? recipe.music : null, parsed: recipe.parsed, reasons: recipe.reasons, spec: recipe.spec,
      assets: { logoRel: brandAssets.logoRel || null, logoTone: brandAssets.logoRel ? brandAssets.logoTone : null, screenshotRel: brandAssets.screenshotRel || null, screenshotWideRel: brandAssets.screenshotWideRel || null } },
  }, null, 2));
  return { dir, recipe, brandAssets, layer, size };
}

/** Rough wall-clock guess for the UI ("about 2 minutes"), from the look and length. */
export function estimateSeconds(recipe) {
  const film = (recipe.spec?.duration || 9) + 2.6;
  const perFrame = recipe.look === 'object-3d' ? 0.9 : recipe.look === 'ui-space' ? 0.35 : 0.12;
  return Math.round(15 + film * 30 * perFrame);
}

/**
 * Brief-driven film: unique look + scenes from the seed → MP4 → X draft (never posted).
 * onProgress({ phase, frame, total, seconds }) reports real render progress.
 */
export async function runBriefFilm(opts = {}) {
  const { silent: silentIn, music: musicIn, onLog = () => {}, onProgress = () => {}, signal } = opts;
  const music = musicIn ?? (silentIn === undefined ? true : !silentIn);
  const built = await buildBriefProject({ ...opts, music });
  const { dir, recipe } = built;

  if (music) {
    onProgress({ phase: 'music' });
    onLog('music  composing a soundtrack on this computer\n', 'info');
    try { await runOm(['sound', dir], { onLog, signal }); }
    catch (e) { if (e.cancelled) throw e; onLog(`music  skipped (${e.message.split('\n')[0]})\n`, 'info'); }
  }

  const renderArgs = ['render', dir, '--progress', '--workers', String(Math.max(1, Number(process.env.FRAMEHAND_WORKERS) || 1))];
  if (!music) renderArgs.push('--silent');
  onLog(`render ${dir}\n`, 'info');
  let total = 0;
  onProgress({ phase: 'render', frame: 0, total: 0, estimate: estimateSeconds(recipe) });
  await runOm(renderArgs, {
    onLog, signal,
    onLine: (l) => {
      const f = /=\s*(\d+)\s+frames/.exec(l);
      if (f) { total = Number(f[1]); onProgress({ phase: 'render', frame: 0, total }); }
      const m = /^frame\s+(\d+)\/(\d+)/.exec(l.trim());
      if (m) onProgress({ phase: 'render', frame: Number(m[1]), total: Number(m[2]) });
      if (/^encoded/.test(l.trim())) onProgress({ phase: 'encode', frame: total, total });
    },
  });

  onLog('draft  X post (never posted)\n', 'info');
  await runOm(['x-demo', dir, '--template', recipe.template || recipe.look], { onLog, signal });

  const mp4 = newestMp4(dir);
  const shareX = join(dir, 'out', 'share', 'share-x.md');
  const draft = existsSync(shareX) ? readFileSync(shareX, 'utf8') : '';
  return {
    kind: 'brief', look: recipe.look, lookLabel: recipe.lookLabel, planId: recipe.planId, seed: recipe.seed, format: recipe.format,
    template: recipe.look, dir, mp4, shareX: existsSync(shareX) ? shareX : null, draft,
    brand: recipe.parsed.brand, offer: recipe.parsed.offer, cta: recipe.parsed.cta, headline: recipe.parsed.headline,
    music: !!music, recipe, describe: describeRecipe(recipe),
  };
}

/**
 * N unique films from one brief (different seeds → different looks/plans).
 */
export async function batchBriefFilms({
  brief, brand, offer, cta, brandUrl, look = 'auto', seed, logoPath, screenshotPath, format = '16:9', music = true, madeWith = false,
  count = 3, outRoot, onLog, onFilm, onProgress, signal,
} = {}) {
  if (!brief && !brand) throw new OmError('brief or brand is required');
  const root = resolve(outRoot || join(dataDir(), 'batch'));
  mkdirSync(root, { recursive: true });
  const recipes = composeVariants({ brief, brand, offer, cta, brandUrl, look, seed, logoPath, screenshotPath, format }, count);
  onLog?.(`\nbatch  ${recipes.length} unique films from one brief\n`, 'info');
  for (const r of recipes) onLog?.(`  · ${describeRecipe(r)}\n`, 'info');

  const results = [];
  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    onLog?.(`\n=== [${i + 1}/${recipes.length}] ${recipe.look} / ${recipe.planId} / seed ${recipe.seed} ===\n`, 'info');
    const film = await runBriefFilm({
      outRoot: root, name: `${String(i + 1).padStart(2, '0')}-${recipe.look}-${recipe.seed.toString(36)}`, recipe, music, madeWith, onLog, signal,
      onProgress: (p) => onProgress?.({ ...p, index: i, count: recipes.length }),
    });
    results.push(film);
    onFilm?.(film, i, recipes.length);
  }

  const combined = buildCombinedShare(results, results[0]?.brand || brand || 'brand');
  const combinedPath = join(root, 'share-x.md');
  writeFileSync(combinedPath, combined);
  writeFileSync(join(root, 'batch-plans.json'), JSON.stringify({ count: results.length, films: results.map((r) => ({ look: r.look, planId: r.planId, seed: r.seed, mp4: r.mp4, describe: r.describe })) }, null, 2));
  onLog?.(`\nbatch done → ${root}\n  combined draft: ${combinedPath}\n`, 'info');
  return { root, results, combinedPath, combined };
}

/**
 * Legacy niche film (kept for advanced). Prefer runBriefFilm.
 */
export async function runOneFilm(opts) {
  const {
    template,
    brand,
    offer = 'One offer — edit me',
    cta = 'Call to action — edit me',
    outRoot,
    name,
    silent = true,
    onLog = () => {},
  } = opts;
  const tpl = resolveNiche(template);
  const slug = (name || `${tpl}-${Date.now().toString(36)}`).replace(/[^\w.-]+/g, '-');
  const dir = resolve(outRoot, slug);
  if (existsSync(join(dir, 'index.html'))) rmSync(dir, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });

  onLog(`new ${slug} --template ${tpl}\n`, 'info');
  await runOm(['new', dir, '--template', tpl], { onLog });

  const sets = [`brandName=${brand}`, `offer=${offer}`, `cta=${cta}`];
  if (tpl === 'real-estate') {
    sets.push(`listingTitle=${brand}`);
    sets.push(`listingSub=Open house · see offer`);
  }
  if (tpl === 'gym-fitness') sets.push(`hook=${offer}`);
  if (tpl === 'local-business') sets.push(`tagline=${offer}`);

  onLog(`set ${sets.join(' ')}\n`, 'info');
  await runOm(['set', ...sets, dir], { onLog });

  const renderArgs = ['render', dir, '--workers', '1'];
  if (silent) renderArgs.push('--silent');
  onLog(`render ${dir}\n`, 'info');
  await runOm(renderArgs, { onLog });

  onLog(`x-demo ${dir}\n`, 'info');
  await runOm(['x-demo', dir, '--template', tpl], { onLog });

  const mp4 = newestMp4(dir);
  const shareX = join(dir, 'out', 'share', 'share-x.md');
  const draft = existsSync(shareX) ? readFileSync(shareX, 'utf8') : '';
  return {
    niche: template,
    template: tpl,
    look: tpl,
    dir,
    mp4,
    shareX: existsSync(shareX) ? shareX : null,
    draft,
    brand,
    offer,
    cta,
  };
}

export async function batchFilms({ niches, brand, offer, cta, outRoot, onLog, onFilm } = {}) {
  const list = (niches && niches.length ? niches : DEFAULT_NICHES).map(resolveNiche);
  const seen = new Set();
  const templates = [];
  for (const t of list) {
    if (seen.has(t)) continue;
    seen.add(t);
    templates.push(t);
  }
  if (!brand) throw new OmError('usage: om batch --niches cafe,gym,realtor --brand "Name"');
  const root = resolve(outRoot || join(dataDir(), 'batch'));
  mkdirSync(root, { recursive: true });

  const results = [];
  for (let i = 0; i < templates.length; i++) {
    const tpl = templates[i];
    onLog?.(`\n=== [${i + 1}/${templates.length}] ${tpl} ===\n`, 'info');
    const r = await runOneFilm({
      template: tpl,
      brand,
      offer: offer || defaultOffer(tpl, brand),
      cta: cta || defaultCta(tpl, brand),
      outRoot: root,
      name: `${String(i + 1).padStart(2, '0')}-${tpl}`,
      onLog,
    });
    results.push(r);
    onFilm?.(r, i, templates.length);
  }

  const combined = buildCombinedShare(results, brand);
  const combinedPath = join(root, 'share-x.md');
  writeFileSync(combinedPath, combined);
  onLog?.(`\nbatch done → ${root}\n  combined draft: ${combinedPath}\n`, 'info');
  return { root, results, combinedPath, combined };
}

function defaultOffer(tpl, brand) {
  if (tpl === 'local-business') return `${brand} — this weekend only`;
  if (tpl === 'real-estate') return `Open house Sat 11–2 · ${brand}`;
  if (tpl === 'gym-fitness') return `30-day starter · first week free`;
  return `One offer from ${brand}`;
}

function defaultCta(tpl, brand) {
  if (tpl === 'local-business') return `Visit ${brand} today`;
  if (tpl === 'real-estate') return `Tour today · ask for ${brand}`;
  if (tpl === 'gym-fitness') return `Book a free intro · ${brand}`;
  return `Learn more · ${brand}`;
}

function buildCombinedShare(results, brand) {
  const lines = [
    `# Framehand — X drafts (NEVER auto-posted)`,
    ``,
    `Brand: **${brand}**`,
    `Films: ${results.length}`,
    ``,
    `> Edit each draft, attach the MP4 yourself, then post from your account.`,
    ``,
  ];
  for (const r of results) {
    const label = r.lookLabel || r.look || r.template;
    lines.push(`## ${label}${r.planId ? ` · ${r.planId}` : ''}${r.seed != null ? ` · seed ${r.seed}` : ''}`);
    lines.push(``);
    lines.push(`- Project: \`${r.dir}\``);
    lines.push(`- MP4: \`${r.mp4 || '(none)'}\``);
    lines.push(`- Per-film draft: \`${r.shareX || '(none)'}\``);
    lines.push(``);
    lines.push(`### Draft post`);
    lines.push(``);
    lines.push('```');
    const draft = extractDraftPost(r.draft) || `Made a short film for ${brand} with framehand.\n\nMade with framehand\n#motiongraphics #launchfilm #framehand`;
    lines.push(draft.trim());
    lines.push('```');
    lines.push(``);
  }
  lines.push(`---`);
  lines.push(`Made with framehand · ${results.length} unique film(s) · never auto-posts to X`);
  lines.push(``);
  return lines.join('\n');
}

function extractDraftPost(md) {
  if (!md) return null;
  const m = md.match(/## Draft X post[\s\S]*?---\n([\s\S]*?)\n---/);
  return m ? m[1].trim() : null;
}

export { LOOK_IDS, composeFromBrief, composeVariants, describeRecipe };
