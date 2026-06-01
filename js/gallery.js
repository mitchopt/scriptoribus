// image gallery: filter panel + thumbnail grid + persistent sidebar + modal lightbox.
// the sidebar is intentionally non-modal so users can keep clicking thumbnails.

import { escapeHtml, inlineItalics } from './data.js';
import { applyFilters, formatCount, buildCategoryList } from './filterable-grid.js';
import { sendToWorkspace } from './workspace-state.js';

(async () => {
  try {
    const res = await fetch('./data/images/manifest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = await res.json();

    const content = document.getElementById('content');
    content.classList.add('page-browser');

    // appended to <body> (not #content) so the sidebar overlays the full page width
    // without being clipped inside the content area
    const sidebar = document.createElement('aside');
    sidebar.id = 'gallery-sidebar';
    sidebar.style.cssText = `
      position: fixed;
      right: 0;
      top: 0;
      width: 420px;
      max-width: 90vw;
      height: 100vh;
      background: var(--surface-raised);
      border-left: 1px solid var(--border);
      box-shadow: -4px 0 24px rgba(31, 27, 22, 0.16);
      overflow-y: auto;
      padding: var(--s5);
      display: flex;
      flex-direction: column;
      gap: var(--s4);
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 200ms ease;
    `;
    sidebar.classList.add('is-closed');
    document.body.appendChild(sidebar);

    const filterPanel = document.createElement('aside');
    filterPanel.className = 'frames-filter-panel';

    const searchSection = document.createElement('div');
    searchSection.className = 'filter-section';
    searchSection.innerHTML = `
      <label class="filter-label" for="filter-search">Search</label>
      <input class="filter-search" id="filter-search" type="text"
             placeholder="Search images…" autocomplete="off">
    `;
    filterPanel.appendChild(searchSection);

    const categorySection = document.createElement('div');
    categorySection.className = 'filter-section';
    const categoryLabel = document.createElement('span');
    categoryLabel.className = 'filter-label';
    categoryLabel.textContent = 'Category';
    categorySection.appendChild(categoryLabel);

    const pills = document.createElement('div');
    pills.className = 'filter-pills';
    const cats = buildCategoryList(manifest);
    for (const cat of cats) {
      const pill = document.createElement('button');
      pill.className = 'filter-pill' + (cat === 'All categories' ? ' is-active' : '');
      pill.textContent = cat;
      pill.dataset.category = cat;
      pill.addEventListener('click', () => {
        pills.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('is-active'));
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
    mainArea.innerHTML = `
      <h1 class="page-heading">Image Gallery</h1>
      <p class="text-muted" style="margin-top: calc(-1 * var(--s4)); margin-bottom: var(--s5);">
        Click a thumbnail to view details. Click the larger image to see it full-size.
      </p>
      <div id="thumbnail-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: var(--s4);
      "></div>
    `;
    const grid = mainArea.querySelector('#thumbnail-grid');

    // appended to #content (not body) so body's two-column grid stays at exactly two children;
    // showModal() lifts the lightbox to the top layer regardless of DOM nesting
    const lightbox = document.createElement('dialog');
    lightbox.id = 'image-lightbox';
    lightbox.style.cssText = `
      padding: 0;
      border: none;
      background: transparent;
      max-width: 100vw;
      max-height: 100vh;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    `;

    content.appendChild(filterPanel);
    content.appendChild(mainArea);
    content.appendChild(lightbox);

    // e.target === lightbox only on backdrop clicks
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.close();
    });

    // sync the sidebar to whichever image the user ended on after cycling in the lightbox
    lightbox.addEventListener('close', () => {
      const item = lightboxList[lightboxIndex];
      if (item) openSidebar(item);
    });

    let query = '';
    let activeCategory = 'All categories';

    // snapshot of the current filtered set; the lightbox cycles through this so
    // navigation respects whatever search/category filter is active.
    let visibleItems = [];
    let lightboxList = [];
    let lightboxIndex = 0;

    const searchInput = searchSection.querySelector('#filter-search');
    searchInput.addEventListener('input', (e) => {
      query = e.target.value;
      render();
    });

    function render() {
      const filtered = applyFilters({
        items: manifest,
        query,
        activeCategory,
        searchFields: ['name', 'description', 'topic', 'category'],
      });

      visibleItems = filtered;

      grid.innerHTML = '';

      if (filtered.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.style.gridColumn = '1 / -1';
        empty.textContent = 'No images match your filters.';
        grid.appendChild(empty);
      } else {
        for (const item of filtered) {
          grid.appendChild(buildThumbnail(item));
        }
      }

      countEl.textContent = formatCount(filtered.length, manifest.length, 'image');
    }

    function buildThumbnail(item) {
      const thumb = document.createElement('button');
      thumb.className = 'frame-card';
      thumb.style.cssText = `
        aspect-ratio: 1;
        overflow: hidden;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--parchment-dark);
        position: relative;
      `;

      const img = document.createElement('img');
      img.src = `./data/images/${item.file}`;
      img.alt = item.name || '';
      img.loading = 'lazy';
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      thumb.appendChild(img);

      const label = document.createElement('div');
      label.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--overlay-dark);
        color: var(--ink-on-dark);
        padding: var(--s2) var(--s3);
        font-size: 0.85rem;
        text-align: center;
        opacity: 0;
        transition: opacity 150ms ease;
        pointer-events: none;
      `;
      const labelTitle = item.topic || item.name || '';
      label.innerHTML = `
        <strong>${escapeHtml(labelTitle)}</strong>
      `;
      thumb.appendChild(label);

      thumb.addEventListener('mouseenter', () => { label.style.opacity = '1'; });
      thumb.addEventListener('mouseleave', () => { label.style.opacity = '0'; });

      thumb.addEventListener('click', () => openSidebar(item));

      return thumb;
    }

    function openSidebar(item) {
      const heading = item.topic || item.name || 'Untitled';
      const hasOriginalTitle = item.topic && item.name && item.name !== item.topic;

      sidebar.innerHTML = `
        <button id="gallery-close" class="drawer-close-btn"
                aria-label="Close" style="align-self: flex-end;">
          &#10005;
        </button>
        <button id="gallery-image-btn" class="gallery-image-btn"
                aria-label="View full-size image" style="
          background: none;
          border: none;
          padding: 0;
          cursor: zoom-in;
          display: block;
          width: 100%;
        ">
          <img src="./data/images/${escapeHtml(item.file)}"
               alt="${escapeHtml(item.name || '')}"
               style="
            width: 100%;
            max-height: 50vh;
            object-fit: contain;
            border-radius: var(--r-lg);
            display: block;
          ">
        </button>
        <div>
          <h2 style="
            font-family: var(--font-display);
            font-size: 1.3rem;
            line-height: 1.25;
            margin-bottom: var(--s2);
          ">
            ${escapeHtml(heading)}
          </h2>
          ${item.category ? `
            <div class="frame-card__badges" style="margin-bottom: var(--s3);">
              <span class="badge badge--category">${escapeHtml(item.category)}</span>
            </div>
          ` : ''}
          ${item.description ? `
            <p style="
              color: var(--ink);
              font-size: 0.95rem;
              line-height: 1.6;
              margin-bottom: var(--s3);
            ">
              ${inlineItalics(escapeHtml(item.description))}
            </p>
          ` : ''}
          ${hasOriginalTitle ? `
            <p style="
              font-size: 0.82rem;
              color: var(--ink-muted);
              font-style: italic;
              margin-bottom: var(--s3);
              line-height: 1.5;
            ">
              Original title: ${escapeHtml(item.name)}
            </p>
          ` : ''}
          ${item.credit ? `
            <p style="
              font-size: 0.85rem;
              color: var(--ink-muted);
              border-top: 1px solid var(--border);
              padding-top: var(--s3);
              margin-bottom: var(--s3);
            ">
              <strong>Credit:</strong> ${escapeHtml(item.credit)}
            </p>
          ` : ''}
          ${item.link ? `
            <p style="font-size: 0.9rem;">
              <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer"
                 style="color: var(--accent); text-decoration: none;">
                View source on Wikimedia &rarr;
              </a>
            </p>
          ` : ''}
          <div style="margin-top: var(--s4); border-top: 1px solid var(--border); padding-top: var(--s4);">
            <button id="gallery-workspace-btn" type="button" class="btn btn--primary" style="width: 100%;">
              Open in workspace
            </button>
          </div>
        </div>
      `;

      sidebar.classList.remove('is-closed');
      sidebar.style.transform = 'translateX(0)';

      const closeBtn = sidebar.querySelector('#gallery-close');
      closeBtn.addEventListener('click', closeSidebar);

      const imageBtn = sidebar.querySelector('#gallery-image-btn');
      imageBtn.addEventListener('click', () => openLightbox(item));

      const workspaceBtn = sidebar.querySelector('#gallery-workspace-btn');
      workspaceBtn.addEventListener('click', () => {
        sendToWorkspace({ slotKey: 'prompt', id: item.id, source: 'image' });
      });

      // move focus to the close button; not trapped since the sidebar is non-modal
      closeBtn.focus();
    }

    function closeSidebar() {
      if (sidebar.classList.contains('is-closed')) return;
      sidebar.classList.add('is-closed');
      sidebar.style.transform = 'translateX(100%)';
    }

    function updateLightboxImage() {
      const item = lightboxList[lightboxIndex];
      if (!item) return;
      const img = lightbox.querySelector('#lightbox-img');
      img.src = `./data/images/${item.file}`;
      img.alt = item.name || '';
    }

    function navigateLightbox(delta) {
      const n = lightboxList.length;
      if (n === 0) return;
      lightboxIndex = (lightboxIndex + delta + n) % n;
      updateLightboxImage();
    }

    function openLightbox(item) {
      lightboxList = visibleItems;
      const startIndex = lightboxList.findIndex(i => i.id === item.id);
      lightboxIndex = startIndex === -1 ? 0 : startIndex;

      const arrowBase = `
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(31, 27, 22, 0.7);
        color: var(--ink-on-dark);
        border: none;
        border-radius: var(--r);
        padding: var(--s2) var(--s3);
        font-size: 2rem;
        line-height: 1;
        cursor: pointer;
        opacity: 0.55;
        transition: opacity 150ms ease;
      `;

      lightbox.innerHTML = `
        <div style="
          position: relative;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img id="lightbox-img" src="" alt="" style="
            max-width: 95vw;
            max-height: 95vh;
            object-fit: contain;
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
          ">
          <button id="lightbox-prev" class="lightbox-arrow" aria-label="Previous image"
                  style="${arrowBase} left: var(--s4);">
            &#8249;
          </button>
          <button id="lightbox-next" class="lightbox-arrow" aria-label="Next image"
                  style="${arrowBase} right: var(--s4);">
            &#8250;
          </button>
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

      lightbox.querySelector('#lightbox-close').addEventListener('click', () => lightbox.close());
      const prevBtn = lightbox.querySelector('#lightbox-prev');
      const nextBtn = lightbox.querySelector('#lightbox-next');
      prevBtn.addEventListener('click', () => navigateLightbox(-1));
      nextBtn.addEventListener('click', () => navigateLightbox(1));

      if (lightboxList.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }

      updateLightboxImage();
      lightbox.showModal();
    }

    // one-shot <style> injection keeps gallery-unique CSS out of the shared files
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      #image-lightbox::backdrop { background: rgba(0, 0, 0, 0.85); }
      #image-lightbox .lightbox-arrow:hover,
      #image-lightbox .lightbox-arrow:focus-visible { opacity: 1; }
    `;
    document.head.appendChild(styleEl);

    content.addEventListener('click', (e) => {
      // guard against closing the sidebar in the same tick as opening it or a dialog
      if (e.target.closest('.frame-card')) return;
      if (e.target.closest('#gallery-sidebar')) return;
      if (e.target.closest('dialog')) return;
      closeSidebar();
    });

    document.addEventListener('keydown', (e) => {
      if (lightbox.open && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        navigateLightbox(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (e.key !== 'Escape') return;
      // native <dialog> handles Esc for the lightbox; don't also close the sidebar in the same press
      if (lightbox.open) return;
      closeSidebar();
    });

    render();
  } catch (err) {
    console.error('Error loading gallery data:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading gallery. Please refresh the page.</p>';
  }
})();
