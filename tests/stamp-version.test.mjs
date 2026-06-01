/**
 * stamp-version.test.mjs - tests for the pure build-date formatter.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDisplay } from '../scripts/stamp-version.mjs';

test('formatDisplay: formats an ISO date as DD.Month.YYYY', () => {
  assert.equal(formatDisplay('2026-06-02'), '02.June.2026');
});

test('formatDisplay: zero-pads a single-digit day', () => {
  assert.equal(formatDisplay('2026-05-09'), '09.May.2026');
});

test('formatDisplay: handles the January and December boundaries', () => {
  assert.equal(formatDisplay('2026-01-01'), '01.January.2026');
  assert.equal(formatDisplay('2026-12-31'), '31.December.2026');
});
