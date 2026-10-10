Built-in Agentic AI sections can be saved as self-contained TSX presentation snapshots with the outbound Drive icon in course setup. Choose a saved Drive destination first. Exporting keeps the built-in lesson and its attachments unchanged.

The snapshots contain slide markup, CSS, embedded images and fonts. They work in the existing uploaded TSX frame without imports or network access. React state, live dashboards, submission handlers and quizzes stay in the original web lesson. The current exports contain 38 presentation slides for section 1 and 37 for section 2.

After changing built-in slides, regenerate the export assets from a running development server:

```powershell
# Playwright must be available to the generator. Optionally specify
# PLAYWRIGHT_MODULE and CHROMIUM_PATH for an existing installation.
node scripts/generate-builtin-tsx.cjs
node --test tests/builtin-drive-export.test.mjs
```

Commit both generated files in `lib/drive/builtin-decks` with slide changes. `next.config.ts` includes them in the export API deployment. The generator defaults to `http://localhost:3000`; set `EXPORT_ORIGIN` to another local server address when needed.
