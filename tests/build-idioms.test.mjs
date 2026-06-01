/**
 * build-idioms.test.mjs — tests for the pure idioms markdown parser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdioms } from '../scripts/build-idioms.mjs';

const SAMPLE = `# mihi vidētur

**Category:** Opinions

**Search:** \`mihi videtur\`

**Inflection:** flexible

**Note:** videtur may inflect: e.g., 'tibi videtur'.

**Examples:**
> Plautus, *Persa* 536: "Nil pericli mihi videtur"
> Cicero, *In Verrem* 1.1.15.6: "cognoscere ex me causam voluisse"

# abhinc _ annōs

**Category:** Temporal

**Meaning:** _ years ago

**Inflection:** fixed

**Note:** accusative extent of time

**Examples:**
> Plautus, *Casina* 39: "sed abhinc annos factum est sedecim"
`;

test('parseIdioms: one record per # latin heading', () => {
  const { data, warnings } = parseIdioms(SAMPLE);
  assert.equal(data.length, 2);
  assert.equal(warnings.length, 0);
  assert.equal(data[0].latin, 'mihi vidētur');
  assert.equal(data[1].latin, 'abhinc _ annōs');
});

test('parseIdioms: assigns positional i### IDs in document order', () => {
  const { data } = parseIdioms(SAMPLE);
  assert.equal(data[0].id, 'i001');
  assert.equal(data[1].id, 'i002');
});

test('parseIdioms: extracts category, gloss, inflection, note, and examples', () => {
  const { data } = parseIdioms(SAMPLE);
  assert.equal(data[1].category, 'Temporal');
  assert.equal(data[1].gloss, '_ years ago');
  assert.equal(data[1].inflection, 'fixed');
  assert.equal(data[1].notes, 'accusative extent of time');
  assert.deepEqual(data[1].examples, [
    { citation: 'Plautus, *Casina* 39', quote: 'sed abhinc annos factum est sedecim' },
  ]);
});

test('parseIdioms: --- dividers and **Search:** lines never create phantom entries', () => {
  // the standardised idioms.md has no --- dividers, but stray ones must stay inert.
  const md = `# alpha

**Category:** Cat A

**Meaning:** first

---

**Search:** \`alpha\`

# beta

**Category:** Cat B

**Meaning:** second
`;
  const { data, warnings } = parseIdioms(md);
  assert.deepEqual(data.map(d => d.latin), ['alpha', 'beta']);
  assert.equal(warnings.length, 0);
});

test('parseIdioms: an idiom missing a category is skipped with a warning', () => {
  const md = `# no category

**Meaning:** orphan

# has category

**Category:** Cat A

**Meaning:** kept
`;
  const { data, warnings } = parseIdioms(md);
  assert.equal(data.length, 1);
  assert.equal(data[0].latin, 'has category');
  assert.equal(data[0].id, 'i001'); // counter only advances for committed records
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /no category/);
  assert.match(warnings[0], /missing: category/);
});
