# JS lessons and EIU Lesson Player

The five standalone lesson files now ship as compiled CommonJS JavaScript. The initial conversion used the same ES2020 / h / Fragment compiler settings as the section API; `section-js-migration.json` records SHA-256 values of the exact former runtime output. Images, fonts, callbacks, popups and animation code were preserved. Section authorization and registered course/section IDs were not changed. React application components remain TypeScript/TSX.

Web Development authoring remains in `course-content/web-app-development/storyboard.json` and `renderer.tsx.txt`. Run `node scripts/build-web-app-course.cjs` to regenerate Section1.js and Section2.js. The renderer template is authoring input, not another runtime section. Pandas and built-in exports are now JS too. Legacy uploaded TSX remains readable; the database's `tsx` enum is retained for compatibility rather than rewriting production records or dropping old uploads.

## Audit and cleanup

- `node scripts/audit-project.cjs` scans tracked and new application source files for identical files and duplicate function declarations within a scope. The audit found no duplicate function declarations overriding one another. The downloadable standalone landing-page bot intentionally duplicates the application bot; it must remain independently usable.
- Removed runtime compilation for registered local sections and built-in Drive exports. Content and download now use the same JS bytes. Legacy compile caching remains because it supports old uploads, not an unnecessary duplicate implementation.
- Moved the SVG tag-name set out of the per-element factory, allocating it once per frame instead of once for every rendered node.
- Retain completed slide counts for unchanged sections when the catalog changes. Only changed/new revisions are counted again; cancellation and two-worker concurrency remain. Counts are discarded when the pane closes. No authenticated response or permission result is cached across users.
- The templates endpoint reuses its resolved session instead of checking a learner's session twice; admin reads still avoid the full course catalog.
- Removed a redundant render-time bot ref assignment: the transition callbacks already maintain the ref. Applied the same fix to the independently downloadable copy.
- Removed the downloadable landing page's initial saved-email effect, which duplicated the existing dialog-open read and caused an extra render. Saved email is still restored when opening the sign-in dialog.
- Removed tracked `tmp/` QA screenshots and scratch scripts. No course assets, reusable examples, source uploads, or user data were removed.
- Updated obsolete test expectations and browser mocks (observer APIs, eight energy rays, the redesigned count badge); current interfaces and animations remain intact.

## Desktop distribution

`desktop-player/` contains the Windows/macOS app. The shared `lib/tsxDocument.ts` renderer is generated into the desktop shell by `scripts/prepare-player.cjs`. Its legacy name remains to avoid gratuitous import/API churn; it renders JS. The EIU template is applied by default and respects `data-preserve-original` for fully designed lessons. The same Inter font and embedded slide assets are used offline. The practice ZIP is bundled; external web links, AI services and localhost demonstrations retain their connectivity requirements.

The shell has no Node integration, runs with context isolation/sandboxing, and keeps lesson code in an opaque-origin iframe without the native bridge. Native IPC is limited to the trusted main frame and a size-limited JS file chooser. Remote resource loading is disabled; explicitly opened HTTP(S) links go to the browser. Generic `.js` file defaults are not reassigned on installation.

The Windows ZIP contains a branded NSIS installer and Vietnamese instructions. macOS ZIPs contain an application bundle and instructions for Intel and Apple Silicon. `.github/workflows/lesson-player.yml` builds each platform on its native runner when `player-v*` is pushed. Initial builds are unsigned; no signing identity or notarization credential is configured. The download page is `/player` and is linked from the course library; section cards expose JS downloads.

Validation: full Node test suite, TypeScript, ESLint, Next production build, hash comparison, and native Windows Electron smoke test. The smoke test covers slide counts, real popup clicks, Claude design, iframe keyboard navigation, EIU template application, bridge isolation, and preservation of the current lesson on an invalid file. Screenshots remain local in `.local/player-qa/`.
