// om ui — local FRAMEHAND web UI (127.0.0.1 only).
// Brief → unique film → MP4 (+ 9:16) → captions + share packs. Runs on this computer; it cannot post for you.
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { OmError } from './project.js';
import { batchBriefFilms, buildBriefProject, estimateSeconds, runBriefFilm, runOm } from './batch.js';
import { composeFromBrief, describeRecipe, looksForApi, NICHE_STARTERS, VERTICAL_LOOKS } from './compose-brief.js';
import { captionForPlatform, openUrl, platformsForApi, videoFor, writeSharePack } from './share-pack.js';
import { END_CARD_SECONDS } from './brand-layer.js';
import { prepareImage } from './image-prep.js';
import { findChrome } from './browser.js';
import { dataDir } from './user-data.js';
import { zip } from './export.js';

const PKG = resolve(fileURLToPath(import.meta.url), '../../..');
const UI_DIR = join(PKG, 'cli/ui');
// everything a person makes lives in their user-data folder, never inside the project (see user-data.js)
let WORK = dataDir();
/** Folders the app may serve files from: its own data folder (videos, previews, uploads, share packs). */
export const SERVE_ROOTS = () => [WORK];
/**
 * The real path of a file the app may serve, or null. Paths with ".." are refused outright, and the file's real path
 * (symlinks resolved) must sit inside one of SERVE_ROOTS — nothing else on the computer is reachable.
 */
export function servableFile(p, roots = SERVE_ROOTS()) {
  if (typeof p !== 'string' || !p || p.includes('\0') || p.split(/[\\/]+/).includes('..')) return null;
  let real;
  try { real = realpathSync(resolve(p)); } catch { return null; }
  const inside = roots.some((r) => { let rr; try { rr = realpathSync(r); } catch { return false; } return real.startsWith(rr + '/'); });
  try { return inside && statSync(real).isFile() ? real : null; } catch { return null; }
}
let UPLOADS = join(WORK, 'uploads');
let LAST = join(WORK, 'last.json');
let KIT = join(WORK, 'brand-kit.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4', '.gif': 'image/gif', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip', '.png': 'image/png', '.woff': 'font/woff', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};
const FORMATS = ['16:9', '9:16', '1:1', 'both'];

function doctorReport() {
  const issues = [], ok = [];
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) ok.push({ id: 'node', label: 'Node.js ready', detail: process.versions.node });
  else issues.push({ id: 'node', label: 'Node.js is too old', fix: 'Install Node 22 or newer, then reopen FRAMEHAND.', url: 'https://nodejs.org/en/download', link: 'Get Node.js' });
  const has = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' }).status === 0;
  if (has('ffmpeg') && has('ffprobe')) ok.push({ id: 'ffmpeg', label: 'Video tools ready', detail: 'FFmpeg' });
  else issues.push({ id: 'ffmpeg', label: 'Video tools missing', fix: 'Install FFmpeg (Mac: brew install ffmpeg · Windows: winget install ffmpeg · Linux: sudo apt install ffmpeg), then try again.', url: process.platform === 'darwin' ? 'https://evermeet.cx/ffmpeg/' : 'https://ffmpeg.org/download.html', link: 'Get FFmpeg' });
  const chrome = findChrome();
  if (chrome) ok.push({ id: 'chrome', label: 'Chrome ready', detail: chrome });
  else issues.push({ id: 'chrome', label: 'Chrome not found', fix: 'Install Google Chrome (FRAMEHAND uses it to draw each frame). Then try again.', url: 'https://www.google.com/chrome/', link: 'Get Chrome' });
  const fontsDir = join(PKG, 'fonts');
  const fontCount = existsSync(fontsDir) ? readdirSync(fontsDir).filter((n) => /\.woff2?$/i.test(n)).length : 0;
  if (fontCount > 0) ok.push({ id: 'fonts', label: 'Fonts ready', detail: `${fontCount} typefaces` });
  else issues.push({ id: 'fonts', label: 'Fonts folder is empty', fix: 'Your FRAMEHAND copy is missing fonts/. Download or sync the project again so the fonts folder is there.' });
  return { ready: issues.length === 0, ok, issues, product: 'framehand', promise: 'FRAMEHAND runs on your computer and can’t post for you — you always click Post yourself.' };
}

