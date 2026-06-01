// pure workspace state logic and the cross-page handoff via localStorage.
// no import-time side effects so this module is safe to import from any page (including Node tests).

import { sampleWithoutReplacement } from './data.js';

export const STORAGE_KEY = 'scriptoribus.workspace';

// always returns a fresh object — no aliasing.
export function defaultState() {
  return {
    promptSource: 'text',
    counts: { prompt: 1, idiom: 1, grammar: 1, template: 1 },
    slots: { prompt: [], idiom: [], grammar: [], template: [] },
    // per-item locks: ids within a slot that survive randomise in place
    // while the rest of the slot reshuffles
    lockedItems: { prompt: [], idiom: [], grammar: [], template: [] },
  };
}

// replace one slot entry with a fresh pick from pool, skipping ids already present.
// returns input unchanged if the pool is exhausted or the index is out of range.
export function rerollOne(slotIds, indexToReplace, pool) {
  if (indexToReplace < 0 || indexToReplace >= slotIds.length) return slotIds;

  // pool entries available = pool minus already-in-slot (except the one being replaced)
  const reserved = new Set(slotIds.filter((_, i) => i !== indexToReplace));
  const candidates = pool.filter(id => !reserved.has(id) && id !== slotIds[indexToReplace]);

  if (candidates.length === 0) return slotIds;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const next = [...slotIds];
  next[indexToReplace] = picked;
  return next;
}

// replace slot contents with manually-picked ids and lock every pick. pure; returns new state.
export function applyManualPicks(state, slotKey, pickedIds) {
  return {
    ...state,
    slots: { ...state.slots, [slotKey]: [...pickedIds] },
    lockedItems: { ...state.lockedItems, [slotKey]: [...pickedIds] },
  };
}

// change prompt source ('text' or 'image'). if the source changes, the prompt slot is cleared
// because its ids belong to the old source. idempotent when unchanged.
export function setPromptSource(state, newSource) {
  if (state.promptSource === newSource) {
    return { ...state };
  }
  return {
    ...state,
    promptSource: newSource,
    slots: { ...state.slots, prompt: [] },
    lockedItems: { ...state.lockedItems, prompt: [] },
  };
}

// toggle a per-item lock for one id in a slot. locked ids survive randomise in place,
// and their reroll button is disabled in the UI. pure; returns new state.
export function toggleItemLock(state, slotKey, id) {
  const current = state.lockedItems[slotKey];
  const next = current.includes(id)
    ? current.filter(x => x !== id)
    : [...current, id];
  return {
    ...state,
    lockedItems: { ...state.lockedItems, [slotKey]: next },
  };
}

// resample a slot while preserving individually-locked items in their original positions.
// only unlocked positions receive fresh picks (non-duplicating). a locked item always
// survives even if count was later lowered below the locked count.
// with no locks this is exactly sampleWithoutReplacement(pool, count).
export function randomiseSlotKeepingLocked(slotIds, lockedIds, count, pool) {
  const lockedSet = new Set(lockedIds);
  const kept = slotIds.filter(id => lockedSet.has(id));

  if (kept.length === 0) {
    return sampleWithoutReplacement(pool, count);
  }

  const targetLen = Math.max(count, kept.length);

  // place each locked item at its original index when that index is in range
  const result = new Array(targetLen).fill(undefined);
  const placed = new Set();
  for (let i = 0; i < targetLen; i++) {
    const orig = slotIds[i];
    if (orig !== undefined && lockedSet.has(orig)) {
      result[i] = orig;
      placed.add(orig);
    }
  }

  // locked items whose original index fell outside the new length go first into gaps
  const overflow = kept.filter(id => !placed.has(id));
  const keptSet = new Set(kept);
  const candidates = pool.filter(id => !keptSet.has(id));
  const fresh = sampleWithoutReplacement(candidates, targetLen - kept.length);

  let oi = 0;
  let fi = 0;
  for (let i = 0; i < targetLen; i++) {
    if (result[i] !== undefined) continue;
    if (oi < overflow.length) result[i] = overflow[oi++];
    else if (fi < fresh.length) result[i] = fresh[fi++];
  }

  return result.filter(x => x !== undefined);
}

