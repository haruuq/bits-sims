# Backend Identity and API Contract

**Review date:** November 10, 2026  
**Status:** Proposed architecture and API contract for team review. This is
not implementation approval, schema approval, or migration SQL.

## 1. Scope and decisions already approved

This contract addresses the current browser-only application and the three
known gaps: disconnected staff account creation/login, disconnected enrollment
and academic workflows, and the missing shared `persons` model.

The following Version 1 identity decisions are treated as approved:

- `persons` is the shared real-person identity/contact record.
- `users`, `students`, and `staff` each link to `persons`.
- A person has at most one user account in V1.
- A user has exactly one role in V1, stored through `users.role_id`.
- Do not use a V1 `user_roles` junction table.
- Guardians and emergency contacts are postponed and remain documented for a
  later phase.

Other technology, business rules, field ownership details, enrollment policy,
grading policy, status codes, and deployment assumptions in this document
remain proposals requiring review.

### Classification key

Every proposed table and endpoint is labeled with one or more classifications:

- **Required for Version 1**
- **Required for backend foundation**
- **Needed by current frontend functionality**
- **Recommended but not yet implemented**
- **Temporary prototype support**
- **Postponed**

## 2. Recommended backend architecture

Use a **same-origin, versioned JSON REST API** backed by a **modular
monolith**. Keep the existing browser frontend as a separate presentation
layer. The backend owns authentication, authorization, validation, workflow
transitions, transactions and persistence; domain modules share one service
and relational database rather than communicating through browser storage.

Suggested modules:

1. Authentication and sessions
2. Identity, accounts, roles and permissions
3. Student records and admissions
4. Academic catalog, terms, sections and enrollment
5. Attendance
6. Assessments, grade sheets and official results
7. Documents and profile corrections
8. Audit and approved system settings

Use explicit request/response DTOs rather than exposing database rows. Keep
database access behind repositories/services, use parameterized SQL, and put
multi-record operations (account provisioning, applicant conversion,
enrollment confirmation and grade posting) in database transactions.

**Classification:** Required for backend foundation.

## 3. Recommended backend technology

**Provisional recommendation:** Node.js LTS with Express and JavaScript for
the initial backend, a MySQL/MariaDB-compatible driver such as `mysql2`,
request validation schemas, and a migration tool selected during
implementation planning.

Rationale:

- The current application is plain JavaScript with no frontend build system;
  using JavaScript on the server minimizes context switching and allows
  gradual API integration.
- The existing draft schema targets MySQL/MariaDB, so the server should use a
  compatible relational database driver rather than client-side SQL access.
- Express supports the proposed small REST API and modular-monolith boundary
  without requiring a frontend rewrite.

This is **not an approved technology choice**. The repository has no
`package.json`, backend service, or Node deployment configuration. Confirm
Node runtime support, process management, TLS, environment-secret handling,
and network access to the intended MariaDB instance on the actual Hostinger
plan before implementation. If that hosting plan does not support a secure
Node service, choose a supported server-side runtime (for example, PHP with
PDO) before building; do not expose database credentials or connect to
MariaDB directly from browser JavaScript.

**Classification:** Required for backend foundation; technology choice
requires team/hosting approval.

## 4. Authoritative sources

| Concern | Future authority | Current state |
|---|---|---|
| Account records | Backend `users` table and account service | `accounts.js` has six fixed demo accounts; `staff.js` separately stores a local account list. |
| Authentication | Backend authentication service and server-managed session | `auth.js` and `staff.js` authenticate in the browser against hardcoded account snapshots. |
| Roles | `roles` table; one `users.role_id` per account | Current code keeps role strings in demo/account objects. |
| Permissions | `permissions` and `role_permissions`, enforced on the server | `staff.js` has hardcoded `CAPS` plus a separately editable local permission matrix. |
| Person identity/contact | `persons` | Profile, accounts, registry and application wizard duplicate partial identity values. |
| Student record | `students` | `registry.js` uses student number and profile fields in localStorage. |
| Staff record | `staff` | Employee metadata is mixed into demo accounts; no canonical staff profile exists. |
| Enrollment, attendance and grades | Relational records defined below, read/written through APIs | Browser-local data is fragmented; there is no authoritative cross-portal record. |

No client localStorage value, role label, actor ID, status transition, or
permission list is authoritative after backend integration.

## 5. Identity and account relationship contract

### Persons and users

- `persons.person_id` is the stable internal identifier for one real person.
- `users.user_id` is the stable login/account identifier.
- `users.person_id` is required and unique in V1, enforcing no more than one
  user account per person.
- `users.role_id` is required and references `roles.role_id`; exactly one
  role per user. Do not create `user_roles`.
- A person need not have an account. Account invitation/provisioning is an
  explicit operation, not an automatic side effect of creating a person.
- Username is the only Version 1 login identifier. Normalize it by trimming
  surrounding whitespace and converting to lowercase during account creation
  and before login lookup. Accept only lowercase ASCII letters `a-z`, digits
  `0-9`, underscore, period, and hyphen after normalization; reject spaces,
  accented letters, and other characters. Username uniqueness and lookup are
  case-insensitive. Validate the same rule on every account-creation and
  username-change path.
- `persons.personal_email` is optional contact information, not a login
  identifier; email-based login and email aliases are postponed. Password
  verification remains a separate operation and must not be changed by
  username normalization.

### Persons and students

- `students.student_id` is an internal profile key and
  `students.person_id` is a required unique FK to `persons.person_id`.
- `student_number` is a unique human-facing/business identifier, not the
  cross-table FK or database primary key.
- Program, department, year level, admission type and student lifecycle
  status belong to `students` or linked academic records, not `persons`.
- An application and a student profile may reference the same person; whether
  a person can have both student and staff profiles remains a policy
  question.

### Persons and staff