const fileUrl = (f, dl = false) => (f ? `/api/file?p=${encodeURIComponent(f)}${dl ? '&dl=1' : ''}` : null);

/** A small JPG poster for the gallery (first second of the film). */
function posterFor(mp4) {
  const out = join(dirname(mp4), 'poster.jpg');
  if (!existsSync(out)) spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1.2', '-i', mp4, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', out]);
  return existsSync(out) ? out : null;
}

/** A film's id is its folder inside the data folder (e.g. "single/ui-abc"): the same in a result and in the gallery. */
const filmId = (dir) => (dir ? relative(WORK, dir).split(sep).join('/') : '');
/** The film folder for an id, only if it sits inside the data folder. */
function filmDir(id) {
  if (typeof id !== 'string' || !id || id.includes('\0') || id.split(/[\\/]+/).includes('..')) return null;
  const d = resolve(WORK, id);
  return d.startsWith(resolve(WORK) + sep) && existsSync(join(d, 'composition.json')) ? d : null;
}
const findFilm = (id) => (id && gallery(400).find((f) => f.id === id)) || null;

/** Everything the page needs about a finished film (also what the gallery lists). */
function filmPayload(r, extra = {}) {
  const parsed = r.recipe?.parsed || r.parsed || {};
  const film = {
    id: filmId(r.dir) || extra.id, look: r.look, lookLabel: r.lookLabel, planId: r.planId, seed: r.seed, format: r.format || '16:9',
    describe: r.describe, dir: r.dir, mp4: r.mp4, mp4Url: fileUrl(r.mp4), mp4Download: fileUrl(r.mp4, true),
    mp4Vertical: r.mp4Vertical || null, mp4VerticalUrl: fileUrl(r.mp4Vertical), mp4VerticalDownload: fileUrl(r.mp4Vertical, true),
    brand: parsed.brand || r.brand, headline: parsed.headline, offer: parsed.offer || r.offer, cta: parsed.cta || r.cta, parsed,
    music: !!r.music, structure: r.recipe?.plan?.structure || [], planSummary: r.recipe?.plan?.summary || '', reason: r.recipe?.reasons?.look || '',
    createdAt: extra.createdAt || Date.now(), ...extra,
  };
  const poster = r.mp4 ? posterFor(r.mp4) : null;
  film.posterUrl = fileUrl(poster);
  film.caption = captionForPlatform('x', film).caption;
  return film;
}

