import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  foldDiacritics,
  sortByName,
  matchesQuery,
  inlineItalics,
  autoLinkUrls,
  uniqueCategories,
  groupByCategory,
  sampleWithoutReplacement,
} from '../js/data.js';

// ── escapeHtml ────────────────────────────────────────────────────────────

test('escapeHtml: plain text unchanged', () => {
  assert.equal(escapeHtml('hello'), 'hello');
});

test('escapeHtml: & → &amp;', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml: < → &lt;', () => {
  assert.equal(escapeHtml('<tag>'), '&lt;tag&gt;');
});

test('escapeHtml: " → &quot;', () => {
  assert.equal(escapeHtml('"quoted"'), '&quot;quoted&quot;');
});

test('escapeHtml: multiple escapes', () => {
  assert.equal(
    escapeHtml('a & <b> "c"'),
    'a &amp; &lt;b&gt; &quot;c&quot;'
  );
});

// ── foldDiacritics ────────────────────────────────────────────────────────

test('foldDiacritics: plain ASCII unchanged', () => {
  assert.equal(foldDiacritics('hello'), 'hello');
});

test('foldDiacritics: ā → a', () => {
  assert.equal(foldDiacritics('ā'), 'a');
});

test('foldDiacritics: ē → e', () => {
  assert.equal(foldDiacritics('ē'), 'e');
});

test('foldDiacritics: ī → i', () => {
  assert.equal(foldDiacritics('ī'), 'i');
});

test('foldDiacritics: ō → o', () => {
  assert.equal(foldDiacritics('ō'), 'o');
});

test('foldDiacritics: ū → u', () => {
  assert.equal(foldDiacritics('ū'), 'u');
});

test('foldDiacritics: full word with macrons', () => {
  assert.equal(foldDiacritics('Ablātīvē'), 'Ablative');
});

test('foldDiacritics: case preserved', () => {
  assert.equal(foldDiacritics('Ā'), 'A');
});

test('foldDiacritics: multiple macrons in one string', () => {
  assert.equal(
    foldDiacritics('cum essem mihi vidētur'),
    'cum essem mihi videtur'
  );
});

// ── sortByName ────────────────────────────────────────────────────────────

test('sortByName: sorts by name field', () => {
  const items = [
    { id: '1', name: 'Zebra' },
    { id: '2', name: 'Apple' },
    { id: '3', name: 'Mango' },
  ];
  const sorted = sortByName(items, 'name');
  assert.equal(sorted[0].name, 'Apple');
  assert.equal(sorted[1].name, 'Mango');
  assert.equal(sorted[2].name, 'Zebra');
});

test('sortByName: case-insensitive', () => {
  const items = [
    { id: '1', name: 'zebra' },
    { id: '2', name: 'Apple' },
  ];
  const sorted = sortByName(items, 'name');
  assert.equal(sorted[0].name, 'Apple');
  assert.equal(sorted[1].name, 'zebra');
});

test('sortByName: diacritic-insensitive', () => {
  const items = [
    { id: '1', name: 'Ablātīvē' },
    { id: '2', name: 'Ablative' },
    { id: '3', name: 'Causal' },
  ];
  const sorted = sortByName(items, 'name');
  // Both Ablative variants should come before Causal
  assert.ok(sorted.findIndex(x => x.name.includes('Causal')) > 1);
});

test('sortByName: different key name', () => {
  const items = [
    { id: '1', latin: 'zebra' },
    { id: '2', latin: 'apple' },
  ];
  const sorted = sortByName(items, 'latin');
  assert.equal(sorted[0].latin, 'apple');
});

// ── matchesQuery ──────────────────────────────────────────────────────────

test('matchesQuery: exact substring match', () => {
  const item = { name: 'Ablative Absolute', category: 'Participles' };
  assert.ok(matchesQuery(item, 'Ablative', ['name']));
});

test('matchesQuery: case-insensitive', () => {
  const item = { name: 'Ablative Absolute' };
  assert.ok(matchesQuery(item, 'ablative', ['name']));
});

test('matchesQuery: diacritic-insensitive', () => {
  const item = { name: 'Ablātīvē Absolūtē' };
  assert.ok(matchesQuery(item, 'ablative', ['name']));
});

test('matchesQuery: searches multiple fields', () => {
  const item = { name: 'Ablative', category: 'Participles' };
  assert.ok(matchesQuery(item, 'Participles', ['name', 'category']));
});

test('matchesQuery: no match returns false', () => {
  const item = { name: 'Ablative' };
  assert.ok(!matchesQuery(item, 'Subjunctive', ['name']));
});

test('matchesQuery: empty query matches all', () => {
  const item = { name: 'Ablative' };
  assert.ok(matchesQuery(item, '', ['name']));
});

// ── inlineItalics ─────────────────────────────────────────────────────────

test('inlineItalics: *text* → <em>text</em>', () => {
  const escaped = 'Cicero, *Pro Quinctio* 77';
  assert.equal(
    inlineItalics(escaped),
    'Cicero, <em>Pro Quinctio</em> 77'
  );
});

test('inlineItalics: multiple italics', () => {
  const escaped = '*first* and *second*';
  assert.equal(
    inlineItalics(escaped),
    '<em>first</em> and <em>second</em>'
  );
});

test('inlineItalics: preserves HTML (assumes input is already escaped)', () => {
  const escaped = '&quot;quoted&quot; *title*';
  assert.equal(
    inlineItalics(escaped),
    '&quot;quoted&quot; <em>title</em>'
  );
});