- `staff.staff_id` is an internal profile key and
  `staff.person_id` is a required unique FK to `persons.person_id`.
- Employee number, department, position/title, hire date and employment
  status belong to `staff`.
- Work email/phone belong to `staff` only if they are distinct from
  person-owned contact and account login values.
- A section's faculty assignment references `staff.staff_id`, not username
  or a role code.

### Field ownership

| Entity | Proposed fields | Classification |
|---|---|---|
| `persons` | `person_id`, first/middle/last name in approved representation, personal email, mobile/phone, approved address/location fields; DOB only if retained and approved; avatar asset reference only if ownership/storage policy is approved. | Required for Version 1 |
| `users` | `user_id`, unique `person_id`, `role_id`, unique username as the only V1 login identifier, password hash, account status, failed-login/lockout fields if retained, last-login and must-change fields if retained, timestamps. Never store plaintext password/reset code. | Required for Version 1 |
| `students` | `student_id`, unique `person_id`, student number, program/department references, year level, admission type and student status. Separate institutional email only if approved as distinct. | Required for Version 1 |
| `staff` | `staff_id`, unique `person_id`, employee number, department, position/title, hire date, employment status; distinct work contact only if approved. | Required for Version 1 |
| `roles` | `role_id`, stable unique role code and display name for current six roles. | Required for Version 1 |
| `permissions` | Stable permission code, description/module/action metadata after permission catalog approval. | Required for backend foundation |
| `role_permissions` | Unique role-permission pair; no account-level role junction. | Required for backend foundation |
| `user_preferences` | Timezone, email visibility and notification preferences only if cross-device persistence is approved. Not a substitute for person contact data. | Recommended but not yet implemented |
| Guardian/emergency-contact data | No V1 table or persistent V1 fields. Current form fields remain documented for later resolution. | Postponed |

Do not duplicate canonical names and personal contact data in `users`,
`students`, `staff` or applications. If an immutable submitted-name/contact
snapshot is legally or operationally required, approve its purpose and
retention before adding it.

## 6. Role and permission model

Seed/maintain stable role codes: `ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`,
`FACULTY`, `REGISTRAR`, and `STUDENT`. `users.role_id` assigns one role.
Presentation labels are not keys.

`permissions` plus `role_permissions` represent the approved permission
catalog. Before implementation, reconcile the local `CAPS` and editable
permission-code matrix into one authoritative permission matrix. Backend
middleware/service checks must enforce each action and resource scope:

- Faculty may access only assigned sections and their roster/grades/attendance.
- Department Head access must be scoped to approved department(s).
- Registrar permissions are limited to Registrar workflows.
- EdTech and ICT Services permissions must be explicitly separated.
- Students may access only their own person, student, enrollment, attendance,
  documents and posted grades.

Never trust a role, permission list, user ID, student ID, staff ID, or actor
supplied by the browser. Resolve caller and scope from the authenticated
server session, then authorize every operation on the server.

**Classification:** Required for backend foundation; final permission codes
and scope policy require review.

## 7. Authentication and session flow

1. `POST /api/v1/auth/login` receives `username` and password over TLS.
2. The service trims the username, normalizes it to lowercase, rejects
   characters outside `a-z`, `0-9`, `_`, `.`, and `-`, then looks up the
   unique `users.username` case-insensitively. Account creation, username
   changes, and login lookup apply the same trim/normalization/validation
   rules. Do not accept email or student-number aliases in Version 1. Password
   verification is separate and unchanged by username normalization; verify
   a modern server-side password hash (Argon2id preferred; bcrypt acceptable
   if selected/configured correctly).
3. Failed attempts are counted server-side with throttling and a temporary
   lock policy. Use a generic response that does not reveal whether an
   account exists; record the detailed reason only in protected server logs.
4. On success, rotate/create a server-managed session. Set an opaque session
   cookie `HttpOnly`, `Secure`, and an approved `SameSite` value; do not put
   bearer tokens or passwords in localStorage. Return a sanitized user
   context including role and permissions needed for display, not as the
   authorization source.
5. The frontend calls `/auth/me` to restore portal context after reload. The
   backend rechecks session validity, account status and role.
6. Logout invalidates the server session and expires the cookie.
7. Forgot/reset flows accept a username and return the same outward response
   whether or not an account exists. Generate a high-entropy one-time secret, store only a
   hash with expiry/attempt/consumed state, send through an approved delivery
   service, rate-limit requests, and never display the secret in a demo inbox
   in production.

**Classification:** Required for backend foundation.

## 8. Staff account creation flow (GAP 1)

### Existing disconnection

- `staff.js` account UI creates/edits records under
  `bits-sims-staff-users`.
- `accounts.js` defines the fixed `SIMSAccounts` array used by login.
- `staff.js` takes an authentication snapshot from that array and does not
  search the account editor's created rows for credentials. New account rows
  therefore do not become login identities.
- The account form has no secure credential setup or invitation flow.

### Proposed flow

1. Authorized administrator submits `POST /api/v1/staff-accounts` with
   person details, staff employment details, account identifiers and one
   role code.
2. Backend validates permission, uniqueness and allowed staff role; creates
   or selects a `persons` record and transactionally creates `staff` and
   `users` linked to it. `users.role_id` references the selected role; do not
   create `user_roles`.
3. Create the account as `pending_activation` (or approved equivalent) and
   create/send an activation invitation through the configured service.
   Never accept or log an administrator-supplied plaintext default password.
4. Staff member activates and sets their password through a one-time
   expiring link/code. Only a secure password hash is stored.
5. The same backend `users` row is used for login, staff account listing,
   password reset, lockout, suspension and role authorization.
6. Updates change the one authoritative record. Role change, suspension and
   unlock actions require backend permission and are audited.

Automatic account provisioning, invitations, and whether Registrar-created
students receive accounts need explicit policy decisions.

