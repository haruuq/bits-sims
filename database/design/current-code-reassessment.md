# Current Code Reassessment

**Review date:** November 10, 2026  
**Current checkout:** `062ce13` (`main`)  
**Purpose:** Fresh review of the current application implementation against
the existing database planning documents. This is not a schema approval or
migration.

## Review basis and limits

- The current checked-out HTML, JavaScript and CSS are the implementation
  evidence. The project is a browser prototype; application data and
  authentication are handled in JavaScript and browser storage.
- The prior planning documents are comparison sources, not evidence that a
  feature is implemented.
- Git history was checked. The worktree has no tracked changes; existing
  untracked database planning/schema files were left untouched. The history
  establishes changes from older project revisions, but the prior reports
  share the November 10 review date and do not identify a precise source-code
  commit for their snapshot. Therefore, a feature listed below as added or
  removed from an older revision is not necessarily a change made after the
  prior report.
- `database.schema.sql` was inspected as an unapproved draft. The migration
  file remains comments only. No database connection was used and no SQL was
  run or generated.

Classification labels below use the requested vocabulary. “Stored only in
localStorage” describes prototype persistence, not reliable shared or
authoritative persistence. “Implemented and working” means only that a
browser-side flow operates in the sample application; it does not imply
production readiness.

## 1. Current application structure

| Area | Current implementation | Classification |
|---|---|---|
| Student-facing shell | `index.html` contains the login screen and student portal; `script.js` supplies navigation, rendering, event handlers and sample workflows. | Implemented but incomplete |
| Registrar portal | `registrar.js` renders its own portal in the `registrarView` container. | Implemented but incomplete |
| Staff portals | `staff.js` renders ICT Services, EdTech, Department Head and Faculty views in `staffView`. | Implemented but incomplete |
| Shared demo accounts | `accounts.js` supplies six hardcoded login identities and passwords. | Frontend-only or mock functionality |
| Student academic store | `data.js` supplies sample terms, results, grading rules and derived summaries. | Stored only in localStorage |
| Student registry | `registry.js` supplies sample students, setup catalogs and term enrollments. | Stored only in localStorage |
| Development data tool | `demo-tools.html` can change sample grades and attendance in the shared browser store. | Frontend-only or mock functionality |
| Styling | `style.css`, `reports.css`, `registrar.css` and `staff.css` style the login, student, Registrar and staff interfaces. Styles define no database contract. | Implemented and working |
| Backend/API | No application API client, database driver, or server integration was found. The Iconify image URL is an external image asset, not an application API. | Requires backend implementation |

## 2. Current frontend pages and workflows

| Portal/page | Current screens or workflow | Classification |
|---|---|---|
| Login/recovery | Username/email and password login; forgot-password request, code entry, and password reset. | Implemented but incomplete |
| Student | Home, profile, academic records, attendance, admissions/enrollment, documents, settings, reports and a profile summary. One placeholder/coming-soon view also exists. | Implemented but incomplete |
| Registrar | Home/queues, student profiles, registration, profile corrections, admissions, term and class enrollment views, attendance review, academic records/grade posting, reports, documents, activity and settings. | Implemented but incomplete |
| ICT Services | Dashboard, user accounts, roles/permissions, audit, backup, monitoring, reports, system settings and account page. | Implemented but incomplete |
| EdTech | Dashboard, account support, class/schedule maintenance, monitoring, reports and account page. | Implemented but incomplete |
| Department Head | Dashboard, class offerings/faculty, grade review, department students, attendance overview and reports. | Implemented but incomplete |
| Faculty | Dashboard, assigned classes/rosters, meeting attendance, assessments/scores, grade submission and reports. | Implemented but incomplete |
| Page access | Login routes to separate portal views; client-side navigation controls what is displayed. | Implemented but incomplete |
| Report output | CSV downloads and browser print/Save-as-PDF output use client-side sample data. | Frontend-only or mock functionality |

## 3. Current user types and roles

The role codes are `ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`, `FACULTY`, `REGISTRAR`
and `STUDENT`. `accounts.js` has one demo login for each role; the staff-side
sample account list has ten rows, including multiple Faculty and Registrar
accounts. The account model uses one `role` string per account.

| Finding | Classification |
|---|---|
| The current UI distinguishes login accounts from student and staff workflows, but the browser data does not establish a canonical person shared by those records. | Implemented but incomplete |
| Student numbers identify registry and roster rows; staff accounts contain employee metadata. Neither is linked to a shared person ID in the current code. | Implemented but incomplete |
| The approved shared `persons` model is a planning decision, not a feature already supported by the frontend data model. | Planned but not implemented |
| One role per account remains consistent with the current account form and hardcoded role field. | Implemented and working |
| Current code does not use a `users.role_id` foreign key; it uses role-code strings. `users.role_id` remains an appropriate database representation of the approved single-role rule, subject to API mapping. | Requires backend implementation |
| A person's simultaneous student/staff profiles and their account cardinality are not demonstrated by the application. | Unclear and requiring team review |

## 4. Current authentication and authorization logic

