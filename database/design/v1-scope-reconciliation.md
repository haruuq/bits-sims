# Version 1 Database Scope Reconciliation

**Status:** Planning and team review only. This document is not a migration and does not authorize database changes.

## Source handling and limits

- The current repository code is the source of truth for implemented behavior. It is browser-only: its persistent state is in `localStorage` / `sessionStorage`; no application API or database driver is present.
- The requested reference PDF exists in this workspace as `database/design/BITS-SIMS_Comprehensive_System_Fields_and_Design_Reference (1).pdf` (1,501,607 bytes, 102 pages). The literal unsuffixed filename in the request was not present. The integrated browser exposed no PDF text, and local Word conversion did not complete. To avoid inventing PDF requirements, PDF-only field-ownership details below are identified as pending direct verification and are limited to notes explicitly attributed to the PDF by the prior database-design draft.
- `database/design/BITS-SIMS_Database_Design.md` is treated as a previous draft, not as a finalized requirement. It specifies 48 tables and records which decisions it inferred.
- `database/design/v1-decisions-latest.md` is treated as the prior current-code review, and was checked against the current code during this reconciliation.
- The root `database.schema.sql` is an unapproved 24-table draft. `database/migrations/001_initial_schema.sql` remains comments only. Neither file was executed or changed.
- The SQLTools settings contain the expected Hostinger connection configuration, but no live SQLTools connection/query capability was available. `SELECT DATABASE();` and `SHOW TABLES;` were not run.

For each recommendation, **DB** means the table/field belongs in the eventual schema; **BE** means server/API behavior is required; **FE** means the current browser workflow must be integrated with that API. Because there is no backend yet, adopting any persisted V1 feature requires BE work and eventually FE integration. “V1” means needed to persist the workflows currently represented in the prototype, not proof of an external assignment requirement.

## 1. Tables and fields supported across the sources

The sources agree on the following data domains, but not on identical table names, field ownership, nullability, or lifecycle rules. Agreement on a domain is not approval of any particular schema.

| Domain / field concepts | Sources supporting the domain | Why it matters | Change / timing |
|---|---|---|---|
| Users and access: username, email, password hash, account state, role code, permission code, role assignment | Current `accounts.js` / `auth.js` / `staff.js`; prior review; reference as represented by the prior design; previous design; root SQL | Every portal is role-gated; prototype credentials and checks are not server security. | DB + BE + FE; V1. Never migrate demo passwords as credentials. |
| Student identity and registration: student number, name, program/department, year, admission type and student status | Current `registry.js` / `script.js` / `accounts.js`; prior review; reference as represented by the prior design; previous design; root SQL | Registry, portal profile, class roster, admission and academic rows must resolve to one student. | DB + BE + FE; V1. Names and contact fields need field ownership approval. |
| Departments, programs, courses and terms: stable codes/names, units, term/year/semester, active/current state | Current `registry.js` / `data.js` / `staff.js`; prior review; previous design; root SQL; reference as represented by the prior design | Registration and section workflows use catalog records and academic periods. | DB + BE + FE; V1. Do not equate demo-only sample catalogs with approved institutional master data. |
| Section delivery and enrollment: section, course, term, faculty, room, schedule, capacity and student membership | Current `staff.js` / `registry.js` / `data.js`; prior review; previous design; root SQL; reference as represented by the prior design | Rosters, schedule display, attendance and grades need a stable section-enrollment relationship. | DB + BE + FE; V1. Normalize the separate registrar term enrollment and course enrollment workflows. |
| Attendance: dated meeting/session, student mark, status and recorded time | Current `staff.js` / `data.js`; prior review; previous design; root SQL; reference as represented by the prior design | Per-student records are needed to reproduce faculty entry and derive summaries. | DB + BE + FE; V1. Status vocabulary and session lifecycle need approval. |
| Grades: student/course/term result, grade value and release/review status | Current `data.js` / `staff.js` / `registrar.js`; prior review; previous design; root SQL; reference as represented by the prior design | Faculty encoding, approval/posting and student visibility must use one official result. | DB + BE + FE; V1. Assessment detail and official grade must be reconciled, not duplicated. |
| Admissions and documents: application status, requirement/document state, request type/status | Current `script.js` / `registrar.js`; prior review; previous design; root SQL; reference as represented by the prior design | Applicants, registrar queues, student uploads and document requests are separate persisted workflows. | DB + BE + FE; V1. Actual file bytes belong in private file storage, not normal database rows. |
| Corrections and audit: requested field/value, decision state, actor, action and time | Current `script.js` / `registrar.js` / `staff.js`; prior review; previous design; root SQL; reference as represented by the prior design | Profile changes and staff/registrar actions need review and attribution. | DB + BE + FE; V1. Client-supplied actor/IP values are not authoritative. |

These are shared concepts only. For example, the root SQL uses `course_sections`, `enrollments`, `academic_grades`, and `class_meetings`; the previous design uses `class_offerings`, `class_enrollments`, `student_grades`, and `attendance_sessions`. Do not create both versions of a concept without a specific lifecycle need.