**Classification:** Required for Version 1 if staff account management/login
is in scope.

## 9. Password, failed-login and account-locking flow

- Persist only a modern password hash with per-password salt and configured
  work factor. Do not use the custom JavaScript hash in `auth.js` or
  `staff.js` for real accounts.
- Validate password policy server-side. Do not return or log passwords,
  reset secrets, session IDs, or credential hashes.
- Track failed attempts and lock expiry server-side. Use a defined
  progressive/rate-limited strategy and account/IP throttling; clear/reset
  counters only according to approved policy.
- Avoid permanent lockout and account enumeration; use generic login/reset
  responses and a safe support/restore process.
- Suspended/inactive accounts remain distinct from temporary lockout.
- Keep reset/activation secrets hashed, single-use, short-lived, attempt
  limited and rate limited. Send them only through an approved delivery
  channel.
- Store session state server-side or use an approved secure session store;
  use CSRF protection for cookie-authenticated state-changing requests.

**Classification:** Required for backend foundation. Exact thresholds,
session lifetime, MFA requirement and delivery channel require approval.

## 10. API conventions and identifiers

- Prefix: `/api/v1`.
- JSON request/response bodies, UTF-8, ISO-8601 UTC timestamps, ISO dates,
  stable lowercase status codes and consistent error envelopes.
- IDs: opaque-to-client internal IDs (integer or UUID choice pending review)
  are used for foreign-key relationships. Business identifiers remain unique
  labels/lookups: `student_number`, `application_number`, `enrollment_ref`,
  course code and section code.
- Never use display names, usernames, array positions, dates concatenated
  with labels, or localStorage keys as foreign keys.
- Success uses resource JSON or `204 No Content`; errors use
  `{ "error": { "code": "...", "message": "...", "fields": {} } }`.
- Paginate list endpoints; apply server-side filtering and authorized scope.
- For state-changing operations, require expected version/ETag or an
  equivalent concurrency check where simultaneous updates are possible.

### Canonical relationship chain

```text
persons
  ├─ users (unique person_id, exactly one role_id -> roles)
  ├─ students (unique person_id, unique student_number)
  │    ├─ admission_applications (applicant person; optional converted student)
  │    ├─ student_term_enrollments (student + academic_term)
  │    └─ class_enrollments (student + course_section)
  │          ├─ attendance_records -> attendance_meetings -> course_sections
  │          ├─ assessment_scores -> assessments -> course_sections
  │          └─ student_grades -> grade_sheets -> course_sections/term
  └─ staff (unique person_id, employee_number)
       ├─ course_sections (assigned staff)
       └─ attendance/grade workflow actor references -> users
```

Attendance and grades should reference class membership, not duplicate a
student number as the relational link. Validate that the membership,
section, term and caller scope agree within each transaction.

## 11. API endpoint contract

Endpoint classifications:

- Auth/session endpoints: **Required for backend foundation**.
- Core identity, student, catalog, enrollment, attendance and grades:
  **Required for Version 1** and **Needed by current frontend functionality**
  if these portals remain in scope.
- Optional preference endpoints: **Recommended but not yet implemented**.
- Demo-only endpoints are explicitly **Temporary prototype support** and
  must not be exposed in production.

All authenticated endpoints use the server session cookie. Every request is
authorized server-side. IDs shown below are illustrative opaque IDs; final
format is a team decision. All responses omit password hashes and private
session/reset values.

### 11.1 Authentication endpoints

| Method and path | Classification | Request fields | Success response |
|---|---|---|---|
| `POST /auth/login` | Required for backend foundation | `{ username: string, password: string }`; trim, lowercase, and validate allowed characters before case-insensitive lookup. Password verification is separate. | `200 { user: { userId, personId, role: { code, name }, profile: { studentId?, staffId? }, permissions: string[] } }`; server sets session cookie. No email or student-number aliases in Version 1. |
| `GET /auth/me` | Required for backend foundation | No body; session cookie. | `200 { user: { userId, personId, role, profile, permissions } }`. |
| `POST /auth/logout` | Required for backend foundation | No body; session cookie and CSRF protection. | `204`; session invalidated and cookie expired. |
| `POST /auth/password/change` | Required for backend foundation | `{ currentPassword, newPassword }`. | `204`; rotate/revoke sessions according to approved policy. |
| `POST /auth/password-reset-requests` | Required for backend foundation | `{ username: string }`; trim and lowercase before lookup. | `202 { message: genericMessage }`, regardless of account existence. |
| `POST /auth/password-resets` | Required for backend foundation | `{ token: string, newPassword: string }`. | `204`; one-time token consumed; approved lockout state reset. |
| `POST /auth/activation` | Required for backend foundation | `{ token: string, newPassword: string }`. | `204`; pending account activated under policy. |

### 11.2 Staff account management endpoints

