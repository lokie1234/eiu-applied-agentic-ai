# Teacher Accounts

## Database setup

Run `supabase/migrations/202610060001_teacher_accounts.sql` in the project's Supabase SQL Editor before deploying this change. It adds `teacher_accounts` and ownership columns on courses and sections. Existing courses and sections remain managed by the main admin.

Also apply `supabase/migrations/202610070001_teacher_course_ownership.sql`. Older databases may already have `created_by` referencing `staff_accounts`; adding the column with `IF NOT EXISTS` does not update that foreign key. This repair points both course and section ownership at `teacher_accounts`, preserves existing rows and fails atomically if a non-null legacy owner needs mapping first. After applying it, verify that a teacher can create a course and section and that both retain that teacher's ID in `created_by`.

## Main admin

Open **Admin Control Center → Teacher Accounts**, beside Authorized Emails and Course Setup & Structure.

- Create teachers with name and login email. The initial password is exactly six random digits, including possible leading zeros.
- Search or filter accounts. **Manage** changes the teacher's name or suspends/reactivates the account without deleting their course content.
- **View password** retrieves the current password only when clicked. This includes a password chosen by the teacher after first login. Only the main admin can use this endpoint; each reveal is recorded in `access_audit_logs` without the password itself.
- **Change password** accepts a password with matching confirmation or generates a new six-digit password. Resetting invalidates the teacher's existing sessions and requires another password change on login.

Passwords are stored as a salted scrypt hash for authentication plus an AES-256-GCM encrypted copy to support the requested admin viewing feature. `TEACHER_PASSWORD_ENCRYPTION_KEY` is optional; the existing `PASSCODE_SESSION_SECRET` (or service key fallback) is used if it is omitted. Configure the same key in local and production environments and keep it stable. Changing the encryption key requires resetting existing teacher passwords to restore password viewing.

The main admin can open **Change password** in the Admin Control Center header. Apply `supabase/migrations/202610060002_admin_password.sql` to enable this feature. Enter the current password and confirm the new password twice. After the first change, the database password replaces `ADMIN_ACCESS_PASSWORD`; previous admin sessions are invalidated.

## Teachers

Teachers sign in using their email and password on the existing login screen. First login goes to `/change-password`. The new password must be entered twice and can be shown/hidden. There are no minimum-length or character-composition rules; passwords must be nonempty, differ from the temporary password, and fit the 1024-character request limit.

After changing the password, `/teacher` provides course creation and section management, including PDF/TSX/PPTX uploads. Teachers can edit their own courses and their own sections; other courses and sections are read-only. Reordering or deleting an entire course cannot modify another user's sections. All courses can be viewed from `/learn` without course passcodes.

Teachers can use **New folder** to create a shared parent folder in the same library used by the main admin, choose a parent folder when creating a course, and move their own courses between folders. Folder creation uses the existing core-course metadata catalog and needs no extra migration. Renaming, deleting, or unlocking folders remains admin-only. The workspace groups courses by folder and supports filtering across My courses and All courses.

Teacher content management also supports creating multiple courses or sections (one title per line), selecting and deleting owned courses/sections in bulk, reordering sections by drag-and-drop, and reordering courses when every course in that folder belongs to the teacher. Mixed-ownership deletion requests are rejected before any content is removed. Teachers can download original section files and upload several PDF/TSX/PPTX files with the same sequential batch uploader, file-to-section mapping, progress and retry behavior used by admin.

Admin and teacher share the icon editor, image preparation, batch uploader and EIU confirmation dialog. Teachers can paste, drop or upload tech-stack icons, edit labels and remove icons on their own courses. Other courses display icons and downloads in read-only mode. Course passcodes, learner authorization, folder-wide access changes and teacher-account administration retain their admin-only permissions.

Teacher login is blocked after five failed attempts within fifteen minutes. First-login requirements, account suspension, and session versions are checked in the database on protected requests.

## Verification

Run:

```text
node --test tests/teacher-access.test.mjs tests/teacher-accounts-ui.test.mjs tests/section-content.test.mjs tests/upload-queue.test.mjs
npx.cmd tsc --noEmit
npm.cmd run build
```

The tests replace database/network boundaries; they do not create live accounts. After applying the migration, verify with two teacher accounts that first login requires a password change, admin password viewing shows the changed password, reset invalidates previous sessions, and neither teacher can edit the other's content.
