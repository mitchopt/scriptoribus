import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, renderInline } from '../scripts/render-markdown.mjs';

// ── renderInline ──────────────────────────────────────────────────────────────

test('renderInline: plain text passes through', () => {
  assert.equal(renderInline('hello world'), 'hello world');
});

test('renderInline: HTML special chars are escaped', () => {
  assert.equal(renderInline('a & b'), 'a &amp; b');
  assert.equal(renderInline('<br>'), '&lt;br&gt;');
  assert.equal(renderInline('"quote"'), '&quot;quote&quot;');
});

test('renderInline: bold (**text**)', () => {
  assert.equal(renderInline('**bold**'), '<strong>bold</strong>');
});

test('renderInline: bold with surrounding text', () => {
  assert.equal(renderInline('a **bold** b'), 'a <strong>bold</strong> b');
});

test('renderInline: italic (*text*)', () => {
  assert.equal(renderInline('*italic*'), '<em>italic</em>');
});

test('renderInline: italic with surrounding text', () => {
  assert.equal(renderInline('a *italic* b'), 'a <em>italic</em> b');
});

test('renderInline: citation italic (Cicero, *Pro Quinctio* 77)', () => {
  const result = renderInline('Cicero, *Pro Quinctio* 77');
  assert.equal(result, 'Cicero, <em>Pro Quinctio</em> 77');
});

test('renderInline: italic underscore (_text_)', () => {
  assert.equal(renderInline('_italic_'), '<em>italic</em>');
});

test('renderInline: code span (`code`)', () => {
  assert.equal(renderInline('`code`'), '<code>code</code>');
});

test('renderInline: code span escapes HTML inside', () => {
  assert.equal(renderInline('`<br>`'), '<code>&lt;br&gt;</code>');
});

test('renderInline: code span suppresses bold inside', () => {
  assert.equal(renderInline('`**not bold**`'), '<code>**not bold**</code>');
});

test('renderInline: link ([text](url))', () => {
  assert.equal(
    renderInline('[click here](https://example.com)'),
    '<a href="https://example.com">click here</a>'
  );
});

test('renderInline: relative link', () => {
  assert.equal(
    renderInline('[Contributing Guide](../CONTRIBUTING.md)'),
    '<a href="../CONTRIBUTING.md">Contributing Guide</a>'
  );
});

test('renderInline: bold and italic in same string', () => {
  const result = renderInline('**bold** and *italic*');
  assert.equal(result, '<strong>bold</strong> and <em>italic</em>');
});

// ── renderMarkdown — block elements ──────────────────────────────────────────

test('renderMarkdown: h1', () => {
  assert.equal(renderMarkdown('# Heading One').trim(), '<h1>Heading One</h1>');
});

test('renderMarkdown: h2', () => {
  assert.equal(renderMarkdown('## Heading Two').trim(), '<h2>Heading Two</h2>');
});

test('renderMarkdown: h3', () => {
  assert.equal(renderMarkdown('### Three').trim(), '<h3>Three</h3>');
});

test('renderMarkdown: h4 through h6', () => {
  assert.ok(renderMarkdown('#### Four').includes('<h4>Four</h4>'));
  assert.ok(renderMarkdown('##### Five').includes('<h5>Five</h5>'));
  assert.ok(renderMarkdown('###### Six').includes('<h6>Six</h6>'));
});

test('renderMarkdown: heading preserves inline formatting', () => {
  assert.ok(renderMarkdown('# **Bold** Title').includes('<h1><strong>Bold</strong> Title</h1>'));
});

test('renderMarkdown: paragraph', () => {
  assert.equal(renderMarkdown('hello world').trim(), '<p>hello world</p>');
});

test('renderMarkdown: paragraph with bold', () => {
  assert.ok(renderMarkdown('**bold** text').includes('<p><strong>bold</strong> text</p>'));
});

test('renderMarkdown: two paragraphs separated by blank line', () => {
  const html = renderMarkdown('first\n\nsecond');
  assert.ok(html.includes('<p>first</p>'));
  assert.ok(html.includes('<p>second</p>'));
});

test('renderMarkdown: multi-line paragraph merges into one <p>', () => {
  const html = renderMarkdown('line one\nline two');
  assert.ok(html.includes('<p>'));
  assert.ok(html.includes('line one'));
  assert.ok(html.includes('line two'));
  assert.ok(!html.includes('<p>line one</p>'), 'should not close p between continuation lines');
});

test('renderMarkdown: unordered list (- items)', () => {
  const html = renderMarkdown('- one\n- two\n- three');
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('<li>one</li>'));
  assert.ok(html.includes('<li>two</li>'));
  assert.ok(html.includes('<li>three</li>'));
  assert.ok(html.includes('</ul>'));
});

test('renderMarkdown: unordered list (* items)', () => {
  const html = renderMarkdown('* alpha\n* beta');
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('<li>alpha</li>'));
});

test('renderMarkdown: list item with inline bold', () => {
  const html = renderMarkdown('- **key**: value');
  assert.ok(html.includes('<li><strong>key</strong>: value</li>'));
});

test('renderMarkdown: ordered list', () => {
  const html = renderMarkdown('1. first\n2. second\n3. third');
  assert.ok(html.includes('<ol>'));
  assert.ok(html.includes('<li>first</li>'));
  assert.ok(html.includes('<li>second</li>'));
  assert.ok(html.includes('</ol>'));
});

test('renderMarkdown: blockquote', () => {
  const html = renderMarkdown('> quoted text');
  assert.ok(html.includes('<blockquote>'));
  assert.ok(html.includes('quoted text'));
  assert.ok(html.includes('</blockquote>'));
});

test('renderMarkdown: horizontal rule (---)', () => {
  assert.ok(renderMarkdown('---').includes('<hr>'));
});

test('renderMarkdown: horizontal rule (***)', () => {
  assert.ok(renderMarkdown('***').includes('<hr>'));
});

test('renderMarkdown: heading followed by paragraph', () => {
  const html = renderMarkdown('# Title\n\nParagraph text.');
  assert.ok(html.includes('<h1>Title</h1>'));
  assert.ok(html.includes('<p>Paragraph text.</p>'));
});

test('renderMarkdown: heading then list then paragraph', () => {
  const md = '## Section\n\n- item one\n- item two\n\nTrailing paragraph.';
  const html = renderMarkdown(md);
  assert.ok(html.includes('<h2>Section</h2>'));
  assert.ok(html.includes('<li>item one</li>'));
  assert.ok(html.includes('<p>Trailing paragraph.</p>'));
});

test('renderMarkdown: link in paragraph', () => {
  const html = renderMarkdown('Visit [example](https://example.com) today.');
  assert.ok(html.includes('<a href="https://example.com">example</a>'));
});

test('renderMarkdown: empty string returns empty string', () => {
  assert.equal(renderMarkdown('').trim(), '');
});