| Method and path | Classification | Request fields | Success response |
|---|---|---|---|
| `GET /staff-accounts` | Required for Version 1; Needed by current frontend functionality | Query: `q?`, `roleCode?`, `status?`, `cursor?`, `limit?`. | `200 { items: [{ userId, personId, staffId, username, roleCode, accountStatus, displayName, employeeNumber, departmentId, positionTitle, lastLoginAt }], nextCursor }`; scope/personal fields limited by permission. |
| `POST /staff-accounts` | Required for Version 1; closes current login gap | `{ person: { firstName, middleName?, lastName, personalEmail?, phone?, address? }, staff: { employeeNumber?, departmentId?, positionTitle?, dateHired? }, account: { username, roleCode } }`. Trim, lowercase, and validate username against `^[a-z0-9_.-]+$`; reject unsupported characters. No plaintext initial password. | `201 { userId, personId, staffId, username, roleCode, accountStatus: "pending_activation", invitationStatus }`. Creates/links person, staff and user in one transaction. |
| `GET /staff-accounts/{userId}` | Required for Version 1 | No body. | `200 { userId, person, staff, account: { username, roleCode, accountStatus, securitySummary } }`; omit secrets. |
| `PATCH /staff-accounts/{userId}` | Required for Version 1 | Allowed changes only: `{ username?, roleCode?, accountStatus?, person?: { ...approved editable fields }, staff?: { ...approved employment fields }, version }`. Trim, lowercase, and validate any new username against `^[a-z0-9_.-]+$`; enforce case-insensitive uniqueness. | `200 { userId, personId, staffId, roleCode, accountStatus, version }`. Enforce self-change and privilege rules. |
| `POST /staff-accounts/{userId}/activation-resends` | Required for backend foundation | No body. | `202 { message: genericMessage }`. |
| `POST /staff-accounts/{userId}/unlock` | Required for Version 1 if account support is retained | `{ reason? }`. | `200 { userId, accountStatus, lockedUntil: null }`. |
| `POST /staff-accounts/{userId}/suspension` | Required for Version 1 if account support is retained | `{ suspended: boolean, reason }`. | `200 { userId, accountStatus, version }`; revoke active sessions when required. |

### 11.3 Person, student and staff record endpoints

| Method and path | Classification | Request fields | Success response |
|---|---|---|---|
| `GET /persons/me` | Required for Version 1 | Session only. | `200 { personId, firstName, middleName, lastName, personalEmail, phone, address, city, country, dateOfBirth? }`; expose only approved fields. |
| `PATCH /persons/me` | Required for Version 1 | `{ firstName?, middleName?, lastName?, personalEmail?, phone?, address?, city?, country?, version }`; protected official-name changes may require correction workflow rather than direct patch. | `200 { personId, ...approved fields, version }`. |
| `GET /students` | Required for Version 1; Needed by current frontend functionality | Query: `q?`, `departmentId?`, `programId?`, `yearLevel?`, `status?`, `cursor?`, `limit?`. | `200 { items: [{ studentId, personId, studentNumber, displayName, program, department, yearLevel, admissionType, status }], nextCursor }`. |
| `POST /students` | Required for Version 1 if Registrar direct registration remains | `{ person: { firstName, middleName?, lastName, dateOfBirth?, personalEmail?, phone?, address?, city?, country? }, student: { studentNumber?, programId, departmentId, yearLevel, admissionType, status? }, createAccount?: { username, roleCode: "STUDENT" } }`. If creating an account, trim, lowercase, and validate username against `^[a-z0-9_.-]+$`; enforce case-insensitive uniqueness. Account creation is a separate optional policy action. | `201 { personId, studentId, studentNumber, status, userId? }`. Transactional; no guardian/emergency fields. |
| `GET /students/{studentId}` | Required for Version 1 | No body. | `200 { studentId, personId, studentNumber, person, program, department, yearLevel, admissionType, status }`, access-scoped. |
| `PATCH /students/{studentId}` | Required for Version 1 | `{ programId?, departmentId?, yearLevel?, status?, version }`; identity changes use person/correction endpoints. | `200 { studentId, ...updated academic fields, version }`. |
| `GET /staff/{staffId}` | Required for Version 1 | No body. | `200 { staffId, personId, person: { displayName, approved contact }, employeeNumber, department, positionTitle, employmentStatus }`. |

### 11.4 Admissions and enrollment endpoints

| Method and path | Classification | Request fields | Success response |
|---|---|---|---|
| `GET /academic-terms` | Required for Version 1 | Query: `status?`, `current?`. | `200 { items: [{ termId, academicYear, semester, startDate?, endDate?, status, isCurrent }] }`. |
| `GET /course-sections` | Required for Version 1; Needed by current frontend functionality | Query: `termId`, `programId?`, `yearLevel?`, `availability?`, `cursor?`, `limit?`. | `200 { items: [{ sectionId, courseId, courseCode, courseTitle, sectionCode, termId, units, schedule, room, facultyDisplayName, capacity, enrolledCount, status }], nextCursor }`. |
| `POST /admission-applications` | Required for Version 1 if admissions remains in scope | `{ programId, termId, admissionType, confirmation }`; applicant person comes from session. | `201 { applicationId, applicationNumber, personId, status, submittedAt }`. |
| `GET /admission-applications` | Required for Version 1 | Query: `status?`, `programId?`, `cursor?`, `limit?`; authorized Registrar scope. | `200 { items: [{ applicationId, applicationNumber, personId, displayName, programId, termId, admissionType, status, submittedAt, decisionAt }], nextCursor }`. |
| `GET /admission-applications/{applicationId}` | Required for Version 1 | No body. | `200 { applicationId, personId, studentId?, programId, termId, admissionType, status, submittedAt, verifiedAt?, decisionAt?, remarks?, version }`. |
| `POST /admission-applications/{applicationId}/decisions` | Required for Version 1 | `{ decision: "review" \| "accepted" \| "rejected", remarks? , version }`. | `200 { applicationId, status, decidedByUserId, decidedAt, version }`; actor is derived from session. |
| `POST /admission-applications/{applicationId}/conversion` | Required for Version 1 if accepted-applicant conversion remains | `{ student: { programId, departmentId, yearLevel?, admissionType? }, studentNumber? }`; no person ID supplied by client. | `201 { applicationId, personId, studentId, studentNumber, termEnrollmentId }`. Idempotent; same person; one transaction. |
| `POST /students/{studentId}/term-enrollments` | Required for Version 1 | `{ termId, applicationId?, selectedSectionIds: [] }`; eligibility and selection checks are server-side. | `201 { termEnrollmentId, enrollmentReference, studentId, termId, status, classEnrollments: [{ classEnrollmentId, sectionId, status }], units }`. |
| `GET /students/{studentId}/term-enrollments` | Required for Version 1 | Query: `termId?`, `status?`. | `200 { items: [{ termEnrollmentId, enrollmentReference, termId, status, units, classEnrollments }] }`. |
| `POST /term-enrollments/{termEnrollmentId}/verification` | Required for Version 1 | `{ decision: "verified" \| "rejected", remarks?, version }`; Registrar permission. | `200 { termEnrollmentId, status, reviewedByUserId, reviewedAt, version }`. |
| `GET /course-sections/{sectionId}/roster` | Required for Version 1; Needed by current frontend functionality | Query: `status?`, `cursor?`, `limit?`; authorization checks faculty assignment or department scope. | `200 { sectionId, items: [{ classEnrollmentId, studentId, studentNumber, displayName, program, status }], nextCursor }`. |
| `POST /students/{studentId}/class-enrollments` | Required for Version 1 | `{ sectionId, termEnrollmentId? }`. | `201 { classEnrollmentId, studentId, sectionId, termId, status, units }`; transaction checks duplicate, capacity, term and enrollment eligibility. |
| `DELETE /class-enrollments/{classEnrollmentId}` | Required for Version 1 if drop/withdraw remains | `{ reason?, version }` or approved action endpoint with body. | `200 { classEnrollmentId, status, endedAt }`; preserve history rather than delete record. |

