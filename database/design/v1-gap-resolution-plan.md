# Version 1 Gap Resolution Plan

**Review date:** November 10, 2026  
**Status:** Implementation planning only; not migration approval.

This plan resolves three gaps documented in
[`current-code-reassessment.md`](./current-code-reassessment.md) against the
current application, the approved identity decision, and the earlier planning
documents. No application or SQL changes are made by this plan.

## Guiding decisions and constraints

- Implement the approved Version 1 identity model: shared `persons`; `users`,
  `students`, and `staff` reference a person; at most one user account per
  person; one role per user stored as `users.role_id`.
- Do not add a Version 1 `user_roles` table. Use `roles` and
  `role_permissions` for the one-role permission model, with the backend as
  the enforcing authority.
- Keep guardian and emergency-contact entities postponed. Their current
  Registrar inputs must not silently become V1 tables or columns; retain them
  as future-phase requirements.
- The frontend currently has no backend API. Browser stores and demo accounts
  are not production identity, workflow, or audit sources.
- Keep external business identifiers (student number, application number,
  enrollment reference, course code) for display/integration as appropriate;
  use stable internal identifiers for foreign keys. Final key formats and
  field requirements need approval before schema design.

## GAP 1: Staff account creation and login are disconnected

### Current source of truth by operation

| Operation | Current source | Current behavior |
|---|---|---|
| Demo account creation/credentials | `accounts.js` | Defines a fixed `ACCOUNTS` array, including login username, email, plaintext demo password, name, role and some student/staff attributes. `SIMSAccounts.find()` and `byRole()` only search this array. |
| Staff portal account list | `staff.js` | `seedUsers()` creates a separate ten-row account-management dataset in `db.users`, held under `bits-sims-staff-users`. |
| Staff account creation/editing | `staff.js` | `saveAccount()` adds or edits `db.users`, but does not add/update the fixed `ACCOUNTS` list or the staff authentication snapshot. |
| Staff authentication | `staff.js` | At startup, builds `ACCOUNTS` from `SIMSAccounts.byRole(...)`. `findAccount()` searches only this fixed derived list; `authenticate()` then checks status/password/lockout against that account and matching `db.users` record. |
| Student/Registrar lookup and authentication | `auth.js` plus `accounts.js` | `auth.js` resolves accounts with `SIMSAccounts.find()`. `script.js` routes Student to `SIMSAuth.check()` and delegates Registrar and other staff to their portal authenticators. |
| Staff reset integration | `auth.js` and `staff.js` | The reset UI is shared, but staff password updates call `SIMSStaff.setPassword()`, which also requires `findAccount()` to find the fixed account. |
| Role and permission editing | `staff.js` | Account rows store role codes as strings; `db.perms` stores a separate editable permission array. `CAPS` is the actual hardcoded staff page/capability gate. |

### Why new staff accounts cannot log in

`saveAccount()` persists a new row only to `db.users`. Authentication never
searches that collection for credentials: `staff.js` authenticates against
the `ACCOUNTS` array created once from hardcoded `SIMSAccounts`. A new row is
therefore invisible to `findAccount()`. Editing a row's username, email or
role can also make it disagree with the original login account. Staff reset
and password-setting paths share this limitation. In addition, the account
form has no password-setting/provisioning action; it creates a
`Pending Activation` row without a corresponding login credential or
activation flow.

**Classification:** Implemented but incomplete. The authoritative account
source is duplicated and the browser account editor is not connected to the
login source.

### Recommended authority

For production, the backend `users` records must be the single authority for
username/login email, password credential, active account status and role
assignment. The frontend should obtain account lists and authentication
results through that service; `accounts.js` should be removed from
production builds and retained only as an explicitly isolated demo fixture,
if still useful.

`roles` is the authoritative set of role identities. Persist exactly one
`role_id` on each `users` row, referencing `roles.role_id`. Seed/maintain the
six approved role codes (`ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`, `FACULTY`,
`REGISTRAR`, `STUDENT`) as backend-managed role data. Map role codes to labels
and portal presentation in the client. `role_permissions` links a role to
permission records; the server must enforce permissions and applicable scope.
Do not use `user_roles` for V1.

The approved one-account-per-person rule means a unique `users.person_id`
relationship; it does not mean every person record must automatically receive
a login. Account invitation/activation and student account provisioning still
need product decisions.

