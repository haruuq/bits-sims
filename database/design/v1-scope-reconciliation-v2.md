# Version 1 Database Scope Reconciliation — v2

**Status:** Scope recommendation only. This is not a migration or approval to change a database.

## Review basis and limits

- **Current implementation truth:** current repository code and current Git history. The app is a browser-only prototype: application data is held in `localStorage` / `sessionStorage`; no application API or database driver is present.
- **Previous design reference:** `database/design/BITS-SIMS_Database_Design.md`. It is a draft with 48 proposed tables, and explicitly identifies inferred schema choices. Its inventory is not an approved requirement.
- **Prior code review:** `database/design/v1-decisions-latest.md`, checked against current code.
- **Existing schema sources:** root `database.schema.sql` is an unapproved 24-table draft; `database/migrations/001_initial_schema.sql` contains comments only; `Hostinger school database.session.sql` contains `SHOW TABLES;` without results. None was executed or changed.
- **PDF reference:** excluded from this analysis as requested. No claims below depend on it.
- The target file `database/design/v1-scope-reconciliation-v2.md` did not exist before this review.
- SQLTools settings are configured for the Hostinger development database, but an active SQLTools connection was not available. Neither `SELECT DATABASE();` nor `SHOW TABLES;` was run.

In the tables below, **DB** means the concept/fields need database storage; **BE** means server/API implementation; **FE** means the existing browser flow must connect to that API. “V1” means recommended to persist an implemented workflow, not an assertion about an unseen assignment requirement.

## 1. Tables and fields currently used by the latest code

The code uses storage objects rather than relational tables. Table names below are proposed mappings, not tables that already exist in the application.

| Current code data / proposed table mapping | Fields and values evidenced in code | Source and why it matters | DB / BE / FE / timing |
|---|---|---|---|
| `users`, `roles` | `username`, `email`, display `name`, one role per demo account; staff also have title, department, employee number, hire date and contact; student login uses `studentNumber`. Six roles: `ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`, `FACULTY`, `REGISTRAR`, `STUDENT`. Account status includes `Active`, `Locked`, `Inactive`, `Suspended`, `Pending Activation`. | `accounts.js`, `staff.js`; portals and authentication resolve identities by username/email and, for students, student number. These are demo identities, not production users. | DB + BE + FE; V1 if accounts are to be server-backed. Do not seed demo credentials. |
| `permissions`, role-permission relation | Permission codes such as `STUDENT_VIEW`, `ENROLLMENT_APPROVE`, `ATTENDANCE_ENCODE`, `GRADE_POST`, `USER_MANAGE`; editable permissions are kept per role. UI capability arrays also exist separately. | `staff.js`; UI access and editable permission matrix do not constitute secure authorization. The current two permission representations may differ. | DB + BE + FE; V1 for role-based access; team must select an authoritative permission model. |
| `users` security fields, `password_reset_requests` | Password hash (prototype hash only), failed attempts, lockout expiry, last login, must-change flag; reset-code hash, issue/expiry, attempt count, used state, resend cooldown. Reset code is also exposed in a demo inbox in `sessionStorage`. | `auth.js`, `staff.js`; reset and lockout are currently browser-side, split between staff and non-staff stores, and must move server-side before production use. | DB + BE + FE; V1 if login/reset remains. Email delivery and secure hashing are backend work. |
| `students`, `persons` or equivalent identity | Student number, displayed name, program, department, year, student status (`Active`, `On Leave`, etc.), admission type, email, mobile, city; student portal profile additionally has first/last display names, personal email, city/country/address, phone, avatar. | `registry.js`, `accounts.js`, `script.js`; roster, student profile, student login and registrar records currently use separate browser objects. | DB + BE + FE; V1. Decide canonical owner for names/contact fields; do not silently duplicate conflicting copies. |
| `user_preferences` | Student email visibility, timezone, contact/profile preferences, notification choices for admissions/grades/documents/announcements; registrar and staff settings are also keyed per account. | `script.js`, `registrar.js`, `staff.js`; current preferences are local to the browser. | DB + BE + FE if preferences should follow the user across devices; V1 only for preferences retained in scope. |
| `departments`, `programs`, `courses`, `academic_terms`, `rooms` | Department/program/course codes, names and status; course units; term year/semester and display date range/current state; room code/name/capacity/status. Some term dates are unstructured display strings. | `registry.js`, `data.js`, `staff.js`; these catalogs connect student records, terms and class offerings. Seed examples are not authoritative institutional catalogs. | DB + BE + FE; V1 for persisted registration and class workflows. Verify master data and structured term dates. |
| `course_sections` (or `course_offerings`) | Course/term, section, year level, one displayed faculty account, day/start/end, room, capacity/current size, modality `Face-to-Face`, type `Lecture` / `Combined`, `Open` status. | `staff.js`, `registry.js`, `data.js`; roster, schedule, attendance and grade views depend on a section identity. | DB + BE + FE; V1. Current UI represents one faculty and one recurring weekly schedule per sample section. |
| `admission_applications` | Applicant/application identity, admission type (`freshman`, `transferee`, `returnee`), program/term, submitted date, status `pending`, `review`, `accepted`, `rejected`, `withdrawn`, remarks and completion/student link. | `script.js`, `registrar.js`; applicant review is separate from both term enrollment and course enrollment. | DB + BE + FE; V1 if admissions remains in scope. Align states and person/student creation lifecycle. |
| `term_enrollments` | Reference, student, term, program, year, displayed units, status `Pending` → `Verified` → `Enrolled`. | `registry.js`, `registrar.js`; registrar verifies term registration independently from section rosters. | DB + BE + FE; V1. Prefer deriving unit totals from selected/enrolled courses unless the team needs a snapshot. |
| `class_enrollments` | Student-to-section roster membership; enrollment wizard also persists selected course codes and progress/completion state. | `staff.js`, `script.js`; class roster and student course selection must resolve to the same section-enrollment records. | DB + BE + FE; V1. Keep distinct from term-level registration. |
| `student_documents`, `document_requirements`, `student_document_requests` | Requirement code/label, per-student status, remarks/rejection note, filename/type/size/upload time; request types COR/COE/TOR and request/release state. Selected file is used for preview; file bytes are not a durable server upload. | `script.js`, `registrar.js`; students submit requirements and request documents; registrar reviews/releases them. | DB metadata + private file storage + BE + FE; V1 for the represented workflow. Preserve request history; never store local file paths or file bytes in ordinary rows. |
| `profile_correction_requests` | Student, field, old value, requested value, reason, date and `pending` / approved / rejected state with registrar remarks/review. | `script.js`, `registrar.js`; name correction is an approval flow, not an ordinary preference edit. | DB + BE + FE; V1. Applying an approval should update the authoritative profile consistently. |
| `attendance_sessions`, `attendance_records` | Class/date session with `Open` / `Submitted`, recorded time; per-student `Present`, `Absent`, `Late`, `Excused`, `Left Early`, time-in/time-out and remarks. Student academic store also carries aggregate counts. | `staff.js`, `data.js`; session and row detail are needed for encoding and submitted attendance; aggregate counts are derived. | DB + BE + FE; V1. Decide status semantics and derive summary rates/counts. |
| `attendance_alert_settings`, `system_settings` | Absence/tardiness thresholds, enable flag, faculty/registrar recipient options; password minimum, failed-login limit, lock duration, session timeout. | `staff.js`, `auth.js`; settings are local and must be enforced by server if retained. | DB + BE; FE integration for existing settings; V1 for active policy settings. Alert delivery/history is not implemented. |
| `grading_periods` or period key, `assessments`, `assessment_scores` | Staff-side assessment name/type/date/maximum/weight, student score; current active period is `Final`. | `staff.js`; weighted assessments are used to calculate results but are separate from the student academic store. | DB + BE + FE; V1 if detailed assessment entry remains. |
| `grade_sheets`, `student_grades` | Section/period grade sheet with `Draft`, `Submitted`, `Returned`, `Approved`, `Posted`, return note and actor; student-facing final grade (numeric or `INC`) with release status. | `staff.js`, `registrar.js`, `data.js`; faculty → department head → registrar → student is the implemented grade path, but the prototype keeps multiple stores. | DB + BE + FE; V1. Define one official posted result source and one transition model. |
| `grade_scales` | Staff percentage thresholds map to numeric grades; student data separately includes pass/fail, verbal scale, Dean’s List threshold and attendance thresholds. | `staff.js`, `data.js`; two rule sets currently coexist and may disagree. | DB + BE + FE; V1 only after Registrar/team approves the canonical rules. |
| `audit_logs` | Actor, timestamp, module, entity, record key, action, description, result, previous/new values and sample IP. | `staff.js`, `registrar.js`, `auth.js`; these are currently browser-generated and sample IPs are synthetic. | DB + BE + FE integration; V1 for attributable administrative actions. Server must authoritatively assign actor/time/IP. |
| Reports and operational sample data | Reports are generated/viewed/exported; recent report metadata is browser state. Backup/monitoring/events include sample records. | `script.js`, `staff.js`; visible panels do not demonstrate durable report archiving, real backups or telemetry. | Computed reports can remain application behavior; persistent archives/operations tables postponed unless separately required. |

