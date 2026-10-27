// FRAMEHAND app. Talks only to this computer (127.0.0.1). It never posts: every share button prepares, you click Post.
'use strict';
const $ = (id) => document.getElementById(id);
const state = {
  logoPath: '', screenshotPath: '', seed: '', last: null, platforms: [], format: localStorage.fhShape || '9:16',
  view: null, safe: localStorage.fhSafe === '1', running: false, kind: null, startedAt: 0, estimate: 0, color: '', kit: null,
  films: [], batch: null, rate: null, gallery: [],
};
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$('kbdMod').textContent = isMac ? '⌘' : 'Ctrl';

// ---------- small helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const clock = (s) => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const roughly = (s) => (s < 60 ? `about ${Math.max(10, Math.round(s / 5) * 5)} seconds` : `about ${Math.round(s / 60)} minute${Math.round(s / 60) === 1 ? '' : 's'}`);
function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast' + (kind === 'err' ? ' err' : ''); t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  t.innerHTML = icon(kind === 'err' ? 'alert' : 'check') + `<span>${esc(msg)}</span>`;
  $('toasts').appendChild(t);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 200); }, kind === 'err' ? 5000 : 2800);
}
function setPhase(kind, text) { $('dot').className = 'dot' + (kind ? ' ' + kind : ''); $('phaseText').textContent = text; }
function appendLog(line) { const log = $('log'); log.textContent += line + '\n'; if (log.textContent.length > 60000) log.textContent = log.textContent.slice(-40000); log.scrollTop = log.scrollHeight; }
async function api(url, opts = {}) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText || 'Something went wrong');
  return j;
}
const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* older browsers, or no permission */ }
  const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove(); return ok;
}

function fields() {
  return {
    brief: $('brief').value.trim(), brandUrl: $('brandUrl').value.trim(), brandName: $('brandName').value.trim(), offer: $('offer').value.trim(), cta: $('cta').value.trim(),
    look: $('look').value || 'auto', seed: $('seed').value.trim() || state.seed || undefined,
    logoPath: state.logoPath || undefined, screenshotPath: state.screenshotPath || undefined, brandColor: state.color || undefined,
    format: state.format, music: $('music').checked, madeWith: $('madeWith').checked,
  };
}

// ---------- brief + examples ----------
const EXAMPLES = {
  barber: 'Northside Barbers. Skin fade + beard trim £25 this week. Book your chair',
  cafe: 'Little Owl Café. 2 for 1 flat whites before 10am. Come by today',
  gym: 'Iron Yard Gym. First week free for new members. Start today',
  shop: 'Fern & Co. plant shop. 20% off all houseplants this weekend. Visit us',
};
function briefCount() { const n = $('brief').value.trim().length; $('briefCount').textContent = n ? `${n} characters` : ''; }
$('examples').onclick = (ev) => {
  const b = ev.target.closest('[data-ex]'); if (!b) return;
  $('brief').value = EXAMPLES[b.dataset.ex]; localStorage.fhBrief = $('brief').value;
  for (const x of $('examples').querySelectorAll('[data-ex]')) x.classList.toggle('on', x === b);
  briefCount(); planAhead(); $('brief').focus();
};
$('brief').addEventListener('input', () => { localStorage.fhBrief = $('brief').value; for (const x of $('examples').querySelectorAll('[data-ex]')) x.classList.remove('on'); briefCount(); planAhead(); });

// ---------- shape + preview view ----------
function setFormat(f) {
  state.format = f; localStorage.fhShape = f;
  for (const b of $('formatSeg').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.f === f); b.setAttribute('aria-checked', String(b.dataset.f === f)); }
  if (!state.last) setView(f === '16:9' ? 'wide' : f === '1:1' ? 'square' : 'vertical');
  planAhead();
}
$('formatSeg').onclick = (ev) => { const b = ev.target.closest('button[data-f]'); if (b) setFormat(b.dataset.f); };
for (const b of $('formatSeg').querySelectorAll('button')) { b.classList.toggle('on', b.dataset.f === state.format); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(b.dataset.f === state.format)); }

