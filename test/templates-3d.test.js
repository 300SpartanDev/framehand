import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from '../cli/lib/browser.js';
import { openFilm } from '../cli/lib/capture.js';
import { checkPage } from '../cli/lib/check.js';

const OM = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli', 'om.js');
const skip = !findChrome() && 'no Chrome';

for (const name of ['object-3d', 'ui-space']) {
  test(`template ${name}: a new project starts clean and its 3D frames are drawn`, { skip }, async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'om-tpl-')), name);
    assert.equal(spawnSync(process.execPath, [OM, 'new', dir, '--template', name]).status, 0);
    const project = { root: dir, index: join(dir, 'index.html'), om: join(dir, '.om') };
    const found = await checkPage(project, { samples: 6 });
    assert.deepEqual(found.filter((f) => f.level === 'error'), [], JSON.stringify(found));
    const film = await openFilm(project.index, {});
    try {
      await film.seek(4.5);
      // something is drawn there: many distinct colours in the middle of the frame, not a blank or black slab
      const colours = await film.evaluate(`(async () => {
        const c = document.querySelector('canvas');
        let src = c;
        if (!c) { return -1; }
        const t = document.createElement('canvas'); t.width = 192; t.height = 108;
        const g = t.getContext('2d'); g.drawImage(src, 0, 0, 192, 108);
        const d = g.getImageData(0, 0, 192, 108).data, set = new Set();
        for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4);
        return set.size;
      })()`);
      // the bundled sample screen is a neutral generated panel (no stock photo), so ~120 colours here; a blank frame has < 10
      if (name === 'object-3d') assert.ok(colours > 80, `the WebGL frame has ${colours} colours`);
      assert.deepEqual(film.errors, []);
    } finally { await film.close(); }
  });
}