### Temporary browser-prototype option (not applied)

The safest choice is to avoid changing prototype authentication unless a
working account-creation demonstration is specifically required. If a
temporary fix is approved:

1. Replace the static-only account lookup with one shared account registry
   interface that supports lookup, list, create and update.
2. Make both the account editor and all three login/reset paths use that same
   interface. Do not retain a second mutable `ACCOUNTS` snapshot in
   `staff.js`.
3. Keep demo fixtures clearly separate from user-created demo records and
   make the choice of demo credentials/activation explicit. Editing a role or
   login identifier must update the record used by authentication.
4. Handle password provisioning, reset and lockout in the same record/service;
   never treat the prototype hash or browser storage as secure.
5. Add regression checks for creating an account, logging in with the new
   credentials, role changes, lockout, reset, and inactive/suspended status.

This remains a local demonstration only: localStorage is user-editable,
per-browser, and unsuitable for real accounts. It is not a substitute for
server authentication.

### Required backend/database solution

- API operations: authenticate; list/search accounts for authorized
  administrators; create an account with person and role references; update
  allowed account properties; activate/invite; change/reset password; lock,
  unlock, suspend/reactivate; and retrieve the authenticated user's role and
  permissions. All writes must validate uniqueness and status transitions.
- Authentication must use server-side password hashing, generic error
  behavior where appropriate, throttling/lockout, server-managed sessions,
  and server-derived actor identity. Reset credentials are generated/delivered
  server-side and only a safe hash/state is persisted.
- `users` needs a stable primary key, unique `person_id`, unique login
  identifiers under an approved policy, password hash, account status and
  approved security fields. `users.role_id` is a foreign key to `roles`.
- `roles`, `permissions` and `role_permissions` provide the role-permission
  catalog. The permission catalog and scope model need to be reconciled with
  hardcoded `CAPS` before moving enforcement to the server.
- Keep account/profile contact values distinct by purpose: login email on
  `users`; canonical personal identity/contact on `persons`; employment
  contacts on `staff` only if they differ. Team approval is needed for
  uniqueness and ownership rules.

## GAP 2: Enrollment, grades, and attendance are disconnected

### Data-source and identifier inventory

| Area | Current source and browser key/object | Current identifiers | Authority today / disconnect |
|---|---|---|---|
| Student registry/catalog | `registry.js` / `bits-sims-registry` | Student `no` (student number); term enrollment `ref` (for example `ENR-0019`); department/program/course codes; term is a display label in these rows. | Registrar registry is the source for student profiles and Registrar term-enrollment rows only. |
| Student academic records | `data.js` / `bits-sims-academic` | `student.id` is `2024-12345`; subjects have sample IDs such as `itp3112`, `termId` values such as `2627-1`; a subject also has section text such as `BSIT-3B`. | Source for student-facing sample results and aggregate attendance only. Not linked to staff grade sheets or staff attendance rows. |
| Student admissions/enrollment wizard | `script.js` / `bits-sims-admissions` | Application id such as `ADM-2026-004821`; optional display/student id; selected course codes and wizard state. | Source for student application/wizard UI only. It does not create the registry student or roster. |
| Class offerings and rosters | `staff.js` / `bits-sims-staff-classes`, `bits-sims-staff-faculty` | Class id such as `CO-1`; course code and section; roster keyed by student number. | `staff.js` class/roster seed is source for faculty UI only. Roster is a global static array, not membership data tied to each offering. |
| Registrar term enrollment | `registry.js` / `bits-sims-registry` | `ENR-*` reference, student number and display term label. | Source for Registrar's Pending -> Verified -> Enrolled UI, not the student's course selection or staff roster. |
| Faculty attendance | `staff.js` / `bits-sims-staff-faculty` (`db.fac.attendance`) | Class id + meeting date; rows keyed by student number. | Source for staff attendance, summaries and alerts only. |
| Student attendance view | `script.js` static `ATT_COURSES` and generated sessions; `data.js` also contains aggregate counts | Course code/title and generated date/session indexes; no linked meeting or student record ID. | Static student view and academic aggregate are separate from faculty meeting records. |
| Faculty grading | `staff.js` / `db.fac.assessments`, `db.fac.scores`, `db.fac.gradeStatus` | Assessment id; `classId`; period `Final`; score keyed by student number; sheet key is `classId|period`. | Source for faculty calculation and Department Head review; not authoritative student-visible result. |
| Registrar grade posting/student display | `registrar.js` reads staff sheets and separately operates the `data.js` grade queue; `data.js` remains in `bits-sims-academic`. | Staff sheet uses class ID + period; student academic record uses subject ID + term ID. | No single posting operation maps the approved staff sheet/result to a student academic result. |