/** Which file the stage plays for a film in a given view (a "Both" film has one of each). */
const fileFor = (f, v) => (v === 'vertical' && f.mp4VerticalUrl ? f.mp4VerticalUrl : f.mp4Url);
const shapeOf = (f) => (f.format === 'both' ? 'both' : f.format === '16:9' ? 'wide' : f.format === '1:1' ? 'square' : 'vertical');
function setView(v) {
  state.view = v;
  $('frame').className = 'frame ' + v;
  for (const b of $('viewSeg').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v || (v === 'square' && b.dataset.v === 'vertical'));
  $('btnSafe').disabled = v !== 'vertical';
  $('safe').hidden = !(state.safe && v === 'vertical');
  const f = state.last;
  if (f) { const src = fileFor(f, v); const p = $('player'); if (p.dataset.src !== src) { p.src = src; p.dataset.src = src; } }
}
$('viewSeg').onclick = (ev) => {
  const b = ev.target.closest('button[data-v]'); if (!b || b.disabled) return;
  setView(b.dataset.v);
};
$('btnSafe').onclick = () => {
  state.safe = !state.safe; localStorage.fhSafe = state.safe ? '1' : '0';
  $('btnSafe').classList.toggle('on', state.safe); $('btnSafe').setAttribute('aria-pressed', String(state.safe));
  $('safe').hidden = !(state.safe && state.view === 'vertical');
};
$('btnSafe').classList.toggle('on', state.safe); $('btnSafe').setAttribute('aria-pressed', String(state.safe));
// the two switches are remembered on this computer
if (localStorage.fhMusic) $('music').checked = localStorage.fhMusic === '1';
if (localStorage.fhMadeWith) $('madeWith').checked = localStorage.fhMadeWith === '1';
$('music').onchange = () => { localStorage.fhMusic = $('music').checked ? '1' : '0'; planAhead(); };
$('madeWith').onchange = () => { localStorage.fhMadeWith = $('madeWith').checked ? '1' : '0'; planAhead(); if (state.last) renderPlatforms(state.last); };