The exact meaning and approver sequence for Registrar term enrollment versus
student section selection must be approved. The API must not mark a whole
student “enrolled” merely because the application wizard completed.

### 11.5 Attendance endpoints

| Method and path | Classification | Request fields | Success response |
|---|---|---|---|
| `GET /course-sections/{sectionId}/attendance-meetings` | Required for Version 1; Needed by current frontend functionality | Query: `from?`, `to?`, `status?`, `cursor?`, `limit?`. | `200 { sectionId, items: [{ meetingId, meetingDate, status, submittedAt, recordedBy, recordCount }], nextCursor }`. |
| `POST /course-sections/{sectionId}/attendance-meetings` | Required for Version 1 | `{ meetingDate, topic? }`. | `201 { meetingId, sectionId, meetingDate, status: "open", recordedByUserId, records: [] }`. |
| `GET /attendance-meetings/{meetingId}` | Required for Version 1 | No body. | `200 { meetingId, sectionId, meetingDate, status, records: [{ attendanceRecordId, classEnrollmentId, studentId, status, timeIn?, timeOut?, remarks? }], version }`. |
| `PUT /attendance-meetings/{meetingId}/records` | Required for Version 1 | `{ records: [{ classEnrollmentId, status: "present" \| "absent" \| "late" \| "excused" \| "left_early", timeIn?, timeOut?, remarks? }], version }`. | `200 { meetingId, status: "open", records, version }`; validate section membership and uniqueness. |
| `POST /attendance-meetings/{meetingId}/submission` | Required for Version 1 | `{ action: "submit" \| "reopen", reason?, version }`; reopening permission is policy-controlled. | `200 { meetingId, status, submittedAt?, submittedByUserId?, version }`. |
| `GET /students/{studentId}/attendance-summary` | Required for Version 1; Needed by current frontend functionality | Query: `termId?`. Student self-scope or authorized staff scope. | `200 { studentId, termId?, courses: [{ sectionId, courseCode, courseTitle, held, present, absent, late, excused, leftEarly, rate }], overall }`; summaries derived from submitted records. |

### 11.6 Assessments, grading and official results

| Method and path | Classification | Request fields | Success response |
|---|---|---|---|
| `GET /course-sections/{sectionId}/grade-sheets` | Required for Version 1; Needed by current frontend functionality | Query: `period?`, `status?`; role-scoped. | `200 { items: [{ gradeSheetId, sectionId, termId, periodCode, status, submittedAt, returnedNote?, version }] }`. |
| `GET /course-sections/{sectionId}/assessments` | Required for Version 1 | Query: `periodCode` (currently `final`). | `200 { gradeSheetId, items: [{ assessmentId, name, type, assessmentDate?, maximumScore, weightPercentage }] }`. |
| `POST /course-sections/{sectionId}/assessments` | Required for Version 1 | `{ periodCode: "final", name, type, assessmentDate?, maximumScore, weightPercentage }`. | `201 { assessmentId, sectionId, periodCode, name, type, assessmentDate, maximumScore, weightPercentage }`; editable only in allowed sheet states. |
| `PUT /assessments/{assessmentId}/scores` | Required for Version 1 | `{ scores: [{ classEnrollmentId, rawScore, remarks? }], version }`. | `200 { assessmentId, updatedCount, scores: [{ classEnrollmentId, rawScore, updatedAt }] }`; validate max and membership. |
| `POST /grade-sheets/{gradeSheetId}/submission` | Required for Version 1 | `{ action: "submit" \| "recall", version }`. | `200 { gradeSheetId, status, submittedByUserId?, submittedAt?, version }`. Server verifies completeness, weights and caller assignment. |
| `POST /grade-sheets/{gradeSheetId}/reviews` | Required for Version 1 | `{ decision: "approve" \| "return", remarks?, version }`; Department Head scope. | `200 { gradeSheetId, status: "approved" \| "returned", reviewedByUserId, reviewedAt, remarks?, version }`. |
| `POST /grade-sheets/{gradeSheetId}/posting` | Required for Version 1 | `{ version }`; Registrar role. | `200 { gradeSheetId, status: "posted", postedByUserId, postedAt, publishedResults: [{ studentGradeId, studentId, classEnrollmentId, finalGrade, outcome }] }`. One transaction publishes official results. |
| `GET /students/{studentId}/grades` | Required for Version 1; Needed by current frontend functionality | Query: `termId?`, `includeUnreleased` is never student-authorized. | `200 { studentId, terms: [{ termId, academicYear, semester, courses: [{ studentGradeId, classEnrollmentId, courseCode, courseTitle, units, finalGrade?, outcome: "passed" \| "failed" \| "inc" \| "in_progress", releaseStatus: "posted" }] }], summaries }`; student sees posted only. |
| `POST /student-grades/{studentGradeId}/corrections` | Recommended but not yet implemented | `{ correctedGrade?, outcome?, reason }`; permissions and approval process require separate approval. | `202 { correctionId, status: "pending" }`; no direct mutation of a posted result. |