No current object provides a canonical internal student ID, section-enrollment
ID, term-enrollment ID or shared term foreign key across all workflows.
Student number and codes are useful business identifiers, but current
cross-store equality is an assumption, not a relationship enforced by the
application.

### Applicant to student conversion

**Current flow/source:** applications live in `bits-sims-admissions`. The
student application object has application ID, program, type, term, dates,
status, remarks and optional `studentId`; the applicant is the signed-in demo
student context rather than a complete linked person record. Registrar
registration separately creates a registry student with a generated student
number and adds a pending term enrollment. Accepting an application and
completing its wizard changes the application to `enrolled` but does not call
that Registrar registration operation.

**Duplicates/disconnect:** application, person/profile, registry student and
wizard all hold or imply identity; there is no conversion transaction or
shared person/student ID.

**Required resolution:** define an idempotent backend operation that accepts
an eligible application, creates or links the student profile under the same
`person_id`, assigns/returns a student number, and creates the required term
enrollment. Link the application to `persons`; link its optional converted
student to `students`. Decide whether submitted identity/contact values are a
snapshot or always read from the canonical person record. Do not create a
second person on retry.

**Classification:** Requires backend implementation and database
persistence. Account activation after admission is a separate policy decision.

### Student term enrollment

**Current flow/source:** `registry.js` keeps `enrollments` in
`bits-sims-registry` with `ENR-*`, student number, display name, term string,
program, year, units and `Pending`/`Verified`/`Enrolled`. Registration creates
a `Pending` row. Registrar advances it. The student wizard instead stores
`confirmedOn`, personal data, requirement completion, selected offering
codes and `completedOn` in `bits-sims-admissions`.

**Authoritative source today:** neither is a complete authoritative
enrollment record. They represent different portions of the process.

**Required links:** `student_term_enrollments` (or approved equivalent) must
reference `students` and `academic_terms`, optionally the accepted
`admission_applications` record, and contain a canonical enrollment status
and lifecycle actor/timestamps. Resolve program/year ownership and whether
units are derived from class enrollments or recorded as an approved snapshot.
Keep this separate from class membership.

**Required API operations:** retrieve a student's term enrollments; begin or
submit a term enrollment; validate eligibility and required documents;
verify/approve with authorized Registrar actor; and return the resulting
enrollment/selection data. Enforce duplicate student/term rules
transactionally.

**Classification:** Requires backend implementation and database
persistence.

### Class enrollment or roster membership

**Current flow/source:** the student wizard selects `ADM_OFFERINGS` course
codes and checks 12-24 units in the browser. `staff.js` displays a single
global `ROSTER` keyed by student number for classes whose identifiers are
`CO-*`; class `size` is separately seeded. The Registrar's Class Enrollment
tab has hardcoded examples. Selection does not create membership rows.

**Authoritative source today:** none for actual student-to-section
membership.

**Required links:** `class_enrollments` must reference `students` and
`course_sections`; a term-enrollment reference may be included if approved
and consistently validated. A section must reference its course and term,
and its faculty assignment should reference `staff` (not a username string).
Retain student number/course/section as display/business codes, not
cross-table foreign keys. Roster views, capacity counts and reports must all
query the same membership records.

**Required API operations:** list offerings; submit/select/drop a student's
class memberships; retrieve a faculty section roster; check duplicates,
capacity and student/section term consistency; and report current enrollment
counts. The server, not the browser, is authoritative for 12-24-unit and
capacity constraints if those rules are approved.

**Classification:** Requires backend implementation and database
persistence.

### Attendance meetings and attendance records

**Current flow/source:** `staff.js` stores meetings under `db.fac.attendance`
by `classId` and date; each meeting has `Open`/`Submitted`, recorded time and
rows keyed by student number. Marks include `Present`, `Absent`, `Late`,
`Excused`, `Left Early`, with time-in/out and remarks. `script.js` separately
generates a static student session history; `data.js` stores aggregate
held/absent/late/excused counts.

