# Interactive learning and reports

## Ownership

| Store | Authoritative data |
| --- | --- |
| Supabase | Course/section catalog, access/session revocation, saved learner identity, ideas, showcase submissions, quiz results/feedback, termination history, security audit and rate limits |
| Convex | Ephemeral presence, counts, scoped revisions/request counters, bounded classroom read models and atomic minigame draws |
| Repository / Drive | Lesson JS, PDFs, PPTX, source assets and templates |

Save every reportable result to Supabase before acknowledging success. `notifyRealtime()` runs only after a successful durable response; its failure must never undo or resubmit a saved result. Do not independently write a quiz result or learner identity into both databases.

The Supabase `learning_realtime_signals` table is a compact change feed, one row per actual section ID and topic (`control`, `quiz`, `showcase`, `ideas`). Its transaction trigger advances a revision in the same transaction as the result write. It contains no names, emails, answers or duplicated metadata. Server pushes deliver revisions to Convex; a 30-second reconciliation action repairs missed pushes after the deployed app origin is configured. Reconciliation rereads the small current-state table, not a global sequence cursor: concurrent commits cannot hide a lower sequence value. Convex ignores stale/out-of-order revisions.

Do not drop the existing Supabase activity/submission tables: legacy built-in lessons, reset, quiz restore, reports and session authorization still use them. A table retirement requires migrating **all** its readers/writers, backfilling and reconciling history, and preserving a backup first. Removing duplicated columns from Excel does not authorize deleting learners' source data. Current cleanup concerns workbook tables and the new realtime projection, not destructive deletion of history.

## Authentication

`GET /api/realtime/token` verifies the existing HttpOnly app session, resolves current Supabase section grants, checks the change-feed setup, then signs an RS256 token valid for 120 seconds. Audience is `eiu-interactive`. Private key and passcodes never reach Convex or the browser. Convex receives only a public JWKS and verifies both issuer and audience. Tokens include opaque session subject, permitted section IDs, teaching scopes and role; no profile fields. Expiry bounds access-revocation delay to at most two minutes. Hidden sections/courses are excluded for learners.

Convex `signals` enforces section grants; `online` exposes only the admin/teaching scope; `pulse` cannot track admin or teaching visits as learners. Every additional public Convex function needs its own authorization/validation: Next.js Proxy does not protect direct Convex traffic. Presence allows 12 calls per minute per subject with a 120-second cooldown, caps concurrent tabs and deduplicates the same session across tabs and sections. Presence expires after 65 seconds without a heartbeat. Scheduled expiry changes the counts only on join/leave, so heartbeats do not invalidate every count subscription.

## Frontend and new sections

1. Bind the actual Supabase `courseId` and `sectionId` in `course-content/sources.json` and the existing native lesson runtime. `section1` alone is not a global ID.
2. Use the existing `QuizSlide` / `ShowcaseSlide` and scoped `/api/sections/[id]/...` endpoints. Preserve all legacy adapters used by Applied Agentic AI. Do not bake keys, learner identity or cross-course IDs into generated lesson JS.
3. Root `LessonPortal` owns the authenticated Convex client, scoped signal subscriptions and live counts. Shared slides listen through `listenInteractive(sectionId, topic, refresh)`; no extra WebSocket or polling loop per slide. `interactiveSectionId()` resolves legacy keys only within Applied Agentic AI.
4. Re-fetch authorized Supabase state once when the relevant revision changes. Quiz scoring and permission checks remain server-side. When healthy, Convex replaces the 2/5/8/10-second fallback polls in migrated widgets; disconnection restores the existing Supabase path. Ideas in legacy compiled lessons retain their existing Supabase adapter until that compiled runtime is migrated explicitly.
5. Reportable new actions must register an explicit durable payload and participate in reset and report aggregation. Reuse server-resolved identity; never trust a submitted name, role, score, course or section. Add a change-feed mapping/topic if needed.
6. Keep ephemeral presence separate from participation history: section entry is logged once in Supabase, later heartbeats use Convex. Do not export heartbeat rows as learner attendance.

## Excel contract