## 2. Tables and fields proposed in `BITS-SIMS_Database_Design.md`

The previous design states that it contains 48 tables. Its field list below is transcribed from that draft’s table specifications; these are proposals, not approved requirements.

| Draft table | Fields specified in the previous design | Why it matters / source | DB / BE / FE / timing |
|---|---|---|---|
| `persons` | `person_id`, first/middle/last name, suffix, preferred name, date of birth, gender, nationality, civil status, place of birth, personal email, mobile/alternate number, created/updated time | Draft proposes shared person identity; current code has only partial, duplicated person fields. | Schema proposal; V1 only if the team chooses canonical person ownership; BE + FE mapping required. |
| `departments` | ID/code/name/description, head staff, email/contact/office/status | Draft catalog; current code has department code/name/head/status samples but not full contact fields. | Basic department identity V1; extra contact fields only if used/approved; BE + FE. |
| `programs` | ID, department, code/name/description, degree level/duration/status | Current code uses program code/name/department/status, not descriptions, degree level or duration. | Core catalog V1; unused descriptive fields can wait; DB + BE + FE. |
| `staff` | ID/person, employee number, department, title, employment status, work email/contact, hire date, timestamps | Staff users and account screens use a subset. | Staff identity/scope V1; all fields need mapping; DB + BE + FE. |
| `academic_terms` | ID, academic year, semester, start/end and enrollment dates, status/current flag | Current code has year/semester/current and display date ranges, with some dates unstructured. | V1 catalog; structured date ownership/current-term rule needs approval; DB + BE + FE. |
| `courses` | ID/code/name/description, department, units, lecture/lab hours, type, active/status | Current code uses code/title/units/status; no hours or full catalog management. | Code/name/units/status V1; hours/type optional pending use; DB + BE + FE. |
| `course_prerequisites` | ID, course, prerequisite course, minimum grade, requirement type | No current prerequisite data or registration checks. | Postpone; schema + BE + FE only if required. |
| `students` | ID/person/student number, institutional email/photo, postal address components/country, status/admission date/type, department/program/current year, timestamps | Current code uses student number/name/program/department/year/status/email/mobile/city and portal profile fields; not full address or admission date. | Core registry V1; unused address/admission metadata approval-dependent; DB + BE + FE. |
| `users` | ID/person, username/email/password hash, account status, email verified, MFA, failed attempts/lockout, last login/password change, must-change, created-by/timestamps | Current code supports username/email/password/role/status, lockout/reset/password change and MFA flag; email verification and created-by are not implemented. | Security core V1; email verification only if a workflow is approved; DB + BE + FE. |
| `roles`, `permissions` | Role name/code/description/level/status/time; permission name/code/module/action/description | Current code has six role codes, editable permission codes and hardcoded capability lists. | Role/permission identity V1; role level and descriptions only if needed; DB + BE + FE. |
| `user_roles`, `role_permissions` | User/role, optional department scope/effective dates/assignment actor/status; role/permission and grant actor/time | Current code has one role per account but editable permissions by role; no effective-date or department-scoped role assignment flow. | `role_permissions` V1; many-role/scoped `user_roles` only after approval. |
| `password_reset_requests` | User, token hash, request/expiry, used/date-used | Current reset flow adds attempt count and resend throttle as well; those are not represented in draft fields. | Reset table V1 if reset remains; extend with approved attempt/throttle handling; BE + FE. |
| `admission_applications` | Application number, person/student, date/type, program/term, status/decision, verifier/time, remarks | Current flow supports program/term/type/status/submitted/decision/remarks and student link; identity snapshot/verification nuance needs mapping. | V1; DB + BE + FE. |
| `guardians` | Student, guardian names/relationship/contact/email/address, primary/emergency flags | No current guardian forms or persistence. | Postpone unless separately required; DB + BE + FE if approved. |
| `emergency_contacts` | Student, name/relationship/contact/alternate/address | No current emergency-contact workflow. | Postpone unless required; DB + BE + FE if approved. |
| `educational_background` | Student, previous school/address/level, strand/track/year/program, transferee and credential verification | Current admission type includes transferee, but no detailed prior-school workflow is present. | Postpone until collection/verification is implemented; DB + BE + FE. |
| `profile_correction_requests` | Student, field, existing/requested value, reason, evidence document, request state/date, reviewer/date/remarks/applied time | Current code supports correction requests and review, not all evidence/application timestamp fields. | Core workflow V1; evidence FK only if evidence upload is implemented; DB + BE + FE. |
| `student_enrollments` | Student/term/program/department/year, date/status/reference, processor/approver/date/remarks | Current code directly supports term registration states and reference; some actors/dates are absent from UI. | V1 term-level process; record only actors actually captured by backend. |
| `document_types` | Name/description/admission applicability/required flag/allowed types/size/active | Current code has requirement labels/status but configurable catalog controls are limited. | Requirement catalog V1 if per-student requirements are configurable; policy fields need approval. |
| `student_documents` | Student/type, file name/storage path/type/size/hash/version, uploader/time, verification state/actor/time/rejection, expiry/retention | Current code supports requirement state, file preview and review note, not durable upload, versioning, hash or retention. | Metadata and private storage key V1; history/security/retention fields require policy; DB + BE + FE. |
| `document_verifications` | Document, reviewer, state, remarks, verification time | Current UI reflects current document state, not a separate verification event history. | Postpone until audit history is required; DB + BE + FE. |
| `rooms` | ID/code/name/building/floor/capacity/type/status | Current code uses code/name/capacity/status. | Core room values V1; other fields optional if used; DB + BE + FE. |
| `class_offerings` | Course/term/department/program, section/year/capacity/type/modality/status, creator/time | Current code supports most section attributes and a narrowed third-year/F2F scope. | V1 section data; do not broaden active workflow without approval; DB + BE + FE. |
| `class_schedules` | Offering, weekday/start/end, room/building/type/effective dates/status, modifier/time | Current code stores one recurring weekly day/time/room on each section. | Can be represented as section fields in V1; separate table if multiple schedules/effective dates are approved. |
| `faculty_assignments` | Offering/staff, assignment role/actor/date/status | Current code uses one faculty account on each sample section; no multi-faculty assignment lifecycle. | A faculty FK on section is sufficient for current flow; junction table later if multi-assignment is required. |
| `class_enrollments` | Term enrollment/student/offering, added/dropped state/date/reason/actor | Current code has class roster/selection, but detailed drop history is not fully implemented. | V1 class membership; lifecycle fields only where workflow is adopted; DB + BE + FE. |
| `attendance_sessions` | Offering/schedule/date/session number/times/deadline/recorder/time/remarks/status | Current code uses offering/date/open-submitted/recorded time; other fields absent. | V1 meeting/session; unused deadline/session-number fields postponed; DB + BE + FE. |
| `attendance_records` | Session/student/class enrollment, status, time in/out, minutes late, absence reason/remarks, recorder/modifier and times | Current code uses per-student status/time-in/out/remarks; minutes late/reason and separate modifier are not used. | Core fields V1; unused fields wait until UI/policy requires; DB + BE + FE. |
| `attendance_alert_settings` | Absence/tardiness thresholds, guardian/faculty/registrar recipients, enable/effective dates | Current code has thresholds, faculty/registrar flags and enabled; no guardian preference or effective window. | Current settings subset V1; recipient and scope decisions needed; DB + BE. |
| `attendance_alerts` | Student/attendance, recipient/contact, type/message/channel, trigger/send time, delivery status | Current code has derived/sample alert indications, no delivery workflow. | Postpone until alert delivery is implemented; DB + BE + FE. |
| `grading_periods` | Term, period name/date range/deadline/status | Current active period list is Finals-only; no period deadline workflow. | A `Final` period key may suffice for V1; table only if period metadata is used. |
| `assessments` | Offering/period, name/type/maximum/weight/date/creator/time/status | Current staff workflow uses most scoring fields; period is `Final`. | V1 if assessment entry remains; DB + BE + FE. |
| `assessment_scores` | Assessment/student/raw score/remarks/encoder/time/updater/time | Current staff workflow uses assessment scores; actors/history are limited. | V1 score data; backend actors/timestamps; DB + BE + FE. |
| `student_grades` | Student/class enrollment/term/period; prelim/midterm/final, letter/points/remarks/official/status; encode/review/approve/post actors/times | Current code supports Finals-only official result and status, plus staff workflow; fixed prelim/midterm fields conflict with latest scope. | V1 one official result per enrollment/current period; omit fixed inactive columns; DB + BE + FE. |
| `grade_scales` | Equivalent/min-max percentage/grade point/verbal/pass/term | Code has two grade-rule representations that must be unified. | V1 only after values and rounding are approved; DB + BE + FE. |
| `student_academic_records` | Student/term/program/year, enrolled/completed/failed units, term/cumulative GPA, standing, verification | Current code derives units/GWA/standing from terms and posted subject grades. | Prefer derived query/view; postpone stored snapshots unless required. |
| `report_definitions` | Report code/name/type/description/permission/format/active | Current code defines report choices in application logic and role lists. | Keep definitions in code for V1; DB table later if users configure definitions. |
| `generated_reports`, `report_history` | Generator/definition/time, term/department/program filters, format/file/status/expiry/filter snapshot, record count/download | Current reports are generated/exported and recent UI state is local; archive and retention are not implemented. | Postpone persistence until archive/retention is approved. |
| `audit_logs` | Actor/snapshot, module/entity/record/action, before/after, description/reason, IP/user-agent/status/time | Current audit UI uses similar fields, but actors/IPs are browser/demo values. | V1 audit store with server-generated provenance; DB + BE + FE integration. |
| `notifications` | Recipient(s), type/title/message/channel/related record/read/delivery state and dates | Current preferences and sample alerts are not a notification delivery system. | Postpone queue/history until delivery channel and policy exist. |
| `backup_configurations`, `backup_history` | Schedule/type/storage/retention/enabled; run times/size/path/status/checksum/failure/actor | Current screens use fabricated sample data; no real backup service exists. | Postpone from academic V1; operational service if required. |
| `retention_policies` | Record type/duration/unit/start event/archive/disposal/active/updater/time | Current code has no retention rules or disposal automation. | Postpone pending institutional policy. |
| `system_events`, `system_performance_metrics` | Event type/module/description/severity/time/resolution/actor; metric/value/unit/component/time/threshold/environment | Current monitoring content is simulated; no telemetry/event source is implemented. | Postpone to a monitoring/operations service. |

