# Version 1 Database Decisions — Latest Code Review

## Review basis

This review uses the current workspace files and Git history, not an earlier code snapshot. The application is still a browser-only prototype: the current JavaScript reads and writes `localStorage` / `sessionStorage`; no application API or database driver is present. `database.schema.sql` is an unapproved draft, while `database/migrations/001_initial_schema.sql` remains comments only. Neither was executed or changed.

The SQLTools settings contain a connection configured for `u659680966_bitssims_dev` at `srv1093.hstgr.io:3306`. No live SQLTools query capability was available in this session, so neither `SELECT DATABASE();` nor `SHOW TABLES;` was run. The active database and its existing objects are unknown.

Current code reviewed: `index.html`, `demo-tools.html`; `accounts.js`, `auth.js`, `data.js`, `registrar.js`, `registry.js`, `script.js`, `staff.js`; `style.css`, `reports.css`, `registrar.css`, `staff.css`; root `README.md`, `codeswing.json`, `.vscode/settings.json`; `database.schema.sql`, `Hostinger school database.session.sql`, and all three existing files under `database/`. Image assets were inventoried but not treated as data-contract sources.

## 1. Features required for a first working version

These are recommendations inferred from workflows currently represented in the code, not a claim about an unseen assignment rubric.

1. **Server-backed identity and access control.** The current six roles are `ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`, `FACULTY`, `REGISTRAR`, and `STUDENT`. The UI supports account lifecycle, role/permission management, login lockout, password changes, and password reset. Role checks and credentials are currently in client JavaScript and browser storage, so they do not provide production authentication or authorization.  
   **Why:** users must authenticate against shared, protected records, with authorization enforced outside the browser.  
   **Affects:** `users`, `roles`, `permissions`, login/access-control features.  
   **Change:** schema + backend + frontend integration.

2. **Student registry and profile.** Support student numbers, names, birth date, contact and guardian details, program, department, year, admission type, status, and a student account/profile association. Retain the student name-change request and registrar approval workflow.  
   **Why:** registration and profile screens read/write these records and approvals must update an official record.  
   **Affects:** `students`, `student_accounts` or equivalent, profile preferences, `profile_correction_requests`.  
   **Change:** schema + backend + frontend integration.

3. **Admissions and two distinct enrollment stages.** Preserve application review/decision, registrar term-enrollment verification, and course/section enrollment as distinct processes until the team confirms whether they should be unified. Include the student portal’s accepted-application enrollment steps and selected offerings.  
   **Why:** these workflows have different statuses and data; treating them as one enrollment row loses process state.  
   **Affects:** `admissions_applications`, a term-registration table, course-section enrollments.  
   **Change:** schema + backend + frontend alignment.

4. **Terms, programs, courses, sections, and schedules.** Persist the current academic catalog and the class offerings assigned to faculty, with room, day/time, modality, capacity, and operational status. Current code’s stated scope is third-year, face-to-face, Finals-only; do not broaden it without approval.  
   **Why:** current screens use these values for class assignment, conflict checks, rosters, and student enrollment.  
   **Affects:** `departments`, `programs`, `academic_terms`, `courses`, `rooms`, `course_sections`.  
   **Change:** schema + backend + frontend integration.

5. **Attendance sessions and records.** Store one class meeting and one result per enrolled student, including the code’s status, time-in/time-out, remarks, draft/submitted state, and alert thresholds.  
   **Why:** the faculty workflow edits and submits a roster for a dated meeting; summary totals alone cannot reproduce or audit that workflow.  
   **Affects:** `class_meetings`, `attendance_records`, policy/settings, optional alert records.  
   **Change:** schema + backend + frontend integration.

6. **Assessment scores through official grade release.** Persist assessments, student scores, calculated period results, the faculty → department head → registrar workflow, returned remarks, and the final grade visible to the student.  
   **Why:** staff maintain detailed weighted assessments while the student portal currently has a separate official-grade store; both must converge on one authoritative result.  
   **Affects:** assessment, grade-sheet/review, and official-grade tables.  
   **Change:** schema + backend + frontend alignment.

