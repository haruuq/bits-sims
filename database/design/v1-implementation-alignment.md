# Version 1 Implementation and Schema Alignment

**Review date:** November 10, 2026  
**Status:** Code-to-design planning review only. No migration SQL is generated
or approved by this report.

## Review basis and limits

- **Current implementation truth:** the current workspace HTML and JavaScript.
  The application is a browser-only prototype whose data stores are
  `localStorage` / `sessionStorage`; no application API or database driver is
  present.
- **Planning references:** `database/design/v1-decisions-latest.md`,
  `database/design/v1-scope-reconciliation-v2.md`, and
  `database/design/decision-01-identity-ownership.md`. They are proposals
  checked against the current code, except the identity ownership decision,
  which records the team's approved Version 1 choices.
- **Previous draft:** `database/design/BITS-SIMS_Database_Design.md` proposes
  48 tables. It is not approval for all 48.
- **Existing schema drafts:** root `database.schema.sql` proposes 24 tables;
  `database/migrations/001_initial_schema.sql` is placeholder comments only.
  The `.session.sql` file contains a `SHOW TABLES;` statement but no result.
  The SQL files were inspected, not executed.
- **PDF:** excluded as instructed. No findings depend on it.
- **Database access:** SQLTools was not actively available for this review.
  Neither `SELECT DATABASE();` nor `SHOW TABLES;` was run.

“Required for Version 1” below identifies the recommended persistent model
based on the current code and approved decisions; it is not a claim about an
assignment rubric that is not present in the workspace.

## 1. Current application features and workflows

1. **Login routing:** one login screen sends six demo account roles to the
   student, Registrar, or staff portal.
2. **Student self-service:** profile/contact/preferences, password change and
   reset, document upload/review status, official document requests,
   admissions application/status, accepted-application enrollment steps,
   academic history, grades and reports.
3. **Registrar:** student registry and profile review, registration,
   name-correction approval, admission decisions, term enrollment verification,
   document verification/release, read-only attendance, academic record and
   grade release, report export, own activity and account settings.
4. **ICT Services administrator:** account lifecycle, role/permission editor,
   audit, backup/monitoring panels, reports, system settings and account page.
5. **Education Technology:** account support, class/schedule maintenance,
   monitoring and reports.
6. **Department Head:** create class offerings, review grade sheets, view
   department students and attendance, and produce scoped reports.
7. **Faculty:** assigned classes, rosters, attendance encoding/submission,
   weighted assessment entry, grade-sheet submission, and class reports.
8. **Academic history:** student academic data includes past terms and posted
   results even though the active staff offering/grading UI is restricted to
   third year, face-to-face and Finals-only.
9. **Reports:** browser-generated CSV and print-to-PDF outputs; report results
   are not a durable archive.
10. **Demo tools:** `demo-tools.html` can mutate sample grades and attendance
    through `data.js`; it is explicitly a development-only sample-data tool.

## 2. Current user types and role behavior

The current role codes are `ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`, `FACULTY`,
`REGISTRAR`, and `STUDENT`. `accounts.js` and the staff account form assign
one role property per account. `staff.js` routes ICT Admin, EdTech, Department
Head and Faculty to staff portal views; `registrar.js` and `script.js` route
Registrar and Student to separate portals.

The role is not the person's academic/employment identity. The approved
Version 1 model is:

- `persons`: one real individual and canonical approved identity/contact data.
- `users`: login/account and one role through `users.role_id`.
- `students`: student-specific academic identity and status.
- `staff`: staff-specific employment/profile information.
- One user per person and one role per user in Version 1.
- No Version 1 `user_roles` junction table. Keep `roles`, `permissions`, and
  `role_permissions` for the editable permission matrix.
- `guardians` and `emergency_contacts` remain postponed entities, even though
  the registrar UI currently collects one contact of each type.

Role counts and screens are sample/demo behavior; they do not prove that the
demo accounts or records should be seeded in production.

## 3. Current authentication and authorization behavior

- Demo usernames, emails, passwords, names and singular roles are hardcoded in
  `accounts.js`. Student login accepts username, account email, or student
  number; other authentication resolves username/email.
- The authentication code is client-side. It uses a custom prototype hash,
  not an approved password KDF; login checks, lockouts, reset codes, reset
  attempts and password state are kept in browser storage.
- Password reset uses a six-digit code, 15-minute expiry, five attempts and a
  60-second resend wait; the code is exposed in a session-only demo inbox
  instead of being emailed.
- Staff accounts have a separate client-side authentication/lockout path in
  `staff.js`; non-staff accounts use `auth.js`. Both are demo-only.
- Account statuses used by the account UI include `Active`, `Locked`,
  `Inactive`, `Suspended`, and `Pending Activation`. Staff settings configure
  failed attempts, lockout minutes, minimum password length and idle timeout.
- `CAPS` in `staff.js` drives actual page/capability access. A separately
  editable permission matrix is stored per role in `db.perms`; UI and matrix
  are not a single server-enforced authorization source.
- Pages/buttons hidden in JavaScript are not secure authorization. All
  authentication, authorization, password hashing, reset delivery, lockout
  policy and actor attribution require a backend before production use.
- MFA is a checkbox/state in the account UI, not an implemented challenge
  flow. Do not treat it as working MFA or generate MFA tables for Version 1
  without requirements approval.

## 4. Current forms and fields

The static forms are in `index.html`; Registrar, staff and many student
workflows construct controls dynamically in JavaScript. The following
summarizes the data-bearing controls and input groups; search/filter controls
and report selectors are not independent entities.

| Workflow/form | Current fields and controls |
|---|---|
| Login/reset/password | username or email or student number; password; reset identity; six-digit reset code; new/confirm password; current password |
| Student general profile | first name, last name, email, email visibility, city, country, timezone |
| Student picture/contact | image upload/delete; current and new phone number; account contact email, phone and address |
| Student notifications | admissions, grades, documents, announcements toggles |
| Student admission | admission type (freshman/transferee/returnee), program, term, consent checkbox |
| Student enrollment wizard | first/middle/last name, DOB, mobile, home address; document requirement completion; selected course codes and calculated units |
| Student documents | requirement target, PDF/JPG/PNG file, request/cancel COR/COE/TOR |
| Registrar student registration | department, program, admission type, year level, first/middle/last name, DOB, personal email, mobile, city, guardian name/number, emergency-contact name/number |
| Registrar corrections | review remarks, approve/reject; name correction values/reason originate from the student profile form |
| Staff account management | full name, username, account email, one role, account status, MFA checkbox, must-change-password checkbox |
| Staff class offering/schedule | course code/title, section, faculty, room, weekday, start/end time, capacity; existing offering also has year, modality, type and open status |
| Staff attendance | class, meeting date, per-student attendance status, time in/out, remarks; draft/save/submit/reopen controls |
| Staff grades | class, period, assessment name/type/date/maximum/weight, per-student numeric score, grade-sheet submit/review/approve/return/post controls and return remarks |
| Staff access/settings | role-permission checkboxes; failed-login threshold, lockout duration, password minimum, session timeout; absence/tardiness thresholds, notify-faculty/registrar and enabled switches |
| Staff account settings | work email, mobile, office, notification toggles, current/new/confirm password |
| Backup/monitoring panels | frequency, time, type, retention, storage location, enabled, restore test/run; operational state is simulated sample data |

