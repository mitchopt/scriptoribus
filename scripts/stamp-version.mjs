// stamp version.json at deploy time only - never committed (see .gitignore) and never
// produced by the normal build, so the PR determinism check (git diff --exit-code) stays clean.
// usage: node scripts/stamp-version.mjs

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// format an ISO date "2026-06-02" as "02.June.2026" (strftime %d.%B.%Y)
export function formatDisplay(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${String(day).padStart(2, '0')}.${MONTHS[month - 1]}.${year}`;
}

function main() {
  const iso     = new Date().toISOString().slice(0, 10);
  const commit  = (process.env.GITHUB_SHA || '').slice(0, 7);
  const version = { iso, display: formatDisplay(iso), commit };

  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  writeFileSync(join(repoRoot, 'version.json'), `${JSON.stringify(version, null, 2)}\n`, 'utf8');
  console.log(`Stamped version.json: ${version.display} (${commit || 'no-sha'})`);
}

// run side effects only when executed directly, so tests can import formatDisplay purely
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
