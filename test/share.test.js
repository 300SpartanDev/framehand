import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HAS_FFMPEG } from './fixture-film.js';
import { makeShareGif, share } from '../cli/lib/share.js';

const skip = !HAS_FFMPEG && 'no ffmpeg';
const seconds = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout);

test('om share: the GIF is the opening plus the end frame, under the size limit, and share.md says where things go', { skip }, () => {
  const root = mkdtempSync(join(tmpdir(), 'om-share-'));
  mkdirSync(join(root, 'out'));
  const video = join(root, 'out', 'film-v1.mp4');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=20', '-pix_fmt', 'yuv420p', video]);
  const r = share({ root, index: join(root, 'index.html'), om: join(root, '.om') });
  const gif = join(root, 'out', 'share', 'film-v1.gif');
  assert.match(r, /0\.0s–10\.0s \+ 18\.4s–20\.0s/);
  assert.ok(Math.abs(seconds(gif) - 11.6) < 0.2, `opening 10 s + end 1.6 s, got ${seconds(gif)}`);
  assert.ok(statSync(gif).size <= 10 * 1024 * 1024);
  const md = readFileSync(join(root, 'out', 'share', 'share.md'), 'utf8');
  assert.match(md, /Made with framehand · https:\/\/github\.com\/framehand\/framehand #framehand/);
  assert.match(md, /out\/share\/film-v1\.gif/);
});

test('om share: a GIF that cannot fit goes down in size until it does', { skip }, () => {
  const root = mkdtempSync(join(tmpdir(), 'om-share-'));
  const video = join(root, 'noise.mp4');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=6', '-pix_fmt', 'yuv420p', video]);
  const big = makeShareGif(video, join(root, 'a.gif'), { limit: 1 << 60 });
  const small = makeShareGif(video, join(root, 'b.gif'), { limit: Math.floor(big.size * 0.6) });
  assert.equal(big.px, 960);
  assert.ok(small.px < 960 || small.fps < 15, `stepped down: ${small.px}px ${small.fps} fps`);
});
