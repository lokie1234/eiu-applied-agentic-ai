# Access with passcodes or Google

Google sign-in is reserved for the configured administrator. Username, teacher-account and password-admin login routes have been removed.

In **Admin → Passcodes**, configure global Learning and Teaching codes at the top. Global codes open all active, visible courses and bypass local codes. Hidden content remains excluded. Below, search and select a folder or course to configure its two independent codes:

- **Learner**: view lessons, submit interactions and take quizzes.
- **Facilitator**: view lessons and learner interactions, see presence counts and open quizzes. This role cannot manage courses, access admin tools, export reports, reset data or terminate sessions.

Folder and course codes cover their active, visible sections. Course access automatically includes its visible sections. Section-level codes are no longer accepted; historical section-code fields are retained only as legacy metadata and never grant or restrict access. Parent codes continue to apply when a direct course code is cleared. A scope is free for Learning when no Learning code is configured anywhere in its folder/course path. Global codes do not lock free content. Clearing a course code does not remove a folder lock. Teaching is never free. The landing page **Browse free courses** action creates a unique learner session containing only free content. Reconfiguring a Learning lock withdraws that content on the next authenticated request. New scopes start without direct codes; use **Generate** or **Save** to configure them. Existing learner course codes remain available.

Both passcode roles start at the folder/course chooser. An old active-section cookie does not reopen a lesson automatically; explicit section links still work for visible, authorized content.

Folder, course and section visibility is managed in Admin. Hidden items remain manageable there but disappear from the learning catalog for every role. The learning catalog refreshes when the browser tab regains focus and every 30 seconds while visible. An open section that becomes hidden is withdrawn on refresh without resetting other visible decks.

Changing or clearing a code revokes its existing sessions on subsequent authenticated requests. Shared passcodes create a unique learner identity for each login, so learners do not overwrite one another's quiz results. These identities are session-based rather than named user accounts.

Global codes are stored once in the core course metadata; local codes use the existing course metadata storage; no new database migration is required. Historical account tables and learning records are retained. `PASSCODE_SESSION_SECRET` still signs the session cookie. `ADMIN_ACCESS_PASSWORD` and `TEACHER_PASSWORD_ENCRYPTION_KEY` are no longer used.

Built-in quiz and interaction controls are scoped to the Applied Agentic AI sections that implement those features. Custom uploaded decks retain their existing functionality.

Validation: `node --test --test-timeout=30000 tests/*.test.mjs`, `npx tsc --noEmit --incremental false`, and `npm run build`.


## Bulk management and hidden content

Select folders and courses with their checkboxes, or select all scopes matching the current search. Choose Learning, Teaching, or both, then Generate selected or Clear selected codes. Generation replaces codes with unique six-digit values. Clearing affects only selected scopes and access types; global and unselected codes remain available. Clearing does not change visibility.

Generating or saving a nonempty code for hidden content requires an English confirmation. Confirming Unhide & generate unhides the selected folder and its courses/sections, or the selected course, its sections, and its parent folder. Sibling courses remain hidden when generating only a course code. Draft content is never published by this action. The server independently checks confirmation before any changes.

The full request is validated before writes. Multiple course writes are not a database transaction: if storage fails partway through, the API reports partial progress and returns the refreshed catalog rather than reporting success.
