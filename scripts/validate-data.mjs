// independently re-parses markdown sources and diffs against committed JSON.
// deliberately does NOT import the builders: a shared bug could otherwise hide data loss.
// re-parsers and the generic diff are pure and exported for tests.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const RAW_DIR = join(repoRoot, 'data', 'raw_md');
const CAT_DIR = join(repoRoot, 'data', 'categories');
const RAW_BOOKS_DIR = join(RAW_DIR, 'books');
const OUT_BOOKS_DIR = join(repoRoot, 'data', 'books');

// matches the first **bold** span on a line - category name is group 1.
const FLAT_CATEGORY_RE = /^\*\*(.+?)\*\*/;
// matches `# Heading` for templates - group 1 is the heading text (a `## …` line
// is not matched, since its 2nd char is `#` rather than whitespace).
const TEMPLATE_HEADING_RE = /^#\s+(.+)$/;
// matches `**Field:** value` for templates.
const TEMPLATE_FIELD_RE = /^\*\*(Category|Summary|Description):\*\*\s*(.*)$/;
// loose example detector for idioms: a `>` line ending in a quoted span.
// intentionally looser than the builder's regex so the two parsers differ.
const IDIOM_EXAMPLE_RE = /"(.+)"\s*$/;
// matches `**Category:** value` etc. for grammar constructions.
const GRAMMAR_FIELD_RE = /^\*\*(Category|Link|Note|Latin Expression):\*\*\s*(.*)$/;
// matches a markdown link `[text](url)` inside a grammar Link field (wrapping
// parens, if any, are ignored). Independent of the builder's own regex.
const GRAMMAR_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
// matches `# Heading` for links - group 1 is the link name (a `## …` line is not
// matched, since its 2nd char is `#` rather than whitespace).
const LINK_HEADING_RE = /^#\s+(.+)$/;
// matches `**URL:** value` / `**Description:** value` / `**Thumbnail:** value` for links.
const LINK_FIELD_RE = /^\*\*(URL|Description|Thumbnail):\*\*\s*(.*)$/;
// matches book metadata and exercise field lines.
const BOOK_META_RE = /^\*\*(Author|Year|Blurb):\*\*\s*(.*)$/;
const BOOK_EXERCISE_RE = /^\*\*(Prompt|Key):\*\*\s*(.*)$/;

// coalesce absent/null/empty so they compare equal; numbers pass through.
const norm = (v) => v ?? '';

// `**Bold**` opens a category; `- item` is an entry.
export function reparseFlat(mdText) {
  const out = [];
  let category = null;
  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line === '---') continue;

    const catMatch = FLAT_CATEGORY_RE.exec(line);
    if (catMatch) {
      category = catMatch[1].trim();
      continue;
    }

    if (line.startsWith('- ')) {
      // entries before any category are dropped by the builder; do the same.
      if (category === null) continue;
      out.push({ name: line.slice(2).trim(), category, notes: '', line: i + 1 });
    }
  }

  return out;
}

// encode links into a canonical string so the scalar diff can compare them (order-sensitive)
function linksToKey(links) {
  return links.map(l => `${l.text}->${l.url}`).join(' | ');
}

// independent of build-grammar.mjs: own regexes and state machine to prevent shared bugs.
export function reparseGrammar(mdText) {
  const out = [];
  let current = null;
  let currentLine = null;

  const commit = () => {
    if (current === null) return;
    if (current.category) {
      const links = [];
      GRAMMAR_LINK_RE.lastIndex = 0;
      let m;
      while ((m = GRAMMAR_LINK_RE.exec(current.link ?? '')) !== null) {
        links.push({ text: m[1].trim(), url: m[2].trim() });
      }
      out.push({
        name: current.name,
        category: current.category,
        notes: current.note ?? '',
        latinExpression: current.latinExpression ?? '',
        linksKey: linksToKey(links),
        line: currentLine,
      });
    }
    current = null;
    currentLine = null;
  };

  const lines = mdText.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '---') continue;

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      commit();
      current = { name: line.slice(2).trim() };
      currentLine = i + 1;
      continue;
    }

    const fm = GRAMMAR_FIELD_RE.exec(line);
    if (fm && current !== null) {
      const label = fm[1];
      const value = fm[2].trim();
      if (label === 'Category') current.category = value;
      else if (label === 'Note') current.note = value;
      else if (label === 'Latin Expression') current.latinExpression = value;
      else if (label === 'Link') current.link = value;
    }
  }

  commit();
  return out;
}