## 2. Tables and fields required by the current code

The code currently persists objects in browser storage, not relational rows. The following are the data contracts that a V1 API/schema must preserve if these existing flows are kept.

| Current workflow / recommended table group | Fields evidenced by current code | Why it matters | Change / timing |
|---|---|---|---|
| Accounts and security: `users`, `roles`, `permissions`, role assignment, reset-token storage | Six roles: `ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`, `FACULTY`, `REGISTRAR`, `STUDENT`; username, email, name, role; staff title/department/employee number/hire date/contact; student number; password hash, failed-attempt/lockout state, password-change and reset-code hash/expiry/attempt/use state. The code also has MFA flags/settings, but no second-factor challenge. | Login accepts usernames, emails or student numbers; staff and student password state is split across stores; lockout and reset behavior is currently client-side. | DB + BE + FE; V1. Decide whether MFA is an actual V1 behavior before storing more than a flag. |
| Student/person/profile: `persons`, `students`, `staff_profiles`, `user_preferences` | Student number, first/last display names, email, mobile, city/country/address, program/year/status/admission type; profile email visibility, timezone, avatar, personal email and notification preferences. Staff demo profiles use employee number, title, department, hire date and contact. | Official student identity, editable portal contact/preferences, and login identity are currently spread across separate objects. | DB + BE + FE; V1. Separate official identity from user preferences; approve exact person/profile field ownership. |
| Admissions and enrollment: `admission_applications`, `term_enrollments`, `class_enrollments` | Applications have admission type, program, term, submitted/decision status and timestamps/remarks. Term enrollment has reference, student, term, program, year, units and `Pending` / `Verified` / `Enrolled` state. Class membership connects a student roster to a section. The student wizard also saves course selections and completion state. | These are three different state transitions and must not be collapsed into one generic enrollment row. | DB + BE + FE; V1. Keep application, term registration and course/section enrollment distinct. Compute units from selected/enrolled courses unless the team approves a stored snapshot. |
| Catalog and sections: `departments`, `programs`, `academic_terms`, `courses`, `rooms`, `course_sections`, `class_schedules`, faculty assignments | Codes/names, units/status; term year/semester; section/year/faculty; day/start/end/room/capacity; modality (`Face-to-Face`), type (`Lecture` / `Combined`) and open status. Current staff code assigns one faculty account to each sample section and one displayed recurring schedule. | These fields are used in roster, schedule, class assignment and conflict/capacity screens. | DB + BE + FE; V1. Keep schedule/faculty relationship extensible without restoring unsupported modalities or years as active workflows. |
| Attendance: `attendance_sessions`, `attendance_records`, policy settings | One class/date session; `Open` / `Submitted`, recorded time; per-student `Present`, `Absent`, `Late`, `Excused`, `Left Early`, time-in/time-out and remarks. Settings include absence/tardiness thresholds, enabled and notify flags. Student portal also stores aggregate counts. | Summaries should be derived from meeting records; a session cannot be reconstructed from totals alone. | DB + BE + FE; V1. Store the code's `Left Early` value; derive summary counts. Alert delivery/history can wait. |
| Grading: `grading_periods`, `assessments`, `assessment_scores`, `grade_sheets`, `academic_grades` | Assessment name/type/date/maximum/weight and per-student score; grade-sheet status `Draft`, `Submitted`, `Returned`, `Approved`, `Posted`, return note and actor; student-facing final numeric grade or `INC` plus posted/release state. | Staff weighted assessment scoring and the student portal's official grade are currently separate stores; one authoritative posted grade is needed. | DB + BE + FE; V1. Link assessment calculations and approvals to the official grade. Record `INC` as a grade status/value rule, not as a numeric grade. |
| Document workflow: `document_requirements`, `student_documents`, `student_document_requests` | Requirement code/label/status/review note; selected file name/type/size and upload/review state; request types COR/COE/TOR and release state. File preview data is browser-only. | Browser storage is not a safe durable file store, and request release should not silently erase the record. | DB metadata + private file storage + BE + FE; V1. Do not put document contents or local file paths in SQL. |
| Corrections: `profile_correction_requests` | Student, field, old/requested value, reason, pending/approved/rejected state, reviewer/remarks and dates. | Registrar approval is an implemented workflow and should not be an untracked direct profile edit. | DB + BE + FE; V1. Approvals that apply changes should update the official profile transactionally. |
| Audit/settings: `audit_logs`, `system_settings` | Actor, time, module/entity/key, action/description/result and previous/next values; security policy and attendance alert configuration. | Staff and registrar screens use shared audit/config state; browser logs and sample IP addresses are not authoritative. | DB + BE + FE; audit and security settings V1. Source actor/time/IP on the server. |
| Reports and backup/monitoring samples | Report actions and recent metadata exist in browser state; backup, monitoring and event screens contain simulated/sample state. | Presence of a mock screen is not evidence that operational history belongs in the academic database. | V1 report generation may remain computed; persistent report archive and operational tables postponed unless approved. |

## 3. Reference fields/tables not implemented in current code

