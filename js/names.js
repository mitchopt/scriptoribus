import { escapeHtml, sampleWithoutReplacement } from './data.js';

export function generateNames(data, counts) {
  const result = {};

  for (const [category, count] of Object.entries(counts)) {
    const item = data.find(d => d.category === category);
    if (!item) continue;

    result[category] = sampleWithoutReplacement(item.names, count);
  }

  return result;
}

if (typeof document !== 'undefined') {
(async () => {
  try {
    const res = await fetch('./data/categories/names.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const content = document.getElementById('content');
    content.innerHTML = `
      <div style="max-width: 800px;">
        <h1 class="page-heading">Name Generator</h1>
        <p class="text-muted" style="margin-bottom: var(--s5);">
          Select how many names to generate from each category (work in progress).
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--s5); margin-bottom: var(--s6);">

          <!-- Left: controls -->
          <div>
            <div class="flex flex-col gap-4">
              ${data
                .map(
                  cat => `
                <div>
                  <label class="filter-label" style="display: block; margin-bottom: var(--s2);">
                    ${escapeHtml(cat.category)}
                  </label>
                  <select class="filter-search" data-category="${escapeHtml(cat.category)}" style="width: 100%;">
                    ${Array.from({ length: 11 }, (_, i) => `
                      <option value="${i}">${i}</option>
                    `).join('')}
                  </select>
                  <p class="text-muted text-sm" style="margin-top: var(--s1);">
                    Available: ${cat.names.length}
                  </p>
                </div>
              `
                )
                .join('')}

              <button class="btn btn--primary" id="generate-btn" style="margin-top: var(--s4);">
                Generate
              </button>
              <button class="btn btn--secondary" id="clear-btn">
                Clear
              </button>
            </div>
          </div>

          <!-- Right: output -->
          <div>
            <div class="filter-label">Generated Names</div>
            <div id="output" style="
              background: var(--surface-raised);
              border: 1px solid var(--border);
              border-radius: var(--r-lg);
              padding: var(--s4);
              min-height: 200px;
              display: flex;
              flex-direction: column;
              gap: var(--s3);
            ">
              <p class="text-muted italic">Names will appear here.</p>
            </div>
          </div>

        </div>
      </div>
    `;

    const generateBtn = document.getElementById('generate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const output = document.getElementById('output');

    generateBtn.addEventListener('click', () => {
      const counts = {};
      document.querySelectorAll('select[data-category]').forEach(sel => {
        const cat = sel.dataset.category;
        const n = parseInt(sel.value, 10);
        if (n > 0) counts[cat] = n;
      });

      if (Object.keys(counts).length === 0) {
        output.innerHTML = '<p class="text-muted italic">Select at least one category.</p>';
        return;
      }

      const generated = generateNames(data, counts);
      const html = Object.entries(generated)
        .map(
          ([cat, names]) => `
          <div>
            <div class="filter-label" style="margin-bottom: var(--s2);">
              ${escapeHtml(cat)}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: var(--s2);">
              ${names
                .map(
                  name => `
                <span style="
                  background: var(--accent-subtle);
                  color: var(--accent);
                  padding: var(--s1) var(--s2);
                  border-radius: var(--r);
                  font-weight: 600;
                  font-size: 0.9rem;
                ">
                  ${escapeHtml(name)}
                </span>
              `
                )
                .join('')}
            </div>
          </div>
        `
        )
        .join('');

      output.innerHTML = html;
    });

    clearBtn.addEventListener('click', () => {
      document.querySelectorAll('select[data-category]').forEach(sel => {
        sel.value = '0';
      });
      output.innerHTML = '<p class="text-muted italic">Names will appear here.</p>';
    });
  } catch (err) {
    console.error('Error loading names data:', err);
    document.getElementById('content').innerHTML =
      '<p class="text-muted italic">Error loading data. Please refresh the page.</p>';
  }
})();
}
