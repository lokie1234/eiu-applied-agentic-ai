# Learning and Drive audit — 2026-10-10

## Changes

- Periodic refreshes no longer queue another request when the current request is still running. Explicit actions and realtime events can request one follow-up refresh.
- Heartbeats run every 20 seconds instead of 10. Heartbeats, attendance reads, quiz/ideas/showcase fallback polls and AI document polls pause while the tab is hidden and resume when visible.
- Presence/audit writes no longer invalidate unrelated in-flight catalog reads. Changes to catalog/access configuration still invalidate shared reads before and after the mutation. Completed authorization responses are not cached.
- Login rate-limit and catalog reads run concurrently, while access remains subject to the rate-limit result.
- Admin AI document/rules refreshes share the abortable refresh runner. Slow polling cannot accumulate requests; unmount cancels pending work.
- Fixed a real navigation bug found during the browser test: passing Next.js private history state into native `replaceState` prevented the router from updating its canonical URL. A background refresh could discard the selected course, section and slide. Native history updates now pass `null`, allowing Next.js to synchronize the URL.
- Drive export supports stored JavaScript when original TSX is unavailable, exact known local source recovery, generated built-in decks, and section/course/folder target-selection dialogs with progress and success feedback. Import controls were removed as requested.

## Thirty-user browser test

Production build served locally, connected to the project's real Supabase. Thirty isolated Chromium sessions signed in together with the supplied learner passcode. Each session entered Applied Agentic AI / Section 1, navigated slides, opened and closed all four demo dialogs, submitted an idea and a showcase URL, answered all ten quiz questions, and reloaded to verify the saved result and section selection.

Final run marker: `LOADTEST30-1791613472238`.

| Check | Result |
| --- | --- |
| Independent sessions | 30 |
| Completed browser flows | 30/30 |
| Ideas persisted | 30 |
| Showcase submissions persisted | 30 |
| Quiz results persisted | 30 |
| Quiz POST requests | 30 (one per user) |
| JavaScript exceptions / HTTP errors observed | 0 / 0 |
| API requests across the scenario | 648 |

| Operation | Median | P95 |
| --- | ---: | ---: |
| Sign-in including required identity information | 2.25 s | 9.31 s |
| Catalog navigation | 7.18 s | 7.44 s |
| Enter section | 3.99 s | 10.18 s |
| Submit idea | 1.64 s | 3.76 s |
| Submit showcase | 1.82 s | 3.81 s |
| Reload and restore quiz | 3.44 s | 4.46 s |

These are end-to-end timings under 30 simultaneous browser contexts on one machine, not isolated server latency measurements. Completing the quiz took a median 19.08 seconds, including ten UI interactions and answer transitions.

An earlier run exposed the URL restoration bug described above: submitted records persisted but most sessions returned to the course picker after reloading. The final run repeated the complete scenario after fixing it. Test submissions remain clearly marked `LOADTEST30-*`; quiz-open configuration was restored conditionally so a concurrent admin change would not be overwritten. Intentional cancellation when navigating away is not an application error.

An additional baseline exercised 35 concurrent learner logins/catalog loads and 35 authenticated stored-file downloads. Downloads returned the expected 1,411,331-byte content. Learner access to hidden MIS 311 was correctly rejected with HTTP 403; an admin session could read its content.

## Validation and limits

- `node --test tests/*.test.mjs`: 146 passed, zero failures.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed after the navigation fix.
- Targeted ESLint checks for the request/refresh changes: no errors; existing image warnings remain. Full repository lint still reports existing issues in landing/3D components, exported examples and admin state-reset effects; it is not a clean check.
- Regression tests cover slow periodic polling, explicit follow-up refreshes, visibility pause/resume, unmount cancellation, presence writes preserving shared reads, and Next.js native history synchronization.

The test demonstrates functional success at 30 concurrent users for this scenario. It does not establish Vercel production latency, monthly quota capacity, large-file transfer limits, or arbitrarily higher concurrency. Some initial loads reached approximately ten seconds; production monitoring and separate network/server measurements are needed to attribute those delays. Heartbeat traffic is halved for visible tabs; hidden tabs stop the audited fallback polls. Realtime subscriptions remain available while mounted.

Local raw evidence and screenshots are in `tmp/LOADTEST30-1791613472238/`; they are intentionally excluded from Git because the raw records include session identifiers. No passcode, credentials, or session cookies are included in this report.
