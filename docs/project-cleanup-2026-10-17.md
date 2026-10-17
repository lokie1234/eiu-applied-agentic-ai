# JS lessons and project cleanup

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

Validation: full Node test suite, TypeScript, ESLint, Next production build, and compiled lesson hash comparison.

## Dependency validation

Updated Next.js and its matching ESLint config from 16.3.4 to 16.3.8, then applied compatible transitive updates. See the [official security release](https://github.com/vercel/next.js/releases/tag/v16.3.8). `npm audit --omit=dev` now reports zero vulnerabilities for the web production dependency tree. The full audit still reports five high entries in one development-only chain (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). Its suggested forced remediation downgrades the Next lint configuration to 14.x; this incompatible change was not applied. This is a known tooling limitation, not a claim that the dependency audit is entirely clean.