| Finding | Classification |
|---|---|
| Login accepts username or email; student lookup also accepts the student number. Credentials and demo identities are in `accounts.js`. | Frontend-only or mock functionality |
| A prototype hash and password overrides are maintained in browser code/storage; the hash is not a production password KDF. | Requires backend implementation |
| Student and Registrar login lockout/reset handling is in `auth.js`; staff login has a separate path and data in `staff.js`. Both are client-controlled. | Implemented but incomplete |
| Reset codes are six digits, expire after 15 minutes, allow five code attempts, and have a 60-second resend wait. The code is exposed in a `sessionStorage` demo inbox; no email is sent. | Frontend-only or mock functionality |
| Staff account settings include MFA and must-change-password flags, but there is no MFA challenge flow or production password-change enforcement. | Implemented but incomplete |
| Staff capability checks use hardcoded `CAPS`; the editable `db.perms` matrix is a separate local role-permission list. The matrix is not the authoritative enforcement mechanism. | Implemented but incomplete |
| Page/button hiding is not server-side authorization. Server-derived identity, role/permission checks, secure password hashing, reset delivery, lockout enforcement and actor attribution require a backend. | Requires backend implementation |
| Staff idle timeout is configured in local policy; it is not a server session. Sign-in state is held in module memory rather than a durable authenticated server session. | Requires backend implementation |

## 5. Current forms and fields

Searches, filters, tabs and report selectors are included as UI controls but
are not independent domain records. Static student forms are in `index.html`;
Registrar and staff forms are generated dynamically in their JavaScript.

| Form/workflow | Current data-bearing fields | Classification |
|---|---|---|
| Login | Username/email; password. | Frontend-only or mock functionality |
| Password reset | Username/email/student number; six-digit code; new password; confirmation. | Requires backend implementation |
| Student general profile | First name, last name, email, email visibility, city, country and timezone. Name edits create a correction request; other fields update the profile store. | Stored only in localStorage |
| Student picture | Image file, delete-picture action, preview; images are converted to data URLs. | Stored only in localStorage |
| Student contact | Current/new phone number and delete-number action. | Stored only in localStorage |
| Student account settings | Personal email, mobile number, home address, current/new/confirmation password, notification choices. | Stored only in localStorage |
| Applicant submission | Freshman/transferee/returnee, program, term and confirmation; applicant identity is drawn from the existing demo profile rather than entered as a linked applicant record here. | Implemented but incomplete |
| Applicant enrollment wizard | First/middle/last name, date of birth, mobile number, home address, document requirements, selected course codes and units. DOB/mobile/address are validated at this step. | Stored only in localStorage |
| Registrar student registration | Department, program, admission type, year level (currently 3rd), first/middle/last name, DOB, personal email, mobile, city, guardian name/number, emergency-contact name/number. Only first and last name are required by the save handler. | Stored only in localStorage |
| Student profile corrections | Requested field, old/new values, reason, date, pending/approved/rejected status, reviewer and remarks. | Stored only in localStorage |
| Registrar settings | Work email, mobile, office, notification toggles, current/new/confirmed password. | Stored only in localStorage |
| Staff user account | Full name, username, account email, one role, account status, MFA flag and must-change flag. | Stored only in localStorage |
| Staff class offering/schedule | Course code/title, section, faculty, room, day, start/end time, capacity; the current scope fixes year and modality. | Stored only in localStorage |
| Staff attendance | Class, meeting date, student number/name, attendance status, time in/out, computed lateness and remarks; draft/submit/reopen controls. | Stored only in localStorage |
| Staff grading | Class, period, assessment name/type/date/max score/weight, per-student score, review/return remarks. | Stored only in localStorage |
| Staff roles/settings/operations | Permission checkboxes; failed-login limit, lock minutes, minimum password length, idle timeout; attendance thresholds and recipient flags; backup schedule/type/location/retention; report filters and event status. | Frontend-only or mock functionality |

The current HTML profile's country/timezone/email-visibility fields and the
student enrollment wizard's DOB/address do not imply that every value must be
required in the database. Requiredness and ownership are not consistent across
the separate profile and registration flows.

## 6. Current data stored in localStorage or client-side state

| Store | Data currently represented | Classification |
|---|---|---|
| `bits-sims-profile` | Student names, email, contact, city/country/timezone, address, avatar and notification preferences; also shared with Registrar correction display. | Stored only in localStorage |
| `bits-sims-corrections` | Name-correction requests and Registrar decisions. | Stored only in localStorage |
| `bits-sims-documents` | Requirement status, notes, update dates, file metadata and COR/COE/TOR request dates. File objects themselves are session/page objects, not durable private files. | Stored only in localStorage |
| `bits-sims-admissions` | Sample applications, application decisions, wizard progress, personal-data draft, completed requirements, selected offerings and completion date. | Stored only in localStorage |
| `bits-sims-registry` | Students, setup arrays (departments, programs, courses, terms, rooms) and Registrar term-enrollment rows. | Stored only in localStorage |
| `bits-sims-academic` | Terms, subjects, grades, grading rules, aggregate attendance and derived academic summaries. | Stored only in localStorage |
| `bits-sims-staff-users`, `bits-sims-staff-perms` | Staff-side account list/status and editable permissions. | Stored only in localStorage |
| `bits-sims-staff-classes`, `bits-sims-staff-faculty` | Class offerings; attendance sessions/rows, assessments, scores, grade-sheet state/notes and alerts. | Stored only in localStorage |
| `bits-sims-staff-audit` | Seeded and browser-generated audit-shaped events. | Stored only in localStorage |
| `bits-sims-staff-policy`, `bits-sims-staff-alertcfg` | Password/session policy and attendance alert thresholds/recipient flags. | Stored only in localStorage |
| `bits-sims-staff-backups`, `bits-sims-staff-events`, `bits-sims-staff-reports` | Simulated backup history, monitoring events and generated-report metadata. | Frontend-only or mock functionality |
| Staff/student auth keys | Password overrides, failed attempts, lockout state and reset-code hashes in browser storage. | Stored only in localStorage |
| `bits-sims-demo-inbox` | Plain reset code visible in the current browser session. | Frontend-only or mock functionality |
| `bits-sims-registrar-me` | Registrar-specific contacts and notification preferences. | Stored only in localStorage |
| JavaScript module state | Current portal account/page, open tabs, filters, drafts, report output, student attendance detail and current `File` objects. | Frontend-only or mock functionality |
| `bits-sims-staff-version` | Sample-store seed version; a version change clears the listed staff stores. | Frontend-only or mock functionality |

