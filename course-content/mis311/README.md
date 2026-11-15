# MIS 311 — Business Process Analysis and Problem Solving

## Active Section 1 import

Section 1 currently resolves through its database `local:` binding to
`../imported/86cae0a3-9ada-4e31-b4d4-c83f50cafaf6/b7bd6b13-c654-412b-badb-12853350e148/1066dca1-c75c-477b-bd53-5dec37fc7d5a.js`.
This self-contained import is the editable active source. The generator below
rebuilds the registered archival/default Section 1, not this explicit replacement.
Do not overwrite the active import with that older default.

The active section has 8 slides. In slide 2's Suggested answer, Process Modelling
is a framed native button that opens the former slide 3 in a nested dialog.
Its SVG, staged reveal, definition control and renderer are retained. The view
is created once and cached; closing returns to the same answer, while Escape
closes one layer and restores focus. Pagehide/termination closes both dialogs.
The former standalone model page is removed and later pages are renumbered.
The assigned EIU without reference template and its reserved regions remain.
Narrow model diagrams scroll horizontally to preserve legible labels.

Process reveal progress now survives section/slide navigation and refresh through
`lib/mis311Presentation.ts`, the scoped parent bridge and a sanitized initial
snapshot injected into the sandbox document. Already revealed processes restore
without replay within a course visit. Returning to the course, leaving the
section, termination and successful login all clear the local presentation
snapshot. The bridge rejects old-frame writes after reset and shuts down the
old iframe. Explicit sign-out also clears localStorage. No results or identity
are stored. See `section1-audit.md` for performance changes and verification. Slide 3 removes the Recognise it footer, enlarges its diagram area
and adds a reduced-motion-aware BPMN border glow/shine. Slide 4's questions retain the original non-modal companion panel beside the
process, with 18px body text and 24px headings. Narrow screens stack the process
and questions within a scrollable workspace so they never cover one another.
Slide 5 uses larger type in its full three-card layout and starts with its title centered; four clicks show Scenario, Process to
model, Questions for Analysis, then all three cards. Only one card appears in
each intermediate stage. The full layout restores immediately on revisits;
short/narrow screens scroll within the reserved content region. All five
analysis questions are retained inside the staged example; the former standalone
question page is omitted.

Slide 6 (formerly 7) shows the nine restaurant workflow steps as large numbered
cards. Its
https://www.lucidchart.com/ button builds an inline SVG model matching the
reference: Customer, Front of House, Kitchen and Cashier lanes, with two green
events, seven task boxes and eight routed sequence flows. The button triggers
the transformation locally. Highlighted text travels from its card into the model in a staggered
sequence, with matching node glows and routed-arrow reveals. Reduced motion skips that transition.
The existing parent presentation bridge allows the stable resource key 7 built flag and
restores the completed diagram without replay during slide navigation;
course exit resets it to the nine stage cards. Successful
learner/teaching or admin login now clears this local presentation snapshot before
redirecting; failed logins preserve it. Explicit sign-out also clears it.
Narrow viewports scroll the model horizontally to retain readable labels.

After slide 6 finishes drawing, a Best Practices button opens all five points
from slide 9. Visibility follows the SVG animation completion promises, including
reduced motion and immediate restored diagrams. Closing returns focus to the
button; section termination closes the dialog. Former slides 6, 8 and 9 are
omitted from navigation. Best Practices remains available through the model
button. Former slides 11-12 are merged into current slide 8 as four native cards: Healthcare Patient Admission, E-commerce Order
Fulfillment, Campus Recruitment and GrabFood Order Fulfillment. Every scenario
description and process-to-model line is retained. The desktop 2x2 layout fits
the assigned template; narrow screens stack cards and scroll inside its frame.
Scenario body type is about 22px on desktop (20px minimum), with larger headings
and process labels. Each of the four scenario headings has a staggered animated
underline; reduced motion retains a static underline. Best Practices distributes
its five points through the available dialog height, with responsive type.

The following notes describe the registered default sources and Section 2.


