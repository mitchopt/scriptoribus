// parses data/raw_md/idioms.md into data/categories/idioms.json (flat array).
// parseIdioms() is pure (string -> { data, warnings }) and exported for tests.
// buildIdioms() handles file I/O; the script is runnable directly (node scripts/build-idioms.mjs [--strict]).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const MD_PATH = join(repoRoot, 'data', 'raw_md', 'idioms.md');
const OUT_PATH = join(repoRoot, 'data', 'categories', 'idioms.json');

// matches `> Author, *Work* citation: "quoted sentence"` - group 1 is the citation, group 2 the quote.
// greedy citation + lazy quote anchored to end-of-line, so embedded colons in the citation are fine.
const EXAMPLE_RE = /^>\s*(.+?):\s*"(.+)"\s*$/;

// parse idioms markdown into a flat array of idiom objects plus line-numbered warnings.
// `# latin` opens an idiom; field lines populate it; commit on the next `# ` or at EOF.
// idioms missing **Category:** are skipped without consuming an id (mirrors build-grammar.mjs).
export function parseIdioms(mdText) {
  const data = [];
  const warnings = [];

  let currentIdiom = null;
  let currentLine = null;
  let counter = 0;

  function commitIdiom() {
    if (currentIdiom === null) return;
    if (!currentIdiom.category) {
      warnings.push(
        `line ${currentLine}: skipping idiom '${currentIdiom.latin}' (missing: category)`
      );
      currentIdiom = null;
      currentLine = null;
      return;
    }
    counter += 1;
    data.push({
      id: `i${String(counter).padStart(3, '0')}`,
      latin: currentIdiom.latin,
      gloss: currentIdiom.gloss,
      category: currentIdiom.category,
      inflection: currentIdiom.inflection,
      notes: currentIdiom.notes,
      examples: currentIdiom.examples,
    });
    currentIdiom = null;
    currentLine = null;
  }

  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trimEnd();

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      commitIdiom();
      currentIdiom = {
        latin: line.slice(2).trim(),
        gloss: '',
        examples: [],
      };
      currentLine = lineNo;
      continue;
    }

    if (currentIdiom === null) continue;

    if (line.startsWith('**Category:**')) {
      currentIdiom.category = line.slice('**Category:**'.length).trim();
      continue;
    }

    if (line.startsWith('**Meaning:**')) {
      const gloss = line.slice('**Meaning:**'.length).trim();
      if (!gloss) {
        warnings.push(`line ${lineNo}: idiom '${currentIdiom.latin}' has empty Meaning`);
      }
      currentIdiom.gloss = gloss;
      continue;
    }

    if (line.startsWith('**Inflection:**')) {
      currentIdiom.inflection = line.slice('**Inflection:**'.length).trim();
      continue;
    }

    if (line.startsWith('**Note:**')) {
      currentIdiom.notes = line.slice('**Note:**'.length).trim();
      continue;
    }

    if (line.startsWith('>')) {
      const m = EXAMPLE_RE.exec(line);
      if (!m) {
        warnings.push(
          `line ${lineNo}: unparseable example line under '${currentIdiom.latin}': '${line}'`
        );
        continue;
      }
      currentIdiom.examples.push({ citation: m[1].trim(), quote: m[2].trim() });
      continue;
    }

    // silently ignore: blank lines, ---, **Search:**, **Examples:** label, etc.
  }

  commitIdiom();
  return { data, warnings };
}

// read idioms.md, write idioms.json, print a summary. throws in strict mode if warnings exist.
export function buildIdioms({ strict = false } = {}) {
  const mdText = readFileSync(MD_PATH, 'utf8');
  const { data, warnings } = parseIdioms(mdText);

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const categoryCounts = {};
  for (const item of data) {
    categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
  }
  const categoryCount = Object.keys(categoryCounts).length;

  console.log(`wrote ${OUT_PATH} with ${data.length} idioms across ${categoryCount} categories`);
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat}: ${count}`);
  }
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (strict && warnings.length > 0) {
    throw new Error(`build-idioms: ${warnings.length} warning(s) in strict mode`);
  }

  return { data, warnings, total: data.length, categoryCount };
}

// run when invoked directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildIdioms({ strict: process.argv.includes('--strict') });
}