7. **Document requirements and requests.** Store per-student requirement state and review remarks; accept supported uploads through private file storage and retain only authorized file metadata/key in the database. Keep COR/COE/TOR requests and their release state.  
   **Why:** files are currently only held in memory for previews and metadata in browser storage; registrar and student views need a shared, durable record.  
   **Affects:** a requirement catalog, `student_documents`, `student_document_requests`, private storage service.  
   **Change:** schema + backend + frontend integration.

8. **Audit and user preferences.** Preserve attributable changes for registrar/staff actions and user-specific portal preferences. Keep report generation/export available only within approved role scope.  
   **Why:** role screens rely on audit history and saved notification settings; client-side logs are not authoritative.  
   **Affects:** `audit_logs`, user preferences, role/permission enforcement.  
   **Change:** schema + backend + frontend integration.

## 2. Assignment requirements not yet implemented

No assignment brief, marking rubric, or referenced design-reference document is present in the current workspace. Code comments cite external design-reference sections, but those sources are not included. It is therefore **not possible to identify which assignment requirements are unimplemented without inventing requirements**.

The following are directly observable implementation gaps, not assertions about the assignment:

- No application backend/API or database integration exists; all listed stores remain browser-local. This prevents multi-user, cross-device records and server enforcement. **Affects all tables and workflows. Change: backend + frontend integration, and schema.**
- `accounts.js` contains demonstration credentials, and browser-side password handling uses prototype hashes. Password reset codes appear in a demo inbox; no email service, server-side secure hashing, or authenticated server session is present. **Affects `users` and authentication. Change: backend + frontend; schema for durable account/recovery state as approved.**
- File selection validates basic type/size, but the file itself is not durably uploaded or served from private storage. **Affects student documents. Change: backend + frontend; schema for file metadata.**
- Staff backup and monitoring views use simulated/sample state; notification preferences and attendance alerts do not constitute delivery. **Affects infrastructure and optional notifications. Change: backend/infrastructure; schema only if the team requires durable history.**
- The registrar’s class-enrollment panel includes sample display rows, while the student enrollment wizard and registrar term-enrollment records are separate stores. The sample roster, registry, accounts, and academic records also have separate ownership. **Affects enrollment/identity/grade relationships. Change: schema + backend + frontend alignment.**

## 3. Future features to postpone

- **Real backup scheduling, restore execution, and system monitoring:** current views are mock/sample data, not a working backup or telemetry service. Do not model these as core academic tables unless they are confirmed in the assignment scope. **Affects infrastructure. Change: backend/operations; schema only if persistence is approved.**
- **Email/SMS delivery and notification queues:** first persist preferences and any required alert event; defer delivery integrations until a provider and policy are approved. **Affects preferences/notifications. Change: backend + frontend; optional schema.**
- **MFA enforcement:** the account UI has an MFA flag, but login has no second-factor challenge. Decide whether this is a real V1 requirement before designing enrollment/challenge tables. **Affects authentication. Change: backend + frontend; schema if approved.**
- **Broader academic coverage:** additional year levels, modalities, or grading periods are not part of the current code’s declared narrowed scope. Keep the data model extensible, but defer the extra workflows and seed data. **Affects terms, sections, and grading. Change: frontend/backend; possibly configuration, not necessarily new tables.**
- **Persistent generated-report archives:** reports are generated/exported and recent-report metadata is stored in browser state. Defer archived report files unless an assignment or policy requires retention. **Affects reporting. Change: backend and optional schema.**

## 4. Schema problems to fix before the first migration

1. **Enrollment is overloaded.** `registry.js` has term-level `Pending → Verified → Enrolled` records; class offerings have roster enrollment; the student wizard saves personal details, requirement completion, selected course codes, and completion state. The draft `enrollments` table represents only student-to-section enrollment and has different statuses.  
   **Why:** a single table cannot correctly represent all three workflows.  
   **Affects:** `enrollments`, admissions, capacity checks.  
   **Change:** schema + backend + frontend alignment.

