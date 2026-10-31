# Passcode scope rules

Every code resolves to exactly one scope and one access role. Duplicate codes
across scopes or roles are rejected when saving; ambiguous historical codes deny
access until an administrator replaces them with unique codes.

| Credential | Granted scope |
| --- | --- |
| Global | All active, visible folders/courses/sections |
| Folder | Active, visible descendants of that folder |
| Course | Active, visible sections of that course |
| Section | That active, visible section only |
| Free access | Visible sections without a section/course/folder Learning lock |

Free sections are never appended to a scoped passcode login. A Learning code
never grants Teaching permissions. Parent Teaching codes still cover descendant
sections; a section Teaching code does not grant permissions to its siblings.
Hidden, draft and archived content remains excluded from non-admin access.

`lib/auth/passcodes.ts` is the shared resolver for sign-in and current session
authorization. It accepts the already-loaded catalog, builds lookup Maps/Sets
and returns filtered courses and sections without extra database requests,
global grant caches or per-section API calls. Existing signed sessions are
resolved against the current catalog, so code changes/revocation apply to them
too. Durable learner identity and report history are not rewritten.

Section codes use the existing `sectionAccessCodes` metadata keyed by real
section IDs. A section can only be configured under its owning course. Legacy
`sectionPasscodes` metadata is preserved for compatibility, without introducing
another overlapping credential lookup.

Bulk updates validate all targets and code collisions before writing. Section
updates sharing a course are grouped into one metadata write. Confirmed unhide
for a section reveals only its ancestors and that section, preserving hidden
siblings; course/folder updates can reveal their selected descendants.