The sources are split across separate keys and identities. Browser storage is
per-browser, client-editable, may fail, and is not an authoritative multi-user
store.

## 7. Current status values and workflow transitions

| Feature | Current code values/flow | Classification |
|---|---|---|
| Account status | `Pending Activation`, `Active`, `Locked`, `Inactive`, `Suspended`; failed login can lock, reset/unlock may clear lock, and suspension remains distinct. | Stored only in localStorage |
| Application | `pending` -> `review` -> `accepted` or `rejected`; `withdrawn` is also present; an accepted application may become `enrolled`. | Stored only in localStorage |
| Registrar term enrollment | `Pending` -> `Verified` -> `Enrolled`. | Stored only in localStorage |
| Student status | `Active`, `On Leave`, `Archived`; Registrar can archive/restore. | Stored only in localStorage |
| Course offering | Seed/current offering status includes `Open`; cancelled is excluded from faculty class lists, but the UI does not provide a complete offering lifecycle. | Implemented but incomplete |
| Document requirement | `missing`, `review`, `verified`, `rejected`; upload changes missing/rejected to review and Registrar can verify/reject with notes. | Stored only in localStorage |
| Document request | COR/COE/TOR keyed by request date; cancellation/release removes the map entry rather than retaining lifecycle history. | Implemented but incomplete |
| Attendance meeting | `Open` -> `Submitted`; submitted rows lock; faculty can recall/reopen to draft. | Stored only in localStorage |
| Attendance mark | `Present`, `Absent`, `Late`, `Excused`, `Left Early`; time-in/out, remarks and alerts are also represented. | Stored only in localStorage |
| Staff grade sheet | `Draft` -> `Submitted` -> `Approved` -> `Posted`; `Returned` is available; faculty can recall a submission. | Stored only in localStorage |
| Student result | Workflow states are lowercase `draft`, `submitted`, `approved`, `posted`; only posted results are student-visible. Academic outcome includes `inprogress`, `passed`, `failed`, `inc`; `INC` has no numeric final grade. | Stored only in localStorage |
| Enrollment wizard | UI steps are `locked`, `current`, `done`; selected units are checked against 12-24 in the browser. | Frontend-only or mock functionality |
| Operational demo | Backup/event values include `Running`, `Completed`, `Failed`, `Open`, `Investigating`, `Resolved`, `Warning`, `Critical` and related labels. | Frontend-only or mock functionality |

The same concepts have different casing and vocabularies across student,
staff, Registrar and SQL drafts. They need canonical API/database codes and
explicit transition rules before migration.

## 8. Current student functionality

| Feature | Current behavior | Classification |
|---|---|---|
| Profile and contact | Student can edit general/contact details, picture and notifications; official name changes require Registrar review. | Stored only in localStorage |
| Academic records | Displays sample term grades, units, standing and GWA; only posted grades are shown. | Stored only in localStorage |
| Attendance | Displays a prebuilt course/session history and calculated rate; it is not driven by faculty attendance entries. | Frontend-only or mock functionality |
| Admissions | Student can view sample applications, submit a simple application, withdraw, and follow a status timeline. | Stored only in localStorage |
| Enrollment | Accepted application unlocks a four-step wizard, personal details, requirement completion and course selection within a unit range. | Implemented but incomplete |
| Documents | Student can request/view documents and stage, upload, replace or preview requirements in the UI. | Implemented but incomplete |
| Password/preferences | Change/reset password and notification controls are client-side. | Requires backend implementation |
| Database consequence | Person/profile, student status, applications, term and class enrollment, document metadata, academic results and official preferences need durable persistence if those workflows remain in scope. | Requires database persistence |

## 9. Current staff functionality

| Role/feature | Current behavior | Classification |
|---|---|---|
| Faculty | Assigned sample offerings and rosters; encodes meeting marks and assessment scores; submits grades. | Stored only in localStorage |
| Department Head | Creates offerings, assigns faculty, reviews/returns grade sheets, and reads department students/attendance. | Stored only in localStorage |
| EdTech | Supports accounts, edits class schedules, views monitoring and produces reports. | Stored only in localStorage |
| ICT Services | Manages account rows, role permissions, audit-shaped logs, backups, monitoring, security policy and reports. | Implemented but incomplete |
| Staff account and permissions | Account rows and permission arrays are independent of hardcoded authentication identities/capabilities. | Implemented but incomplete |
| Database consequence | Staff identity/employment, account, permission, class assignment, schedule, attendance, assessments, score, grade-review and audit records need backend persistence if retained. | Requires database persistence |

