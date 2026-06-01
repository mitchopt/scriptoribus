import { mountFilterableGrid } from './filterable-grid.js';
import { escapeHtml, inlineItalics } from './data.js';
import { renderTopicDrawer } from './detail-drawers.js';

(async () => {
  try {
    const res = await fetch('./data/categories/topics.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    mountFilterableGrid({
      container: '#content',
      data,
      searchFields: ['name', 'category', 'notes'],
      countNoun: 'topic',
      workspaceTarget: { slotKey: 'prompt', source: 'text' },

      // inlineItalics applied because prompt names may contain *asterisk* markup
      renderCard: (item) => `
        <span class="frame-card__title">${inlineItalics(escapeHtml(item.name))}</span>
        <div class="frame-card__badges">
          <span class="badge badge--category">${escapeHtml(item.category)}</span>
        </div>
        ${item.notes && item.notes !== 'TODO'
          ? `<p class="frame-card__notes">${inlineItalics(escapeHtml(item.notes))}</p>`
          : ''}
      `,

      renderDrawer: renderTopicDrawer,
    });
  } catch (err) {
    console.error('Error loading topics data:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading data. Please refresh the page.</p>';
  }
})();