**Authoritative source today:** staff's per-meeting rows are the most complete
encoding workflow, but are still sample localStorage data and do not drive
the student attendance screen.

**Required links:** `attendance_meetings` references `course_sections` and the
staff/user who recorded/submitted it; `attendance_records` references a
meeting and a `class_enrollments` row (or the approved student-membership
key). Enforce one attendance record per enrolled student per meeting.
Meeting lifecycle and attendance mark are separate statuses. Derive student
attendance summaries from submitted detail; do not persist duplicate
aggregates unless an approved performance need arises.

**Required API operations:** retrieve meetings/marks for authorized class
scope; create/update an open meeting; submit/reopen under explicit
authorization; validate roster membership, mark, time ranges and duplicate
rows; and provide student/department summaries from the same submitted
records.

**Classification:** Requires backend implementation and database
persistence.

### Assessments and scores

**Current flow/source:** `staff.js` stores assessment definitions in
`db.fac.assessments` with ID, class ID, period, name, type, date, max score
and weight; scores are in `db.fac.scores[assessmentId][studentNumber]`.
Weighted percentage/equivalent calculations are client-side. Current active
period is `Final`.

**Authoritative source today:** none outside local browser state; this is the
only detailed assessment/score workflow.

**Required links:** `assessments` references a course section and an approved
grading period/configuration. `assessment_scores` references an assessment
and class-enrollment/student-membership record, with a unique pair. Validate
score bounds, total weights, and edits according to sheet status. Do not
store both score-derived period percentages and final values as competing
authorities unless policy requires snapshots.

**Required API operations:** list/create/edit assessments for an editable
sheet, save scores, calculate or return validated results, and prevent edits
after submit/approval/post except through an explicit correction flow.

**Classification:** Requires backend implementation and database
persistence.

### Grade-sheet review and posting

**Current flow/source:** faculty status and notes are in
`db.fac.gradeStatus`/`db.fac.gradeNotes`, keyed by `classId|Final`.
Department Head actions set `Approved` or `Returned`; Registrar reads sheets
from `SIMSStaff.gradeSheets()` and sets `Posted`/`Returned`. This is separate
from the Registrar's other student grade-queue actions against `SIMSData`.

**Authoritative source today:** staff grade-sheet state is authoritative only
for its client-side review flow. The student grade queue is a separate
source; the code does not atomically publish scores to it.

**Required links:** model a grade sheet for section + period/term, associated
assessments/scores and workflow status. Record submission/review/post actions
with server-derived actor and timestamps; preserve return notes. Define
whether review history is retained or only current state is kept. The posting
operation must transactionally validate a complete sheet and create/update
the official student results.

**Required API operations:** submit; recall when permitted; approve/return
with remarks; post; fetch queue/status and returned notes; and reject
out-of-order or duplicate transitions. Enforce authorization by role and
assignment, not hidden buttons.

**Classification:** Requires backend implementation and database
persistence.

### Student-visible official grades

**Current flow/source:** `data.js` holds student subjects, term IDs, numeric
final grade or `INC`, outcome status and release status in
`bits-sims-academic`. `script.js` shows only posted grades. `registrar.js`
can separately update that grade queue, while posting a faculty sheet through
the staff path changes only `db.fac.gradeStatus`.

**Authoritative source today:** `data.js` is the display source for the demo;
it is not connected to staff-entered scores or the Registrar staff-sheet
posting action.

**Required links:** official `student_grades` (or approved equivalent) must
reference a `class_enrollments`/student-section record and the posted
grade-sheet result. Include the term/section relationship through canonical
FKs. Represent grade workflow state separately from academic outcome and
support `INC` without requiring a numeric value. Derive term/cumulative GWA,
units and standing unless snapshot retention is approved.

**Required API operations:** list a student's visible grades, term summary
and allowed release state; atomically publish after Registrar posting; and
apply corrections through an approved, audited correction path.

**Classification:** Requires backend implementation and database
persistence.

## GAP 3: Approved `persons` model is not implemented

### Where person data currently exists