The authoritative source is `MIS 311_Week 7.pptx` (55 slides).
Section 1 contains source slides **1–22**; Section 2 contains **23–55**.
Section 2 displays 10 slides: source slide 24 (Learning Outcomes) is omitted,
with no cover button or dialog. `session2/presentation.json` owns this omission
and applies the same cover style as Section 1. A new SVG topic cover is inserted
after slide 1, with centered Root Cause Analysis and a transparent diagnostic
background. `additionalSlides` owns this addition; archival source records stay
unchanged. The comparison resource in slide 2 is titled Symptom Approach vs. Root Cause and merges source
slides 25-26 into a native HTML comparison, using Section 1's navy/teal cards
and click-to-reveal behavior. Three question selectors control one two-column
comparison layout. Each column reveals only its own perspective, in either order.
Question selection and six independent reveals survive slide navigation and
slide revisits through the parent-owned scoped reveal bridge. Returning to the
course clears both comparison and tree progress; reopening starts hidden.
There is no slide reset button. Section termination also invalidates the old epoch and ends the active iframe. No results or learner
identities are collected. Narrow screens stack the two columns. The slide has no operation instructions,
placeholders or progress counters. Warm-gold and teal glows distinguish the two
comparison panels, with larger naturally wrapped answer text.
The introductory band-aid paragraph and all
comparison illustrations are omitted. Edit `root-cause-comparison.js.txt` and
the `rootCauseComparison` presentation config; original audit sources remain. Both covers share native SVG
content and `cover-style.js.txt` for identical title/subtitle placement and
process decorations within the assigned template.

The tree icon beside Symptom Approach vs. Root Cause opens source slide 28 as a native SVG
problem tree within the comparison resource. Initially only the Problem control is visible. The first click reveals the trunk, canopy and Symptom labels, followed by its
explanation. A second click reveals roots and Cause labels, followed by its
explanation. The larger cropped SVG sits beside two native HTML explanation
cards whose paragraphs wrap naturally without manual line breaks. Revealed
Symptom/Cause labels, canopy, roots and explanation keywords pulse with a soft
green/gold glow on a 2.8-second cycle; reduced motion disables the glow. Revisiting
within the section restores the current stage without replaying its animation.
Narrow viewports stack the explanation cards below the tree. Edit `problem-tree.js.txt`.
The explicit `displaySourceOrder` keeps the tree immediately after the comparison.

The process resource in slide 2 (source slide 27) is a seven-step native HTML flowchart.
Every original process instruction is retained as bullet text. Initially only the
centered title is visible. Clicks 1-7 place the title above a single centered
step; click 8 opens the full flowchart and starts its existing sequential glow.
The current step is saved through the shared scoped bridge until Back to course. The flow runs vertically with numbered connectors. Wide screens place the
step heading beside its bullets, with consistent text sizes and row spacing;
narrow/short viewports stack headings above bullets and allow scrolling inside
the content frame. Step 7 balances its final sentence across lines. A soft
highlight advances from step 1 to 7 every two seconds, repeating on a 14-second
CSS cycle; reduced-motion preference disables the effect.
The process resource is titled General process for performing root cause analysis (RCA).
The Cause Mapping resource combines source slides 29-30 into Cause Mapping & MECE with two distinct
content panels. Cause Mapping explains its causal-map purpose and three phases.
MECE expands both terms and explains No overlap / No gaps. Four question-mark
buttons open short examples for Cause Mapping, MECE, Mutually Exclusive and
Collectively Exhaustive. Native dialogs preserve keyboard focus and support
Escape/backdrop dismissal. Examples are local illustrations with no submissions.
The subtitle, step-reference annotations and closing note are removed. This corrects the old mutually
exclusive wording. It distinguishes organising possible causes from verifying
them with evidence. The former standalone MECE slide is hidden, and Tools for
RCA is available in the same hub. Edit `causeMapping` and `cause-mapping.js.txt`.

Edit `rootCauseProcess` in the presentation config and `root-cause-process.js.txt`.

Section 1 displays 20 slides: source slide 2's three Learning Outcomes are
available through a native HTML dialog on the cover. `session1/presentation.json`
owns this presentation change; its paragraphs wrap naturally without hard breaks.
Source slide 3 (the former displayed slide 3) is omitted at the user's request.
Source slide 4 is now displayed slide 3, a native HTML organisation chart.
Only Managing Director is initially visible. Each parent box reveals its own
reporting level with animation; closing a parent also resets its descendants.
All original reporting lines and twelve positions are retained. The chart fits
inside the existing system template and supports keyboard activation.
The cover title is raised slightly. The popup uses three numbered cards with
staggered entrance animation and a subtly animated border; reduced-motion
preferences disable those effects. Edit `learning-outcomes.js.txt` for its layout.
These bundles replace all previous PDF-derived versions at the same registered
section IDs and JS filenames. No obsolete SVG pages or unused assets remain.
Native SVG text, vector diagrams and existing illustrations are retained.
Raster illustrations come from the source PowerPoint;
no pages or newly generated text are flattened into bitmap images.

The user selected the existing **EIU without reference** system template
(`86101dcf-70f4-49c3-a6a9-983c77708ad2`). The original PowerPoint backgrounds, logos,
header/footer frame and page numbers are removed. The lesson does not embed,
replace or alter the system template. Its transparent content frame reserves
the system's header/logo/footer areas: left 5.6%, top 11.5%, width 88.8%,
height 77.4%. Each content viewport includes the complete source lesson objects,
including diagrams extending past the old footer. System page numbering is
placed inside the template's existing footer circle.