MIS 301's four practice parts and answer check now share a single popup workspace.
This is a display change: keep `import`, `explore`, `scores` and `quality` as
separate server-authorized activity IDs and report columns. Preserve per-part
drafts in mounted hidden panels, scope code-copy events by part and refresh only
the active panel through the existing root Convex connection.

MIS 301 Section 1 uses `lib/mis301Practice.ts` for the four allowed practice parts
and report field labels. Learning passcode login for this section always requires
Username (`information.name`) and Email, even if the global identity form is off.
Teaching sessions never join the learner roster. Existing anonymous sessions must
sign in again before submitting. The sandbox requests `load`/`submit`/`draw` through the parent
bridge; the parent checks its actual iframe window and current slide request ID,
then uses the root Convex client or `/api/sections/[id]/practice`. The server resolves Learning identity
and section permission, rejects teaching submissions, scopes learner reads to
their signed session and limits teaching reads to the latest 200 submissions.
It saves `ACTIVITY_SUBMITTED` with explicit fields and a termination-session token.
Existing report/reset aggregation includes these records. Apply
`202610280003_practice_signals.sql` for atomic retry deduplication and quiz-topic
change notifications. The offline notebook never sends arbitrary Python to a
server.

`convex/classroom.ts` owns live membership and draw state plus a bounded read model
of the latest 200 durable practice records. Practice saves push just the committed
record through `/classroom/answer`, avoiding a reread of the whole class per answer.
Login, termination and reset publish a server-authorized snapshot through `/classroom`; the existing
reconciliation action repairs missed snapshots via `/api/realtime/sync`. Set
`EIU_APP_ORIGIN` to the deployed app origin once the updated web routes are live
(configured here as `https://eiu-interactive-space.vercel.app`). Updating Convex
does not deploy the Next.js routes: redeploy the web app with its existing realtime
environment settings to activate the new bridge on Vercel.
Supabase remains authoritative for identities, answer history, exports and reset.
Convex receives usernames and answer projections, never emails, passcodes or the
Supabase key. A checked snapshot cutoff fences stale delivery, preserves newer
answer deltas, and rejects delayed pre-reset/pre-termination records.
Retain the Supabase fallback and never acknowledge a submission before its durable
write succeeds. Reset/termination rebuilds the projection and clears obsolete draws.

Class Spotlight is visible only to Admin/Teaching. Its roster contains the latest
signed learner session per email from the past 24 hours, after termination; this
deduplication applies only to the game, not Excel's distinct-session rows. The
teacher chooses 1–50 participants from the complete section roster. An authorized,
rate-limited Convex mutation selects the group atomically without replacement;
the iframe only animates the returned usernames and opaque subject IDs used to
align the wheel. A single five-second spin reveals the whole group sequentially
with ten lightweight WebGL robot variants. The 3D engine is presentation-only;
it never chooses winners or writes learner records. A completed round is locked until the separate,
authorized `classroom:resetDraw` mutation clears only draw state, never profiles,
submissions or reporting history. Reloading the slide restores the shared round.
Public reads enforce teaching
scope for rosters/draws and signed-subject scope for learner answers. Direct Convex
calls cannot bypass those checks. Do not add an independent Convex client to slides.

The wheel has a labelled 40-learner simulation using `lib/classroomDemo.ts`.
Synthetic names are static configuration, not learner accounts. Teaching-only
draw/reset mutations accept the explicit demo flag and use `classroom.demoDraw`,
separate from the real `classroom.draw`. Real membership, identities and report
records are untouched; demo identities never enter Supabase or answer projections.
The parent remembers Demo/real mode in browser-local storage and exposes Exit demo.

`app/api/admin/report/route.ts` assembles the authorized, dated snapshot; `lib/reports/workbook.ts` owns presentation and filenames. Preserve hierarchy validation, legacy history, quiz restore and reset behavior.

