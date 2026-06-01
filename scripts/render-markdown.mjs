// hand-rolled Markdown -> HTML fragment converter.
// covers: h1-h6, paragraphs (multi-line), bold, italic (* and _), code spans,
// links, unordered lists, ordered lists, blockquotes, horizontal rules, html escaping.
// exported for unit testing; pure string -> string, no file I/O.

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// process inline markdown within a single text string.
// splits on code spans first (to protect their content from further processing),
// then applies links > bold > italic in non-code segments.
export function renderInline(text) {
  const segments = [];
  const codeRe = /`([^`]+)`/g;
  let last = 0;
  let m;

  while ((m = codeRe.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ code: false, s: text.slice(last, m.index) });
    }
    segments.push({ code: true, s: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ code: false, s: text.slice(last) });
  }

  return segments.map(seg => {
    if (seg.code) {
      return `<code>${escapeHtml(seg.s)}</code>`;
    }

    let t = escapeHtml(seg.s);

    // links processed before bold/italic so [] and () markers are intact
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) =>
      `<a href="${url}">${label}</a>`);

    // bold (**text**) - lazy match to handle adjacent pairs correctly
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // italic *text* - exclude * from content to avoid collisions with bold
    t = t.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

    // italic _text_ - word-boundary guard avoids matching snake_case words
    t = t.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, '<em>$1</em>');

    return t;
  }).join('');
}

// convert a Markdown string to an HTML fragment (no surrounding html/body tags).
export function renderMarkdown(md) {
  const lines = md.split('\n');
  let out = '';
  // state tracks the currently open block element; closeBlock writes the closing tag.
  let state = 'none'; // 'none' | 'para' | 'ul' | 'ol' | 'blockquote'

  function closeBlock() {
    if      (state === 'para')       { out += '</p>\n';          state = 'none'; }
    else if (state === 'ul')         { out += '</ul>\n';         state = 'none'; }
    else if (state === 'ol')         { out += '</ol>\n';         state = 'none'; }
    else if (state === 'blockquote') { out += '</blockquote>\n'; state = 'none'; }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === '') {
      closeBlock();
      continue;
    }

    // ATX heading: # through ######
    const headingM = line.match(/^(#{1,6})\s+(.*)/);
    if (headingM) {
      closeBlock();
      const level = headingM[1].length;
      out += `<h${level}>${renderInline(headingM[2])}</h${level}>\n`;
      continue;
    }

    // horizontal rule: --- or *** or ___ (line contains only those chars)
    if (/^(\*{3}|-{3}|_{3})$/.test(line.trim())) {
      closeBlock();
      out += '<hr>\n';
      continue;
    }

    // unordered list item: "- text" or "* text"
    const ulM = line.match(/^[*-]\s+(.*)/);
    if (ulM) {
      if (state !== 'ul') { closeBlock(); out += '<ul>\n'; state = 'ul'; }
      out += `<li>${renderInline(ulM[1])}</li>\n`;
      continue;
    }

    // ordered list item: "1. text"
    const olM = line.match(/^\d+\.\s+(.*)/);
    if (olM) {
      if (state !== 'ol') { closeBlock(); out += '<ol>\n'; state = 'ol'; }
      out += `<li>${renderInline(olM[1])}</li>\n`;
      continue;
    }

    // blockquote: "> text"
    const bqM = line.match(/^>\s?(.*)/);
    if (bqM) {
      if (state !== 'blockquote') { closeBlock(); out += '<blockquote>\n'; state = 'blockquote'; }
      out += `<p>${renderInline(bqM[1])}</p>\n`;
      continue;
    }

    // paragraph: accumulate until a blank line or new block.
    if (state === 'para') {
      // continuation line - append with a space (standard Markdown soft wrap)
      out += ' ' + renderInline(line);
    } else {
      closeBlock();
      out += `<p>${renderInline(line)}`;
      state = 'para';
    }
  }

  closeBlock();
  return out;
}
