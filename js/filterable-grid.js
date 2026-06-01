// reusable search + filter + card-grid + drawer component, used by Grammar, Topics, Idioms, and Templates.

import {
  matchesQuery,
  uniqueCategories,
  escapeHtml,
} from './data.js';
import { sendToWorkspace } from './workspace-state.js';

// all filters are AND-ed; returns filtered items in original order.
export function applyFilters({
  items,
  query,
  activeCategory,
  customPredicates = [],
  searchFields = ['name'],
}) {
  return items.filter(item => {
    // Query filter
    if (!matchesQuery(item, query, searchFields)) return false;

    // Category filter
    if (activeCategory !== 'All categories' && item.category !== activeCategory) {
      return false;
    }

    // Custom predicates (all must pass)
    for (const predicate of customPredicates) {
      if (!predicate(item)) return false;
    }

    return true;
  });
}

export function formatCount(visible, total, noun) {
  const nounPlural = visible === 1 ? noun : noun + 's';
  return `Showing ${visible} of ${total} ${nounPlural}`;
}

export function buildCategoryList(items) {
  const cats = uniqueCategories(items);
  return ['All categories', ...cats];
}

function appendWorkspaceButton(drawer, item, target) {
  const host = drawer.querySelector('.drawer-body') || drawer;
  const section = document.createElement('div');
  section.className = 'drawer-section drawer-workspace-section';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn--primary';
  btn.textContent = 'Open in workspace';
  btn.addEventListener('click', () => {
    sendToWorkspace({ slotKey: target.slotKey, id: item.id, source: target.source ?? null });
  });
  section.appendChild(btn);
  host.appendChild(section);
}

export function mountFilterableGrid({
  container,
  data,
  searchFields = ['name'],
  renderCard,
  renderDrawer,
  countNoun,
  customFilters = null,
  workspaceTarget = null,
}) {
  const contentEl = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!contentEl) {
    console.error('FilterableGrid: container not found');
    return;
  }

  let query = '';
  let activeCategory = 'All categories';
  let activeCustom = {};

  // page-browser switches #content from padded-scroll to the flex two-column layout
  contentEl.classList.add('page-browser');

  const filterPanel = document.createElement('aside');
  filterPanel.className = 'frames-filter-panel';

  const searchSection = document.createElement('div');
  searchSection.className = 'filter-section';
  searchSection.innerHTML = `
    <label class="filter-label" for="filter-search">Search</label>
    <input class="filter-search" id="filter-search" type="text"
           placeholder="Search entries…" autocomplete="off">
  `;
  filterPanel.appendChild(searchSection);

  const searchInput = searchSection.querySelector('#filter-search');

  let customSection = null;
  if (customFilters) {
    customSection = document.createElement('div');
    customSection.className = 'filter-section';
    customSection.innerHTML = customFilters.render();
    filterPanel.appendChild(customSection);
  }

  const categorySection = document.createElement('div');
  categorySection.className = 'filter-section';
  const categoryLabel = document.createElement('span');
  categoryLabel.className = 'filter-label';
  categoryLabel.textContent = 'Category';
  categorySection.appendChild(categoryLabel);

  const pills = document.createElement('div');
  pills.className = 'filter-pills';
  const cats = buildCategoryList(data);
  for (const cat of cats) {
    const pill = document.createElement('button');
    pill.className = 'filter-pill' + (cat === 'All categories' ? ' is-active' : '');
    pill.textContent = cat;
    pill.dataset.category = cat;
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      activeCategory = cat;
      render();
    });
    pills.appendChild(pill);
  }
  categorySection.appendChild(pills);
  filterPanel.appendChild(categorySection);

  const countEl = document.createElement('p');
  countEl.className = 'filter-count';
  filterPanel.appendChild(countEl);

  const mainArea = document.createElement('div');
  mainArea.className = 'frames-main';

  const heading = document.createElement('h1');
  heading.className = 'page-heading';
  heading.textContent = countNoun.charAt(0).toUpperCase() + countNoun.slice(1);
  mainArea.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'card-grid';
  mainArea.appendChild(grid);

  const drawer = document.createElement('dialog');
  drawer.className = 'frame-detail-drawer';
  // appended to #content rather than body so body's two-column grid stays at exactly two children;
  // showModal() lifts the dialog to the browser's top layer regardless of DOM nesting
  contentEl.appendChild(drawer);

  // e.target === drawer only on backdrop clicks; content clicks bubble to a child element
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) drawer.close();
  });

  searchInput.addEventListener('input', (e) => {
    query = e.target.value;
    render();
  });

  function render() {
    const customPredicates = customFilters ? customFilters.getPredicates() : [];

    const filtered = applyFilters({
      items: data,
      query,
      activeCategory,
      customPredicates,
      searchFields,
    });

    grid.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = `No ${countNoun}s match your filters.`;
      grid.appendChild(empty);
    } else {
      for (const item of filtered) {
        const card = document.createElement('button');
        card.className = 'frame-card';
        card.innerHTML = renderCard(item);
        card.addEventListener('click', () => {
          drawer.innerHTML = renderDrawer(item);
          const closeBtn = drawer.querySelector('.drawer-close-btn');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => drawer.close());
          }
          if (workspaceTarget) {
            appendWorkspaceButton(drawer, item, workspaceTarget);
          }
          drawer.showModal();
        });
        grid.appendChild(card);
      }
    }

    countEl.textContent = formatCount(filtered.length, data.length, countNoun);
  }

  contentEl.appendChild(filterPanel);
  contentEl.appendChild(mainArea);

  // onMount wires controls once (with a rerender callback); getPredicates() reads state on demand.
  // separating the two means adding a listener doesn't also re-evaluate the predicate.
  if (customFilters && typeof customFilters.onMount === 'function') {
    customFilters.onMount(customSection, render);
  }

  render();
}