| Current object/source | Identity/contact fields and overlap |
|---|---|
| `accounts.js` | Demo account `name`, login `email`, `username`, plaintext demo `password`, `role`; staff entries also include `title`, `dept`, `employeeNo`, `hired`, `contact`; the Student entry includes `studentNumber`. |
| `staff.js` `db.users` | Staff-side account rows duplicate `name`, `username`, `email`, `role`; account form edits these, plus account status/security flags. Seed account list includes employee-like created dates but the account editor does not model a proper employment profile. |
| `registry.js` students | Student `no`, display `name`, program, year, status, department, admission type, email, mobile and city; additional Registrar-created records add DOB, guardian/emergency names and numbers. |
| `script.js` student profile (`bits-sims-profile`) | First/last name, email, personal email, phone, city, country, address, avatar, timezone, email visibility and notifications. Some overlap with account and registry email/phone/name. |
| `script.js` admission/enrollment | Application has little independent applicant identity; enrollment wizard collects first/middle/last name, DOB, mobile and address into its own local object. |
| Registrar registration | Creates a registry student with a constructed display name plus email/mobile/city/DOB and postponed guardian/emergency fields. It is not linked to the account/profile object by person ID. |

**Classification:** Current people and account data are duplicated, fragmented
and stored without stable shared identity links.

### Future identity relationships and fields

| Entity | Future responsibility and likely fields | Classification |
|---|---|---|
| `persons` | Canonical real-person identity/contact: stable `person_id`, approved name components, date of birth if retained, personal email, phone/mobile, and approved address/location fields. Avatar ownership must be decided; store an asset reference, not image bytes. Avoid copying personal contact fields into every profile. | Requires database persistence |
| `users` | Login/account: stable `user_id`, required unique `person_id`, username, login email if distinct from personal email, server password hash, account status/security lifecycle, and required `role_id`. No personal-name/contact duplication except fields with separately approved account purpose. | Requires database persistence |
| `students` | Academic profile: stable `student_id`, required unique `person_id`, unique student number, program/department references, year level, admission type and student status. Student-specific academic email belongs here only if distinct and its meaning is approved. | Requires database persistence |
| `staff` | Employment/profile: stable `staff_id`, required unique `person_id`, employee number, department, position/title, hire date and employment status. Work email/phone belong here only if distinct from person contact/login data. | Requires database persistence |
| `roles` | Stable role key/code and display metadata for the six single-role assignments. | Requires database persistence |
| `permissions`, `role_permissions` | Stable permission codes and role-to-permission relation, to be enforced by server policy. | Requires database persistence |
| `user_preferences` | Optional per-account preferences (timezone, email visibility, notification choices) only if they must persist across devices; keep distinct from canonical person data. Exact owner and retained fields need approval. | Unclear and requiring team review |
| `guardians`, `emergency_contacts` | No V1 fields/table: preserve for later phase only. If reopened, decide reusable-person and student-contact association, relationship type and purposes. | Planned but not implemented |

The one-account-per-person constraint means `users.person_id` should be unique.
`students.person_id` and `staff.person_id` should each uniquely identify a
profile row. Whether the same person may have both a student and a staff
profile remains an institutional rule to confirm; it is not answered by the
one-role-per-user decision.

### Frontend changes and sequencing

**Before the API exists:** do not retrofit partial `personId` values into the
existing sample stores and imply they are authoritative. If a narrow prototype
demonstration needs correlation, use an explicit stable demo-only ID in
fixtures and adapters, without changing production meaning or persisting
guardian/emergency data as V1 entities. Prefer waiting for the approved
identity service and record-mapping rules.

**After backend support exists:**

1. Add API adapters for current account, student registry and staff data
   instead of letting pages read each other's localStorage keys directly.
2. Resolve a signed-in user to `user_id`, `person_id`, `role_id` and allowed
   profile IDs in a server-provided session context. Remove client-supplied
   actor identity as authority.
3. Render common names/contact from the person resource; keep student number
   and academic status in student resources; keep employee number/title/
   department in staff resources; keep credentials/status/role in the user
   resource.
4. Send profile corrections as requests against the appropriate person
   fields; after approval, refresh the canonical person resource and
   dependent profiles.
5. Map current role-code strings and student number login alias at the API
   boundary. Retain the student-number login alias only if policy approves
   it; it must resolve to the one linked user, not become a second account.
