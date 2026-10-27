import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grab } from '../cli/lib/grab.js';

test('om grab <folder>: the README images, icons and stylesheet colours of a project land in materials/ with their sources', async () => {
  const product = mkdtempSync(join(tmpdir(), 'om-product-'));
  mkdirSync(join(product, 'docs')); mkdirSync(join(product, 'node_modules', 'x'), { recursive: true });
  const png = (n) => Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(n, 7)]);
  writeFileSync(join(product, 'docs', 'hero.png'), png(30_000));
  writeFileSync(join(product, 'icon.png'), png(2_000));
  writeFileSync(join(product, 'node_modules', 'x', 'big.png'), png(90_000));
  writeFileSync(join(product, 'README.md'), '# P\n\n![hero](docs/hero.png)\n');
  writeFileSync(join(product, 'app.css'), ':root{--paper:#FAF9F6;--ink:#1A1D21}body{font-family:"Geist",sans-serif;color:#1a1d21}');
  const film = mkdtempSync(join(tmpdir(), 'om-film-'));
  const out = await grab(film, product);
  const m = JSON.parse(readFileSync(join(film, 'materials', 'manifest.json'), 'utf8'));
  const files = m.sources[0].files;
  assert.ok(files.some((f) => f.from === 'docs/hero.png' && /README/.test(f.note)), 'the README image, marked as such');
  assert.ok(files.some((f) => f.kind === 'logo' && f.from === 'icon.png'));
  assert.ok(!files.some((f) => /node_modules/.test(f.from)), 'dependencies are skipped');
  assert.ok(m.sources[0].colours.some((c) => c.hex === '#FAF9F6' && /--paper/.test(c.role)));
  assert.equal(m.sources[0].fonts[0].family, 'Geist');
  assert.ok(existsSync(join(film, 'materials.md')) && /docs\/hero\.png/.test(readFileSync(join(film, 'materials.md'), 'utf8')));
  assert.match(out, /logo 1/);
});
