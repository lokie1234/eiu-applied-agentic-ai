# Applied Agentic AI offline exports

Run `npm run build:offline` (or `node scripts/generate-builtin-tsx.cjs`) to replace the existing downloadable
`lib/drive/builtin-decks/section1.js` and `section2.js` files. The authorized
content/download route and Drive export already read these exact files.
`npm run build:offline` is an alias for the same repeatable build.

The compiler bundles the original React components, their CSS Modules, React,
React DOM, dynamic imports, and original public assets into CommonJS JS.
The player still sees the usual `exports.default` array of lazy slide factories.
The original 960 × 540 canvas and branding remain intact. Click handlers,
animations, dialogs, galleries, local workflow demos, copy, downloads and
external links remain executable.

Server-only quiz, idea submission/results and showcase slides remain outside
the existing offline export. Section 1 retains its 38 exported content slides; Section 2
retains 37. External websites opened by links still need internet access.
No learner/result store, identity form, API client or realtime connection is added.

Only the export build substitutes Next Image with an embedded image and supplies
the configured Emergency download (text or ZIP) from its original local bytes. Clipboard
copy falls back inside an opaque sandbox. Website components and live
Supabase/Convex flows are unchanged.

For separately supplied lesson files with a matching source checkout, the
compiler also exports `buildSection(section, {sourceRoot, outputDir})`. This
preserves the source checkout's current content list and assets without
replacing the repository's native course components. The source's Emergency
route determines which file to embed; binary ZIP downloads are not decoded as
text. The closing voucher form, when present, explains that registration needs
the web app; the original local LIVE DEMOs remain available in full.

Regression coverage: `node --test tests/builtin-drive-export.test.mjs
tests/builtin-offline-interactions.test.mjs`. Browser QA is
`node scripts/verify-builtin-offline.cjs` with `PLAYWRIGHT_MODULE` pointing to a
Playwright installation and `CHROMIUM_PATH` to a local Chromium browser. It uses
the original Windows 1.2.1 runtime fixture with network disabled, verifies all
75 slides, click animations, popup/gallery navigation, the local incident
workflow, clipboard fallback, popup links, and downloaded bytes.


## Required acceptance checks

Use the installed Chrome on Windows, set CHROMIUM_PATH explicitly, or install
Chromium with `npx playwright install chromium` on other systems. Then run:

```
npm run build:offline
npm run verify:offline
npm run verify:templates
node --test tests/builtin-drive-export.test.mjs tests/builtin-offline-interactions.test.mjs tests/builtin-offline-download.test.mjs tests/offline-form.test.mjs
```

The interaction verifier checks all 75 slides in the original Windows sandbox,
with the host template enabled and network disabled. It exercises actual event
handlers, cache detach/revisit, animations, modal/photo navigation, local form
submission, clipboard fallback and exact download bytes.

The template verifier enumerates `course-content/sources.json` and both built-in
exports automatically. It checks root/main-canvas bounds, clipping, scrolling,
image loading, duplicate template insets and page numbers at 960x540, 1280x720,
1428x804 and actual 1920x1080 fullscreen. Intentional code/data panels can scroll;
the main slide canvas cannot. This is a frame check for other sections, not a
claim that authenticated classroom/quiz operations work without their server.

To include an authorized uploaded lesson, save its existing JS locally and set
OFFLINE_EXTRA_SECTIONS to a UTF-8 JSON file containing `[{"id":"actual-section-id","path":"path/to/lesson.js"}]`.
Never commit private uploaded lesson bytes or credentials. Resolve its effective
template from the current course/section configuration before comparing fit.
The source/behavior/acceptance rule also lives in the root AGENTS.md.
