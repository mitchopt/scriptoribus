// workspace page: composes a study session from prompts, idioms, grammar, and templates.
// pure helpers are re-exported here so tests against workspace.js still work.

import {
  escapeHtml,
  inlineItalics,
  matchesQuery,
  groupByCategory,
} from './data.js';

// Pure state logic lives in workspace-state.js (no import-time side effects) so
// it can be shared with the source pages' "Open in workspace" buttons. Re-export
// the pure helpers here so existing imports/tests against workspace.js still work.
import {
  STORAGE_KEY,
  defaultState,
  rerollOne,
  applyManualPicks,
  setPromptSource,
  addToWorkspace,
  toggleItemLock,
  randomiseSlotKeepingLocked,
  serializeState,
  deserializeState,
} from './workspace-state.js';

import {
  renderTopicDrawer,
  renderGrammarDrawer,
  renderIdiomDrawer,
  renderTemplateDrawer,
  renderImageDrawer,
} from './detail-drawers.js';

export {
  defaultState,
  rerollOne,
  applyManualPicks,
  setPromptSource,
  addToWorkspace,
  toggleItemLock,
  randomiseSlotKeepingLocked,
  serializeState,
  deserializeState,
};

if (typeof document !== 'undefined') {
(async () => {
  try {
    // fetch all pools in parallel
    const [topicsRes, idiomsRes, grammarRes, imagesRes, templatesRes] = await Promise.all([
      fetch('./data/categories/topics.json'),
      fetch('./data/categories/idioms.json'),
      fetch('./data/categories/grammar.json'),
      fetch('./data/images/manifest.json'),
      fetch('./data/categories/templates.json'),
    ]);

    if (!topicsRes.ok || !idiomsRes.ok || !grammarRes.ok || !imagesRes.ok || !templatesRes.ok) {
      throw new Error('Failed to load one or more data files');
    }

    const topics       = await topicsRes.json();
    const idioms       = await idiomsRes.json();
    const grammar      = await grammarRes.json();
    const images       = await imagesRes.json();
    const templates    = await templatesRes.json();

    // two prompt maps because active source determines which pool to resolve stored ids against
    const byId = {
      text:     Object.fromEntries(topics.map(t    => [t.id, t])),
      image:    Object.fromEntries(images.map(i    => [i.id, i])),
      idiom:    Object.fromEntries(idioms.map(i    => [i.id, i])),
      grammar:  Object.fromEntries(grammar.map(g   => [g.id, g])),
      template: Object.fromEntries(templates.map(t => [t.id, t])),
    };

    let state = deserializeState(localStorage.getItem(STORAGE_KEY));

    function persist() {
      localStorage.setItem(STORAGE_KEY, serializeState(state));
    }

    function setState(next) {
      state = next;
      persist();
      render();
    }

    // prompt pool switches between topics and images based on current source
    function poolIdsFor(slotKey) {
      if (slotKey === 'prompt')   return state.promptSource === 'text' ? topics.map(t => t.id) : images.map(i => i.id);
      if (slotKey === 'idiom')    return idioms.map(i => i.id);
      if (slotKey === 'grammar')  return grammar.map(g => g.id);
      if (slotKey === 'template') return templates.map(t => t.id);
      return [];
    }

    const content = document.getElementById('content');
    content.innerHTML = `
      <div id="workspace-layout" style="
        display: grid;
        grid-template-columns: 1fr 1.2fr;
        gap: var(--s5);
        align-items: start;
      ">

        <!-- Left: controls -->
        <section id="workspace-controls">
          <h1 class="page-heading">Workspace</h1>
          <p class="text-muted" style="margin-bottom: var(--s5);">
            Compose a study session by sampling prompts, idioms, grammar constructions, and templates.
            Use Browse to hand-pick items; your workspace persists between visits.
          </p>

          <!-- Prompt source toggle -->
          <div style="margin-bottom: var(--s5);">
            <label class="filter-label" style="display: block; margin-bottom: var(--s2);">
              Prompt source
            </label>
            <div id="source-toggle" role="group" style="display: inline-flex; gap: var(--s1);">
              <button class="btn btn--secondary" data-source="text" aria-pressed="false">Text prompts</button>
              <button class="btn btn--secondary" data-source="image" aria-pressed="false">Images</button>
            </div>
          </div>

          <!-- Count rows -->
          <div id="count-rows" style="display: flex; flex-direction: column; gap: var(--s4); margin-bottom: var(--s5);"></div>

          <!-- Action buttons -->
          <div style="display: flex; flex-direction: column; gap: var(--s3);">
            <div style="display: flex; gap: var(--s2);">
              <button class="btn btn--primary"   id="btn-randomise-all">Randomise all</button>
              <button class="btn btn--secondary" id="btn-randomise-prompts">Randomise prompts</button>
              <button class="btn btn--secondary" id="btn-randomise-skills">Randomise target skills</button>
              <button class="btn btn--secondary" id="btn-randomise-templates">Randomise templates</button>
            </div>
            <button class="btn btn--secondary" id="btn-clear" style="align-self: flex-start;">Clear workspace</button>
          </div>
        </section>

        <!-- Right: workspace panel -->
        <aside id="workspace-panel" style="
          position: sticky;
          top: var(--s5);
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: var(--s4);
          box-shadow: var(--shadow-paper);
          max-height: calc(100vh - var(--s5) * 2);
          overflow-y: auto;
        ">
          <h2 style="
            font-family: var(--font-display);
            font-size: 1.25rem;
            margin-bottom: var(--s4);
            color: var(--ink);
          ">
            Current Workspace
          </h2>
          <div id="slot-prompt"   class="workspace-slot"></div>
          <div id="slot-idiom"    class="workspace-slot"></div>
          <div id="slot-grammar"  class="workspace-slot"></div>
          <div id="slot-template" class="workspace-slot"></div>
        </aside>
      </div>

      <!-- Browse modal (created once, reused) -->
      <dialog id="browse-dialog" style="
        padding: 0;
        border: 1px solid var(--border);
        border-radius: var(--r-lg);
        background: var(--surface-raised);
        max-width: 600px;
        width: 90vw;
        max-height: 80vh;
        box-shadow: 0 8px 24px rgba(31,27,22,0.25);
      ">
        <div style="display: flex; flex-direction: column; max-height: 80vh;">
          <div style="padding: var(--s4); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--s3);">
            <h3 id="browse-title" style="font-family: var(--font-display); font-size: 1.15rem; flex: 1; margin: 0;">Browse</h3>
            <button id="browse-close" class="btn btn--secondary" aria-label="Close">&#10005;</button>
          </div>
          <div style="padding: var(--s3) var(--s4);">
            <input id="browse-search" type="search" class="filter-search" placeholder="Search…" aria-label="Search" style="width: 100%;">
          </div>
          <div id="browse-list" style="
            flex: 1;
            overflow-y: auto;
            padding: 0 var(--s4) var(--s3);
            min-height: 200px;
          "></div>
          <div style="
            padding: var(--s3) var(--s4);
            border-top: 1px solid var(--border);
            display: flex;
            gap: var(--s2);
            justify-content: flex-end;
          ">
            <button id="browse-cancel" class="btn btn--secondary">Cancel</button>
            <button id="browse-apply"  class="btn btn--primary">Apply picks</button>
          </div>
        </div>
      </dialog>

      <!-- Detail drawer (created once, reused) - the same right-side panel the
           Grammar / Topics / Idioms / Templates pages show for an item -->
      <dialog class="frame-detail-drawer"></dialog>

      <!-- Image lightbox (created once, reused) - mirrors the gallery's full-size view -->
      <dialog id="image-lightbox" style="
        padding: 0;
        border: none;
        background: transparent;
        max-width: 100vw;
        max-height: 100vh;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      "></dialog>

      <style>
        #image-lightbox::backdrop { background: rgba(0, 0, 0, 0.85); }
        .workspace-slot { margin-bottom: var(--s4); }
        .workspace-slot:last-child { margin-bottom: 0; }
        .workspace-slot__header {
          display: flex; align-items: center; gap: var(--s2);
          margin-bottom: var(--s2);
        }
        .workspace-slot__label {
          font-family: var(--font-display);
          font-size: 0.85rem; font-weight: 600;
          color: var(--ink-muted);
          text-transform: uppercase; letter-spacing: 0.04em;
          flex: 1;
        }
        .workspace-card {
          background: var(--parchment);
          border: 1px solid var(--border);
          border-radius: var(--r);
          padding: var(--s2) var(--s3);
          margin-bottom: var(--s2);
          display: flex; align-items: flex-start; gap: var(--s2);
        }
        .workspace-card:last-child { margin-bottom: 0; }
        .workspace-card__body { flex: 1; min-width: 0; }
        .workspace-card__action {
          font: inherit; text-align: left; background: none; border: none;
          padding: 0; color: inherit; cursor: pointer; display: block; width: 100%;
        }
        .workspace-card__action:hover .workspace-card__title,
        .workspace-card__action:hover .workspace-card__latin { color: var(--accent); }
        /* image cards: the whole row (thumbnail + text) is one clickable button */
        .workspace-card__action--media {
          display: flex; align-items: flex-start; gap: var(--s2);
          flex: 1; min-width: 0;
        }
        .workspace-card__title {
          font-size: 0.95rem; color: var(--ink);
          margin-bottom: 2px; line-height: 1.4;
        }
        .workspace-card__sub {
          font-size: 0.8rem; color: var(--ink-muted);
        }
        .workspace-card__latin {
          font-family: var(--font-mono);
          font-size: 0.95rem; color: var(--ink);
        }
        .workspace-card__gloss {
          font-style: italic;
          font-size: 0.85rem; color: var(--ink-muted);
        }
        .workspace-card__reroll {
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--r);
          padding: 2px 6px;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--ink-muted);
          flex-shrink: 0;
        }
        .workspace-card__reroll:hover { background: var(--parchment-dark); color: var(--ink); }
        .workspace-card__reroll[disabled] { opacity: 0.4; cursor: not-allowed; }
        .workspace-card__actions {
          display: flex; flex-direction: column; gap: var(--s1);
          flex-shrink: 0;
        }
        .workspace-card__lock {
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--r);
          padding: 2px 6px;
          cursor: pointer;
          font-size: 0.85rem;
          line-height: 1;
          color: var(--ink-muted);
        }
        .workspace-card__lock:hover { background: var(--parchment-dark); color: var(--ink); }
        .workspace-card__lock[disabled] { opacity: 0.4; cursor: not-allowed; }
        .workspace-card__lock.is-locked { border-color: var(--accent); color: var(--accent); }
        .workspace-card__thumb {
          width: 56px; height: 56px;
          object-fit: cover;
          border-radius: var(--r);
          flex-shrink: 0;
        }
        .workspace-empty {
          font-style: italic;
          color: var(--ink-muted);
          padding: var(--s2) var(--s3);
        }
        .count-row {
          display: flex; align-items: end; gap: var(--s3);
        }
        .count-row > div:first-child { flex: 1; }
        .count-row select { width: 100px; }
        .browse-item {
          display: flex; align-items: flex-start; gap: var(--s2);
          padding: var(--s2);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
        }
        .browse-item:hover { background: var(--parchment-dark); }
        .browse-item input[type="checkbox"] { margin-top: 4px; flex-shrink: 0; }
        .browse-item__body { flex: 1; min-width: 0; }
        .browse-group-header {
          font-family: var(--font-display);
          font-size: 0.85rem; font-weight: 600;
          color: var(--ink-muted);
          text-transform: uppercase; letter-spacing: 0.04em;
          padding: var(--s3) var(--s2) var(--s1);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 900px) {
          #workspace-layout { grid-template-columns: 1fr !important; }
          #workspace-panel { position: static !important; max-height: none !important; }
        }
      </style>
    `;

    const els = {
      sourceToggle: document.getElementById('source-toggle'),
      countRows:    document.getElementById('count-rows'),
      slotPrompt:   document.getElementById('slot-prompt'),
      slotIdiom:    document.getElementById('slot-idiom'),
      slotGrammar:  document.getElementById('slot-grammar'),
      slotTemplate: document.getElementById('slot-template'),
      dialog:       document.getElementById('browse-dialog'),
      browseTitle:  document.getElementById('browse-title'),
      browseSearch: document.getElementById('browse-search'),
      browseList:   document.getElementById('browse-list'),
      lightbox:     document.getElementById('image-lightbox'),
      drawer:       document.querySelector('.frame-detail-drawer'),
    };

    // e.target === dialog only on backdrop clicks (not content clicks)
    els.lightbox.addEventListener('click', (e) => {
      if (e.target === els.lightbox) els.lightbox.close();
    });

    els.drawer.addEventListener('click', (e) => {
      if (e.target === els.drawer) els.drawer.close();
    });

    const DETAIL = {
      topic:    { byId: byId.text,     render: renderTopicDrawer },
      idiom:    { byId: byId.idiom,    render: renderIdiomDrawer },
      grammar:  { byId: byId.grammar,  render: renderGrammarDrawer },
      template: { byId: byId.template, render: renderTemplateDrawer },
      image:    { byId: byId.image,    render: renderImageDrawer },
    };

    // aria-pressed is set alongside the visual class for screen-reader parity
    function renderSourceToggle() {
      els.sourceToggle.querySelectorAll('button').forEach(btn => {
        const isActive = btn.dataset.source === state.promptSource;
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.className = isActive ? 'btn btn--primary' : 'btn btn--secondary';
      });
    }

    function renderCountRows() {
      const promptLabel = state.promptSource === 'text' ? 'Prompts (text)' : 'Prompts (images)';
      const rows = [
        { key: 'prompt',   label: promptLabel },
        { key: 'idiom',    label: 'Idioms' },
        { key: 'grammar',  label: 'Grammar topics' },
        { key: 'template', label: 'Templates' },
      ];
      els.countRows.innerHTML = rows.map(row => `
        <div class="count-row">
          <div>
            <label class="filter-label" style="display: block; margin-bottom: var(--s2);">
              ${escapeHtml(row.label)}
            </label>
            <select data-count="${row.key}" class="filter-search">
              ${Array.from({ length: 11 }, (_, i) => `
                <option value="${i}"${state.counts[row.key] === i ? ' selected' : ''}>${i}</option>
              `).join('')}
            </select>
          </div>
          <button class="btn btn--secondary" data-browse="${row.key}">Browse…</button>
        </div>
      `).join('');

      els.countRows.querySelectorAll('select[data-count]').forEach(sel => {
        sel.addEventListener('change', () => {
          const k = sel.dataset.count;
          const n = parseInt(sel.value, 10);
          setState({ ...state, counts: { ...state.counts, [k]: n } });
        });
      });

      els.countRows.querySelectorAll('button[data-browse]').forEach(btn => {
        btn.addEventListener('click', () => openBrowseModal(btn.dataset.browse));
      });
    }

    function renderSlot(slotKey, container) {
      const slotIds = state.slots[slotKey];
      const labelByKey = {
        prompt:   state.promptSource === 'text' ? 'Prompts' : 'Image prompts',
        idiom:    'Idioms',
        grammar:  'Grammar',
        template: 'Templates',
      };

      const cards = slotIds.length === 0
        ? `<div class="workspace-empty">—</div>`
        : slotIds.map((id, index) => renderSlotCard(slotKey, id, index)).join('');

      container.innerHTML = `
        <div class="workspace-slot__header">
          <span class="workspace-slot__label">${escapeHtml(labelByKey[slotKey])}</span>
        </div>
        ${cards}
      `;

      container.querySelectorAll('button[data-reroll]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.reroll, 10);
          const pool = poolIdsFor(slotKey);
          const nextSlot = rerollOne(state.slots[slotKey], idx, pool);
          setState({ ...state, slots: { ...state.slots, [slotKey]: nextSlot } });
        });
      });

      container.querySelectorAll('button[data-lock]').forEach(btn => {
        btn.addEventListener('click', () => {
          setState(toggleItemLock(state, slotKey, btn.dataset.lock));
        });
      });

      container.querySelectorAll('button[data-detail-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cfg = DETAIL[btn.dataset.detailKind];
          const item = cfg && cfg.byId[btn.dataset.detailId];
          if (item) openDetailDrawer(item, cfg.render);
        });
      });
    }

    function renderSlotCard(slotKey, id, index) {
      const itemLocked = state.lockedItems[slotKey].includes(id);
      const rerollAttrs = itemLocked
        ? `disabled title="Locked — unlock to reroll"`
        : `data-reroll="${index}" title="Reroll this item"`;
      const lockAttrs = `data-lock="${escapeHtml(id)}" title="${itemLocked ? 'Unlock this item' : 'Lock this item'}"`;
      // U+FE0E variation selector forces monochrome glyph (prevents emoji rendering)
      const lockGlyph = itemLocked ? '&#128274;&#65038;' : '&#128275;&#65038;';
      const actions = `
            <div class="workspace-card__actions">
              <button class="workspace-card__reroll" ${rerollAttrs}>↻</button>
              <button class="workspace-card__lock${itemLocked ? ' is-locked' : ''}" ${lockAttrs}>${lockGlyph}</button>
            </div>`;

      if (slotKey === 'prompt') {
        if (state.promptSource === 'text') {
          const item = byId.text[id];
          if (!item) return '';
          return `
            <div class="workspace-card">
              <button class="workspace-card__body workspace-card__action" data-detail-kind="topic" data-detail-id="${escapeHtml(item.id)}" title="View details">
                <div class="workspace-card__title">${inlineItalics(escapeHtml(item.name))}</div>
                <div class="workspace-card__sub">${escapeHtml(item.category)}</div>
              </button>
              ${actions}
            </div>
          `;
        }
        const item = byId.image[id];
        if (!item) return '';
        return `
          <div class="workspace-card">
            <button class="workspace-card__action workspace-card__action--media" data-detail-kind="image" data-detail-id="${escapeHtml(item.id)}" title="View image details">
              <img class="workspace-card__thumb" src="./data/images/${escapeHtml(item.file)}" alt="${escapeHtml(item.name)}">
              <div class="workspace-card__body">
                <div class="workspace-card__title">${escapeHtml(item.name)}</div>
                <div class="workspace-card__sub">${inlineItalics(escapeHtml(item.description))}</div>
              </div>
            </button>
            ${actions}
          </div>
        `;
      }

      if (slotKey === 'idiom') {
        const item = byId.idiom[id];
        if (!item) return '';
        const badgeClass = item.inflection === 'fixed'
          ? 'badge--fixed'
          : (item.inflection === 'flexible' ? 'badge--flexible' : 'badge--todo');
        return `
          <div class="workspace-card">
            <button class="workspace-card__body workspace-card__action" data-detail-kind="idiom" data-detail-id="${escapeHtml(item.id)}" title="View details">
              <div class="workspace-card__latin">${escapeHtml(item.latin)}</div>
              <div class="workspace-card__gloss">${inlineItalics(escapeHtml(item.gloss))}</div>
              <div style="margin-top: 4px;">
                <span class="badge ${badgeClass}" style="font-size: 0.7rem;">${escapeHtml(item.inflection || 'todo')}</span>
                <span class="workspace-card__sub" style="margin-left: var(--s1);">${escapeHtml(item.category)}</span>
              </div>
            </button>
            ${actions}
          </div>
        `;
      }

      if (slotKey === 'grammar') {
        const item = byId.grammar[id];
        if (!item) return '';
        return `
          <div class="workspace-card">
            <button class="workspace-card__body workspace-card__action" data-detail-kind="grammar" data-detail-id="${escapeHtml(item.id)}" title="View details">
              <div class="workspace-card__title">${inlineItalics(escapeHtml(item.name))}</div>
              <div class="workspace-card__sub">${escapeHtml(item.category)}</div>
            </button>
            ${actions}
          </div>
        `;
      }

      if (slotKey === 'template') {
        const item = byId.template[id];
        if (!item) return '';
        return `
          <div class="workspace-card">
            <button class="workspace-card__body workspace-card__action" data-detail-kind="template" data-detail-id="${escapeHtml(item.id)}" title="View details">
              <div class="workspace-card__title">${escapeHtml(item.name)}</div>
              <div class="workspace-card__sub">${escapeHtml(item.category)}</div>
              <div class="workspace-card__sub" style="margin-top:2px;">${inlineItalics(escapeHtml(item.summary))}</div>
            </button>
            ${actions}
          </div>
        `;
      }
      return '';
    }

    function render() {
      renderSourceToggle();
      renderCountRows();
      renderSlot('prompt',   els.slotPrompt);
      renderSlot('idiom',    els.slotIdiom);
      renderSlot('grammar',  els.slotGrammar);
      renderSlot('template', els.slotTemplate);
    }

    // mirrors filterable-grid's drawer logic, minus the "Open in workspace" footer.
    // .drawer-image-btn is present on the image drawer; absent on all others.
    function openDetailDrawer(item, renderFn) {
      els.drawer.innerHTML = renderFn(item);
      const closeBtn = els.drawer.querySelector('.drawer-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => els.drawer.close());
      const imgBtn = els.drawer.querySelector('.drawer-image-btn');
      if (imgBtn) imgBtn.addEventListener('click', () => openLightbox(item));
      els.drawer.showModal();
    }

    function openLightbox(item) {
      els.lightbox.innerHTML = `
        <div style="
          position: relative;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img src="./data/images/${escapeHtml(item.file)}"
               alt="${escapeHtml(item.name || '')}"
               style="
            max-width: 95vw;
            max-height: 95vh;
            object-fit: contain;
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
          ">
          <button id="lightbox-close" aria-label="Close" style="
            position: absolute;
            top: var(--s4);
            right: var(--s4);
            background: rgba(31, 27, 22, 0.7);
            color: var(--ink-on-dark);
            border: none;
            border-radius: var(--r);
            padding: var(--s2) var(--s3);
            font-size: 1.2rem;
            line-height: 1;
            cursor: pointer;
          ">
            &#10005;
          </button>
        </div>
      `;

      els.lightbox.querySelector('#lightbox-close')
        .addEventListener('click', () => els.lightbox.close());

      els.lightbox.showModal();
    }

    function randomiseSlotIn(s, slotKey) {
      const pool = poolIdsFor(slotKey);
      const picked = randomiseSlotKeepingLocked(s.slots[slotKey], s.lockedItems[slotKey], s.counts[slotKey], pool);
      return { ...s, slots: { ...s.slots, [slotKey]: picked } };
    }

    document.getElementById('btn-randomise-prompts').addEventListener('click', () => {
      setState(randomiseSlotIn(state, 'prompt'));
    });

    document.getElementById('btn-randomise-skills').addEventListener('click', () => {
      let next = randomiseSlotIn(state, 'idiom');
      next = randomiseSlotIn(next, 'grammar');
      setState(next);
    });

    document.getElementById('btn-randomise-templates').addEventListener('click', () => {
      setState(randomiseSlotIn(state, 'template'));
    });

    document.getElementById('btn-randomise-all').addEventListener('click', () => {
      let next = randomiseSlotIn(state, 'prompt');
      next = randomiseSlotIn(next, 'idiom');
      next = randomiseSlotIn(next, 'grammar');
      next = randomiseSlotIn(next, 'template');
      setState(next);
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      setState(defaultState());
    });

    els.sourceToggle.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        setState(setPromptSource(state, btn.dataset.source));
      });
    });

    let browseContext = null; // { slotKey, items, selected: Set<string> }

    function openBrowseModal(slotKey) {
      const titleByKey = {
        prompt:   state.promptSource === 'text' ? 'Browse prompts' : 'Browse images',
        idiom:    'Browse idioms',
        grammar:  'Browse grammar topics',
        template: 'Browse templates',
      };
      els.browseTitle.textContent = titleByKey[slotKey];
      els.browseSearch.value = '';

      let items;
      if (slotKey === 'prompt') {
        items = state.promptSource === 'text' ? topics : images;
      } else if (slotKey === 'idiom') {
        items = idioms;
      } else if (slotKey === 'template') {
        items = templates;
      } else {
        items = grammar;
      }

      browseContext = {
        slotKey,
        items,
        selected: new Set(state.slots[slotKey]),
      };

      renderBrowseList('');
      els.dialog.showModal();
    }

    // idioms/grammar/templates are grouped by category; prompts and images are flat
    function renderBrowseList(query) {
      if (!browseContext) return;
      const { slotKey, items, selected } = browseContext;

      const searchFields = slotKey === 'idiom'
        ? ['latin', 'gloss', 'category', 'notes']
        : (slotKey === 'prompt' && state.promptSource === 'image')
          ? ['name', 'description']
          : slotKey === 'template'
            ? ['name', 'category', 'summary']
            : ['name', 'category', 'notes'];

      const filtered = items.filter(it => matchesQuery(it, query, searchFields));

      const shouldGroup = (slotKey === 'idiom' || slotKey === 'grammar' || slotKey === 'template');
      let html;
      if (shouldGroup) {
        const grouped = groupByCategory(filtered);
        html = Object.entries(grouped).map(([cat, group]) => `
          <div class="browse-group-header">${escapeHtml(cat)}</div>
          ${group.map(it => renderBrowseItem(it, selected.has(it.id))).join('')}
        `).join('');
      } else {
        html = filtered.map(it => renderBrowseItem(it, selected.has(it.id))).join('');
      }

      els.browseList.innerHTML = html || '<p class="text-muted italic" style="padding: var(--s4);">No matches.</p>';

      els.browseList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
          const id = cb.dataset.id;
          if (cb.checked) selected.add(id);
          else selected.delete(id);
        });
      });
    }

    function renderBrowseItem(item, isChecked) {
      const ctx = browseContext;
      let bodyHtml;
      if (ctx.slotKey === 'idiom') {
        bodyHtml = `
          <div class="workspace-card__latin">${escapeHtml(item.latin)}</div>
          <div class="workspace-card__gloss">${inlineItalics(escapeHtml(item.gloss))}</div>
        `;
      } else if (ctx.slotKey === 'prompt' && state.promptSource === 'image') {
        bodyHtml = `
          <div class="workspace-card__title">${escapeHtml(item.name)}</div>
          <div class="workspace-card__sub">${inlineItalics(escapeHtml(item.description))}</div>
        `;
      } else {
        // shared by prompt-text/grammar/template; inlineItalics is a no-op on the
        // asterisk-free grammar/template names and renders italics in prompt text
        bodyHtml = `
          <div class="workspace-card__title">${inlineItalics(escapeHtml(item.name))}</div>
          ${item.category ? `<div class="workspace-card__sub">${escapeHtml(item.category)}</div>` : ''}
        `;
      }
      return `
        <label class="browse-item">
          <input type="checkbox" data-id="${escapeHtml(item.id)}"${isChecked ? ' checked' : ''}>
          <div class="browse-item__body">${bodyHtml}</div>
        </label>
      `;
    }

    els.browseSearch.addEventListener('input', () => {
      renderBrowseList(els.browseSearch.value);
    });

    // cancel/close discard checkbox state; apply commits and locks every picked item
    document.getElementById('browse-close').addEventListener('click', () => {
      els.dialog.close();
    });
    document.getElementById('browse-cancel').addEventListener('click', () => {
      els.dialog.close();
    });
    document.getElementById('browse-apply').addEventListener('click', () => {
      if (!browseContext) { els.dialog.close(); return; }
      const picks = Array.from(browseContext.selected);
      setState(applyManualPicks(state, browseContext.slotKey, picks));
      els.dialog.close();
    });
    els.dialog.addEventListener('click', (e) => {
      if (e.target === els.dialog) els.dialog.close();
    });

    render();

  } catch (err) {
    console.error('Error loading workspace:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading workspace data. Please refresh the page.</p>';
  }
})();
}