`storyboard.json` retains both complete original source text and content text
without the old footer number for regression checks. `sourceSlide` records the
exact original slide number. All 55 original source records remain for auditing;
the presentation configuration owns the explicitly requested omissions/reflow.

Edit `session1/` or `session2/` SVGs and their `storyboard.json`, then regenerate:

```sh
node scripts/build-mis311-course.cjs
```

To repeat extraction (requires Windows PowerPoint and Python PyMuPDF), export
a private vector rendering under ignored `tmp/`, then convert it:

```powershell
./scripts/export-mis311-pptx.ps1 -Source "PATH/TO/MIS 311_Week 7.pptx" -PrivateRender "$PWD/tmp/mis311-pptx/render.pdf"
python scripts/import-mis311-pptx.py "PATH/TO/MIS 311_Week 7.pptx" tmp/mis311-pptx/render.pdf
node scripts/build-mis311-course.cjs
```

The standalone JS bundles embed all illustrations and export lazy slide
functions for the existing authenticated lesson viewer and JS download route.
The legacy database content type `tsx` is intentional. No PDF or PPTX is
uploaded, served, embedded, or required at runtime. The source PPTX is unchanged.
Course and section bindings are registered in `../sources.json`.


Tools for RCA is a resource in the slide 2 hub. The 5 Whys, Pareto, Fishbone and
Charts/Graphs cards use compact titles and one-frame primary popups. 5 Whys
reflows all six statements into native cards (one at a time on narrow/short
viewports); Fishbone switches Structure/Brainstorm; Pareto separates chart and
notes. Charts/Graphs provides native SVG Run Chart, Histogram and Scatter Diagram
examples about product defects, with brief descriptions and interpretations.
All example datasets are explicitly illustrative. The hub has one primary dialog
and no Blank template, Full reference or Enlarge controls. Original SVG/storyboard
sources remain archived. Source slides 32-35 are omitted from standalone navigation.
Source slide 36 (7 Best Practices)
remains standalone as displayed slide 3.

Source slides 37-38 are combined in the Exercise resource of slide 2.
Objective and Scenario remain complete native paragraphs. The fishbone is redrawn
as native SVG with all six original groups and all thirteen original causes.
Clicking a category reveals only that branch; mobile provides matching controls
and lists. Group reveals use the existing parent bridge and survive slide changes
until Back to course. Original SVG/storyboard and raster sources remain archived.
Edit `toolsHub` / `defectExercise`, `tools-hub.js.txt` / `defect-exercise.js.txt`.


Fishbone's Structure/Brainstorm popup has no Enlarge diagram or Full reference
footer controls. Its native diagram includes every original category and Cause
A-F, with cause labels in separate small boxes outside the sloped bones and extra
space at the Problem end. All other tools also omit template and reference controls.


The Exercise resource now starts with only its centered title. Five clicks
show Objective centered, Scenario centered, both story panels at the top, the
larger Fishbone title with the spine/effect, then the six category controls.
Category clicks reveal their existing causes only after this introduction.
The shared reveal bridge persists exerciseStage (0-5) and the six group flags;
Back to course resets both. Narrow screens use the same stages with a mobile
axis and the existing readable group lists.


Displayed slide 4 (source 39) is a centered Value Stream Mapping topic cover,
matching slide 2's navy title, gold rule and transparent vector backdrop inside
the assigned template. Its What is it ? button opens a title-free popup with the definition at the top and
a corner close button above
a large SVG viewport containing the exact original aerial illustration of four
homes and four cars. The source JPEG is preserved, with native vector rings
for the click annotations. The former second
paragraph and example caption are omitted. Clicking the example (or pressing
Enter/Space) draws four rings outside the cars, including their wheels. Reduced
motion skips the drawing animation. Source 40 is omitted from standalone navigation.
The native modal supports Escape/backdrop dismissal and restores focus to its
trigger. No progress or report data is collected. Edit `valueStreamIntro` and
`value-stream-intro.js.txt`.


The Parts resource inside slide 4 contains the former Parts of a Value Stream Map material.
It merges source slides 41-43 into a two-column native layout. The left flow
retains only the five step titles, with original orange arrow/star vector paths
and four animated connectors showing the reading order. Reduced motion keeps
static arrows. The right panel displays Symbols and Example inline through two
view selectors. All 36 symbols and original symbol descriptions remain in a
paged gallery; the complete example and its two detail views remain available.
Desktop shows four symbols per page; narrower layouts use two. On small screens
the step flow scrolls horizontally and the resource panel sits below it. The old
step explanations and resource dialogs are removed. Source 40, 42 and 43 are
hidden from standalone navigation; Importance of a VSM is now a resource in slide 4.
Edit `valueStreamParts` and `value-stream-parts.js.txt`.


