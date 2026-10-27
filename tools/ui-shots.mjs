// Screenshots of the app in its main states (for review and the README).
//   node tools/ui-shots.mjs <outDir> [--film]   --film also makes one short video for the "finished" states
import { mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startUi, doctorReport } from '../cli/lib/ui-server.js';
import { findChrome } from '../cli/lib/browser.js';
import { openApp } from '../test/ui-driver.js';

const out = resolve(process.argv[2] || '.fork-artifacts/round7'); mkdirSync(out, { recursive: true });
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const data = process.env.FRAMEHAND_SHOTS_DATA || mkdtempSync(join(tmpdir(), 'fh-shots-'));
const missing = { value: false };
const doctor = () => { const d = doctorReport(); if (!missing.value) return d; return { ...d, ready: false, ok: d.ok.filter((x) => !/ffmpeg|chrome/.test(x.id)),
  issues: [{ id: 'ffmpeg', label: 'Video tools missing', fix: 'Install FFmpeg, then press Check again.', url: 'https://evermeet.cx/ffmpeg/', link: 'Get FFmpeg' }, { id: 'chrome', label: 'Chrome not found', fix: 'Install Google Chrome. FRAMEHAND uses it to draw each frame.', url: 'https://www.google.com/chrome/', link: 'Get Chrome' }] }; };
const ui = await startUi({ port: 0, data, doctor });
const app = await openApp(findChrome(), ui.url);
const want = (n) => !only || only.includes(n);
const logo = resolve('/workspace/fh-r5/assets/logo-white.jpg');
const shotAt = async (name, w, h) => { await app.size(w, h); await new Promise((r) => setTimeout(r, 350)); await app.shot(join(out, `ui-${name}-${w}.png`)); console.log('shot', name, w); };
try {
  await app.goto();
  if (want('empty')) { await shotAt('empty', 1440, 900); await shotAt('empty', 1280, 800); }
  await app.click('[data-ex="cafe"]');
  if (process.env.FH_LOGO || true) { try { await app.setFile('#logoFile', process.env.FH_LOGO || logo); await app.waitFor("document.getElementById('logoDrop').classList.contains('has')", 15000); } catch (e) { console.log('logo', e.message); } }
  await app.waitFor("document.getElementById('estimate').textContent.length > 5", 10000);
  if (want('filled')) { await shotAt('filled', 1440, 900); await shotAt('filled', 1280, 800); }
  const reuse = !process.argv.includes('--film') && (await (await fetch(new URL('/api/last', ui.url))).json()).mp4;
  if (process.argv.includes('--film') || reuse) {
    if (!reuse) {
      await app.eval("document.getElementById('music').checked = false");
      await app.click('#btnMake');
      await app.waitFor("/Frame \\d+ of/.test(document.getElementById('progText').textContent) && parseFloat(document.getElementById('barFill').style.width) > 25", 240000, 100);
      if (want('rendering')) { await shotAt('rendering', 1440, 900); }
    }
    await app.waitFor("!document.getElementById('player').hidden && document.getElementById('player').readyState >= 2", 300000);
    await app.eval("(() => { const p = document.getElementById('player'); p.pause(); p.currentTime = 2.5; return true; })()");
    await new Promise((r) => setTimeout(r, 800));
    if (want('done')) { await shotAt('done', 1440, 900); await shotAt('done', 1280, 800); }
    await app.click('#btnSafe'); await new Promise((r) => setTimeout(r, 200));
    if (want('safe')) await shotAt('safezones', 1440, 900);
    await app.click('#btnSafe');
    await app.click('#tabVideos'); await new Promise((r) => setTimeout(r, 400));
    if (want('gallery')) { await shotAt('gallery', 1440, 900); }
    await app.click('#tabShare');
    if (want('narrow')) { await app.size(900, 1400); await new Promise((r) => setTimeout(r, 400)); await app.shot(join(out, 'ui-narrow-900.png'), { full: false }); console.log('shot narrow'); }
  }
  if (want('setup')) { missing.value = true; await app.goto(); await shotAt('setup', 1440, 900); missing.value = false; }
  if (app.errors.length) console.log('page errors:', app.errors);
} finally { await app.close(); await ui.close(); }
console.log('data', data);
