# MIS 301 · Pandas, Part 2

Use the assigned `eiu-business-v1` template at 16:9. Preserve its header logos,
copyright footer and page-number circle. Native content occupies x=5.6–94.4%,
y=11.5–88.9%; do not add another full-slide background inside that region.
Use navy headings, gold section markers and cream instructional cards from
`public/downloads/design-dna.txt`. Keep notebook surfaces white with compact
monospace code and DataFrame tables. Use balanced headings and meaningful wraps.

Flow: EIU introduction with the only download dock, Sources, Structure,
DataFrame reader overview, one Read & Explore workspace, Class Spotlight
(teaching only), and Happiness Survey practice. Teaching has 7 slides;
Learning has 6. The previous standalone completeness and inspection bridge
slides have been removed.
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

The wheel minigame is inserted before the first Practice slide (teaching slide 6) and has
`adminOnly: true` (the runtime includes it for Admin/Teaching). Choose the whole
configured group of at most seven learners without replacement in one backend call. Each learner receives a different part. Class Spotlight uses real
Learning Access username/email identities: only usernames reach the game. The
Convex mutation chooses a group atomically and enforces
teaching scope plus rate limits. Never choose winners in the iframe or accept a
manually supplied roster. Render all current members on one native SVG wheel with
lit name plates, rim bulbs and pointer ticks that slow with the wheel. Reserve the
whole usable slide frame for the wheel and an open ground scene; retain the EIU
template's branding. Use the central Draw button and Reset, with no group-size input. The server automatically selects one real learner per available assignment part, up to seven or the number of eligible learners.
The server chooses the whole group once. Each two-second cycle spins for 1.75
seconds, stops at that learner, reveals their Question row, then starts the next
spin after a 0.25-second hold. Keep cycling until the selected group is complete.
Use integrated acceleration followed by a long friction coast, plus a spring
pointer whose deflection follows angular speed. Keep the metallic rim and warm
bulbs without wheel shadows.
Names form an adaptive grid read top-to-bottom within each column: name 1 maps to Question 1, and so on. Each
row sweeps strongly from right to left with a short settling motion. No welcome
copy, instructional captions or normal status text is shown; keep errors visible
and use only real signed-in learners; do not include Demo controls. Automatically set one to five columns, row count, spacing and type size for
up to seven newly selected names without scrolling; preserve display of older larger draws. Keep full names in accessible labels and titles,
showing full learner-entered usernames in the result cards without truncation. Respect reduced
motion while keeping timing and resume the shared timeline from creation time.
Do not bundle or render robots, WebGL or character animations for this slide.
Lock Draw until an authorized reset clears only the round. Reloading restores
completed assignments or resumes the shared spin/reveal timeline using its creation time.

Roster membership uses the most recent signed learner session per
email in the past 24 hours, after the current termination boundary. Draws are
ephemeral and excluded from Excel. Teaching sees 7
slides, Learning sees 6; keep numbering and factory metadata role-aware.
Slide 1 shows two separate download groups: Notebooks (Demo and Practice, each
with a native Colab icon) and Data (all three files with CSV/XLSX icons). Do not
show a Solution notebook download; keep its source file in the repository for internal reference; omit it from the served bundle.

Slide 6 integrates the real wheel with a teaching Question setup dialog. Configure
seven parts with their original task counts before the real draw; the draw
freezes the current bank. Selected learners see only their own slide 6, a short
congratulations popup after the five-second reveal, then a full Colab-style
question popup with one complete editor, results and scalar answer fields.

Slide 7 is teaching-only: seven part rows open individual Colab/response popups.
Do not show the old Read CSV / Import / Store dashboard, isolated preparation
steps, zero-submission import panel or Final Answer. Each popup groups every task of its part as stacked code cells in one Colab surface. Show the actual drawn usernames and their
saved answers; match by subject, question number and draw ID, not display name.
Keep all popup content inside the EIU usable frame. Use intentional scrolling
and stacked panels on small screens, keyboard focus containment and close/reopen
without losing edits. Practice-popup.tsx.txt / practice-popup.css own these views.

Preserve the existing server part IDs and report fields. Supabase remains the
source of signed identities and durable answers; Convex owns live assignment,
question configuration and the bounded answer projection. Do not collect another
name, choose winners in the iframe, auto-run learner code, or duplicate results.

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

Embed the existing Inter variable WOFF2 for native UI and SVG names; retain
monospace only for Python code. Wheel motion is based on elapsed time, with
continuous velocity between two-second question reveals.

Edit storyboard.json / renderer.tsx.txt and wheel.tsx.txt / wheel.css
for slide 6, then regenerate with node scripts/build-mis301-course.cjs. Preserve
the verified sources.json binding.

Place Group, Reset and Demo controls at the top-left inside the usable template
frame. Remove the Class Spotlight heading. Expand the assignment grid from the
top to bottom of the right-hand content area; retain template branding.

The outer wheel rim uses layered navy tones and cool pale-blue bulbs; no gold
outer ring. Retain gold only for existing interior accents and result emphasis.

Introduction: show only the large centered Data Analysis Workflow title above
the three numbered topic rows. Omit the MIS 301 / section eyebrow and decorative
heading divider. Give the title a gentle vertical floating animation, disabled
for reduced motion. Keep both download groups below and preserve template branding.

Introduction update: use a large single-line Data Analysis Workflow title with
native CSS text extrusion and gentle perspective motion. Remove the overview
phase entirely. Arrange 01/02/03 in three equal centered cards below the title;
center numbers and balanced topic text. Animate the numbered badges with staggered
gold illumination, respecting reduced motion.

