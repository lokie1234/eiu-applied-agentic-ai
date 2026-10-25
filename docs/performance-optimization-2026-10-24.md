# Drive and section loading optimization — 2026-10-24

## Changes

- Drive connection setup reads stored credentials once, after the admin guard. Identity verification and refresh-token replacement remain live.
- Drive import loads the Google Picker script alongside the picker authorization request. Upload destination lookup and Drive authorization also run together.
- Folder/course exports reuse one fresh catalog within each save request. Folder membership, both nested folders and legacy TSX export use that same snapshot. Nothing caches authorization or catalogs across requests.
- Batch export runs at most two sections concurrently. Files in a single section stay sequential because publishing an export can change its live source. Failed files retain their errors and can be retried without resaving successful files.
- Concurrent folder operations on the same OAuth client share only the pending lookup/create. Completed and failed operations are removed, so later exports query Drive again. This protection is per process; it is not a distributed folder-creation lock.
- Drive content reads import the 50 MB limit from a small module instead of eagerly importing the TypeScript compiler and ZIP validation pipeline. Legacy TSX compilation stays available where needed.
- Admin course setup requests layout names and IDs only. Full backgrounds load when opening Slide Layouts. A section requests only its selected layout. Existing full-library reads, additions and deletions remain supported.
- Removed the unbounded, URL-only browser cache of lesson code. Reopening a section now uses its fresh authorized response instead of rendering a previous session's or revision's code while the request is pending.

No CSS, lesson sources, source bindings, output tracing, deployment settings or database schema changed. Navigation continues using the existing Next links and loading boundaries.

## Baseline and comparison

These are request counts and serialized payload measurements from controlled regression fixtures, not live Google latency or browser timings.

| Path | Before | After |
| --- | --- | --- |
| Drive setup credential reads | 2 | 1 |
| Group export of a legacy TSX file: catalog reads within the save operation | 4 (plan, group folder, course folder, document) | 1 |
| Two simultaneous exports resolving the same new folder on one client | 2 lookups + 2 creates | 1 lookup + 1 create |
| Batch saves of independent sections | 1 active section | At most 2; each section remains ordered |
| Admin layout list fixture: one default layout and one unused 1 MB image | 1,000,186 JSON bytes | 123 JSON bytes |
| Section selecting the default layout in that fixture | 1,000,186 JSON bytes | 110 JSON bytes |

The TypeScript implementation file that the Drive read path previously imported is 9,112,572 bytes on disk. This is a server dependency reduction, not a claimed browser download reduction. Existing Drive media caching still checks current permissions, size and revision before reusing bytes, isolates credentials and bounds retained media.

## Verification

- Baseline: 291 tests passed before edits.
- Added coverage for bounded export concurrency, per-section ordering, retries, shared folder creation, recovery after folder errors, one catalog snapshot per request, selected-layout payloads, summary payloads and lazy loading full layout images.
- Final full suite: 295/295 passed. Production build passed. ESLint: zero errors and seven existing warnings. Local outputs are in `.local/optimize-final-tests.log`, `.local/optimize-build.log` and `.local/optimize-lint.log`.
- Existing checks cover authorization/revocation, section visibility, role-specific slide counts, restored slide position, custom layouts, source/download byte fidelity, quiz results, feedback, termination and resets.
- No live Drive writes, external-account benchmarking or screenshot-based production comparison was performed. Real end-to-end latency remains dependent on Google, database and network response times.