## 3. Tables and fields supported by both code and previous design

“Supported” here means the latest code has a corresponding concept/field and the previous design proposes a related table; it does not mean every proposed field is used or approved.

| Shared concept and code-backed field subset | Why it matters | DB / BE / FE / timing |
|---|---|---|
| Account and access: username, email, display name, role/status, password hash, failed attempts/lockout/last login; role/permission codes | Current sign-in and portal authorization are local and split. | DB + BE + FE; V1 for server-backed app. |
| Student record: student number, name, program/department/year, admission type/status, email/contact | Registry and portal data must join to enrollment, attendance, grades and documents. | DB + BE + FE; V1; finalize name/contact ownership. |
| Staff identity/scope: employee number, title, department, contact, faculty assignment | Staff accounts manage schedules, attendance and grades. | DB + BE + FE; V1 where persisted staff workflows require it. |
| Department/program/course/term/room catalog | Current selection and timetable workflows depend on catalog relationships. | DB + BE + FE; V1 for the active workflows. |
| Admissions and correction queues with statuses, dates and reviewer notes | Both exist as actual student/registrar flows. | DB + BE + FE; V1. |
| Term and class enrollment as separate student/term and student/section relationships | Current code has both processes and they have different statuses. | DB + BE + FE; V1. |
| Student document requirement/status, document request/release state and file metadata | Current UI supports upload/review/requests, but not a durable private file service. | DB metadata + BE + FE + storage; V1. |
| Dated attendance meeting and student status/time/remarks | Faculty entry and student summaries depend on attendance. | DB + BE + FE; V1. |
| Assessment, score, grade state/release, grade scale | Staff score entry and student posted grades exist, but their sources conflict. | DB + BE + FE; V1 after one authoritative grade model is defined. |
| Audit actor/action/record/time; user preferences | Current UI demonstrates these states and requires shared persistence if retained. | DB + BE + FE; V1 for audit; preferences V1 only if cross-device persistence is required. |