Active class offering scope in code is third-year, face-to-face, with one
assigned faculty, one weekly day/time and one room per offering. This is a
current code restriction, not proof it is permanent institutional policy.

## 10. Current registrar functionality

| Feature | Current behavior | Classification |
|---|---|---|
| Student registry | Searches/filters students, creates a student row, assigns a generated student number, and supports archive/restore. | Stored only in localStorage |
| Student registration | Captures academic/program fields, personal/contact fields and one guardian plus one emergency contact; only first/last names are checked as required. | Implemented but incomplete |
| Profile correction | Reviews pending requests, approves/rejects and records reviewer/remarks; approved names are written to the shared profile key. | Stored only in localStorage |
| Admissions and enrollment | Reviews applications, records decisions, verifies Registrar term-enrollment rows, and sees class-enrollment sample rows. | Implemented but incomplete |
| Grades | Reviews two distinct sources: staff grade sheets and student-portal grade states; can approve/post/return those paths. | Implemented but incomplete |
| Attendance/documents | Attendance is read-only; Registrar verifies/rejects requirements and releases document requests. | Stored only in localStorage |
| Reports/activity/settings | Produces CSV, views own client audit entries, and stores local account preferences. | Frontend-only or mock functionality |
| Database consequence | Student records, identity, term enrollment, applications, correction decisions, documents, posted grades and server-attributed audit actions require persistence if retained. | Requires database persistence |

Guardian and emergency-contact controls are present in current registration
and profile screens. Their storage/persistence is not approved for Version 1:
the team decision postpones those entities. Do not silently add their tables
or discard their future-phase status.

## 11. Current administrator functionality

The ICT Services role has account, role/permission, audit, backup, monitoring,
configuration and report screens. EdTech and Department Head also have
administrative-looking class/account support but have different client-side
capabilities. Registrar is a separate portal, not the current system
administrator.

| Feature | Classification |
|---|---|
| Account lifecycle and policy controls stored in browser state | Implemented but incomplete |
| Role editor and its local matrix | Implemented but incomplete |
| Backup execution/history and restore-test button | Frontend-only or mock functionality |
| Monitoring values and system events | Frontend-only or mock functionality |
| Audit records with hardcoded/sample IPs and browser-generated actors | Frontend-only or mock functionality |
| Backend enforcement, real backup service, monitoring and trusted audit provenance | Requires backend implementation |

## 12. Current academic, enrollment, grading, attendance, and document functionality

| Area | Current implementation | Classification |
|---|---|---|
| Catalog | Local arrays for departments, programs, courses, terms and rooms; some dates/units are display strings. | Stored only in localStorage |
| Class offerings | Sample class/section, course, faculty, weekly schedule, room, modality, type, capacity, size and status; overlap checks run in JavaScript. | Implemented but incomplete |
| Admissions | Application records and decision flow are separate from Registrar term enrollment. | Stored only in localStorage |
| Term enrollment | Registry has `Pending`/`Verified`/`Enrolled` records. | Stored only in localStorage |
| Student class selection | Wizard stores selected course codes and completion in admissions state; it does not create the staff roster/class-enrollment rows. | Implemented but incomplete |
| Grading | Faculty assessments and weighted scores feed staff grade-sheet states; student portal grades come from a different sample academic store. | Implemented but incomplete |
| Attendance | Staff keeps per-meeting detailed marks; student page has separately fabricated session history; `data.js` also has aggregate course counts. | Implemented but incomplete |
| Documents | UI checks PDF/JPG/PNG type/extension and 5 MB size; metadata/status are local, while file content is not durably stored in protected file storage. | Requires backend implementation |
| Reports | CSV and print outputs are computed from sample/local data; generated output is not an authoritative archive. | Frontend-only or mock functionality |
| Derived values | GWA, units, attendance rates and some alerts are calculated in code. | Implemented and working |

## 13. Features that were added since the previous review

The workspace has no tracked changes beyond commit `062ce13`, and prior
planning documents were also reviewed on November 10. It is not possible to
prove which features were added after those documents' exact source snapshot.
The following changes are verifiable in current Git history relative to older
project revisions and are present in the current code:

| Change evidenced by history/current source | Current state | Classification |
|---|---|---|
| Shared forgot-password flow, reset code lifecycle, generic login error and lockout work (`0cf27a0`; current `auth.js`, `staff.js`) | Exists as prototype behavior, not secure server authentication or email delivery. | Implemented but incomplete |
| Role-specific accounts and separated Registrar/staff portals (merge `062ce13`; `accounts.js`, `registrar.js`, `staff.js`) | Six-role routing and separate UIs exist; account and data identities remain fragmented. | Implemented but incomplete |
| Shared registry store and student/setup/term-enrollment rows (`registry.js`) | Browser-local sample data only. | Stored only in localStorage |
| Scope revision (`1348527`) | EdTech/ICT Services roles, third-year-only staff offerings, Finals-only active grading, face-to-face-only offerings. | Implemented but incomplete |
| Staff attendance and weighted assessment/grade-review workflows | Current code has detailed sample workflows; it is not connected to an authoritative backend or the student data store. | Implemented but incomplete |