The following are described in the previous design's field catalog as reference-driven fields/entities, but are not implemented as full current workflows. Because the PDF text itself could not be extracted here, confirm these against the authoritative PDF before treating any as a requirement.

| Reference-only or partial fields/tables | Why it matters | Change / timing |
|---|---|---|
| `persons` ownership fields such as suffix, preferred name, date/place of birth, gender, nationality, civil status and alternate number | Current objects duplicate a subset of names/contact fields and do not implement the complete shared-person model. The prior design explicitly attributes personal identity fields to `Persons`. | DB + BE + FE if approved; V1 identity foundation. Verify the exact ownership and requiredness in the PDF. |
| `guardians`, `emergency_contacts`, `educational_background` and their relationship, address, school and transfer-verification fields | No corresponding complete forms or persisted entities were found in current code. | DB + BE + FE only if the assignment/institution requires collection; otherwise postpone. |
| Course prerequisite relationships and minimum-grade rules | No current prerequisite-management or checking workflow is implemented. | DB + BE + FE only when course planning/registration requires it; postpone for current scope. |
| Expanded document metadata such as file hash/version, expiration/retention dates, and a separate `document_verifications` history | Current code has current requirement/review state, but no full versioned verification-history lifecycle. | Basic file metadata is V1; history/retention fields need policy and can be postponed. |
| Detailed session fields such as session number, deadline, schedule linkage and structured reason/minutes-late fields | Current attendance stores date, meeting state, status, time-in/out and free-form remarks; it does not implement all reference detail fields. | Add only where validated by the PDF and staff workflow; do not store unused derived values by default. |
| Grade points, letter equivalents, grading-period dates/deadlines and a full grade-scale policy catalog | Current code has numeric grade conversion, verbal labels, pass/fail, Dean's List and attendance thresholds in code/settings; it does not implement every reference policy field. | Grade scale and one `Final` period are V1 data if the school approves the values; additional policy dimensions are approval-dependent. |
| Report definitions/archives, notification delivery records, retention policies, backup configurations/history, system events and performance metrics | These are reference-design entities, while current operational pages are mock/sample flows or browser-local report metadata. | Do not include in the academic V1 schema without an explicit assignment/operations requirement; use appropriate infrastructure services later. |

## 4. Tables and fields in the previous 48-table design not supported by current code

“Not supported” means there is no current persisted workflow or field usage in the repository; it does not mean the reference institution does not require the feature.

| Previous-design tables/fields | Current-code evidence / why it matters | Change / timing |
|---|---|---|
| `course_prerequisites` | No prerequisite data or validation appears in the current catalog/enrollment flows. | DB + BE + FE only if required; postpone. |
| `guardians`, `emergency_contacts`, `educational_background` and detailed person/student fields not shown in current forms | No complete collection or review workflow exists in the current browser UI. | Add only after confirming the assignment and field ownership; otherwise postpone. |
| `document_verifications` as a separate event/history table; expiration, retention and file-hash/version columns | Current code changes a document's current status/remarks; it does not provide a complete multi-version verification-history workflow or approved retention policy. | Basic document metadata/status V1; event history and retention postponed/approval-dependent. |
| `student_academic_records` with stored totals, term/cumulative GPA and academic-standing snapshots | Current `data.js` derives GWA, units earned and standing from terms/subjects/posted grades. Persisting duplicate aggregates risks stale data. | Prefer queries/derived values in V1; add a snapshot/cache only with a refresh rule and required report. |
| `report_definitions`, `generated_reports`, `report_history` as durable report archive | Current report buttons generate/view/export from application data; only sample/recent browser state exists. No approved retention/archive workflow. | Report computation/export may be V1 behavior; archive tables postponed unless policy or rubric requires retention. |
| `notifications` as a delivery queue/history | Current code stores notification preferences and sample alerts, but has no delivery provider or durable notification lifecycle. | Preferences may be V1; delivery/queue table postponed until channel, retry and retention rules are approved. |
| `backup_configurations`, `backup_history`, `system_events`, `system_performance_metrics` | Current views show fabricated or simulated operational data; no real backup scheduler, telemetry source or event pipeline is present. | Do not put these in academic V1 tables; implement operational services separately if required. |
| `retention_policies` | No actual policy values or automated archival/disposal behavior are implemented. | Postpone until an institutional retention policy is approved. |
| A separate fixed `preliminary_grade` / `midterm_grade` / `final_grade` column set | Current repository explicitly narrows the active grading workflow to Finals only and exposes period-keyed grade state. | Do not restore fixed Midterm/Preliminary columns. Keep period-based structure with only approved active period(s). |

Some previous-design entities are supported in part and should not be discarded: `attendance_alert_settings` has current settings (`maxAbsences`, `tardiness`, recipients, enabled); audit, grade scale, student document status, reports and profile preferences also have current code counterparts. Keep the configured rule values where approved, but defer actual alert delivery, archived reports and infrastructure history.

## 5. Features added, removed, renamed or revised in the latest repository version

Based on the current checkout and its Git history (HEAD `062ce13`):

