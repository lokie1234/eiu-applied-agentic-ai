# Project audit — 2026-10-21

## Landing page

- Replaced fixed hero/robot minimum heights with a viewport grid. Typography, navigation, spacing, and sign-in padding adapt to viewport height. Short layouts omit decorative metadata; very short screens and mobile keyboards retain scrolling so controls remain accessible.
- Removed inline headline sizing that overrode responsive CSS. The headline uses CSS perspective and shallow text-shadow extrusion in the existing navy/gold/blue palette.
- Sign-in uses restrained elevation, focus lighting, button feedback, and a short panel entrance. No animation dependency was added. Hover transforms require a fine pointer; reduced-motion rules disable the new movement.
- The robot fallback no longer overrides responsive positioning through inline styles. WebGL waits until the initial stage and does not mount for reduced motion or remain mounted after a scene failure.

## Duplication and unnecessary work

- `audit:project` scanned the repository's 402 tracked/unignored files before this report. It found no duplicate function declarations and one identical source pair: the live robot and the standalone downloadable landing-page robot. Both copies are required by their separate delivery paths.
- Reused `SignInCardProps` rather than maintaining a second copy of the form contract.
- Consolidated the repeated global logo rule, including width/height values that were immediately overridden. Removed an unused landing keyframe.
- Moved the PDF annotation stylesheet from the root layout into the PDF viewer so the initial landing route does not request viewer-only styles.
- Removed the artificial 1.5-second delay after a successful login. This removes a fixed client delay; it does not establish a measured improvement in server response time.
- The robot's error-reset timer is cancelled before retry and on unmount, preventing an earlier failure from resetting the robot during a later login.

## Application review

Reviewed the route configuration, dependencies, authentication path, refresh runner, landing WebGL lifecycle, PDF/PPTX lazy loading, source distribution, and existing performance regressions. Authentication already runs rate-limit/catalog reads concurrently, and the refresh runner coalesces requests and aborts on disposal. The WebGL scene already pauses its render loop for hidden/offscreen content and reduces DPR on sustained slow frames. These mechanisms were retained.

Generated course JS, embedded assets, downloadable examples, and builtin Drive export snapshots serve independent runtime/export requirements. They were not deleted as apparent duplication. Course IDs, content authorization, and output tracing were preserved.

## Test maintenance

The initial full run passed 223 of 230 tests. Seven failing checks used historical slide positions, removed layouts, obsolete read-only/download UI expectations, or migration-time hashes for editable lessons.

- Legacy layout lookup now prefers explicit layout IDs over display positions, avoiding collisions after slide insertion.
- Tests follow the current VS Code introduction, starter download dialog, editable prompt, multi-project help, inline Pull/Clone workflow, and relative Claude position. Copy behavior and dialog interactions remain exercised.
- Immutable migration snapshots retain SHA-256 checks. Editable Web Development sections are compared byte-for-byte with an in-memory compilation of the current storyboard, renderer, assets, and font. The test performs no source writes and does not replace historical hashes.
- Removed the obsolete fallback branch in the practice test once every selected layout had a dedicated check. DOM absence assertions use booleans to avoid serializing a large DOM tree on failure.

## First-pass verification and limits

- Production build and TypeScript: passed.
- Full test suite: 230 passed, zero failures.
- Targeted authentication, form, navigation, and performance regressions: 66 passed.
- ESLint: zero errors; seven existing warnings remain in course/export/example/test files.
- Source duplication audit and `git diff --check`: passed.

Browser inventory returned no browsers, and opening the in-app browser returned “Browser is not available: iab”. Responsive geometry and visual effects have not been screenshot-verified in this session. No browser FPS, production latency, or concurrent-user benchmark was performed; static review and functional tests do not establish production capacity.

## Final landing audit

- Preserved the requested glass surfaces, staged background reveal, animated icons, six-digit client input, robot attention, and smooth forward/back transitions.
- Added a synchronous login lock, 30-second request timeout, cancellation on unmount, and protection against applying a late response after departure. Existing server support for legacy configured credentials is unchanged.
- Coalesced page pointer tracking, glass updates, and robot hover raycasting to at most one callback per animation frame. Raycasts reuse scratch vectors/intersection arrays and skip the entire login surface and dialogs, preventing dragging through the form.
- Drag listeners now clean up on pointer cancellation, window blur, and unmount. Blink timing uses the existing frame clock rather than creating a timeout for every blink.
- Memoized the WebGL scene so unrelated form updates do not rerender it. The SVG fallback is loaded only when needed, and its reduced-motion mode starts no JavaScript flight loop.
- Removed three unused startup stage updates and five shadowed CSS declarations; consolidated reduced-motion rules. Updated deprecated logo priority props to Next.js `preload`.
- Cancelled panel animations release their interaction lock and restore focus; regression tests cover cancelled exit, cancelled sizing, rapid repeated clicks, Back, and unmount.

Final checks: 235 tests passed; production build and TypeScript passed; changed landing files have no lint errors or warnings. Repository lint has zero errors and seven existing warnings outside the changed landing files. Public production HTTP checks returned 200 for the homepage and every referenced script/stylesheet; `/login` returned the expected 307 redirect to `/`.

The same local HTTP resource check measured initial raw JavaScript decreasing from 749,270 to 735,297 bytes after lazy-loading the SVG fallback (13,973 bytes, approximately 1.9%). This is uncompressed response size, not transfer size or a browser speed score. Final local homepage requests took 199, 34, and 22 ms; those loopback measurements do not predict deployed latency. Raw local checks are in ignored `.local/landing-http-audit.json`. Browser screenshots and browser FPS remain unverified because no browser surface is available.