`Finals` is the current active period, but whether it is the official final
grade and how assessment percentages map to the student 1.00–5.00 scale
requires academic-team approval. Preserve `INC` as a non-numeric outcome.
Keep workflow status (`draft/submitted/returned/approved/posted`) separate
from academic outcome (`passed/failed/inc/in_progress`).

### 11.7 Optional supporting endpoints

| Method and path | Classification | Request/response outline |
|---|---|---|
| `GET /departments`, `GET /programs`, `GET /courses`, `GET /rooms` | Required for Version 1 | Read-only catalog lists with stable internal IDs, business codes, labels and active status. |
| `POST /profile-correction-requests`, `GET /profile-correction-requests`, `POST /profile-correction-requests/{id}/decisions` | Needed by current frontend functionality | Request `{ field, requestedValue, reason, version }`; list is staff-scoped; decision `{ decision, remarks, version }`; approval updates the canonical person/student field transactionally. |
| `GET /user-preferences`, `PATCH /user-preferences` | Recommended but not yet implemented | `{ timezone?, emailVisibility?, notifications? }`; account-scoped and only if persistence is approved. |
| `GET /audit-events` | Required for backend foundation if audit UI remains | Filtered/paginated server-created events; caller/scope enforced. No client-supplied actor/time/IP. |
| `POST /document-uploads`, `GET /students/{studentId}/documents`, `POST /documents/{documentId}/reviews`, `POST /document-requests` | Needed by current frontend functionality | Upload uses protected storage and returns metadata/storage reference only; review/requests are permission checked. File size/type, retention and lifecycle remain to approve. |

### 11.8 Error and concurrency behavior

Use consistent HTTP behavior: `400` malformed request, `401` unauthenticated
or generic credential failure, `403` forbidden, `404` not found or hidden
out-of-scope resource, `409` duplicate/state/version conflict, `422`
field/business validation, `429` throttled, and `500` unexpected server
failure with a correlation ID. Never return stack traces or sensitive SQL
details.

When a workflow transition fails, return the current permitted state and a
stable error code; do not silently apply a fallback. Protect against
double-submit with idempotency keys for conversion/provisioning/posting where
retries could create duplicate records.

## 12. Identifiers and database relationships

| Relationship | Proposed key/link | Classification |
|---|---|---|
| Account-person | `users.person_id -> persons.person_id`, unique | Required for Version 1 |
| Student-person | `students.person_id -> persons.person_id`, unique per student profile | Required for Version 1 |
| Staff-person | `staff.person_id -> persons.person_id`, unique per staff profile | Required for Version 1 |
| User-role | `users.role_id -> roles.role_id`; no `user_roles` | Required for Version 1 |
| Role-permission | `role_permissions.role_id -> roles`; `permission_id/code -> permissions` | Required for backend foundation |
| Student-term enrollment | `student_term_enrollments.student_id -> students`; `.term_id -> academic_terms`; optional application FK after policy approval | Required for Version 1 |
| Section catalog | `course_sections.course_id -> courses`; `.term_id -> academic_terms`; `.room_id -> rooms`; faculty staff FK -> `staff` | Required for Version 1 |
| Class membership | `class_enrollments.student_id -> students`; `.section_id -> course_sections`; optional `.term_enrollment_id -> student_term_enrollments` | Required for Version 1 |
| Attendance | `attendance_meetings.section_id -> course_sections`; record -> meeting + class enrollment; actor -> users | Required for Version 1 |
| Assessments/scores | Assessment -> section/period; score -> assessment + class enrollment | Required for Version 1 |
| Grade sheet/results | Grade sheet -> section/term/period; official result -> class enrollment and posted sheet | Required for Version 1 |
| Admissions conversion | Application -> applicant `person_id`; optional converted `student_id -> students`; term/program refs | Required for Version 1 if admissions remains in scope |
| Student number | Unique business identifier on students, referenced for search/display only | Required for Version 1 |
| Class and term IDs | Internal `section_id`/`term_id`; course/section codes are labels/business identifiers | Required for Version 1 |

Use consistent key types across FK pairs. The current root SQL uses mixed
business-code keys, `student_number` PKs and `user_roles`; it must not be
copied as-is because that conflicts with the approved `persons` and
`users.role_id` decisions and does not model the current workflow separation.
The 48-table design is also a draft, not automatic approval.

## 13. Current localStorage data to move eventually

| Current key/object | Backend destination |
|---|---|
| `accounts.js` fixed account data | Demo-only fixture; replace production identity with `users`, `roles`, `persons`, `students`, `staff`. Do not migrate demo credentials as real accounts. |
| `bits-sims-staff-users`, staff `pw`/`locks` | `users`, role/profile relations, approved account security/session/reset records. |
| `bits-sims-auth-pw`, `bits-sims-auth-locks`, `bits-sims-auth-resets`, `bits-sims-demo-inbox` | Server password/session/lockout/reset lifecycle; never migrate plaintext demo inbox values. |
| `bits-sims-profile`, `bits-sims-registrar-me` | Canonical `persons`, `users`, and optional approved `user_preferences`; deduplicate by verified identity mapping. |
| `bits-sims-registry` | `students`, departments/programs/courses/terms/rooms, student term enrollments. Resolve student-number duplicates and verify catalog codes. |
| `bits-sims-admissions` | `admission_applications`, applicant-person link, student conversion, term/class enrollments; do not blindly copy wizard draft state as authoritative records. |
| `bits-sims-staff-classes` | `course_sections`, schedule/room/faculty relationships. |
| `bits-sims-staff-faculty` | Attendance meetings/records, assessments/scores, grade sheets/reviews and approved alerts. |
| `bits-sims-academic` and demo-tool changes | Official `student_grades` and derived summaries only after reconciliation with posted grade sheets; sample historical values are not automatically production data. |
| `bits-sims-documents` and in-memory `File` objects | Document metadata/request records and private file storage; local file objects and data URLs cannot be treated as server files. |
| `bits-sims-corrections` | Profile/student correction requests and server review decisions. |
| `bits-sims-staff-perms`, local `CAPS` | Approved permission catalog and role assignment; reconcile conflicts before seed/configuration. |
| `bits-sims-staff-audit` | Server-generated audit events only where provenance is verifiable; do not import fabricated actor/IP entries as real audit. |
| Staff backup/events/report stores | Not migrated as operational history; features are mock. |