// ---------- uploads: click, drop on a slot, drop anywhere, paste ----------
async function upload(kind, file) {
  const q = new URLSearchParams({ kind, name: file.name || `${kind}.png` });
  const r = await fetch('/api/upload?' + q, { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Upload failed');
  return j;
}
const SLOTS = {
  logo: { input: 'logoFile', drop: 'logoDrop', name: 'logoName', thumb: 'logoThumb', rm: 'logoRm', key: 'logoPath', idle: 'Drop, paste or click' },
  screenshot: { input: 'shotFile', drop: 'shotDrop', name: 'shotName', thumb: 'shotThumb', rm: 'shotRm', key: 'screenshotPath', idle: 'Photo of your shop, product or app' },
};
function fillSlot(kind, { path, url, name }) {
  const s = SLOTS[kind];
  state[s.key] = path; $(s.thumb).src = url; $(s.drop).classList.add('has'); $(s.name).textContent = name || 'Added';
}
function clearSlot(kind) {
  const s = SLOTS[kind];
  state[s.key] = ''; $(s.drop).classList.remove('has'); $(s.thumb).removeAttribute('src'); $(s.name).textContent = s.idle; $(s.input).value = '';
}
async function take(kind, f) {
  if (!f) return;
  if (!/^image\//.test(f.type) && !/\.(png|jpe?g|webp|gif|svg|heic|heif)$/i.test(f.name || '')) return toast('That isn’t a picture. Use PNG, JPG, WebP, SVG or iPhone HEIC.', 'err');
  const s = SLOTS[kind];
  try {
    $(s.name).textContent = /\.(heic|heif)$/i.test(f.name || '') ? 'Converting iPhone photo…' : 'Adding…';
    const up = await upload(kind, f);
    fillSlot(kind, { path: up.path, url: up.url, name: f.name || (kind === 'logo' ? 'Pasted logo' : 'Pasted photo') });
    toast(kind === 'logo' ? 'Logo added. It goes on every video.' : 'Photo added');
    if (kind === 'logo') saveKit();
    planAhead();
  } catch (e) { $(s.name).textContent = 'Try again'; toast(e.message, 'err'); }
}
for (const [kind, s] of Object.entries(SLOTS)) {
  $(s.input).onchange = () => take(kind, $(s.input).files && $(s.input).files[0]);
  $(s.rm).onclick = (ev) => { ev.preventDefault(); ev.stopPropagation(); clearSlot(kind); if (kind === 'logo') saveKit(); planAhead(); toast(kind === 'logo' ? 'Logo removed' : 'Photo removed'); };
  const d = $(s.drop);
  d.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.stopPropagation(); d.classList.add('drag'); });
  d.addEventListener('dragleave', () => d.classList.remove('drag'));
  d.addEventListener('drop', (ev) => { ev.preventDefault(); ev.stopPropagation(); d.classList.remove('drag'); hideDropzone(); take(kind, ev.dataTransfer.files && ev.dataTransfer.files[0]); });
}
// anywhere on the window: a full-screen target with two halves (logo | photo)
let dragDepth = 0;
const hasFiles = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');
function hideDropzone() { dragDepth = 0; $('dropzone').hidden = true; for (const z of $('dropzone').children) z.classList.remove('hot'); }
window.addEventListener('dragenter', (ev) => { if (!hasFiles(ev)) return; dragDepth++; $('dropzone').hidden = false; });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) hideDropzone(); });
window.addEventListener('dragover', (ev) => {
  if (!hasFiles(ev)) return; ev.preventDefault();
  const z = ev.target.closest && ev.target.closest('#dropzone [data-slot]');
  for (const x of $('dropzone').children) x.classList.toggle('hot', x === z);
});
window.addEventListener('drop', (ev) => {
  if (!hasFiles(ev)) return; ev.preventDefault();
  const z = ev.target.closest && ev.target.closest('#dropzone [data-slot]');
  const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
  hideDropzone();
  take(z ? z.dataset.slot : (state.logoPath ? 'screenshot' : 'logo'), f);
});
// paste a picture: goes to the logo slot when it is empty, otherwise to the photo
window.addEventListener('paste', (ev) => {
  const item = [...(ev.clipboardData?.items || [])].find((i) => i.kind === 'file' && /^image\//.test(i.type));
  if (!item) return;
  ev.preventDefault();
  const f = item.getAsFile();
  const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const named = new File([f], `pasted.${ext}`, { type: f.type });
  take(state.logoPath ? 'screenshot' : 'logo', named);
});

// ---------- brand colour + brand kit (remembered in FRAMEHAND's data folder) ----------
function setColor(c, { save = true } = {}) {
  state.color = c || '';
  for (const b of $('colors').querySelectorAll('.sw')) b.classList.toggle('on', (b.dataset.c || '') === state.color);
  if (c && ![...$('colors').querySelectorAll('.sw')].some((b) => b.dataset.c === c)) $('brandColor').value = c;
  if (save) saveKit();
  planAhead();
}
$('colors').onclick = (ev) => { const b = ev.target.closest('.sw'); if (b) setColor(b.dataset.c || ''); };
$('brandColor').oninput = () => { state.color = $('brandColor').value; for (const b of $('colors').querySelectorAll('.sw')) b.classList.remove('on'); };
$('brandColor').onchange = () => setColor($('brandColor').value);
async function saveKit() {
  if (!$('rememberKit').checked) return;
  try {
    state.kit = await post('/api/brandkit', { logoPath: state.logoPath, logoName: $('logoName').textContent, color: state.color });
    $('btnForgetKit').hidden = false;
  } catch (e) { toast(e.message, 'err'); }
}
$('rememberKit').onchange = async () => {
  if ($('rememberKit').checked) { await saveKit(); toast('Saved. Your logo and colour come back next time.'); }
  else { await api('/api/brandkit', { method: 'DELETE' }).catch(() => {}); $('btnForgetKit').hidden = true; toast('Forgotten. Nothing is remembered now.'); }
};
$('btnForgetKit').onclick = async () => {
  await api('/api/brandkit', { method: 'DELETE' }).catch(() => {});
  $('rememberKit').checked = false; $('btnForgetKit').hidden = true; clearSlot('logo'); setColor('', { save: false });
  toast('Brand kit forgotten');
};
async function loadKit() {
  try {
    const k = await api('/api/brandkit');
    if (k.empty) return;
    state.kit = k; $('rememberKit').checked = true; $('btnForgetKit').hidden = false;
    if (k.logoPath && k.logoUrl) fillSlot('logo', { path: k.logoPath, url: k.logoUrl, name: k.logoName || 'Your logo' });
    if (k.color) setColor(k.color, { save: false });
  } catch { /* first run */ }
}

// ---------- setup check ----------
async function loadDoctor() {
  try {
    const d = await api('/api/doctor');
    $('setupCard').hidden = d.ready; $('setupPill').hidden = d.ready;
    $('setupList').innerHTML = d.issues.map((x) => `<li><b>${esc(x.label)}.</b> ${esc(x.fix)}${x.url ? ` <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.link || 'Download')}</a>` : ''}</li>`).join('');
    $('setupOk').textContent = d.ok.length ? 'Ready: ' + d.ok.map((x) => x.label.replace(/ ready$/, '')).join(' · ') : '';
    return d;
  } catch { return null; }
}
$('btnRecheck').onclick = async () => { const d = await loadDoctor(); toast(d?.ready ? 'All set. You can make videos now.' : 'Still missing something. Follow the links above.', d?.ready ? 'ok' : 'err'); };
$('setupPill').onclick = () => $('setupCard').scrollIntoView({ behavior: 'smooth' });

