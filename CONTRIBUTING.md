# Contributing to Scriptoribus

## Scope

Accepted contributions: idioms, grammar constructions, composition topics, exercise templates, names, links, images, and books.

Code and structure changes (HTML, CSS, JavaScript, build scripts) are the maintainer's domain.

---

## Workflow

1. Fork the repository.
2. Make your changes on a branch in your fork.
3. Open a pull request **targeting `dev`** (not `main`).
4. CI must pass before the PR can be merged.

---

## What to edit

**Never edit files under `data/categories/`, `data/books/`, or `data/site/` directly — they are generated.** Edit the markdown sources in `data/raw_md/`, then run `npm run build` to regenerate.

The only hand-authored JSON file is `data/images/manifest.json`.

---

## Source formats

### Idioms — `data/raw_md/idioms.md`

Each idiom is a `#` H1 block. `**Category:**` and `**Meaning:**` are required. `**Inflection:**` should be `fixed` or `flexible`.

A `**Note:**` may span multiple lines: everything after it is part of the note until the next `**Field:**`, the `**Examples:**` label, a `>` example, or the next `#` idiom. Separate note paragraphs with a blank line.

```markdown
# mihi videtur

**Category:** Verbs of Saying

**Meaning:** it seems to me

**Inflection:** flexible

**Note:** The dative can vary: *tibi videtur*, *ei videtur*.

**Examples:**
> Cicero, *De Amicitia* 6.20: "Mihi quidem ita videtur."
```

---

### Grammar — `data/raw_md/grammar.md`

Each construction is a `#` H1 block. `**Category:**` is required. `**Link:**` takes a markdown link wrapped in parentheses.

```markdown
# Possessive Genitive

**Category:** Genitive Constructions

**Link:** ([A&G §343](https://dcc.dickinson.edu/grammar/latin/genitive))

**Note:** The genitive noun names the possessor.

**Latin Expression:** *liber magistri* — the teacher's book
```

---

### Composition topics — `data/raw_md/topics.md`

Categories open with a `**bold**` line; entries are `- ` dash-list items. `#` headings are organisational and ignored by the parser.

```markdown
**Greeting people**
- Greet a family member in the morning
- Greet a friend you haven't seen for a long time
```

---

### Exercise templates — `data/raw_md/templates.md`

Each template is a `#` H1 block. `**Category:**`, `**Summary:**`, and `**Description:**` are all required.

```markdown
# Renarratio

**Category:** progymnasmata

**Summary:** Retell a fable or narrative in your own words.

**Description:** The first element of the ancient Progymnasmata. See https://en.wikipedia.org/wiki/Progymnasmata
```

---

### Links — `data/raw_md/links.md`

Each link is a `#` H1 block. `**URL:**` and `**Description:**` are required. For a thumbnail, add a square PNG to `data/link_thumbnails/` and reference it.

```markdown
# Latin Library

**URL:** https://www.thelatinlibrary.com

**Description:** Plain-text corpus of classical Latin authors.

**Thumbnail:** latin-library.png
```

---

### Names — `data/raw_md/names.md`

Categories open with a `**bold**` line; entries are `- ` dash-list items.

```markdown
**Cognomina**
- Africanus
- Brutus
- Caesar
```

---

### Images — `data/images/manifest.json`

Add an entry to the manifest and place the image file in `data/images/`. Images must be public domain.

```json
{
  "id": "img099",
  "file": "my-image.jpg",
  "name": "Descriptive title matching the filename",
  "description": "One or two sentences about the scene.",
  "credit": "Wikimedia Commons, public domain (Painter Name)",
  "link": "https://commons.wikimedia.org/wiki/File:...",
  "category": "Early / Mythic Roman History",
  "topic": "Short scene label for the gallery heading"
}
```

IDs must be unique. Use the next available `img###` in sequence.

---

### Books — `data/raw_md/books/`

1. Create `data/raw_md/books/<id>.md` following the structure of an existing book file.
2. Append the ID to `data/raw_md/books/manifest.md`.
3. Run `npm run build`.
4. Commit the markdown source, the generated JSON (`data/books/<id>.json` and `manifest.json`), and the generated HTML (`book-<id>.html`).

Books must be public domain (typically published before 1928 in the US).

---

## Build & preview

After editing a markdown source, regenerate JSON:

```bash
npm run build
```

Preview the site locally:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly via `file://` may fail for pages that use `fetch()`.

Commit **both** the markdown source and the generated JSON. CI will reject a PR where they are out of sync.

---

## CI checks

Three named checks run on every PR:

| Check | Command | What it catches |
|---|---|---|
| `test` | `npm test` | Broken pure logic |
| `validate-data` | `npm run validate` | Markdown/JSON out of sync; invalid IDs; missing files |
| `build-clean` | `npm run build:strict` + `git diff --exit-code` | Uncommitted generated output; parser warnings |

A failure message includes a line number and a description of what's wrong.

---

## Gotchas

**Smart quotes.** Word processors auto-replace `"..."` with `"..."`. The parser expects straight quotes. Use a plain text editor or GitHub's web editor.

**Latin characters.** Macrons (`ā ē ī ō ū`) are fine — the files are UTF-8. Do not use HTML entities.