No automatic one-shot migration from browser data is recommended. First
define a reviewed export/mapping procedure, identify authoritative records,
resolve duplicates, validate relationships and obtain data-owner/privacy
approval. LocalStorage is per-browser and mutable, so it is not a trusted
source for institutional production records.

## 14. Frontend files that would change

| Current file | Planned responsibility after backend exists | Classification |
|---|---|---|
| `accounts.js` | Remove from production login; keep only isolated demo fixtures if needed. | Temporary prototype support |
| `auth.js` | Replace local credential/reset/lockout logic with API calls and session-aware UI. | Required for backend foundation |
| `staff.js` | Replace local user/account/class/attendance/assessment/grade persistence with APIs; render server-authorized results. | Needed by current frontend functionality |
| `registrar.js` | Use APIs for student registration, admissions, term enrollment, corrections, attendance review and grade posting. | Needed by current frontend functionality |
| `registry.js` | Replace sample local registry/catalog access with API repositories. | Needed by current frontend functionality |
| `data.js` | Replace academic localStorage source with official grades/terms APIs and derived client display only. | Needed by current frontend functionality |
| `script.js` | Use API resources for person/student/profile, application/enrollment, documents, attendance, grades and preferences. | Needed by current frontend functionality |
| `index.html` | Likely limited markup/loading/error/session handling changes; no DB access. | Recommended but not yet implemented |
| `demo-tools.html` | Keep dev-only, isolate from production/API data, or remove after replacement. | Temporary prototype support |
| `style.css`, `staff.css`, `registrar.css`, `reports.css` | Update loading/errors/conflict/authorization states as needed. | Recommended but not yet implemented |

Do not let browser code connect directly to MySQL/MariaDB. API origin, CORS,
cookie and CSRF configuration must match the approved deployment architecture.

## 15. Current demo functionality that can temporarily remain

For development only, and only when clearly isolated from production:

- Demo role navigation and fictional sample records.
- `demo-tools.html` for sample academic state, provided it cannot access or
  mutate the production API/database.
- Local UI prototypes for backup, monitoring, report preview, MFA toggle and
  notification display while they are marked simulated/unavailable.
- Browser-derived summaries as presentation calculations using API data.

Use separate development credentials, environment and database. Do not seed
the hardcoded plaintext passwords, sample personal data, fabricated audit
events/IPs or simulated backup history into production.

**Classification:** Temporary prototype support.

## 16. Functionality that must be replaced before real deployment

- Hardcoded passwords, client-side authentication, custom password hashes,
  localStorage password state, demo reset inbox and browser-side lockout.
- Authorization based only on navigation, hidden buttons, `CAPS` arrays or
  local permission state.
- Staff account CRUD that is not connected to login.
- Browser-only person/account/student identity and localStorage persistence
  for shared institutional workflows.
- Disconnected applicant conversion, student term enrollment, course-section
  membership, staff roster and static student attendance.
- Separate staff grade-sheet and student-visible grade stores without a
  transactional posting operation.
- Client-only validation for permission-sensitive/business rules, schedule
  and capacity checks, score bounds and workflow transitions.
- Document previews/uploads without private server storage and access control.
- Browser-generated audit provenance and simulated backup/monitoring presented
  as real services.

## 17. Security requirements

1. TLS for every credential/session/API request; secrets in server environment
   or secret manager, never committed to source or sent to browser code.
2. Modern password KDF with safe parameters; rehash policy; no plaintext or
   reversible passwords.
3. Opaque server sessions in `HttpOnly; Secure` cookies; rotation at login
   and privilege changes; expiry/revocation; CSRF defenses for cookie-auth
   writes; no bearer secrets in localStorage.
4. Generic login/reset responses, throttling by account and network signals,
   lockout policy resistant to easy denial of service, one-time reset and
   activation tokens stored as hashes.
5. Server-side authorization on every endpoint, object-level scoping, least
   privilege, and audit of administrative/grade/enrollment decisions.
6. Input validation, output encoding, parameterized SQL, bounded pagination,
   upload type/size limits, private file access and malware scanning policy.
7. Transactions and idempotency for person/account provisioning, applicant
   conversion, enrollment decisions and grade posting.
8. Do not expose password hash, reset token, session ID, internal errors,
   sensitive fields or unnecessary person details in API responses/logs.
9. Define retention, privacy, backups, incident response, logging and account
   recovery with responsible data owners before production.
10. MFA is not implemented in the current code. Decide explicitly whether it
    is a deployment prerequisite; do not imply that a database flag enables
    MFA.

**Classification:** Required for backend foundation.

## 18. Phased implementation order

1. **Approve contract and platform:** decide server runtime, Hostinger
   deployment capability, API origin, database access method, key strategy,
   roles/permission matrix and data ownership questions.