Important field distinctions: profile `email` and `personalEmail` are both
present in the student portal, while the login account also has `email`.
Registrar registration calls `email` a personal email. The team has not yet
approved whether account/login, personal-contact, institutional-student and
staff-work email may be the same value.

## 5. Current localStorage and client-side data usage

| Store/key | Data currently held |
|---|---|
| `bits-sims-profile` | Student profile, contact and preferences; shared by student and Registrar profile display |
| `bits-sims-corrections` | Student name correction request records and Registrar decisions |
| `bits-sims-documents` | Requirement status/notes/file metadata and official-document request dates |
| `bits-sims-admissions` | Applications plus enrollment wizard draft/progress, selected subjects and completion state |
| `bits-sims-registry` | Student registry, department/program/course/term/room sample setup, and term enrollments |
| `bits-sims-academic` | Academic terms, student subjects/results, attendance aggregates, grading scale/rules |
| `bits-sims-staff-users` | Staff-side account list/status/profile data |
| `bits-sims-staff-perms` | Editable role-to-permission code arrays |
| `bits-sims-staff-audit` | Audit sample and client-generated activity entries |
| `bits-sims-staff-classes` | Class offerings, schedule, faculty, room and capacity |
| `bits-sims-staff-faculty` | Attendance sessions/rows, assessment definitions/scores, grade-sheet state/notes and sample alerts |
| `bits-sims-staff-policy` | Password and idle-session policy |
| `bits-sims-staff-alertcfg` | Attendance alert thresholds/recipients/enabled state |
| `bits-sims-staff-backups`, `bits-sims-staff-events`, `bits-sims-staff-reports` | Simulated backup history, monitoring events and report state |
| `bits-sims-staff-pw`, `bits-sims-staff-locks` | Client-side hashed password overrides and login lockout state |
| `bits-sims-auth-pw`, `bits-sims-auth-locks`, `bits-sims-auth-resets` | Student/Registrar password overrides, lockouts and reset-code records |
| `bits-sims-demo-inbox` (`sessionStorage`) | Plain demo reset code visible in the browser session |
| `bits-sims-registrar-me` | Registrar's contact/settings and notification preferences |
| `bits-sims-staff-version` | Sample-store seed version; staff seed changes can clear local browser state |

`demo-tools.html` uses the shared `bits-sims-academic` store. Browser storage
is per-browser and client-controlled; it is neither an authoritative shared
database nor a secure persistence layer.

## 6. Current status values and workflow transitions

| Feature | Code-observed values/transition | Alignment issue |
|---|---|---|
| Account | `Pending Activation`, `Active`, `Locked`, `Inactive`, `Suspended`; failed login can lock; reset can clear lock; suspended remains suspended | Root SQL only has `active`, `locked`, `disabled`; design has generic account status. Define canonical codes and transitions. |
| Admissions | `pending` -> `review` -> `accepted` or `rejected`; applicant can `withdrawn`; accepted enrollment can show `enrolled` | Root SQL omits `withdrawn` and `enrolled`; design uses generic status. Keep application status separate from enrollment status. |
| Registrar term enrollment | `Pending` -> `Verified` -> `Enrolled` | Neither draft's root `enrollments` nor the design's class enrollment table alone models this process. |
| Student record | `Active`, `On Leave`, `Archived`; archive/restore | Root SQL `active`, `on_leave`, `archived` is close but casing/codes need API mapping. |
| Class offering | `Open`; root SQL additionally proposes `closed`, `cancelled` | Decide whether non-open transitions are used; current UI sample uses `Open`. |
| Document requirement | `missing`, `review`, `verified`, `rejected` | Root SQL additionally calls the review state `submitted`; map code vocabulary to persistent codes. |
| Official document request | Request date keyed by COR/COE/TOR; cancel deletes the request; Registrar release also deletes it | No durable lifecycle/history in current code despite root SQL's `pending`/`released`/`cancelled`. Retention decision needed. |
| Attendance meeting | `Open` -> `Submitted`; reopen returns to editable state | Root SQL `class_meetings` has no meeting state or submitted time. |
| Attendance record | `Present`, `Absent`, `Late`, `Excused`, `Left Early`; time-in/out and remarks | Root SQL omits `Left Early`, time fields and remarks; previous design has a different field placement. |
| Staff grade sheet | `Draft` -> `Submitted` -> `Approved` -> `Posted`; `Submitted` may be `Returned` to faculty; recall to draft supported | Root SQL lacks assessment/score/sheet tables and `Returned`. |
| Student grade visibility | Lowercase `draft`, `submitted`, `approved`, `posted`; only `posted` is visible; student subject status includes `inprogress`, `pending`, `passed`, `failed`, `inc` | Casing differs from staff workflow; `INC` is not a numeric grade. Keep workflow state distinct from academic result. |
| Enrollment wizard | Four progress states `locked`, `current`, `done`; application `accepted` gates steps; selected units are checked against 12-24 in UI | These wizard state values are browser workflow state, not necessarily separate persisted database status values. |
| Backup/monitoring | Sample states such as `Completed`, `Failed`, `Open`, `Investigating`, `Resolved`, `Critical` | Simulated operational UI, not academic V1 persistence. |

## 7. Current academic, enrollment, grading, attendance, and document functionality

- **Academic catalog:** departments, programs, courses, terms and rooms are
  local setup arrays. Term date ranges are display strings, not structured
  dates. Staff class offering is one course/section with one faculty, one
  weekly slot and one room.
- **Enrollment:** admissions, Registrar term enrollment, and student
  course/section enrollment are distinct workflows. The student wizard saves
  selected offering codes/progress in the admissions store; the class roster
  is separate sample data. Do not collapse these into one generic enrollment
  status.
- **Grading:** current active faculty periods are Finals-only; weighted
  assessment definitions and scores feed a section grade-sheet state. Student
  portal official grades live in a separate store. Registrar only exposes
  posted results. Both stores must be reconciled by backend/API before
  migration. The `data.js` grade scale and `staff.js` percent thresholds are
  separate rules and need policy approval.
- **Attendance:** staff rows are per class/date/student, with an open/submitted
  meeting, status, time-in/out and remarks. The student academic page stores
  aggregate counts separately; they are derived from detail when real
  attendance records exist.
- **Documents:** requirement statuses and notes persist as browser metadata;
  selected files are `File` objects held only for the current page/session.
  Uploads are type/size checked but not durably stored or served from private
  storage. Request/cancel/release state is a keyed map rather than history.
- **Reports:** CSV and browser print generation; no persistent report archive
  or retained report definitions are implemented.

## 8. Code entities and fields currently in use

These are client-side data concepts, not existing database tables.

