/**
 * workspace.test.mjs — tests for pure functions in js/workspace.js.
 *
 * The DOM IIFE in workspace.js is guarded by `if (typeof document !== 'undefined')`
 * so importing in Node only runs the pure exports below.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState,
  rerollOne,
  applyManualPicks,
  setPromptSource,
  serializeState,
  deserializeState,
  addToWorkspace,
  toggleItemLock,
  randomiseSlotKeepingLocked,
} from '../js/workspace.js';

// ── defaultState ──────────────────────────────────────────────────────────

test('defaultState: returns a clean state shape', () => {
  const s = defaultState();
  assert.equal(s.promptSource, 'text');
  assert.deepEqual(s.counts, { prompt: 1, idiom: 1, grammar: 1, template: 1 });
  assert.deepEqual(s.slots, { prompt: [], idiom: [], grammar: [], template: [] });
  assert.deepEqual(s.lockedItems, { prompt: [], idiom: [], grammar: [], template: [] });
});

test('defaultState: returns a fresh object each call (no aliasing)', () => {
  const a = defaultState();
  const b = defaultState();
  a.slots.prompt.push('x');
  assert.equal(b.slots.prompt.length, 0);
});

// ── rerollOne ─────────────────────────────────────────────────────────────

test('rerollOne: replaces only the target index', () => {
  const slot = ['a', 'b', 'c'];
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const result = rerollOne(slot, 1, pool);
  assert.equal(result.length, 3);
  assert.equal(result[0], 'a');
  assert.equal(result[2], 'c');
  // index 1 must be different from old 'b' and not duplicate 'a' or 'c'
  assert.ok(result[1] !== 'a' && result[1] !== 'c');
});

test('rerollOne: never duplicates within the slot', () => {
  const slot = ['a', 'b', 'c'];
  const pool = ['a', 'b', 'c', 'd'];
  // run many times — replacement must always be 'd' (only available)
  for (let i = 0; i < 20; i++) {
    const result = rerollOne(slot, 0, pool);
    assert.equal(result[0], 'd');
  }
});

test('rerollOne: pool exhausted → returns original slot unchanged', () => {
  const slot = ['a', 'b', 'c'];
  const pool = ['a', 'b', 'c'];  // no spare items
  const result = rerollOne(slot, 0, pool);
  assert.deepEqual(result, slot);
});

test('rerollOne: works when slot has only one item', () => {
  const slot = ['a'];
  const pool = ['a', 'b', 'c'];
  const result = rerollOne(slot, 0, pool);
  assert.equal(result.length, 1);
  assert.ok(['b', 'c'].includes(result[0]));
});

test('rerollOne: does not mutate input slot', () => {
  const slot = ['a', 'b', 'c'];
  const pool = ['a', 'b', 'c', 'd'];
  rerollOne(slot, 1, pool);
  assert.deepEqual(slot, ['a', 'b', 'c']);
});

test('rerollOne: out-of-range index returns slot unchanged', () => {
  const slot = ['a', 'b'];
  const pool = ['a', 'b', 'c', 'd'];
  assert.deepEqual(rerollOne(slot, 5, pool), slot);
  assert.deepEqual(rerollOne(slot, -1, pool), slot);
});

// ── applyManualPicks ──────────────────────────────────────────────────────

test('applyManualPicks: replaces slot and locks every pick', () => {
  const state = defaultState();
  const out = applyManualPicks(state, 'idiom', ['i001', 'i002']);
  assert.deepEqual(out.slots.idiom, ['i001', 'i002']);
  assert.deepEqual(out.lockedItems.idiom, ['i001', 'i002']);
});

test('applyManualPicks: does not mutate input', () => {
  const state = defaultState();
  applyManualPicks(state, 'idiom', ['i001']);
  assert.deepEqual(state.slots.idiom, []);
  assert.deepEqual(state.lockedItems.idiom, []);
});

test('applyManualPicks: leaves other slots untouched', () => {
  const state = defaultState();
  state.slots.prompt = ['t001', 't002'];
  const out = applyManualPicks(state, 'idiom', ['i001']);
  assert.deepEqual(out.slots.prompt, ['t001', 't002']);
  assert.deepEqual(out.lockedItems.prompt, []);
});

test('applyManualPicks: locks exactly the picked items, replacing prior locks', () => {
  const state = defaultState();
  state.slots.idiom = ['i001', 'i002'];
  state.lockedItems.idiom = ['i001'];
  const out = applyManualPicks(state, 'idiom', ['i003', 'i004']);
  assert.deepEqual(out.lockedItems.idiom, ['i003', 'i004']);
});

// ── setPromptSource ───────────────────────────────────────────────────────

test('setPromptSource: changes source and clears prompt slot', () => {
  const state = defaultState();
  state.promptSource = 'text';
  state.slots.prompt = ['t001', 't002'];

  const out = setPromptSource(state, 'image');
  assert.equal(out.promptSource, 'image');
  assert.deepEqual(out.slots.prompt, []);
});

test('setPromptSource: changing source clears prompt item locks', () => {
  const state = defaultState();
  state.slots.prompt = ['t001'];
  state.lockedItems.prompt = ['t001'];
  state.lockedItems.idiom = ['i001'];
  const out = setPromptSource(state, 'image');
  assert.deepEqual(out.lockedItems.prompt, []);
  // other slots' item locks are untouched
  assert.deepEqual(out.lockedItems.idiom, ['i001']);
});

test('setPromptSource: same source is idempotent (no-op)', () => {
  const state = defaultState();
  state.slots.prompt = ['t001'];
  state.lockedItems.prompt = ['t001'];

  const out = setPromptSource(state, 'text');
  assert.equal(out.promptSource, 'text');
  // slot and locks preserved because source unchanged
  assert.deepEqual(out.slots.prompt, ['t001']);
  assert.deepEqual(out.lockedItems.prompt, ['t001']);
});

test('setPromptSource: does not affect other slots', () => {
  const state = defaultState();
  state.slots.idiom = ['i001'];
  state.slots.grammar = ['g001'];
  const out = setPromptSource(state, 'image');
  assert.deepEqual(out.slots.idiom, ['i001']);
  assert.deepEqual(out.slots.grammar, ['g001']);
});

test('setPromptSource: does not mutate input', () => {
  const state = defaultState();
  state.slots.prompt = ['t001'];
  setPromptSource(state, 'image');
  assert.deepEqual(state.slots.prompt, ['t001']);
  assert.equal(state.promptSource, 'text');
});

// ── serializeState / deserializeState ────────────────────────────────────

test('serializeState + deserializeState: round-trip preserves data', () => {
  const state = {
    promptSource: 'image',
    counts: { prompt: 5, idiom: 2, grammar: 4, template: 3 },
    slots: { prompt: ['img003'], idiom: ['i001', 'i002'], grammar: ['g001'], template: ['tpl001'] },
    lockedItems: { prompt: [], idiom: ['i001'], grammar: [], template: [] },
  };
  const json = serializeState(state);
  const restored = deserializeState(json);
  assert.deepEqual(restored, state);
});

test('deserializeState: invalid JSON returns default state', () => {
  const out = deserializeState('not-json{');
  assert.deepEqual(out, defaultState());
});

test('deserializeState: null/undefined returns default state', () => {
  assert.deepEqual(deserializeState(null), defaultState());
  assert.deepEqual(deserializeState(undefined), defaultState());
});

test('deserializeState: missing fields are filled with defaults', () => {
  const partial = JSON.stringify({ promptSource: 'image' });
  const out = deserializeState(partial);
  assert.equal(out.promptSource, 'image');
  assert.deepEqual(out.counts, { prompt: 1, idiom: 1, grammar: 1, template: 1 });
  assert.deepEqual(out.slots, { prompt: [], idiom: [], grammar: [], template: [] });
});

test('deserializeState: invalid promptSource falls back to default', () => {
  const bad = JSON.stringify({ promptSource: 'audio' });
  const out = deserializeState(bad);
  assert.equal(out.promptSource, 'text');
});

test('deserializeState: non-array slots are coerced to []', () => {
  const bad = JSON.stringify({ slots: { prompt: 'not-an-array', idiom: 42, grammar: ['g001'] } });
  const out = deserializeState(bad);
  assert.deepEqual(out.slots.prompt, []);
  assert.deepEqual(out.slots.idiom, []);
  assert.deepEqual(out.slots.grammar, ['g001']);
  assert.deepEqual(out.slots.template, []);
});

test('deserializeState: valid lockedItems are restored, junk falls back to []', () => {
  const json = JSON.stringify({
    lockedItems: { idiom: ['i001', 'i002'], grammar: 'nope', template: [3, 'tpl001'] },
  });
  const out = deserializeState(json);
  assert.deepEqual(out.lockedItems.idiom, ['i001', 'i002']);
  assert.deepEqual(out.lockedItems.grammar, []);     // non-array → default
  assert.deepEqual(out.lockedItems.template, ['tpl001']); // non-strings filtered out
  assert.deepEqual(out.lockedItems.prompt, []);
});

test('deserializeState: missing lockedItems defaults to empty per slot', () => {
  const out = deserializeState(JSON.stringify({ promptSource: 'text' }));
  assert.deepEqual(out.lockedItems, { prompt: [], idiom: [], grammar: [], template: [] });
});

// ── addToWorkspace ──────────────────────────────────────────────────────────

test('addToWorkspace: empty slot (count 1) → [id] and locked', () => {
  const out = addToWorkspace(defaultState(), { slotKey: 'idiom', id: 'i001' });
  assert.deepEqual(out.slots.idiom, ['i001']);
  assert.deepEqual(out.lockedItems.idiom, ['i001']);
});

test('addToWorkspace: room (slot shorter than count) → appended', () => {
  const state = defaultState();
  state.counts.grammar = 3;
  state.slots.grammar = ['g001'];
  const out = addToWorkspace(state, { slotKey: 'grammar', id: 'g002' });
  assert.deepEqual(out.slots.grammar, ['g001', 'g002']);
  assert.deepEqual(out.lockedItems.grammar, ['g002']);
});

test('addToWorkspace: appending alongside an existing lock accumulates locks', () => {
  const state = defaultState();
  state.counts.grammar = 3;
  state.slots.grammar = ['g001'];
  state.lockedItems.grammar = ['g001'];
  const out = addToWorkspace(state, { slotKey: 'grammar', id: 'g002' });
  assert.deepEqual(out.slots.grammar, ['g001', 'g002']);
  assert.deepEqual(out.lockedItems.grammar, ['g001', 'g002']);
});

test('addToWorkspace: replacing the final element drops its stale lock', () => {
  const state = defaultState();
  state.counts.idiom = 2;
  state.slots.idiom = ['i001', 'i002'];
  state.lockedItems.idiom = ['i002'];
  const out = addToWorkspace(state, { slotKey: 'idiom', id: 'i003' });
  assert.deepEqual(out.slots.idiom, ['i001', 'i003']);
  assert.deepEqual(out.lockedItems.idiom, ['i003']); // i002 gone from slot → lock pruned
});

test('addToWorkspace: full (len === count) → replaces the final element', () => {
  const state = defaultState();
  state.counts.idiom = 2;
  state.slots.idiom = ['i001', 'i002'];
  const out = addToWorkspace(state, { slotKey: 'idiom', id: 'i003' });
  assert.deepEqual(out.slots.idiom, ['i001', 'i003']);
});

test('addToWorkspace: over-full (len > count) → replaces final, length preserved', () => {
  const state = defaultState();
  state.counts.idiom = 1;
  state.slots.idiom = ['i001', 'i002', 'i003']; // e.g. from prior manual picks
  const out = addToWorkspace(state, { slotKey: 'idiom', id: 'i004' });
  assert.deepEqual(out.slots.idiom, ['i001', 'i002', 'i004']);
});

test('addToWorkspace: count 0 → bumps count to 1 and adds', () => {
  const state = defaultState();
  state.counts.template = 0;
  const out = addToWorkspace(state, { slotKey: 'template', id: 'tpl001' });
  assert.deepEqual(out.slots.template, ['tpl001']);
  assert.equal(out.counts.template, 1);
  assert.deepEqual(out.lockedItems.template, ['tpl001']);
});

test('addToWorkspace: already-present id → no duplicate, slot locked', () => {
  const state = defaultState();
  state.counts.idiom = 3;
  state.slots.idiom = ['i001', 'i002'];
  const out = addToWorkspace(state, { slotKey: 'idiom', id: 'i001' });
  assert.deepEqual(out.slots.idiom, ['i001', 'i002']);
  assert.deepEqual(out.lockedItems.idiom, ['i001']);
});

test('addToWorkspace: prompt source conflict text→image switches and replaces slot', () => {
  const state = defaultState();
  state.promptSource = 'text';
  state.slots.prompt = ['t001', 't002'];
  const out = addToWorkspace(state, { slotKey: 'prompt', id: 'img005', source: 'image' });
  assert.equal(out.promptSource, 'image');
  assert.deepEqual(out.slots.prompt, ['img005']);
  assert.deepEqual(out.lockedItems.prompt, ['img005']);
});

test('addToWorkspace: prompt source conflict image→text switches and replaces slot', () => {
  const state = defaultState();
  state.promptSource = 'image';
  state.slots.prompt = ['img001'];
  const out = addToWorkspace(state, { slotKey: 'prompt', id: 't007', source: 'text' });
  assert.equal(out.promptSource, 'text');
  assert.deepEqual(out.slots.prompt, ['t007']);
});

test('addToWorkspace: prompt source already matching → simple add (no clear)', () => {
  const state = defaultState();
  state.promptSource = 'text';
  state.counts.prompt = 3;
  state.slots.prompt = ['t001'];
  const out = addToWorkspace(state, { slotKey: 'prompt', id: 't002', source: 'text' });
  assert.deepEqual(out.slots.prompt, ['t001', 't002']);
  assert.equal(out.promptSource, 'text');
});

test('addToWorkspace: does not mutate input state', () => {
  const state = defaultState();
  state.counts.idiom = 2;
  state.slots.idiom = ['i001'];
  addToWorkspace(state, { slotKey: 'idiom', id: 'i002' });
  assert.deepEqual(state.slots.idiom, ['i001']);
  assert.deepEqual(state.lockedItems.idiom, []);
});

test('addToWorkspace: leaves other slots/counts untouched', () => {
  const state = defaultState();
  state.slots.grammar = ['g001'];
  state.counts.grammar = 2;
  const out = addToWorkspace(state, { slotKey: 'idiom', id: 'i001' });
  assert.deepEqual(out.slots.grammar, ['g001']);
  assert.equal(out.counts.grammar, 2);
  assert.deepEqual(out.lockedItems.grammar, []);
});

// ── toggleItemLock ──────────────────────────────────────────────────────────

test('toggleItemLock: locks an unlocked id', () => {
  const out = toggleItemLock(defaultState(), 'idiom', 'i001');
  assert.deepEqual(out.lockedItems.idiom, ['i001']);
});

test('toggleItemLock: unlocks an already-locked id', () => {
  const state = defaultState();
  state.lockedItems.idiom = ['i001', 'i002'];
  const out = toggleItemLock(state, 'idiom', 'i001');
  assert.deepEqual(out.lockedItems.idiom, ['i002']);
});

test('toggleItemLock: does not mutate input', () => {
  const state = defaultState();
  toggleItemLock(state, 'grammar', 'g001');
  assert.deepEqual(state.lockedItems.grammar, []);
});

test('toggleItemLock: leaves other slots untouched', () => {
  const state = defaultState();
  state.lockedItems.template = ['tpl001'];
  const out = toggleItemLock(state, 'idiom', 'i001');
  assert.deepEqual(out.lockedItems.template, ['tpl001']);
});

// ── randomiseSlotKeepingLocked ───────────────────────────────────────────────

test('randomiseSlotKeepingLocked: no locks → full replace of length count', () => {
  const slot = ['a', 'b'];
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const out = randomiseSlotKeepingLocked(slot, [], 3, pool);
  assert.equal(out.length, 3);
  assert.equal(new Set(out).size, 3);              // no duplicates
  out.forEach(id => assert.ok(pool.includes(id))); // all from pool
});

test('randomiseSlotKeepingLocked: keeps a locked item and replaces the rest', () => {
  const slot = ['a', 'b', 'c'];
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  const out = randomiseSlotKeepingLocked(slot, ['b'], 3, pool);
  assert.equal(out.length, 3);
  assert.ok(out.includes('b'));                    // locked item survives
  assert.equal(new Set(out).size, 3);              // no duplicates
});

test('randomiseSlotKeepingLocked: preserves the locked item position', () => {
  const slot = ['a', 'b', 'c'];
  // force the only fresh candidates so the result is deterministic
  const pool = ['b', 'x', 'y'];
  const out = randomiseSlotKeepingLocked(slot, ['b'], 3, pool);
  assert.equal(out[1], 'b');                        // 'b' stays at index 1
  assert.deepEqual([out[0], out[2]].sort(), ['x', 'y']);
});

test('randomiseSlotKeepingLocked: count larger than slot grows, keeping locked', () => {
  const slot = ['a', 'b'];
  const pool = ['a', 'b', 'c', 'd', 'e'];
  const out = randomiseSlotKeepingLocked(slot, ['a'], 4, pool);
  assert.equal(out.length, 4);
  assert.equal(out[0], 'a');
  assert.equal(new Set(out).size, 4);
});

test('randomiseSlotKeepingLocked: count smaller than slot shrinks, keeping locked', () => {
  const slot = ['a', 'b', 'c', 'd'];
  const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
  const out = randomiseSlotKeepingLocked(slot, ['c'], 2, pool);
  assert.equal(out.length, 2);
  assert.ok(out.includes('c'));
});

test('randomiseSlotKeepingLocked: locked count exceeding count keeps all locked', () => {
  const slot = ['a', 'b', 'c'];
  const pool = ['a', 'b', 'c', 'd'];
  const out = randomiseSlotKeepingLocked(slot, ['a', 'b', 'c'], 1, pool);
  // all three locked survive even though count is 1
  assert.deepEqual(out.sort(), ['a', 'b', 'c']);
});

test('randomiseSlotKeepingLocked: pool exhausted → keeps locked, no duplicate', () => {
  const slot = ['a', 'b'];
  const pool = ['a']; // the only pool entry is the locked id; no spare candidates
  const out = randomiseSlotKeepingLocked(slot, ['a'], 2, pool);
  // 'a' kept; no non-'a' candidate for the second slot → length 1, no duplicate 'a'
  assert.deepEqual(out, ['a']);
});

test('randomiseSlotKeepingLocked: does not mutate inputs', () => {
  const slot = ['a', 'b', 'c'];
  const pool = ['a', 'b', 'c', 'd'];
  randomiseSlotKeepingLocked(slot, ['b'], 3, pool);
  assert.deepEqual(slot, ['a', 'b', 'c']);
  assert.deepEqual(pool, ['a', 'b', 'c', 'd']);
});
