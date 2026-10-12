# Local course slide sources

`sources.json` binds each reviewed TSX to its course ID and section ID. The authenticated section content API uses this registry before reading an uploaded file. Edit the registered TSX, then refresh or reopen the section to see changes. Download returns the same local source. No Drive update is needed. Production sites require a build/deployment containing the changed files.

For a new course/section TSX, add one registry entry with the verified `courseId`, `sectionId` from the database metadata, and a `path` under `course-content/<course>/`. Complete this binding whenever implementing a requested TSX edit. Bindings use stable IDs, so renaming a course or exported file does not change its display source. Local files are private behind the existing course/section access checks. Missing registered files fail instead of displaying an outdated uploaded copy.

Save to Drive exports the same registered project TSX that is displayed, verifies its bytes and leaves the local display binding unchanged, including when the export is renamed. Uploading a TSX to a registered section does not override the registered project source; the upload response and UI explain this. To switch a registered section to an uploaded source, deliberately remove its local registry binding. Renaming course/section metadata does not affect ID-based bindings.