| Code entity | Fields evidenced in current code |
|---|---|
| Demo account / user | `username`, `email`, `password`/prototype hash, `name`, one `role`; `status`, `mfa`, `failed`, `lockoutUntil`, `lastLogin`, `mustChange`, `created`; staff accounts additionally `employeeNo`, `title`, `dept`, `deptCode`, `hired`, `contact`; student login alias `studentNumber` |
| Student registry record | `no` (student number), `name`, `program`, `year`, `status`, `dept`, `admission`, `email`, `mobile`, `city`; registrar-created records also `dob`, `gname`, `gnum`, `ename`, `enum` |
| Student portal profile | `firstName`, `lastName`, `email`, `personalEmail`, `phone`, `city`, `country`, `address`, `avatar`, `emailVisibility`, `timezone`, notification flags |
| Staff account settings | `email`, `mobile`, `office`, notification settings; staff employment values are bundled into demo accounts rather than a normalized profile |
| Admission application | `id`, `program`, `type`, `term`, `submitted`, `verified`, `verifiedTime`, `decision`, `status`, `studentId`, `completedOn`, `remarks` |
| Enrollment wizard | `confirmedOn`, personal `first/middle/last`, `dob`, `mobile`, `address`, saved/draft flags, requirement completion, selected offering codes, completion date |
| Term enrollment | `ref`, `student`, `no`, `term`, `program`, `year`, `units`, `status` |
| Course/section offering | `id`, `code`, `title`, `section`, `year`, `faculty`, `day`, `start`, `end`, `room`, `modality`, `type`, `capacity`, `size`, `status` |
| Attendance meeting/rows | class/date; session `status`, `recordedAt`; per-student `status`, `timeIn`, `timeOut`, `remarks`; sample alert `sn`, student, class, type, count, message, date |
| Assessment/score/sheet | assessment `id`, `classId`, `period`, `name`, `type`, `max`, `weight`, `date`; score by assessment/student; sheet status keyed by class/period; return note/by |
| Official grade/academic record | student/course/term ids/codes, units, instructor/schedule display, `finalGrade`, subject result status, `gradeStatus`, attendance aggregates, update date |
| Student document | requirement `id`, `name`, `status`, `updated`, `note`, file name/size/type; request type and request date |
| Profile correction | request id/student/field/label/old/next/reason/date/status/remarks; Registrar `reviewedBy` and `reviewed` |
| Role permissions | role code -> permission code arrays; separate hardcoded capability lists also exist |
| Audit event | `id`, `ts`, `user`, `mod`, `ent`, `rec`, `act`, `desc`, `status`, `ip`, `prev`, `next` |
| Policy/settings | failed-login count, lock duration, minimum password, idle timeout; attendance absence/tardiness thresholds, recipients and enabled state |

## 9. Database entities and fields proposed by planning/schema files

### Previous 48-table design

The previous draft proposes these entities:

`persons`, `departments`, `programs`, `staff`, `academic_terms`, `courses`,
`course_prerequisites`, `students`, `users`, `roles`, `permissions`,
`user_roles`, `role_permissions`, `password_reset_requests`,
`admission_applications`, `guardians`, `emergency_contacts`,
`educational_background`, `profile_correction_requests`,
`student_enrollments`, `document_types`, `student_documents`,
`document_verifications`, `rooms`, `class_offerings`, `class_schedules`,
`faculty_assignments`, `class_enrollments`, `attendance_sessions`,
`attendance_records`, `attendance_alert_settings`, `attendance_alerts`,
`grading_periods`, `assessments`, `assessment_scores`, `student_grades`,
`grade_scales`, `student_academic_records`, `report_definitions`,
`generated_reports`, `report_history`, `audit_logs`, `notifications`,
`backup_configurations`, `backup_history`, `retention_policies`,
`system_events`, and `system_performance_metrics`.

Identity fields include canonical name/contact/demographic fields on
`persons`; `person_id` on `students` and `staff`; and nullable unique
`users.person_id`. `students` contains student number, academic status,
program/department/year, institutional email, address and avatar fields.
`staff` contains employee number, department, title, employment status, work
email/contact and hire date. `users` contains username, login email, password
hash and account-security fields. `user_roles` permits multiple or
department-scoped assignments. The draft also includes applicant/person and
student links, separate guardian/emergency tables, and detailed academic,
attendance, document, audit and operational entities.

### Root `database.schema.sql` draft

Its 24 tables are:

`departments`, `programs`, `academic_terms`, `rooms`, `users`, `roles`,
`permissions`, `user_roles`, `role_permissions`, `students`,
`student_accounts`, `admissions_applications`, `student_documents`,
`student_document_requests`, `profile_correction_requests`, `courses`,
`course_sections`, `enrollments`, `academic_grades`, `class_meetings`,
`attendance_records`, `grade_scale`, `system_settings`, and `audit_logs`.

It puts full name/mobile/office on `users`, repeats name and contact fields on
`students`, inlines one guardian and emergency contact in `students`, repeats
applicant names/contact in `admissions_applications`, uses `student_accounts`
as a student-only account link, and uses `user_roles` rather than
`users.role_id`. It has no `persons` or `staff` table, no term-enrollment
table, and no detailed assessment/sheet tables.

### Current planning decisions

The latest review and scope reconciliation recommend a code-led subset of the
48-table draft. The approved identity decision now resolves that subset:
shared `persons`; linked `users`, `students`, `staff`; one role at
`users.role_id`; retain role-permission mapping; postpone guardians and
emergency contacts. Neither planning document nor either SQL draft is final
migration approval.

## 10. Field-by-field code-to-schema mapping

