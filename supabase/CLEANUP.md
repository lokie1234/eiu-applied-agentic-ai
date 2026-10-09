# Retired access schema cleanup

Migration: `migrations/202610090001_remove_retired_account_access.sql`.

Deploy the matching application changes first, then apply the migration through
the project's existing database migration process. The application works with
both the old and cleaned schemas; it no longer queries the retired tables or
sends `created_by` when creating courses and sections.

The migration removes seven retired tables: `app_users`, `teacher_accounts`,
`user_course_access`, `user_section_access`, `course_folder_allowed_emails`,
`user_unlocked_courses`, and `course_passcodes`. It also removes `created_by`
from courses and sections and the unused administrator `password_hash`.

These objects belonged to username/teacher login and email/section grants.
Current learner and teaching codes, global codes, folder membership and learner
information policy are held in course metadata. Google administrator login still
needs `admin_credentials.session_version`, which is retained.

This migration permanently removes any remaining rows in the retired tables.
Export them before applying if the historical account data must be retained.
No active courses, section files, Drive connections, AI documents, learner
submissions, quiz results, feedback, presence or activity logs are removed.
`learner_profiles` remains for historical report compatibility.

The migration runs in one transaction without `CASCADE`. Unknown dependencies
or a lock timeout stop it without partially cleaning the database. Investigate
those dependencies instead of adding `CASCADE`.

Excel export changes are separate: choosing fewer exported columns and formatting
timestamps does not change the database schema. A database migration is needed
for schema changes, including adding **or removing** tables and columns.
