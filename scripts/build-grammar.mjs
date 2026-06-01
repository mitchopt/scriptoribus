// parses data/raw_md/grammar.md into data/categories/grammar.json (flat array).
// parseGrammar() is pure (string -> { data, warnings }) and exported for tests.
// buildGrammar() handles file I/O; the script is runnable directly (node scripts/build-grammar.mjs [--strict]).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const MD_PATH = join(repoRoot, 'data', 'raw_md', 'grammar.md');
const OUT_PATH = join(repoRoot, 'data', 'categories', 'grammar.json');

// matches `**Category:** value` etc. - group 1 is the field, group 2 the value.
const FIELD_RE = /^\*\*(Category|Link|Note|Latin Expression):\*\*\s*(.*)$/;

// matches a markdown link `[text](url)` - group 1 is the label, group 2 the url.
// e.g. in `([A&G §343](https://dcc.dickinson.edu/...))` this matches `[A&G §343](https://...)`
// and ignores the wrapping parens. `[^)]+` for the url is fine for these DCC links
// (no `)` inside any url); revisit if a url ever contains a literal `)`.
const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

const REQUIRED_FIELDS = ['category'];

// extract all markdown links from a Link-field value into `{ text, url }` objects.
export function parseLinkField(value) {
  const links = [];
  LINK_RE.lastIndex = 0;
  let match;
  while ((match = LINK_RE.exec(value)) !== null) {
    links.push({ text: match[1].trim(), url: match[2].trim() });
  }
  return links;
}

// parse grammar markdown into a flat array of construction objects plus warnings.
// `# Name` opens a construction; field lines populate it; commit on the next H1 or at EOF.
// constructions missing a required field are skipped without consuming an id.
export function parseGrammar(mdText) {
  const data = [];
  const warnings = [];

  let current = null;
  let currentLine = null;
  let counter = 0;

  function commit() {
    if (current === null) return;
    const missing = REQUIRED_FIELDS.filter(f => !current[f]);
    if (missing.length > 0) {
      warnings.push(
        `line ${currentLine}: skipping '${current.name}' (missing: ${missing.join(', ')})`
      );
    } else {
      counter += 1;
      data.push({
        id: `g${String(counter).padStart(3, '0')}`,
        name: current.name,
        category: current.category,
        notes: current.notes ?? '',
        latinExpression: current.latinExpression ?? '',
        links: current.links ?? [],
      });
    }
    current = null;
    currentLine = null;
  }

  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (!line || line === '---') continue;

    // each H1 heading is the construction name; encountering one commits the previous construction.
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      commit();
      current = { name: line.slice(2).trim() };
      currentLine = lineNo;
      continue;
    }

    const fieldMatch = FIELD_RE.exec(line);
    if (fieldMatch) {
      if (current === null) {
        warnings.push(`line ${lineNo}: field outside any construction: '${line}'`);
        continue;
      }
      const label = fieldMatch[1];
      const value = fieldMatch[2].trim();
      if (label === 'Category') current.category = value;
      else if (label === 'Note') current.notes = value;
      else if (label === 'Latin Expression') current.latinExpression = value;
      else if (label === 'Link') current.links = parseLinkField(value);
      continue;
    }

    // silently ignore anything else
  }

  commit();
  return { data, warnings };
}

// read grammar.md, write grammar.json, print a summary. throws in strict mode if warnings exist.
export function buildGrammar({ strict = false } = {}) {
  const mdText = readFileSync(MD_PATH, 'utf8');
  const { data, warnings } = parseGrammar(mdText);

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const categoryCounts = {};
  for (const item of data) {
    categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
  }
  const categoryCount = Object.keys(categoryCounts).length;

  console.log(`wrote ${OUT_PATH} with ${data.length} constructions across ${categoryCount} categories`);
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat}: ${count}`);
  }
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (strict && warnings.length > 0) {
    throw new Error(`build-grammar: ${warnings.length} warning(s) in strict mode`);
  }

  return { data, warnings, total: data.length, categoryCount };
}

// run when invoked directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildGrammar({ strict: process.argv.includes('--strict') });
}