| Current code field/concept | Recommended database ownership/mapping | V1 classification and mapping note |
|---|---|---|
| `name`, `firstName`, `lastName`, registrar middle name | `persons.first_name`, `middle_name`, `last_name`; display formatting derived in the app | **Required by current code but needs backend support.** Current names are inconsistent: one code field contains multiple given names; name component rules must be agreed before migration. |
| `username`, account `email`, password/hash, status, MFA flag, failed attempts, lockout, last login, must-change | `users.username`, `login_email`, `password_hash`, `account_status`, approved security fields | **Required by current code but needs backend support.** Do not store plaintext/demo passwords or treat prototype hashes as production hashes. |
| Singular account `role` | `users.role_id -> roles.role_id` | **Required for Version 1.** This is approved; do not model `user_roles` in V1 absent changed requirements. |
| Role code/name and editable permission code arrays | `roles`, `permissions`, `role_permissions` | **Required by current code but needs backend support.** The server must enforce permissions; the two client permission representations need one authoritative mapping. |
| Student `no` / `studentNumber` | `students.student_number` (unique business identifier); internal `student_id` may be used as stable FK | **Required by current code but needs backend support.** Do not use student number as the user PK or duplicate it as a different student login relation. |
| Student `program`, `dept`, `year`, `admission`, `status` | `students` with catalog FKs to `programs`, `departments`; student-specific status/year/admission fields | **Required by current code but needs backend support.** Program/department/year can be term-specific in future; current code does not settle historical ownership. |
| Profile/registry `email`, `personalEmail`, `mobile`/`phone`, city/country/address | Canonical personal contact in `persons`; `users.login_email` only for authentication; student/work institutional contact fields only when distinct and approved | **Required by current code but needs backend support.** Existing duplicates conflict; establish whether addresses have distinct purposes before storing copies. |
| Student `avatar` / `avatar_url` | Approved person- or account-profile reference; private file/object key or controlled URL, not raw file bytes | **Conditional.** Current profile uses a data URL; storage and ownership are not approved. |
| Staff `employeeNo`, `title`, `dept`, `hired`, `contact` | `staff.employee_number`, `position_title`, `department_id`, `date_hired`, distinct work-contact fields | **Required by current code but needs backend support.** Staff profile table is missing from root SQL; avoid putting employment fields on `users`. |
| Student profile email visibility, timezone and notification flags | `user_preferences` | **Conditional.** Current code uses them locally; persist only if cross-device preference retention is in scope. |
| Admission `id`, program/type/term, dates/status/remarks, `studentId` | `admission_applications` linked to applicant `persons`, program, term, reviewer, optional converted `students` | **Required by current code but needs backend support.** Current app has no applicant name/contact snapshot; do not invent one. |
| Term registration reference/student/term/program/year/units/status | `term_enrollments` and corresponding verifier/decision fields | **Required by current code but needs backend support.** Absent in root schema; separate from class membership. |
| Wizard selected course codes and class roster membership | `class_enrollments` -> student and `course_sections`; wizard progresses from those records | **Required by current code but needs backend support.** Current wizard and class roster are not joined; transaction/capacity/duplicate validation is absent. |
| Department/program/course/term/room codes, labels and status | `departments`, `programs`, `courses`, `academic_terms`, `rooms` | **Required by current code but needs backend support.** Catalog fields exist in both drafts with incompatible key strategies; term dates currently include display strings. |
| Class `code`, title, section, year, faculty, day/time, room, modality, type, capacity/status | `course_sections` (or approved offering model), one current faculty and weekly slot | **Required by current code but needs backend support.** Root `course_sections` omits year/modality/type; root FK targets a `users` row without an approved staff association. |
| Meeting date/state/submission time and attendee status/time/remarks | `class_meetings`, `attendance_records` | **Required by current code but needs backend support.** Root schema misses meeting state, `Left Early`, times and remarks. |
| Attendance thresholds/recipient flags | `attendance_alert_settings` or typed settings | **Required by current code but needs backend support** for current settings; **Conditional** for notification delivery. Current alerts are local derived state, not sent messages. |
| Assessment metadata and numeric scores | `assessments`, `assessment_scores` | **Required by current code but needs backend support.** Root schema has neither; previous design does. Keep the current active period Finals-only. |
| Grade-sheet state, notes and actors | `grade_sheets` | **Required by current code but needs backend support.** Root `academic_grades` alone cannot represent returned review state, weight aggregation and sheet lifecycle. |
| Official final result, `INC`, posted visibility | `student_grades` linked to class enrollment/term; explicit result code and separate release status | **Required by current code but needs backend support.** Root `grade_value DECIMAL` cannot represent `INC` alone; separate academic result from workflow status. |
| Grade scale / percent conversion and verbal labels | `grade_scales` and explicit approved policy | **Required by current code but needs backend support** for reproducible results; exact rules are **Conditional** on Registrar/team approval. Current `data.js` and `staff.js` use separate mappings. |
| Document requirement/status/review note/file metadata | `document_requirements`, `student_documents` with protected storage key and reviewer | **Required by current code but needs backend support.** Current code does not durably upload files; never store the browser `File` object or local path as a database value. |
| COR/COE/TOR request, cancel, release | `student_document_requests` | **Required by current code but needs backend support** for current request state; durable history is **Conditional** because current code deletes on cancel/release. |
| Profile correction field/old/requested/reason/status/reviewer | `profile_correction_requests` linked to student/person and reviewer | **Required by current code but needs backend support.** Approved name changes must update canonical `persons`, not a duplicate profile copy. |
| Audit event actor/time/module/entity/key/action/result/change values | `audit_logs` with server-derived actor/time and safe before/after fields | **Required by current code but needs backend support.** Do not migrate fabricated sample IPs or trust browser-supplied actor identity. |
| Password reset code hash/expiry/attempts/used/resend | `password_reset_requests` if the reset workflow remains in Version 1 | **Required by current code but needs backend support.** Use server-generated secure token handling and email delivery; plaintext demo inbox is not production behavior. |
| Backup and monitoring data | Separate operations tooling if later required | **Postponed.** Current values are simulated/sample records and do not belong in the academic V1 scope. |

## 11. Fields used by code but missing from proposed schema

“Missing” here means not represented, or not represented in a usable,
authoritative form, by one or both schema drafts.

| Missing/inadequate representation | Code/design evidence and impact | Schema / backend / frontend / phase |
|---|---|---|
| `persons` and `person_id` links on user/student/staff | Approved identity model and duplicate identity in `accounts.js`, `registry.js`, profile store. Root SQL has no shared identity. | Schema change; backend identity/API; frontend must consume shared IDs. **Required for V1.** |
| `users.role_id` | One role per account in current account editor and approved decision; both SQL drafts instead use `user_roles`. | Schema change; backend role enforcement; frontend remains one-role UI. **Required for V1.** |
| `staff` employment profile | Current code uses employee number, title, department, hire date and contact; root SQL has no `staff`. | Add profile table/FK; backend and staff UI mapping. **Required by current code but needs backend support.** |
| Server password KDF and complete account security fields | Prototype lockout/reset/MFA/must-change state; root schema lacks some current state; neither draft implements server behavior. | Schema fields where state must persist; backend is essential; frontend API mapping. **Required by current code but needs backend support**, except MFA challenge which is postponed/conditional. |
| Profile preferences | `emailVisibility`, timezone and notification flags have no dedicated table in either SQL draft. | Add only if cross-device persistence is required; backend and UI integration. **Conditional.** |
| Separate term enrollment | Registry has `Pending -> Verified -> Enrolled`; root SQL has only course `enrollments`. | New table and backend workflow; Registrar UI integration. **Required for V1.** |
| Active course section fields | Current class UI has year, modality, type, one weekly day/time, faculty, room, capacity and status; root schema omits year/modality/type. | Add/map fields or normalize; backend conflict/capacity validation; frontend persists current limits. **Required for V1.** |
| Assessment scores and grade-sheet workflow | Current faculty uses weighted assessment rows and `Draft/Submitted/Returned/Approved/Posted`; root schema has no assessment or sheet table. | Add tables/state; backend calculation/transitions; staff/Registrar/student API alignment. **Required for V1.** |
| Official `INC` result representation | Current student data has `status: inc`; numeric `grade_value` cannot express it safely by itself. | Explicit result type/code or equivalent; backend and frontend mapping. **Required for V1.** |
| Attendance meeting lifecycle and full mark data | Current code includes `Open/Submitted`, `Left Early`, time-in/out and remarks; root schema omits these. | Schema and API expansion; faculty form persists server-side. **Required for V1.** |
| Admission `withdrawn` and separate student conversion | Code has `withdrawn`, optional `studentId`, and a separate accepted enrollment process; root enum omits withdrawn. | Schema status map/relationship; backend transitions; student/Registrar UI. **Required for V1.** |
| Document rejection notes and durable file object key | Current UI holds file bytes only in session and has notes; root has metadata but not complete storage service/retention. | File service + metadata fields; backend access control; frontend upload/download. **Required for document workflow; retention policy conditional.** |
| Audit before/after and reliable provenance | Current audit object includes module/entity/record/action/result/prev/next; some IPs are synthetic. Root schema has only subset. | Schema/API change; backend-generated actor/time/IP; frontend must not claim authoritative audit. **Required for V1 audit if retained.** |