- Filename: `<Course>_<Section>_<YYYY-MM-DD>.xlsx`, ASCII-safe readable names. Combined exports use `Tat-ca-khoa-hoc` / `Tat-ca-section`. A dated export uses the selected date; all-time exports use the VN export date and say all-time inside.
- Export **exactly two sheets**: `Tổng quan` and `Thống kê`, including empty exports. No separate roster, participation, idea, shared-work, quiz-detail, feedback or activity-journal sheets. Do not move journal actions/log content or individual quiz questions/answers into the consolidated sheet. Quiz statistics retain score, maximum, accuracy and completion time; raw question data stays in Supabase.
- `Thống kê` uses one row per learner session and selected section, containing name, email, configured identity fields and login timestamp together with that section's results. A successful login creates its rows before any section is opened. Grant scope is not evidence of attendance. Do not merge different signed sessions by name or email. Legacy references may join a session by email only when unambiguous.
- Add result columns only for activities that have stored data in the selected report scope. Never hardcode columns to `section1`/`section2` or create blank quiz columns for a section without results. Consolidate ideas, shared-work URLs, quiz scores and feedback into the same row. Preserve repeated real submissions in numbered column groups with their own timestamps; deduplicate replayed record references only.
- New reportable activity types use the server-authorized audit action `ACTIVITY_SUBMITTED` with actual course/section IDs, server-resolved learner identity, `activityType` (stable slug), `activityLabel`, `values` (explicit reportable fields), and optional `activityFields: [{id,label}]`. These fields generate additional columns automatically. Never export arbitrary audit/security metadata. Add authorization/validation on the writer and a realtime topic mapping if live refresh is required; the report does not invent missing activity data. Reset must remove these reportable records too.
- Course columns appear only for multiple courses; section columns only for multiple sections. Common scope belongs in the sheet heading. Folder names and UUIDs are not repeated in detail rows.
- Keep real numeric scores/percentages and Excel date values displayed in Vietnam time; metadata declares UTC+7. Freeze the header, filter populated tables, wrap readable text and use consistent navy/gold styling.
- Dynamic information/result headers must be unique. Untrusted text stays text, never executable Excel formulas. Scores and times remain typed values, including numbered repeated submissions.
- Results are already saved in Supabase before success: export does not wait for Convex notification delivery. A common upper timestamp bounds each export; retain deterministic pagination ordering. Read only report actions/columns, not security audit payloads unrelated to learning.

## Configuration and rollout

The deployment selected by the user is `https://pleasant-cow-963.ap-southeast-2.convex.cloud` (currently a development deployment). It is not automatically a production deployment.

1. Apply `202610280002_realtime_signals.sql` after the existing schema. It adds only a compact projection and triggers; history remains intact. The existing rate-limit migration is also required by Proxy.
2. `node scripts/setup-realtime.cjs` preserves/creates local server signing material and URL settings. `node scripts/configure-convex.cjs` uploads only the public verification key and shared bridge credential. `npx convex deploy` deploys Convex functions with the configured deploy key. Never log/commit any credential.
3. Configure these existing `.env.local` values on the **Vercel environment being deployed**: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`, `CONVEX_JWT_PRIVATE_KEY`, `REALTIME_BRIDGE_SECRET`, `REALTIME_PROVIDER=convex`, `NEXT_PUBLIC_REALTIME_PROVIDER=convex`. Keep the existing Supabase/session/Google settings. `CONVEX_DEPLOY_KEY` is needed on Vercel only if its build also deploys Convex; never prefix it with `NEXT_PUBLIC_`.
4. After deploying the web app, set Convex `EIU_APP_ORIGIN` to its HTTPS origin for reconciliation (`https://eiu-interactive-space.vercel.app` is the origin documented by this repository; verify it for the target environment). The bridge secret must match Next.js `REALTIME_BRIDGE_SECRET` and Convex `EIU_REALTIME_BRIDGE_SECRET`.
5. Confirm token acquisition, cross-section denial, counts, multi-tab deduplication, quiz open/result/feedback, showcase, terminate, reset and a scoped Excel export. Convex deployment alone does not update Vercel.
6. Rollback by setting both provider flags to `supabase` and rebuilding the frontend; durable history/reporting remain usable. Keep the change-feed triggers: they are harmless while the provider is disabled.

For a separate production Convex deployment, configure matching public keys/secrets and URLs in that environment; do not point development and production at unrelated auth configurations. No additional polling, data-copy tables or secret-bearing endpoints should be added for a new section.
