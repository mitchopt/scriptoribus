// generates book-<id>.html pages at the repo root from data/books/*.json.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderInline } from './render-markdown.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const booksDir = join(repoRoot, 'data', 'books');

// exported for unit testing; renderBooks() handles file I/O.
export function renderBookHtml(book) {
  const prefaceHtml = `
    <details class="book-chapter" open>
      <summary class="book-chapter-title">Preface</summary>
      <div class="book-chapter-body">
        <div style="border-left: 3px solid var(--border); padding-left: var(--s4); margin-top: var(--s3);">
          <p class="prose">${renderInline(book.blurb)}</p>
        </div>
      </div>
    </details>
  `;

  const exercisesHtml = book.chapters
    .map(
      chapter => `
    <details class="book-chapter">
      <summary class="book-chapter-title">${escapeHtml(chapter.title)}</summary>
      <div class="book-chapter-body">
        ${chapter.sections
          .map(
            section => `
          <details class="book-section">
            <summary class="book-section-title">${escapeHtml(section.title)}</summary>
            <div class="book-section-body">
              ${section.exercises
                .map(
                  ex => `
                <div class="book-exercise">
                  <p class="book-prompt">${escapeHtml(ex.prompt)}</p>
                  <button class="book-key-btn">
                    Show key
                  </button>
                  <div class="book-key" style="display: none;">
                    <p class="book-answer">${escapeHtml(ex.key)}</p>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          </details>
        `
          )
          .join('')}
      </div>
    </details>
  `
    )
    .join('');

  const allSectionsHtml = prefaceHtml + exercisesHtml;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(book.title)} — Scriptoribus</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./css/reset.css">
  <link rel="stylesheet" href="./css/tokens.css">
  <link rel="stylesheet" href="./css/typography.css">
  <link rel="stylesheet" href="./css/layout.css">
  <link rel="stylesheet" href="./css/components.css">
  <style>
    /* book-specific styles: not in the shared CSS files since they only apply here */
    details {
      outline: none;
    }

    .book-chapter {
      margin-bottom: var(--s4);
    }

    .book-chapter-title {
      cursor: pointer;
      font-family: var(--font-display);
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--ink);
      padding: var(--s3) var(--s4);
      background: var(--parchment-dark);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      user-select: none;
    }

    .book-chapter-title:hover {
      background: var(--surface);
    }

    .book-chapter-body {
      padding: var(--s4) 0;
      display: flex;
      flex-direction: column;
      gap: var(--s3);
    }

    .book-section {
      border-left: 3px solid var(--border);
      padding-left: var(--s4);
    }

    .book-section-title {
      cursor: pointer;
      font-family: var(--font-body);
      font-weight: 600;
      color: var(--ink-muted);
      font-size: 0.95rem;
      user-select: none;
    }

    .book-section-title:hover {
      color: var(--ink);
    }

    .book-section-body {
      margin-top: var(--s3);
      display: flex;
      flex-direction: column;
      gap: var(--s3);
    }

    .book-exercise {
      background: var(--surface-raised);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: var(--s3);
    }

    .book-prompt {
      color: var(--ink);
      line-height: 1.6;
      margin-bottom: var(--s2);
      font-size: 0.95rem;
    }

    .book-key-btn {
      padding: var(--s1) var(--s3);
      font-size: 0.85rem;
      color: var(--ink-muted);
      background: var(--parchment-dark);
      border: 1px solid var(--border);
      border-radius: var(--r);
      cursor: pointer;
      transition: background 100ms ease;
    }

    .book-key-btn:hover {
      background: var(--border);
      color: var(--ink);
    }

    .book-key {
      margin-top: var(--s2);
      padding: var(--s3);
      background: var(--accent-subtle);
      border-left: 3px solid var(--accent);
      border-radius: 0 var(--r) var(--r) 0;
    }

    .book-answer {
      color: var(--ink);
      font-style: italic;
      line-height: 1.65;
      margin: 0;
      font-size: 0.95rem;
    }
  </style>
</head>
<body data-page="book-detail">

  <aside id="sidebar"></aside>

  <main id="content" style="max-width: 800px;">

    <h1 class="page-heading">${escapeHtml(book.title)}</h1>
    <p class="text-muted" style="margin-bottom: var(--s6);">
      ${escapeHtml(book.author)} (${book.year})
    </p>

    <section id="exercises">
      ${allSectionsHtml}
    </section>

    <p style="text-align: center; margin-top: var(--s6); padding-top: var(--s4); border-top: 1px solid var(--border);">
      <a href="./books.html" style="color: var(--accent); text-decoration: none; font-weight: 600;">← Back to Books</a>
    </p>

  </main>

  <script src="./js/layout.js"></script>
  <script src="./js/book-page.js"></script>

</body>
</html>`;
}

export function renderBooks() {
  const manifestPath = join(booksDir, 'manifest.json');
  let bookIds = [];

  try {
    const manifestContent = readFileSync(manifestPath, 'utf8');
    bookIds = JSON.parse(manifestContent);
  } catch (err) {
    console.log('  [books] manifest.json not found or invalid; skipping book generation');
    return;
  }

  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    console.log('  [books] manifest.json is empty; skipping book generation');
    return;
  }

  // each book in its own try/catch so a single bad JSON file doesn't stop the others
  for (const bookId of bookIds) {
    try {
      const bookPath = join(booksDir, `${bookId}.json`);
      const bookContent = readFileSync(bookPath, 'utf8');
      const book = JSON.parse(bookContent);

      const html = renderBookHtml(book);
      const outputPath = join(repoRoot, `book-${bookId}.html`);
      writeFileSync(outputPath, html, 'utf8');

      console.log(`  [books] ${bookId} → book-${bookId}.html`);
    } catch (err) {
      console.warn(`  [books] Error rendering ${bookId}:`, err.message);
    }
  }
}