async function loadLooks() {
  const data = await api('/api/looks');
  const sel = $('look');
  for (const l of data.looks) { const o = document.createElement('option'); o.value = l.id; o.textContent = `${l.label} — ${l.blurb}`; sel.appendChild(o); }
}

// ---------- share rail ----------
const MONO = { x: 'X', instagram: 'IG', tiktok: 'TT', 'youtube-shorts': 'YT', linkedin: 'in' };
async function loadPlatforms() {
  state.platforms = (await api('/api/platforms')).platforms || [];
  // before the first video: the same list, waiting
  $('platformsIdle').innerHTML = state.platforms.map((p) => `<li class="plat"><div class="ph"><span class="mono" aria-hidden="true">${MONO[p.id] || esc(p.label[0])}</span>
    <div class="grow"><div class="pname">${esc(p.label)}</div><div class="pmeta">${p.shape === 'vertical' ? '9:16 video' : 'Any shape'} · up to ${p.captionMax} characters</div></div></div>
    <div class="pbtns"><button class="btn sm" type="button" disabled>${icon('copy')}Copy caption</button><button class="btn sm" type="button" disabled>${icon('download')}Download</button><a class="btn sm" href="${esc(p.composerUrl)}" target="_blank" rel="noopener">${icon('external')}Open</a></div></li>`).join('');
}
async function renderPlatforms(f) {
  const madeWith = $('madeWith').checked;
  const q = (pid) => new URLSearchParams({ platform: pid, id: f.id || '' });
  const caps = await Promise.all(state.platforms.map((p) => post('/api/share/caption', { platform: p.id, id: f.id, madeWith }).catch(() => ({ caption: f.caption || '', openUrl: p.composerUrl }))));
  if (state.last !== f) return;
  $('platforms').innerHTML = state.platforms.map((p, i) => {
    const c = caps[i] || {}, cap = c.caption || '', vert = p.shape === 'vertical';
    const shapeNote = vert && !f.mp4Vertical && f.format !== '9:16' ? '<span class="warn">wide video — pick Vertical for full screen</span>' : vert ? '9:16 video' : 'Any shape';
    return `<li class="plat" data-id="${esc(p.id)}">
      <div class="ph"><span class="mono" aria-hidden="true">${MONO[p.id] || esc(p.label[0])}</span>
        <div class="grow"><div class="pname">${esc(p.label)}</div><div class="pmeta num">${shapeNote} · ${cap.length}/${p.captionMax}</div></div></div>
      <p class="cap" data-cap title="Click to see it all">${esc(cap)}</p>
      <div class="pbtns">
        <button class="btn sm" type="button" data-copy>${icon('copy')}Copy caption</button>
        <a class="btn sm" data-dl href="/api/share/video?${q(p.id)}" download>${icon('download')}Download</a>
        <a class="btn sm" data-open href="${esc(c.openUrl || p.composerUrl)}" target="_blank" rel="noopener">${icon('external')}Open</a>
      </div></li>`;
  }).join('');
  $('platforms').dataset.captions = '1'; $('platforms').dataset.film = f.id || '';
  state.captions = Object.fromEntries(state.platforms.map((p, i) => [p.id, caps[i]?.caption || '']));
  $('btnZip').href = `/api/share/all?${new URLSearchParams({ id: f.id || '', madeWith: madeWith ? '1' : '0' })}`;
}
$('platforms').onclick = async (ev) => {
  const li = ev.target.closest('.plat'); if (!li) return;
  const p = state.platforms.find((x) => x.id === li.dataset.id);
  if (ev.target.closest('[data-cap]')) { ev.target.closest('[data-cap]').classList.toggle('open'); return; }
  if (ev.target.closest('[data-copy]')) {
    const ok = await copyText(state.captions?.[p.id] || '');
    toast(ok ? `${p.label} caption copied. Paste it when you post.` : 'Couldn’t copy. Select the caption and copy it yourself.', ok ? 'ok' : 'err');
  } else if (ev.target.closest('[data-dl]')) toast(`${p.label} video downloading`);
  else if (ev.target.closest('[data-open]')) toast(`Opened ${p.label}. Attach the video, paste the caption, then click Post yourself.`);
};
$('btnZip').onclick = () => toast('Downloading every app’s video and caption as one .zip');
$('btnDownload').onclick = () => toast('Video downloading');
$('btnDownloadV').onclick = () => toast('9:16 video downloading');

