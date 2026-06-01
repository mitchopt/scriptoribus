/**
 * idioms.test.mjs — tests for the pure inflection-filter logic in js/idioms.js.
 *
 * The DOM IIFE in idioms.js is guarded by `if (typeof document !== 'undefined')`
 * so importing in Node only runs the pure export below.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflectionPredicate } from '../js/idioms.js';

test("inflectionPredicate: 'all' returns null (no filtering)", () => {
  assert.equal(inflectionPredicate('all'), null);
});

test("inflectionPredicate: 'fixed' matches only fixed idioms", () => {
  const pred = inflectionPredicate('fixed');
  assert.equal(typeof pred, 'function');
  assert.ok(pred({ inflection: 'fixed' }));
  assert.ok(!pred({ inflection: 'flexible' }));
  assert.ok(!pred({ inflection: 'TODO' }));
});

test("inflectionPredicate: 'flexible' matches only flexible idioms", () => {
  const pred = inflectionPredicate('flexible');
  assert.equal(typeof pred, 'function');
  assert.ok(pred({ inflection: 'flexible' }));
  assert.ok(!pred({ inflection: 'fixed' }));
  assert.ok(!pred({ inflection: 'TODO' }));
});

test('inflectionPredicate: predicate is pure (does not read undefined fields loosely)', () => {
  const pred = inflectionPredicate('fixed');
  assert.ok(!pred({}));
  assert.ok(!pred({ inflection: undefined }));
});
