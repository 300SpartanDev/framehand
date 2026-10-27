// om fork — copy a project into a new frame size. A new aspect ratio is a new layout, not a crop:
// the copy keeps the source as is, changes the root size, and leaves a comment in its inbox so the
// agent's `om inbox --wait` picks up the re-layout as its next job.
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { addComment } from './inbox.js';
import { OmError, openProject, readSource, writeSource } from './project.js';

export function parseSize(text) {
  const m = /^\s*(\d{2,5})\s*[x×*:]\s*(\d{2,5})\s*$/i.exec(String(text ?? ''));
  if (!m) throw new OmError('size must look like 1080x1920');
  const width = Number(m[1]), height = Number(m[2]);
  if (width < 16 || height < 16 || width > 8192 || height > 8192) throw new OmError('size must be between 16 and 8192 pixels a side');
  if (width % 2 || height % 2) throw new OmError('width and height must be even (video encoders need it)');
  return { width, height };
}

const ROOT = /<[a-z][\w-]*\b[^>]*\sdata-composition-id\s*=\s*["'][^"']+["'][^>]*>/gi;

// The first root tag that is not inside an HTML comment (comments may quote markup).
function findRoot(html) {
  const comments = [...html.matchAll(/<!--[\s\S]*?-->/g)].map((m) => [m.index, m.index + m[0].length]);
  for (const m of html.matchAll(ROOT)) if (!comments.some(([a, b]) => m.index >= a && m.index < b)) return m;
  return null;
}

// Set data-width/data-height on the root composition element (added when missing) and keep a
// <meta name="viewport" width/height> in step. Returns the old size too.
export function resizeRoot(html, width, height) {
  const root = findRoot(html);
  if (!root) throw new OmError('index.html has no root element with data-composition-id');
  const read = (name) => Number(new RegExp(`\\s${name}\\s*=\\s*["']?(\\d+)`, 'i').exec(root[0])?.[1]) || null;
  const from = { width: read('data-width'), height: read('data-height') };
  let tag = root[0];
  for (const [name, value] of [['data-width', width], ['data-height', height]]) {
    const attr = new RegExp(`(\\s${name}\\s*=\\s*)(["'])[^"']*\\2`, 'i');
    tag = attr.test(tag) ? tag.replace(attr, `$1"${value}"`) : tag.replace(/\s*(\/?)>$/, ` ${name}="${value}"$1>`);
  }
  let out = html.slice(0, root.index) + tag + html.slice(root.index + root[0].length);
  out = out.replace(/(<meta\s+name=["']viewport["']\s+content=["'])width=\d+,\s*height=\d+/i, `$1width=${width}, height=${height}`);
  return { html: out, from, to: { width, height } };
}

const shape = ({ width, height }) => (!width || !height ? null : width === height ? 'square' : height > width ? 'portrait' : 'landscape');
const NAMES = { portrait: 'vertical', landscape: 'widescreen', square: 'square' };

// The comment the agent gets: what changed, and what a re-layout means for the new shape.
export function reflowNote(from, to) {
  const a = shape(from), b = shape(to);
  const size = (s) => (s.width && s.height ? `${s.width}×${s.height}` : 'original size');
  const head = a && a !== b
    ? `This is a ${NAMES[b]} copy (${size(to)}) of a ${NAMES[a]} film (${size(from)}). Re-lay it out for ${b === 'portrait' ? '9:16' : b === 'square' ? '1:1' : '16:9'} — not a crop, a real re-layout: `
    : `This is a ${size(to)} copy (was ${size(from)}). Re-lay it out for the new size: `;
  const rules = {
    portrait: 'keep the focus centred and stack side-by-side elements vertically; make text bigger for phones (body from about 40px, titles larger); leave the top ~8% for the status bar, the bottom ~25% for captions and buttons and the right ~14% for the like/comment rail — keep key content out of them; put subtitles above the bottom safe area. ',
    landscape: 'the subject can sit on a third with the information on the other side; turn stacked elements into side-by-side ones; text back to widescreen sizes (body about 28–36px); leave the bottom ~14% for subtitles. ',
    square: 'keep the focus centred and the content inside the middle ~80%; text sizes between widescreen and vertical; leave the bottom ~15% for subtitles. ',
  }[b] || '';
  return `${head}${rules}Check the key frame of every scene (om look --at <seconds>): all text inside the frame, not over the speaker, nothing overlapping — then hand it over.`;
}

export function fork(source, dest, size) {
  const src = openProject(source);
  const target = resolve(dest);
  if (existsSync(target)) throw new OmError(`${target} already exists — pick a new folder (om never overwrites a project)`);
  cpSync(src.root, target, { recursive: true, filter: (p) => !/[\\/](out|\.om|snapshots)([\\/]|$)/.test(p.slice(src.root.length)) });
  const project = openProject(target);
  const { html, token } = readSource(project);
  const r = resizeRoot(html, size.width, size.height);
  writeSource(project, r.html, token, `om fork ${r.from.width ?? '?'}x${r.from.height ?? '?'} → ${size.width}x${size.height}`);
  const comment = addComment(project, { text: reflowNote(r.from, r.to) });
  return { project, from: r.from, to: r.to, comment };
}