## 12. Proposed fields/entities not currently used or not yet implemented

| Proposed item | Current evidence | Recommended treatment |
|---|---|---|
| `persons.suffix`, `preferred_name`, gender, nationality, civil status, place of birth, alternate phone | Not collected by current screens; present in previous draft | **Conditional** only if approved identity requirements establish a purpose. Do not require for V1 by inheritance from the draft. |
| Student barangay/province/postal code, profile completion/verification fields | Not currently collected or validated as independent state | **Recommended but not currently implemented** only if a later product requirement calls for them; otherwise omit. |
| Applicant name/contact snapshots | Current application objects use signed-in account context and do not contain applicant identity fields | **Conditional.** A snapshot needs explicit record-retention/immutability approval; otherwise link the application to `persons`. |
| Guardian/emergency relationship/address/primary-contact details | Registrar currently captures one name/number for each purpose, but no reusable/multiple contact model exists | **Postponed** per approved team decision; preserve as a possible future-phase feature. |
| `student_accounts` and `user_roles` | Root SQL only; current code has student-number login alias and singular role | **Do not use in V1.** Replace with `users.person_id`, `students.person_id`, and `users.role_id`. |
| `course_prerequisites`, `educational_background`, full document verification history | Previous design only; no current prerequisite validation, prior-school form or verification-event history | **Postponed** pending actual workflows/requirements. |
| `grading_periods` with Midterm/Preliminary and fixed period columns | Active staff `PERIODS` is `['Final']`; latest code narrowed active grade scope | **Postponed.** Do not restore inactive periods or fixed columns. |
| `student_academic_records` snapshots, GPA/GWA snapshots | Current values are computed from source subjects/grades | **Recommended but not currently implemented** only if performance or policy later requires versioned snapshots. Prefer derivation in V1. |
| `document_verifications`, report definitions/history, notifications queue | No durable review-event history/archive/delivery workflow is implemented | **Postponed**; keep current state/notes only where needed. |
| Backup, monitoring, system events/metrics, retention policy tables | Current panels/data are simulated; no real service or retention engine | **Postponed** to operations/security phases, not academic V1. |
| MFA challenges/devices, persistent sessions, email verification/delivery records | UI flags or demo reset inbox only; no functional challenge/session/email provider | **Postponed/conditional** until the corresponding authentication requirements and service are approved. |

## 13. Naming and data-type mismatches

| Mismatch | Evidence / why it matters | Required work (schema / backend / frontend / phase) |
|---|---|---|
| `name`/`full_name` vs person name components | Code uses display names, a comma-ordered registry name, and first/last fields; root SQL stores full name on `users` and split names on `students`; previous design uses `persons` components. | Schema: use canonical person fields. Backend: map profiles and display names. Frontend: confirm component rules. **V1**. |
| `student_number` as PK vs stable internal IDs | Root SQL uses student number as PK; previous design uses `student_id` plus unique student number; approved relationships connect identity tables. | Schema: stable internal IDs plus unique student number. Backend: translate lookups/FKs. Frontend: may continue displaying and accepting student number. **V1**. |
| `role` string and `users.role_id` vs `user_roles` | Current code stores role code; both drafts implement an M:N join. | Schema: direct role FK, no V1 join. Backend: enforce one role. Frontend: keep singular selection and map code to role id. **Approved V1**. |
| `student_accounts` vs shared `users.person_id` | Root SQL has a student-only one-to-one mapping; approved model supports student/staff accounts through a person. | Schema: replace with person links. Backend: map and enforce cardinality. Frontend: student-number alias can remain. **V1**. |
| Case and spelling of statuses | JS commonly uses title case (`Active`, `Pending`, `Left Early`); academic store uses lowercase; SQL enums use lowercase underscore forms. | Schema: store canonical codes. Backend: validate/map transitions. Frontend: map labels and handle canonical values. **V1**. |
| Admission status values | Code includes `withdrawn` and enrollment progress; root enum omits `withdrawn` and conflates enrollment completion. | Schema: preserve application states separately from enrollment. Backend: enforce transitions. Frontend: map labels/actions. **V1**. |
| Term and class enrollment terminology | `registry.js` term records use `Pending/Verified/Enrolled`; root `enrollments` means section membership and uses `enrolled/dropped/completed/withdrawn`. | Schema: separate `term_enrollments` and `class_enrollments`. Backend: validate linkage. Frontend: reconcile wizard and Registrar states. **V1**. |
| Grades as fixed numeric value vs result code/status | Root `academic_grades.grade_value DECIMAL` and `grade_key`; code supports `INC`, workflow states and period scores. | Schema: separate assessment/sheet/official result and represent `INC`. Backend: calculate and release. Frontend: unify staff and student stores. **V1**. |
| Meeting `Open/Submitted` vs record mark | Root schema does not put state on meeting; code has a submitted session and editable individual rows. | Schema: separate meeting lifecycle and marks. Backend: enforce unique marks and transitions. Frontend: persist draft/submit/reopen. **V1**. |
| Contact email columns | Current code has login email, profile email, personal email, registry email, registrar personal email and staff work email semantics. | Schema: distinguish only approved purposes. Backend: enforce approved uniqueness/ownership. Frontend: clarify labels/inputs where values differ. **V1 decision remains open**. |
| Term dates | Registry setup uses a display string such as `Aug 17 - Dec 18`; SQL drafts specify `DATE` columns. | Schema: structured dates only after source/policy approval. Backend: validate ranges/timezone. Frontend: capture structured dates if required. **Conditional V1**. |
| Units, capacity and grade precision | Code mixes display strings for term units and numeric course units/capacity; SQL uses `DECIMAL`/`SMALLINT`; grading uses percentages and 1.00–5.00 mappings. | Schema: agree precision/derivation. Backend: validate calculations/capacity. Frontend: normalize displays/inputs. **V1**. |

## 14. Relationship and foreign-key mismatches

