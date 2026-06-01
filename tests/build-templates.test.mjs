/**
 * build-templates.test.mjs — tests for the pure templates markdown parser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTemplates } from '../scripts/build-templates.mjs';

const SAMPLE = `# Renarratio

**Category:** progymnasmata

**Summary:** Retell a fable or narrative in your own words.

**Description:** The first and second elements of the ancient 'Progymnasmata'.

# Copia

**Category:** variatio

**Summary:** Rewrite a single sentence in as many different ways as possible.

**Description:** See *De Copia*, Erasmus.
`;

test('parseTemplates: one record per # heading', () => {
  const { data, warnings } = parseTemplates(SAMPLE);
  assert.equal(data.length, 2);
  assert.equal(warnings.length, 0);
  assert.equal(data[0].name, 'Renarratio');
  assert.equal(data[1].name, 'Copia');
});

test('parseTemplates: assigns positional tpl### IDs in document order', () => {
  const { data } = parseTemplates(SAMPLE);
  assert.equal(data[0].id, 'tpl001');
  assert.equal(data[1].id, 'tpl002');
});

test('parseTemplates: extracts category, summary, and description', () => {
  const { data } = parseTemplates(SAMPLE);
  assert.equal(data[1].category, 'variatio');
  assert.equal(data[1].summary, 'Rewrite a single sentence in as many different ways as possible.');
  assert.equal(data[1].description, 'See *De Copia*, Erasmus.');
});

test('parseTemplates: an entry missing a required field is skipped with a warning', () => {
  const md = `# No Description

**Category:** cat

**Summary:** has summary but no description

# Complete

**Category:** cat

**Summary:** fine

**Description:** also fine
`;
  const { data, warnings } = parseTemplates(md);
  assert.equal(data.length, 1);
  assert.equal(data[0].name, 'Complete');
  assert.equal(data[0].id, 'tpl001'); // id assigned only to committed records
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /No Description/);
  assert.match(warnings[0], /missing: description/);
});

test('parseTemplates: a field before any heading is reported, not attached', () => {
  const md = `**Category:** orphan

# Real

**Category:** cat

**Summary:** s

**Description:** d
`;
  const { data, warnings } = parseTemplates(md);
  assert.equal(data.length, 1);
  assert.equal(data[0].category, 'cat');
  assert.ok(warnings.some(w => /field outside any entry/.test(w)));
});
