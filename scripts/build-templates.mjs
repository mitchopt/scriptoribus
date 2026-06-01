// parses data/raw_md/templates.md into data/categories/templates.json (flat array).
// parseTemplates() is pure (string -> { data, warnings }) and exported for tests.
// buildTemplates() handles file I/O; the script is runnable directly (node scripts/build-templates.mjs [--strict]).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const MD_PATH = join(repoRoot, 'data', 'raw_md', 'templates.md');
const OUT_PATH = join(repoRoot, 'data', 'categories', 'templates.json');

// matches `# Heading Text` - group 1 is the heading text. a `## ...` line is not
// matched since its 2nd char is `#`, not whitespace.
const HEADING_RE = /^#\s+(.+)$/;

// matches `**Field:** value` - group 1 is the field name, group 2 the value.
const FIELD_RE = /^\*\*(Category|Summary|Description):\*\*\s*(.*)$/;

const REQUIRED_FIELDS = ['category', 'summary', 'description'];

// parse templates markdown into a flat array of template objects plus warnings.
// `# Name` opens an entry; field lines populate it; commit on the next H1 or at EOF.
// entries missing required fields are skipped without consuming an id.
export function parseTemplates(mdText) {
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
      data.push({
        id: `tpl${String(data.length + 1).padStart(3, '0')}`,
        name: current.name,
        category: current.category,
        summary: current.summary,
        description: current.description,
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

    // HEADING_RE matches both `# H1` and `## H2` lines; in the source file H2 is used
    // for section labels, so both commit the previous entry and open a new one.
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

// read templates.md, write templates.json, print a summary. throws in strict mode if warnings exist.
export function buildTemplates({ strict = false } = {}) {
  const mdText = readFileSync(MD_PATH, 'utf8');
  const { data, warnings } = parseTemplates(mdText);

  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const categoryCounts = {};
  for (const item of data) {
    categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
  }
  const categoryCount = Object.keys(categoryCounts).length;

  console.log(`wrote ${OUT_PATH} with ${data.length} templates across ${categoryCount} categories`);
  for (const cat of Object.keys(categoryCounts).sort()) {
    console.log(`  ${cat}: ${categoryCounts[cat]}`);
  }
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (strict && warnings.length > 0) {
    throw new Error(`build-templates: ${warnings.length} warning(s) in strict mode`);
  }

  return { data, warnings, total: data.length, categoryCount };
}

// run when invoked directly (not when imported)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildTemplates({ strict: process.argv.includes('--strict') });
}