## 4. Design tables/fields proposed but not used by current code

These are not current implementation requirements; include only if the team adopts the previous design’s broader scope.

| Unsupported proposal | Source and why it matters | DB / BE / FE / timing |
|---|---|---|
| Course prerequisite management and `minimum_grade`/requirement type | Previous design `course_prerequisites`; current catalog/enrollment code does not check prerequisites. | DB + BE + FE only if prerequisite validation is required; postpone. |
| Guardian/emergency-contact subrecords and detailed prior-school/transfer credential verification | Previous design `guardians`, `emergency_contacts`, `educational_background`; no corresponding forms/storage flow found. | Postpone unless team confirms collection; then schema + backend + frontend. |
| Full demographic/person profile fields beyond current forms (gender, nationality, civil status, birthplace, suffix, preferred name, alternate contact) | Previous design `persons`; not used in current forms/stores. | Do not add merely for completeness; approve exact fields first. |
| Document verification event history, file hash/version, expiry and retention | Previous design has detailed history/retention fields; current UI keeps current state, not history/version lifecycle. | Basic document metadata V1; event history and retention later if policy requires. |
| Attendance session number/deadline, minutes-late/reason, guardian alerts and delivery records | Previous design expands attendance beyond the current per-student fields/settings. | Keep current marks/session state V1; unused subfields and alert delivery later. |
| Period deadlines, grading-period schedule, preliminary/midterm fixed grades, letter grades/points | Previous design includes a wider grading model; current active workflow is Finals-only. | Do not restore inactive periods or columns; add only after explicit scope approval. |
| Student academic summary snapshots (units/GPA/standing) | Previous design stores aggregates; current code derives these values. | Prefer derived queries; postpone materialized snapshots pending reporting/performance need. |
| Durable report definitions/archives/history | Previous design adds three report tables; current report data is generated in app and history is sample/local. | Postpone until retention and archive behavior are required. |
| Notification delivery queue/history | Previous design `notifications`; current app has preference flags and sample alerts only. | Postpone until server delivery exists. |
| Backup configurations/history, retention policies, system events and performance metrics | Previous design operations tables; current code only provides simulated/sample screens. | Postpone from academic schema; use an operations system if required. |
| Role hierarchy/levels, effective role dates and department-scoped role assignments | Previous design RBAC fields; current accounts have one role and no effective-date UI. | Current roles/permissions V1; advanced scope/effective dates later unless confirmed. |