function selectTab(which) {
  const share = which === 'share';
  $('tabShare').setAttribute('aria-selected', String(share)); $('tabVideos').setAttribute('aria-selected', String(!share));
  $('paneShare').hidden = !share; $('paneVideos').hidden = share;
}
$('tabShare').onclick = () => selectTab('share');
$('tabVideos').onclick = () => selectTab('videos');
document.querySelector('.tabs').addEventListener('keydown', (ev) => {
  if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
  const next = $('tabShare').getAttribute('aria-selected') === 'true' ? 'videos' : 'share';
  selectTab(next); $(next === 'share' ? 'tabShare' : 'tabVideos').focus();
});

// ---------- showing a film ----------
function showStage(kind) { // 'empty' | 'skeleton' | 'video' | 'compare'
  $('stageEmpty').hidden = kind !== 'empty';
  $('skeleton').hidden = kind !== 'skeleton';
  $('player').hidden = kind !== 'video';
  $('overlayMsg').hidden = kind !== 'skeleton';
  $('compare').hidden = kind !== 'compare';
  $('frame').hidden = kind === 'compare';
  if (kind !== 'skeleton') $('poster').hidden = true;
}
function showSingle(f, { play = false } = {}) {
  if (!f) return;
  state.last = f;
  const shape = shapeOf(f);
  for (const b of $('viewSeg').querySelectorAll('button')) b.disabled = shape !== 'both' && !((b.dataset.v === 'vertical') === (shape === 'vertical' || shape === 'square'));
  setView(shape === 'both' ? (state.view === 'wide' ? 'wide' : 'vertical') : shape);
  showStage('video');
  $('stills').innerHTML = '';
  $('resTitle').textContent = f.brand || f.headline || 'Your video';
  $('planMeta').textContent = [f.lookLabel, f.format === 'both' ? '16:9 + 9:16' : f.format, f.music ? 'music' : 'silent', f.seed != null ? `variation ${f.seed}` : ''].filter(Boolean).join(' · ');
  $('btnDownload').href = f.mp4Download || f.mp4Url; $('btnDownload').querySelector('span').textContent = f.mp4Vertical ? 'Download 16:9' : 'Download MP4';
  $('btnDownloadV').hidden = !f.mp4Vertical; if (f.mp4Vertical) $('btnDownloadV').href = f.mp4VerticalDownload || f.mp4VerticalUrl;
  $('silentNote').hidden = !!f.music;
  $('shareEmpty').hidden = true; $('platformsIdle').hidden = true; $('shareBody').hidden = false;
  for (const c of $('gallery').querySelectorAll('.gcard')) c.classList.toggle('cur', c.dataset.id === f.id);
  renderPlatforms(f);
  if (play) $('player').play().catch(() => {});
}
function showEmpty() {
  state.last = null; $('player').removeAttribute('src'); delete $('player').dataset.src; $('player').load();
  showStage('empty'); $('shareEmpty').hidden = false; $('platformsIdle').hidden = false; $('shareBody').hidden = true;
  for (const b of $('viewSeg').querySelectorAll('button')) b.disabled = false;
  setView(state.format === '16:9' ? 'wide' : state.format === '1:1' ? 'square' : 'vertical');
}

