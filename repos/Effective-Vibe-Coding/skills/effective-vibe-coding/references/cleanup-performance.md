# Cleanup and performance

Use when removing code or addressing lag, flicker, slow loading or excessive resource use.

## Cleanup follows evidence

Remove redundant code introduced or superseded by this task as part of completing the change. Verify callers with repository search, the relevant compiler/linter or dependency graph, and the app's registration conventions.

Check indirect uses before deleting: dynamic imports, file-based routes, package exports, plugin registries, string-based selectors, migrations, configuration, downloadable assets and generated-source inputs. Public APIs or externally loaded files may have callers outside the repo. Preserve them unless removal is in scope and compatibility is understood.

Delete obsolete imports, unreachable branches, replaced styles and temporary debug output when proven redundant. Remove a dependency only after checking production/test/tooling usage; keep the existing package manager and update its lockfile consistently. Never delete another person's uncommitted files or batch-remove files simply because their names contain `old`, `unused` or `temp`.

## Investigate the reported symptom

Record the trigger and a baseline using available evidence: render count, request count, a performance trace, timing, layout-shift entries or a reproducible interaction. Compare in the same environment/build mode. Distinguish development-only behavior from a production regression.

Inspect only plausible causes: state lifted too high, unstable keys/remounts, expensive work on every render, effect dependency loops, duplicate listeners, uncleared timers, stale requests, large assets, font loading, animation-driven layout and too much blur. Fix the actual cause; use memoization, virtualization, caching, lazy loading or debouncing when supported by that evidence.

Recheck the same interaction and relevant neighboring flows. Report the measured improvement if measured. Otherwise explain the specific mechanism changed and state that the performance effect was not quantified. Keep functional correctness, accessibility and maintainability ahead of speculative micro-optimizations.