## 5. Current-code features missing or incomplete in the previous design

The previous design covers most broad academic domains, but these current implementation details need explicit modeling or mapping.

| Current-code requirement missing/incomplete in design | Why it matters / source | DB / BE / FE / timing |
|---|---|---|
| `STUDENT` role as an active login role, and the full current six-role set | `accounts.js` and `staff.js` include ICT_ADMIN, EDTECH, DEPT_HEAD, FACULTY, REGISTRAR and STUDENT; previous design treats student role as optional and seeds five roles. | DB + BE + FE; V1 if student portal remains. |
| One-role-per-account model and conflict between hardcoded capabilities and editable role permissions | Current forms assign one role, while prior design allows many; code has both CAPS and persisted permission matrix. | Choose model and authority; DB + BE + FE; V1 approval. |
| Application `withdrawn` status and current admission/term enrollment status mapping | `script.js` uses `pending/review/accepted/rejected/withdrawn`; `registry.js` uses `Pending/Verified/Enrolled`. Prior design lists generic status but does not establish this exact mapping. | DB + BE + FE; V1. |
| Reset code attempts and resend cooldown; split staff versus student/registrar password state | `auth.js` stores tries/used/expiry/resend behavior; `staff.js` separately stores staff password/lock state. Prior reset table lacks all these details. | DB + BE + FE; V1 if reset flow remains. Centralize security state server-side. |
| `Left Early`, attendance `Open` / `Submitted`, time-in/out and free-form remarks together | Current `staff.js`; prior design has broad attendance fields but root draft omits some and previous design does not ensure the exact vocabulary is used. | DB + BE + FE; V1. |
| One shared relationship between staff assessment scores, grade-sheet decisions and the student's released final/INC grade | `staff.js`, `registrar.js`, `data.js` currently use overlapping but distinct stores. Prior design's fixed prelim/midterm/final columns do not fit current Finals-only flow. | DB + BE + FE; V1. |
| Current security settings: max failed attempts, lock minutes, minimum password length and session timeout | `staff.js` / `auth.js`; prior design has some user fields but not the current configurable policy values as a clear typed settings model. | DB + BE; V1 for enforced policy. |
| Current per-user student/registrar/staff preferences (email visibility, timezone, notifications, contact settings) | `script.js`, `registrar.js`, `staff.js`; prior design has no dedicated user-preference table. | DB + BE + FE only if they must persist across devices; otherwise can remain local. |
| Current course offering attributes `Face-to-Face`, `Lecture` / `Combined`, third-year scope and one displayed weekly slot | `staff.js`; previous design has analogous class fields but does not represent that latest code scope explicitly. | Schema supports needed fields; BE + FE keep active UI scope; V1. |
| Prototype-only data provenance: demo credentials, synthetic audit IPs, sample rosters/grades/backup events | Current code contains these as seed/sample data; previous design has generic seeds but does not identify these current samples as non-production. | No production seed import; backend seed/migration planning only. V1 safety requirement. |

## 6. Features added, removed, renamed or revised in the latest code

| Change in current repository | Evidence / why it matters | DB / BE / FE / timing |
|---|---|---|
| Combined admin portal split into `registrar.js` and `staff.js`, with shared `registry.js` | Current comments and Git history (`b93c721`) separate Registrar work from ICT/EdTech/Department Head/Faculty responsibilities. Permissions and actors now belong to separate workflows. | DB + BE + FE integration; V1. Do not create a combined admin entity/table. |
| Shared login/account data and reset/lockout behavior added | `accounts.js`, `auth.js`, `staff.js`; commits include `0cf27a0`. Security flows span all roles but remain split between browser stores. | Users/security schema + BE + FE; V1 if auth remains. |
| Sixth role `STUDENT` active in code; Student login opens separate portal | `accounts.js`, `script.js`; prior design's role list makes student login optional. | Include student role if portal stays; V1. |
| Active schedule scope narrowed to third year, face-to-face | Commit `1348527`, comments/constants in `staff.js`. Broader modalities/year workflows must not be silently reinstated. | Keep V1 offering UI/config within current scope; flexible storage does not imply supporting removed flows. |
| Active grading scope narrowed to Finals only | `data.js` and `staff.js` state Finals-only; `PERIODS` contains `Final` and student grade rules use final. Do not revive preliminary/midterm columns or screens. | Model active final grade in V1; future periods require a separate team decision. |
| Student record history still contains prior academic terms/grades | `data.js` stores multiple prior terms while current scheduling is narrowed. Active schedule scope is not a history-retention instruction. | Preserve term-based historic results if migrating approved data; V1 schema should not prohibit history. |
| Attendance now has meeting submission workflow and broader statuses | Current staff entries include `Left Early`, time fields, remarks and session submission. | Include V1 fields/statuses; schema and FE/API mapping required. |
| Audit, account, permission, scheduling, reports, backup and monitoring panels expanded | Current UI includes real workflow state for some (account/permissions/audit/schedule), but backup/monitoring/report artifacts are largely mock/local. | Persist implemented administrative actions; postpone mock operational persistence. |

## 7. Conflicting field names, types, status values and relationships

