import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleWithoutReplacement } from '../js/data.js';
import { generateNames } from '../js/names.js';

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

// ── generateNames ─────────────────────────────────────────────────────────

test('generateNames: produces correct counts per category', () => {
  const data = [
    { category: 'Cat1', names: ['a', 'b', 'c'] },
    { category: 'Cat2', names: ['d', 'e'] },
  ];
  const result = generateNames(data, { Cat1: 2, Cat2: 1 });
  assert.equal(result.Cat1.length, 2);
  assert.equal(result.Cat2.length, 1);
});

test('generateNames: all names from pool', () => {
  const data = [
    { category: 'Cat1', names: ['a', 'b', 'c'] },
  ];
  const result = generateNames(data, { Cat1: 3 });
  assert.deepEqual(new Set(result.Cat1), new Set(['a', 'b', 'c']));
});

test('generateNames: count > pool size returns full pool', () => {
  const data = [
    { category: 'Cat1', names: ['a', 'b'] },
  ];
  const result = generateNames(data, { Cat1: 10 });
  assert.equal(result.Cat1.length, 2);
});

test('generateNames: zero count returns empty', () => {
  const data = [
    { category: 'Cat1', names: ['a', 'b'] },
  ];
  const result = generateNames(data, { Cat1: 0 });
  assert.equal(result.Cat1.length, 0);
});

test('generateNames: missing category is skipped', () => {
  const data = [
    { category: 'Cat1', names: ['a', 'b'] },
    { category: 'Cat2', names: ['c', 'd'] },
  ];
  const result = generateNames(data, { Cat1: 1 });
  assert.equal(result.Cat1.length, 1);
  assert.ok(!result.Cat2);
});

test('generateNames: maintains category keys', () => {
  const data = [
    { category: 'Praenomina', names: ['Marcus', 'Lucius'] },
    { category: 'Cognomina', names: ['Caesar', 'Magnus'] },
  ];
  const result = generateNames(data, { Praenomina: 1, Cognomina: 1 });
  assert.ok(result.Praenomina);
  assert.ok(result.Cognomina);
});