- The old combined `admin.js` / `admin2.js` portal was replaced by separate Registrar and staff portals (`registrar.js`, `staff.js`) with a shared student registry (`registry.js`). Registrar registration/documents/enrollment/grade posting are separated from ICT/EdTech administration and faculty/department-head work. **Why:** permissions, ownership and workflow states now differ by portal. **Change:** schema + BE + FE integration; V1.
- `accounts.js` and `auth.js` add a shared six-role demo login set and common password reset / lockout flows. Staff account/password management remains in `staff.js`. Reset codes, passwords and lockout state are still browser-local prototypes. **Why:** role and security models must include these live flows while replacing insecure client enforcement. **Change:** schema + BE + FE; V1.
- Staff pages add account/role-permission editing, audit views, class scheduling, faculty grade sheets, attendance meetings, policies, reports, and mock backup/monitoring. **Why:** not all visible panels represent production requirements. **Change:** persist current academic/security workflows; postpone the mock operational datasets.
- Scope revisions in commit `1348527` narrow active class scheduling to third-year, face-to-face offerings and Finals-only grading; `0cf27a0` adds reset/lockout behavior; `b93c721` records the portal split. **Why:** older Midterm/broader-year/modality assumptions must not be silently reinstated. **Change:** V1 config/workflows follow the latest code; retain historical academic records without imposing the active offering scope on history.
- The current code still contains historical academic terms and grades in `data.js`; “third year only” is the active sample scheduling scope, not an instruction to delete earlier academic history. **Why:** historical transcript records and current class offerings have different lifecycles. **Change:** keep historical terms/grades representable; migration/backfill requires separate approved data.
- The root SQL file's `student_accounts` join and several duplicated profile fields are a prior schema choice, not a feature newly implemented in code. The current app identifies a student account by `studentNumber` and separately stores student registry/profile data. **Why:** relational ownership must be selected rather than inferred from the draft. **Change:** team decision; schema + BE, and FE mapping.

## 6. Conflicts between sources

| Conflict | Evidence | Recommended reconciliation | Change / timing |
|---|---|---|---|
| Person ownership versus duplicated `users` / `students` fields | The previous reference-based design assigns personal details to `persons`; root SQL duplicates names/profile fields in `users` and `students`; current code stores them across accounts, registry and profile localStorage. | Adopt a canonical person identity only after confirming the PDF field-ownership rule. Keep credentials/access fields in `users`, student academic identifiers in `students`, and editable contact/notification preferences separate. Avoid copying the same name/email into three authoritative rows. | DB + BE + FE; V1 foundation; confirm one-person/one-account rule. |
| Five design roles versus six current roles | The previous design lists ICT Admin, EdTech, Department Head, Faculty and Registrar, and treats Student as optional; current code has all six, including student login. | Include `STUDENT` because the current portal authenticates students, unless the team explicitly removes student login. Approve role multiplicity and department scoping. | DB + BE + FE; V1. |
| One role on account forms versus many-to-many role assignments | Current demo accounts each have one role, while staff permissions are editable; previous design/root SQL use `user_roles` and can assign multiple roles. | Use a role-assignment table only if multi-role/scope is approved; otherwise a single role FK is simpler. In either case, enforce authorization in the backend, not UI capability lists. | DB + BE + FE; team decision before V1 migration. |
| Admissions, registrar term enrollment and section enrollment conflated in the root `enrollments` | Current code has separate application, term-enrollment and class-roster data; prior review and reference draft also distinguish term and class enrollment. Root `enrollments` only links student to section and uses `enrolled/dropped/completed/withdrawn`. | Keep `admission_applications`, `term_enrollments`, and `class_enrollments` distinct. Map statuses per workflow; do not use one shared enum. | DB + BE + FE; V1. |
| Scope of historical records versus current schedule scope | Current code has several past academic years in student records but active staff scheduling is third-year/F2F/Finals only. | Limit new section/grade-entry UI behavior as currently implemented; do not constrain the student/history model or erase prior term records. | BE + FE; schema supports terms and period-based grades; V1. |
| Finals-only student result versus staff assessments and fixed grade columns | Current `data.js` exposes final grade/status only; `staff.js` stores weighted assessments/scores and grade-sheet workflow. Previous design mixes fixed prelim/midterm/final columns with a flexible grading-period model; root SQL has only one generic `grade_key` result row. | Use assessment and score rows as inputs; use one grade-sheet lifecycle and one official posted result per enrollment/period. Represent only `Final` for the current workflow; do not add active Midterm UI. Approve INC, conversion and rounding rules. | DB + BE + FE; V1. |
| Attendance values/state missing from root SQL | Current staff code includes `Left Early`, time-in/out, remarks and Open/Submitted meeting state; root `attendance_records` allows only present/absent/late/excused and its meeting has no submit state. | Store meeting/session status and the complete current mark vocabulary; derive totals/rates. Decide whether `Left Early` counts toward attendance thresholds. | DB + BE + FE; V1. |
| Required document catalog and durable storage | Current code has per-student requirement rows, review state and file selection; root SQL has student document rows but no requirement catalog; the reference-based draft includes document types and verification history. | Have a requirement/type catalog and per-student status/metadata; use private object storage for bytes. Keep request-to-issue workflow separate. Defer verification history until needed. | DB + BE + FE + storage; V1 metadata, history/retention approval-dependent. |
| Code configuration versus a static `system_settings` key/value design | Current staff settings include security rules and attendance thresholds; the root SQL stores string key/value with no typed contract. | Approve the exact settings, scope and types; avoid storing secrets or mixing personal preferences with global policy. | DB + BE; FE only where settings UI remains; V1 for policy used by auth/attendance. |
| Mock operational UI versus 48-table operational schema | Current backup, monitoring, system-event and report screens include sample data; the previous design contains persistent operational tables. | Do not infer persistence requirements from sample rows. Keep operational data outside academic V1 unless the assignment/institution explicitly requires it. | Postpone DB/BE/FE operational features. |

