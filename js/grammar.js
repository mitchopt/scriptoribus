import { mountFilterableGrid } from './filterable-grid.js';
import { escapeHtml, inlineItalics } from './data.js';
import { renderGrammarDrawer } from './detail-drawers.js';

(async () => {
  try {
    const res = await fetch('./data/categories/grammar.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    mountFilterableGrid({
      container: '#content',
      data,
      searchFields: ['name', 'category', 'notes', 'latinExpression'],
      countNoun: 'grammar',
      workspaceTarget: { slotKey: 'grammar' },

      // notes omitted when empty or still holding the "TODO" placeholder
      renderCard: (item) => `
        <span class="frame-card__title">${inlineItalics(escapeHtml(item.name))}</span>
        <div class="frame-card__badges">
          <span class="badge badge--category">${escapeHtml(item.category)}</span>
        </div>
        ${item.notes && item.notes !== 'TODO'
          ? `<p class="frame-card__notes">${inlineItalics(escapeHtml(item.notes))}</p>`
          : ''}
      `,

      renderDrawer: renderGrammarDrawer,
    });
  } catch (err) {
    console.error('Error loading grammar data:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading data. Please refresh the page.</p>';
  }
})();
