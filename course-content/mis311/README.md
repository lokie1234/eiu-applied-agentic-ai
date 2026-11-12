# MIS 311 — Business Process Analysis and Problem Solving

The authoritative source is `MIS 311_Week 7.pptx` (55 slides).
Section 1 contains source slides **1–22**; Section 2 contains **23–55**.
Section 1 displays 20 slides: source slide 2's three Learning Outcomes are
available through a native HTML dialog on the cover. `session1/presentation.json`
owns this presentation change; its paragraphs wrap naturally without hard breaks.
Source slide 3 (the former displayed slide 2) is omitted at the user's request.
Source slide 4 is now displayed slide 2, a native HTML organisation chart.
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