| Relationship | Current code vs drafts | Recommended Version 1 relationship and impact |
|---|---|---|
| Person to user/student/staff | No shared IDs in browser code; previous draft has `person_id` for all three; root SQL has none. | Add FKs/unique constraints; backend maps/enforces cardinality; frontend consumes shared IDs. **Required for V1**. |
| User to role | One role string per code account; both drafts permit multiple rows in `user_roles`. | Add `users.role_id`; retain role-permission relation. Backend enforces one role; frontend remains single-select. **Approved V1**. |
| Role to permissions | Code has editable permission arrays; both drafts have `role_permissions`. | Keep unique role-permission relation. Schema/backend aligns stored assignments and enforces them; frontend aligns matrix with API. **V1**. |
| Applicant to person/student | Code application has no explicit person id, and optional `studentId`; root repeats applicant identity and links optionally to student; previous design links person and optional student. | Add person and optional student FKs; backend defines conversion; frontend maps current account context. **V1**. |
| Program/department/catalog | Code stores labels/codes; root uses business codes as FKs; previous draft uses numeric IDs. | Choose one key policy and catalog FKs; backend validates them; frontend maps labels/codes. **V1**. |
| Term registration vs section enrollment | Separate code stores, but root only has `enrollments` student-to-section; previous draft has both `student_enrollments` and `class_enrollments`. | Add distinct term/class relationships; backend validates consistency; frontend maps both flows. **V1**. |
| Faculty assignment | Current class holds faculty username; root section references `users`; previous draft uses `faculty_assignments` table. | Current UI can use one staff FK. Schema/backend map it; frontend resolves staff id. Multiple/effective assignment tables are **Postponed**. |
| Attendance record to student | Code keys rows by student number; root FK links attendance directly to student; design uses meeting and attendance records. | Link meeting and class enrollment; backend enforces membership/uniqueness; frontend maps IDs. **V1**. |
| Assessment score to enrollment | Code maps score by assessment and student; no DB relationship. | Link assessment and class enrollment; backend verifies same section; frontend maps score rows. **V1**. |
| Document/application/correction actors | Current objects identify some actors by username and some flows omit them; drafts contain reviewer FKs. | Add actor FKs; backend derives actor; frontend sends action, not trusted actor identity. **V1**. |
| Guardian/emergency | Code has single contact names/numbers; root inlines them; previous draft creates separate student-owned tables. | No Version 1 relationship/table. Schema persistence and contact UX are **Postponed**; later decide person/contact association. |

Foreign keys do not enforce role authorization, capacity, schedule overlap,
valid state transitions, score bounds, total assessment weights, or consistent
student/term/section relationships by themselves. These need transactional
backend rules and tests.

## 15. Role and permission mismatches

- Current role codes are six singular strings. Role editor also has a
  permission matrix of 24 codes across Student Records, Enrollment, Attendance,
  Grades, Reports and System.
- The code uses two permission representations: hardcoded `CAPS` for portal
  navigation/actions and editable `db.perms` matrix for the role editor. The
  saved matrix does not automatically replace/enforce the hardcoded
  capabilities.
- `ROLE_ORDER` includes Registrar and Student; the account form accepts a
  single role. `CAPS` is defined for the four staff roles and relies on separate
  routing for the other two.
- The previous and root SQL drafts use `user_roles`, conflicting with the
  approved single-role `users.role_id` decision. The root SQL has no
  `users.role_id` FK.
- Recommended: seed/maintain role codes and permission codes as approved
  reference data, use `users.role_id`, and use `role_permissions` as the one
  server-enforced matrix. Align UI capabilities with it or document separate
  server checks. No frontend-only permission check can secure an API.

**Classification:** one role per user and `users.role_id` are **Required for
Version 1**. Permission reference/assignment is **Required by current code but
needs backend support**. Department-scoped roles and multiple roles are
**Postponed** absent changed requirements.

## 16. Features requiring backend implementation

| Feature | Why backend is required | Schema impact / timing |
|---|---|---|
| Identity/account linking and canonical `persons` data | Current local stores have no shared IDs and duplicate identity/contact fields. | Approved identity tables and FKs; **V1**. |
| Authentication, password KDF, sessions, lockout/reset | Client-side credentials, prototype hash, browser reset store and demo inbox are not secure or shared. | `users` security fields and reset state if retained; backend email delivery; **V1 auth**, MFA/session enhancements conditional. |
| Authorization and role permissions | Current access is client-side and split between capability arrays and editable matrix. | `roles`, `permissions`, `role_permissions`, `users.role_id`; **V1**. |
| Student/admission/term/course enrollment | Local data stores do not share relationships; capacity/duplicate and term checks are not server transactional. | Catalog, application, term/class enrollment tables; **V1**. |
| Documents | No durable file upload or access control; file bytes live only in browser session. | Metadata plus private storage service; **V1** for document workflow. |
| Attendance and grading | Detail is local; staff and student grade stores are split; no authoritative lifecycle exists. | Meeting/attendance, assessment/score/sheet/grade tables; **V1**. |
| Audit provenance | Browser values and seeded IPs are not trusted. | Audit table/API; server-derived actor/time; **V1** if audit feature stays. |
| Reports and analytics | Data is local and reports are client-generated. | Persist source data; report archives remain postponed unless requested. |
| Backups/monitoring | Current panels are simulations, not operational services. | Separate infrastructure work; **Postponed** from academic V1. |

## 17. Features requiring frontend changes

- Replace all localStorage/sessionStorage reads and writes with authenticated
  API requests, including loading, validation errors and saving.
- Resolve profile/account/student/staff data by backend identifiers; remove
  duplicate authoritative name/contact copies and preserve the approved
  one-person/one-account/one-role constraints.
- Keep account role selection singular and map it to `users.role_id`; do not
  add multiple-role UX in Version 1.
- Reconcile account/login, personal, institutional and work email ownership;
  use distinct controls/labels only where the team approves distinct fields.
- Align the role editor with the server permission model and enforce scopes
  server-side.
- Connect applications to `persons` and accepted enrollment to student and
  term records; connect the student course wizard to actual `course_sections`
  and `class_enrollments`.
- Connect faculty assessments and grade sheets to the official posted student
  result; show `INC` and release state distinctly.
- Persist attendance meeting/session and mark detail; preserve current five
  statuses and submission/reopen flow.
- Replace browser-only document previews with upload/download calls to
  protected storage; show durable file metadata/review notes.
- Retain guardian/emergency controls only as a later-phase UX; their presence
  in the current registrar registration form does not add their tables to V1.
- Remove, disable, or explicitly label sample-only `demo-tools.html`,
  fabricated records, sample credentials, and simulated backup/monitoring
  behavior before production.

## 18. Features to postpone

