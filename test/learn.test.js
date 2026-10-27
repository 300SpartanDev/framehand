import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.OM_HOME = mkdtempSync(join(tmpdir(), 'om-learn-'));
const L = await import('../cli/lib/learn.js');
const { openProject } = await import('../cli/lib/project.js');
const { addComment, resolve } = await import('../cli/lib/inbox.js');

test('learn add refuses an entry without kind, topics or evidence, and a preference without the user\'s words', () => {
  assert.throws(() => L.addEntry({ text: 'x', topics: 'rhythm', evidence: 'e' }), /--kind/);
  assert.throws(() => L.addEntry({ text: 'x', kind: 'observed', evidence: 'e' }), /--topics/);
  assert.throws(() => L.addEntry({ text: 'x', kind: 'observed', topics: 'rhythm' }), /--evidence/);
  assert.throws(() => L.addEntry({ text: 'films should be cool', kind: 'preference', topics: 'rhythm', evidence: 'chat' }), /quotes the user/);
});

test('learn add numbers entries; recall always shows preferences and filters the rest by topic', () => {
  assert.match(L.addEntry({ text: '“the music, the picture and the rhythm all feel uncool, a bit boring”', kind: 'preference', topics: 'rhythm,launch', evidence: 'today-launch test, 2026-10-17', todo: 'hook hot, a stop, a peak' }), /L1/);
  assert.match(L.addEntry({ text: 'a 3/4 bar beat bending the tempo into the logo', kind: 'observed', topics: 'sound,score', evidence: 'four-rooms om sound tempo line' }), /L2/);
  const all = readFileSync(L.localFile(), 'utf8');
  assert.match(all, /## L1 · \d{4}-\d\d-\d\d · preference · topics: rhythm, launch/);
  const r = L.recall(['camera']);
  assert.match(r, /preferences \(1\)/);
  assert.match(r, /uncool/);
  assert.doesNotMatch(r, /3\/4 bar/);
  assert.match(L.recall(['score']), /3\/4 bar/);
  // a superseded entry is kept in the file but no longer recalled
  writeFileSync(L.localFile(), all.replace('· observed ·', '· superseded ·'));
  assert.doesNotMatch(L.recall(['score']), /3\/4 bar/);
});

test('learn harvest lists the studio comments with time, target and outcome', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'om-harvest-')), 'film');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<html><body><div data-composition-id="f"></div></body></html>');
  const p = openProject(dir);
  const c = addComment(p, { text: 'too slow here', t: 4.2, target: 'card', scene: 'intro' });
  resolve(p, c.id, 'card lands 0.4s earlier');
  const out = L.harvest(p);
  assert.match(out, /1 studio comments/);
  assert.match(out, /4\.2s \[card\] \(intro\) “too slow here” → done: card lands 0\.4s earlier/);
  assert.match(out, /Fix that entry first/);
});