2. **Identity and account ownership are not unified.** Demo accounts, registry students, staff account rows, and academic data are separate browser objects. The code uses a student number as a login identifier and staff usernames for class assignment; the draft adds `student_accounts` but the application has no corresponding relation. Account forms assign one role at a time, while `user_roles` allows multiple roles.  
   **Why:** migrations and foreign keys require one canonical account/person model and a deliberate single-role or multi-role rule.  
   **Affects:** `users`, `students`, `student_accounts`, `user_roles`, `staff_profiles`.  
   **Change:** schema + backend + frontend alignment.

3. **Staff identity/profile data is missing from the draft.** `accounts.js` and staff pages use job title, department/code, employee number, hire date, and contact details. `users` has name/email/mobile/office, but not a staff profile or department assignment.  
   **Why:** staff scope, faculty assignment, and profile pages must refer to persistent staff records.  
   **Affects:** `users`, departments, staff profiles, sections.  
   **Change:** schema + backend + frontend integration.

4. **Grades have two incompatible models.** `data.js` stores an official final grade and release state for a student/course; `staff.js` separately stores per-assessment maximum, weight, date/type, scores, period status, and return notes. The draft `academic_grades` stores only a grade value/status and actors, so it cannot reproduce weighted assessments or the grade-sheet lifecycle (`Draft`, `Submitted`, `Returned`, `Approved`, `Posted`). `INC` is represented as a code/status in the app, not an ordinary numeric grade.  
   **Why:** grade calculation, approval, correction, and release must share one source of truth.  
   **Affects:** `academic_grades` and missing assessment/sheet/history tables.  
   **Change:** schema + backend + frontend alignment.

5. **Grading policy is underspecified.** `staff.js` converts percentage thresholds to numeric grades; `data.js` separately defines passing/failed grade, Dean’s List cutoff, and attendance-rate thresholds. Draft `grade_scale` has only maximum grade and verbal equivalent.  
   **Why:** the current columns cannot express the mapping or policy used by the screens, and the two grade-rule sources need reconciliation.  
   **Affects:** `grade_scale`, academic settings, grade calculation.  
   **Change:** schema + backend + frontend; team approval of the grading rules.

6. **Attendance fields/statuses do not match.** The draft attendance enum omits `Left Early`; current rows also have time-in, time-out, remarks, and an `Open`/`Submitted` meeting workflow. Attendance alerts are derived from configurable absence/tardiness thresholds.  
   **Why:** the schema would discard values needed by the staff workflow and cannot preserve submission/reopen state.  
   **Affects:** `class_meetings`, `attendance_records`, settings/alerts.  
   **Change:** schema + backend + frontend alignment.

7. **Application and term-enrollment states need a canonical map.** Admissions uses `pending`, `review`, `accepted`, `rejected`, and `withdrawn`; enrollment completion may also show `enrolled`. Registrar term enrollment uses `Pending`, `Verified`, `Enrolled`. The draft admission enum omits `withdrawn`/`enrolled`, and its enrollment enum omits `pending`/`verified`.  
   **Why:** status constraints must match separately defined processes rather than conflating them.  
   **Affects:** `admissions_applications`, term enrollment, class enrollment.  
   **Change:** schema + backend + frontend alignment.

8. **Account-security state is incomplete.** The draft `users` row lacks the current code’s MFA flag, must-change flag, failed-attempt count, lockout-until, and last-login state. Reset requests currently have hash, issue/expiry time, attempt count, and used state in browser storage; these must not be copied as plaintext codes. Server sessions are also absent from the app.  
   **Why:** moving authentication server-side requires defined durable lockout/recovery behavior and safe credential handling.  
   **Affects:** `users` and missing authentication/recovery state.  
   **Change:** schema + backend + frontend. Decide whether sessions are database-backed or secure server-managed.

9. **Profiles and preferences need an owner and representation.** The student profile includes email visibility, timezone, country, city, phone, personal email, address, avatar, and four notification preferences. Staff and registrar have separate contact/alert preferences. The draft places several student fields in `students` but has no user-preference model; preference ownership is unclear.  
   **Why:** profile/contact data can diverge from official student records and must not be overwritten by unrelated edits.  
   **Affects:** `students`, `users`, a profile/preferences table.  
   **Change:** schema + backend + frontend alignment.

