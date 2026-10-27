import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alike, cases, soundprint, soundprintReport } from '../cli/lib/soundprint.js';
import { renderComposed } from '../cli/lib/composed.js';
import { DRUM_KITS } from '../cli/lib/composer.js';
import { DRUMS } from '../cli/lib/score.js';

const REF = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'framehand', 'references');
const worlds = [...readFileSync(join(REF, 'music.md'), 'utf8').matchAll(/```abc\n([\s\S]*?)```/g)].map((m) => m[1]);
const signal = readFileSync(join(REF, 'scores', 'signal.abc'), 'utf8');

// the header every test film of October 2026 ended up with
const copied = `X:1
T:Product · launch cue
M:4/4
L:1/8
Q:1/4=120
K:Am
V:PLK inst=synpluck gain=0.55
A2 c2 e2 c2 |
V:SAW inst=supersaw gain=0.5
[Ace]8 |
V:VLN inst=violins role=melody
e8 |
V:PNO inst=piano
[A,E]8 |
V:BAS inst=synbass gain=0.8
A,,8 |
V:DK inst=drums kit=808 gain=0.9
C,,2 C,,2 C,,2 C,,2 |
V:DR inst=drums kit=pop
z2 D,,2 z2 D,,2 |
`;

test('soundprint: a score with the example\'s band at another tempo and key is the same music; a different world is not', () => {
  const p = soundprint(copied);
  assert.deepEqual(p.band, ['drums:808', 'drums:pop', 'piano', 'supersaw', 'synbass', 'synpluck', 'violins']);
  assert.equal(p.bpm, 120);
  assert.equal(alike(p, soundprint(signal)).same, true);
  assert.equal(alike(p, soundprint(worlds[0])).same, false);
  // swapping two of the seven instruments is not a new world
  const swapped = soundprint(copied.replace('inst=synbass', 'inst=bass').replace('inst=synpluck', 'inst=pizz'));
  assert.equal(alike(swapped, soundprint(signal)).same, true);
});

test('music.md: every world renders, none is an example score\'s band, and no two worlds are the same music', () => {
  assert.ok(worlds.length >= 12, `${worlds.length} worlds`);
  const prints = worlds.map((w) => soundprint(w));
  for (const [i, w] of worlds.entries()) {
    const r = renderComposed(w, { duration: 12 });
    assert.ok(r.report.notes > 20, `${prints[i].title}: ${r.report.notes} notes`);
    let peak = 0; for (const x of r.music.L) peak = Math.max(peak, Math.abs(x));
    assert.ok(peak > 0.01, `${prints[i].title} is silent`);
    for (const c of cases()) assert.equal(alike(prints[i], c.print).same, false, `${prints[i].title} is ${c.name}`);
  }
  for (let i = 0; i < prints.length; i++) for (let j = i + 1; j < prints.length; j++) {
    assert.equal(alike(prints[i], prints[j]).same, false, `${prints[i].title} ~ ${prints[j].title}`);
  }
});

test('om sound report: a film that copies Signal is told so, and so is the next film with the same band', () => {
  const home = mkdtempSync(join(tmpdir(), 'om-home-'));
  const before = process.env.OM_HOME;
  process.env.OM_HOME = home;
  try {
    const a = soundprintReport(join(home, 'film-a'), copied);
    assert.ok(a.lines.some((l) => /example score signal\.abc/.test(l)), a.lines.join('\n'));
    const b = soundprintReport(join(home, 'film-b'), copied.replace('Q:1/4=120', 'Q:1/4=124'));
    assert.ok(b.lines.some((l) => /same music as 1 recent film/.test(l)), b.lines.join('\n'));
    // a film in another world after them: neither warning
    const c = soundprintReport(join(home, 'film-c'), worlds[9]);
    assert.equal(c.lines.filter((l) => /^warning/.test(l)).length, 0, c.lines.join('\n'));
    // the same film re-scored is not compared with itself
    const a2 = soundprintReport(join(home, 'film-a'), copied);
    assert.ok(!a2.lines.some((l) => /recent film/.test(l) && /film-a/.test(l)), a2.lines.join('\n'));
  } finally {
    if (before == null) delete process.env.OM_HOME; else process.env.OM_HOME = before;
  }
});

test('drum kits: every kit a score can name plays drum voices that exist', () => {
  for (const [kit, map] of Object.entries(DRUM_KITS)) for (const [gm, name] of Object.entries(map)) assert.ok(name in DRUMS, `${kit}.${gm} → ${name}`);
});
