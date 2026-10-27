// Make an uploaded picture safe to use: iPhone HEIC/HEIF → JPG, anything over ~2000 px scaled down.
// macOS has `sips`; Linux uses ImageMagick or heif-convert when present. Never throws for a normal image;
// throws a plain-English error only when a HEIC file can't be converted on this machine.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

export const MAX_SIDE = 2000;
const has = (cmd) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' }).status === 0;
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000 });

/** Width/height of a raster image (ffprobe), or null. */
export function imageSize(file) {
  const r = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file]);
  const m = /^(\d+)x(\d+)/.exec((r.stdout || '').trim());
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

/** HEIC/HEIF → JPG next to the source. Returns the new path. */
export function convertHeic(file) {
  const out = join(dirname(file), basename(file, extname(file)) + '.jpg');
  const tries = [];
  if (process.platform === 'darwin') tries.push(['sips', ['-s', 'format', 'jpeg', '-Z', String(MAX_SIDE), file, '--out', out]]);
  if (has('magick')) tries.push(['magick', [file, '-resize', `${MAX_SIDE}x${MAX_SIDE}>`, out]]);
  if (has('convert')) tries.push(['convert', [file, '-resize', `${MAX_SIDE}x${MAX_SIDE}>`, out]]);
  if (has('heif-convert')) tries.push(['heif-convert', [file, out]]);
  tries.push(['ffmpeg', ['-v', 'error', '-y', '-i', file, '-frames:v', '1', '-q:v', '3', out]]);
  for (const [cmd, args] of tries) {
    if (cmd !== 'sips' && cmd !== 'ffmpeg' && !has(cmd)) continue;
    const r = run(cmd, args);
    if (r.status === 0 && existsSync(out)) return out;
  }
  throw new Error('This computer can’t open iPhone HEIC photos. Open the picture and export it as JPG or PNG, then add it again.');
}

/** Scale a raster image down so its long side is ≤ MAX_SIDE (keeps transparency for PNG/WebP). Returns the path to use. */
export function downscale(file) {
  const ext = extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return file;
  const size = imageSize(file);
  if (!size || Math.max(size.width, size.height) <= MAX_SIDE) return file;
  const outExt = ext === '.jpeg' ? '.jpg' : ext === '.webp' ? '.png' : ext;
  const out = join(dirname(file), `${basename(file, extname(file))}-${MAX_SIDE}${outExt}`);
  const scale = size.width >= size.height ? `${MAX_SIDE}:-2` : `-2:${MAX_SIDE}`;
  const r = run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-frames:v', '1', '-vf', `scale=${scale}:flags=lanczos`, ...(outExt === '.jpg' ? ['-q:v', '2'] : []), out]);
  return r.status === 0 && existsSync(out) ? out : file;
}

/** Everything an upload needs: HEIC conversion, then downscaling. */
export function prepareImage(file) {
  let f = file;
  if (/\.(heic|heif)$/i.test(f)) f = convertHeic(f);
  return downscale(f);
}
