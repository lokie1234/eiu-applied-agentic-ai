<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Course slide sources

Course sections are now self-contained compiled `.js` files under `course-content/`. For Web Development, edit `storyboard.json` / `renderer.tsx.txt` and run `node scripts/build-web-app-course.cjs` to regenerate the JS; do not restore Section TSX files. Ensure the verified course and section IDs remain registered in `course-content/sources.json`. Complete display binding as part of an edit; no Drive upload is needed. The content API authorizes each request before serving local JS bytes unchanged for display and download. The database's `tsx` discriminator remains for backward compatibility with existing uploaded lessons; legacy TSX compilation remains supported. Keep JS sections in Next.js output tracing. When the user says redesign, apply `public/downloads/design-dna.txt` and the course's DESIGN.md.

## Slide editing and verification

Preserve native HTML/CSS slide content, course styling, template branding and readable line wrapping. Regenerate served JS from editable course sources when necessary. Diagnose interactions across learner, teaching and server flows; add meaningful regression coverage and run relevant tests, lint, typechecks and application builds before reporting completion. Report any unresolved failures or verification limits explicitly. The former slide-creation and slide-edit skills have been removed; do not require or restore them.

## Template-aware slide design

When designing or editing a section with an assigned slide template, design the slide content to fit that template's layout. Before editing, resolve the effective template for the target course/section from its current configuration and read the relevant template layout/frame: aspect ratio, usable content area, title/body regions, margins, and reserved logo/header/footer areas. Do not assume a template from the course name or a previous section; if the assignment cannot be resolved, ask for the missing template details before making template-dependent layout decisions.

Compose or reflow native slide content within those regions: adapt columns, cards, typography, spacing and content density while retaining the section's visual identity and functionality. Preserve the template's branding and reserved areas. Applying a background/frame overlay to an unchanged slide is not sufficient. Do not cover the template with an opaque full-slide background, overlap its branding, clip content, or shrink text excessively to force a fit; shorten or regroup content and adjust the composition instead. This requirement takes precedence over preserving the old layout where that layout conflicts with the assigned template. Verify template fit and interactions as part of the requested change.

## Interactive data and reporting

For MIS 301 Section 1, edit `course-content/mis301/storyboard.json` / `renderer.tsx.txt` (`wheel.tsx.txt` / `wheel.css` for the slide 6 wheel) and regenerate with `node scripts/build-mis301-course.cjs`. Follow that course's DESIGN.md. All downloads belong only on slide 1. Class Spotlight is Admin/Teaching-only and uses real Learning usernames through `convex/classroom.ts`; never add a manually entered roster or pick winners in the iframe. One five-second spin reveals the whole group sequentially; require a draw-only reset before another round. Require username/email at Learning sign-in. Convex owns the live classroom projection and atomic draws; Supabase owns identity and durable report/reset history. Use the existing root client, scoped practice bridge and server-owned `lib/mis301Practice.ts` fields for submissions; never collect a second learner identity in a slide.

Before adding section interactions, changing data storage or editing report/export/reset behavior, read [docs/interactive-data-flow.md](docs/interactive-data-flow.md). Supabase owns durable results, identities, permissions and report history; Convex owns ephemeral presence and scoped change notifications. Save reportable data to Supabase first, then notify Convex through the durable revision feed. Use actual course/section IDs, shared interactive components and the root realtime client. Never create a polling loop or duplicate learner/result storage for each new slide. Public Convex functions must enforce their own authorization and rate limits. Keep the Supabase fallback when Convex is unavailable, and preserve legacy compiled-lesson adapters until they are explicitly migrated.

The report route assembles data; `lib/reports/workbook.ts` owns workbooks and human filenames (`Course_Section_YYYY-MM-DD.xlsx`). Export exactly two sheets: `Tổng quan` and `Thống kê`. One statistics row combines a learner session's identity/login information and results for a selected section. Successful login must generate rows before section entry. Result columns appear automatically from that scope's stored activities; repeated submissions get numbered columns. Do not hardcode section-specific columns. Do not export participation, activity-journal or individual quiz-question sheets/content; keep quiz score/max/accuracy/completion time. New reportable activities follow the `ACTIVITY_SUBMITTED` contract in the shared data-flow guide. Never merge distinct signed sessions by name/email or delete source history to simplify Excel. Keep secrets in environment variables; deploying Convex does not deploy Vercel or configure its environment.