// "Make 3 versions": side by side, filled in as each one finishes
function renderCompare() {
  const b = state.batch; if (!b) return;
  showStage('compare');
  const v = state.format === '16:9' ? 'wide' : state.format === '1:1' ? 'square' : 'vertical';
  const cards = [];
  for (let i = 0; i < b.total; i++) {
    const f = b.films[i];
    cards.push(`<div class="vcard${f && state.last && state.last.id === f.id ? ' sel' : ''}" data-i="${i}">
      <div class="vhead"><b><span class="vnum">${i + 1}</span>${f ? esc(f.lookLabel) : i === b.films.length && state.running ? 'Making…' : 'Waiting'}</b>${f ? `<button class="btn sm" type="button" data-use="${i}">${icon('check')}Use this</button>` : ''}</div>
      <div class="vf">${f ? `<div class="frame ${v}"><video src="${esc(fileFor(f, v))}" controls playsinline preload="metadata" muted loop></video></div>` : `<div class="slot">${i === b.films.length && state.running ? 'Rendering' : 'Next'}</div>`}</div>
    </div>`);
  }
  $('compare').innerHTML = cards.join('');
}
$('compare').onclick = (ev) => {
  const u = ev.target.closest('[data-use]'); if (!u) return;
  const f = state.batch.films[Number(u.dataset.use)];
  state.last = f; renderPlatformsAndMeta(f); renderCompare();
  toast(`Version ${Number(u.dataset.use) + 1} picked. Share buttons use this one.`);
};
function renderPlatformsAndMeta(f) {
  $('resTitle').textContent = f.brand || f.headline || 'Your video';
  $('planMeta').textContent = [f.lookLabel, f.format, f.music ? 'music' : 'silent', `variation ${f.seed}`].join(' · ');
  $('btnDownload').href = f.mp4Download; $('btnDownloadV').hidden = !f.mp4Vertical; if (f.mp4Vertical) $('btnDownloadV').href = f.mp4VerticalDownload;
  $('silentNote').hidden = !!f.music; $('shareEmpty').hidden = true; $('platformsIdle').hidden = true; $('shareBody').hidden = false;
  renderPlatforms(f);
}

// ---------- your videos ----------
async function loadGallery() {
  try {
    const { films } = await api('/api/gallery');
    state.gallery = films;
    $('videoCount').textContent = String(films.length);
    $('gallery').innerHTML = films.length ? films.map((f) => `<div class="gcard${state.last && state.last.id === f.id ? ' cur' : ''}" data-id="${esc(f.id)}">
      <button class="gp" type="button" data-load aria-label="Play ${esc(f.brand || 'video')}">${f.posterUrl ? `<img src="${esc(f.posterUrl)}" alt="" loading="lazy">` : ''}<span class="shape num">${f.mp4Vertical ? '16:9 + 9:16' : esc(f.format || '16:9')}</span><span class="play">${icon('play')}</span></button>
      <div class="gm"><b>${esc(f.brand || f.headline || 'Video')}</b><span class="num">${esc(f.lookLabel || '')} · ${new Date(f.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${new Date(f.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="gb"><a class="btn ghost sm" href="${esc(f.mp4Download)}" download aria-label="Download">${icon('download')}</a><span class="grow"></span><button class="btn ghost sm" type="button" data-del aria-label="Delete">${icon('trash')}</button></div>
    </div>`).join('') : '<div class="nothing" style="grid-column:1/-1"><b>No videos yet.</b>Everything you make is kept on this computer and listed here.</div>';
  } catch { /* server restarting */ }
}
$('gallery').onclick = async (ev) => {
  const card = ev.target.closest('.gcard'); if (!card) return;
  const f = state.gallery.find((x) => x.id === card.dataset.id); if (!f) return;
  if (ev.target.closest('[data-load]')) { state.batch = null; showSingle(f, { play: true }); selectTab('share'); return; }
  const del = ev.target.closest('[data-del]');
  if (del) {
    if (!del.classList.contains('confirm')) { // two steps: no accidental deletes
      del.classList.add('confirm'); del.innerHTML = `${icon('trash')}Delete?`;
      setTimeout(() => { if (del.isConnected) { del.classList.remove('confirm'); del.innerHTML = icon('trash'); } }, 3500);
      return;
    }
    try {
      await post('/api/film/delete', { id: f.id });
      if (state.last && state.last.id === f.id) showEmpty();
      toast('Video deleted from this computer');
      loadGallery();
    } catch (e) { toast(e.message, 'err'); }
  }
};

// ---------- plan ahead (instant): style and time ----------
let planTimer = 0;
function planAhead() { clearTimeout(planTimer); planTimer = setTimeout(planNow, 250); }
async function planNow() {
  const f = fields();
  if (!f.brief && !f.brandName) { $('estimate').textContent = ''; return; }
  try {
    const r = await post('/api/compose', f);
    state.seed = String(r.recipe.seed);
    if (!$('seed').value) $('seed').placeholder = `Random (next: ${r.recipe.seed})`;
    const shape = { both: 'a wide and a vertical video', '9:16': 'a vertical video', '16:9': 'a wide video', '1:1': 'a square video' }[state.format];
    $('estimate').innerHTML = `Next video: <b>${esc(r.recipe.lookLabel)}</b> · ${shape}, ${r.filmSeconds} s · takes ${roughly(r.estimateSeconds)} here`;
  } catch (e) { $('estimate').textContent = e.message; }
}
for (const id of ['brandName', 'offer', 'cta', 'look', 'seed', 'brandUrl']) $(id).addEventListener('change', planAhead);
$('btnRandSeed').onclick = () => { const s = (Math.random() * 1e9) >>> 0; $('seed').value = String(s); state.seed = String(s); planAhead(); };
$('btnShuffle').onclick = () => { $('btnRandSeed').click(); toast('New variation picked. Press Quick look or Make video.'); };

