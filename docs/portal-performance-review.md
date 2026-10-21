# Portal performance review — 2026-10-21

## Changes made

- Memoized the robot renderer so changing only the online count does not reconcile the Canvas/model. A UI regression test counts model renders while the count changes.
- Kept mouse movement and projected antenna/face/chin positions outside React state. WebGL renders on demand; the blinking lamps use CSS instead of a permanent WebGL frame loop.
- Preserved the shared icon canvas, cached geometry/materials, 30 fps ambient rendering, visibility pause, adaptive resolution and six-million-pixel ceiling.
- Removed duplicate heading rules, obsolete button hover styles and the replaced title glow/rotation effects. Text depth uses sharp, static CSS shadows.
- Removed the loading overlay's synchronous effect-driven state update, using a hydration-safe portal target snapshot instead.
- Excluded local preview artifacts from Git and ESLint. The identical downloadable `EiuAgentBot.tsx` is an intentional starter asset and remains available.

## Remaining scaling considerations

- Full-screen icon rendering and animated background layers still consume GPU resources on low-end devices. The existing adaptive quality, reduced-motion handling and visibility pause mitigate this; actual device profiling remains necessary before making capacity claims.
- Online counts read active presence rows in pages of 1,000 and aggregate with maps/sets. Realtime bursts are coalesced, reads cannot overlap, and unchanged results preserve state. Request cost still grows with concurrent administrators and active learners; catalog authorization remains server-side on every request.
- Report and scoped Reset scan historical learning activity in pages of 1,000. Excel export materializes a workbook in memory; Reset snapshots audit IDs before deletion to avoid skipping pages. Very large histories can therefore consume server memory and time. They run only after explicit admin actions, not while learners navigate. Future scaling work should consider indexed scope columns and background report/reset jobs rather than removing scope checks or pagination safety.

## Verification and limits

- The focused portal/presence/report/reset suite passes 86 tests, including the model-render regression.
- The full suite reports 223 passing and seven failing tests. The failures concern the old Section 1 migration hash and old Git-guide slide identities/selectors. Both tests and their lesson/runtime/storyboard inputs are byte-identical to commit `3140d39`; these failures predate this change. No course slide content or historical hash was changed to make those tests pass.
- TypeScript, production build and application lint are checked separately. Lint retains the existing `CourseToolRow` warning about external `<img>` icons.
- This review used local code, mocked data and static layout previews. It is not a production load test and performed no live reset or learner-data mutation.