The existing `v1-decisions-latest.md` and `v1-implementation-alignment.md`
already mention the password-reset/lockout and narrowed-scope features. They
are not new discrepancies relative to those documents; they remain important
current implementation constraints.

## 14. Features that were removed since the previous review

| Removed/narrowed item | Evidence and current state | Classification |
|---|---|---|
| Earlier `admin.js` / `admin2.js` portal files | Current merge history deletes them and replaces the mixed portal with `registrar.js` and `staff.js`; do not restore the old mixed administrator workflow. | Removed or no longer present |
| Midterm grading in the active staff flow | Current `PERIODS` contains only `Final`; comments describe adding Midterm as a future scope change. Existing historical student grades remain in data. | Removed or no longer present |
| Non-third-year and non-face-to-face active offerings | Current staff seed/form fixes year to third-year and modality to face-to-face. | Removed or no longer present |
| EdTech view-only access to roles/audit/backup pages | Current EdTech navigation/capabilities omit these views; it has account support, class/schedule, monitoring and reports. | Removed or no longer present |
| Other changes after the prior report | No exact baseline commit for that report is identified; absence cannot be reliably asserted. | Unclear and requiring team review |

## 15. Features that were renamed or changed

| Earlier/current difference | Database/design effect | Classification |
|---|---|---|
| Mixed admin portal split into Registrar and ICT/EdTech/Department Head/Faculty portals | Preserve role-specific actor/workflow boundaries; avoid a generic `admin` entity/permission assumption. | Implemented but incomplete |
| Role labels distinguish `EDTECH` and `ICT_ADMIN` (ICT Services) | Persist stable role codes, not presentation labels. | Implemented but incomplete |
| Staff grades moved from a single final grade control to weighted assessment/score sheets, review and posting; active period is now Finals-only | Schema needs assessments, scores and review state if this workflow remains. It must still be reconciled to official student results. | Implemented but incomplete |
| Attendance moved from sample aggregate marking toward detailed staff meeting rows and submission | Persist meeting lifecycle and per-student detail; student page is still disconnected. | Implemented but incomplete |
| Student application/enrollment progress is four steps rather than a single enrollment action | Distinguish application, term registration and class enrollment; wizard states need not automatically become database status fields. | Implemented but incomplete |
| Browser status labels and SQL enum codes differ in case and vocabulary | Define stable stored codes and map labels/transitions at the API boundary. | Requires backend implementation |

## 16. Features that appear in the design documents but are not implemented

| Planned feature | Current evidence | Classification |
|---|---|---|
| Shared `persons` rows and FKs from `users`, `students`, `staff` | No person IDs or shared identity service in browser data; same people are represented in separate objects. The team approved the model, not its implementation. | Planned but not implemented |
| Database-backed authentication/authorization and API | No app API or database integration. | Requires backend implementation |
| Authoritative roles/permissions and server-side scope checks | Hardcoded `CAPS` and editable browser permission matrix are separate; neither is server enforced. | Planned but not implemented |
| Durable private document storage, authenticated file download and review history | UI accepts files, but no private storage service or durable file content exists. | Planned but not implemented |
| Complete data model for applicant conversion, person/student linkage and immutable application snapshots | Current application stores simple fields and optional `studentId`; no shared identity conversion is performed. | Unclear and requiring team review |
| Multi-role or department-scoped user assignment from the previous 48-table design | Current account UI is single-role; approved V1 decision specifically avoids `user_roles`. | Planned but not implemented |
| Operational backup, monitoring, report archive, notifications and durable audit service | Present screens simulate or locally record these functions, not the underlying services. | Planned but not implemented |
| Guardians and emergency contacts as reusable related persons | Current form collects one of each; separate entities remain postponed by the approved decision. | Planned but not implemented |

## 17. Features implemented in the code but missing from the design documents

“Missing” here means absent or incomplete in at least one draft, especially
the 24-table `database.schema.sql`; the planning reports already document
many of these requirements.

| Code field/behavior | Draft mismatch and significance | Classification |
|---|---|---|
| Account `mfa`, `mustChange`, `failed`, `lockoutUntil`, `lastLogin`, pending activation/inactive/suspended states | Root SQL has coarser account state and lacks several security fields; MFA itself is only a flag. | Requires database persistence |
| Reset-code hash, expiration, tries, used state and resend cooldown | Root SQL has no corresponding reset table; never store the displayed demo code as plaintext. | Requires database persistence |
| Roles represented as one code per account | Root SQL and the 48-table draft use `user_roles`; the approved V1 decision supersedes that relation with `users.role_id`. | Requires schema change |
| One-time account/profile preference fields (email visibility, country, timezone, avatar, phone, address, notification settings) | Drafts do not consistently assign owners or account/person scope. | Unclear and requiring team review |
| Application `withdrawn`/`enrolled` and wizard draft/selected offerings | Root application enum omits some current states; the wizard is not the same as term or class enrollment. | Requires database persistence |
| Term enrollment `Pending`/`Verified`/`Enrolled` | Root SQL `enrollments` instead means student-to-section membership. | Requires schema change |
| Assessment definitions, weighted scores, grade-sheet `Returned`/recall, separate posted student result | Root SQL has a generic grade table and does not represent the live staff assessment workflow. | Requires schema change |
| Attendance meeting `Open`/`Submitted`, mark `Left Early`, time-in/out and remarks | Root SQL attendance enum omits `Left Early` and related meeting/row details. | Requires schema change |
| Staff enrollment/course offering fields: single faculty, day/start/end, modality/type, capacity/size and status | Drafts vary in schedule/assignment normalization; these controls currently exist in the staff UI. | Requires database persistence |
| Guardian/emergency-contact form values | Root schema inlines them while the 48-table draft proposes separate entities; current team decision postpones both. | Unclear and requiring team review |

