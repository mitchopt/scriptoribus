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
