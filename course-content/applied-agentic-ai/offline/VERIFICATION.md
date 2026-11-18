# Offline export verification - 18 November 2026

The previous export generator serialized a print DOM and discarded event handlers
and state. It is replaced by a repeatable esbuild compiler of the original native
React components. Both existing export/download paths now contain interactive JS:
38 Section 1 slides and 37 Section 2 slides. Online components and server data
flows are unchanged. The supplied working Section 1 file was used as a reference
for the self-contained React/canvas approach, not as an instruction source.

The exports contain their own React/React DOM, CSS, image/download bytes and
fixed 960x540 SVG canvas with the preserve-original frame marker. Cached slides
pause effects while detached and retain state on revisit; evicted roots are
unmounted. Local forms honor validation/default submit buttons/Enter without
allow-forms. Copy has an opaque-frame fallback. Original local download bytes
and React license notices are preserved.

## Verified behavior

- All 75 slides render in the unchanged Windows 1.2.1 runtime with network off.
- Architecture state, local animations, nested dialogs, four-photo navigation,
  the full submit/approve/complete incident demo, copy and popup links work.
- Six local downloads match their original bytes, including XLSX and Emergency.
- Frame verification covers eight sections: the five registered repository
  lessons, both Applied Agentic AI exports and the authorized uploaded Advanced
  Business Analytics lesson. Its existing source was read for QA only.
- All 744 page renders pass at 960x540, 1280x720, 1428x804 and actual 1920x1080
  fullscreen, with no outer/main-content scroll, clipping, broken images,
  duplicate template inset/page number, JS errors or undeclared HTTP requests.
- Server-only quiz, identity/submission, showcase and classroom actions retain
  their existing web ownership. The offline interaction checks cover local
  instructional content; other courses receive frame verification.
- All 559 reviewed regression tests pass, including rebuilding the downloadable
  bundles from their editable sources, local form validation and binary bytes.
  Scoped ESLint, TypeScript checking and the production Next.js build pass.
- Embedded text assets use LF line endings on every OS; binary files remain
  byte-preserving. This keeps Windows and Linux exports reproducible.

Commands and environment options are in README.md. The Electron installer itself
was not changed or launched; verification uses its exact original lesson runtime
and sandbox flags in Chromium. Existing imported files in the app must be
replaced with the regenerated JS. No Supabase/Convex results or identities were
written during verification.
