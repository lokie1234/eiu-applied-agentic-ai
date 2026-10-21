# Learner tracking and export hierarchy

Tracking and reporting use current catalog IDs, not course titles or a fixed Section 1/2 list. Folder membership comes from the same folder registry stored in course metadata as the chooser. Built-in, JS, PDF and PPTX lessons use the same portal lifecycle. New catalog entries are included automatically.

## Events and live presence

- `PASSCODE_LOGIN` with `scopeMode: access` records permitted scopes. It does not claim the learner opened them.
- `SECTION_OPENED` records the server-authenticated learner and actual folder/course/section. A retry of the same entry is deduplicated against recent events. The live upsert runs concurrently with history logging so a slow audit lookup cannot delay presence. Historical logs without the new scope mode retain their prior reporting interpretation.
- On entry the portal sends a nonblocking request. A visible learner tab updates its presence row every 20 seconds; it does not insert another history record. Admin and teaching visits are excluded.
- Hidden tabs, navigation and pagehide send a leave beacon. Expired rows are excluded after 50 seconds. Closing a browser without a delivered beacon can therefore remain visible briefly.
- Server-generated presence keys contain section ID and session/tab hashes. Separate tabs in the same authenticated session are deduplicated at section, course, folder and overall levels. Separate login sessions remain separate learners.

The existing `presence_sessions` schema has a legacy Section 1/2 check. Scoped rows use a `v2:<section UUID>:<session hash>:<tab hash>` primary key within its existing 120-character limit. The enum column remains a compatibility value only; aggregation resolves scoped rows by the actual section UUID. This reuses the existing table, active-row index and realtime signal without requiring a live schema change. Durable audit records contain explicit folder, course and section metadata.

## Cost and user experience

At 50 visible learner tabs, steady tracking sends about 150 heartbeat HTTP requests/minute. Entry/leave are additional infrequent requests. Each heartbeat revalidates access and performs one presence upsert; no audit query or audit insert is made for steady heartbeats. Permission validation retains the existing live catalog/identity checks.

Admin reads one paginated stream of active presence rows and aggregates using maps/sets. It does not execute a count query for each configured course or section. Realtime signals coalesce without continually postponing the pending read; requests are spaced by at least 750 ms. A five-second visible-tab fallback handles missed signals, and reconnect triggers a fresh snapshot. Reads time out after eight seconds so a stuck call does not block later updates. Unchanged responses preserve state; requests do not overlap. Hidden tabs stop polling, and presence failures do not block slide loading.

This adds normal database/network traffic proportional to active tabs and admins. It does not make every learner poll admin statistics, reload decks, or download reports in the background. Export hierarchy metadata loads only when the admin opens the dialog; the workbook is generated only on download. Large simultaneous classes should be assessed using real Supabase latency and concurrency, rather than extrapolating the CPU-only aggregation benchmark to end-to-end capacity.

## Export

The admin selects Folder → Course → one section or all sections. All-course and all-section choices display the number of matching catalog entries. Native option groups organize courses by folder and sections by course, supporting any number of catalog entries. Changing a parent clears child selections. The API validates the complete chain, and exported rows contain folder, course and section labels.

Only already recorded visits/submissions can establish actual participation. The change does not invent historical section visits that were never recorded by earlier versions.

## Validation

`tests/hierarchy-presence.test.mjs` covers live aggregation, server-resolved identity, entry/heartbeat costs, multi-tab counts, automatic catalog additions and scoped workbooks. `tests/passcode-ui.test.mjs` covers generic uploaded-section tracking, nonblocking loading, hidden-tab behavior, learner badges and cascading exports. `tests/performance-regressions.test.mjs` retains request overlap and deck-stability checks.

## Reset hierarchy

Report and Reset share the same Folder / Course / Section selector and current catalog. Reset validates the complete hierarchy before any writes and is disabled until metadata loads. It still requires administrator access and the existing confirmation passcode. No reset runs from merely opening the dialog.

Scoped deletes resolve actual section IDs, retain other scopes in shared login records, and delete only matching v2 presence keys. Legacy physical learning tables and Section 1/2 control state belong to Applied Agentic AI; resetting another course cannot delete them even if its section keys are also section1/section2. A global reset requires all three selectors to be explicitly all. Paginated audit records are snapshotted before deletion to avoid skipped pages.
