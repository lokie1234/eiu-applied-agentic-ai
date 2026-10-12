<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Course slide sources

When the user asks to edit a course/section TSX, edit its self-contained file under `course-content/` and ensure its verified course ID and section ID are registered in `course-content/sources.json`. Complete the display binding as part of the edit; do not stop at an unused local file or require a Drive upload. Check the exact course/section metadata before adding a new binding. The section content API reads registered local TSX after its normal authentication/authorization checks, compiles it for display and serves the original for download. Refresh/reopen the section to load edits. Other uploaded sections retain their existing storage source. Keep TSX files included in Next.js output tracing. When the user says redesign, apply the EIU DNA in `public/downloads/design-dna.txt` and the course's DESIGN.md.
