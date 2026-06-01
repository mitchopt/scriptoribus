// parses data/raw_md/names.md into data/categories/names.json.
// parseNames() is pure (string -> { data, warnings }) and exported for tests.
// buildNames() handles file I/O; the script is runnable directly (node scripts/build-names.mjs [--strict]).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const MD_PATH = join(repoRoot, 'data', 'raw_md', 'names.md');
const OUT_PATH = join(repoRoot, 'data', 'categories', 'names.json');

// matches the first **bold** span on a line - category name is group 1.
const CATEGORY_RE = /^\*\*(.+?)\*\*/;

// parse names markdown into a flat array of { category, names } objects.
// a `- name` line before any category is skipped with a warning.
export function parseNames(mdText) {
  const data = [];
  const warnings = [];

  let current = null;

  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (!line || line.startsWith('#') || line === '---') continue;

    // a bold line opens a new category group and pushes it into the output immediately;
    // subsequent name lines append to the same object reference.
    const catMatch = CATEGORY_RE.exec(line);
    if (catMatch) {
      current = { category: catMatch[1].trim(), names: [] };
      data.push(current);
      continue;
    }

    if (line.startsWith('- ')) {
      if (current === null) {
        warnings.push(`line ${lineNo}: name with no category: '${line}'`);
        continue;
      }
      // names have no ids: the page samples randomly from the pool and never stores
      // a reference to a specific name, so identifiers are not needed.
      current.names.push(line.slice(2).trim());
      continue;
    }

    // silently ignore anything else
  }

  return { data, warnings };
}

// read names.md, write names.json, print a summary. throws in strict mode if warnings exist.
export function buildNames({ strict = false } = {}) {
  const mdText = readFileSync(MD_PATH, 'utf8');
  const { data, warnings } = parseNames(mdText);

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const total = data.reduce((n, cat) => n + cat.names.length, 0);
  console.log(`wrote ${OUT_PATH} with ${total} names across ${data.length} categories`);
  for (const cat of data) {
    console.log(`  ${cat.category}: ${cat.names.length}`);
  }
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (strict && warnings.length > 0) {
    throw new Error(`build-names: ${warnings.length} warning(s) in strict mode`);
  }

  return { data, warnings, total, categoryCount: data.length };
}

// run when invoked directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildNames({ strict: process.argv.includes('--strict') });
}
