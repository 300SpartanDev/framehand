// Shipping clean: a fresh copy holds none of the owner's (or the tests') own videos, uploads, share packs or brand kit,
// and the app keeps all of that in a user-data folder outside the project.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataDir, PKG, resetUserData, userDataFolders } from '../cli/lib/user-data.js';

const git = spawnSync('git', ['ls-files', '-z'], { cwd: PKG, encoding: 'utf8' });
const tracked = git.status === 0 ? git.stdout.split('\0').filter(Boolean) : null;

// the only places pictures and videos may be tracked: README media (fictional example brands) and template / font assets
const ALLOWED_MEDIA = [/^docs\/media\/[^/]+\.(png|jpe?g|gif|webp|mp4)$/i, /^templates\/[^/]+\/assets\//, /^fonts\//, /^examples\/[^/]+\/assets\/fonts\//];
const MEDIA = /\.(mp4|m4v|mov|webm|mkv|avi|gif|png|jpe?g|webp|heic|heif|wav|mp3|m4a|aac)$/i;
const USER_DATA = /(^|\/)(\.framehand-ui-work|framehand-batch|\.fork-artifacts|uploads|share-packs?|renders?|out|outputs|data)\/|(^|\/)(last|brand-kit)\.json$/i;

test('no rendered videos, stills or uploads are tracked outside docs/media and template assets', { skip: !tracked && 'not a git checkout' }, () => {
  const bad = tracked.filter((f) => MEDIA.test(f) && !ALLOWED_MEDIA.some((re) => re.test(f)));
  assert.deepEqual(bad, [], `remove these from git (they are outputs or uploads): ${bad.join(', ')}`);
});

test('nothing from the app’s user-data folders is tracked', { skip: !tracked && 'not a git checkout' }, () => {
  const bad = tracked.filter((f) => USER_DATA.test(f) && !/^(test|cli|runtime|studio)\//.test(f));
  assert.deepEqual(bad, []);
});

test('README media stays small', { skip: !tracked && 'not a git checkout' }, () => {
  for (const f of tracked.filter((x) => x.startsWith('docs/media/') && MEDIA.test(x))) assert.ok(statSync(join(PKG, f)).size < 2.5e6, `${f} is over 2.5 MB`);
});

test('the user-data folder is outside the project and per OS', () => {
  assert.equal(dataDir({}, 'darwin', '/Users/a'), '/Users/a/Library/Application Support/FRAMEHAND');
  assert.equal(dataDir({ APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }, 'win32', 'C:\\Users\\a').endsWith('FRAMEHAND'), true);
  assert.equal(dataDir({}, 'linux', '/home/a'), '/home/a/.local/share/framehand');
  assert.equal(dataDir({ FRAMEHAND_DATA: '/tmp/x' }), '/tmp/x');
  assert.ok(!dataDir({}, process.platform).startsWith(PKG + '/'), 'never inside the project');
});

test('reset empties the user-data folder', () => {
  const d = mkdtempSync(join(tmpdir(), 'fh-reset-'));
  const env = { FRAMEHAND_DATA: join(d, 'data'), OM_HOME: join(d, 'om') }, home = join(d, 'home'); // temp folders only
  mkdirSync(join(d, 'data', 'uploads'), { recursive: true }); writeFileSync(join(d, 'data', 'last.json'), '{}');
  mkdirSync(join(d, 'om'), { recursive: true }); writeFileSync(join(d, 'om', 'experience.md'), 'x');
  const pkg = join(d, 'pkg'); mkdirSync(join(pkg, '.framehand-ui-work'), { recursive: true });
  assert.equal(userDataFolders({ env, pkg, home }).length, 3);
  assert.equal(resetUserData({ env, pkg, home }).length, 3);
  assert.ok(!existsSync(join(d, 'data')) && !existsSync(join(d, 'om')) && !existsSync(join(pkg, '.framehand-ui-work')));
});

test('user output folders are gitignored', () => {
  const r = spawnSync('git', ['check-ignore', '.framehand-ui-work/x.mp4', 'framehand-batch/x.mp4', '.fork-artifacts/x.png', 'data/x.mp4'], { cwd: PKG, encoding: 'utf8' });
  if (r.status === 128) return; // not a git checkout
  assert.equal(r.stdout.trim().split('\n').length, 4, r.stdout);
});
