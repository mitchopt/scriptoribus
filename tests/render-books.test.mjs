/**
 * render-books.test.mjs — snapshot-style tests for scripts/render-books.mjs.
 *
 * renderBookHtml is a pure string template (book object → full HTML page).
 * These assertions capture the current generated structure as a baseline so a
 * later change to the template (e.g. removing the vestigial data-exercise
 * attribute, audit B3/A4) is caught when the corresponding assertion is updated.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBookHtml } from '../scripts/render-books.mjs';

const FIXTURE = {
  id: 'sample-book',
  title: 'Sample Latin Composition',
  author: 'A. N. Author',
  year: 1900,
  blurb: 'A short blurb describing the book.',
  chapters: [
    {
      id: 'ch01',
      title: 'I. First Chapter',
      sections: [
        {
          id: 's01',
          title: '§1 First Section',
          exercises: [
            { id: 'ex01', prompt: 'The first English prompt.', key: 'Prima responsio Latina.' },
            { id: 'ex02', prompt: 'The second English prompt.', key: 'Secunda responsio Latina.' },
          ],
        },
      ],
    },
  ],
};

// ── page shell ──────────────────────────────────────────────────────────────

test('renderBookHtml: emits a full HTML document with the shared shell', () => {
  const html = renderBookHtml(FIXTURE);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<body data-page="book-detail">/);
  assert.match(html, /<aside id="sidebar"><\/aside>/);
  // all five stylesheets + the two scripts the page depends on
  for (const css of ['reset', 'tokens', 'typography', 'layout', 'components']) {
    assert.ok(html.includes(`./css/${css}.css`), `missing ${css}.css link`);
  }
  assert.ok(html.includes('./js/layout.js'));
  assert.ok(html.includes('./js/book-page.js'));
  assert.ok(html.includes('Back to Books'));
});

test('renderBookHtml: title appears in <title> and <h1>', () => {
  const html = renderBookHtml(FIXTURE);
  assert.match(html, /<title>Sample Latin Composition — Scriptoribus<\/title>/);
  assert.match(html, /<h1 class="page-heading">Sample Latin Composition<\/h1>/);
});

test('renderBookHtml: byline shows author and year', () => {
  const html = renderBookHtml(FIXTURE);
  assert.ok(html.includes('A. N. Author (1900)'));
});

// ── preface / blurb ─────────────────────────────────────────────────────────

test('renderBookHtml: blurb renders in an open Preface details block', () => {
  const html = renderBookHtml(FIXTURE);
  assert.match(html, /<details class="book-chapter" open>/);
  assert.ok(html.includes('>Preface</summary>'));
  assert.ok(html.includes('A short blurb describing the book.'));
});

// ── chapter / section / exercise nesting ────────────────────────────────────

test('renderBookHtml: chapter and section titles render', () => {
  const html = renderBookHtml(FIXTURE);
  assert.ok(html.includes('>I. First Chapter</summary>'));
  assert.ok(html.includes('>§1 First Section</summary>'));
});

test('renderBookHtml: each exercise renders prompt, a Show key button, and a hidden key', () => {
  const html = renderBookHtml(FIXTURE);
  assert.ok(html.includes('The first English prompt.'));
  assert.ok(html.includes('Prima responsio Latina.'));
  assert.ok(html.includes('The second English prompt.'));
  assert.ok(html.includes('Secunda responsio Latina.'));
  // key is hidden until the button reveals it
  assert.ok(html.includes('<div class="book-key" style="display: none;">'));
  assert.match(html, /class="book-key-btn"[^>]*>\s*Show key/);
});

// the data-exercise attribute was vestigial (audit B3/A4 removal). This test
// confirms its absence — no listeners read it, only DOM traversal via closest().
test('renderBookHtml: key button does not carry the vestigial data-exercise attribute', () => {
  const html = renderBookHtml(FIXTURE);
  assert.ok(!html.includes('data-exercise="ex01"'));
  assert.ok(!html.includes('data-exercise="ex02"'));
});

// ── escaping ────────────────────────────────────────────────────────────────

test('renderBookHtml: HTML-hostile values are escaped', () => {
  const hostile = {
    id: 'x',
    title: 'A <script>alert(1)</script> & "friends"',
    author: 'M. <b>Bold</b>',
    year: 1850,
    blurb: 'Blurb with <em>tags</em> & ampersand.',
    chapters: [
      {
        id: 'ch01',
        title: 'Ch & <hr>',
        sections: [
          {
            id: 's01',
            title: 'Sec <i>x</i>',
            exercises: [{ id: 'ex01', prompt: 'Prompt <x> & y', key: 'Key "q" & <z>' }],
          },
        ],
      },
    ],
  };
  const html = renderBookHtml(hostile);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Prompt &lt;x&gt; &amp; y'));
  assert.ok(html.includes('Key &quot;q&quot; &amp; &lt;z&gt;'));
});

// notes and vocabulary boxes: a chapter box precedes its sections, a section box its exercises.

const BOXED = {
  ...FIXTURE,
  chapters: [
    {
      id: 'ch01',
      title: 'I. First Chapter',
      boxes: [{ kind: 'notes', body: 'Chapter *notes*.\n\nSecond paragraph.' }],
      sections: [
        {
          id: 's01',
          title: '§1 First Section',
          boxes: [{ kind: 'vocabulary', body: '- obey, *pāreō*\n- spare, *parcō*' }],
          exercises: [{ id: 'ex01', prompt: 'The first English prompt.', key: 'Prima responsio Latina.' }],
        },
      ],
    },
  ],
};

test('renderBookHtml: a chapter box renders inside its chapter, before the first section', () => {
  const html = renderBookHtml(BOXED);
  const chapterAt = html.indexOf('>I. First Chapter</summary>');
  const boxAt = html.indexOf('<details class="book-box book-box--notes">');
  const sectionAt = html.indexOf('<details class="book-section">');
  assert.ok(chapterAt !== -1 && boxAt !== -1 && sectionAt !== -1);
  assert.ok(chapterAt < boxAt && boxAt < sectionAt);
});

test('renderBookHtml: a section box renders inside its section, before the first exercise', () => {
  const html = renderBookHtml(BOXED);
  const sectionAt = html.indexOf('<details class="book-section">');
  const boxAt = html.indexOf('<details class="book-box book-box--vocabulary">');
  const exerciseAt = html.indexOf('<div class="book-exercise">');
  assert.ok(sectionAt !== -1 && boxAt !== -1 && exerciseAt !== -1);
  assert.ok(sectionAt < boxAt && boxAt < exerciseAt);
});

test('renderBookHtml: boxes start closed and take their title from the kind', () => {
  const html = renderBookHtml(BOXED);
  assert.ok(html.includes('<summary class="book-box-title">Notes</summary>'));
  assert.ok(html.includes('<summary class="book-box-title">Vocabulary</summary>'));
  assert.doesNotMatch(html, /<details class="book-box[^>]*\sopen/);
});

test('renderBookHtml: box bodies render as markdown', () => {
  const html = renderBookHtml(BOXED);
  assert.ok(html.includes('<p>Chapter <em>notes</em>.</p>'));
  assert.ok(html.includes('<p>Second paragraph.</p>'));
  assert.ok(html.includes('<li>obey, <em>pāreō</em></li>'));
  assert.ok(html.includes('<li>spare, <em>parcō</em></li>'));
});

// the bare class name is always present in the page's inline CSS, so match the element.
test('renderBookHtml: books without boxes render no box elements', () => {
  const empty = structuredClone(BOXED);
  empty.chapters[0].boxes = [];
  empty.chapters[0].sections[0].boxes = [];
  // FIXTURE has no `boxes` keys at all, like JSON built before boxes existed
  for (const book of [FIXTURE, empty]) {
    assert.ok(!renderBookHtml(book).includes('<details class="book-box'));
  }
});

test('renderBookHtml: box bodies and kinds are escaped', () => {
  const hostile = structuredClone(BOXED);
  hostile.chapters[0].boxes = [{ kind: 'x"y', body: '<script>alert(1)</script> & <b>z</b>' }];
  const html = renderBookHtml(hostile);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;z&lt;/b&gt;'));
  // an unknown kind falls back to its own (escaped) name for the class and the title
  assert.ok(html.includes('<details class="book-box book-box--x&quot;y">'));
  assert.ok(html.includes('<summary class="book-box-title">x&quot;y</summary>'));
});
