// builds book JSON from markdown: manifest.md -> manifest.json, <id>.md -> <id>.json.
// parseManifest() and parseBook() are pure and exported for tests.
// must run before renderBooks(), which consumes the JSON produced here.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const RAW_BOOKS_DIR = join(repoRoot, 'data', 'raw_md', 'books');
const OUT_BOOKS_DIR = join(repoRoot, 'data', 'books');

const pad2 = (n) => String(n).padStart(2, '0');

// matches `**Field:** value` for book metadata.
const META_RE = /^\*\*(Author|Year|Blurb):\*\*\s*(.*)$/;
// matches `**Prompt:** value` / `**Key:** value`.
const EXERCISE_RE = /^\*\*(Prompt|Key):\*\*\s*(.*)$/;

// `- id` lines are entries; blanks, headings, and prose are ignored.
export function parseManifest(mdText) {
  const ids = [];
  const warnings = [];
  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('- ')) {
      ids.push(line.slice(2).trim());
    }
  }

  if (ids.length === 0) {
    warnings.push('manifest: no book ids found');
  }

  return { ids, warnings };
}

// pure: no file I/O. bookId comes from the filename stem.
export function parseBook(mdText, bookId) {
  const warnings = [];

  let title = null;
  let author = null;
  let yearRaw = null;
  let blurb = null;
  const chapters = [];

  let chapter = null; // current chapter object
  let section = null; // current section object
  let pendingPrompt = null; // prompt awaiting its key
  let pendingPromptLine = null;

  const lines = mdText.split(/\r\n|\r|\n/);

  // flush a prompt that never received a key.
  const flushDanglingPrompt = () => {
    if (pendingPrompt !== null) {
      warnings.push(`line ${pendingPromptLine}: prompt without a following key in '${bookId}'`);
      pendingPrompt = null;
      pendingPromptLine = null;
    }
  };

  // heading checks run H3 -> H2 -> H1 so the longer prefix matches before the shorter one
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (!line || line === '---') continue;

    if (line.startsWith('### ')) {
      flushDanglingPrompt();
      if (chapter === null) {
        warnings.push(`line ${lineNo}: section before any chapter in '${bookId}'`);
        continue;
      }
      section = { id: `s${pad2(chapter.sections.length + 1)}`, title: line.slice(4).trim(), exercises: [] };
      chapter.sections.push(section);
      continue;
    }

    if (line.startsWith('## ')) {
      flushDanglingPrompt();
      chapter = { id: `ch${pad2(chapters.length + 1)}`, title: line.slice(3).trim(), sections: [] };
      chapters.push(chapter);
      section = null;
      continue;
    }

    // H1 title (first one wins).
    if (line.startsWith('# ')) {
      if (title === null) title = line.slice(2).trim();
      continue;
    }

    const metaMatch = META_RE.exec(line);
    if (metaMatch) {
      const field = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (field === 'author') author = value;
      else if (field === 'year') yearRaw = value;
      else if (field === 'blurb') blurb = value;
      continue;
    }

    const exMatch = EXERCISE_RE.exec(line);
    if (exMatch) {
      const kind = exMatch[1].toLowerCase();
      const value = exMatch[2].trim();
      if (kind === 'prompt') {
        flushDanglingPrompt();
        pendingPrompt = value;
        pendingPromptLine = lineNo;
      } else {
        if (pendingPrompt === null) {
          warnings.push(`line ${lineNo}: key without a preceding prompt in '${bookId}'`);
          continue;
        }
        if (section === null) {
          warnings.push(`line ${lineNo}: exercise before any section in '${bookId}'`);
          pendingPrompt = null;
          pendingPromptLine = null;
          continue;
        }
        section.exercises.push({
          id: `ex${pad2(section.exercises.length + 1)}`,
          prompt: pendingPrompt,
          key: value,
        });
        pendingPrompt = null;
        pendingPromptLine = null;
      }
      continue;
    }

    // silently ignore anything else
  }

  flushDanglingPrompt();

  for (const [field, value] of [['title', title], ['author', author], ['year', yearRaw], ['blurb', blurb]]) {
    if (!value) warnings.push(`'${bookId}' missing required field: ${field}`);
  }

  const year = Number.parseInt(yearRaw, 10);
  if (yearRaw && Number.isNaN(year)) {
    warnings.push(`'${bookId}' has non-numeric year: '${yearRaw}'`);
  }

  const data = {
    id: bookId,
    title: title ?? '',
    author: author ?? '',
    year: Number.isNaN(year) ? null : year,
    blurb: blurb ?? '',
    chapters,
  };

  return { data, warnings };
}

// read markdown sources, write JSON outputs, print per-book summaries.
// throws in strict mode if any warnings were collected.
export function buildBooks({ strict = false } = {}) {
  const allWarnings = [];

  const manifestMd = readFileSync(join(RAW_BOOKS_DIR, 'manifest.md'), 'utf8');
  const { ids, warnings: manifestWarnings } = parseManifest(manifestMd);
  allWarnings.push(...manifestWarnings);

  writeFileSync(join(OUT_BOOKS_DIR, 'manifest.json'), JSON.stringify(ids, null, 2) + '\n', 'utf8');
  console.log(`wrote manifest.json with ${ids.length} book(s)`);

  for (const id of ids) {
    const mdText = readFileSync(join(RAW_BOOKS_DIR, `${id}.md`), 'utf8');
    const { data, warnings } = parseBook(mdText, id);
    allWarnings.push(...warnings);

    writeFileSync(join(OUT_BOOKS_DIR, `${id}.json`), JSON.stringify(data, null, 2) + '\n', 'utf8');

    const sectionCount = data.chapters.reduce((n, ch) => n + ch.sections.length, 0);
    const exerciseCount = data.chapters.reduce(
      (n, ch) => n + ch.sections.reduce((m, s) => m + s.exercises.length, 0),
      0
    );
    console.log(
      `  ${id}: ${data.chapters.length} chapter(s), ${sectionCount} section(s), ${exerciseCount} exercise(s)`
    );
  }

  if (allWarnings.length > 0) {
    console.log(`\n${allWarnings.length} warning(s):`);
    for (const w of allWarnings) console.log(`  - ${w}`);
  }

  if (strict && allWarnings.length > 0) {
    throw new Error(`build-books: ${allWarnings.length} warning(s) in strict mode`);
  }

  return { ids, warnings: allWarnings };
}

// run when invoked directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildBooks({ strict: process.argv.includes('--strict') });
}
