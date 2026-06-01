import { escapeHtml, inlineItalics } from './data.js';

(async () => {
  try {
    const res = await fetch('./data/categories/links.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const links = await res.json();

    const content = document.getElementById('content');
    content.innerHTML = `
      <h1 class="page-heading">Further Resources</h1>
      <p class="text-muted" style="margin-bottom: var(--s5);">
        External links.
      </p>
      <div id="links-list" style="
        display: flex;
        flex-direction: column;
        gap: var(--s3);
        max-width: 700px;
      "></div>
    `;

    const linksList = content.querySelector('#links-list');

    for (const link of links) {
      const details = document.createElement('details');
      details.style.cssText = `
        background: var(--surface-raised);
        border: 1px solid var(--border);
        border-radius: var(--r-lg);
        padding: var(--s4);
      `;

      // thumbnail sits in the <summary> so it's visible before expanding
      const summary = document.createElement('summary');
      summary.style.cssText = `
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--s3);
        user-select: none;
        outline: none;
        list-style: none;
      `;

      const nameRow = document.createElement('span');
      nameRow.style.cssText = `
        font-weight: 600;
        font-family: var(--font-display);
        font-size: 1.1rem;
        color: var(--ink);
        display: flex;
        align-items: center;
        gap: var(--s2);
      `;
      // custom triangle avoids browser-default disclosure styling inconsistencies
      const marker = document.createElement('span');
      marker.setAttribute('aria-hidden', 'true');
      marker.className = 'link-card__marker';
      marker.style.cssText = `
        display: inline-block;
        font-size: 0.7rem;
        color: var(--ink-muted);
        transition: transform 150ms ease;
        flex-shrink: 0;
      `;
      marker.textContent = '▶';

      const nameText = document.createElement('span');
      nameText.textContent = link.name;

      nameRow.appendChild(marker);
      nameRow.appendChild(nameText);
      summary.appendChild(nameRow);

      if (link.thumbnail) {
        const thumbnail = document.createElement('img');
        thumbnail.src = `./data/link_thumbnails/${link.thumbnail}`;
        thumbnail.alt = link.name;
        thumbnail.style.cssText = `
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: var(--r);
          border: 1px solid var(--border);
          flex-shrink: 0;
        `;
        summary.appendChild(thumbnail);
      }

      // rotate 90° on open rather than relying on browser-default disclosure styling
      details.addEventListener('toggle', () => {
        marker.style.transform = details.open ? 'rotate(90deg)' : '';
      });

      const content_inner = document.createElement('div');
      content_inner.style.cssText = `
        margin-top: var(--s3);
        display: flex;
        flex-direction: column;
        gap: var(--s2);
      `;

      const description = document.createElement('p');
      description.style.cssText = `
        color: var(--ink-muted);
        font-size: 0.95rem;
        line-height: 1.6;
        margin: 0;
      `;
      description.innerHTML = inlineItalics(escapeHtml(link.description));

      const urlLink = document.createElement('a');
      urlLink.href = link.url;
      urlLink.target = '_blank';
      urlLink.rel = 'noopener noreferrer';
      urlLink.style.cssText = `
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
        word-break: break-all;
      `;
      urlLink.textContent = link.url;

      const urlContainer = document.createElement('div');
      urlContainer.style.cssText = `
        padding-top: var(--s2);
        border-top: 1px solid var(--border);
      `;
      urlContainer.appendChild(urlLink);

      content_inner.appendChild(description);
      content_inner.appendChild(urlContainer);

      details.appendChild(summary);
      details.appendChild(content_inner);

      linksList.appendChild(details);
    }

    if (links.length === 0) {
      linksList.innerHTML = '<p class="empty-state">No links available.</p>';
    }
  } catch (err) {
    console.error('Error loading links:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading links. Please refresh the page.</p>';
  }
})();
