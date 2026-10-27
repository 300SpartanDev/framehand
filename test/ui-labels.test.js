// Section D: the app opens on Vertical, the labels read in plain English, the Quick-look promise matches the README.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../cli/ui/index.html', import.meta.url), 'utf8') + readFileSync(new URL('../cli/ui/app.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

test('shape: Vertical is the default and the options say what they make', () => {
  assert.match(html, /data-f="9:16" class="on" aria-label="Vertical \(Reels\/TikTok\)"/);
  assert.match(html, /aria-label="Wide \(YouTube\/X\)"/);
  assert.match(html, /aria-label="Both \(makes two videos\)"/);
  assert.match(html, /format: localStorage\.fhShape \|\| '9:16'/);
});

test('plain labels: photo, variation', () => {
  assert.match(html, /Photo of your shop, product or app/);
  assert.doesNotMatch(html, /<strong>Screenshot<\/strong>|Version number/);
  assert.match(html, /<label for="seed">Variation<\/label>/);
});

test('Quick look promises the same speed in the app and the README', () => {
  assert.match(html, /Quick look \(a few seconds\)/);
  assert.match(readme, /three still frames in a few seconds/);
  assert.doesNotMatch(readme, /about a second/);
});