| Conflict | Compared sources and why it matters | Recommended resolution / impact |
|---|---|---|
| Identity keys and ownership | Root SQL uses `student_number` as student PK and duplicates names in `students` / `users`; previous design uses numeric IDs plus `persons`; code uses student number plus name/profile objects in independent storage keys. | Approve one canonical model. Recommended: stable internal IDs, unique student number, one shared person record only if one-person/account cardinality is approved. DB + BE + FE; V1 decision. |
| Staff profile versus login row | Root SQL has `users.full_name/mobile/office`; previous design splits `persons`, `staff`, `users`; code has account name/title/department/employee fields plus staff account rows. | Keep credential fields in `users`; staff employment/department data in `staff`; shared name/contact ownership must be agreed. DB + BE + FE; V1. |
| Account status vocabulary | Root SQL `active/locked/disabled`; previous design leaves `account_status` generic; code uses `Active`, `Locked`, `Inactive`, `Suspended`, `Pending Activation`. | Define canonical server codes and map labels; include all currently used states only if each transition is real. DB + BE + FE; V1. |
| Role multiplicity | Code account forms assign one role; root SQL and previous design use `user_roles` many-to-many. | Prefer one `role_id` on `users` for current behavior unless team explicitly approves multi-role or scoped assignments. DB + BE; FE changes only if multi-role UI is adopted; V1. |
| Course term versus section membership called `enrollments` | Root SQL `enrollments` means student-to-section with `enrolled/dropped/completed/withdrawn`; previous design separates `student_enrollments` (term) and `class_enrollments`; code has term verification and class rosters separately. | Use distinct `term_enrollments` and `class_enrollments`; do not map both to one status column. DB + BE + FE; V1. |
| Application status | Root SQL enum lacks `withdrawn`; current code supports it; previous design status is broad. | Define `pending/review/accepted/rejected/withdrawn` or a lookup/status history, separate from enrollment status. DB + BE + FE; V1. |
| Grade model | Root SQL `academic_grades` has generic `grade_key`/numeric `grade_value`; previous design `student_grades` adds fixed prelim/midterm/final columns and period FK; current code has staff weighted assessments and a Finals-only official student result with `INC`. | Use assessment/score child rows plus one official grade per class enrollment and active period; omit fixed inactive period columns; represent `INC` explicitly. DB + BE + FE; V1. |
| Grade workflow status casing/lifecycle | Current staff uses title-case `Draft/Submitted/Returned/Approved/Posted`; student store uses lowercase; root schema uses lowercase enum without `Returned`; previous design uses generic status. | Normalize to lowercase codes at API/database boundary and define permitted transitions, including `Returned`. DB + BE + FE; V1. |
| Attendance vocabulary and meeting state | Root SQL omits `Left Early`, time-in/out, remarks and session state; previous design has these fields under differently named session/record tables; current code supports them. | Store meeting state separately from per-student mark; include exact current mark values. DB + BE + FE; V1. |
| Class section names/relationships | Root SQL `course_sections` combines one schedule and `faculty_user_id`; previous design separates `class_offerings`, `class_schedules`, `faculty_assignments`; code has one slot and staff username per sample class. | V1 may keep one slot/faculty FK on a section; split child tables only if multiple schedules/instructors are needed. DB + BE; FE accordingly. |
| Document catalog and review | Root SQL uses free `requirement_code` on `student_documents`; previous design `document_types` plus `document_verifications`; code has requirement list/current status and review note. | Add requirement catalog if requirements are configurable; persist current state/reviewer on document; postpone verification-event history. DB + BE + FE; V1. |
| Grade scale type and meaning | Root SQL `maximum_grade` / verbal equivalent; previous design percentage min/max, grade points and pass flag; code has lower-is-better numeric scale and separate percentage-to-grade thresholds. | Approve one conversion representation and reconcile `data.js` vs `staff.js`; no migration until rules are agreed. DB + BE + FE; V1. |
| Dates and timestamps | Current term setup can be display strings; root SQL `DATE`/`TIMESTAMP`; previous design uses `DATE`, `DATETIME`, and current-term flag. | Confirm term dates, timestamp/timezone policy and current-term constraint. DB + BE; V1. |
| Profile correction semantics | Root SQL stores field/old/requested values and status; previous design also has supporting document/applied time; code has pending requests and registrar application. | Keep the request and decision lifecycle; only include evidence/application metadata if captured and approved. DB + BE + FE; V1. |
| Audit provenance | Root SQL and previous design allow actor/time/IP fields; code supplies fabricated IPs and browser timestamps. | Server sets actor and timestamp; do not migrate synthetic IP/event values. DB + BE; V1. |

## 8. Recommended Version 1 tables

This is the recommended persisted scope for the currently represented workflows. It is intentionally not the previous 48-table inventory.

| Recommended table(s) | V1 fields/concepts | Source, why, and implementation impact |
|---|---|---|
| `persons` (subject to approval), `users`, `students`, `staff` | Shared names only if approved; `users` username/email/password hash/role/status/security timestamps; student number/program/department/year/admission/status; staff employee/title/department/contact | Current code has distinct login, student and staff data. The previous design normalizes identity, but the exact person cardinality is not implemented. DB + BE + FE; V1 identity decision. |
| `roles`, `permissions`, `role_permissions` | Six current role codes; permission codes and approved role-permission mapping | Current staff role editor and app pages require authorization. Use one role per user unless multi-role is approved. DB + BE + FE; V1. |
| `password_reset_requests` | User, reset-token hash, created/expiry, attempts, consumed state and rate-limit data as selected | Current reset behavior needs durable, server-controlled state. DB + BE + FE; V1 if reset remains. |
| `user_preferences` | User-owned timezone, email visibility, notification/profile preferences that must follow user | Existing portal uses local preferences; add only for cross-device persistence. DB + BE + FE; V1 if retained. |
| `departments`, `programs`, `academic_terms`, `courses`, `rooms` | Codes/names/status and the identifiers used by current registry/catalog; units; approved structured term dates/current state; room capacity/status | Current registry and schedule workflows use these. DB + BE + FE; V1. |
| `course_sections` | Course/term/department/program, section/year, one faculty assignment, one weekly day/time/room, modality/type/capacity/status | Matches present schedule/roster behavior without premature schedule/faculty junction tables. DB + BE + FE; V1. Split schedules/assignments later if workflow expands. |
| `admission_applications` | Applicant identity, program/term/type, submitted/decision state/date, reviewer/remarks, optional student link | Current student and registrar application workflow. DB + BE + FE; V1. |
| `term_enrollments`, `class_enrollments` | Student-term registration/verification; student-section selection/status; approved actors/time where recorded | Current registry term state is distinct from class rosters. DB + BE + FE; V1. |
| `document_requirements`, `student_documents`, `student_document_requests` | Requirement catalog/code; per-student state, review note and file metadata/storage key; COR/COE/TOR request/release state | Current document UI; private storage for file bytes. DB + BE + FE + file storage; V1. |
| `profile_correction_requests` | Student, field, old/requested values, reason, status, reviewer/remarks and dates | Current student-to-registrar approval flow. DB + BE + FE; V1. |
| `class_meetings`, `attendance_records` | Section/date/open-submitted state; student status incl. `Left Early`, time-in/out, remarks and actor/time | Current staff attendance; distinct session and student records. DB + BE + FE; V1. |
| `attendance_alert_settings`, `system_settings` | Current absence/tardiness rules and security policy values, with explicit scope/types | Settings affect existing flows but need canonical types and server enforcement. DB + BE; V1 for settings retained in product. No delivery queue. |
| `assessments`, `assessment_scores`, `grade_sheets`, `student_grades` | Assessment definitions/scores; one sheet per section/current period with review state/note/actors; one official result per class enrollment/period incl. `INC` | Current staff and student grade flows must converge. DB + BE + FE; V1. |
| `grade_scales` | Approved percent/numeric mapping, verbal and passing values, version/scope if policy requires | Code has inconsistent rule sets. DB + BE + FE; V1 after Registrar/team approval. |
| `audit_logs` | Actor, server time, module/entity/key/action/result, safe before/after/description fields | Current audit UI exists; browser provenance is not authoritative. DB + BE + FE; V1. |