6. Define account creation/activation flows for new Registrar-created
   students and staff before enabling live account provisioning. A student
   record need not automatically imply a login unless approved.
7. Retire duplicated localStorage identity writes after migration/sync is
   tested. During a transition, define which source wins and how failed API
   writes are shown; do not silently fall back to stale local data.

**Required backend work:** person/account/profile endpoints, uniqueness and
authorization rules, identity resolution, account provisioning, canonical
contact ownership, and transactional conversion/update behavior.

**Required database work:** `persons`, `users`, `students`, `staff`, `roles`,
`permissions`, and `role_permissions`, with the person/user/profile/role
foreign keys and uniqueness constraints described above. Preferences are
conditional; guardian/emergency entities remain postponed.

## Recommended resolution order

The order below minimizes disruption: stabilize the prototype boundary, then
build server identity and domain relationships, then migrate UI flows one at a
time. It is a dependency order, not approval to implement or execute SQL.

### A. Temporary browser-prototype fixes

1. Keep demo credentials clearly marked and never use them as production seed
   data. Do not use prototype password hashes or browser-side auth for real
   accounts.
2. If account creation must work in the demo before a backend exists, unify
   account lookup/create/edit/reset behind one browser-only account registry;
   add tests for create -> authenticate -> edit -> reset/lock. Otherwise,
   disable or label account creation as mock and defer it.
3. Do not separately patch each login path or add a mutable copy of users to
   `ACCOUNTS`; that preserves the source-of-truth bug.
4. Do not add synthetic person IDs to real-looking data until a deterministic
   fixture mapping is documented. Avoid destructive store-version resets
   during transition.
5. Clearly label enrollment, roster, grade and attendance as disconnected
   sample flows until adapters exist; do not claim a student selection,
   posted sheet or faculty mark is shared across portals.

### B. Required backend/API work

1. Define the authenticated session and authoritative user/role/permission
   model. Implement user provisioning, secure authentication, reset, lockout,
   activation and server-side authorization.
2. Implement person resolution plus student/staff profiles and approved
   account lifecycle. Establish student-number mapping without making it the
   relational primary key.
3. Implement catalog, term, section and term-enrollment APIs, then applicant
   conversion and class-enrollment/roster APIs with transactional eligibility,
   uniqueness and capacity checks.
4. Implement faculty meeting/attendance APIs and assessment/score APIs.
5. Implement grade-sheet submit/review/return/approve/post as one server
   workflow that publishes the official grade consumed by the student view.
6. Implement document metadata/private file service, profile corrections and
   server-generated audit events as their scope and security rules are
   approved.
7. Provide consistent validation errors, transition conflicts, loading and
   failure reporting; never present local success when server persistence
   fails.

### C. Required database tables and relationships

1. Identity/access foundation: `persons`; `users.person_id -> persons` with
   uniqueness; `users.role_id -> roles`; `students.person_id -> persons` and
   `staff.person_id -> persons` with one profile per person of each type;
   `role_permissions` links `roles` and `permissions`. No V1 `user_roles`.
2. Academic foundation: `departments`, `programs`, `academic_terms`,
   `courses`, `rooms`, and `course_sections`/offerings with approved FKs for
   department, program, course, term, room and staff assignment.
3. Admission and enrollment: `admission_applications.person_id -> persons`,
   optional converted `student_id -> students`; `student_term_enrollments`
   link student and term (and application if approved); `class_enrollments`
   link student and section, with a term-enrollment link only if its policy is
   approved.
4. Attendance: meeting -> section and recorder user; attendance record ->
   meeting and class-enrollment row, unique per meeting/enrolled student.
5. Grades: assessments -> section/period; assessment scores -> assessment
   and class enrollment; grade sheet -> section/period with review state;
   official student grade -> class enrollment and posted sheet/result.
6. Supporting V1 persistence if retained: `student_documents`,
   `student_document_requests`, `profile_correction_requests`, and
   `audit_logs`; document bytes reside in protected file storage, not ordinary
   relational columns.
7. Conditional tables: password reset/lockout state if retained server-side;
   `user_preferences` only if cross-device preference persistence is
   required. Exact table/field set remains subject to team and security
   approval. Do not copy all tables from the 48-table draft without mapping.

### D. Required frontend changes after the backend exists

1. Replace localStorage reads/writes by domain-specific authenticated API
   calls, preserving the existing portals while consolidating shared data.