10. **Audit records need a consistent, non-synthetic shape.** Staff audit objects contain actor, time, module, entity, record key, action, description, result, previous/new values, and an IP value; registrar activity uses the same service. Some current sample IPs are fabricated. The draft audit table stores only a subset.  
    **Why:** audit fields and provenance must be defined before records are relied on; sample IPs must not be migrated as real events.  
    **Affects:** `audit_logs`.  
    **Change:** schema + backend; frontend must send actor/context, not authoritatively assign it.

11. **Sample datasets are not a migration seed.** Student numbers/rosters, class schedules, terms, accounts, and academic records are held in separate sample stores and do not describe one relational dataset.  
    **Why:** importing them would create misleading foreign-key relationships and expose demonstration credentials/data.  
    **Affects:** all seed/reference data.  
    **Change:** schema is unaffected; create reviewed, fictional seed data and backend/frontend setup separately if needed.

## 5. Questions requiring team approval

1. What exact assignment rubric or design-reference document defines required V1 scope? No such document is present in this workspace.
2. Is the narrowed code scope (third year, face-to-face, Finals only) the approved database scope, or only temporary demo data?
3. Should accounts have one role (as the account form currently allows) or multiple roles (as the draft join table allows)? Which permission matrix is authoritative: `staff.js` capability lists or its editable permission matrix?
4. Are registrar term enrollment and course/section enrollment separate approvals? Which enrollment screen/workflow is authoritative for the student?
5. What are the official grade conversion thresholds, passing/failing rules, INC behavior, and attendance treatment for late, excused, and left-early marks?
6. Which application statuses are valid, and when does acceptance create a student record, term enrollment, and course enrollments?
7. Which identity fields are official student records versus editable portal preferences? What staff profile fields and department/class scopes must be retained?
8. Which document requirements are configurable, where are uploaded files stored, and what are their access/retention rules?
9. Are MFA, account activation, reset-code email delivery, session timeout, attendance alerts, and notification delivery required in V1?
10. Are backups, monitoring events, and generated-report history application data or infrastructure responsibilities?
11. What timezone and timestamp policy applies to user-entered dates and audit events?
12. What do the read-only Hostinger checks return? Confirm the active database and existing table inventory before approving any migration; neither is known from this review.

## 6. Differences between the earlier project version and current code

Based on the current Git history (not cached source), the code has moved from the earlier generic registrar/admin prototype:

- The old `admin.js` / `admin2.js` portal was removed and split into `registrar.js`, `registry.js`, and `staff.js`. Registrar responsibilities are separated from ICT/EdTech/Department Head/Faculty portals.
- `accounts.js` adds role-specific demonstration accounts; `auth.js` adds shared login handling, lockout, password changes, and password-reset flows. Staff account/security workflows are also implemented in `staff.js`.
- Staff functionality now includes user accounts, editable role permissions, audit trails, sample backup/monitoring, schedules, attendance sessions, assessment scores, grade review, reports, policy settings, and staff account details.
- `registry.js` is now the shared student/setup/term-enrollment sample store; the student academic store is Finals-only and versioned. Current code comments narrow sample scheduling to third-year, face-to-face classes.
- Git history records scope revisions in `1348527` and password-reset/lockout changes in `0cf27a0`, both on 2026-11-10; `b93c721` introduced the portal split. The current checkout is merge commit `062ce13`.
- The existing `database/design/v1-decisions.md` and migration remain placeholders. A separate root `database.schema.sql` contains a 24-table draft but is untracked and unapproved; `Hostinger school database.session.sql` contains only `SHOW TABLES;`, not query results.

**Why it matters:** the earlier table proposal was based on fewer workflows and does not model the current staff, enrollment, security, and grade-sheet paths.  
**Affects:** the whole draft schema and portal integration.  
**Change:** update the planning/schema design and later the backend/frontend; do not treat the earlier SQL draft as approved.

## 7. Recommended Version 1 tables and fields

This is a planning list, not migration SQL.