## 9. Tables and features to postpone

| Postponed table/feature | Source and why | DB / BE / FE / timing |
|---|---|---|
| `course_prerequisites` | Previous design only; no current prerequisite data or validation. | Postpone; schema + BE + FE if implemented later. |
| `guardians`, `emergency_contacts`, `educational_background` | Previous design only; no current collection/review forms. | Postpone until requirements and forms are approved. |
| `document_verifications` event history, document version/hash/expiry/retention | Previous design extends current-state UI without a current history/policy workflow. | Keep basic current state in V1; history/policy later. |
| `attendance_alerts` delivery/event history | Current settings/sample alerts do not deliver notifications. | Postpone until real channel and lifecycle exist. |
| `grading_periods` dates/deadlines and inactive midterm/preliminary workflows | Current code actively uses Finals only. | Do not restore those workflows. A period lookup/table can be added if multiple periods become active. |
| `student_academic_records` stored aggregate/GPA snapshots | Current data computes GWA, units and standing from source results. | Postpone; derive values unless snapshots are formally required. |
| `report_definitions`, `generated_reports`, `report_history` archive | Current reports generate/export; persistence and retention are not implemented. | Postpone durable archive; keep report computation in application. |
| `notifications` queue/history | Current code stores preferences and sample alerts, not delivery. | Postpone until provider, retries and retention are specified. |
| `backup_configurations`, `backup_history`, `system_events`, `system_performance_metrics` | Current data is simulated; these are infrastructure/operations concerns. | Exclude from academic V1; separate operational system if required. |
| `retention_policies` | No approved policy or automated retention behavior in current code. | Postpone pending policy. |
| MFA challenge/device, persistent session, email verification/delivery tables | Current code has a flag and demo inbox but no second-factor/email/session workflow. | Do not invent tables. Design after authentication requirements are approved. |
| Multiple faculty assignments, multiple schedule rows/effective schedule history | Current UI shows one faculty and one recurring slot per sample section. | Keep simple V1 representation; normalize later if requirements demand it. |

## 10. Required Version 1 relationships and foreign keys

These are relationship requirements for the proposed V1 model, not executable SQL. The exact key types and delete rules remain design decisions.

1. If adopted, `users.person_id`, `students.person_id`, and `staff.person_id` reference `persons`; decide one-to-one cardinality and whether applicants may exist without accounts.
2. `programs.department_id` references `departments`; `students.program_id/department_id` reference the approved catalog. Decide if current program/department is derived from term enrollment rather than copied.
3. If single role is retained, `users.role_id` references `roles`; `role_permissions` joins `roles` to `permissions`. If multi-role is approved, substitute `user_roles` with approved scope rules.
4. `password_reset_requests.user_id` references `users`.
5. `admission_applications` references applicant person (or applicant identity), optional converted student, program, term and reviewer user.
6. `term_enrollments` references student, academic term, program/department and verifier/approver users.
7. `courses` reference department if that relationship is adopted; `course_sections` reference course, term, department/program, faculty user/staff and optional room.
8. `class_enrollments` reference student and course section; if they also reference a term enrollment, the backend must ensure its student and term match the selected section.
9. `student_documents` reference student and requirement; uploader/reviewer reference users. Storage key points to protected external file storage, not a local browser path. `student_document_requests` reference student and releasing user.
10. `profile_correction_requests` reference student, reviewer user and optional supporting document only if that upload flow exists.
11. `class_meetings` reference course section and optional submitting user; `attendance_records` reference meeting, class enrollment and recording user. Ensure each enrolled student has at most one mark per meeting.
12. Assessments reference section and active period key/period; scores reference assessment and class enrollment. Validate assessment-section and enrollment-section consistency in the backend.
13. `grade_sheets` reference section and active period, with submit/review/approve/post actors referencing users. Official `student_grades` reference class enrollment and period; enforce one authoritative result per enrollment/period.
14. `grade_scales` reference the approved policy scope/term if scales vary; `system_settings` reference updating user; `user_preferences` reference user; `audit_logs` optionally reference actor user.

Foreign keys cannot alone enforce schedule overlaps, capacity, consistent term membership across related rows, valid assessment weight totals, score bounds, permitted status transitions or authorization. These require backend transaction logic and tests.

## 11. Fields and design decisions requiring team approval

