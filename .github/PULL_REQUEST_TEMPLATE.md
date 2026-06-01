See [CONTRIBUTING.md](../CONTRIBUTING.md) for source formats and the workflow guide.

## Description

<!-- Briefly describe what you're contributing. Example: "Add 3 new idioms", "Fix typo in grammar.md" -->


## Type of Contribution

- [ ] New idioms
- [ ] New grammar constructions
- [ ] New composition prompts
- [ ] New exercise templates
- [ ] New links
- [ ] New names
- [ ] New images
- [ ] New book
- [ ] Bug fix or correction
- [ ] Other (please describe)

## Checklist

Before submitting, please verify:

- [ ] **Target branch is `dev`** (not `main`)
  - If this PR currently targets `main`, change it to `dev` before I can merge it
  - Only the maintainer merges from `dev` to `main` at release time
  
- [ ] **I edited only markdown/data sources**, not generated files
  - ✅ Good: edited `data/raw_md/idioms.md`, `data/raw_md/grammar.md`, etc.
  - ❌ Bad: edited `data/categories/*.json` or `*.html` (these are generated and will be overwritten)
  
- [ ] **No smart quotes or curly quotes**
  - Copy-paste from Word, Google Docs, or similar word processors auto-converts quotes to curly quotes (`""`), which breaks the build
  - Use a plain-text editor or GitHub's web editor instead
  
- [ ] **Content is public domain or properly attributed**
  - If you're adding citations, translations, or excerpts: confirm they're public domain or you have explicit permission to share
  - See `LICENSE-CONTENT` for details
  
- [ ] **I tested my changes locally** _(optional but encouraged)_
  - Ran `npm run build:strict && npm run validate`
  - Or: ran `python -m http.server` and previewed the site
  - If I didn't: I'm comfortable waiting for CI to catch any formatting issues

---

## Notes for Maintainer

<!-- Optional: any additional context or questions for the maintainer? -->


---
