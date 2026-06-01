import { escapeHtml, inlineItalics } from './data.js';

(async () => {
  try {
    const res = await fetch('./data/books/manifest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bookIds = await res.json();

    const content = document.getElementById('content');
    content.innerHTML = `
      <h1 class="page-heading">Public Domain Books</h1>
      <p class="text-muted" style="margin-bottom: var(--s5);">
        Digitised public-domain Latin prose composition textbooks.
      </p>
      <div class="card-grid" id="books-grid"></div>
    `;

    const grid = content.querySelector('#books-grid');

    // fetch each book individually so a single bad JSON file doesn't kill the whole catalogue
    for (const bookId of bookIds) {
      try {
        const bookRes = await fetch(`./data/books/${bookId}.json`);
        if (!bookRes.ok) {
          console.warn(`Could not load book ${bookId}`);
          continue;
        }
        const book = await bookRes.json();

        const card = document.createElement('a');
        card.href = `./book-${escapeHtml(bookId)}.html`;
        card.className = 'frame-card';
        card.style.textDecoration = 'none';
        card.innerHTML = `
          <span class="frame-card__title">${escapeHtml(book.title)}</span>
          <p class="text-muted text-sm" style="margin-top: var(--s1); margin-bottom: var(--s2);">
            ${escapeHtml(book.author)} (${book.year})
          </p>
          <p class="frame-card__notes">${inlineItalics(escapeHtml(book.blurb))}</p>
        `;

        grid.appendChild(card);
      } catch (err) {
        console.warn(`Error loading book ${bookId}:`, err);
      }
    }

    if (grid.children.length === 0) {
      grid.innerHTML = '<p class="empty-state">No books available.</p>';
    }
  } catch (err) {
    console.error('Error loading books catalogue:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading books catalogue. Please refresh the page.</p>';
  }
})();
