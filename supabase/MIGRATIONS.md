# Maintained SQL files

SQL files are not classified as unused merely because they do not contain
`CREATE FUNCTION`. Table definitions, constraints, RLS, indexes, content storage,
Drive integration and security projections are required by live application code.

The obsolete setup scripts for GAS/OTP section grants, course-grant promotion,
physical course passcodes, folder email allowlists, remembered per-account
unlocks and teacher ownership were removed from the working tree. Their objects
were already retired by `202610090001_remove_retired_account_access.sql`.
The course-language migration now contains only its active language-column change.
The old OTP transport removal is included in the retained cleanup migration.

This is repository file cleanup, not a command to delete production records or
edit Supabase's applied-migration ledger. Do not rerun historical creation scripts
on an existing database just because the local file list changed. Older versions
of removed files remain recoverable from Git when auditing a historical release.
This project documents manual SQL Editor migrations; deployments using a CLI
migration ledger must reconcile their recorded history before switching to this
pruned source set.

Retain the following groups:

- Interactive tables, learner-profile compatibility, quiz state and termination:
  consumed by existing compiled lessons, restore, reset and report export.
- Course catalog, section files, source library and language metadata:
  consumed by course administration and lesson serving.
- AI knowledge/search migrations: the protected admin AI APIs remain implemented.
  Removing a lesson toolbar link did not remove that backend.
- Administrator session version and Google Drive tables: authentication and Drive.
- `202610090001_remove_retired_account_access.sql`: compatibility cleanup for old installations.
- `202610280001_request_rate_limits.sql`: distributed request limiting.
- `202610280002_realtime_signals.sql`: minimal Supabase-to-Convex change feed.
- `202610280003_practice_signals.sql`: practice submission retry protection and activity notifications for the existing change feed.

For current interaction/report ownership and rollout, read
[the shared data flow](../docs/interactive-data-flow.md).
