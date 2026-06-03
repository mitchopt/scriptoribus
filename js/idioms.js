import { mountFilterableGrid } from './filterable-grid.js';
import { escapeHtml, inlineItalics } from './data.js';
import { renderIdiomDrawer } from './detail-drawers.js';

// returns null for 'all' (no filter), otherwise a predicate for the given inflection value.
// exported for unit testing.
export function inflectionPredicate(inflection) {
  if (inflection === 'all') return null;
  return (item) => item.inflection === inflection;
}

if (typeof document !== 'undefined') {
(async () => {
  try {
    const res = await fetch('./data/categories/idioms.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    mountFilterableGrid({
      container: '#content',
      data,
      searchFields: ['latin', 'gloss', 'category', 'notes'],
      countNoun: 'idiom',
      workspaceTarget: { slotKey: 'idiom' },

      renderCard: (item) => {
        const badge =
          item.inflection === 'fixed'
            ? '<span class="badge badge--fixed">fixed</span>'
            : item.inflection === 'flexible'
              ? '<span class="badge badge--flexible">flexible</span>'
              : '<span class="badge badge--todo">TODO</span>';

        return `
          <span class="frame-card__latin">${escapeHtml(item.latin)}</span>
          <span class="frame-card__gloss">${inlineItalics(escapeHtml(item.gloss))}</span>
          <div class="frame-card__badges">
            ${badge}
            <span class="badge badge--category">${escapeHtml(item.category)}</span>
          </div>
          ${item.notes ? `<p class="frame-card__notes">${inlineItalics(escapeHtml(item.notes.split('\n')[0]))}</p>` : ''}
        `;
      },

      renderDrawer: renderIdiomDrawer,

      customFilters: {
        render: () => `
          <div class="filter-section">
            <span class="filter-label">Inflection</span>
            <div class="filter-toggles">
              <button class="filter-toggle is-active" data-inflection="all">All</button>
              <button class="filter-toggle" data-inflection="fixed">Fixed</button>
              <button class="filter-toggle" data-inflection="flexible">Flexible</button>
            </div>
            <p class="filter-hint">Fixed: the form is locked to the idiom. Flexible: one or more elements of the idiom inflect.</p>
          </div>
        `,

        // wire the toggles once after the section is inserted into the DOM.
        // attaching a single delegated listener here (rather than inside getPredicates)
        // means re-renders never accumulate duplicate listeners on the buttons.
        onMount: (section, rerender) => {
          section.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-inflection]');
            if (!btn) return;
            section.querySelectorAll('[data-inflection]').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            rerender();
          });
        },

        // pure: read the active toggle and map it to filter predicates.
        getPredicates: () => {
          const active = document.querySelector('[data-inflection].is-active');
          const inflection = active?.dataset.inflection || 'all';
          const predicate = inflectionPredicate(inflection);
          return predicate ? [predicate] : [];
        },
      },
    });

  } catch (err) {
    console.error('Error loading idioms data:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading data. Please refresh the page.</p>';
  }
})();
}
