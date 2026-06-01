// parses data/raw_md/links.md into data/categories/links.json (flat array).
// parseLinks() is pure (string -> { data, warnings }) and exported for tests.
// buildLinks() handles file I/O; the script is runnable directly (node scripts/build-links.mjs [--strict]).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const MD_PATH = join(repoRoot, 'data', 'raw_md', 'links.md');
const OUT_PATH = join(repoRoot, 'data', 'categories', 'links.json');

// matches `# Heading Text` - group 1 is the link name. `## ...` lines are not matched.
const HEADING_RE = /^#\s+(.+)$/;

// matches `**URL:** value` / `**Description:** value` / `**Thumbnail:** value` - group 1 field, group 2 value.
const FIELD_RE = /^\*\*(URL|Description|Thumbnail):\*\*\s*(.*)$/;

const REQUIRED_FIELDS = ['url', 'description'];

// parse links markdown into a flat array of link objects plus warnings.
// `# Name` opens a link; field lines populate it; commit on the next H1 or at EOF.
export function parseLinks(mdText) {
  const data = [];
  const warnings = [];

  let current = null;
  let currentLine = null;

  function commit() {
    if (current === null) return;
    const missing = REQUIRED_FIELDS.filter(f => !current[f]);
    if (missing.length > 0) {
      warnings.push(
        `line ${currentLine}: skipping '${current.name}' (missing: ${missing.join(', ')})`
      );
    } else {
      const link = {
        id: `lnk${String(data.length + 1).padStart(3, '0')}`,
        name: current.name,
        url: current.url,
        description: current.description,
      };
      // thumbnail is optional: omit the property entirely when absent so the JSON
      // does not contain `thumbnail: null` for links without images.
      if (current.thumbnail) link.thumbnail = current.thumbnail;
      data.push(link);
    }
    current = null;
    currentLine = null;
  }

  const lines = mdText.split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i].trim();

    if (!line || line === '---') continue;

    const headMatch = HEADING_RE.exec(line);
    if (headMatch) {
      commit();
      current = { name: headMatch[1].trim() };
      currentLine = lineNo;
      continue;
    }

    const fieldMatch = FIELD_RE.exec(line);
    if (fieldMatch) {
      if (current === null) {
        warnings.push(`line ${lineNo}: field outside any entry: '${line}'`);
        continue;
      }
      current[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
      continue;
    }

    // silently ignore anything else
  }

  commit();
  return { data, warnings };
}

// read links.md, write links.json, print a summary. throws in strict mode if warnings exist.
export function buildLinks({ strict = false } = {}) {
  const mdText = readFileSync(MD_PATH, 'utf8');
  const { data, warnings } = parseLinks(mdText);

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`wrote ${OUT_PATH} with ${data.length} links`);
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (strict && warnings.length > 0) {
    throw new Error(`build-links: ${warnings.length} warning(s) in strict mode`);
  }

  return { data, warnings, total: data.length };
}

// run when invoked directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildLinks({ strict: process.argv.includes('--strict') });
}
