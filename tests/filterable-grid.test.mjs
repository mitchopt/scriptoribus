import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFilters,
  formatCount,
  buildCategoryList,
} from '../js/filterable-grid.js';

// ── applyFilters ──────────────────────────────────────────────────────────

test('applyFilters: no filters returns all items', () => {
  const items = [
    { id: '1', name: 'Item A', category: 'Cat1' },
    { id: '2', name: 'Item B', category: 'Cat2' },
  ];
  const result = applyFilters({
    items,
    query: '',
    activeCategory: 'All categories',
    customPredicates: [],
  });
  assert.equal(result.length, 2);
});

test('applyFilters: query filters by name', () => {
  const items = [
    { id: '1', name: 'Ablative', category: 'Grammar' },
    { id: '2', name: 'Subjunctive', category: 'Grammar' },
  ];
  const result = applyFilters({
    items,
    query: 'Ablative',
    activeCategory: 'All categories',
    customPredicates: [],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('applyFilters: category filter', () => {
  const items = [
    { id: '1', name: 'Item A', category: 'Cat1' },
    { id: '2', name: 'Item B', category: 'Cat2' },
    { id: '3', name: 'Item C', category: 'Cat1' },
  ];
  const result = applyFilters({
    items,
    query: '',
    activeCategory: 'Cat1',
    customPredicates: [],
  });
  assert.equal(result.length, 2);
  assert.ok(result.every(x => x.category === 'Cat1'));
});

test('applyFilters: "All categories" is no-op', () => {
  const items = [
    { id: '1', category: 'Cat1' },
    { id: '2', category: 'Cat2' },
  ];
  const result = applyFilters({
    items,
    query: '',
    activeCategory: 'All categories',
    customPredicates: [],
  });
  assert.equal(result.length, 2);
});

test('applyFilters: query and category combine (AND)', () => {
  const items = [
    { id: '1', name: 'Ablative', category: 'Grammar' },
    { id: '2', name: 'Ablative', category: 'Other' },
    { id: '3', name: 'Subjunctive', category: 'Grammar' },
  ];
  const result = applyFilters({
    items,
    query: 'Ablative',
    activeCategory: 'Grammar',
    customPredicates: [],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('applyFilters: customPredicates are AND-ed', () => {
  const items = [
    { id: '1', name: 'Item A', inflection: 'fixed' },
    { id: '2', name: 'Item B', inflection: 'flexible' },
    { id: '3', name: 'Item C', inflection: 'fixed' },
  ];
  const isFixed = (item) => item.inflection === 'fixed';
  const result = applyFilters({
    items,
    query: '',
    activeCategory: 'All categories',
    customPredicates: [isFixed],
  });
  assert.equal(result.length, 2);
  assert.ok(result.every(x => x.inflection === 'fixed'));
});

test('applyFilters: multiple customPredicates', () => {
  const items = [
    { id: '1', name: 'Item A', inflection: 'fixed', category: 'Cat1' },
    { id: '2', name: 'Item B', inflection: 'flexible', category: 'Cat1' },
    { id: '3', name: 'Item C', inflection: 'fixed', category: 'Cat2' },
  ];
  const isFixed = (item) => item.inflection === 'fixed';
  const isCat1 = (item) => item.category === 'Cat1';
  const result = applyFilters({
    items,
    query: '',
    activeCategory: 'All categories',
    customPredicates: [isFixed, isCat1],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('applyFilters: diacritic-insensitive search', () => {
  const items = [
    { id: '1', name: 'Ablātīvē', category: 'Grammar' },
  ];
  const result = applyFilters({
    items,
    query: 'ablative',
    activeCategory: 'All categories',
    customPredicates: [],
  });
  assert.equal(result.length, 1);
});

// ── formatCount ───────────────────────────────────────────────────────────

test('formatCount: simple count', () => {
  const text = formatCount(5, 10, 'item');
  assert.equal(text, 'Showing 5 of 10 items');
});

test('formatCount: singular noun (1 item)', () => {
  const text = formatCount(1, 1, 'item');
  assert.ok(text.includes('1 item'));
  assert.ok(!text.includes('items')); // should be singular
});

test('formatCount: custom noun', () => {
  const text = formatCount(3, 5, 'topic');
  assert.equal(text, 'Showing 3 of 5 topics');
});

test('formatCount: zero results', () => {
  const text = formatCount(0, 100, 'entry');
  assert.ok(text.includes('0'));
});

// ── buildCategoryList ─────────────────────────────────────────────────────

test('buildCategoryList: extracts and sorts unique categories', () => {
  const items = [
    { category: 'Zebra' },
    { category: 'Apple' },
    { category: 'Zebra' },
    { category: 'Mango' },
  ];
  const cats = buildCategoryList(items);
  assert.deepEqual(cats, ['All categories', 'Apple', 'Mango', 'Zebra']);
});

test('buildCategoryList: empty array returns only "All categories"', () => {
  const cats = buildCategoryList([]);
  assert.deepEqual(cats, ['All categories']);
});

test('buildCategoryList: "All categories" always first', () => {
  const items = [
    { category: 'Z' },
    { category: 'A' },
  ];
  const cats = buildCategoryList(items);
  assert.equal(cats[0], 'All categories');
});