## 18. Fields currently used by the frontend

The following inventory distinguishes UI inputs from persisted domain data;
filter/query values are intentionally listed as presentation controls.

| Field group | Frontend fields observed | Classification |
|---|---|---|
| Credentials/recovery | Username/email/student number, password, reset code, new password and confirmation. | Frontend-only or mock functionality |
| Person/profile | First, middle and last name; personal/institutional email; phone/mobile; address/city/country; date of birth; timezone; email visibility; avatar. | Stored only in localStorage |
| Student record | Student number, program, department, year level, admission type, student status. | Stored only in localStorage |
| Applicant/enrollment | Application number/type/program/term/status, submitted/verified/decision dates, reviewer remarks, selected course codes and units. | Stored only in localStorage |
| Contacts | Guardian name/number and emergency contact name/number. | Unclear and requiring team review |
| Documents | Requirement/type, file name/type/size, status, note/rejection reason, updated date, request type/date. | Stored only in localStorage |
| Class/catalog | Department/program/course/term/room identifiers and labels; offering section, faculty, day, time, room, modality, capacity, size and status. | Stored only in localStorage |
| Attendance | Meeting date/state, student number, status, time-in, time-out, remarks, alert counts/settings. | Stored only in localStorage |
| Grades | Period, assessment name/type/date/max/weight, score, percent, equivalent/final result, grade workflow state, reviewer note. | Stored only in localStorage |
| Access/security | Role, permissions, account status, MFA flag, must-change flag, failed attempts, lock expiry, password policy and idle timeout. | Stored only in localStorage |
| Operations/reports | Backup schedule/history, event type/module/severity/status, report selection/range and generated metadata. | Frontend-only or mock functionality |
| Search/filter controls | Student/account/course query, status/role/date filters and selected tabs. | Frontend-only or mock functionality |

## 19. Fields currently used by application logic

| Logic/data fields | Use in current code | Classification |
|---|---|---|
| `username`, `email`, `password`, `role`, `studentNumber` | Account lookup and portal routing. | Frontend-only or mock functionality |
| `firstName`, `lastName`, `email`, `phone`, `city`, `country`, `timezone`, `address`, `avatar`, `notifications` | Student profile rendering/editing and preference behavior. | Stored only in localStorage |
| `no`, `name`, `program`, `year`, `status`, `dept`, `admission`, `dob`, `email`, `mobile`, `city` | Registrar search/profile, registration and department scope. | Stored only in localStorage |
| Application identity/status/timestamps/remarks and enrollment step/draft/selected codes | Application timeline, review and wizard progression. | Stored only in localStorage |
| `classId`, `course`, `section`, `faculty`, `day`, `start`, `end`, `room`, `capacity`, `size`, `modality`, `type` | Role-specific offering view, class validation and conflict detection. | Stored only in localStorage |
| Assessment IDs/type/max/weight/date and student score map | Weighted percentage and equivalent-grade calculations. | Stored only in localStorage |
| Grade sheet key/status/note/actor/time and student final grade/status | Faculty-to-Department-Head-to-Registrar steps and student visibility. | Stored only in localStorage |
| Meeting status/date, mark, time-in/out, remarks, recorded time | Attendance submission, reporting and alerts. | Stored only in localStorage |
| Audit actor/module/entity/record/action/description/status/previous/next/IP | Browser audit display and exports. | Frontend-only or mock functionality |
| `mfa`, lockout counters, expiration, password policy, reset attempts | Prototype login restrictions and account settings. | Requires backend implementation |

## 20. Possible database entities implied by the current code

| Entity concept | Evidence/status | Classification |
|---|---|---|
| `persons` | Approved canonical identity/contact owner, but not present in implementation. | Planned but not implemented |
| `users`, `roles`, `permissions`, `role_permissions` | Login/account, singular role, and editable permission concepts. Need server authority and approved `users.role_id` rather than V1 `user_roles`. | Requires database persistence |
| `students`, `staff` | Distinct workflows and profile attributes exist, but no normalized records or shared person FKs. | Requires database persistence |
| `departments`, `programs`, `courses`, `academic_terms`, `rooms`, `course_sections` | Local catalog and offering data. | Requires database persistence |
| `admission_applications`, `student_term_enrollments`, `class_enrollments` | Separate application, Registrar verification and course/section selection concepts. | Requires database persistence |
| `student_documents`, `student_document_requests`, `profile_correction_requests` | Current student and Registrar UI workflows. Private file content should be stored outside the relational database with metadata/reference persisted. | Requires database persistence |
| `class_meetings`, `attendance_records`, attendance alert configuration | Current staff meeting/mark workflows; aggregate student rates should remain derived unless policy requires snapshots. | Requires database persistence |
| `assessments`, `assessment_scores`, grade-sheet/review state and official student results | Required to represent current faculty input, review and published results separately. | Requires database persistence |
| `audit_logs` | UI claims audit trails, but trusted actors/time/IP and append-only behavior require server implementation. | Requires backend implementation |
| `password_reset_requests`, lockout/account-security state | Needed only if those account features remain in V1; must be implemented server-side. | Conditional |
| `user_preferences` | Profile/settings preferences exist but storage scope (person versus account) is unresolved. | Unclear and requiring team review |
| `guardians`, `emergency_contacts` | Current form controls, but entities are explicitly postponed in the approved V1 decision. | Planned but not implemented |
| Backup history, monitoring events, notifications, report archive | Current screens are sample/simulated; separate persistence is not justified by working services. | Planned but not implemented |

