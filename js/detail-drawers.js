// shared detail-drawer renderers used by Grammar, Topics, Idioms, Templates, and Workspace.
// pure string-in/string-out; importable in Node tests.

import { escapeHtml, inlineItalics, autoLinkUrls } from './data.js';

export function renderTopicDrawer(item) {
  return `
    <div class="drawer-header">
      <div>
        <div class="drawer-title">${inlineItalics(escapeHtml(item.name))}</div>
        <div class="frame-card__badges mt-2">
          <span class="badge badge--category">${escapeHtml(item.category)}</span>
        </div>
      </div>
      <button class="drawer-close-btn" aria-label="Close">&#10005;</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-section">
        ${item.notes && item.notes !== 'TODO'
          ? `
          <span class="drawer-section-label">Notes</span>
          <p class="drawer-notes">${inlineItalics(escapeHtml(item.notes))}</p>
        `
          : '<p class="text-muted italic">No additional notes.</p>'}
      </div>
    </div>
  `;
}

// notes, latin expression, and reference links are omitted when empty or still "TODO".
export function renderGrammarDrawer(item) {
  const has = (v) => v && v !== 'TODO';
  const links = Array.isArray(item.links) ? item.links : [];

  const notesHtml = has(item.notes)
    ? `
      <div class="drawer-section">
        <span class="drawer-section-label">Notes</span>
        <p class="drawer-notes">${inlineItalics(escapeHtml(item.notes))}</p>
      </div>`
    : '';

  const latinHtml = has(item.latinExpression)
    ? `
      <div class="drawer-section">
        <span class="drawer-section-label">Latin Expression</span>
        <p class="drawer-notes"><em>${escapeHtml(item.latinExpression)}</em></p>
      </div>`
    : '';

  const linksHtml = links.length > 0
    ? `
      <div class="drawer-section">
        <span class="drawer-section-label">References</span>
        <div class="drawer-links">
          ${links
            .map(l => `<a class="btn btn--secondary" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.text || l.url)}</a>`)
            .join('')}
        </div>
      </div>`
    : '';

  const body = (notesHtml || latinHtml || linksHtml)
    ? `${notesHtml}${latinHtml}${linksHtml}`
    : '<div class="drawer-section"><p class="text-muted italic">No additional details yet.</p></div>';

  return `
    <div class="drawer-header">
      <div>
        <div class="drawer-title">${inlineItalics(escapeHtml(item.name))}</div>
        <div class="frame-card__badges mt-2">
          <span class="badge badge--category">${escapeHtml(item.category)}</span>
        </div>
      </div>
      <button class="drawer-close-btn" aria-label="Close">&#10005;</button>
    </div>
    <div class="drawer-body">
      ${body}
    </div>
  `;
}

export function renderIdiomDrawer(item) {
  const badge =
    item.inflection === 'fixed'
      ? '<span class="badge badge--fixed">fixed</span>'
      : item.inflection === 'flexible'
        ? '<span class="badge badge--flexible">flexible</span>'
        : '<span class="badge badge--todo">TODO</span>';

  const examplesSection =
    item.examples && item.examples.length > 0
      ? `
      <div class="drawer-section">
        <span class="drawer-section-label">Examples</span>
        <div class="flex flex-col gap-2">
          ${item.examples
            .map(
              ex => `
            <div class="example-item">
              <span class="example-citation">${inlineItalics(escapeHtml(ex.citation))}</span>
              <span class="example-quote"><em>${escapeHtml(ex.quote)}</em></span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `
      : `
      <div class="drawer-section">
        <span class="drawer-section-label">Examples</span>
        <p class="text-muted italic">No examples recorded.</p>
      </div>
    `;

  return `
    <div class="drawer-header">
      <div>
        <div class="drawer-latin">${escapeHtml(item.latin)}</div>
        <div class="drawer-gloss">${inlineItalics(escapeHtml(item.gloss))}</div>
        <div class="frame-card__badges mt-2">
          ${badge}
          <span class="badge badge--category">${escapeHtml(item.category)}</span>
        </div>
      </div>
      <button class="drawer-close-btn" aria-label="Close">&#10005;</button>
    </div>
    <div class="drawer-body">
      ${item.notes
        ? `
        <div class="drawer-section">
          <span class="drawer-section-label">Notes</span>
          <div class="drawer-notes-body">
            ${item.notes
              .split('\n')
              .map(para => `<p class="drawer-notes">${inlineItalics(escapeHtml(para))}</p>`)
              .join('')}
          </div>
        </div>
      `
        : ''}
      ${examplesSection}
    </div>
  `;
}

// mirrors the gallery's sidebar content, but drawer-styled and without "Open in workspace"
// (we are already there). .drawer-image-btn is wired to the lightbox by workspace.js.
export function renderImageDrawer(item) {
  const heading = item.topic || item.name || 'Untitled';
  const hasOriginalTitle = item.topic && item.name && item.name !== item.topic;

  return `
    <div class="drawer-header">
      <div>
        <div class="drawer-title">${escapeHtml(heading)}</div>
        ${item.category
          ? `
          <div class="frame-card__badges mt-2">
            <span class="badge badge--category">${escapeHtml(item.category)}</span>
          </div>`
          : ''}
      </div>
      <button class="drawer-close-btn" aria-label="Close">&#10005;</button>
    </div>
    <div class="drawer-body">
      <button class="drawer-image-btn" aria-label="View full-size image" title="View full-size image"
              style="background: none; border: none; padding: 0; cursor: zoom-in; display: block; width: 100%;">
        <img src="./data/images/${escapeHtml(item.file)}" alt="${escapeHtml(item.name || '')}"
             style="width: 100%; max-height: 50vh; object-fit: contain; border-radius: var(--r-lg); display: block;">
      </button>
      ${item.description
        ? `
        <div class="drawer-section">
          <p class="drawer-notes">${inlineItalics(escapeHtml(item.description))}</p>
        </div>`
        : ''}
      ${hasOriginalTitle
        ? `
        <div class="drawer-section">
          <p class="text-muted italic" style="font-size: 0.82rem;">Original title: ${escapeHtml(item.name)}</p>
        </div>`
        : ''}
      ${item.credit
        ? `
        <div class="drawer-section">
          <p class="text-muted" style="font-size: 0.85rem;"><strong>Credit:</strong> ${escapeHtml(item.credit)}</p>
        </div>`
        : ''}
      ${item.link
        ? `
        <div class="drawer-section">
          <p style="font-size: 0.9rem;">
            <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer"
               style="color: var(--accent); text-decoration: none;">
              View source on Wikimedia &rarr;
            </a>
          </p>
        </div>`
        : ''}
    </div>
  `;
}

export function renderTemplateDrawer(item) {
  return `
    <div class="drawer-header">
      <div>
        <div class="drawer-title">${escapeHtml(item.name)}</div>
        <div class="frame-card__badges mt-2">
          <span class="badge badge--category">${escapeHtml(item.category)}</span>
        </div>
      </div>
      <button class="drawer-close-btn" aria-label="Close">&#10005;</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-section">
        <span class="drawer-section-label">Description</span>
        <p class="drawer-notes">${autoLinkUrls(inlineItalics(escapeHtml(item.description)))}</p>
      </div>
    </div>
  `;
}