Slides 2-4 share native navy/gold cards, short bullets, line icons and gentle
animated emphasis. Slide 2 has Local files, Databases and Web access cards; each
opens its illustrative example directly in a keyboard-accessible modal within
the template frame. Show source/code and the resulting sample table, without
network requests, execution or reporting. Slide 3 compares structured (including
CSV), semi-structured JSON/XML and unstructured prose/scans/photos. Explain that
analysis needs rows and columns, and unstructured data needs transformations.
Slide 4 introduces DataFrames and pd.read_csv / pd.read_excel / pd.read_json with
examples, the pd alias and an illustrative table. Nested JSON can require
normalisation. concept-slides.tsx.txt / concept-slides.css own these layouts;
storyboard.json owns their text. Keep the served section and role-aware counts.

Slides 2-4 omit the course eyebrow, slide count, progress footer and native page
number. Preserve the template frame and branding. Remove decorative slogans and
implementation notes, retain core teaching points. Use embedded MIS Inter for
all natural-language text and monospace only for code, with balanced readable
type, wider method cards and consistent spacing inside the usable region.

Slide 2 uses a compact centred row of three full-card buttons without a See
example caption. Each has a distinct native SVG illustration (local folder/files,
database/table, web browser). Clicking opens the direct file/query/JSON example
and table preview; do not include Python, import instructions or implementation
notes in these popups. Keep all text native and template branding unobstructed.

Slide 2 cards show simple softly animated source icons instead of example
illustrations. Keep the detailed illustrations and examples inside the click
popups only; respect reduced motion.

Restore the original slide 2 folder/database/browser SVG illustrations and
format badges. Animate those existing illustrations with gentle floating motion;
do not replace them with new icon tiles. Keep the compact centered card layout.

Slide 2 source containers are not buttons and contain no generic example action.
Keep the original gently animated illustrations. Individual CSV, TXT, XLSX, SQL,
NoSQL, HTML, JSON and XML buttons each open their own direct example. Use the same
three student/score records across formats to compare representations. Show each
format's distinctive structure and a matching visual preview, without Python.
Explain that SQL/NoSQL are database categories/languages, TXT is not necessarily
tabular, and NoSQL document storage is one example of the broader family.

Slide 3 matches slide 2's compact centered three-card composition, navy/gold
surfaces, centered headings and gently animated native icons. Retain the type
comparison and examples, but remove the trailing transformation caption.

Slide 4 matches the centered three-card composition of slides 2-3. Show CSV,
Excel and JSON reader cards in one row with centered headings and gently moving
native icons. Place the import alias above and a compact DataFrame explanation
and table below. Omit the trailing workflow caption; preserve the teaching points.

Slide 5 consolidates CSV, Excel and Quickly Explore a DataFrame in one native
Colab-style workspace. Use three accessible tabs within the notebook: CSV,
Excel and Explore. A single editor, Run/Shift+Enter controls and a large output
area remain in place; change only the visible cell choices and short hints.
Preload student_data.csv and Course Offerings.xlsx without importing Pandas
or creating a DataFrame automatically. Do not add sample CSV files.

CSV has import, default read, sep="," / header=0 and header=None examples;
assign and display df. Excel has default worksheet, sheet_name=1 and
sheet_name="Courses" examples; assign and display df2. Import Pandas once in
the CSV tab. Explore offers shape, head(), tail(), info(), describe() and
count(), with an explicit df/df2 selector and separate saved cells for each.
All names and import dependencies follow the shared finite interpreter.

Use navy active tabs, cream navigation, restrained gold accents, a slim file
sidebar and balanced command grids: four CSV choices, three Excel choices,
six Explore choices in two rows. Keep the full composition inside the EIU
usable frame, preserving logos, footer and page-circle branding.

Keep code, native output, execution markers, active cell, aliases and DataFrame
read descriptors until section termination. Restore snapshots across navigation,
reopening and page reloads in the same browser session. Do not offer a separate
runtime reset. Migrate snapshots from the former slides 5-7 into this workspace
without rerunning cells or clearing variables. Source binding stays unchanged.

Slide 5 omits descriptive workflow paragraphs and the static session note. Keep compact controls near the top, six Explore commands in one row, and a larger result area with normal readable table type. Preserve all run/state functionality and the assigned EIU frame.

Wheel assignment access: slide 6 is available to selected learners only; slide 7
is teaching-only. Version-2 rounds cycle Parts 1-7; legacy rounds retain their original five-question assignments as Parts 3-7. Reset
of the real draw or section termination revokes learner assignment; Demo draws
never grant access. Preserve role-aware slide counts and the EIU frame.

The seven parts are derived from Practice_Pandas (Part 2) (1).ipynb: Part 1 has
Import Pandas / Read data file / Store DataFrame (3 cells); Part 2 has first ten /
last five rows (2 cells); Parts 3-7 are the notebook's Questions 1-5 (1 cell each).
Do not merge Questions 2 and 3 into one assigned part. Stack every cell in the same
popup, with one shared runtime; preserve submitted code separately per task. Only
Part 1 asks students to perform initial import/read/store; prepare df for the
other independently assigned parts. Keep source Final Answer outside assignments.

Maintenance: retired practice/preparation renderers and unused robot code are
removed. The served JS is minified; notebook downloads are compressed losslessly,
CSV text is stored once and parsed only when needed. Preserve original notebook,
CSV and workbook download bytes. Terminate rotates the local notebook session key,
invalidates bridge generations and attempts the new classroom epoch sync before
returning success; failed live delivery queues reconciliation without erasing
Supabase history. Disabling the Terminate control must not rewind its last epoch.
