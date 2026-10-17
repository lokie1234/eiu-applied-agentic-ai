<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Course slide sources

Course sections are now self-contained compiled `.js` files under `course-content/`. For Web Development, edit `storyboard.json` / `renderer.tsx.txt` and run `node scripts/build-web-app-course.cjs` to regenerate the JS; do not restore Section TSX files. Ensure the verified course and section IDs remain registered in `course-content/sources.json`. Complete display binding as part of an edit; no Drive upload is needed. The content API authorizes each request before serving local JS bytes unchanged for display and download. The database's `tsx` discriminator remains for backward compatibility with existing uploaded lessons; legacy TSX compilation remains supported. Keep JS sections in Next.js output tracing. When the user says redesign, apply `public/downloads/design-dna.txt` and the course's DESIGN.md. Desktop uses `lib/tsxDocument.ts`, the same isolated renderer as web; run `npm --prefix desktop-player run prepare:assets` after changing it.