| Item | Reason and source | Future handling |
|---|---|---|
| `guardians`, `emergency_contacts` and student-contact junction | Approved team decision; current Registrar collects one of each but does not model multiple/reusable contacts. | Preserve as future-phase capability; revisit privacy, cardinality, relationships and controls. |
| Multi-role or department-scoped user roles | Approved single role; current account UI assigns one role. | Revisit only if requirements change; then add scoped assignment model and UI. |
| Course prerequisites, educational background | Previous draft only; no current workflow/validation. | Later phase when forms and rules exist. |
| Multiple instructors/multiple schedule rows/history | Current offering UI has one faculty and one weekly slot. | Normalize later if operations require it. |
| Midterm/preliminary grading | Current active period is Finals-only; code history narrowed this workflow. | Do not silently restore; revisit with explicit scope change. |
| Durable document verification history, versioning, retention policy | Current UI stores only latest status/note; no approved retention behavior. | Later document lifecycle/policy phase. |
| Notification delivery queue/history | Current code has preferences and locally derived alerts, not real delivery. | Later after channel, retry, recipient and retention requirements are approved. |
| Report archive/history | Current CSV/print is generated on demand. | Later if retention or reproducibility is required. |
| Backup, monitoring, operational events/metrics | Current controls and sample data are simulated. | Operations/infrastructure phase, not academic V1. |
| MFA challenges/devices, persistent sessions, email verification | UI flags/demo reset state only; no service/workflow. | Later or conditional on security requirements. |
| Student academic snapshots and computed aggregates | GWA, units and attendance rates are derived from source records. | Keep derived in V1; add snapshots only for approved performance/audit need. |

## 19. Final recommended Version 1 tables and field labels

Names and fields below are conceptual, not final DDL. Each field is tagged
using one of the requested classifications:

- **Required for Version 1**
- **Required by current code but needs backend support**
- **Recommended but not currently implemented**
- **Conditional**
- **Postponed**

Exact SQL types, nullability, constraints and delete behavior remain unapproved.

| Table | Recommended fields and classifications |
|---|---|
| `persons` | `person_id` [Required for Version 1]; `first_name`, `middle_name`, `last_name`, approved name representation [Required by current code but needs backend support]; personal email, mobile/phone, city, country, address [Required by current code but needs backend support, with purpose/ownership Conditional]; `date_of_birth` [Required by current code but needs backend support; requiredness is Conditional because current inputs are optional]; suffix/preferred name/other demographics [Conditional]; avatar reference [Conditional]; created/updated timestamps [Recommended but not currently implemented]. |
| `users` | `user_id`, `person_id` [Required for Version 1]; `role_id` [Required for Version 1]; unique username and login email [Required by current code but needs backend support]; password hash, account status, failed attempts/lockout, last login, must-change flag [Required by current code but needs backend support]; MFA enabled flag [Conditional; challenge flow Postponed]; created/updated timestamps [Recommended but not currently implemented]. |
| `students` | `student_id`, `person_id` [Required for Version 1]; unique `student_number`, program/department references, year level, admission type, student status [Required by current code but needs backend support]; institutional email [Conditional on distinct purpose]; created/updated timestamps [Recommended but not currently implemented]. |
| `staff` | `staff_id`, `person_id` [Required for Version 1]; employee number, department, title, hire date [Required by current code but needs backend support]; employment status/work email/work phone [Conditional where distinct from person/account values]; created/updated timestamps [Recommended but not currently implemented]. |
| `roles` | `role_id`, unique role code/name for six current roles [Required for Version 1]; description/status [Recommended but not currently implemented]. |
| `permissions` | `permission_id` or permission code, unique stable code/name/module/action [Required by current code but needs backend support]; description [Recommended but not currently implemented]. |
| `role_permissions` | `role_id`, permission reference/code, unique pair [Required by current code but needs backend support]; assignment metadata [Recommended but not currently implemented]. |
| `password_reset_requests` | Reset id, `user_id`, token/code hash, created/expiry, attempts, consumed state, resend/rate-limit data [Required by current code but needs backend support if reset remains in V1]; email delivery metadata [Conditional]. Never store the plaintext demo code. |
| `user_preferences` | `user_id` [Conditional]; email visibility, timezone, notification preferences [Conditional, currently local only]; timestamps [Recommended but not currently implemented if table is approved]. |
| `departments` | Stable id/code/name/status [Required for Version 1]; description/contact fields [Conditional]; created/updated times [Recommended but not currently implemented]. |
| `programs` | Stable id/code/name, department FK, status [Required for Version 1]; description/degree/duration [Conditional]. |
| `academic_terms` | Stable term id/code, academic year, semester, current/status [Required for Version 1]; structured start/end dates [Conditional until source dates are approved]; enrollment window [Conditional]. |
| `courses` | Course id/code/title/units/status [Required for Version 1]; description/lecture/lab hour/type [Conditional; only if current academic/catalog workflow needs them]. |
| `rooms` | Room id/code/name/capacity/status [Required by current code but needs backend support]; location/equipment [Conditional]. |
| `course_sections` | Section id/course/term/code/year/faculty-staff/room/day/start/end/capacity/status [Required by current code but needs backend support]; current modality/type [Required by current code but needs backend support]; enrolled count [Recommended but not currently implemented as a stored value; derive from enrollments]. Keep one weekly schedule/faculty in V1. |
| `admission_applications` | Application id/person/program/term/type/status/submitted date [Required by current code but needs backend support]; verified/decision dates, reviewer, remarks, optional student link [Required by current code but needs backend support where workflow captures them]; immutable applicant snapshot [Conditional]. |
| `term_enrollments` | Enrollment id/student/term/program/year/status/reference [Required by current code but needs backend support]; units [Recommended but not currently implemented as stored data unless a policy snapshot is required]; verifier/actor/date [Recommended but not currently implemented]. |
| `class_enrollments` | Enrollment id/student/section/status, unique student/section [Required by current code but needs backend support]; created/approved actor/time [Recommended but not currently implemented]. |
| `document_requirements` | Requirement id/code/name/status/active/applicability [Required by current code but needs backend support for current catalog]; audience/program applicability [Conditional]. |
| `student_documents` | Document id/student/requirement/status/note [Required by current code but needs backend support]; original filename/MIME/size/private storage key/upload/review dates/reviewer [Required by current code but needs backend support]; hash/version/expiry/retention [Postponed]. |
| `student_document_requests` | Request id/student/type/request state/request date [Required by current code but needs backend support]; release actor/time [Recommended but not currently implemented in student map]; cancellation/release history [Conditional]. |
| `profile_correction_requests` | Request id/student/person field/old value/requested value/reason/status/submitted date [Required by current code but needs backend support]; reviewer/remarks/review date [Required by current code but needs backend support]. |
| `class_meetings` | Meeting id/section/date/status (`Open`/`Submitted`)/recorded or submitted time/submitter [Required by current code but needs backend support]; topic [Recommended but not currently implemented]. |
| `attendance_records` | Attendance id/meeting/class-enrollment/status/time-in/time-out/remarks/recording actor/time [Required by current code but needs backend support]; unique meeting/enrollment [Required for Version 1]. |
| `attendance_alert_settings` | Thresholds, notify faculty/Registrar, enabled [Required by current code but needs backend support for settings]; alert delivery records/recipient events [Postponed]. |
| `assessments` | Assessment id/section/period/name/type/date/maximum/weight [Required by current code but needs backend support]; creator/time [Recommended but not currently implemented]; active period remains Finals-only. |
| `assessment_scores` | Assessment id/class-enrollment id/score [Required by current code but needs backend support]; updated actor/time [Recommended but not currently implemented]. |
| `grade_sheets` | Section/period/status/note/submit-review-approve-post actors and dates [Required by current code but needs backend support]; returned/recall transitions [Required by current code but needs backend support]. |
| `student_grades` | Class enrollment/period/official result including explicit `INC` representation/release status [Required by current code but needs backend support]; posted date/actor [Required by current code but needs backend support]. |
| `grade_scales` | Percentage thresholds, numeric equivalent, verbal label and ordering [Required by current code but needs backend support]; policy effective date/scope/version [Conditional]. Approve mappings before deployment. |
| `system_settings` | Typed security policy and approved attendance thresholds/values [Required by current code but needs backend support if persisted]; updated actor/time [Recommended but not currently implemented]. Avoid untyped arbitrary config if typed values suffice. |
| `audit_logs` | Audit id, server actor, server timestamp, module/entity/key/action/result, safe description/before-after [Required by current code but needs backend support]; source IP [Conditional on policy and reliable server observation]. Sample IP values are not data. |

