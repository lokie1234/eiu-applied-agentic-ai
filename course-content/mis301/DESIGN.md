# MIS 301 · Pandas, Part 2

Use the assigned `eiu-business-v1` template at 16:9. Preserve its header logos,
copyright footer and page-number circle. Native content occupies x=5.6–94.4%,
y=11.5–88.9%; do not add another full-slide background inside that region.
Use navy headings, gold section markers and cream instructional cards from
`public/downloads/design-dna.txt`. Keep notebook surfaces white with compact
monospace code and DataFrame tables. Use balanced headings and meaningful wraps.

Flow: EIU introduction with three workflow topics and the only floating download dock
(Demo, Practice, Solution and all three data files) → two raw-data preparation slides → Demo notebook CSV/Excel import and
inspection → Happiness Survey practice → questions → revealable answer summary.
Follow the supplied notebook commands, but correct the Solution notebook's
head()/tail(3) examples to head(10)/tail(5) where the Practice asks for 10/5 rows.

The Colab-style workspace is an explicitly labelled, offline simulation, not a
Python runtime or a Google connection. Its supported commands calculate outputs
from the bundled source datasets. Import/file/DataFrame dependencies and errors
must stay consistent. Do not eval learner input or contact an external service.
Notebook execution is local to the slide. Practice answer forms use the authenticated
parent bridge and scoped `/api/sections/[id]/practice` route; Supabase owns identity
and `ACTIVITY_SUBMITTED` records, including each part's reportable fields. Never
accept a name/email from the iframe as learner identity. Teaching can read submitted
answers; learners read only their own. Convex owns the live classroom read model
and game state, using the existing root client; Supabase remains the durable source
for reports and reset. A server-only bridge sends bounded, rebuildable snapshots
without emails. The teaching view subscribes directly to `classroom:view`; retain
the scoped Supabase read fallback when the live classroom is unavailable.

The wheel minigame is inserted before the first Practice slide (teaching slide 9) and has
`adminOnly: true` (the runtime includes it for Admin/Teaching). Choose the whole
configured group without replacement in one backend call. Class Spotlight uses real
Learning Access username/email identities: only usernames reach the game. The
Convex mutation chooses a group atomically and enforces
teaching scope plus rate limits. Never choose winners in the iframe or accept a
manually supplied roster. Render all current members on one native SVG wheel with
lit name plates, rim bulbs and pointer ticks that slow with the wheel. Reserve the
whole usable slide frame for the wheel and an open ground scene; retain the EIU
template's branding. Only group-size settings, the central Draw button and Reset
are needed. Spin for five seconds once, then reveal the complete chosen group
sequentially; do not rerun the draw for each result. Lock Draw until an authorized
Convex reset clears this round only, preserving members and practice answers.

Each reveal makes a real WebGL robot climb up from a ground plane. Keep the username
above its head using the head anchor's projected 3D position, with a slow readable blinking
effect. There is no right-hand result panel, bordered stage or separate name-card
tray: selected characters remain in the open scene. Preallocate separate lanes
for the chosen group so names and figures cannot cover each other. Adapt character
size and lane count for up to 50 results; abbreviate unusually long labels at a
word boundary while preserving their full accessible name and hover title.

`robots3d.js` contains ten Guardian-inspired robot variants: Guardian, Scout,
Engineer, Medic, Pilot, Explorer, Coder, Solar, Aurora and Titan. Reuse the landing
robot's ivory armour, navy visor, cyan LEDs and gold accents. Cycle them by result
order, keep every selected character/name in the scene and respect
reduced motion. Keep draw state across slide navigation; an already completed
round restores results instead of spinning again. Roster membership uses the most recent signed learner session per
email in the past 24 hours, after the current termination boundary. Draws are
ephemeral and excluded from Excel. Teaching sees 10
slides, Learning sees 9; keep numbering and factory metadata role-aware.
Preserve downloads of all six source files.

All four practice parts and the answer check are consolidated into one
`practice-hub` slide. Its dashboard opens a popup that occupies the whole usable
template frame while preserving the external EIU header/footer. Use compact tabs,
previous/next and a close control; notebook and answer panel share the remaining
area. `practice-popup.tsx.txt` / `practice-popup.css` own this view. Lazily create
each part once and keep its DOM mounted when hidden so code, output and unsaved
answers survive tab switches and closing/reopening the popup. Scope code-copy and
activation events by practicePart; only the visible panel refreshes live data.
Retain the existing four server part IDs and source/report contracts. Trap focus
inside the popup, support Escape and restore focus to the launching control.

Wheel simulation: `lib/classroomDemo.ts` defines 40 explicitly synthetic usernames.
The Demo badge and Exit demo control must stay visible. Demo/real rounds use
separate Convex draw fields and the same server selection logic; switching modes
or resetting the demo must not alter the real roster, real round or practice
records. Never create fake Supabase logins, emails or report rows. The mode
preference is browser-local; demo starts enabled until the instructor exits it.

Use short entrance animations for instructional cards, output transitions after
running cells and focused reveal motion in the game. Avoid continuous decoration
elsewhere. Keep headers balanced, body text in meaningful phrases and code wraps
inside the notebook. Provide next-cell/reset controls and a way to reuse code in
practice answers. Preserve unsaved inputs during realtime updates.

Wheel name plates are tapered annular paths contained inside their sectors. Pad
both wheel SVG viewBoxes so the rim and lights are not cut by a square viewport.
Keep the wheel/bay/arena unboxed and unclipped. Styling lives in wheel.css.

The 3D ground uses row-level clipping planes and actual soil rings. Shoulder/elbow
IK plants hands at the rim; knees, grippers and torso articulate through a
2.45-second pull-up and settle. Do not substitute a translated SVG/CSS card.
Keep one WebGL canvas, shared low-poly geometry and instanced batches per row.
Cap DPR at 1.25, omit texture downloads, postprocessing and shadow maps, cache
static poses and render only during emergence or resize/restore. Reset releases
instance buffers/materials; closing the slide disposes GPU resources. Bundle the
existing Three.js dependency lazily into this section. Reduced motion renders a
static final pose. Do not claim measured FPS without a requested performance check.

Embed the existing Inter variable WOFF2 for native UI and SVG names; retain
monospace only for Python code. The wheel has a five-second integrated velocity
profile with short acceleration and continuous deceleration, based on elapsed
time rather than a fixed angle per frame.

Edit storyboard.json / renderer.tsx.txt and wheel.tsx.txt / wheel.css / robots3d.js
for slide 9, then regenerate with node scripts/build-mis301-course.cjs. Preserve
the verified sources.json binding.