// add one item by id to a workspace slot and lock it. pure; returns new state.
//
// capacity rule relative to the slot's current count:
//   - room (slot shorter than count) -> append
//   - count 0 (zero capacity, but user explicitly asked) -> bump count to 1
//   - full (slot at or over count) -> replace the final element
// an id already present is a no-op on the array; the item is still (re)locked.
// source is only meaningful for the 'prompt' slot: the user's click always wins,
// so a source conflict switches the source and clears the stale prompt slot first.
export function addToWorkspace(state, { slotKey, id, source = null }) {
  let next = state;

  // user's source choice wins; switching clears the (now wrong-source) prompt slot
  if (slotKey === 'prompt' && source && next.promptSource !== source) {
    next = setPromptSource(next, source);
  }

  const slot = next.slots[slotKey];
  const count = next.counts[slotKey];

  // lock the added id, dropping any locks no longer present in the new slot
  const lockInto = (s, nextSlot, nextCount = count) => {
    const stillLocked = s.lockedItems[slotKey].filter(x => nextSlot.includes(x));
    const nextLocked = stillLocked.includes(id) ? stillLocked : [...stillLocked, id];
    return {
      ...s,
      counts: { ...s.counts, [slotKey]: nextCount },
      slots: { ...s.slots, [slotKey]: nextSlot },
      lockedItems: { ...s.lockedItems, [slotKey]: nextLocked },
    };
  };

  if (slot.includes(id)) {
    return lockInto(next, slot);
  }

  if (slot.length < count) {
    return lockInto(next, [...slot, id]);            // room -> append
  }
  if (count === 0) {
    return lockInto(next, [id], 1);                  // zero capacity -> bump to 1
  }
  return lockInto(next, [...slot.slice(0, -1), id]); // full -> replace final
}

export function serializeState(state) {
  return JSON.stringify(state);
}

// parse serialized state, filling in defaults for any missing or invalid fields.
// malformed input returns the default state; never throws.
export function deserializeState(json) {
  if (json === null || json === undefined) return defaultState();

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return defaultState();
  }
  if (!parsed || typeof parsed !== 'object') return defaultState();

  const out = defaultState();

  if (parsed.promptSource === 'text' || parsed.promptSource === 'image') {
    out.promptSource = parsed.promptSource;
  }

  if (parsed.counts && typeof parsed.counts === 'object') {
    for (const k of ['prompt', 'idiom', 'grammar', 'template']) {
      const n = parsed.counts[k];
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
        out.counts[k] = Math.floor(n);
      }
    }
  }

  if (parsed.slots && typeof parsed.slots === 'object') {
    for (const k of ['prompt', 'idiom', 'grammar', 'template']) {
      const arr = parsed.slots[k];
      if (Array.isArray(arr)) {
        out.slots[k] = arr.filter(x => typeof x === 'string');
      }
    }
  }

  if (parsed.lockedItems && typeof parsed.lockedItems === 'object') {
    for (const k of ['prompt', 'idiom', 'grammar', 'template']) {
      const arr = parsed.lockedItems[k];
      if (Array.isArray(arr)) {
        out.lockedItems[k] = arr.filter(x => typeof x === 'string');
      }
    }
  }

  return out;
}

// cross-page handoff: add item to localStorage workspace state and navigate.
// impure; only call from a browser click handler.
export function sendToWorkspace({ slotKey, id, source = null }) {
  const current = deserializeState(localStorage.getItem(STORAGE_KEY));
  const next = addToWorkspace(current, { slotKey, id, source });
  localStorage.setItem(STORAGE_KEY, serializeState(next));
  window.location.href = './workspace.html';
}