// independent of build-idioms.mjs; counts examples rather than parsing their content.
export function reparseIdioms(mdText) {
  const out = [];
  let current = null;

  // independent note-collection state mirroring build-idioms.mjs: paragraphs joined by '\n',
  // lines within a paragraph by ' '. must match the builder exactly or diffRecords flags `notes`.
  let noteParagraphs = null;
  let noteBuffer = [];

  const flushParagraph = () => {
    if (noteBuffer.length > 0) {
      noteParagraphs.push(noteBuffer.join(' '));
      noteBuffer = [];
    }
  };

  const flushNote = () => {
    if (noteParagraphs === null) return;
    flushParagraph();
    current.notes = noteParagraphs.join('\n');
    noteParagraphs = null;
  };

  const commit = () => {
    flushNote();
    if (current !== null) {
      out.push(current);
      current = null;
    }
  };

  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      commit();
      current = {
        category: null,
        latin: line.slice(2).trim(),
        gloss: '',
        inflection: null,
        notes: null,
        exampleCount: 0,
        line: i + 1,
      };
    } else if (current !== null) {
      // while collecting a note, swallow blank/text lines; `**` or `>` terminates and dispatches.
      if (noteParagraphs !== null) {
        if (!line.startsWith('**') && !line.startsWith('>')) {
          if (line.trim() === '') flushParagraph();
          else noteBuffer.push(line.trim());
          continue;
        }
        flushNote();
      }

      if (line.startsWith('**Category:**')) {
        current.category = line.slice('**Category:**'.length).trim();
      } else if (line.startsWith('**Meaning:**')) {
        current.gloss = line.slice('**Meaning:**'.length).trim();
      } else if (line.startsWith('**Inflection:**')) {
        current.inflection = line.slice('**Inflection:**'.length).trim();
      } else if (line.startsWith('**Note:**')) {
        noteParagraphs = [];
        noteBuffer = [];
        const inline = line.slice('**Note:**'.length).trim();
        if (inline) noteBuffer.push(inline);
      } else if (line.startsWith('>') && IDIOM_EXAMPLE_RE.test(line)) {
        current.exampleCount += 1;
      }
    }
  }

  commit();
  return out.filter((r) => r.category);
}

// entries missing any required field are dropped, matching the builder's behaviour.
export function reparseTemplates(mdText) {
  const out = [];
  const REQUIRED = ['category', 'summary', 'description'];
  let current = null;
  let currentLine = null;

  const commit = () => {
    if (current === null) return;
    if (REQUIRED.every((f) => current[f])) {
      out.push({
        name: current.name,
        category: current.category,
        summary: current.summary,
        description: current.description,
        line: currentLine,
      });
    }
    current = null;
    currentLine = null;
  };

  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '---') continue;

    const headMatch = TEMPLATE_HEADING_RE.exec(line);
    if (headMatch) {
      commit();
      current = { name: headMatch[1].trim() };
      currentLine = i + 1;
      continue;
    }

    const fieldMatch = TEMPLATE_FIELD_RE.exec(line);
    if (fieldMatch && current !== null) {
      current[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
    }
  }

  commit();
  return out;
}

// projects JSON into the same reduced shape as its paired reparseX() so diffRecords can compare them.

function flattenFlatJson(arr) {
  return arr.map((o) => ({ name: o.name, category: o.category, notes: o.notes }));
}

function flattenGrammarJson(arr) {
  return arr.map((o) => ({
    name: o.name,
    category: o.category,
    notes: o.notes,
    latinExpression: o.latinExpression,
    linksKey: linksToKey(o.links ?? []),
  }));
}

function flattenIdiomsJson(arr) {
  return arr.map((it) => ({
    category: it.category,
    latin: it.latin,
    gloss: it.gloss,
    inflection: it.inflection ?? null,
    notes: it.notes ?? null,
    exampleCount: (it.examples ?? []).length,
  }));
}

function flattenTemplatesJson(arr) {
  return arr.map((o) => ({
    name: o.name,
    category: o.category,
    summary: o.summary,
    description: o.description,
  }));
}

// links missing a required field are dropped, matching the builder's behaviour.
export function reparseLinks(mdText) {
  const out = [];
  let current = null;
  let currentLine = null;

  const commit = () => {
    if (current === null) return;
    if (current.url && current.description) {
      const rec = {
        name: current.name,
        url: current.url,
        description: current.description,
        thumbnail: current.thumbnail ?? null,
        line: currentLine,
      };
      out.push(rec);
    }
    current = null;
    currentLine = null;
  };

  const lines = mdText.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '---') continue;

    const headMatch = LINK_HEADING_RE.exec(line);
    if (headMatch) {
      commit();
      current = { name: headMatch[1].trim() };
      currentLine = i + 1;
      continue;
    }

    const fieldMatch = LINK_FIELD_RE.exec(line);
    if (fieldMatch && current !== null) {
      current[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
    }
  }

  commit();
  return out;
}

