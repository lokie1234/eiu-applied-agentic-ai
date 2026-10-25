---
name: slide-creation
description: Edit course slides in existing projects. Apply automatically to slide requests; minimize tokens while preserving section design, layout, and functionality without text images or awkward line breaks.
---

# Slide creation & editing

- Make only the requested change. Go straight to the user's target point. Preserve layout, section styling, interactions and downloads; no incidental refactoring.
- No text images: slides use native text, HTML and CSS only. Do not generate images, prompt text-to-image or embed unnecessary bitmaps.
- Prevent awkward line breaks (orphan words): ensure headings and bullet points do not drop a single hanging word to the next line. Use semantic line grouping, `&nbsp;`, `text-wrap: balance` or `text-wrap: pretty`.
- Never break the slide layout: budget column widths and total content height, including padding, gaps, borders and wrapped lines, against the existing slide frame. Keep content and controls inside their cards without overlap, clipping or accidental scrolling. Do not hide overflow or shrink text excessively to mask a layout problem.
- Before editing slide-specific CSS, check how the renderer maps displayed slide numbers to layoutNumber and which DOM attributes actually render. Prefer a stable visual identifier for selectors; never assume the displayed slide number equals data-slide. Scope controls such as checkboxes explicitly so shared input styles cannot enlarge them.
- Keep the composition balanced: give dense content more space, align card edges and maintain consistent spacing and readable type. When adding rows, adjust the whole affected layout; shorten wording or regroup content before forcing it into the old dimensions. Use nowrap only for short labels that fit; wrap longer text at meaningful phrase boundaries, never arbitrary words or single-word final lines.
- Assess document-loading impact briefly. Reuse valid conversation context; do not reread unchanged skills, AGENTS.md, design guides or source fragments.
- Read only the target slide and relevant renderer function/CSS. Never dump entire storyboards, renderers, generated JS or embedded/base64 assets. Use bounded extracts, normally 500-1,000 output tokens per read; expand only for a concrete unknown.
- Prefer one focused read, then one precise edit plus required generation. Avoid broad searches, repeated inspection, large diffs and speculative alternatives.
- No preview, browser, screenshot, test, lint, typecheck or application build unless explicitly requested.
- In eiu-applied-agentic-ai, edit course-content/<course>/storyboard.json / renderer.tsx.txt; regenerate served JS once after the complete edit via `node scripts/build-web-app-course.cjs`. Keep sources.json bindings.
- Stop immediately after synchronization. Reply in one or two Vietnamese sentences, without repeated checklists or unperformed verification claims. Prioritize speed.
