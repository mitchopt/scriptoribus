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
  diffRecords,
  findOrphanBookJson,
} from '../scripts/validate-data.mjs';

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
