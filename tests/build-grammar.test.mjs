/**
 * build-grammar.test.mjs — tests for the pure grammar markdown parser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrammar, parseLinkField } from '../scripts/build-grammar.mjs';

// ── parseLinkField ──────────────────────────────────────────────────────────

test('parseLinkField: extracts a single wrapped markdown link', () => {
  const links = parseLinkField('([A&G §343](https://dcc.dickinson.edu/grammar/latin/genitive))');
  assert.deepEqual(links, [
    { text: 'A&G §343', url: 'https://dcc.dickinson.edu/grammar/latin/genitive' },
  ]);
});

test('parseLinkField: extracts multiple links from one field', () => {
  const links = parseLinkField('[A](https://a.test) and [B](https://b.test)');
  assert.deepEqual(links, [
    { text: 'A', url: 'https://a.test' },
    { text: 'B', url: 'https://b.test' },
  ]);
});

test('parseLinkField: empty text label is preserved', () => {
  const links = parseLinkField('[](https://only-url.test)');
  assert.deepEqual(links, [{ text: '', url: 'https://only-url.test' }]);
});

test('parseLinkField: TODO / plain text yields no links', () => {
  assert.deepEqual(parseLinkField('TODO'), []);
  assert.deepEqual(parseLinkField(''), []);
});

// ── parseGrammar ──────────────────────────────────────────────────────────

const SAMPLE = `# Possessive Genitive

**Category:** Genitive Constructions

**Link:** ([A&G §343](https://dcc.dickinson.edu/grammar/latin/genitive))

**Note:** TODO

**Latin Expression:** TODO

# Ablative Absolute

**Category:** Ablative Constructions

**Link:** ([A&G §419–420](https://dcc.dickinson.edu/grammar/latin/ablative-absolute))

**Note:** A compact participial phrase.

**Latin Expression:** urbe captā
`;

test('parseGrammar: one record per H1 construction', () => {
  const { data, warnings } = parseGrammar(SAMPLE);
  assert.equal(data.length, 2);
  assert.equal(warnings.length, 0);
  assert.equal(data[0].name, 'Possessive Genitive');
  assert.equal(data[1].name, 'Ablative Absolute');
});

test('parseGrammar: assigns positional g### IDs in document order', () => {
  const { data } = parseGrammar(SAMPLE);
  assert.equal(data[0].id, 'g001');
  assert.equal(data[1].id, 'g002');
});

test('parseGrammar: extracts category, note, latin expression, and links', () => {
  const { data } = parseGrammar(SAMPLE);
  assert.equal(data[1].category, 'Ablative Constructions');
  assert.equal(data[1].notes, 'A compact participial phrase.');
  assert.equal(data[1].latinExpression, 'urbe captā');
  assert.deepEqual(data[1].links, [
    { text: 'A&G §419–420', url: 'https://dcc.dickinson.edu/grammar/latin/ablative-absolute' },
  ]);
});

test('parseGrammar: retains TODO placeholders verbatim', () => {
  const { data } = parseGrammar(SAMPLE);
  assert.equal(data[0].notes, 'TODO');
  assert.equal(data[0].latinExpression, 'TODO');
});

test('parseGrammar: construction missing a category is skipped with a warning', () => {
  const md = `# No Category Here

**Note:** something

# Has Category

**Category:** Cat A
`;
  const { data, warnings } = parseGrammar(md);
  assert.equal(data.length, 1);
  assert.equal(data[0].name, 'Has Category');
  assert.equal(data[0].id, 'g001'); // counter only advances for committed records
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /No Category Here/);
  assert.match(warnings[0], /missing: category/);
});

test('parseGrammar: missing optional fields default to empty', () => {
  const md = `# Bare

**Category:** Cat A
`;
  const { data } = parseGrammar(md);
  assert.equal(data[0].notes, '');
  assert.equal(data[0].latinExpression, '');
  assert.deepEqual(data[0].links, []);
});

test('parseGrammar: a field before any heading is reported, not attached', () => {
  const md = `**Category:** Orphan

# Real

**Category:** Cat A
`;
  const { data, warnings } = parseGrammar(md);
  assert.equal(data.length, 1);
  assert.equal(data[0].category, 'Cat A');
  assert.ok(warnings.some(w => /field outside any construction/.test(w)));
});
