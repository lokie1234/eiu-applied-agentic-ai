---
name: effective-vibe-coding
description: Improve AI coding changes with scoped implementation, targeted verification, safe cleanup, consistent UI typography and layout, and evidence-based performance checks. Use when implementing, fixing, or refining code in a project, especially vibe-coded web interfaces. Pure Q&A and unrelated document tasks do not need this workflow.
---

# Effective Vibe Coding

Complete the requested behavior and make the result easy for a nontechnical user to assess. Use the user's language. Work autonomously within the authorized task; routine implementation, relevant cleanup and checks are part of finishing it.

## Establish the baseline

- Read applicable project instructions and the actual implementation before editing. Preserve the user's chosen framework, language, features, branding and design system. Check version-specific framework docs when the repository requires them.
- Inspect the worktree before editing. Keep pre-existing and concurrent changes separate from your work; do not reset, stash or overwrite them. If an overlapping edit changes the intended behavior, reconcile with the current file or ask about the specific conflict.
- Identify the smallest affected user flow, its related screens/components, package manager and existing check commands. The optional read-only helper `scripts/inspect-project.mjs --root <project>` reports Node project metadata and Git status without running project scripts. For another stack, use its existing tools instead of adding Node.
- For UI changes, read [UI consistency](references/ui-consistency.md). For cleanup or a performance concern, read [cleanup and performance](references/cleanup-performance.md). Load only the guidance needed.

## Implement and complete the local loop

1. Implement the requested outcome using the existing components, tokens and conventions. Share a brief progress update for substantial work. Clarify early only when missing information would materially change the result; continue independent work while waiting.
2. Inspect the changed behavior, including its failure/loading/empty states when relevant. Fix issues introduced by this change. Do not expand into an unrelated redesign, dependency upgrade or whole-project refactor.
3. Remove obsolete code made redundant by this task when its lack of callers is established. Include imports, branches, temporary debug code and replaced styles. Search references and account for dynamic routes, registration, CSS selectors and public APIs. An unreferenced name alone is not proof that a file is unused.
4. Run meaningful checks that match the change. Discover commands from the project and its instructions; do not assume `npm test` exists. Prefer a focused test or type/lint check first, then a build or broader suite when needed for shared/integration changes. For a small style edit, inspect/render the result rather than writing tests that just repeat CSS.
5. Fix relevant failures and rerun affected checks. Avoid repeating passing checks without a new reason. If two attempts at the same failing approach provide no new evidence, diagnose a different cause or state the concrete blocker; do not invent a passing result or loop indefinitely.

Use existing test tools. Add a regression test when a bug or behavior change warrants one. Report baseline failures separately from regressions. If there is no test harness, verify the actual flow or a focused smoke check and say what remains unverified. A passing build alone does not verify fonts, layout or runtime behavior.

## UI and motion quality

Apply the current design system across the affected component family. Compare changed components with siblings for font family, real font weights, line height, type scale, spacing, radius and alignment. Keep deliberate variants; consistency does not mean making every component identical.

Reserve space for dynamic content and controls. Check Vietnamese/Unicode text, sensible line breaks, overflow, responsive layouts and keyboard focus. Prefer transform/opacity for decorative motion and respect reduced motion. Use screenshots and computed layout/font checks when the environment supports them. State when browser inspection was unavailable.

Treat lag as a hypothesis to investigate: reproduce it, inspect relevant rerenders, handlers, requests, timers, animation or layout work, then make the smallest evidenced fix. Do not claim zero lag or apply blanket memoization and dependency additions as a substitute for measurement.

## Git and external actions

This skill does not itself authorize a commit, push, deployment or installation. Carry out those actions when the user's task or existing project workflow authorizes them. For authorized Commit/Push: inspect the active repository, changed files, remote, branch and upstream; stage only the intended changes, check for secrets, and report the resulting commit and destination. GitHub sign-in provides authentication; remote/upstream identify the Push destination. Ask about a missing or ambiguous destination instead of guessing. Respect branch protections and keep unrelated work intact.

Keep tool approval and sandbox settings as configured. Logins and permissions may require the user. The skill cannot bypass them or guarantee every agent will select it implicitly.

## Return a concrete result

Lead with what the user can now see or do. Describe meaningful before → after behavior or visual changes with enough specificity to verify them. Mention cleanup performed, actual checks/results, and any material limitation. Use a short paragraph for a small task; use [the report guide](references/result-report.md) for larger work. Include screenshots or a preview link when useful and actually available.

Avoid dumping patches, a list of touched filenames, or unverified performance claims as the entire answer. Provide diffs or detailed paths when requested or useful for review. Never claim a browser check, automated test, deletion or deployment that did not happen.
