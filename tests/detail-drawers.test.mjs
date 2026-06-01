/**
 * tests for the shared detail-drawer renderers (js/detail-drawers.js).
 *
 * String-assertion style (no DOM), matching tests/render-books.test.mjs: each
 * renderer is pure (item in, HTML string out), so we assert on the markup.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderTopicDrawer,
  renderGrammarDrawer,
  renderIdiomDrawer,
  renderTemplateDrawer,
  renderImageDrawer,
} from '../js/detail-drawers.js';

// renderTopicDrawer

test('renderTopicDrawer: title, category badge, and notes when present', () => {
  const html = renderTopicDrawer({ id: 't1', name: 'A Day in Rome', category: 'Daily Life', notes: 'Describe the forum.' });
  assert.match(html, /class="drawer-title">A Day in Rome</);
  assert.match(html, /class="badge badge--category">Daily Life</);
  assert.match(html, /drawer-section-label">Notes</);
  assert.match(html, /A Day in Rome|Describe the forum\./);
  assert.match(html, /class="drawer-close-btn"/);
});

test('renderTopicDrawer: empty notes fall back to placeholder', () => {
  const html = renderTopicDrawer({ id: 't2', name: 'X', category: 'Y', notes: '' });
  assert.match(html, /No additional notes\./);
});

test('renderTopicDrawer: TODO notes fall back to placeholder', () => {
  const html = renderTopicDrawer({ id: 't3', name: 'X', category: 'Y', notes: 'TODO' });
  assert.match(html, /No additional notes\./);
  assert.doesNotMatch(html, /drawer-section-label">Notes</);
});

test('renderTopicDrawer: escapes HTML in fields', () => {
  const html = renderTopicDrawer({ id: 't4', name: '<b>x</b>', category: 'A & B', notes: '' });
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /A &amp; B/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});

// renderGrammarDrawer

test('renderGrammarDrawer: renders notes, latin expression, and reference links', () => {
  const html = renderGrammarDrawer({
    id: 'g1', name: 'Ablative Absolute', category: 'Ablative',
    notes: 'A *participial* construction.', latinExpression: 'urbe capta',
    links: [{ text: 'A&G §419', url: 'https://example.com/ag' }],
  });
  assert.match(html, /drawer-section-label">Notes</);
  // inlineItalics converts *participial* -> <em>participial</em>
  assert.match(html, /<em>participial<\/em>/);
  assert.match(html, /drawer-section-label">Latin Expression</);
  assert.match(html, /<em>urbe capta<\/em>/);
  assert.match(html, /drawer-section-label">References</);
  assert.match(html, /href="https:\/\/example\.com\/ag"[^>]*>A&amp;G §419</);
});

test('renderGrammarDrawer: all fields empty/TODO yields the no-details placeholder', () => {
  const html = renderGrammarDrawer({ id: 'g2', name: 'Bare', category: 'C', notes: 'TODO', latinExpression: '', links: [] });
  assert.match(html, /No additional details yet\./);
});

test('renderGrammarDrawer: tolerates a missing links field', () => {
  const html = renderGrammarDrawer({ id: 'g3', name: 'N', category: 'C', notes: 'Real note.' });
  assert.match(html, /Real note\./);
  assert.doesNotMatch(html, /drawer-section-label">References</);
});

test('renderGrammarDrawer: link without text falls back to the url', () => {
  const html = renderGrammarDrawer({ id: 'g4', name: 'N', category: 'C', notes: '', latinExpression: '', links: [{ url: 'https://example.com/x' }] });
  assert.match(html, />https:\/\/example\.com\/x</);
});

test('renderGrammarDrawer: italics render in the construction name', () => {
  const html = renderGrammarDrawer({ id: 'g5', name: 'Genitive with Adjectives (*cupidus*, *perītus*)', category: 'Genitive', notes: '', latinExpression: '', links: [] });
  assert.match(html, /<em>cupidus<\/em>/);
  assert.match(html, /<em>perītus<\/em>/);
  assert.doesNotMatch(html, /\*cupidus\*/);
});

// renderIdiomDrawer

