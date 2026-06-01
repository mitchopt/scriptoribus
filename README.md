# Scriptoribus

[![Tests](https://github.com/mitchopt/scriptoribus/actions/workflows/test.yml/badge.svg)](https://github.com/mitchopt/scriptoribus/actions/workflows/test.yml)

A freely available resource hub for students of Latin prose composition, hosted on [GitHub Pages](https://pages.github.com).

Scriptoribus gathers grammatical constructions, idiomatic phrases, compositional prompts, and practical exercises in one interface. Content is held in plain Markdown and JSON files under `data/`, kept separate from presentation, so new entries can be added without touching HTML, CSS, or JavaScript.

---

## Local preview

No build step is required to browse the site locally. Serve the repository root with any static file server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

> **Note**: Opening `index.html` directly via `file://` will work for most pages, but `fetch()` calls are blocked by some browsers in `file://` mode. The `python -m http.server` approach is recommended.

---

## Build step

The build step regenerates data JSON from markdown sources and converts Markdown site content to HTML fragments. It is required after any change to `data/site/*.md`, `data/raw_md/*.md` (markdown sources for categories, names, links, books), or before committing changes to generated files.

**Prerequisites**: [Node.js](https://nodejs.org) version 18 or later.

```bash
npm run build
```

This runs `scripts/build.mjs`, which:
1. Rebuilds `data/categories/*.json` from markdown sources in `data/raw_md/`.
2. Rebuilds `data/books/*.json` from markdown sources in `data/raw_md/books/`.
3. Renders each `data/site/*.md` file to a sibling `*.html` fragment.
4. Generates `book-<id>.html` pages at the repository root for each book.

**Generated files are committed to git.** All JSON under `data/categories/` and `data/books/` is **generated from markdown — never edit JSON directly.** Edit the corresponding `data/raw_md/` markdown source instead, then run `npm run build` to regenerate.

---

## Running tests

```bash
npm test
```

Tests use Node's built-in test runner (`node --test`) and have no external dependencies.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the fork + PR workflow, markdown source formats, and examples for each content type.

**Quick start:** fork → edit `data/raw_md/*.md` → run `npm run build` → commit `.md` source and generated JSON → open PR to `dev`.

Images are the only hand-authored JSON: add an entry to `data/images/manifest.json` and place the file in `data/images/`

---

## Community & Governance

- **Have questions or ideas?** Start a discussion in [GitHub Discussions](https://github.com/mitchopt/scriptoribus/discussions).
- **Found an error?** Report it using the [issue template](https://github.com/mitchopt/scriptoribus/issues/new/choose).
- **Standards:** see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Licensing

- **Code** (HTML, CSS, JavaScript, scripts, tests): [MIT License](LICENSE)
- **Content** (idioms, grammar, composition prompts, etc.): [CC BY-SA 4.0](LICENSE-CONTENT)

---

## Deployment

Deployment is automated via GitHub Actions. The [`Deploy`](.github/workflows/deploy.yml)
workflow runs on every push to `main`: it rebuilds (`npm run build:strict`), validates
(`npm run validate`), stamps the build date into `version.json`, and publishes the whole
repository to GitHub Pages.

---

## Project structure

```
data/
  site/        Markdown source files for long-form page text
  categories/  JSON files for grammar, topics, idioms, templates, names, links
  images/      Image files + manifest.json
  books/       JSON files for each public-domain book + manifest.json
css/           Stylesheets
js/            JavaScript modules (one per page + shared utilities)
scripts/       Node build scripts (run via npm run build)
tests/         Node test files (run via npm test)
plan/          Project brief and implementation plan
```