function flattenLinksJson(arr) {
  return arr.map((o) => ({
    name: o.name,
    url: o.url,
    description: o.description,
    thumbnail: o.thumbnail ?? null,
  }));
}

export function reparseNames(mdText) {
  const out = [];
  let category = null;
  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line === '---') continue;

    const catMatch = FLAT_CATEGORY_RE.exec(line);
    if (catMatch) {
      category = catMatch[1].trim();
      continue;
    }

    if (line.startsWith('- ')) {
      if (category === null) continue;
      out.push({ category, name: line.slice(2).trim(), line: i + 1 });
    }
  }

  return out;
}

function flattenNamesJson(arr) {
  const out = [];
  for (const group of arr) {
    for (const name of group.names) {
      out.push({ category: group.category, name });
    }
  }
  return out;
}

/**
 * Re-parse the books manifest markdown into an ordered list of ids.
 */
export function reparseManifest(mdText) {
  const ids = [];
  const lines = mdText.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('- ')) ids.push(line.slice(2).trim());
  }
  return ids;
}

// the build never prunes old files, so orphaned book JSON must be caught here.
export function findOrphanBookJson(manifestIds, filenames) {
  const expected = new Set(manifestIds.map((id) => `${id}.json`));
  return filenames.filter(
    (f) => f.endsWith('.json') && f !== 'manifest.json' && !expected.has(f),
  );
}

// build-generated ids are stripped; only authored content is compared.
export function reparseBook(mdText) {
  let title = null;
  let author = null;
  let year = null;
  let blurb = null;
  const chapters = [];
  let chapter = null;
  let section = null;
  let pendingPrompt = null;

  const lines = mdText.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === '---') continue;

    if (line.startsWith('### ')) {
      pendingPrompt = null;
      if (chapter === null) continue;
      section = { title: line.slice(4).trim(), exercises: [] };
      chapter.sections.push(section);
      continue;
    }
    if (line.startsWith('## ')) {
      pendingPrompt = null;
      chapter = { title: line.slice(3).trim(), sections: [] };
      chapters.push(chapter);
      section = null;
      continue;
    }
    if (line.startsWith('# ')) {
      if (title === null) title = line.slice(2).trim();
      continue;
    }

    const metaMatch = BOOK_META_RE.exec(line);
    if (metaMatch) {
      const field = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (field === 'author') author = value;
      else if (field === 'year') year = Number.parseInt(value, 10);
      else if (field === 'blurb') blurb = value;
      continue;
    }

    const exMatch = BOOK_EXERCISE_RE.exec(line);
    if (exMatch) {
      const kind = exMatch[1].toLowerCase();
      const value = exMatch[2].trim();
      if (kind === 'prompt') {
        pendingPrompt = value;
      } else if (pendingPrompt !== null && section !== null) {
        section.exercises.push({ prompt: pendingPrompt, key: value });
        pendingPrompt = null;
      }
    }
  }

  return { title, author, year, blurb, chapters };
}

function canonicalBookJson(book) {
  return {
    title: book.title,
    author: book.author,
    year: book.year,
    blurb: book.blurb,
    chapters: (book.chapters ?? []).map((ch) => ({
      title: ch.title,
      sections: (ch.sections ?? []).map((s) => ({
        title: s.title,
        exercises: (s.exercises ?? []).map((ex) => ({ prompt: ex.prompt, key: ex.key })),
      })),
    })),
  };
}

export function checkUnique(records, label, key) {
  const errors = [];
  const seen = new Map();
  for (const r of records) {
    const k = r[key];
    if (seen.has(k)) {
      const prev = seen.get(k);
      if (prev.category === r.category) {
        errors.push(`${label}: '${k}' appears more than once in category '${r.category}'`);
      } else {
        errors.push(`${label}: '${k}' appears in both '${prev.category}' and '${r.category}'`);
      }
    } else {
      seen.set(k, r);
    }
  }
  return errors;
}

