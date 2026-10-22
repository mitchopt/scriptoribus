/**
 * build-books.test.mjs: tests for the pure book markdown parsers (parseBook, parseManifest),
 * including the optional notes and vocabulary boxes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBook, parseManifest } from '../scripts/build-books.mjs';

// one book exercising both box levels: a chapter box (after ##, before the first ###) and
// two section boxes (after ###, before the first prompt).
const SAMPLE = `# Sample Book

**Author:** A. N. Author

**Year:** 1900

**Blurb:** A short *blurb*.

## First Section

**Notes:** Section notes,
continued on a second line.

Second paragraph.

### Exercise 1

**Vocabulary:**
- obey, *pāreō*
- spare, *parcō*

**Notes:** Exercise notes.

**Prompt:** First prompt.
**Key:** Prima.

**Prompt:** Second prompt.
**Key:** Secunda.

### Exercise 2

**Prompt:** Third prompt.
**Key:** Tertia.

## Second Section

### Exercise 3

**Prompt:** Fourth prompt.
**Key:** Quarta.
`;

// wraps markdown in minimal valid metadata so a test states only the lines it is about.
// the metadata takes 8 lines, so `body` starts on line 9.
function bookWith(body) {
  return `# T\n\n**Author:** A\n\n**Year:** 1900\n\n**Blurb:** B\n\n${body}`;
}

// structure and metadata

test('parseBook: reads metadata, headings, and prompt/key pairs with positional ids', () => {
  const { data, warnings } = parseBook(SAMPLE, 'sample');
  assert.deepEqual(warnings, []);
  assert.equal(data.id, 'sample');
  assert.equal(data.title, 'Sample Book');
  assert.equal(data.author, 'A. N. Author');
  assert.equal(data.year, 1900);
  assert.equal(data.blurb, 'A short *blurb*.');
  assert.deepEqual(
    data.chapters.map((ch) => [ch.id, ch.title]),
    [['ch01', 'First Section'], ['ch02', 'Second Section']]
  );
  assert.deepEqual(
    data.chapters[0].sections.map((s) => [s.id, s.title]),
    [['s01', 'Exercise 1'], ['s02', 'Exercise 2']]
  );
  assert.deepEqual(data.chapters[0].sections[0].exercises, [
    { id: 'ex01', prompt: 'First prompt.', key: 'Prima.' },
    { id: 'ex02', prompt: 'Second prompt.', key: 'Secunda.' },
  ]);
  // section and exercise ids restart in each chapter
  assert.equal(data.chapters[1].sections[0].id, 's01');
  assert.equal(data.chapters[1].sections[0].exercises[0].id, 'ex01');
});

test('parseBook: reports each missing metadata field', () => {
  const { data, warnings } = parseBook('## S\n', 'x');
  assert.deepEqual(warnings, [
    "'x' missing required field: title",
    "'x' missing required field: author",
    "'x' missing required field: year",
    "'x' missing required field: blurb",
  ]);
  assert.equal(data.title, '');
  assert.equal(data.year, null);
});

test('parseBook: warns about misplaced headings, unpaired prompts and keys, and a bad year', () => {
  const md = [
    '# T',
    '',
    '**Author:** A',
    '',
    '**Year:** MCM',
    '',
    '**Blurb:** B',
    '',
    '### Orphan', // line 9: no ## yet
    '',
    '**Prompt:** P',
    '**Key:** K', // line 12: no ### yet
    '',
    '## S',
    '',
    '### E',
    '',
    '**Key:** lonely', // line 18
    '',
    '**Prompt:** dangling', // line 20: never answered
  ].join('\n');
  const { data, warnings } = parseBook(md, 'x');
  assert.deepEqual(warnings, [
    "line 9: section before any chapter in 'x'",
    "line 12: exercise before any section in 'x'",
    "line 18: key without a preceding prompt in 'x'",
    "line 20: prompt without a following key in 'x'",
    "'x' has non-numeric year: 'MCM'",
  ]);
  assert.equal(data.year, null);
  assert.deepEqual(data.chapters[0].sections[0].exercises, []);
});

// boxes: placement

test('parseBook: a box after ## and before the first ### belongs to the chapter', () => {
  const { data } = parseBook(SAMPLE, 'sample');
  assert.deepEqual(data.chapters[0].boxes, [
    { kind: 'notes', body: 'Section notes,\ncontinued on a second line.\n\nSecond paragraph.' },
  ]);
});

test('parseBook: a box after ### and before the first prompt belongs to that section, in order', () => {
  const { data } = parseBook(SAMPLE, 'sample');
  assert.deepEqual(data.chapters[0].sections[0].boxes, [
    { kind: 'vocabulary', body: '- obey, *pāreō*\n- spare, *parcō*' },
    { kind: 'notes', body: 'Exercise notes.' },
  ]);
});

test('parseBook: headings without boxes get an empty boxes array', () => {
  const { data } = parseBook(SAMPLE, 'sample');
  assert.deepEqual(data.chapters[0].sections[1].boxes, []);
  assert.deepEqual(data.chapters[1].boxes, []);
  assert.deepEqual(data.chapters[1].sections[0].boxes, []);
});

test('parseBook: **Note:** is accepted as an alias of **Notes:**', () => {
  const { data, warnings } = parseBook(bookWith('## S\n\n**Note:** Singular label.\n'), 'x');
  assert.deepEqual(warnings, []);
  assert.deepEqual(data.chapters[0].boxes, [{ kind: 'notes', body: 'Singular label.' }]);
});

// boxes: body text

test('parseBook: box bodies collapse blank-line runs and drop blank edges', () => {
  const md = bookWith('## S\n\n**Notes:**\n\n\nFirst.\n\n\n\nSecond.\n\n\n### E\n');
  const { data } = parseBook(md, 'x');
  assert.equal(data.chapters[0].boxes[0].body, 'First.\n\nSecond.');
});

test('parseBook: box lines are trimmed, including the text after the label', () => {
  const md = bookWith('## S\n\n**Notes:**   after the label   \n   indented line   \n');
  const { data } = parseBook(md, 'x');
  assert.equal(data.chapters[0].boxes[0].body, 'after the label\nindented line');
});

test('parseBook: a --- line inside a box acts as a blank line', () => {
  const md = bookWith('## S\n\n**Notes:** First.\n---\nSecond.\n\n---\n\n### E\n');
  const { data } = parseBook(md, 'x');
  assert.equal(data.chapters[0].boxes[0].body, 'First.\n\nSecond.');
});

test('parseBook: lines starting with plain bold or #### stay in the box', () => {
  const md = bookWith('## S\n\n**Notes:**\n#### Usage\n**ut** + subjunctive.\n');
  const { data, warnings } = parseBook(md, 'x');
  assert.deepEqual(warnings, []);
  assert.equal(data.chapters[0].boxes[0].body, '#### Usage\n**ut** + subjunctive.');
});

test('parseBook: a box ends at the next ### or ## heading, box label, prompt, or end of file', () => {
  const md = bookWith(
    [
      '## S1',
      '**Notes:** ends at a ### heading',
      '### E1',
      '**Notes:** ends at a prompt',
      '**Prompt:** P',
      '**Key:** K',
      '## S2',
      '**Notes:** ends at another box label',
      '**Vocabulary:** ends at a ## heading',
      '## S3',
      '**Notes:** ends at the end of the file',
    ].join('\n')
  );
  const { data, warnings } = parseBook(md, 'x');
  assert.deepEqual(warnings, []);
  const [s1, s2, s3] = data.chapters;
  assert.deepEqual(s1.boxes, [{ kind: 'notes', body: 'ends at a ### heading' }]);
  assert.deepEqual(s1.sections[0].boxes, [{ kind: 'notes', body: 'ends at a prompt' }]);
  assert.deepEqual(s1.sections[0].exercises, [{ id: 'ex01', prompt: 'P', key: 'K' }]);
  assert.deepEqual(s2.boxes, [
    { kind: 'notes', body: 'ends at another box label' },
    { kind: 'vocabulary', body: 'ends at a ## heading' },
  ]);
  assert.deepEqual(s3.boxes, [{ kind: 'notes', body: 'ends at the end of the file' }]);
});

// boxes: warnings

test('parseBook: a box before the first ## is dropped with a warning', () => {
  const md = bookWith('**Notes:** too early\n\n## S\n');
  const { data, warnings } = parseBook(md, 'x');
  assert.deepEqual(warnings, ["line 9: notes box before any chapter in 'x'"]);
  assert.deepEqual(data.chapters[0].boxes, []);
});

test('parseBook: a box after the first prompt is dropped with a warning; pairs around it survive', () => {
  const md = bookWith(
    [
      '## S',
      '### E',
      '**Prompt:** P1',
      '**Notes:** too late', // line 12
      '**Key:** K1',
      '**Prompt:** P2',
      '**Key:** K2',
    ].join('\n')
  );
  const { data, warnings } = parseBook(md, 'x');
  assert.deepEqual(warnings, ["line 12: notes box after the first prompt of 'E' in 'x'"]);
  const section = data.chapters[0].sections[0];
  assert.deepEqual(section.boxes, []);
  assert.deepEqual(
    section.exercises.map((ex) => [ex.prompt, ex.key]),
    [['P1', 'K1'], ['P2', 'K2']]
  );
});

test('parseBook: an empty box is dropped with a warning', () => {
  const md = bookWith('## S\n\n**Vocabulary:**\n\n### E\n');
  const { data, warnings } = parseBook(md, 'x');
  assert.deepEqual(warnings, ["line 11: empty vocabulary box in 'x'"]);
  assert.deepEqual(data.chapters[0].boxes, []);
});

// manifest

test('parseManifest: reads `- id` lines in order and ignores everything else', () => {
  const { ids, warnings } = parseManifest('# Books\n\nSome prose.\n\n- alpha\n- beta\n');
  assert.deepEqual(ids, ['alpha', 'beta']);
  assert.deepEqual(warnings, []);
});

test('parseManifest: warns when no ids are listed', () => {
  const { ids, warnings } = parseManifest('# Books\n');
  assert.deepEqual(ids, []);
  assert.deepEqual(warnings, ['manifest: no book ids found']);
});