| Decision to approve | Source / why it matters | DB / BE / FE / timing |
|---|---|---|
| Whether shared `persons` is needed, what name/contact fields it owns, and whether a person can have multiple accounts | Current app duplicates identity in accounts, registry and profile; previous design normalizes into persons. | DB + BE + FE; decide before V1 identity schema. |
| One role or multiple roles per account; whether department scope exists; which permission matrix is authoritative | Current forms assign one role; previous design allows many; code has both capabilities and editable role permissions. | DB + BE + FE; V1 access decision. |
| Canonical account states and valid transitions | Code has Active/Locked/Inactive/Suspended/Pending Activation; root SQL uses a smaller enum. | DB + BE + FE; V1. |
| Canonical admission, term-registration and class-enrollment statuses and links | Code has different states and title casing per process; root schema conflates terms/sections. | DB + BE + FE; V1. |
| Applicant-to-student conversion and whether applicants can use accounts before acceptance | Application forms and sample records do not define full identity conversion rules. | DB + BE + FE; V1 admissions decision. |
| Term dates/current term, uniqueness of term labels and timezone/timestamp policy | Current dates include text; previous schema imposes date/current constraints not demonstrated by code. | DB + BE; V1 catalog policy. |
| Whether an offering can have multiple schedules or multiple instructors | Previous design normalizes these; current code has one slot/faculty. | DB + BE + FE if expanded; simplest V1 matches current. |
| Whether third-year/F2F/Finals-only is approved product scope or a temporary demo limit | Latest code and Git history narrow the active UI, while older design is broader. | BE + FE scope approval; V1 behavior must not silently restore removed features. |
| Grade conversion, rounding, pass/fail, Dean's List, INC and grade-sheet state transitions | `data.js` and `staff.js` rules differ; existing schema choices do not resolve policy. | DB + BE + FE; approve before grading V1 migration. |
| Attendance meaning of Late/Excused/Left Early, threshold calculation and alert recipient/scope | Current marks and alert settings require institution semantics. | DB + BE + FE for recorded marks/settings; alert delivery may be postponed. |
| Which student demographic, guardian, emergency and prior-school fields are actually required | Previous design includes fields absent from current UI. | DB + BE + FE only if confirmed; otherwise postpone. |
| Document requirements/applicability, MIME/size limits, storage, access and retention | Current selection is not durable; previous design has unapproved metadata/retention. | DB + BE + FE + storage; approve before document migration. |
| Persistence/retention for preferences, report archives and audit values; backup/monitoring ownership | Current UI mixes real preferences/audit concepts with mock operations data. | V1 preferences/audit only as approved; operational tables later. |
| Key strategy, uniqueness, nullable fields, delete behavior and seed/migration policy | Root SQL and previous design use different key strategies; previous design marks these choices as assumptions. | DB + BE; resolve before generating SQL. |

## 12. Final proposed Version 1 table list

Recommended, code-led list; names are conceptual and must be normalized once. This is not final SQL approval.

1. `persons` — conditional shared identity table; minimal fields only after team confirms ownership/cardinality.
2. `users`
3. `students`
4. `staff`
5. `roles`
6. `permissions`
7. `role_permissions`
8. `password_reset_requests`
9. `user_preferences` — if cross-device persistence is required.
10. `departments`
11. `programs`
12. `academic_terms`
13. `courses`
14. `rooms`
15. `course_sections` — includes the current single weekly schedule and faculty assignment unless multi-row scheduling is approved.
16. `admission_applications`
17. `term_enrollments`
18. `class_enrollments`
19. `document_requirements`
20. `student_documents`
21. `student_document_requests`
22. `profile_correction_requests`
23. `class_meetings`
24. `attendance_records`
25. `attendance_alert_settings`
26. `assessments`
27. `assessment_scores`
28. `grade_sheets`
29. `student_grades`
30. `grade_scales`
31. `system_settings`
32. `audit_logs`

`persons`, `user_preferences`, and the exact separation of schedule/faculty data are approval-dependent. A single-role `users.role_id` is recommended for the current UI instead of a `user_roles` table; if multiple roles are approved, replace that field with `user_roles`. No separate `student_academic_records` table is recommended while its values are derived.

## 13. Recommended implementation order

1. Resolve the approval questions in section 11 and obtain explicit agreement on current scope; do not infer missing policy from the previous draft.
2. Establish the existing database baseline with read-only checks in an actively connected SQLTools session. The checked-in `.session.sql` file is not evidence of query results.
3. Decide identity ownership/cardinality, one-role versus multi-role authorization, status codes, keys and timestamp rules.
4. Design backend authentication/authorization first: server-side password hashing, lockout, reset token lifecycle, session policy and server-derived actor identity.
5. Define reference/catalog tables and verified source data: departments, programs, terms, courses, rooms, roles and permissions.
6. Define persons/users/students/staff and preferences, keeping official student data separate from editable account preferences.
7. Define admissions, term registration, section offerings and class enrollment as separate processes; specify transactional capacity/duplicate/term-consistency checks.
8. Define document requirement/status metadata and private file storage/access/retention.
9. Define attendance session/row state, accepted statuses and approved alert policy.
10. Define assessment scores, one grade-sheet approval lifecycle, official posted grade and approved grade-scale rules.
11. Add audit and typed settings with server-generated provenance and append-only application permissions.
12. Only after design sign-off, generate migration SQL. Review it offline, test on a disposable/local database, plan backups/rollback, and obtain separate explicit authorization before any Hostinger write.
13. Replace browser stores with API-backed workflows incrementally; test role enforcement, state transitions, foreign-key consistency, capacity checks and calculated summaries.

## Inspected sources and database activity

- **Current implementation truth:** `index.html`, `demo-tools.html`, `accounts.js`, `auth.js`, `data.js`, `registrar.js`, `registry.js`, `script.js`, `staff.js`, related CSS (`style.css`, `registrar.css`, `staff.css`, `reports.css`), and recent Git history.
- **Previous design reference:** `database/design/BITS-SIMS_Database_Design.md`.
- **Prior code review:** `database/design/v1-decisions-latest.md`.
- **Existing SQL/design:** `database.schema.sql`, `database/migrations/001_initial_schema.sql`, `Hostinger school database.session.sql`, `database/README.md`, `database/design/v1-decisions.md`, `database/design/v1-scope-reconciliation.md`, `.vscode/settings.json`.
- **Excluded as instructed:** PDF contents.
- No active SQLTools connection was available, so database checks could not be performed. No database-changing SQL was executed. The Hostinger database and application files were not modified.
