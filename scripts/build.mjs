// build orchestrator: markdown -> JSON data, then JSON -> HTML pages.
// usage: node scripts/build.mjs [--strict]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIdioms } from './build-idioms.mjs';
import { buildGrammar } from './build-grammar.mjs';
import { buildTopics } from './build-topics.mjs';
import { buildTemplates } from './build-templates.mjs';
import { buildLinks } from './build-links.mjs';
import { buildNames } from './build-names.mjs';
import { buildBooks } from './build-books.mjs';
import { renderMarkdown } from './render-markdown.mjs';
import { renderBooks } from './render-books.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = join(__dirname, '..');
const strict    = process.argv.includes('--strict');

const { version } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

// builders run sequentially so inter-builder dependencies (books needs manifest) are safe
function buildData() {
  console.log('Building data…');
  buildIdioms({ strict });
  buildGrammar({ strict });
  buildTopics({ strict });
  buildTemplates({ strict });
  buildLinks({ strict });
  buildNames({ strict });
  // books must build before renderBooks() (which consumes the book JSON + manifest)
  buildBooks({ strict });
}

// {{version}} placeholders in site markdown are replaced with the package.json version
function renderSiteMarkdown() {
  const siteDir = join(repoRoot, 'data', 'site');
  const files   = readdirSync(siteDir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    console.log('  [markdown] no .md files found in data/site/');
    return;
  }

  for (const file of files) {
    const mdPath   = join(siteDir, file);
    const htmlPath = join(siteDir, file.replace(/\.md$/, '.html'));
    const md       = readFileSync(mdPath, 'utf8').replace(/\{\{version\}\}/g, version);
    const html     = renderMarkdown(md);
    writeFileSync(htmlPath, html, 'utf8');
    console.log(`  [markdown] ${file} → ${file.replace(/\.md$/, '.html')}`);
  }
}

console.log('Scriptoribus build starting…\n');
buildData();
renderSiteMarkdown();
renderBooks();
console.log('\nBuild complete.');
