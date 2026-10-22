/**
 * validate-data.test.mjs — tests for the independent grammar re-parser and the
 * generic diff, focused on the new grammar schema (links, latin expression).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  reparseGrammar,
  reparseLinks,
  reparseTemplates,
  reparseIdioms,
  reparseBook,
  diffRecords,
  diffBook,
  findOrphanBookJson,
} from '../scripts/validate-data.mjs';
import { parseIdioms } from '../scripts/build-idioms.mjs';
import { parseBook } from '../scripts/build-books.mjs';

const SAMPLE = `# Possessive Genitive

**Category:** Genitive Constructions

**Link:** ([A&G §343](https://dcc.dickinson.edu/grammar/latin/genitive))

**Note:** TODO

**Latin Expression:** TODO

# Ablative Absolute

**Category:** Ablative Constructions

**Link:** ([A&G §419](https://dcc.dickinson.edu/grammar/latin/ablative-absolute))

**Note:** A compact phrase.

**Latin Expression:** urbe captā
`;

test('reparseGrammar: one record per H1, with linksKey encoding', () => {
  const recs = reparseGrammar(SAMPLE);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].name, 'Possessive Genitive');
  assert.equal(recs[0].category, 'Genitive Constructions');
  assert.equal(recs[0].notes, 'TODO');
  assert.equal(recs[0].latinExpression, 'TODO');
  assert.equal(recs[0].linksKey, 'A&G §343->https://dcc.dickinson.edu/grammar/latin/genitive');
});

test('reparseGrammar: drops a construction with no category', () => {
  const recs = reparseGrammar('# Orphan\n\n**Note:** x\n\n# Kept\n\n**Category:** C\n');
  assert.deepEqual(recs.map(r => r.name), ['Kept']);
});

// the validator's flatten output mirrors reparseGrammar's record shape, so we
// reuse reparseGrammar to stand in for the "json side" with a deliberate edit.
function asJsonRecords(recs) {
  return recs.map(({ line, ...rest }) => rest);
}

test('diffRecords: agreement yields no errors', () => {
  const md = reparseGrammar(SAMPLE);
  const json = asJsonRecords(md);
  const errors = diffRecords({
    label: 'grammar',
    key: 'name',
    fields: ['category', 'notes', 'latinExpression', 'linksKey'],
    mdRecords: md,
    jsonRecords: json,
  });
  assert.deepEqual(errors, []);
});

test('diffRecords: a changed link is flagged via linksKey', () => {
  const md = reparseGrammar(SAMPLE);
  const json = asJsonRecords(md);
  json[1].linksKey = 'A&G §999->https://wrong.test'; // simulate a forgotten rebuild
  const errors = diffRecords({
    label: 'grammar',
    key: 'name',
    fields: ['category', 'notes', 'latinExpression', 'linksKey'],
    mdRecords: md,
    jsonRecords: json,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /linksKey mismatch for 'Ablative Absolute'/);
});

test('diffRecords: a changed note is flagged', () => {
  const md = reparseGrammar(SAMPLE);
  const json = asJsonRecords(md);
  json[1].notes = 'tampered';
  const errors = diffRecords({
    label: 'grammar',
    key: 'name',
    fields: ['category', 'notes', 'latinExpression', 'linksKey'],
    mdRecords: md,
    jsonRecords: json,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /notes mismatch for 'Ablative Absolute'/);
});

// ── reparseLinks (single-# schema) ──────────────────────────────────────────

const LINKS_SAMPLE = `# Legentibus

**URL:** https://legentibus.com

**Description:** A learning resource.

**Thumbnail:** legentibus.png

# Allen and Greenough

**URL:** https://dcc.dickinson.edu/grammar/latin

**Description:** A grammar reference.
`;

test('reparseLinks: one record per # heading, with fields', () => {
  const recs = reparseLinks(LINKS_SAMPLE);
  assert.equal(recs.length, 2);
  assert.equal(recs[0].name, 'Legentibus');
  assert.equal(recs[0].url, 'https://legentibus.com');
  assert.equal(recs[0].description, 'A learning resource.');
  assert.equal(recs[0].thumbnail, 'legentibus.png');
  assert.equal(recs[1].thumbnail, null);
});

test('reparseLinks: a changed url is flagged via diffRecords', () => {
  const md = reparseLinks(LINKS_SAMPLE);
  const json = md.map(({ line, ...rest }) => rest);
  json[0].url = 'https://wrong.test';
  const errors = diffRecords({
    label: 'links',
    key: 'name',
    fields: ['url', 'description', 'thumbnail'],
    mdRecords: md,
    jsonRecords: json,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /url mismatch for 'Legentibus'/);
});

// ── reparseTemplates (single-# schema) ──────────────────────────────────────

const TEMPLATES_SAMPLE = `# Renarratio

**Category:** progymnasmata

**Summary:** Retell a narrative.

**Description:** A progymnasmata element.

# Copia

**Category:** variatio

**Summary:** Rewrite a sentence many ways.

**Description:** See De Copia.
`;

test('reparseTemplates: one record per # heading, with fields', () => {
  const recs = reparseTemplates(TEMPLATES_SAMPLE);
  assert.equal(recs.length, 2);
  assert.deepEqual(recs.map(r => r.name), ['Renarratio', 'Copia']);
  assert.equal(recs[1].category, 'variatio');
});

test('reparseTemplates: a changed summary is flagged via diffRecords', () => {
  const md = reparseTemplates(TEMPLATES_SAMPLE);
  const json = md.map(({ line, ...rest }) => rest);
  json[1].summary = 'tampered';
  const errors = diffRecords({
    label: 'templates',
    key: 'name',
    fields: ['category', 'summary', 'description'],
    mdRecords: md,
    jsonRecords: json,
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /summary mismatch for 'Copia'/);
});

// reparseIdioms — must encode multi-line notes identically to the builder.

const IDIOMS_SAMPLE = `# cum _ essem

**Category:** Temporal

**Meaning:** when I was _

**Note:** *essem* may inflect.

Test extra line.

**Examples:**
> Cicero, *De Oratore* 2.2.10: "cum essemus eius domi"
`;

test('reparseIdioms: multi-paragraph note encodes with \\n, same as the builder', () => {
  const recs = reparseIdioms(IDIOMS_SAMPLE);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].notes, '*essem* may inflect.\nTest extra line.');
  assert.equal(recs[0].exampleCount, 1);

  // parity: the independent validator and the builder must agree on the note string.
  const { data } = parseIdioms(IDIOMS_SAMPLE);
  assert.equal(recs[0].notes, data[0].notes);
});

// findOrphanBookJson — guards against stale book JSON the build never prunes.

test('findOrphanBookJson: flags a json with no manifest entry', () => {
  const orphans = findOrphanBookJson(['a'], ['a.json', 'b.json']);
  assert.deepEqual(orphans, ['b.json']);
});

test('findOrphanBookJson: no orphans when every json is in the manifest', () => {
  const orphans = findOrphanBookJson(['a', 'b'], ['a.json', 'b.json']);
  assert.deepEqual(orphans, []);
});

test('findOrphanBookJson: never reports manifest.json itself', () => {
  const orphans = findOrphanBookJson(['a'], ['manifest.json', 'a.json']);
  assert.deepEqual(orphans, []);
});

test('findOrphanBookJson: ignores non-json entries', () => {
  const orphans = findOrphanBookJson(['a'], ['a.json', 'a.md', 'raw_md']);
  assert.deepEqual(orphans, []);
});

// real-file guard: every <id>.json on disk must be declared in the manifest.
// this is what would have caught the stale data/books/bradley.json orphan.
test('book manifest accounts for every book JSON on disk', () => {
  const booksDir = new URL('../data/books/', import.meta.url);
  const filenames = readdirSync(fileURLToPath(booksDir));
  const manifestIds = JSON.parse(readFileSync(new URL('manifest.json', booksDir), 'utf8'));
  const orphans = findOrphanBookJson(manifestIds, filenames);
  assert.deepEqual(orphans, [], `orphan book JSON not in manifest: ${orphans.join(', ')}`);
});

// reparseBook: its independent box parsing must agree with build-books.mjs, including which
// boxes are dropped (before the first ##, after a section's first prompt, or empty).

const BOOK_SAMPLE = `# Sample Book

**Author:** A. N. Author

**Year:** 1900

**Blurb:** A blurb.

**Notes:** Too early: both parsers drop this.

## First Section

**Notes:** Section notes,
on two lines.

Second paragraph.

### Exercise 1

**Vocabulary:**
- obey, *pāreō*

**Prompt:** First prompt.
**Key:** Prima.

**Notes:** Too late: both parsers drop this.

**Prompt:** Second prompt.
**Key:** Secunda.

### Exercise 2

**Info:** Exercise info.

**Note:**
---

**Prompt:** Third prompt.
**Key:** Tertia.
`;

test('reparseBook: collects boxes at both levels and drops misplaced or empty ones', () => {
  const md = reparseBook(BOOK_SAMPLE);
  assert.deepEqual(md.chapters[0].boxes, [
    { kind: 'notes', body: 'Section notes,\non two lines.\n\nSecond paragraph.' },
  ]);
  assert.deepEqual(
    md.chapters[0].sections.map((s) => s.boxes),
    [[{ kind: 'vocabulary', body: '- obey, *pāreō*' }], [{ kind: 'info', body: 'Exercise info.' }]]
  );
  assert.equal(md.chapters[0].sections[0].exercises.length, 2);
});

test('reparseBook and parseBook agree on boxes', () => {
  const md = reparseBook(BOOK_SAMPLE);
  const { data } = parseBook(BOOK_SAMPLE, 'sample');
  assert.deepEqual(md.chapters[0].boxes, data.chapters[0].boxes);
  assert.deepEqual(
    md.chapters[0].sections.map((s) => s.boxes),
    data.chapters[0].sections.map((s) => s.boxes)
  );
  assert.deepEqual(diffBook('sample', md, data), []);
});

// rebuild the json side from the builder, apply one edit, and diff it against the markdown.
function diffAfterEdit(edit) {
  const { data } = parseBook(BOOK_SAMPLE, 'sample');
  edit(data);
  return diffBook('sample', reparseBook(BOOK_SAMPLE), data);
}

test('diffBook: a changed box body is flagged', () => {
  const errors = diffAfterEdit((data) => {
    data.chapters[0].boxes[0].body = 'tampered';
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^books\[sample\]: ch1 box1 body mismatch: md=/);
});

test('diffBook: a changed box kind is flagged', () => {
  const errors = diffAfterEdit((data) => {
    data.chapters[0].sections[0].boxes[0].kind = 'notes';
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^books\[sample\]: ch1 §1 box1 kind mismatch: md=/);
});

test('diffBook: an info box whose kind changed is flagged', () => {
  const errors = diffAfterEdit((data) => {
    data.chapters[0].sections[1].boxes[0].kind = 'notes';
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^books\[sample\]: ch1 §2 box1 kind mismatch: md="info" vs json="notes"$/);
});

test('diffBook: a missing box is flagged by count', () => {
  const errors = diffAfterEdit((data) => {
    data.chapters[0].sections[0].boxes.pop();
  });
  assert.deepEqual(errors, ['books[sample]: ch1 §1 box count mismatch — md=1 vs json=0']);
});

test('diffBook: json without boxes keys matches a book that has no boxes', () => {
  const md = '# T\n\n**Author:** A\n\n**Year:** 1900\n\n**Blurb:** B\n\n## S\n\n### E\n\n**Prompt:** P\n**Key:** K\n';
  const { data } = parseBook(md, 'x');
  delete data.chapters[0].boxes;
  delete data.chapters[0].sections[0].boxes;
  assert.deepEqual(diffBook('x', reparseBook(md), data), []);
});