// diff re-parsed markdown against flattened JSON, matched by `key`, compared field by field.
export function diffRecords({ label, key, fields, mdRecords, jsonRecords }) {
  const errors = [];

  if (mdRecords.length !== jsonRecords.length) {
    errors.push(
      `${label}: count mismatch — md has ${mdRecords.length}, json has ${jsonRecords.length}`
    );
  }

  errors.push(...checkUnique(mdRecords, `${label} md`, key));
  errors.push(...checkUnique(jsonRecords, `${label} json`, key));

  const jsonByKey = new Map();
  for (const j of jsonRecords) {
    const arr = jsonByKey.get(j[key]) ?? [];
    arr.push(j);
    jsonByKey.set(j[key], arr);
  }

  const mdKeys = new Set();
  for (const m of mdRecords) {
    mdKeys.add(m[key]);
    const matches = jsonByKey.get(m[key]) ?? [];
    if (matches.length === 0) {
      errors.push(`${label}: '${m[key]}' (md line ${m.line}) missing from json`);
      continue;
    }
    if (matches.length > 1) continue; // uniqueness already reported above

    const j = matches[0];
    for (const f of fields) {
      if (norm(m[f]) !== norm(j[f])) {
        errors.push(
          `${label}: ${f} mismatch for '${m[key]}' (md line ${m.line}): ` +
            `md=${JSON.stringify(m[f])} vs json=${JSON.stringify(j[f])}`
        );
      }
    }
  }

  for (const j of jsonRecords) {
    if (!mdKeys.has(j[key])) {
      errors.push(`${label}: json '${j[key]}' not present in md`);
    }
  }

  return errors;
}

export function diffManifest(mdIds, jsonIds) {
  const errors = [];
  if (mdIds.length !== jsonIds.length) {
    errors.push(`books manifest: count mismatch — md has ${mdIds.length}, json has ${jsonIds.length}`);
  }
  const n = Math.max(mdIds.length, jsonIds.length);
  for (let i = 0; i < n; i++) {
    if (mdIds[i] !== jsonIds[i]) {
      errors.push(`books manifest: position ${i + 1} mismatch — md=${JSON.stringify(mdIds[i])} vs json=${JSON.stringify(jsonIds[i])}`);
    }
  }
  return errors;
}

// walks metadata then chapters/sections/exercises positionally, emitting path-labelled messages.
export function diffBook(bookId, mdBook, jsonBook) {
  const errors = [];
  const at = `books[${bookId}]`;

  for (const f of ['title', 'author', 'year', 'blurb']) {
    if (norm(mdBook[f]) !== norm(jsonBook[f])) {
      errors.push(`${at}: ${f} mismatch: md=${JSON.stringify(mdBook[f])} vs json=${JSON.stringify(jsonBook[f])}`);
    }
  }

  // positional comparison: ids are build-generated and absent from markdown
  const mdCh = mdBook.chapters ?? [];
  const jsonCh = jsonBook.chapters ?? [];
  if (mdCh.length !== jsonCh.length) {
    errors.push(`${at}: chapter count mismatch — md=${mdCh.length} vs json=${jsonCh.length}`);
  }

  const chCount = Math.min(mdCh.length, jsonCh.length);
  for (let c = 0; c < chCount; c++) {
    const mc = mdCh[c];
    const jc = jsonCh[c];
    if (norm(mc.title) !== norm(jc.title)) {
      errors.push(`${at}: ch${c + 1} title mismatch: md=${JSON.stringify(mc.title)} vs json=${JSON.stringify(jc.title)}`);
    }
    const ms = mc.sections ?? [];
    const js = jc.sections ?? [];
    if (ms.length !== js.length) {
      errors.push(`${at}: ch${c + 1} section count mismatch — md=${ms.length} vs json=${js.length}`);
    }
    const sCount = Math.min(ms.length, js.length);
    for (let s = 0; s < sCount; s++) {
      const msec = ms[s];
      const jsec = js[s];
      if (norm(msec.title) !== norm(jsec.title)) {
        errors.push(`${at}: ch${c + 1} §${s + 1} title mismatch: md=${JSON.stringify(msec.title)} vs json=${JSON.stringify(jsec.title)}`);
      }
      const mex = msec.exercises ?? [];
      const jex = jsec.exercises ?? [];
      if (mex.length !== jex.length) {
        errors.push(`${at}: ch${c + 1} §${s + 1} exercise count mismatch — md=${mex.length} vs json=${jex.length}`);
      }
      const exCount = Math.min(mex.length, jex.length);
      for (let e = 0; e < exCount; e++) {
        for (const f of ['prompt', 'key']) {
          if (norm(mex[e][f]) !== norm(jex[e][f])) {
            errors.push(
              `${at}: ch${c + 1} §${s + 1} ex${e + 1} ${f} mismatch: ` +
                `md=${JSON.stringify(mex[e][f])} vs json=${JSON.stringify(jex[e][f])}`
            );
          }
        }
      }
    }
  }

  return errors;
}

