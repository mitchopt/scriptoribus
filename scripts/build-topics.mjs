// parses data/raw_md/topics.md into data/categories/topics.json (flat array).
// parseTopics() is pure (string -> { data, warnings }) and exported for tests.
// buildTopics() handles file I/O; the script is runnable directly (node scripts/build-topics.mjs [--strict]).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const MD_PATH = join(repoRoot, 'data', 'raw_md', 'topics.md');
const OUT_PATH = join(repoRoot, 'data', 'categories', 'topics.json');

// matches the first **bold** span on a line - category name is group 1.
const CATEGORY_RE = /^\*\*(.+?)\*\*/;

export function parseTopics(mdText) {
  const data = [];
  const warnings = [];

  let currentCategory = null;
  let topicCounter = 0;

  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (!line || line.startsWith('#') || line === '---') continue;

    const catMatch = CATEGORY_RE.exec(line);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      continue;
    }

    if (line.startsWith('- ')) {
      if (currentCategory === null) {
        warnings.push(`line ${lineNo}: topic with no category: '${line}'`);
        continue;
      }
      // id is only assigned for committed entries so ids are sequential and gap-free.
      topicCounter += 1;
      data.push({
        id: `t${String(topicCounter).padStart(3, '0')}`,
        name: line.slice(2).trim(),
        category: currentCategory,
        notes: '',
      });
      continue;
    }

    // silently ignore anything else
  }

  return { data, warnings };
}

// read topics.md, write topics.json, print a summary. throws in strict mode if warnings exist.
export function buildTopics({ strict = false } = {}) {
  const mdText = readFileSync(MD_PATH, 'utf8');
  const { data, warnings } = parseTopics(mdText);

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const categoryCounts = {};
  for (const item of data) {
    categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
  }
  const categoryCount = Object.keys(categoryCounts).length;

  console.log(`wrote ${OUT_PATH} with ${data.length} topics across ${categoryCount} categories`);
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat}: ${count}`);
  }
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (strict && warnings.length > 0) {
    throw new Error(`build-topics: ${warnings.length} warning(s) in strict mode`);
  }

  return { data, warnings, total: data.length, categoryCount };
}

// run when invoked directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildTopics({ strict: process.argv.includes('--strict') });
}
