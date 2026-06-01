// shared pure utilities: html escaping, diacritic folding, search, sort, grouping, and sampling.

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// NFD-normalise and strip combining diacritics; used for diacritic-insensitive search.
export function foldDiacritics(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function sortByName(items, key) {
  return [...items].sort((a, b) => {
    const aVal = String(a[key] || '');
    const bVal = String(b[key] || '');
    return aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
  });
}

// empty query matches everything; search is diacritic- and case-insensitive.
export function matchesQuery(item, query, fields) {
  if (!query || query.trim() === '') return true;

  const folded = foldDiacritics(query).toLowerCase();
  return fields.some(field => {
    const val = String(item[field] || '');
    return foldDiacritics(val).toLowerCase().includes(folded);
  });
}

// input must already be html-escaped; only adds <em> tags for *text* markers.
export function inlineItalics(escapedText) {
  return escapedText.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}

// input must already be html-escaped; matched urls are safe to drop into href.
export function autoLinkUrls(escapedText) {
  return escapedText.replace(
    /\bhttps?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
}

export function uniqueCategories(items) {
  const cats = new Set();
  for (const item of items) {
    if (item.category) cats.add(item.category);
  }
  return sortByName(
    Array.from(cats).map(c => ({ category: c })),
    'category'
  ).map(x => x.category);
}

export function groupByCategory(items) {
  const grouped = {};
  for (const item of items) {
    const cat = item.category || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  return grouped;
}

// Fisher-Yates sample without replacement; returns a new array, never mutates input.
export function sampleWithoutReplacement(pool, n) {
  if (n <= 0 || pool.length === 0) return [];

  const cloned = [...pool];
  const result = [];
  const count = Math.min(n, cloned.length);

  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (cloned.length - i));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    result.push(cloned[i]);
  }

  return result;
}