## 7. Recommended Version 1 tables

The following is a planning recommendation, not a final schema. It keeps the current code's real workflows, adopts the reference-oriented identity/academic split provisionally, and omits unrelated mock and unimplemented areas.

| Table or table group | Recommended V1 fields (conceptual only) | Why / source | Schema, backend, frontend / timing |
|---|---|---|---|
| `persons` | person key; first/middle/last/suffix/preferred name; approved personal details/contact fields; timestamps | PDF field-ownership as represented in the prior design; code currently duplicates names/contact data. | DB + BE + FE; V1 if person ownership is confirmed. |
| `users` | user key; person FK; username/email; password hash; account state; failed-attempt/lockout state; password-change/last-login state; approved MFA flag | `accounts.js`, `auth.js`, `staff.js`, prior review and reference-based design. | DB + BE + FE; V1. Store hashes only; never seed demo passwords. |
| `roles`, `permissions`, `user_roles`, `role_permissions` | stable codes/descriptions; assignment and permission pairs; optional department scope only if approved | Current six role portals and editable access matrix; previous design/root SQL. | DB + BE + FE; V1. Choose one-role vs many-role model first. |
| `password_reset_requests` | user FK; token/code hash; created/expiry; attempts; consumed time; resend throttle state | Current reset flow plus reference-based design. | DB + BE + FE; V1. Email delivery and secure token generation are backend responsibilities. |
| `departments`, `programs`, `staff` | codes/names/status; program-to-department; staff/person, employee number/title/department/hire/contact fields | `registry.js`, `accounts.js`, `staff.js`; previous design. | DB + BE + FE; V1 where required by class assignment and department scope. |
| `students` | person FK; student number; institutional email; program/department; current year; admission type/status; approved official contact/address fields | `registry.js`, `script.js`, `data.js`; reference ownership needs confirmation. | DB + BE + FE; V1. Do not store duplicate derived name fields unless required. |
| `user_preferences` | user FK; timezone/email visibility/notification preferences and approved contact settings | Current student profile and staff/registrar personal settings. | DB + BE + FE; V1 if settings must persist across devices; keep distinct from official student records. |
| `academic_terms`, `courses`, `rooms` | term year/semester/date/current status; course code/title/units/status; room code/name/capacity/status | Current catalog/schedule data and both design documents. | DB + BE + FE; V1. Structured dates and current-term policy need approval. |
| `course_offerings` (root SQL calls this `course_sections`) | course/term/department/program FKs; section code; year level; capacity; modality/type/status | Current staff class model and previous design. | DB + BE + FE; V1. Do not hard-code historical data to third year only. |
| `class_schedules`, `faculty_assignments` | offering FK; day/time/room/effective dates; assigned staff FK/role/status | Current schedule and faculty data; reference-based draft normalizes them. | DB + BE + FE; V1. If only one schedule/teacher per offering is formally confirmed, these may be reduced into offering fields. |
| `admission_applications` | applicant/person FK; program/term; admission type; status; submitted/decision dates; reviewer and remarks; student link when converted | Current student/registrar admissions workflow; previous design and root SQL. | DB + BE + FE; V1. Approve applicant identity and status vocabulary. |
| `term_enrollments` | student/term/program/year; reference; status; units or selected course links; verification/approval actors and timestamps/remarks | Current `registry.js` Pending -> Verified -> Enrolled workflow. | DB + BE + FE; V1, separate from section enrollment. Prefer deriving unit totals. |
| `class_enrollments` | term enrollment + offering; status; added/dropped timestamps and actor/reason | Current class rosters and student course selection; previous design. | DB + BE + FE; V1. Enforce duplicate/capacity checks transactionally. |
| `document_requirements`, `student_documents` | requirement code/label/applicability; student/requirement; state; storage key; original filename/MIME/size; upload/review actor/time/note | Current document requirements/review UI; reference-based document catalog. | DB + BE + FE + private storage; V1. Store metadata only. |
| `student_document_requests` | student; COR/COE/TOR type; request/release/cancel state; request/release actor/timestamps | Current registrar/student request workflow and root SQL. | DB + BE + FE; V1. Preserve request history rather than deleting released requests. |
| `profile_correction_requests` | student; field; old/requested values; reason; state; reviewer/remarks/timestamps; optional evidence FK | Current student correction and registrar approval flow. | DB + BE + FE; V1. |
| `attendance_sessions`, `attendance_records` | offering/schedule/date; open/submitted state and actor/time; per enrolled student status, time-in/out, remarks and actor/time | Current staff attendance state and reference-oriented session model. | DB + BE + FE; V1. Use one canonical source; derive portal attendance summaries. |
| `attendance_alert_settings` | approved absence/tardiness thresholds, enabled state, recipient options and scope | Current settings and reference-based design. | DB + BE; V1 if the existing settings remain functional. Confirm scope before constraining. |
| `grading_periods`, `assessments`, `assessment_scores` | term/period code (current active period `Final`); offering; name/type/date/max/weight; assessment + class-enrollment score and remarks | Current staff weighted assessments; flexible period reference. | DB + BE + FE; V1. Do not create active Midterm periods absent approval. |
| `grade_sheets`, `student_grades` | offering/period sheet state, return note, submit/review/approve/post actor/time; one official result per class enrollment/period, grade value/status including INC | Current Faculty -> Department Head -> Registrar -> student workflow; previous design and root SQL. | DB + BE + FE; V1. This is the single student-visible result source. |
| `grade_scales` | approved lower-is-better numeric range/grade, verbal label and pass indicator; scope/version if approved | Current numeric mapping, verbal scale, pass rule and prior design. | DB + BE + FE; V1 only after Registrar/team approves exact ranges and rounding. |
| `system_settings` | typed security and attendance policy values; updater/time | Current security and attendance settings; root SQL. | DB + BE; V1 for server-enforced settings. Define typed keys/scopes; do not mix user preferences or secrets. |
| `audit_logs` | server-derived actor/time; module/entity/key/action/result/description; approved before/after values and source metadata | Current staff/registrar audit actions; previous design/reference. | DB + BE + FE integration; V1. Treat as append-only; do not trust browser actor/time/IP. |