2. **Finalize domain model and state rules:** resolve student/staff dual
   profile policy, account provisioning, email uniqueness, application
   conversion, term/class enrollment semantics, attendance transitions,
   grade calculation/INC/correction, document retention and status codes.
3. **Design and review schema:** produce ER model, constraints and migration
   plan; compare both drafts; verify development DB baseline read-only; do not
   execute against Hostinger without separate authorization.
4. **Build backend foundation:** configuration/secrets, database pool,
   migrations in a local/disposable DB, request validation, sessions, error
   handling, audit and automated tests.
5. **Implement identity/auth:** persons/users/students/staff/roles/permissions,
   login/logout/session, password/reset/activation, administrator staff
   account provisioning and role-based API authorization. Resolve Gap 1
   end-to-end before expanding live data.
6. **Implement catalog and admissions/enrollment:** terms, sections,
   applicant-to-student conversion, term enrollment and class membership as
   distinct transactional resources.
7. **Implement attendance:** meetings, records, submit/reopen, authorized
   roster and derived summaries.
8. **Implement grading:** assessment definitions/scores, grade-sheet review,
   one posting transaction and student-visible official grades.
9. **Implement supporting resources:** documents/private storage, profile
   corrections, approved preferences, audit views and only approved settings.
10. **Integrate frontend incrementally:** start with login/account management,
    then student/Registrar identity, enrollment, attendance, grading and
    documents; remove corresponding local persistence only after parity tests.
11. **Validate and deploy:** authorization tests per role/resource, workflow
    transition tests, migration rollback/backup rehearsal, data mapping
    review, security checks, monitoring and staged deployment.

## 19. Decisions still requiring approval

- Backend/runtime/deployment compatibility: Node.js/Express is proposed,
  not selected; confirm actual Hostinger plan support or choose a supported
  alternative before implementation.
- Approved username-only login, lowercase normalization, allowed-character
  validation, and case-insensitive uniqueness are recorded in Decision 02.
  Email-based login and student-number login aliases are postponed.
  Personal/work email ownership for contact purposes still requires
  field-level approval.
- Whether a person may hold both student and staff profiles; which student
  records receive accounts; staff invitation/activation and account recovery.
- Canonical permission codes and scope policy, especially the current
  divergence between `CAPS` and editable permission matrix.
- Canonical ownership/requiredness of DOB, address, personal/work email,
  phone, avatar and preferences; application snapshot/retention policy.
- Admission conversion/number allocation, student term enrollment approval,
  class-selection and capacity/unit rules, and term-date source.
- Attendance mark semantics and reopening authority; grade scale/percentage
  mapping, incomplete grade behavior, review stages and correction process.
- Document requirements, storage provider, access, retention and deletion.
- Whether reset email, activation email, MFA, audit retention and policy
  configuration are required at initial deployment.
- Data migration scope and quality: localStorage is per-browser/sample data
  and cannot be accepted as a production source without owner-verified
  extraction and reconciliation.
- Guardians and emergency contacts remain postponed unless a later approved
  scope explicitly reopens them.

## 20. Source files reviewed

### Current application and project

- `accounts.js`, `auth.js`, `staff.js`, `registry.js`, `data.js`,
  `registrar.js`, `script.js`
- `index.html`, `demo-tools.html`
- `style.css`, `staff.css`, `registrar.css`, `reports.css`
- `README.md`, `database/README.md`, `codeswing.json`
- Root and database folder inventory; no backend package manifest or
  application API implementation was found.

### Planning and schema

- `database/design/current-code-reassessment.md`
- `database/design/v1-gap-resolution-plan.md`
- `database/design/v1-implementation-alignment.md`
- `database/design/v1-scope-reconciliation-v2.md`
- `database/design/decision-01-identity-ownership.md`
- `database/design/BITS-SIMS_Database_Design.md`
- `database.schema.sql` (unapproved draft only)
- `database/migrations/001_initial_schema.sql` (comments-only placeholder)
- `Hostinger school database.session.sql` (connection/session file inspected
  only as a workspace file; no connection was opened)

The comprehensive PDF is not used as a source for this contract. The draft
SQL files were read only and not executed. The Hostinger database was not
accessed.

## 21. Completion and safety summary

- Backend architecture: **proposed modular monolith with versioned,
  same-origin JSON REST API**.
- Backend technology: **Node.js LTS + Express + MySQL/MariaDB-compatible
  driver, provisional pending hosting/team approval**.
- Authentication: **server-verified credentials, generic failures,
  server-managed secure session cookie, server-side lockout/reset/activation,
  and server-derived authorization**.
- Identity: **`persons` shared by users/students/staff; unique
  `users.person_id`; unique profile-person links; single
  `users.role_id -> roles`; no `user_roles`**.
- API endpoint families: **auth/session, staff account administration,
  person/student/staff, catalog/terms/sections, admissions/conversion,
  term/class enrollment, attendance meetings/records, assessments/scores,
  grade sheets/posting/results, plus optional documents/corrections,
  preferences and audit**.
- Staff login: **make backend `users` the only account/auth source; account
  provisioning creates/link person, staff and user transactionally; login
  reads the same user record**.
- Enrollment/grades/attendance: **use stable internal IDs and shared
  membership; separate student-term enrollment from section membership;
  link attendance to meetings and memberships; link assessments/scores and
  grade sheets to sections/memberships; publish official grades atomically**.
- Persons: **move canonical identity/contact to `persons`, credentials and
  role to `users`, academic fields to `students`, employment fields to
  `staff`; deduplicate verified records before any migration**.
- Unresolved choices: listed in section 19, especially runtime hosting,
  key/login policy, permissions, academic rules and data ownership.
- Application files modified: **No**.
- Existing SQL/schema files modified: **No**.
- Migration SQL generated or SQL executed: **No**.
- Hostinger database modified or accessed: **No**.
- New contract created: **`database/design/backend-identity-and-api-contract.md`**.