2. Use server-returned internal IDs for joins and continue showing business
   identifiers such as student number/course code in the UI.
3. Make the roster a query of class-enrollment records; make Registrar
   enrollment and student selections create/update the same canonical term
   and class-enrollment records.
4. Make attendance and academic pages consume the same submitted meeting
   records and official posted-grade resources used by staff and Registrar.
5. Map persisted status codes to labels; disable or explain actions based on
   server authorization and transition responses, not as the only enforcement.
6. Remove production login credentials and the demo reset inbox; implement
   real activation/reset interactions and private file upload/download.
7. Add integration tests for person/user/student/staff linkage, account
   provisioning/login, application conversion, duplicate/capacity limits,
   roster membership, attendance submission, grade review/posting and student
   visibility.

### E. Features that should remain postponed

- `guardians` and `emergency_contacts`, including their current Registrar
  fields as persistent V1 data; keep this future-phase requirement documented.
- Multi-role assignments and V1 `user_roles`; revisit only if requirements
  change.
- MFA challenges/devices, notification delivery, backup execution/history,
  real system monitoring, report archives, and operational event metrics until
  their services, security requirements and retention rules are approved.
- Multiple instructors/schedule rows/history, broader year levels or
  modalities, and Midterm grading unless the current product scope is
  explicitly revised.
- Duplicate stored GWA/unit/attendance aggregates and grade snapshots unless
  an approved audit/reporting or performance need requires them.

## Decision gates before implementation or migration

1. Confirm the V1 role/permission catalog and the relationship between
   hardcoded `CAPS` and the editable permission matrix.
2. Approve login identifier rules, account activation/provisioning, uniqueness
   of login email versus personal/work email, and whether a person can hold
   both student and staff profiles.
3. Confirm applicant conversion, student-number generation, enrollment
   eligibility, term dates, unit/capacity rules and class-selection policy.
4. Approve the authoritative grade calculation/scale, `INC` behavior,
   transitions and grade correction process; reconcile staff scores with
   student results.
5. Approve attendance status semantics and reopening/audit behavior.
6. Confirm data retention/privacy for identity, corrections, attendance,
   grades, documents and audit; confirm which conditional security/settings
   features are Version 1.

Do not generate final migration SQL until these decisions, table ownership,
field nullability, keys, status codes, delete behavior and backend operations
have been reviewed and approved.

## Source files reviewed

### Current application

- `accounts.js`, `auth.js`, `staff.js`
- `registry.js`, `data.js`, `registrar.js`, `script.js`
- `index.html`, `demo-tools.html`
- `style.css`, `reports.css`, `registrar.css`, `staff.css`

### Planning and schema references

- `database/design/current-code-reassessment.md`
- `database/design/decision-01-identity-ownership.md`
- `database/design/v1-implementation-alignment.md`
- `database/design/v1-scope-reconciliation-v2.md`
- `database/design/BITS-SIMS_Database_Design.md`
- `database.schema.sql` (unapproved draft only)
- `database/migrations/001_initial_schema.sql` (placeholder only)

The approved identity decision is treated as V1 policy. The 48-table design
and root SQL are treated as unapproved proposals, not implementation truth.
The comprehensive PDF is not used for this task.

## Completion and safety summary

- Gaps 1, 2 and 3 analyzed: **Yes**.
- Recommended resolution order: prototype boundary/account source, backend
  identity/auth, shared domain relationships and workflow APIs, database
  design, then incremental frontend integration/tests.
- Likely tables/relationships: identity and role tables; catalog, terms,
  sections; applications, separate term/class enrollments; attendance
  meetings/records; assessments/scores; grade sheets/official grades; and
  supporting document/correction/audit tables if retained.
- Backend/API work: server-authoritative authentication, one-role
  authorization, person/profile/account resolution, transactional admissions
  and enrollment, roster, attendance, grading/posting, document and audit
  services.
- Temporary prototype fixes: optional shared demo account registry; safest
  default is to label/defer account provisioning rather than imply security.
- Postponed features: guardians/emergency contacts, multi-role assignments,
  and unapproved operational/security/reporting services listed above.
- Application files changed: **No**.
- Existing SQL files changed: **No**.
- SQL generated or executed: **No**.
- Hostinger database modified: **No**.