- **`users`** — id, unique username/email, password hash, account status, MFA enabled, must-change-password, failed attempts, lockout-until, last login, created/updated timestamps. Keep only securely generated password hashes.
- **`roles`, `permissions`, `role_permissions`, `user_roles` (or a single `role_id`)** — stable role and permission codes, descriptions, assignment timestamps if useful. Decide single versus multiple role assignment first.
- **`students`** — student number, first/middle/last name, date of birth, department/program, year level, admission type, official status, institutional email, personal email, phone, city/country/address, guardian and emergency contact fields, avatar storage reference, timestamps.
- **`staff_profiles`** — user id, employee number, title, department, hire date, work contact details; separate from login credentials.
- **`user_preferences`** — user id, email visibility, timezone, notification preferences (admissions, grades, documents, announcements, and approved staff preferences).
- **`departments`, `programs`, `academic_terms`, `rooms`, `courses`** — stable codes, names, relationships, active/current state, units, room capacity/status, and approved term dates.
- **`course_sections`** — section id, term/course, section code, year level, assigned faculty user, weekday and start/end time, room, modality, course type, capacity, status. Keep enrolled count derived from active enrollments rather than independently editable where possible.
- **`admissions_applications`** — application id, applicant account/student reference, submitted program/type/term, status, submitted/verified/decision timestamps, reviewer, remarks; add a submitted identity snapshot only if the team requires it.
- **`term_enrollments`** — student, term, program/year, pending/verified/enrolled status, verification/approval actors and timestamps. Do not reuse the class-enrollment table for this.
- **`class_enrollments`** — student, course section, enrollment status, created/approved actor and timestamps, unique student/section constraint; capacity and duplicate checks must be enforced server-side.
- **`document_requirements`, `student_documents`, `student_document_requests`** — requirement code/name, student, document status, private storage key, original name, MIME type, size, upload/review timestamps, reviewer and note; request type/status and request/release actor/timestamps.
- **`profile_correction_requests`** — student, field, old/requested values, reason, pending/approved/rejected status, remarks, submitted/reviewed timestamps and reviewer.
- **`class_meetings`, `attendance_records`** — section/date, meeting status, submitter/submission time; meeting/student, status, time-in/out, remarks, marked actor/time. Preserve the approved attendance status vocabulary.
- **`grade_assessments`, `assessment_scores`, `grade_sheets`, `academic_grades`, `grade_status_history`** — assessment metadata and weights, per-student scores, one sheet per section/period, draft/submitted/returned/approved/posted transitions and notes, official student grade including INC representation, and attributable history.
- **`grade_scale` and academic policy/settings** — percentage-to-grade mapping, verbal label, passing/failed rules, Dean’s List cutoff, and attendance thresholds, if these are configurable school policy.
- **`auth_lockouts` / `password_reset_tokens`** — user, failed-attempt/lockout state, hashed reset token/code, created/expiry time, attempt count, consumed time, and resend controls if implemented server-side.
- **`audit_logs`** — actor user, timestamp, module, entity, record key, action, description, result, previous/new values, and server-observed source IP if approved by policy.
- **Optional only if approved:** attendance-alert history and report-generation metadata. Keep backup artifacts and live monitoring data in the appropriate operations service unless the assignment explicitly requires application records.

## 8. Fields/features used by current code but missing from the planned schema

