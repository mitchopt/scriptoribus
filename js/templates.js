import { mountFilterableGrid } from './filterable-grid.js';
import { escapeHtml, inlineItalics } from './data.js';
import { renderTemplateDrawer } from './detail-drawers.js';

(async () => {
  try {
    const res = await fetch('./data/categories/templates.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    mountFilterableGrid({
      container: '#content',
      data,
      searchFields: ['name', 'category', 'summary', 'description'],
      countNoun: 'template',
      workspaceTarget: { slotKey: 'template' },

      // full description is drawer-only; the card shows just the one-sentence summary
      renderCard: (item) => `
        <span class="frame-card__title">${escapeHtml(item.name)}</span>
        <div class="frame-card__badges">
          <span class="badge badge--category">${escapeHtml(item.category)}</span>
        </div>
        <p class="frame-card__notes">${inlineItalics(escapeHtml(item.summary))}</p>
      `,

      renderDrawer: renderTemplateDrawer,
    });
  } catch (err) {
    console.error('Error loading templates data:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading data. Please refresh the page.</p>';
  }
})();
