/**
 * build-links.test.mjs — tests for the pure links markdown parser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinks } from '../scripts/build-links.mjs';

const SAMPLE = `# Legentibus

**URL:** https://legentibus.com

**Description:** The Latin learning resource *per excellentiam*.

**Thumbnail:** legentibus.png

# Allen and Greenough

**URL:** https://dcc.dickinson.edu/grammar/latin/credits-and-reuse

**Description:** A comprehensive grammar reference.
`;

test('parseLinks: one record per # heading', () => {
  const { data, warnings } = parseLinks(SAMPLE);
  assert.equal(data.length, 2);
  assert.equal(warnings.length, 0);
  assert.equal(data[0].name, 'Legentibus');
  assert.equal(data[1].name, 'Allen and Greenough');
});

test('parseLinks: assigns positional lnk### IDs in document order', () => {
  const { data } = parseLinks(SAMPLE);
  assert.equal(data[0].id, 'lnk001');
  assert.equal(data[1].id, 'lnk002');
});

test('parseLinks: extracts url and description fields', () => {
  const { data } = parseLinks(SAMPLE);
  assert.equal(data[0].url, 'https://legentibus.com');
  assert.equal(data[0].description, 'The Latin learning resource *per excellentiam*.');
});

test('parseLinks: thumbnail is emitted only when present', () => {
  const { data } = parseLinks(SAMPLE);
  assert.equal(data[0].thumbnail, 'legentibus.png');
  assert.ok(!('thumbnail' in data[1]));
});

test('parseLinks: a link missing a required field is skipped with a warning', () => {
  const md = `# No URL

**Description:** has a description but no url

# Complete

**URL:** https://ok.test

**Description:** fine
`;
  const { data, warnings } = parseLinks(md);
  assert.equal(data.length, 1);
  assert.equal(data[0].name, 'Complete');
  assert.equal(data[0].id, 'lnk001'); // id assigned only to committed records
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /No URL/);
  assert.match(warnings[0], /missing: url/);
});

test('parseLinks: a field before any heading is reported, not attached', () => {
  const md = `**URL:** https://orphan.test

# Real

**URL:** https://ok.test

**Description:** fine
`;
  const { data, warnings } = parseLinks(md);
  assert.equal(data.length, 1);
  assert.equal(data[0].url, 'https://ok.test');
  assert.ok(warnings.some(w => /field outside any entry/.test(w)));
});