- **Staff profile/scope:** `employeeNo`, `hired`, `title`, `dept`, `deptCode`, assigned faculty and user-scope fields. The draft has no staff-profile table or explicit user department scope.
- **Account state:** `mfa`, `mustChange`, `failed`, `lockoutUntil`, `lastLogin`, pending activation/inactive/suspended statuses, and password-reset `codeHash`, issue/expiry, tries, used, and resend timing. The draft `users` row has only a coarse status and no reset/lockout table.
- **Student portal preferences:** `emailVisibility`, `timezone`, and notification flags. Some contact fields are in the draft `students`, but there is no user-owned preference model.
- **Admissions/enrollment:** `withdrawn`, enrollment wizard personal draft/saved data, requirements completion, selected offering codes, units, and completion timestamps. The draft has no term-enrollment workflow or wizard-to-offering relationship.
- **Assessment workflow:** assessment type/name/date/maximum/weight, per-student score, calculated percentage, grade-sheet status, returned note/by/time, and one shared link to the posted academic grade. None of the assessment/sheet tables exist in the draft.
- **Attendance:** `Left Early`, `timeIn`, `timeOut`, per-student `remarks`, meeting `Open`/`Submitted` state and recorded time, plus configured alert thresholds/recipients/enabled state. Draft attendance rows support only four statuses and no meeting submission state.
- **Class offerings:** `year`, `modality`, and offering `type` (`Lecture`/`Combined`) appear in staff class data but not in draft `course_sections`.
- **Audit:** `mod`, `ent`, `rec`, `act`, `desc`, `status`, `prev`, and `next` fields are used by staff audit entries; the draft has no corresponding detail fields.
- **Document configuration and review:** requirement codes/labels and rejection notes are used. Draft documents have a name/note, but no separate requirement catalog; reviewer attribution is not wired through the current document action.

**Why it matters:** the migration would otherwise lose UI state or be unable to support current workflows.  
**Affects:** the tables/features listed above.  
**Change:** schema + backend + frontend mapping; some workflow fields require team decisions before modeling.

## 9. Planned fields/tables not currently used or not yet persisted by code

- `student_accounts` is a new relational join in the draft; the prototype only carries `studentNumber` on the demo account and has no join operation. Keep the relation if it is the approved identity design, but implement it in the backend.
- `admissions_applications.applicant_first_name`, `applicant_middle_name`, `applicant_last_name`, `applicant_email`, and `applicant_mobile` are not copied into current application objects; the signed-in profile supplies the display name/email separately. Decide whether applications retain an immutable applicant snapshot.
- Draft `reviewed_by` on admissions/documents, `released_by` on document requests, and grade submitted/approved/posted actor/timestamp columns are not currently recorded in those workflow objects. The shared audit log records some actor actions, but not these direct relationships.
- `student_document_requests.request_status`, `released_at`, and `released_by` are not retained by the UI: releasing a request removes it from the per-student request map. Keep history only if retention is intended.
- `class_meetings.topic` has no corresponding field in the current attendance form.
- `academic_terms.starts_on` / `ends_on` are not stored as structured dates by the UI; term setup currently presents date ranges as text. Define an agreed date source before requiring these values.
- `student_documents.storage_key` is not present in the prototype because there is no durable upload service. Do not populate it with a browser-local URL or path.
- `course_sections.section_status`/course status and system audit timestamps have no single normalized mapping from the UI’s title-cased status values. Define canonical values and map them at the API boundary.
- A number of timestamps and actor fields in the draft would be database-managed rather than fields currently sent by the browser. That is appropriate for a backend, but they must not be treated as already implemented or populated.

**Why it matters:** unused fields may still be valid backend needs, but they should not be mistaken for current behavior or overbuilt without a requirement.  
**Affects:** admissions, documents, attendance, grades, terms, and account links.  
**Change:** schema decision plus backend mapping; frontend changes only if the team adopts a new visible workflow.

## 10. Unresolved assumptions

- The app’s demonstration data, account list, status values, and sample IP addresses are not production data and must not be migrated as real users/events.
- The database name configured in VS Code is the expected development database, but the live connection and database contents have not been verified.
- The eventual backend technology, hosting/API boundary, session strategy, private file-storage provider, email provider, and database migration runner are unspecified.
- It is not yet established whether admissions applicants can exist without a student login, whether application data requires an identity snapshot, or how acceptance creates an official student record.
- It is not yet established whether notification preferences and generated reports need long-term retention.
- The current code stores display names/statuses inconsistently across stores (for example, title-cased registry statuses versus lowercase application states); the API/schema must define canonical values and conversions.
- No migration order, existing production/dev database baseline, backup/rollback plan, or seed-data approval is documented.

**Why it matters:** each assumption can change keys, nullability, constraints, or lifecycle rules in the first migration.  
**Affects:** the schema as a whole.  
**Change:** team decisions first; then schema and backend, with frontend changes where workflow behavior changes.