// ---------- quick look: three stills in a few seconds ----------
$('btnPreview').onclick = async () => {
  const f = fields();
  if (!f.brief && !f.brandName) { $('brief').focus(); return toast('Describe your offer first', 'err'); }
  const btn = $('btnPreview'); btn.disabled = true; setPhase('run', 'Drawing three frames…');
  try {
    const r = await post('/api/preview', f);
    $('stills').innerHTML = r.frames.map((u, i) => `<img src="${esc(u)}" alt="Frame ${i + 1}">`).join('');
    if (!state.last && r.frames[0]) { $('poster').src = r.frames[Math.min(1, r.frames.length - 1)]; }
    if (!$('seed').value) { $('seed').value = String(r.seed); state.seed = String(r.seed); }
    setPhase('ok', `Quick look ready in ${(r.ms / 1000).toFixed(1)} s · ${r.lookLabel}. Press Make video for the real thing.`);
  } catch (e) { setPhase('err', e.message); toast(e.message, 'err'); } finally { btn.disabled = state.running; }
};

// ---------- making videos: progress, stop, recovery ----------
function busy(on) {
  state.running = on;
  for (const id of ['btnMake', 'btnVariants', 'btnPreview']) $(id).disabled = on;
  $('progress').hidden = !on;
  $('btnStop').disabled = false;
  if (!on) { $('progText').textContent = ''; $('progLeft').textContent = ''; state.rate = null; }
}
function showProgress(p) {
  if (!p) return;
  const parts = p.parts || 1, part = p.part || 1;
  const n = state.batch ? state.batch.total : 1, idx = state.batch ? state.batch.films.length : 0;
  let pct = 0, text = 'Getting ready';
  if (p.phase === 'render' && p.total) {
    pct = p.frame / p.total; text = `Frame ${p.frame} of ${p.total}`;
    const now = Date.now(), r = state.rate;
    if (!r || r.part !== part || r.idx !== idx || p.frame < r.f0) state.rate = { part, idx, f0: p.frame, t0: now };
    else if (p.frame - r.f0 >= 8) {
      const perFrame = (now - r.t0) / (p.frame - r.f0) / 1000;
      const framesLeft = (p.total - p.frame) + (parts - part) * p.total + (n - idx - 1) * parts * p.total;
      $('progLeft').textContent = `${clock(framesLeft * perFrame + 2)} left`;
    }
  } else if (p.phase === 'encode') { pct = 1; text = 'Finishing the file'; }
  else if (p.phase === 'music') text = 'Composing music';
  if (parts > 1) text += ` · ${part === 1 ? 'wide' : 'vertical'} (${part} of ${parts})`;
  if (n > 1) text = `Version ${idx + 1} of ${n} · ` + text;
  const done = ((idx * parts) + (part - 1) + pct) / (n * parts);
  $('barFill').style.width = `${Math.max(2, Math.min(100, done * 100)).toFixed(1)}%`;
  $('bar').setAttribute('aria-valuenow', String(Math.round(done * 100)));
  $('progText').textContent = text;
  if (!$('progLeft').textContent && state.estimate && state.startedAt) $('progLeft').textContent = `~${clock(Math.max(5, state.estimate - (Date.now() - state.startedAt) / 1000))} left`;
  $('overlayText').textContent = p.phase === 'render' ? `${Math.round(done * 100)}%` : text;
}
function onJob(j) {
  if (!j || j.status === 'idle') return;
  if (j.status === 'running') {
    if (!state.running) {
      busy(true); state.startedAt = j.startedAt; state.kind = j.kind;
      if (j.kind === 'batch') { state.batch = state.batch || { total: 3, films: j.films || [] }; renderCompare(); }
      else if (!state.last || $('player').paused) { $('poster').hidden = !$('poster').getAttribute('src'); showStage('skeleton'); $('poster').hidden = !$('poster').getAttribute('src'); }
    }
    state.estimate = j.estimate || state.estimate; setPhase('run', j.phase || 'Working…'); showProgress(j.progress);
  } else if (j.status === 'done') {
    const was = state.running;
    busy(false); setPhase('ok', 'Ready. Nothing is posted until you click Post on the app.');
    if (j.result?.films) { state.batch = { total: j.result.films.length, films: j.result.films }; state.last = j.result.films[0]; renderCompare(); renderPlatformsAndMeta(j.result.films[0]); }
    else if (j.result) { state.batch = null; showSingle(j.result, { play: was }); }
    if (was) toast(j.result?.films ? `${j.result.films.length} versions ready. Pick one to share.` : 'Video ready');
    loadGallery();
  } else if (j.status === 'error' || j.status === 'cancelled') {
    const was = state.running;
    busy(false); setPhase(j.status === 'error' ? 'err' : '', j.error || 'Stopped');
    if (j.error) appendLog(j.error);
    if (was) toast(j.status === 'cancelled' ? 'Stopped. Nothing was saved for this video.' : j.error, j.status === 'cancelled' ? 'ok' : 'err');
    if (state.batch && state.batch.films.length) { state.batch.total = state.batch.films.length; renderCompare(); }
    else if (state.last) showSingle(state.last); else showEmpty();
  }
}
async function start(url, extra = {}) {
  const f = fields();
  if (!f.brief && !f.brandName) { $('brief').focus(); return toast('Describe your offer first', 'err'); }
  if (state.running) return;
  busy(true); state.startedAt = Date.now(); state.kind = url.endsWith('batch') ? 'batch' : 'single';
  $('log').textContent = ''; $('stills').innerHTML = ''; $('progLeft').textContent = '';
  if (state.kind === 'batch') { state.batch = { total: extra.count || 3, films: [] }; renderCompare(); }
  else { state.batch = null; $('player').pause(); showStage('skeleton'); $('poster').hidden = !$('poster').getAttribute('src'); }
  setPhase('run', 'Writing your video…'); $('barFill').style.width = '2%'; $('progText').textContent = 'Getting ready';
  try { const r = await post(url, { ...f, ...extra }); state.estimate = r.estimate; $('progLeft').textContent = `~${clock(r.estimate)} left`; }
  catch (e) { setPhase('err', e.message); busy(false); toast(e.message, 'err'); if (state.last) showSingle(state.last); else showEmpty(); }
}
$('btnMake').onclick = () => start('/api/render');
$('btnVariants').onclick = () => start('/api/batch', { count: 3 });
$('btnStop').onclick = async () => {
  $('btnStop').disabled = true; setPhase('run', 'Stopping…'); // before the request: the "stopped" event can arrive before it returns
  try { await post('/api/cancel', {}); } catch (e) { toast(e.message, 'err'); $('btnStop').disabled = false; }
};