## 21. Logic or workflows that still rely on localStorage

All student profile edits, correction requests, admissions, enrollment
progress, registry changes, documents, grades, attendance detail, staff
accounts, role permissions, settings, lockout/reset state, audit-shaped
records, and report history rely on browser storage or module state. The reset
demo inbox uses `sessionStorage`. There are no API calls to synchronize these
flows between users or devices. Some local writes are caught and ignored when
storage is unavailable; the UI may therefore show an apparent action without
durable persistence.

**Classification:** Stored only in localStorage.

## 22. Features that require backend implementation

| Feature | Work needed | Classification |
|---|---|---|
| Login/session | Server-side account lookup, secure password KDF, login throttling/lockout, authenticated session lifecycle and server-side role checks. | Requires backend implementation |
| Password recovery | Send codes/tokens privately, store only hashes, enforce expiry/attempt/resend policy and audit server actions. | Requires backend implementation |
| Authorization | Use one approved role per account and enforce permission/scope rules on every protected API request. | Requires backend implementation |
| Domain writes | Validate state transitions, relationship consistency, unit/capacity limits, duplicate enrollment and grade rules transactionally. | Requires backend implementation |
| Files | Validate uploads server-side, write to private storage, persist metadata and enforce download access. | Requires backend implementation |
| Audit/operations | Derive actor/time/provenance on the server; replace simulated monitoring/backup behavior with real services if retained. | Requires backend implementation |
| Browser integration | Replace each local-store read/write with authenticated API requests and surface loading/errors; reconcile simultaneous updates. | Requires backend implementation |

## 23. Features that require database persistence

If included in Version 1, durable records are needed for identity/accounts,
student/staff profiles, catalog and terms, offerings/schedules, applications,
term and class enrollment, documents/requests, corrections, attendance
meetings/marks, assessments/scores, official grades, roles/permissions and
trusted audit events. Password-reset/lockout records depend on the approved
security scope. Preferences and alert configuration require an ownership and
retention decision. Simulated backups, monitoring data and report archives
should not be persisted merely because sample screens exist.

**Classification:** Requires database persistence.

## 24. Features that are currently only visual or mock functionality

| Feature | Limitation | Classification |
|---|---|---|
| Demo credentials and sample records | Fixed browser data, not institution accounts or authoritative records. | Frontend-only or mock functionality |
| Reset email inbox | Displays the reset code to the same browser; no email is sent. | Frontend-only or mock functionality |
| MFA | Account flag only; no challenge, factor enrollment or verification. | Frontend-only or mock functionality |
| Backup/restore | Buttons update simulated history; no backup job or restore is performed. | Frontend-only or mock functionality |
| Monitoring | Metrics are generated in JavaScript; they do not measure a server/database. | Frontend-only or mock functionality |
| Audit provenance | Seeded IPs and browser-generated actor/action fields are not trusted evidence. | Frontend-only or mock functionality |
| Student attendance display | Derived from a static sample rather than staff meeting records. | Frontend-only or mock functionality |
| Document upload | Browser validation/preview exists; no durable protected file storage. | Implemented but incomplete |
| Reports | CSV/print works against sample/local data, not a server query or durable report archive. | Frontend-only or mock functionality |
| Wizard completion | Marks the application `enrolled` locally but does not create the corresponding registry student/class roster records. | Implemented but incomplete |

## 25. Current inconsistencies or bugs affecting the database design