const readText = (p) => readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function validateAll() {
  const checks = [
    {
      label: 'grammar',
      key: 'name',
      fields: ['category', 'notes', 'latinExpression', 'linksKey'],
      mdRecords: reparseGrammar(readText(join(RAW_DIR, 'grammar.md'))),
      jsonRecords: flattenGrammarJson(readJson(join(CAT_DIR, 'grammar.json'))),
    },
    {
      label: 'topics',
      key: 'name',
      fields: ['category', 'notes'],
      mdRecords: reparseFlat(readText(join(RAW_DIR, 'topics.md'))),
      jsonRecords: flattenFlatJson(readJson(join(CAT_DIR, 'topics.json'))),
    },
    {
      label: 'idioms',
      key: 'latin',
      fields: ['category', 'gloss', 'inflection', 'notes', 'exampleCount'],
      mdRecords: reparseIdioms(readText(join(RAW_DIR, 'idioms.md'))),
      jsonRecords: flattenIdiomsJson(readJson(join(CAT_DIR, 'idioms.json'))),
    },
    {
      label: 'templates',
      key: 'name',
      fields: ['category', 'summary', 'description'],
      mdRecords: reparseTemplates(readText(join(RAW_DIR, 'templates.md'))),
      jsonRecords: flattenTemplatesJson(readJson(join(CAT_DIR, 'templates.json'))),
    },
    {
      label: 'links',
      key: 'name',
      fields: ['url', 'description', 'thumbnail'],
      mdRecords: reparseLinks(readText(join(RAW_DIR, 'links.md'))),
      jsonRecords: flattenLinksJson(readJson(join(CAT_DIR, 'links.json'))),
    },
    {
      label: 'names',
      key: 'name',
      fields: ['category'],
      mdRecords: reparseNames(readText(join(RAW_DIR, 'names.md'))),
      jsonRecords: flattenNamesJson(readJson(join(CAT_DIR, 'names.json'))),
    },
  ];

  const errorsByType = {};
  const counts = {};
  for (const c of checks) {
    errorsByType[c.label] = diffRecords(c);
    counts[c.label] = c.jsonRecords.length;
  }

  // names: report category count rather than total names
  counts.names = readJson(join(CAT_DIR, 'names.json')).length;

  errorsByType.books = validateBooks();
  counts.books = reparseManifest(readText(join(RAW_BOOKS_DIR, 'manifest.md'))).length;

  return { errorsByType, counts };
}

function validateBooks() {
  const errors = [];

  // if manifest JSON is missing, skip per-book checks (nothing to compare against)
  const mdIds = reparseManifest(readText(join(RAW_BOOKS_DIR, 'manifest.md')));

  let jsonIds;
  try {
    jsonIds = readJson(join(OUT_BOOKS_DIR, 'manifest.json'));
  } catch {
    errors.push('books: data/books/manifest.json missing or invalid');
    return errors;
  }

  errors.push(...diffManifest(mdIds, jsonIds));

  // iterate markdown manifest (not JSON) so a stale JSON manifest doesn't silently skip books
  for (const id of mdIds) {
    let mdBook;
    let jsonBook;
    try {
      mdBook = reparseBook(readText(join(RAW_BOOKS_DIR, `${id}.md`)));
    } catch {
      errors.push(`books: source data/raw_md/books/${id}.md missing`);
      continue;
    }
    try {
      jsonBook = canonicalBookJson(readJson(join(OUT_BOOKS_DIR, `${id}.json`)));
    } catch {
      errors.push(`books: data/books/${id}.json missing or invalid`);
      continue;
    }
    errors.push(...diffBook(id, mdBook, jsonBook));
  }

  return errors;
}

function main() {
  const { errorsByType, counts } = validateAll();
  const allErrors = Object.values(errorsByType).flat();

  if (allErrors.length > 0) {
    console.error(`VALIDATION FAILED: ${allErrors.length} issue(s)`);
    for (const [type, errs] of Object.entries(errorsByType)) {
      if (errs.length === 0) continue;
      console.error(`\n[${type}] ${errs.length} issue(s):`);
      for (const e of errs) console.error(`  - ${e}`);
    }
    process.exitCode = 1;
    return;
  }

  const summary = Object.entries(counts)
    .map(([type, n]) => `${type} ${n}`)
    .join(', ');
  console.log(`OK: ${summary} — no discrepancies`);
}

// run when invoked directly (not when imported)
if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