The VSM importance resource and displayed slide 5 (source 44-45) use the same Arial typography, centered
navy headings, navy/teal cards, gold accents and responsive content frame as the
preceding redesigned slides. The Importance resource retains all four VSM benefits in a 2x2
card grid with native decorative icons. Slide 5 retains the complete activity
instruction, both suggested processes, all three questions, the waste definition
and all seven waste types. It separates process examples from questions and
replaces the original bulb raster/mask pair with one native vector bulb. Narrow
or short screens scroll within the reserved content region; no new interactions
or report data are introduced. Edit `valueStreamFollowup` and
`value-stream-followup.js.txt`.


Displayed slide 6 (source 46) is a Conflict Resolution topic cover matching
slide 2's centered navy typography, gold rule and transparent topical SVG art.
The model resource in slide 6 redraws the Thomas-Kilmann model (source 47) entirely as native SVG,
retaining all five modes, outcomes, phrases, both axes and High/Low labels.
Source 48-49 content is merged into How to Use TKI / Example dialogs with three
numbered views each; every instruction, choice, condition, quote and conclusion
is retained. Both dialogs use native focus/dismissal behavior and collect no data.
Source 48-49 are omitted from standalone navigation. Former slides 18-19 are
now 7-8 (source 50-51), with native navy/teal cards and the same Arial title/body
hierarchy as the preceding redesigns. Their full scenario and all discussion and
reflection questions remain. Narrow screens provide readable mode cards beneath
the SVG and natural scrolling within the reserved frame. Edit `conflictSections`
and `conflict-resolution.js.txt`.


Displayed slide 9 (source 52) retains all four conflict-management tips in native
navy/teal cards with the shared Arial typography. Slide 10 (source 53) is a topic
cover matching slide 2, with Six Principles and Case Study resource buttons.
It merges source 54-55: all six Cialdini principle names/definitions are native
text, while the complete case is divided into Background, Proposal, and
Resistance & task. Original illustration attribution remains. Source 54-55 are
omitted from standalone navigation; the section now has 10 slides.

The runtime tools hub ships only source 35's original SVG, because the other
four tools now have native renderers and no reference/template UI. Unused images,
CSS and the unreachable generic figure branch are omitted from the served JS.
Live image bytes (including the Pareto mask) remain unchanged. The symbols
breakpoint listener is removed on pagehide. The source SVG/asset archive is kept
for fidelity checks and editing. See `section2-audit.md` for measured size changes,
whole-section browser checks and verification limits.


The current slide 2 is an RCA hub with five independently floating resources.
Symptom Approach vs. Root Cause and General process are above the central title;
Cause Mapping & MECE, Tools for RCA and Exercise are below. The original
transparent diagnostic SVG background remains. Reduced motion stops drifting,
and hover/focus pauses the target. The comparison card and its resource header
both include a small native SVG tree icon. It opens the original two-click tree
in a nested dialog; closing the tree returns to the comparison.

All resources are created lazily and cached. Comparison, process, tree and
exercise share the parent reveal scope for slide 2, refresh before reuse and
retain their independent progress across navigation. Escape closes one dialog
layer and restores focus. Returning to the course resets this progress;
termination also closes every layer. Source 25, 27, 28, 29, 31 and 37 are hidden
from standalone navigation. Edit `rootCauseHub` and `root-cause-hub.js.txt`.


Slide 4 is a Value Stream Mapping hub using the same floating-topic shell
as slide 2. It retains the original process-themed background and offers What is
it ?, Parts of a Value Stream Map, and Importance of a VSM. Former slides 7-8
(source 41 and 44) are hidden from standalone navigation. The definition is
still title-free, with the exact source illustration and four click-to-circle car
annotations. Parts keeps the five-title flow, all 36 symbols and example views;
Importance keeps all four benefits. All three views are lazy and cached so their
current selections/annotations survive closing and reopening within the frame.
The only allowed parent reveal scope is slide 2. The section now has 10 slides.
Edit `valueStreamHub`, `value-stream-background.svg` and the shared hub renderer.


Slide 6 is a Conflict Resolution hub with three independently floating
buttons: Thomas-Kilmann Conflict Management Model, How to use TKM, and Example.
It preserves the existing speech-bubble background and uses the shared topic
shell. The model is a native SVG resource with all original mode/axis content;
How to use and Example reuse the original three-page mechanisms directly inside
the hub instead of opening from model-footer buttons. Each resource is cached,
including its selected page. Source 47 is omitted from standalone navigation,
so the section now contains 10 slides. Reveal state remains scoped to slide 2.
Edit `conflictHub`, `conflict-background.svg` and `conflict-resolution.js.txt`.