## 8. Tables to postpone

| Table(s) / feature | Reason and source | Change / timing |
|---|---|---|
| `guardians`, `emergency_contacts`, `educational_background` | Present in the prior reference-based design but not in current collection/review flows. | DB + BE + FE only if the rubric/institution confirms; later version otherwise. |
| `course_prerequisites` | No current prerequisite entry/checking workflow. | Postpone; add only with registration rules. |
| `document_verifications` as a separate history table; expiration/retention/version history | Current UI stores current state, not a full verification-event/history policy. | Postpone until document audit/retention needs are approved; current status and reviewer data belong in V1. |
| `attendance_alerts` delivery/event history | Settings and sample alerts exist, but no delivery channel or durable alert lifecycle exists. | Postpone; settings can be V1, delivery requires BE/provider and notification policy. |
| `student_academic_records` aggregate snapshots | GWA, units and standing are derived in `data.js`; duplicating totals introduces consistency problems. | Postpone; use views/queries unless performance or official snapshot requirements are approved. |
| `report_definitions`, `generated_reports`, `report_history` as an archive | Reports are generated/exported by the UI but no retention or archive is approved. | Postpone persistent archive; keep required report computation as application logic. |
| `notifications` delivery queue/history | Preferences exist, but delivery does not. | Postpone until providers, channels, retries and retention are specified. |
| `backup_configurations`, `backup_history` | Screens use sample data; backups are operations, not current application workflows. | Postpone from academic schema; implement operations tooling if required. |
| `system_events`, `system_performance_metrics` | Current monitoring content is simulated and has no telemetry source. | Postpone to operations/monitoring system. |
| `retention_policies` | No approved retention/disposal values or implementation exist. | Postpone until policy owner approves rules. |
| MFA challenges/devices, persistent sessions, email/SMS delivery infrastructure | A UI flag/reset demo exists, but no second factor, email service or server session is implemented. | Security architecture decision before implementation; do not add speculative tables now. |
| Active Midterm/Preliminary grading tables/columns and non-third-year/non-F2F workflows | Latest code explicitly narrows current scheduling/grading behavior. | Postpone; do not silently restore removed workflows. Keep schema capable of historical academic records. |

## 9. Required relationships and foreign keys for V1

These are required relationship intents; key type, delete/update behavior and uniqueness remain migration-design decisions.