/** Past films under the work folder, newest first (read from each film's composition.json). */
function gallery(limit = 40) {
  const out = [];
  const visit = (dir, depth) => {
    if (depth > 3 || !existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const d = join(dir, name);
      let st; try { st = statSync(d); } catch { continue; }
      if (!st.isDirectory() || name === 'uploads' || name === 'preview' || name === 'share') continue;
      const comp = join(d, 'composition.json'), outDir = join(d, 'out');
      if (existsSync(comp) && existsSync(outDir)) {
        const vids = readdirSync(outDir).filter((n) => /\.mp4$/i.test(n)).map((n) => join(outDir, n));
        if (!vids.length) continue;
        const mp4 = vids.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
        try {
          const recipe = JSON.parse(readFileSync(comp, 'utf8')).recipe || {};
          const pair = join(d, 'pair.json');
          const pj = existsSync(pair) ? JSON.parse(readFileSync(pair, 'utf8')) : null;
          if (pj?.role === 'vertical') continue; // listed with its widescreen twin
          out.push(filmPayload({ ...recipe, recipe, dir: d, mp4, mp4Vertical: pj?.vertical && existsSync(pj.vertical) ? pj.vertical : null, describe: describeRecipe({ ...recipe, plan: recipe.plan || {}, parsed: recipe.parsed || {} }), music: !!recipe.music },
            { createdAt: statSync(mp4).mtimeMs }));
        } catch { /* a half-written film */ }
      } else visit(d, depth + 1);
    }
  };
  visit(WORK, 0);
  return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

export { doctorReport };
export async function startUi({ port = 7870, host = '127.0.0.1', data, doctor = doctorReport } = {}) {
  WORK = data ? resolve(data) : dataDir(); UPLOADS = join(WORK, 'uploads'); LAST = join(WORK, 'last.json'); KIT = join(WORK, 'brand-kit.json');
  mkdirSync(WORK, { recursive: true });
  mkdirSync(UPLOADS, { recursive: true });
  let job = null;
  let lastFilm = null;
  try { lastFilm = JSON.parse(readFileSync(LAST, 'utf8')); if (!lastFilm?.mp4 || !existsSync(lastFilm.mp4)) lastFilm = null; } catch { lastFilm = null; }
  const remember = (film) => { lastFilm = film; try { writeFileSync(LAST, JSON.stringify(film, null, 2)); } catch { /* read-only */ } };
  const clients = new Set();

  const broadcast = (event, data) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) { try { res.write(msg); } catch { /* closed */ } }
  };
  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const readBody = (req, limit) => new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { fail(new OmError(`upload too large (max ${Math.round(limit / 1e6)} MB)`, 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', fail);
  });
  const readJson = async (req) => { const b = await readBody(req, 2e6); try { return b.length ? JSON.parse(b) : {}; } catch { throw new OmError('invalid JSON'); } };

  const setPhase = (text) => { if (!job) return; job.phase = text; broadcast('phase', { id: job.id, text }); };
  const setProgress = (p) => { if (!job) return; job.progress = { ...job.progress, ...p }; broadcast('progress', { id: job.id, ...job.progress }); };
  const pushLog = (s) => {
    const line = String(s).replace(/\n$/, '');
    if (!line.trim() || !job) return;
    job.log.push(line); if (job.log.length > 800) job.log.shift();
    broadcast('log', { id: job.id, line });
  };
  const briefOpts = (body) => ({
    brief: String(body.brief || '').trim(), brand: String(body.brandName || body.brand || '').trim(), offer: String(body.offer || '').trim(),
    cta: String(body.cta || '').trim(), brandUrl: String(body.brandUrl || '').trim(), look: body.look || 'auto',
    seed: body.seed === '' || body.seed == null ? undefined : body.seed, logoPath: body.logoPath || '', screenshotPath: body.screenshotPath || '',
    madeWith: !!body.madeWith, brandColor: /^#[0-9a-f]{6}$/i.test(body.brandColor || '') ? body.brandColor : '',
  });
  const phaseText = { music: 'Composing music…', render: 'Rendering…', encode: 'Finishing the file…' };

  /** One film in the chosen format; "both" = the same film twice (16:9 and 9:16, same look and scenes). */
  async function makeFilm(opts, { format, music, outRoot, name, signal, partOffset = 0, parts = 1 }) {
    const progress = (part) => (p) => { if (p.phase) setPhase(parts > 1 ? `${phaseText[p.phase] || p.phase} (${part + 1} of ${parts})` : phaseText[p.phase] || p.phase); setProgress({ ...p, part: part + 1, parts }); };
    if (format !== 'both') {
      const r = await runBriefFilm({ ...opts, format, music, outRoot, name, signal, onLog: pushLog, onProgress: progress(partOffset) });
      return r;
    }
    const tall = composeFromBrief({ ...opts, format: '9:16' });
    const wideRecipe = composeFromBrief({ ...opts, format: '16:9', look: tall.look, plan: tall.planId, seed: tall.seed });
    const wide = await runBriefFilm({ ...opts, recipe: wideRecipe, music, outRoot, name: `${name}-16x9`, signal, onLog: pushLog, onProgress: progress(partOffset) });
    const vert = await runBriefFilm({ ...opts, recipe: tall, music, outRoot, name: `${name}-9x16`, signal, onLog: pushLog, onProgress: progress(partOffset + 1) });
    writeFileSync(join(wide.dir, 'pair.json'), JSON.stringify({ role: 'wide', vertical: vert.mp4 }));
    writeFileSync(join(vert.dir, 'pair.json'), JSON.stringify({ role: 'vertical', wide: wide.mp4 }));
    return { ...wide, mp4Vertical: vert.mp4, format: 'both' };
  }

  function startJob(kind, phase0) {
    const id = Date.now().toString(36);
    const controller = new AbortController();
    job = { id, status: 'running', kind, phase: phase0, log: [], startedAt: Date.now(), progress: {}, films: [], controller };
    broadcast('job', publicJob());
    return job;
  }
  const publicJob = () => (job ? { id: job.id, status: job.status, kind: job.kind, phase: job.phase, progress: job.progress, startedAt: job.startedAt, finishedAt: job.finishedAt, result: job.result, error: job.error, films: job.films, estimate: job.estimate } : { status: 'idle' });
  const finish = (patch) => { job = { ...job, ...patch, finishedAt: Date.now() }; broadcast('job', publicJob()); };
  const fail = (e) => finish(e?.cancelled ? { status: 'cancelled', phase: 'Stopped', error: 'Stopped. Nothing was posted or saved for this video.' } : { status: 'error', phase: 'Something went wrong', error: plainError(e) });

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${host}`);
      const path = url.pathname;

      if (path === '/api/health') return send(res, 200, { ok: true, product: 'framehand' });
      if (path === '/api/doctor' && req.method === 'GET') return send(res, 200, doctor());
      if (path === '/api/looks' && req.method === 'GET') return send(res, 200, { looks: looksForApi(), niches: NICHE_STARTERS, formats: FORMATS, auto: true, music: true });
      if (path === '/api/platforms' && req.method === 'GET') return send(res, 200, { platforms: platformsForApi(), promise: 'FRAMEHAND can’t post for you. You click Post.' });

      // what the composer would make from this brief, how long it takes, and the post caption — instant, nothing rendered
      if (path === '/api/compose' && req.method === 'POST') {
        const body = await readJson(req);
        const format = FORMATS.includes(body.format) ? body.format : '9:16';
        const recipe = composeFromBrief({ ...briefOpts(body), format: format === 'both' ? '9:16' : format });
        const film = { parsed: recipe.parsed };
        const est = estimateSeconds(recipe) * (format === 'both' ? 2 : 1) + (body.music === false ? 0 : 8);
        return send(res, 200, { recipe: { seed: recipe.seed, look: recipe.look, lookLabel: recipe.lookLabel, lookBlurb: recipe.lookBlurb, planId: recipe.planId, plan: recipe.plan, parsed: recipe.parsed, reasons: recipe.reasons, describe: describeRecipe(recipe), vertical: VERTICAL_LOOKS.has(recipe.look) },
          estimateSeconds: est, filmSeconds: +((recipe.spec?.duration || 9) + END_CARD_SECONDS).toFixed(1), caption: captionForPlatform('x', film).caption });
      }

      // fast preview: build the film (no render) and grab three stills — a few seconds
      if (path === '/api/preview' && req.method === 'POST') {
        const body = await readJson(req);
        const format = FORMATS.includes(body.format) && body.format !== 'both' ? body.format : '9:16';
        const id = Date.now().toString(36);
        const t0 = Date.now();
        const built = await buildBriefProject({ ...briefOpts(body), format, music: false, outRoot: join(WORK, 'preview'), name: `p-${id}` });
        const cues = built.recipe.spec?.cues || [];
        const D = built.recipe.spec?.duration || 9;
        const pickAt = (q) => +(q.at + (q.kind === 'number' ? 0.25 : 1.2)).toFixed(2);
        const mid = cues.filter((q) => q.kind !== 'highlight');
        const times = built.recipe.spec ? [...new Set([mid[0] ? pickAt(mid[0]) : 1.2, mid[Math.floor(mid.length / 2)] ? Math.min(D - 0.2, pickAt(mid[Math.floor(mid.length / 2)])) : D / 2, +(D + 1.6).toFixed(2)])] : [2, 6, 10.5];
        const outBase = join(WORK, 'preview', `p-${id}-stills.png`);
        await runOm(['still', built.dir, '--at', times.join(','), '--out', outBase]);
        const frames = existsSync(outBase) && statSync(outBase).isDirectory() ? readdirSync(outBase).filter((n) => n.endsWith('.png')).sort((a, b) => parseFloat(a.split('-').pop()) - parseFloat(b.split('-').pop())).map((n) => fileUrl(join(outBase, n))) : (existsSync(outBase) ? [fileUrl(outBase)] : []);
        return send(res, 200, { frames, ms: Date.now() - t0, look: built.recipe.look, lookLabel: built.recipe.lookLabel, planSummary: built.recipe.plan.summary, seed: built.recipe.seed, format, reason: built.recipe.reasons.look });
      }

      if (path === '/api/job' && req.method === 'GET') return send(res, 200, publicJob());
      if (path === '/api/last' && req.method === 'GET') return send(res, 200, lastFilm && existsSync(lastFilm.mp4) ? lastFilm : { empty: true });
      if (path === '/api/gallery' && req.method === 'GET') return send(res, 200, { films: gallery() });

      if (path === '/api/cancel' && req.method === 'POST') {
        if (!job || job.status !== 'running') return send(res, 200, { status: job?.status || 'idle' });
        setPhase('Stopping…');
        job.controller.abort();
        return send(res, 200, { status: 'stopping' });
      }

      if (path === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, job: publicJob() })}\n\n`);
        clients.add(res);
        const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 15000);
        req.on('close', () => { clearInterval(ping); clients.delete(res); });
        return;
      }

      // Binary upload: POST /api/upload?kind=logo|screenshot&name=file.png — iPhone HEIC is converted, big pictures scaled to ≤2000 px
      if (path === '/api/upload' && req.method === 'POST') {
        const kind = (url.searchParams.get('kind') || 'file').replace(/[^\w-]/g, '');
        const name = basename(url.searchParams.get('name') || `upload${Date.now()}`);
        const ext = extname(name).toLowerCase() || '.png';
        if (!/\.(png|jpe?g|webp|gif|svg|heic|heif)$/i.test(ext)) return send(res, 400, { error: 'Please add a picture (PNG, JPG, WebP, GIF, SVG or iPhone HEIC).' });
        const buf = await readBody(req, 25e6);
        const dest = join(UPLOADS, `${kind}-${Date.now().toString(36)}${ext === '.jpeg' ? '.jpg' : ext}`);
        writeFileSync(dest, buf);
        let final = dest;
        try { final = prepareImage(dest); } catch (e) { return send(res, 400, { error: e.message }); }
        return send(res, 200, { path: final, kind, name, converted: final !== dest, url: fileUrl(final) });
      }

      if ((path === '/api/render' || path === '/api/batch') && req.method === 'POST') {
        if (job && job.status === 'running') return send(res, 409, { error: 'Already making a video — wait for it, or press Stop.' });
        const body = await readJson(req);
        const opts = briefOpts(body);
        if (!opts.brief && !opts.brand) return send(res, 400, { error: 'Write a line about what you want to promote first.' });
        const format = FORMATS.includes(body.format) ? body.format : '9:16';
        const music = body.music !== false;
        const isBatch = path === '/api/batch';
        const count = isBatch ? Math.max(2, Math.min(6, Number(body.count) || 3)) : 1;
        const j = startJob(isBatch ? 'batch' : 'single', isBatch ? `Writing ${count} different videos…` : 'Writing your video…');
        const probe = composeFromBrief({ ...opts, format: format === 'both' ? '9:16' : format });
        j.estimate = (estimateSeconds(probe) + (music ? 3 : 0)) * (format === 'both' ? 2 : 1) * count;
        send(res, 202, { id: j.id, status: 'running', estimate: j.estimate });
        broadcast('job', publicJob());
        (async () => {
          try {
            if (!isBatch) {
              const r = await makeFilm(opts, { format, music, outRoot: join(WORK, 'single'), name: `ui-${j.id}`, signal: j.controller.signal, parts: format === 'both' ? 2 : 1 });
              const film = filmPayload(r, { madeWith: opts.madeWith });
              remember(film);
              finish({ status: 'done', phase: 'Ready', result: film });
            } else {
              const recipes = [];
              const base = composeFromBrief({ ...opts, format: format === 'both' ? '9:16' : format });
              const { composeVariants } = await import('./compose-brief.js');
              recipes.push(...composeVariants({ ...opts, seed: base.seed, format: format === 'both' ? '9:16' : format }, count));
              const films = [];
              for (let i = 0; i < recipes.length; i++) {
                const rc = recipes[i];
                setPhase(`Video ${i + 1} of ${recipes.length}: ${rc.lookLabel}`);
                const r = await makeFilm({ ...opts, look: rc.look, plan: rc.planId, seed: rc.seed }, { format, music, outRoot: join(WORK, 'batch', j.id), name: `${String(i + 1).padStart(2, '0')}-${rc.look}`, signal: j.controller.signal, partOffset: 0, parts: format === 'both' ? 2 : 1 });
                const film = filmPayload(r, { index: i + 1, total: recipes.length, madeWith: opts.madeWith });
                films.push(film); job.films = films;
                broadcast('film', film);
              }
              if (films[0]) remember(films[0]);
              finish({ status: 'done', phase: 'Ready', result: { films } });
            }
          } catch (e) { fail(e); }
        })();
        return;
      }

      // Share pack: the right video for the platform + caption (never posts)
      if (path === '/api/share/pack' && req.method === 'POST') {
        const body = await readJson(req);
        const platformId = String(body.platform || 'x');
        const film = findFilm(body.id) || (!body.id ? lastFilm : null);
        if (!film?.mp4) return send(res, 400, { error: body.id ? 'That video is gone — pick another one.' : 'Make a video first, then export a pack.' });
        const outDir = join(WORK, 'share', `${platformId}-${Date.now().toString(36)}`);
        try {
          const pack = writeSharePack({ platformId, outDir, film, madeWith: !!body.madeWith });
          return send(res, 200, { ...pack, videoUrl: fileUrl(pack.video, true), captionUrl: fileUrl(pack.captionFile, true), readmeUrl: fileUrl(join(outDir, 'README.txt')), folder: outDir, promise: 'Saved on this computer. Nothing was posted.' });
        } catch (e) { return send(res, 400, { error: plainError(e) }); }
      }

      if (path === '/api/share/caption' && req.method === 'POST') {
        const body = await readJson(req);
        const film = findFilm(body.id) || lastFilm || {};
        const caps = captionForPlatform(body.platform || 'x', film, { madeWith: !!body.madeWith });
        return send(res, 200, { ...caps, openUrl: openUrl(body.platform || 'x', caps.caption) });
      }

      // the right video for one platform, as a plain download (9:16 for Reels / TikTok / Shorts when there is one)
      if (path === '/api/share/video' && req.method === 'GET') {
        const id = url.searchParams.get('id'), platformId = url.searchParams.get('platform') || 'x';
        const film = findFilm(id) || (!id ? lastFilm : null);
        const { file } = film ? videoFor(platformId, film) : {};
        if (!file || !servableFile(file)) return send(res, 404, { error: 'Make a video first.' });
        const slug = String(film.brand || 'framehand').normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'framehand';
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': statSync(file).size, 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${slug}-${platformId}.mp4"` });
        return createReadStream(file).pipe(res);
      }

      // every platform's pack in one zip: x/video.mp4, x/caption.txt, instagram/… (never posts)
      if (path === '/api/share/all' && req.method === 'GET') {
        const film = findFilm(url.searchParams.get('id')) || (!url.searchParams.get('id') ? lastFilm : null);
        if (!film?.mp4) return send(res, 400, { error: 'Make a video first.' });
        const madeWith = url.searchParams.get('madeWith') === '1';
        const stamp = Date.now().toString(36), entries = [];
        for (const p of platformsForApi()) {
          const outDir = join(WORK, 'share', `all-${stamp}`, p.id);
          writeSharePack({ platformId: p.id, outDir, film, madeWith });
          for (const n of readdirSync(outDir)) entries.push({ name: `${p.id}/${n}`, data: readFileSync(join(outDir, n)) });
        }
        const slug = String(film.brand || 'framehand').normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'framehand';
        const body = zip(entries);
        res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${slug}-share-packs.zip"` });
        return res.end(body);
      }

      // delete one of "Your videos" (its folder, and its 9:16 twin when it was made as Both)
      if (path === '/api/film/delete' && req.method === 'POST') {
        const body = await readJson(req);
        const d = filmDir(body.id);
        if (!d) return send(res, 404, { error: 'That video is already gone.' });
        if (job?.status === 'running') return send(res, 409, { error: 'Wait until the current video is finished, then delete.' });
        const pair = join(d, 'pair.json');
        let twin = null;
        try { const pj = JSON.parse(readFileSync(pair, 'utf8')); twin = pj.vertical ? dirname(dirname(pj.vertical)) : null; } catch { /* single shape */ }
        const victims = [d, twin].filter((x) => x && resolve(x).startsWith(resolve(WORK) + sep));
        for (const v of victims) rmSync(v, { recursive: true, force: true });
        if (lastFilm && (lastFilm.id === body.id || victims.some((v) => lastFilm.dir === v))) { lastFilm = null; rmSync(LAST, { force: true }); }
        return send(res, 200, { ok: true, deleted: body.id });
      }

      // brand kit: the logo and colour the app remembers for every new video (kept in the data folder)
      if (path === '/api/brandkit') {
        if (req.method === 'GET') { try { return send(res, 200, JSON.parse(readFileSync(KIT, 'utf8'))); } catch { return send(res, 200, { empty: true }); } }
        if (req.method === 'DELETE') { rmSync(KIT, { force: true }); return send(res, 200, { empty: true }); }
        if (req.method === 'POST') {
          const b = await readJson(req);
          const logoPath = b.logoPath && servableFile(b.logoPath) ? servableFile(b.logoPath) : '';
          const kit = { logoPath, logoUrl: logoPath ? fileUrl(logoPath) : '', logoName: String(b.logoName || '').slice(0, 120),
            color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color.toLowerCase() : '', brandName: String(b.brandName || '').slice(0, 80), savedAt: Date.now() };
          writeFileSync(KIT, JSON.stringify(kit, null, 2));
          return send(res, 200, kit);
        }
      }

      if (path === '/api/file' && req.method === 'GET') {
        const p = url.searchParams.get('p');
        if (!p) return send(res, 400, { error: 'missing file' });
        const file = servableFile(p);
        if (!file) return send(res, 404, { error: 'not found' });
        const ext = extname(file).toLowerCase();
        const size = statSync(file).size;
        const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
          'Content-Disposition': `${url.searchParams.get('dl') ? 'attachment' : 'inline'}; filename="${basename(file)}"` };
        // byte ranges: Safari needs them to play and seek a video
        const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (range) {
          const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
          const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
          if (start >= size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
          res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
          return createReadStream(file, { start, end }).pipe(res);
        }
        res.writeHead(200, { ...headers, 'Content-Length': size });
        return createReadStream(file).pipe(res);
      }

      // the bundled typefaces, for the app's own look (no outside font requests)
      if (path.startsWith('/fonts/') && req.method === 'GET') {
        const name = basename(path);
        const f = join(PKG, 'fonts', name);
        if (!/^[\w.-]+\.woff2?$/.test(name) || !existsSync(f)) return send(res, 404, { error: 'not found' });
        res.writeHead(200, { 'Content-Type': name.endsWith('2') ? 'font/woff2' : 'font/woff', 'Cache-Control': 'max-age=86400' });
        return res.end(readFileSync(f));
      }

      // static UI
      const rel = path === '/' ? '/index.html' : path;
      if (rel.includes('..')) return send(res, 400, { error: 'bad path' });
      const file = join(UI_DIR, rel.replace(/^\//, ''));
      if (!file.startsWith(UI_DIR) || !existsSync(file)) return send(res, 404, { error: 'not found' });
      return send(res, 200, readFileSync(file), TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
    } catch (e) {
      const status = e instanceof OmError && e.status ? e.status : 500;
      return send(res, status, { error: plainError(e) });
    }
  });

  await new Promise((ok, failListen) => { server.once('error', failListen); server.listen(port, host, ok); });
  const realPort = server.address()?.port || port; // port 0 = any free port (tests)
  const url = `http://${host}:${realPort}/`;
  return { url, host, port: realPort, data: WORK, close: () => new Promise((ok) => { for (const c of clients) { try { c.end(); } catch { /* closed */ } } server.close(ok); }) };
}

function plainError(e) {
  const msg = (e && e.message) || String(e);
  if (/Chrome|browser/i.test(msg) && /not found|NO_CHROME/i.test(msg)) return 'Chrome was not found. Install Google Chrome, then try again.';
  if (/ffmpeg/i.test(msg) && /not found|ENOENT|missing/i.test(msg)) return 'Video tools (FFmpeg) are missing. Install FFmpeg, then try again.';
  if (/ENOENT/i.test(msg)) return 'A needed file was missing. Check Setup at the top of this page.';
  if (/can't be made from this brief/i.test(msg)) return msg;
  return msg.split('\n').slice(0, 4).join(' ').slice(0, 400);
}
