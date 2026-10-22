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
// matches a box label, which opens a notes or vocabulary box. group 1 is the label, group 2 any
// text after it (the box's first line): `**Notes:** *ut* + subj.` gives ('Notes', '*ut* + subj.'),
// while a bare `**Note:**` or `**Vocabulary:**` gives an empty group 2.
const BOX_RE = /^\*\*(Notes?|Vocabulary):\*\*\s*(.*)$/;
// matches any label the book format reserves; one of these ends an open box. `**Prompt:** x` and
// `**Vocabulary:**` match, but box text such as `**ut** + subjunctive` does not.
const LABEL_RE = /^\*\*(Author|Year|Blurb|Prompt|Key|Notes?|Vocabulary):\*\*/;
// matches the headings the parser treats as structure (`# `, `## `, `### `), which also end an
// open box. `#### Usage` does not match, so it stays in the box as a sub-heading.
const HEADING_RE = /^#{1,3} /;
// box label -> the kind stored in the JSON. `Note` is accepted for the idioms' `**Note:**` habit.
const BOX_KINDS = { Note: 'notes', Notes: 'notes', Vocabulary: 'vocabulary' };

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

// joins a box's trimmed lines into one markdown string: each run of blank lines becomes a single
// paragraph break, and blank lines at either end are dropped.
function normaliseBoxBody(lines) {
  const kept = [];
  for (const line of lines) {
    if (line === '' && (kept.length === 0 || kept.at(-1) === '')) continue;
    kept.push(line);
  }
  if (kept.at(-1) === '') kept.pop();
  return kept.join('\n');
}

// pure: no file I/O. bookId comes from the filename stem.
// `##` opens a chapter, `###` a section, and each `**Prompt:**`/`**Key:**` pair is an exercise.
// `**Notes:**` / `**Vocabulary:**` open a box for the chapter (before its first `###`) or the
// section (before its first prompt); the format is documented in CONTRIBUTING.md.
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
  let promptSeen = false; // the current section has had a prompt, so it takes no more boxes
  let box = null; // open box { kind, owner, line, lines }; owner is null when misplaced

  const lines = mdText.split(/\r\n|\r|\n/);

  // flush a prompt that never received a key.
  const flushDanglingPrompt = () => {
    if (pendingPrompt !== null) {
      warnings.push(`line ${pendingPromptLine}: prompt without a following key in '${bookId}'`);
      pendingPrompt = null;
      pendingPromptLine = null;
    }
  };

  // close the open box and attach it to its owner. a misplaced box was reported when it
  // opened, so it is dropped here without a second warning.
  const flushBox = () => {
    if (box === null) return;
    const body = normaliseBoxBody(box.lines);
    if (box.owner !== null) {
      if (body) box.owner.boxes.push({ kind: box.kind, body });
      else warnings.push(`line ${box.line}: empty ${box.kind} box in '${bookId}'`);
    }
    box = null;
  };

  // heading checks run H3 -> H2 -> H1 so the longer prefix matches before the shorter one
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    // an open box takes every line, blank ones included, up to the next heading or label.
    // `---` is inert in book files, so inside a box it only separates paragraphs.
    if (box !== null) {
      if (!HEADING_RE.test(line) && !LABEL_RE.test(line)) {
        box.lines.push(line === '---' ? '' : line);
        continue;
      }
      flushBox();
    }

    if (!line || line === '---') continue;

    if (line.startsWith('### ')) {
      flushDanglingPrompt();
      if (chapter === null) {
        warnings.push(`line ${lineNo}: section before any chapter in '${bookId}'`);
        continue;
      }
      section = {
        id: `s${pad2(chapter.sections.length + 1)}`,
        title: line.slice(4).trim(),
        boxes: [],
        exercises: [],
      };
      chapter.sections.push(section);
      promptSeen = false;
      continue;
    }

    if (line.startsWith('## ')) {
      flushDanglingPrompt();
      chapter = { id: `ch${pad2(chapters.length + 1)}`, title: line.slice(3).trim(), boxes: [], sections: [] };
      chapters.push(chapter);
      section = null;
      promptSeen = false;
      continue;
    }

    // H1 title (first one wins).
    if (line.startsWith('# ')) {
      if (title === null) title = line.slice(2).trim();
      continue;
    }

    // a box belongs to the innermost heading, but only ahead of that heading's content:
    // a chapter's boxes come before its first ###, a section's before its first prompt.
    const boxMatch = BOX_RE.exec(line);
    if (boxMatch) {
      const kind = BOX_KINDS[boxMatch[1]];
      let owner = null;
      if (chapter === null) {
        warnings.push(`line ${lineNo}: ${kind} box before any chapter in '${bookId}'`);
      } else if (section === null) {
        owner = chapter;
      } else if (!promptSeen) {
        owner = section;
      } else {
        warnings.push(`line ${lineNo}: ${kind} box after the first prompt of '${section.title}' in '${bookId}'`);
      }
      box = { kind, owner, line: lineNo, lines: boxMatch[2] ? [boxMatch[2]] : [] };
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
        promptSeen = true;
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

  flushBox();
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
    const boxCount = data.chapters.reduce(
      (n, ch) => n + ch.boxes.length + ch.sections.reduce((m, s) => m + s.boxes.length, 0),
      0
    );
    console.log(
      `  ${id}: ${data.chapters.length} chapter(s), ${sectionCount} section(s), ` +
        `${exerciseCount} exercise(s), ${boxCount} box(es)`
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
// TODO: importing this module from a script with no argv[1] (stdin, `node -e`) throws here,
// because pathToFileURL(undefined) is a TypeError; validate-data.mjs guards with
// `process.argv[1] != null`, and the other build-*.mjs scripts share the same gap.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildBooks({ strict: process.argv.includes('--strict') });
}