1. `users.person_id -> persons.person_id`; `students.person_id -> persons.person_id`; `staff.person_id -> persons.person_id`. Enforce the approved one-person/account/profile cardinality. This replaces the root draft's `student_accounts` join if the team approves a canonical person model.
2. `programs.department_id -> departments.department_id`; `staff.department_id -> departments.department_id`; `students.program_id/department_id -> programs/departments`. Decide whether current program/department should be derived from active term enrollment instead of duplicated.
3. `user_roles.user_id -> users.user_id`; `user_roles.role_id -> roles.role_id`; `role_permissions.role_id -> roles.role_id`; `role_permissions.permission_id -> permissions.permission_id`. Optional user department scope must FK to `departments`.
4. `password_reset_requests.user_id -> users.user_id`. Store only hashed, expiring, single-use reset material and enforce attempt/rate limits in the backend.
5. `admission_applications.person_id -> persons.person_id`; optional `student_id -> students.student_id` after conversion; program/term/reviewer FKs to `programs`, `academic_terms`, and `users`.
6. `term_enrollments.student_id -> students.student_id`; `term_id -> academic_terms`; program/department FKs; verification/approval actors -> `users`.
7. `course_offerings.course_id -> courses`; `term_id -> academic_terms`; department/program FKs. `class_schedules.offering_id -> course_offerings`; optional `room_id -> rooms`. `faculty_assignments.offering_id -> course_offerings`, staff FK -> `staff`, assigner -> `users`.
8. `class_enrollments.term_enrollment_id -> term_enrollments`; `offering_id -> course_offerings`; added-by actor -> `users`. Prevent duplicate active membership and enforce that the term enrollment and offering belong to the same term in transactional backend validation.
9. `document_requirements` is referenced by `student_documents`; each student document references a student and optional uploader/reviewer `users`. File bytes remain outside SQL; the storage key must not be a local path.
10. `student_document_requests.student_id -> students`; released-by actor -> `users`. `profile_correction_requests.student_id -> students`; reviewer -> `users`; evidence -> `student_documents` only if evidence upload is implemented.
11. `attendance_sessions.offering_id -> course_offerings`; optional schedule FK -> `class_schedules`; submitter -> `users`. `attendance_records.session_id -> attendance_sessions`; `class_enrollment_id -> class_enrollments`; recorder -> `users`. Uniqueness should prevent more than one mark per enrolled student/session.
12. `grading_periods.term_id -> academic_terms`; `assessments.offering_id -> course_offerings` and period FK -> `grading_periods`; `assessment_scores.assessment_id -> assessments` and class-enrollment FK -> `class_enrollments`. Validate that score enrollment matches the assessment offering.
13. `grade_sheets.offering_id/period_id -> course_offerings/grading_periods`; submitter/reviewer/approver/poster -> `users`. `student_grades.class_enrollment_id/period_id -> class_enrollments/grading_periods`, with a unique official result per enrollment/period. Validate term/offering consistency server-side.
14. `grade_scales` should reference an approved term/policy scope if scales vary; audit actor -> `users`; `system_settings.updated_by -> users`; `user_preferences.user_id -> users`.

Foreign keys alone cannot enforce class capacity, overlapping room/faculty schedules, term consistency across related rows, valid assessment weight totals, score bounds, status transitions or authorization. These require backend transactions, validation and tests.

## 10. Fields and decisions requiring team approval

| Decision | Why it matters / sources | Change / timing |
|---|---|---|
| Confirm the authoritative PDF filename/version and inspect its exact field ownership pages | Only the `(1).pdf` variant exists in the workspace; text extraction was unavailable. The prior design is not a substitute for approving requirements. | Team/source confirmation before final schema; no SQL yet. |
| Whether `persons` is the canonical owner of shared person details; which exact name/contact/demographic fields are required | PDF ownership as reported by prior design conflicts with duplicated current local stores and root SQL. | DB + BE + FE; V1 identity decision. |
| Whether students/applicants can exist without login; one account per person; one role or multiple roles and department scope | Current code has a student login and single-role demo accounts; previous design permits service accounts and multi-role scoped assignments. | DB + BE + FE; decide before identity/RBAC tables. |
| Exact role set and permission matrix | Current code has six roles and both hard-coded capabilities and editable permission rows; prior design's role list treats Student as optional. | DB + BE + FE; V1. |
| Canonical admission/term/class enrollment status values, status transitions and admission-to-student conversion | Current workflows are distinct; code uses title-cased and lowercase states; root SQL's status list differs and omits `withdrawn`. | DB + BE + FE; V1 workflow sign-off. |
| Official academic year/semester dates and how current term is selected | UI sample term dates are partly text; uniqueness and a single-current-term constraint are not yet institutional decisions. | DB + BE; V1 catalog decision. |
| Whether offerings may have multiple schedules/instructors; room, modality, type and year-level rules | Code displays one schedule/faculty per offering, while the reference draft normalizes schedules and faculty assignments. | DB + BE + FE; decide whether normalized child tables are needed at V1. |
| Whether current scope (third year, face-to-face, Finals only) is assignment-approved or only a demo constraint | Code commits narrow active UI behavior, while earlier reference fields may describe a wider target system. Historical terms exist in current data. | BE + FE; V1 scope sign-off; retain history. |
| Assessment weighting, allowed assessment types, grade conversion/rounding, passing/Dean's List rules, `INC` representation, and grade approval transitions | `data.js` and `staff.js` contain grade rules and separate workflow stores; the previous draft's scale is incomplete. | DB + BE + FE; V1 registrar/team approval. |
| Attendance meaning of `Left Early`, `Late`, `Excused`, thresholds, alert recipients and alert scope | Current statuses/settings and reference attendance details are not fully aligned. | DB + BE + FE for marks/settings; alert delivery can wait. |
| Which student demographic, guardian, emergency, prior-school and address fields must be collected; whether each field is required | Some are only in the reference draft and not current forms. | DB + BE + FE only for approved fields; otherwise postpone. |
| Required document catalog by admission type, file limits/types, reviewer history, storage provider, access and retention | Current file flow is preview/local state only; storage and policy are unspecified. | DB + BE + FE + private storage; approve before document migration. |
| Whether user preferences, report archives, notifications, backups, audit retention and system monitoring require persistence | UI includes preferences and simulated operational features but does not establish retention or delivery requirements. | User preferences/audit core may be V1; other persistence requires product/policy approval. |
| Key strategy, timestamp/timezone, unique constraints and delete/retention behavior | The previous design explicitly marks these as inferred; existing SQL selects incompatible key types and names. | DB + BE; finalize only after scope and baseline review. |