| Finding | Why it matters | Classification |
|---|---|---|
| Staff account creation/editing changes `db.users`, but authentication identities are built from the fixed `accounts.js` list. A newly created account is not automatically a valid login. | Account persistence, account provisioning and authentication must use one authoritative users source. | Implemented but incomplete |
| User/account fields are duplicated among `accounts.js`, staff `db.users`, student registry and student profile stores. No shared identity key connects them. | Confirms that shared `persons` and one-account-per-person need backend mapping; the code itself does not prove that schema. | Requires schema change |
| Hardcoded `CAPS` controls staff capabilities while a separate permission matrix is editable. | An editable permission change may not alter actual access; schema must not treat the browser matrix as enforced policy. | Implemented but incomplete |
| The student enrollment wizard records `enrolled` and selected offerings but does not create the registry student or class-enrollment/roster records. | Application acceptance, term enrollment and section enrollment must be separate, linked transactions. | Implemented but incomplete |
| Staff grade assessments/scores and grade-sheet workflow are separate from `data.js` official student grades; posting the staff sheet does not itself reconcile the student grade value. | Need a defined authoritative grade record and posting transaction before designing grade foreign keys. | Implemented but incomplete |
| Faculty attendance rows, `data.js` attendance aggregates and the student attendance timeline are separate sample sources. | Do not treat aggregate attendance fields as authoritative records; agree on one detail source and derive summaries. | Implemented but incomplete |
| Registrar creates a pending term enrollment on registration, while student self-enrollment has a different application wizard; the two flows do not join. | Define how applicant acceptance/conversion produces student and term-enrollment rows. | Unclear and requiring team review |
| Field requiredness/ownership varies by form: for example, student profile email is required, Registrar registration personal email is optional, wizard date of birth/mobile/address are required. | Decide canonical `persons` fields, validation and nullable rules; do not infer database `NOT NULL` from one UI. | Unclear and requiring team review |
| Status capitalization and names differ between portals and schema drafts. | Persist normalized codes and map UI labels consistently. | Requires backend implementation |
| Profile, registry, account and application data may contain inconsistent copies of the same person's name/contact details. | Apply approved `persons` ownership and determine whether application snapshots are needed. | Requires schema change |
| Save helpers can silently swallow browser-storage errors. | Current UI success is not proof of persistence; API migration should expose failure states. | Requires backend implementation |

## 26. Recommended corrections to the existing planning documents

Do not edit the existing files as part of this reassessment. For a later
planning-document revision:

1. Treat the approved `persons`/single-account/single-role decision as
   resolved V1 policy while clearly stating that current code has no person
   links or `users.role_id`.
2. Replace any remaining V1 recommendation for `user_roles` with
   `users.role_id`; keep the multi-role design as a possible later revision,
   not an implicit V1 feature.
3. Keep `guardians` and `emergency_contacts` explicitly postponed despite the
   current Registrar inputs. Record that persistence and future UX need a
   later decision.
4. Update the implementation inventory to distinguish the three enrollment
   flows and the disconnected applicant conversion, term-registration and
   course-selection data.
5. Document the account-creation/login source mismatch and specify one
   authoritative account source for the future backend.
6. Document that staff assessments/scores, Registrar grade sheets and
   student-visible final results are currently separate stores; do not claim
   that a posted staff sheet automatically updates official student results.
7. Distinguish the three attendance representations and make staff meeting
   rows the source candidate only after team confirmation; derive student
   summaries rather than persisting duplicate aggregates.
8. Reconcile all code statuses (including `withdrawn`, `Returned`,
   `Left Early`, `Pending Activation`, and enrollment states) with normalized
   database codes and transition rules.
9. Mark MFA, email reset delivery, backup, monitoring, report retention and
   notification delivery as mock/conditional until their service requirements
   are approved.
10. Keep the 48-table design and root 24-table schema labeled as drafts. The
    root schema's `user_roles`, `student_accounts`, missing `persons`/`staff`,
    conflated `enrollments`, and incomplete grade/attendance states conflict
    with current code or approved identity policy.
11. State explicitly which term dates, address/email ownership, applicant
    snapshots, dual student/staff profiles and academic grading rules require
    approval before migration design.

## 27. Final summary of what the current code actually requires from the database

The current frontend does not connect to a database. It implies a future
backend-backed model for people, accounts, student/staff profiles, academic
catalog, applications, separate term and class enrollments, documents,
correction requests, attendance meetings/marks, assessments/scores, posted
grades, permissions and trusted audit actions. These are persistence
requirements only if their workflows remain in Version 1; the code is sample
evidence, not independent product approval.

The approved shared `persons` model and `users.role_id` are design decisions,
not structures implemented by the latest code. The current account data uses
role strings and duplicated identity objects. One role per user is still
consistent with the interface; multi-role tables are not required by current
behavior. Guardians and emergency contacts remain postponed. Operational
backup/monitoring, MFA challenges, reset email delivery, durable report
archives, notification delivery and other simulated services should not drive
Version 1 tables without explicit approval.

## Files and verification

### Current application files inspected

- HTML: `index.html`, `demo-tools.html`.
- JavaScript: `accounts.js`, `auth.js`, `data.js`, `registrar.js`,
  `registry.js`, `script.js`, `staff.js`.
- CSS: `style.css`, `reports.css`, `registrar.css`, `staff.css`.

### Planning/schema files inspected

- `database/design/v1-decisions-latest.md`
- `database/design/v1-scope-reconciliation-v2.md`
- `database/design/v1-implementation-alignment.md`
- `database/design/decision-01-identity-ownership.md`
- `database/design/BITS-SIMS_Database_Design.md`
- `database.schema.sql`
- `database/migrations/001_initial_schema.sql`
- `Hostinger school database.session.sql`
- `database/README.md` and root `README.md` for project context

### Inspection outcome

- Latest workspace inspected: **Yes**, including all current HTML/JS/CSS
  files found in the workspace and recent Git history.
- Current source version: **`062ce13`**, with no tracked working-tree edits.
- Application files changed: **No**.
- Existing schema/migration/planning files changed: **No**.
- New report created: **`database/design/current-code-reassessment.md`**.
- Database-changing SQL generated or executed: **No**.
- Hostinger database accessed or modified: **No**.