test('renderIdiomDrawer: latin, gloss, inflection badge, and examples', () => {
  const html = renderIdiomDrawer({
    id: 'i1', latin: 'mihi videtur', gloss: 'it seems to me', category: 'Saying',
    inflection: 'flexible', notes: 'Dative can vary.',
    examples: [{ citation: 'Cicero, *Amic.* 6', quote: 'Mihi ita videtur.' }],
  });
  assert.match(html, /class="drawer-latin">mihi videtur</);
  assert.match(html, /class="drawer-gloss">it seems to me</);
  assert.match(html, /badge--flexible/);
  assert.match(html, /drawer-section-label">Notes</);
  assert.match(html, /drawer-section-label">Examples</);
  assert.match(html, /<em>Amic\.<\/em>/); // citation italics
  assert.match(html, /Mihi ita videtur\./);
});

test('renderIdiomDrawer: no examples shows placeholder; absent notes omits notes section', () => {
  const html = renderIdiomDrawer({ id: 'i2', latin: 'x', gloss: 'y', category: 'C', inflection: 'fixed', notes: '', examples: [] });
  assert.match(html, /No examples recorded\./);
  assert.doesNotMatch(html, /drawer-section-label">Notes</);
  assert.match(html, /badge--fixed/);
});

test('renderIdiomDrawer: unknown inflection falls back to the TODO badge', () => {
  const html = renderIdiomDrawer({ id: 'i3', latin: 'x', gloss: 'y', category: 'C', inflection: '', examples: [] });
  assert.match(html, /badge--todo/);
});

test('renderIdiomDrawer: italics render in notes and gloss', () => {
  const html = renderIdiomDrawer({
    id: 'i4', latin: 'ut verum dicam', gloss: 'to *tell* the truth', category: 'Emphasis',
    inflection: 'fixed', notes: '*dicam* may technically inflect.', examples: [],
  });
  assert.match(html, /<em>dicam<\/em> may technically inflect\./);
  assert.match(html, /to <em>tell<\/em> the truth/);
  assert.doesNotMatch(html, /\*dicam\*/);
});

// renderTemplateDrawer

test('renderTemplateDrawer: description with auto-linked URL and italics', () => {
  const html = renderTemplateDrawer({
    id: 'tpl1', name: 'Renarratio', category: 'variatio',
    description: 'Retell *a fable*. See https://en.wikipedia.org/wiki/Progymnasmata',
  });
  assert.match(html, /class="drawer-title">Renarratio</);
  assert.match(html, /drawer-section-label">Description</);
  assert.match(html, /<em>a fable<\/em>/);
  assert.match(html, /<a [^>]*href="https:\/\/en\.wikipedia\.org\/wiki\/Progymnasmata"/);
});

test('renderTemplateDrawer: escapes HTML in the name', () => {
  const html = renderTemplateDrawer({ id: 'tpl2', name: '<x>', category: 'c', description: 'd' });
  assert.match(html, /&lt;x&gt;/);
});

// renderImageDrawer

const sampleImage = {
  id: 'img1',
  file: 'aeneas.jpg',
  name: 'Aeneas fleeing Troy',
  topic: 'Aeneas carrying Anchises',
  category: 'Mythic History',
  description: 'A painting of Aeneas.',
  credit: 'Wikimedia Commons, public domain',
  link: 'https://commons.wikimedia.org/wiki/File:Aeneas.jpg',
};

test('renderImageDrawer: heading is the topic, with category badge and clickable image', () => {
  const html = renderImageDrawer(sampleImage);
  assert.match(html, /class="drawer-title">Aeneas carrying Anchises</);
  assert.match(html, /class="badge badge--category">Mythic History</);
  assert.match(html, /class="drawer-image-btn"/);
  assert.match(html, /src="\.\/data\/images\/aeneas\.jpg"/);
  assert.match(html, /class="drawer-close-btn"/);
});

test('renderImageDrawer: renders description, credit, and Wikimedia link', () => {
  const html = renderImageDrawer(sampleImage);
  assert.match(html, /A painting of Aeneas\./);
  assert.match(html, /<strong>Credit:<\/strong> Wikimedia Commons, public domain/);
  assert.match(html, /href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Aeneas\.jpg"[^>]*>[\s\S]*View source on Wikimedia/);
});

test('renderImageDrawer: shows "Original title" only when name differs from topic', () => {
  const differing = renderImageDrawer(sampleImage);
  assert.match(differing, /Original title: Aeneas fleeing Troy/);

  const same = renderImageDrawer({ ...sampleImage, name: 'Aeneas carrying Anchises' });
  assert.doesNotMatch(same, /Original title:/);
});

test('renderImageDrawer: falls back to name then "Untitled" for the heading', () => {
  const noTopic = renderImageDrawer({ id: 'i', file: 'x.jpg', name: 'Just a name' });
  assert.match(noTopic, /class="drawer-title">Just a name</);

  const bare = renderImageDrawer({ id: 'i', file: 'x.jpg' });
  assert.match(bare, /class="drawer-title">Untitled</);
});

test('renderImageDrawer: carries no "Open in workspace" button', () => {
  const html = renderImageDrawer(sampleImage);
  assert.doesNotMatch(html, /Open in workspace/);
});

test('renderImageDrawer: escapes HTML in fields', () => {
  const html = renderImageDrawer({ id: 'i', file: 'x.jpg', topic: '<b>t</b>', name: 'n', description: 'A & B' });
  assert.match(html, /&lt;b&gt;t&lt;\/b&gt;/);
  assert.match(html, /A &amp; B/);
});

test('renderImageDrawer: italics render in the description', () => {
  const html = renderImageDrawer({ ...sampleImage, description: 'A scene from the *Aeneid*.' });
  assert.match(html, /A scene from the <em>Aeneid<\/em>\./);
  assert.doesNotMatch(html, /\*Aeneid\*/);
});
