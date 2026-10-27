// End to end: the real app in headless Chrome, a fresh data folder, real renders (short ones).
// Skipped when Chrome or FFmpeg are missing, or with FRAMEHAND_SKIP_E2E=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startUi } from '../cli/lib/ui-server.js';
import { platformsForApi } from '../cli/lib/share-pack.js';
import { findChrome } from '../cli/lib/browser.js';
import { openApp } from './ui-driver.js';

const chrome = findChrome();
const has = (bin) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
const skip = process.env.FRAMEHAND_SKIP_E2E ? 'FRAMEHAND_SKIP_E2E is set' : !chrome ? 'no Chrome' : !(has('ffmpeg') && has('ffprobe')) ? 'no FFmpeg' : false;
const LOGO = new URL('../templates/keynote-ui/assets/sample-screen.png', import.meta.url).pathname;
const probe = (f) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', f], { encoding: 'utf8' }).stdout || '{}').streams || [];
const J = JSON.stringify;

test('the app works end to end: brief, uploads, quick look, make, stop, reload, gallery, share, delete, 3 versions', { skip, timeout: 900_000 }, async (t) => {
  const data = mkdtempSync(join(tmpdir(), 'fh-e2e-'));
  const ui = await startUi({ port: 0, data });
  const app = await openApp(chrome, ui.url);
  const outside = [];
  await app.page.send('Network.enable');
  app.page.on('Network.requestWillBeSent', (p) => { const u = p.request.url; if (!/^(http:\/\/127\.0\.0\.1:|data:|blob:|about:|chrome-extension:)/.test(u)) outside.push(u); }); // chrome-extension: = the browser’s own built-in extensions, not the app
  const get = async (path) => { const r = await fetch(new URL(path, ui.url)); return { status: r.status, type: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()) }; };
  const jobDone = (ms = 420_000) => app.waitFor("document.getElementById('progress').hidden && !document.getElementById('btnMake').disabled", ms, 250);
  try {
    await app.goto();

    await t.test('a fresh copy opens empty: no videos, no last video, no brand kit', async () => {
      assert.deepEqual((await (await fetch(new URL('/api/gallery', ui.url))).json()).films, []);
      assert.equal((await (await fetch(new URL('/api/last', ui.url))).json()).empty, true);
      assert.equal((await (await fetch(new URL('/api/brandkit', ui.url))).json()).empty, true);
      assert.equal(await app.eval("!document.getElementById('stageEmpty').hidden && document.getElementById('videoCount').textContent"), '0');
    });

    await t.test('an example chip fills the brief', async () => {
      await app.click('[data-ex="barber"]');
      assert.match(await app.eval("document.getElementById('brief').value"), /Northside Barbers/);
      await app.waitFor("/vertical video/.test(document.getElementById('estimate').textContent)", 15000);
    });

    let logoUrl;
    await t.test('logo by file picker, by dropping on the slot, by dropping on the window; photo by paste', async () => {
      await app.setFile('#logoFile', LOGO);
      await app.waitFor("document.getElementById('logoDrop').classList.contains('has')", 20000);
      logoUrl = await app.eval("document.getElementById('logoThumb').getAttribute('src')");
      assert.equal((await get(logoUrl)).status, 200);
      const dropOn = (sel, name) => app.eval(`(async () => { const b = await (await fetch(${J(logoUrl)})).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], ${J(name)}, { type: b.type || 'image/png' }));
        const el = document.querySelector(${J(sel)}); for (const ty of ['dragenter', 'dragover', 'drop']) el.dispatchEvent(new DragEvent(ty, { bubbles: true, cancelable: true, dataTransfer: dt })); return true; })()`);
      await app.click('#logoRm');
      assert.equal(await app.eval("document.getElementById('logoDrop').classList.contains('has')"), false);
      await dropOn('#logoDrop', 'dropped-logo.png');
      await app.waitFor("document.getElementById('logoName').textContent === 'dropped-logo.png'", 20000);
      // the whole-window target: dragging files over the page shows it, dropping on "Photo" fills the photo
      await app.eval(`(async () => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'x.png', { type: 'image/png' })); document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt })); return true; })()`);
      assert.equal(await app.eval("!document.getElementById('dropzone').hidden"), true);
      await dropOn('#dropzone [data-slot="screenshot"]', 'window-photo.png');
      await app.waitFor("document.getElementById('shotName').textContent === 'window-photo.png'", 20000);
      assert.equal(await app.eval("document.getElementById('dropzone').hidden"), true);
      await app.click('#shotRm');
      await app.eval(`(async () => { const b = await (await fetch(${J(logoUrl)})).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'clip.png', { type: 'image/png' }));
        window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); return true; })()`);
      await app.waitFor("document.getElementById('shotDrop').classList.contains('has')", 20000);
      await app.click('#shotRm'); // keep the films short and the same shape
    });

    await t.test('brand kit: remembered after a reload, then forgotten', async () => {
      await app.click('.sw[data-c="#2563eb"]');
      await app.click('#rememberKit');
      await app.waitFor("!document.getElementById('btnForgetKit').hidden", 10000);
      await app.goto();
      assert.equal(await app.eval("document.getElementById('logoDrop').classList.contains('has')"), true);
      assert.equal(await app.eval("document.querySelector('.sw.on').dataset.c"), '#2563eb');
      await app.click('#btnForgetKit');
      await app.waitFor("!document.getElementById('logoDrop').classList.contains('has')", 5000);
      assert.equal((await (await fetch(new URL('/api/brandkit', ui.url))).json()).empty, true);
      await app.goto();
      assert.equal(await app.eval("document.getElementById('logoDrop').classList.contains('has')"), false);
      await app.click('[data-ex="barber"]');
      await app.setFile('#logoFile', LOGO);
      await app.waitFor("document.getElementById('logoDrop').classList.contains('has')", 20000);
    });

    await t.test('quick look shows stills', async () => {
      await app.click('#btnPreview');
      await app.waitFor("document.querySelectorAll('#stills img').length >= 2 && [...document.querySelectorAll('#stills img')].every((i) => i.complete && i.naturalWidth > 0)", 120000);
      assert.equal(await app.eval("document.querySelector('#stills img').naturalHeight > document.querySelector('#stills img').naturalWidth"), true, 'vertical stills');
    });

    let film;
    await t.test('Make video (Vertical, music off): progress moves, the video plays at 1080×1920', async () => {
      await app.eval("(() => { const m = document.getElementById('music'); if (m.checked) m.click(); const w = document.getElementById('madeWith'); if (w.checked) w.click(); return true; })()");
      assert.equal(await app.eval("document.querySelector('#formatSeg .on').dataset.f"), '9:16');
      await app.click('#btnMake');
      await app.waitFor("!document.getElementById('progress').hidden", 5000);
      assert.equal(await app.eval("document.getElementById('btnMake').disabled && !document.getElementById('skeleton').hidden"), true);
      const seen = await app.waitFor("(() => { const m = /Frame (\\d+) of (\\d+)/.exec(document.getElementById('progText').textContent); return m && +m[1] > 5 ? [+m[1], +m[2], parseFloat(document.getElementById('barFill').style.width)] : false; })()", 300000, 100);
      assert.ok(seen[1] > seen[0] && seen[2] > 2, `progress ${seen}`);
      await app.waitFor("/left/.test(document.getElementById('progLeft').textContent)", 60000, 100);
      await jobDone();
      await app.waitFor("!document.getElementById('player').hidden && document.getElementById('player').readyState >= 1", 30000);
      assert.deepEqual(await app.eval("[document.getElementById('player').videoWidth, document.getElementById('player').videoHeight]"), [1080, 1920]);
      assert.equal(await app.eval("document.getElementById('player').play().then(() => new Promise((r) => setTimeout(r, 600))).then(() => document.getElementById('player').currentTime > 0.1)"), true);
      film = await (await fetch(new URL('/api/last', ui.url))).json();
      assert.ok(film.mp4 && existsSync(film.mp4));
      assert.equal(probe(film.mp4).some((s) => s.codec_type === 'audio'), false, 'music off = no soundtrack');
      assert.doesNotMatch(readFileSync(join(film.dir, 'index.html'), 'utf8'), /data-om-signature="auto"/);
    });

    await t.test('share rail: copy each caption, download links are videos, Open links go to the upload pages', async () => {
      await app.waitFor("document.querySelectorAll('#platforms .plat').length === 5 && document.getElementById('platforms').dataset.captions === '1'", 15000);
      for (const p of platformsForApi()) {
        await app.click(`#platforms .plat[data-id="${p.id}"] [data-copy]`);
        const want = await app.eval(`state.captions[${J(p.id)}]`);
        assert.ok(want.length > 10 && want.length <= p.captionMax, `${p.id} caption length`);
        assert.doesNotMatch(want, /Made with FRAMEHAND/i);
        const got = await app.eval('navigator.clipboard.readText().catch(() => null)');
        if (got !== null) assert.equal(got, want, `${p.id} clipboard`);
        const href = await app.eval(`document.querySelector('#platforms .plat[data-id="${p.id}"] [data-dl]').getAttribute('href')`);
        const v = await get(href);
        assert.equal(v.status, 200); assert.equal(v.type, 'video/mp4'); assert.ok(v.body.length > 10000);
        const open = await app.eval(`document.querySelector('#platforms .plat[data-id="${p.id}"] [data-open]').href`);
        if (p.id === 'x') assert.ok(open.startsWith('https://x.com/intent/post?text=') && decodeURIComponent(open).includes(want.slice(0, 20)), open);
        else assert.equal(open, p.composerUrl);
        assert.equal(await app.eval(`document.querySelector('#platforms .plat[data-id="${p.id}"] [data-open]').target`), '_blank');
      }
      const main = await get(await app.eval("document.getElementById('btnDownload').getAttribute('href')"));
      assert.equal(main.status, 200); assert.equal(main.type, 'video/mp4');
      const z = await get(await app.eval("document.getElementById('btnZip').getAttribute('href')"));
      assert.equal(z.status, 200); assert.equal(z.type, 'application/zip');
      for (const p of platformsForApi()) assert.ok(z.body.includes(Buffer.from(`${p.id}/video.mp4`)) && z.body.includes(Buffer.from(`${p.id}/caption.txt`)), p.id);
    });

    await t.test('safe-zone overlay toggles', async () => {
      assert.equal(await app.eval("document.getElementById('safe').hidden"), true);
      await app.click('#btnSafe');
      assert.equal(await app.eval("!document.getElementById('safe').hidden && document.getElementById('btnSafe').getAttribute('aria-pressed')"), 'true');
      await app.click('#btnSafe');
      assert.equal(await app.eval("document.getElementById('safe').hidden"), true);
    });

    await t.test('Stop on a second run stops cleanly', async () => {
      await app.click('#btnMake');
      await app.waitFor("/Frame \\d+ of/.test(document.getElementById('progText').textContent) || /Composing|Rendering/.test(document.getElementById('phaseText').textContent)", 120000, 100);
      await app.click('#btnStop');
      await jobDone(60000);
      assert.equal((await (await fetch(new URL('/api/job', ui.url))).json()).status, 'cancelled');
      assert.match(await app.eval("document.getElementById('phaseText').textContent"), /Stopped/);
      assert.equal(await app.eval("!document.getElementById('btnMake').disabled && !document.getElementById('player').hidden"), true, 'the earlier video is back on stage');
    });

    await t.test('reload restores the last video and the gallery lists it', async () => {
      await app.goto();
      await app.waitFor("!document.getElementById('player').hidden && document.getElementById('player').getAttribute('src')", 10000);
      assert.equal(await app.eval('state.last.id'), film.id);
      assert.deepEqual(await app.eval("[document.getElementById('music').checked, document.getElementById('madeWith').checked]"), [false, false], 'switches are remembered');
      await app.waitFor("document.getElementById('videoCount').textContent === '1'", 10000);
      await app.click('#tabVideos');
      assert.equal(await app.eval(`document.querySelectorAll('#gallery .gcard').length`), 1);
      assert.equal(await app.eval(`document.querySelector('#gallery .gcard').dataset.id`), film.id);
    });

    let three;
    await t.test('Make 3 versions (music and “Made with” on): three different films side by side', async () => {
      await app.click('#tabShare');
      assert.deepEqual(await app.eval("(() => { for (const id of ['music', 'madeWith']) if (!document.getElementById(id).checked) document.getElementById(id).click(); return [document.getElementById('music').checked, document.getElementById('madeWith').checked]; })()"), [true, true]);
      await app.click('#btnVariants');
      await app.waitFor("!document.getElementById('compare').hidden && document.querySelectorAll('#compare .vcard').length === 3", 10000);
      await jobDone(900_000);
      assert.equal(await app.eval("document.querySelectorAll('#compare .vcard video').length"), 3);
      const job = await (await fetch(new URL('/api/job', ui.url))).json();
      assert.equal(job.status, 'done', job.error);
      three = job.result.films;
      assert.equal(new Set(three.map((f) => f.id)).size, 3);
      assert.equal(new Set(three.map((f) => `${f.look}/${f.planId}/${f.seed}`)).size, 3, 'three different films');
      for (const f of three) {
        assert.equal(probe(f.mp4).some((s) => s.codec_type === 'audio'), true, 'music on = a soundtrack');
        assert.match(readFileSync(join(f.dir, 'index.html'), 'utf8'), /data-om-signature="auto"/, 'Made with = the corner mark');
      }
      // pick version 2: the share rail now uses that film
      await app.click('#compare [data-use="1"]');
      await app.waitFor(`state.last.id === ${J(three[1].id)} && document.getElementById('platforms').dataset.film === ${J(three[1].id)}`, 10000);
      await app.waitFor("/Made with FRAMEHAND/i.test(state.captions.x || '')", 10000);
      const href = await app.eval(`document.querySelector('#platforms .plat[data-id="tiktok"] [data-dl]').getAttribute('href')`);
      assert.ok(href.includes(encodeURIComponent(three[1].id)));
    });

    await t.test('Delete in Your videos removes the film', async () => {
      await app.goto();
      await app.click('#tabVideos');
      await app.waitFor("document.querySelectorAll('#gallery .gcard').length === 4", 10000);
      const id = three[0].id;
      await app.click(`#gallery .gcard[data-id="${id}"] [data-del]`);
      assert.match(await app.eval(`document.querySelector('#gallery .gcard[data-id="${id}"] [data-del]').textContent`), /Delete\?/);
      await app.click(`#gallery .gcard[data-id="${id}"] [data-del]`);
      await app.waitFor("document.querySelectorAll('#gallery .gcard').length === 3", 10000);
      assert.equal(existsSync(three[0].dir), false);
      assert.equal(await app.eval("document.getElementById('stageEmpty').hidden === false || state.last === null"), true, 'the deleted film was the last one');
      assert.equal((await (await fetch(new URL('/api/last', ui.url))).json()).empty, true);
    });

    await t.test('no page errors and no outside requests', () => {
      assert.deepEqual(app.errors, []);
      assert.deepEqual(outside, []);
    });
  } finally {
    await app.close(); await ui.close();
  }
});