Do **not** include `user_roles`, `student_accounts`, `guardians`, or
`emergency_contacts` in Version 1. Their classifications are **Postponed** or
replaced by the approved direct relationships above.

## 20. Final recommended Version 1 relationships

1. `users.person_id -> persons.person_id`, unique for one user per person.
2. `students.person_id -> persons.person_id`, unique for one student profile
   per person; `staff.person_id -> persons.person_id`, unique for one staff
   profile per person. A person may have both profiles; current code does not
   establish whether institutional policy permits it.
3. `users.role_id -> roles.role_id`; `role_permissions` joins `roles` to
   `permissions`. No `user_roles` in V1.
4. `students` -> `programs` / `departments`; `programs` -> `departments`.
   Decide whether student program/department are current values or term
   snapshots before finalizing history.
5. `staff` -> `departments`; `course_sections` -> course, term, room and
   assigned staff member.
6. `admission_applications` -> applicant `persons`, program, term, reviewer
   `users`; optional student link when a student record is created.
7. `term_enrollments` -> student, term, program and verifier user.
   `class_enrollments` -> student and section. Backend enforces term/section
   consistency and capacity.
8. `student_documents` -> student and requirement; uploader/reviewer -> user;
   protected storage key points outside ordinary database file bytes.
   `student_document_requests` -> student and release actor.
9. `profile_correction_requests` -> student/person, reviewer and optional
   supporting document only if that upload is implemented.
10. `class_meetings` -> section; `attendance_records` -> meeting and class
    enrollment. Enforce at most one mark per enrolled student per meeting.
11. `assessments` -> section/period; `assessment_scores` -> assessment and
    class enrollment; `grade_sheets` -> section/period; `student_grades` ->
    class enrollment/period. Backend checks that assessment and enrollment
    belong to the same section.
12. `user_preferences` -> user if approved; `system_settings` and
    `audit_logs` actors -> user.

## 21. Remaining decisions requiring team approval

The approved identity choice resolves shared-person use, one account per
person, single role per account, `users.role_id`, and postponement of guardian
and emergency entities. Remaining decisions are:

1. Exact required person name components and whether the current multi-word
   `firstName` value should be split; canonical display order.
2. Which email is login, personal contact, institutional student or staff
   work email; uniqueness and overlap rules. Ownership of phone and address,
   and whether address is person-wide or role-specific.
3. Whether a person may simultaneously have student and staff profiles.
4. Which of the six roles are enabled for launch and which permission matrix
   is authoritative; permission scope and department access rules.
5. Canonical stored codes/transitions for account, admissions, student,
   term/class enrollment, document, attendance and grade states.
6. Admissions-to-person/student conversion timing and whether an application
   needs an immutable identity snapshot.
7. Term date source/timezone and whether date fields are mandatory; current
   course/catalog key policy and student/program history.
8. Grade conversion/rounding, passing/INC semantics, grade-sheet transitions
   and whether Finals-only is approved product scope or demo scope.
9. Attendance status definitions, threshold policy, alert recipients and
   whether any alerts are to be delivered.
10. Document requirement applicability, private file storage, MIME/size limits,
    reviewer history and retention.
11. Persistence across devices for preferences; audit data retention and
    whether server-observed IP addresses are retained.
12. Key strategy, nullability, uniqueness, delete behavior, timestamps and
    reviewed/fictional seed policy.
13. Future-phase scope and timing for guardians/emergency contacts, MFA,
    multiple roles, multiple schedules/instructors and operational tables.

## 22. Recommended implementation order

1. Resolve the outstanding decisions above and record product scope; keep the
   approved identity decision intact unless requirements change.
2. Establish the existing database baseline with read-only checks in an
   actively connected SQLTools session. No baseline is available from the
   current workspace session.
3. Finalize identity/catalog key and contact ownership; design `persons`,
   `users`, `students`, `staff`, `roles`, `permissions`,
   `role_permissions`, and security policy. Use `users.role_id`.
4. Build server authentication/authorization, secure password hashing,
   lockout/reset and actor identity before exposing protected records.
5. Implement catalog tables and validated source data for departments,
   programs, terms, courses, rooms and sections.
6. Implement applications, term enrollment and class enrollment as separate
   stateful workflows with backend transactions and capacity checks.
7. Implement document metadata and private file storage/access controls.
8. Implement class meetings and attendance rows/settings; test unique marks
   and state transitions.
9. Implement assessments, scores, grade-sheet review and authoritative posted
   student grades; reconcile both current client stores and approve grade
   policy.
10. Implement profile correction, user preferences if approved, typed system
    settings and server-generated audit events.
11. Map the existing UI to the API incrementally; remove sample credentials,
    fabricated operational history and local-only persistence from production
    paths.
12. Only after design approval, generate migration SQL, review it offline,
    test on a disposable/local database, plan rollback/backups, and obtain
    separate explicit authorization before any Hostinger write.

## Files and database activity

### Current application files inspected

- HTML: `index.html`, `demo-tools.html`.
- JavaScript: `accounts.js`, `auth.js`, `data.js`, `registrar.js`,
  `registry.js`, `script.js`, `staff.js`.
- CSS: `style.css`, `reports.css`, `registrar.css`, `staff.css`. These are
  presentation files; form/status selectors were checked for data-bearing
  behavior, and no schema contract is defined there.

### Planning and schema files inspected

- `database/design/v1-decisions-latest.md`
- `database/design/v1-scope-reconciliation-v2.md`
- `database/design/decision-01-identity-ownership.md`
- `database/design/BITS-SIMS_Database_Design.md`
- `database.schema.sql`
- `database/migrations/001_initial_schema.sql`
- `Hostinger school database.session.sql`
- `database/README.md`
- `README.md`

The code files were treated as current implementation truth. The Markdown
designs were treated as planning references, with the recorded identity
decision treated as approved for Version 1. The PDF was excluded.

No active SQLTools connection was available, so the read-only checks could
not be performed. The Hostinger database was not modified. No SQL was
generated or executed.