## 11. Final proposed Version 1 table list

Recommended list, subject to the decisions above. Table names are conceptual and should be normalized once, not duplicated under both prior-draft and root-SQL aliases.

1. `persons`
2. `departments`
3. `programs`
4. `staff`
5. `students`
6. `users`
7. `roles`
8. `permissions`
9. `user_roles` (or `users.role_id` if single role is approved)
10. `role_permissions`
11. `password_reset_requests`
12. `user_preferences`
13. `academic_terms`
14. `courses`
15. `rooms`
16. `course_offerings` (root draft alias: `course_sections`)
17. `class_schedules` (can be offering fields if the one-schedule limit is approved)
18. `faculty_assignments` (can be an offering faculty FK if one instructor is approved)
19. `admission_applications`
20. `term_enrollments` (previous design alias: `student_enrollments`)
21. `class_enrollments` (root draft alias: `enrollments`)
22. `document_requirements` (reference alias: `document_types`)
23. `student_documents`
24. `student_document_requests`
25. `profile_correction_requests`
26. `attendance_sessions` (root draft alias: `class_meetings`)
27. `attendance_records`
28. `attendance_alert_settings`
29. `grading_periods`
30. `assessments`
31. `assessment_scores`
32. `grade_sheets`
33. `student_grades` (root draft alias: `academic_grades`)
34. `grade_scales` (root draft alias: `grade_scale`)
35. `system_settings`
36. `audit_logs`

This 36-table proposal is deliberately smaller than the previous 48-table design. Some normalized relationships can be simplified after approval (single role, single schedule/instructor); the postponed list should not be added merely because those tables exist in the previous draft.

## 12. Recommended implementation order

1. Confirm the authoritative PDF/version and the team decisions in section 10; obtain any assignment rubric not present in the workspace.
2. Confirm database baseline with read-only checks through the active SQLTools connection. Do not infer existing tables from a `.session.sql` file containing only `SHOW TABLES;`.
3. Freeze ownership/cardinality: person, user, student and staff; roles; department scope; term-enrollment versus class-enrollment boundaries.
4. Define API/backend security and authorization before connecting the browser to the database. Move password hashing, login lockout, reset tokens, actor identity and validation server-side.
5. Design approved reference/catalog entities and keys: departments, programs, terms, courses, rooms, roles and permissions.
6. Design person/user/student/staff profiles and preferences; decide status codes, unique identifiers and person-account constraints.
7. Design admissions, term registration, section offerings/schedules/faculty assignments and class enrollment; specify transactional capacity/duplicate/conflict checks.
8. Design document requirement and request metadata with private file-storage lifecycle and approved retention.
9. Design attendance sessions/records and status/alert rules.
10. Design assessments, grade sheets, official grade releases and approved grade scale; ensure student views read only posted results.
11. Add audit and typed system settings; define append-only access and server-generated provenance.
12. Only after schema review and explicit approval, create migration SQL; review it offline, test it on a disposable/local database, then plan a backup/rollback and a separately authorized Hostinger application.
13. Replace each browser store with API calls workflow-by-workflow; add tests for permissions, status transitions, foreign-key consistency and calculated summaries before deploying.

## Files and database activity

Current code inspected: `index.html`, `demo-tools.html`; `accounts.js`, `auth.js`, `data.js`, `registrar.js`, `registry.js`, `script.js`, `staff.js`; `style.css`, `registrar.css`, `staff.css`, `reports.css`; and recent Git history.

Planning/schema sources inspected: `database/design/v1-decisions-latest.md`, `database/design/BITS-SIMS_Database_Design.md`, `database.schema.sql`, `database/migrations/001_initial_schema.sql`, `database/README.md`, `Hostinger school database.session.sql`, `.vscode/settings.json`, and the available reference PDF file `database/design/BITS-SIMS_Comprehensive_System_Fields_and_Design_Reference (1).pdf` (metadata verified; text could not be extracted in this session).

No application files were modified. `database/design/v1-scope-reconciliation.md` is a new planning document. No database connection was actively available for checks; neither read-only query was run. No database-changing SQL was executed and no Hostinger database was modified.