// keyboard: Cmd/Ctrl+Enter makes the video, Esc closes the drop target
window.addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); if (!state.running) $('btnMake').click(); }
  if (ev.key === 'Escape') hideDropzone();
});

// live updates; if the stream drops, poll /api/job so the buttons always come back
let lastEvent = Date.now();
function connect() {
  const es = new EventSource('/api/events');
  const on = (name, fn) => es.addEventListener(name, (ev) => { lastEvent = Date.now(); try { fn(JSON.parse(ev.data)); } catch { /* bad event */ } });
  on('hello', (d) => onJob(d.job));
  on('phase', (d) => { if (state.running) setPhase('run', d.text); });
  on('progress', (d) => { if (state.running) showProgress(d); });
  on('log', (d) => appendLog(d.line));
  on('film', (f) => { appendLog(`done: ${f.lookLabel} (${f.index}/${f.total})`); if (state.batch) { state.batch.films[f.index - 1] = f; state.batch.total = f.total; state.rate = null; renderCompare(); } });
  on('job', onJob);
  es.onerror = () => { es.close(); setTimeout(connect, 2000); };
}
setInterval(async () => {
  if (!state.running || Date.now() - lastEvent < 4000) return;
  try { onJob(await api('/api/job')); } catch { /* server restarting */ }
}, 3000);

// on load: setup check, brand kit, the last video, the gallery
(async () => {
  setView(state.format === '16:9' ? 'wide' : state.format === '1:1' ? 'square' : 'vertical');
  if (localStorage.fhBrief && !$('brief').value) $('brief').value = localStorage.fhBrief; // the draft survives a reload
  briefCount();
  loadDoctor();
  await Promise.all([loadPlatforms().catch(() => {}), loadKit()]);
  try { const last = await api('/api/last'); if (!last.empty) showSingle(last); } catch { /* first run */ }
  connect();
  loadGallery();
  loadLooks().then(planNow).catch(() => {});
  document.documentElement.dataset.ready = '1';
})();
