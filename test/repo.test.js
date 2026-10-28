// Section E: what the repo promises — safe file serving, plain package metadata, a launcher that checks its tools, CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servableFile } from '../cli/lib/ui-server.js';

const root = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(join(root, f), 'utf8');

test('the app only serves files from its own folders: no "..", no /tmp, no symlinks out', () => {
  const base = mkdtempSync(join(tmpdir(), 'fh-serve-'));
  const work = join(base, 'work'), other = join(base, 'other');
  mkdirSync(join(work, 'single'), { recursive: true }); mkdirSync(other);
  writeFileSync(join(work, 'single', 'a.mp4'), 'x'); writeFileSync(join(other, 'secret.txt'), 's');
  symlinkSync(join(other, 'secret.txt'), join(work, 'link.txt'));
  const roots = [work];
  assert.ok(servableFile(join(work, 'single', 'a.mp4'), roots));
  assert.equal(servableFile(join(work, 'single', '..', '..', 'other', 'secret.txt'), roots), null);
  assert.equal(servableFile(join(other, 'secret.txt'), roots), null);
  assert.equal(servableFile(join(work, 'link.txt'), roots), null, 'a symlink pointing outside is refused');
  assert.equal(servableFile(work + '-evil/x', roots), null, 'a look-alike folder name is refused');
  assert.equal(servableFile(join(work, 'single'), roots), null, 'folders are not files');
  assert.equal(servableFile('/tmp/fh-anything', roots), null);
  assert.equal(servableFile('', roots), null);
});

test('package.json: video keywords, no agent keywords, both command names', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const k of ['video', 'motion-graphics', 'small-business', 'social-media', 'reels', 'tiktok']) assert.ok(pkg.keywords.includes(k), k);
  for (const k of ['agent-skill', 'claude-code', 'codex']) assert.ok(!pkg.keywords.includes(k), k);
  assert.equal(pkg.bin.om, 'cli/om.js'); assert.equal(pkg.bin.framehand, 'cli/om.js');
});

test('run_ui.command checks for FFmpeg and Chrome before opening, with download links', () => {
  const s = read('run_ui.command');
  assert.match(s, /command -v ffmpeg/); assert.match(s, /command -v ffprobe/); assert.match(s, /findChrome/);
  assert.match(s, /https:\/\/evermeet\.cx\/ffmpeg\//); assert.match(s, /ffmpeg\.org\/download\.html/); assert.match(s, /https:\/\/www\.google\.com\/chrome\//);
  assert.ok(s.indexOf('findChrome') < s.indexOf('exec node cli/om.js ui'));
  assert.ok(statSync(join(root, 'run_ui.command')).mode & 0o111, 'executable');
});

test('README: an install path without Homebrew, and the demo at the top exists and is small', () => {
  const s = read('README.md');
  assert.match(s, /no Homebrew needed/);
  const top = s.slice(0, 600);
  const m = /src="(docs\/media\/[^"]+)"/.exec(top);
  assert.ok(m, 'demo image near the top');
  assert.ok(existsSync(join(root, m[1])), m[1]);
  assert.ok(statSync(join(root, m[1])).size < 3 * 1024 * 1024, 'demo under 3 MB');
});

test('CI runs the tests on Node 22', () => {
  const y = read('.github/workflows/test.yml');
  assert.match(y, /node-version: 22/); assert.match(y, /npm test/); assert.match(y, /npm ci/);
});

test('Windows: run_ui.cmd checks Node, FFmpeg and a browser before opening; install.ps1 uses winget', () => {
  const s = read('run_ui.cmd');
  assert.match(s, /where ffmpeg/); assert.match(s, /where ffprobe/); assert.match(s, /findChrome/);
  assert.ok(s.indexOf('findChrome') < s.indexOf('node cli/om.js ui'));
  assert.ok(s.includes('\r\n'), 'Windows line endings');
  const p = read('install.ps1');
  for (const id of ['OpenJS.NodeJS.LTS', 'Gyan.FFmpeg', 'archive/refs/heads/main.zip', 'Start Framehand']) assert.ok(p.includes(id), id);
});