test('inlineItalics: no italics → unchanged', () => {
  const escaped = 'plain text';
  assert.equal(inlineItalics(escaped), 'plain text');
});

// ── uniqueCategories ──────────────────────────────────────────────────────

test('uniqueCategories: extracts unique categories', () => {
  const items = [
    { category: 'Participles' },
    { category: 'Subordinate Clauses' },
    { category: 'Participles' },
  ];
  const cats = uniqueCategories(items);
  assert.equal(cats.length, 2);
  assert.ok(cats.includes('Participles'));
  assert.ok(cats.includes('Subordinate Clauses'));
});

test('uniqueCategories: empty array returns empty', () => {
  assert.equal(uniqueCategories([]).length, 0);
});

test('uniqueCategories: returns sorted array', () => {
  const items = [
    { category: 'Zebra' },
    { category: 'Apple' },
    { category: 'Mango' },
  ];
  const cats = uniqueCategories(items);
  assert.equal(cats[0], 'Apple');
  assert.equal(cats[1], 'Mango');
  assert.equal(cats[2], 'Zebra');
});

// ── groupByCategory ───────────────────────────────────────────────────────

test('groupByCategory: groups items by category', () => {
  const items = [
    { id: '1', name: 'Item A', category: 'Cat1' },
    { id: '2', name: 'Item B', category: 'Cat2' },
    { id: '3', name: 'Item C', category: 'Cat1' },
  ];
  const grouped = groupByCategory(items);
  assert.equal(grouped['Cat1'].length, 2);
  assert.equal(grouped['Cat2'].length, 1);
  assert.equal(grouped['Cat1'][0].id, '1');
  assert.equal(grouped['Cat1'][1].id, '3');
});

test('groupByCategory: empty array returns empty object', () => {
  const grouped = groupByCategory([]);
  assert.equal(Object.keys(grouped).length, 0);
});

// ── sampleWithoutReplacement ──────────────────────────────────────────────

test('sampleWithoutReplacement: returns n items from pool', () => {
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const result = sampleWithoutReplacement(pool, 3);
  assert.equal(result.length, 3);
  assert.ok(result.every(x => pool.includes(x)));
});

test('sampleWithoutReplacement: no duplicates', () => {
  const pool = Array.from({ length: 100 }, (_, i) => i);
  const result = sampleWithoutReplacement(pool, 50);
  const unique = new Set(result);
  assert.equal(unique.size, 50);
});

test('sampleWithoutReplacement: n > pool size returns full pool', () => {
  const pool = ['a', 'b', 'c'];
  const result = sampleWithoutReplacement(pool, 10);
  assert.equal(result.length, 3);
  assert.deepEqual(new Set(result), new Set(pool));
});

test('sampleWithoutReplacement: n = 0 returns empty array', () => {
  const pool = ['a', 'b', 'c'];
  const result = sampleWithoutReplacement(pool, 0);
  assert.equal(result.length, 0);
});

test('sampleWithoutReplacement: empty pool returns empty array', () => {
  const result = sampleWithoutReplacement([], 5);
  assert.equal(result.length, 0);
});

test('sampleWithoutReplacement: does not mutate input pool', () => {
  const pool = ['a', 'b', 'c'];
  const poolCopy = [...pool];
  sampleWithoutReplacement(pool, 2);
  assert.deepEqual(pool, poolCopy);
});

// ── autoLinkUrls ──────────────────────────────────────────────────────────

test('autoLinkUrls: single URL', () => {
  const input = 'See https://example.com for details.';
  const result = autoLinkUrls(input);
  assert.ok(result.includes('<a href="https://example.com"'));
  assert.ok(result.includes('target="_blank"'));
  assert.ok(result.includes('rel="noopener noreferrer"'));
});

test('autoLinkUrls: multiple URLs in one string', () => {
  const input = 'Visit https://example.com or http://test.org for more.';
  const result = autoLinkUrls(input);
  assert.equal((result.match(/<a href=/g) || []).length, 2);
  assert.ok(result.includes('https://example.com'));
  assert.ok(result.includes('http://test.org'));
});

test('autoLinkUrls: URL with query string', () => {
  const input = 'Check https://example.com/path?a=1&amp;b=2 here.';
  const result = autoLinkUrls(input);
  assert.ok(result.includes('href="https://example.com/path?a=1&amp;b=2"'));
});

test('autoLinkUrls: URL with fragment', () => {
  const input = 'See https://example.com#section for details.';
  const result = autoLinkUrls(input);
  assert.ok(result.includes('https://example.com#section'));
});

test('autoLinkUrls: URL at start of input', () => {
  const input = 'https://example.com is great.';
  const result = autoLinkUrls(input);
  assert.ok(result.startsWith('<a href="https://example.com"'));
});

test('autoLinkUrls: URL at end of input', () => {
  const input = 'Visit this site: https://example.com';
  const result = autoLinkUrls(input);
  assert.ok(result.endsWith('</a>'));
  assert.ok(result.includes('https://example.com'));
});

test('autoLinkUrls: text with no URL unchanged', () => {
  const input = 'Plain text without any links.';
  assert.equal(autoLinkUrls(input), input);
});

test('autoLinkUrls: anchor carries correct attributes', () => {
  const result = autoLinkUrls('Visit https://example.com now.');
  const anchor = /<a[^>]*>/.exec(result)[0];
  assert.ok(anchor.includes('target="_blank"'));
  assert.ok(anchor.includes('rel="noopener noreferrer"'));
});
