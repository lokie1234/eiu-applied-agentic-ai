# Admin Live presentation

On the course section selector, an administrator can click **Live** inside a section card, then choose
**Điều khiển** on the laptop and **Theo dõi** on the presentation PC for the same
section. Teaching Access and Learning Access do not expose these controls. A small
blinking broadcast icon indicates Live without changing the normal slide layout.
Click the icon to open session controls, including fullscreen on the PC. Stop Live
before handing control to another device; leaving the follower does not stop the
presenter. Reduced-motion preferences disable the blinking animation.
Smartphone touch screens use larger navigation controls and a contained action
strip. Their lesson iframe keeps a 1280 × 720 canvas, scaled to the available
space, so rotating the phone does not broadcast a narrow mobile reflow to the PC
or replay the lesson. Desktop mouse layouts retain their existing dimensions.
If an abandoned session blocks control, choose **Kết thúc phiên cũ** in the
conflict message, then start control again. This is an explicit administrator
action; opening Live on the PC should normally use **Theo dõi** instead.
The role menu and Live status follow the existing English/Vietnamese interface
language switch. In Admin Access, each JavaScript section has a **Live** checkbox.
Existing sections retain Live until an administrator explicitly disables it.
The setting is stored in Supabase course metadata, hides the entry button, and
is enforced by the administrator-authorized Live API. Stop remains available for
releasing a previously active session after disabling Live.

## Transport and state

Live uses Supabase only; the root Convex presence, scoped result notifications and
MIS 301 classroom/wheel continue unchanged. Supabase private Broadcast carries
visual deltas and WebRTC signaling. Compatible local networks also establish a
host-candidate-only WebRTC data channel, with no external STUN/TURN service.
The direct channel and Broadcast do not write each click to a database.

The server checks the existing HttpOnly Admin session, origin and actual section
settings before issuing a rotating, unpredictable channel topic. This topic is a
short-lived bearer capability: never log it or expose it to learners. Private
Realtime RLS admits only the current active topic; browser clients cannot list
room rows or execute lease/checkpoint RPCs. Grants rotate every two minutes and
expire at the bucket end plus 30 seconds. This uses the existing app session secret,
without changing Supabase Auth signing keys or creating another user identity.

One `live_presentation_rooms` row per actual section holds an atomic owner/epoch
lease, monotonic request/document sequences and the latest bounded checkpoint.
Only the server service role can read/write this table. The browser coalesces
Broadcast updates for 100 ms and omits unchanged CSS/font nodes. Large initial
frames are chunked into 60,000-character messages below the 256 KB Free-plan
Broadcast payload limit, including UTF-8 and JSON envelope overhead. Missing delta
baselines trigger a full resync; stale epochs, sequences and checkpoints cannot
roll back the current Broadcast frame.

Changed snapshots are coalesced over ten seconds, with the existing ten-second
heartbeat also flushing pending changes. Unchanged captures skip writes; heartbeat requests carry no
document and do not increment the visual revision. One shared session-level
metadata loop runs every six seconds with a healthy channel, or 1.5 seconds while
reconnecting. Metadata reads exclude the large document column; followers that
already received that document sequence do not download the checkpoint again.
A reload or missed Broadcast state can fetch the latest checkpoint. Checkpoint
failure keeps the active direct/Broadcast stream and retries the newest state.

The old private Storage lease is imported once when necessary and released on
stop. It is not the ongoing checkpoint transport. Deprecated Convex Live endpoints
check authorization but perform no database reads or writes, preventing stale
clients from continuing the previous large-snapshot I/O pattern. Reload both
Admin windows after deployment to use the new client. Other Convex features are
not retired. Apply `202611160001_live_presentation_realtime.sql` with the
management token in ignored `.env.local` using
`node --env-file=.env.local scripts/apply-live-supabase-migration.cjs`.
The token is a migration credential, never a browser/runtime configuration value.

The former Convex update path read and rewrote the reconstructed document on every
small patch. Real compiled lessons contain about 480?520 KB of embedded CSS/fonts.
Therefore a small JS download or a small patch did not imply small database I/O.
This pattern explains substantial Live I/O; attributing the entire project quota
would require provider usage logs. Supabase Broadcast still has message/egress
quotas, and checkpoints still consume bandwidth; this change does not make Live
unlimited or reverse usage already charged.

The follower renders visual state without running the lesson's scripts or replaying
clicks, submissions, draws, or other side effects. It preserves modal dialogs,
reveals, inputs, scroll positions, SVG and animation timing. Password input values
are redacted. Its viewport scales to the controller's layout.

## Boundaries and recovery

- Live currently supports uploaded/compiled JavaScript HTML/SVG sections. PDF,
  PowerPoint, canvas/WebGL pixels, embedded cross-origin frames and portal widgets
  outside the lesson iframe are not mirrored.
- Reloading preserves the chosen role in that browser tab. The follower loads the
  current snapshot; a controller resumes the same owner/epoch and sequence.
- A new controller requires the Supabase lease. An existing direct stream can survive a
  Realtime outage, but new login and server authorization still depend on Supabase.
  This is transport redundancy, not an independent identity service.
- A network interruption keeps the last screen visible. Checkpoint recovery is slower
  than the direct/Broadcast channels; latency depends on network, hosting and service health.
- An uncleanly closed controller can leave its lease. Another administrator's
  follower can use **Kết thúc Live** to release it before restarting.
- Stop clears the active snapshot and releases the lease. These are presentation
  checkpoints, not learner records or report history; no reportable activity is
  generated by mirroring.

## Verification

The `tests/live-presentation*.test.mjs` suites cover visual reconstruction, actual
compiled SVG assets, graph/payload validation, administrator and origin checks,
exclusive ownership, sequence checks, metadata-only reads, checkpoint recovery,
Broadcast chunking/deltas/resync and the absence of Convex Live database I/O.
Browser verification uses two independently authenticated local Chrome contexts;
it does not rely on shared cookies or on replaying learner operations.
The layout regression test keeps the presenter deck as the only viewport child;
Live controls render through a portal outside the full-height deck layout.
Cross-course tests include the real Web Development and MIS 301 embedded CSS/font
text nodes (roughly 480–520 KB), while retaining the 900 KB total document budget.
Unchanged font/style text is compared directly and omitted from click deltas,
avoiding repeated large JSON allocations during presentation.
Capture clamps fractional overscroll and invalid animation timestamps before
protocol validation. Leaving a course clears its Live selection.

Local verification of this migration used real Supabase private channels and RPCs
(ownership conflicts, stale sequence/epoch fencing, heartbeat revision stability,
anonymous table/RPC denial and invalid-topic denial). Two isolated Admin browser
contexts rendered the real large-CSS Web Development lesson with both Convex and
WebRTC blocked; a test DOM mutation arrived through Supabase in 172?192 ms in those
local runs, not a production latency guarantee. Smartphone touch verification also
covered 320/390/430 px portrait and 844/667 px landscape while retaining desktop
layout dimensions.
