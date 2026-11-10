# Decision 01: Identity and Contact Ownership

**Status:** Identity ownership is approved for Version 1; field-level details
remain subject to the questions below. This is not migration approval.
No database was queried or changed, and no SQL was generated or executed.

## 1. Evidence from the current code

The application is a browser-side prototype, not a relational identity model.
`accounts.js`, `registry.js`, `script.js`, and `registrar.js` keep overlapping
records in separate browser objects and storage keys. There are no implemented
foreign keys or shared `persons` records.

| Evidence | What it shows | Ownership implication |
|---|---|---|
| `accounts.js` defines each login with `username`, `email`, `password`, `name`, and one `role`. Staff demo accounts also have `title`, `dept`, `employeeNo`, `hired`, and `contact`; the student demo account has `studentNumber`. | A login account is distinct in concept from an academic or employment record, but the prototype combines their values in one object. | Do not make a role or profile the authentication account. |
| `registry.js` keeps student rows identified by `no` and containing a display `name`, `program`, `year`, `status`, `dept`, `admission`, `email`, `mobile`, and `city`. | Student academic/registration data is separate from the demo login data. | A student record is a student-role profile, not a second login. The code currently has no relation joining it to a user. |
| `script.js` stores a student profile with `firstName`, `lastName`, `email`, `personalEmail`, `phone`, `city`, `country`, `address`, and `avatar`; it also stores `emailVisibility`, `timezone`, and notification flags for admissions, grades, documents, and announcements. | The portal profile overlaps account and registry contact values while also containing user-specific preferences. | Separate authoritative identity/contact values from authentication and preferences. |
| The profile-edit flow submits name changes for approval, but directly updates the profile email and other fields in local storage. | Name corrections and ordinary contact/preference edits do not share the same workflow. | Keep correction requests separate from preferences; agree which email/name is authoritative before syncing. |
| `staff.js` and shared demo accounts use staff login identities and employee metadata; staff are not represented as a normalized staff table in the current code. | Staff account and staff employment fields are bundled in the prototype. | Store staff-only employment attributes separately from login credentials. |
| `registrar.js` dynamically renders registration inputs for guardian name/number and emergency-contact name/number, saves those values on student rows, and displays them in the Guardian Information profile tab. | The current registrar workflow collects one guardian and one emergency contact, but has no reusable-contact or multiple-contact model. | These are current code fields, but the approved Version 1 decision postpones separate guardian/emergency-contact entities. Revisit persistence and relationships in a later phase; do not silently duplicate them as student columns. |
| `script.js` admission objects store application id, program, type, term, dates/status, remarks, and optional `studentId`; they do not contain a separate applicant name/email/contact object. New application submission uses the signed-in portal context. | The application is a process record, not an independent person model in the current workflow. | Link an application to the existing person identity rather than copying names/contact into every application. |
| Demo accounts and student roster/profile data duplicate Dawson's name, email, phone, and student number across stores. | The prototype can drift because it has no canonical identity owner. | A shared identity row would reduce duplicated personal data, but requires backend/API mapping. |

These are observed prototype fields and flows, not a claim that every demo value
is authoritative or should be migrated.

## 2. Evidence from the database design and existing SQL

### Previous 48-table design

`BITS-SIMS_Database_Design.md` proposes:

- `persons` with `first_name`, `middle_name`, `last_name`, `suffix`,
  `preferred_name`, birth/demographic fields, `personal_email`,
  `mobile_number`, and `alternate_number`.
- `students.person_id` and `staff.person_id`, each unique, with student- or
  employment-specific fields in their respective tables.
- `users.person_id` as nullable and unique, plus login email, username,
  password and account/security fields. This allows a user without a person,
  and at most one user linked to a given person.
- A many-to-many `user_roles` table, with optional department scope.
- `admission_applications.person_id` and optional `student_id`, expressing
  applicant identity separately from a converted/associated student.
- Separate `guardians` and `emergency_contacts` tables with repeated names,
  phones, addresses, and relationship details, each directly tied to a student.
- No `user_preferences` table. Some profile/contact fields are placed on
  `persons` and some on `students`.

The design is explicitly a draft. Its one-person-to-one-student and
one-person-to-one-staff constraints are design choices, not behaviors proven
by the current prototype.

### Root `database.schema.sql` draft

The unapproved root SQL takes a different approach:

- `users` stores `full_name`, `email`, `mobile`, and `office` with credentials.
- `students` repeats first/middle/last name and contact details, includes
  student address/email/avatar fields, and places one guardian and one
  emergency contact directly on the student row.
- `student_accounts` links one student number to one user.
- `user_roles` still permits multiple roles per user.
- `admissions_applications` repeats applicant first/middle/last name, email,
  and mobile, and optionally links a student.
- It has no `persons` or staff-profile table.

This draft reduces joins, but repeats identity/contact data and does not model
staff employment separately. It is not approved.

### Other existing SQL files

`database/migrations/001_initial_schema.sql` contains only placeholder
comments. `Hostinger school database.session.sql` contains a `SHOW TABLES;`
statement without results. Neither establishes an existing identity schema.

## 3. Design options

| Option | Model | Advantages | Disadvantages |
|---|---|---|---|
| A. Flat identity fields on role/account rows | Keep names/contact on `users` and repeat what is needed on `students`, `staff`, and applications, similar to the root SQL draft. | Few joins; straightforward to map from current local objects. | Personal data can diverge; student-only account linkage is special-cased; no shared person for a person who is both student and staff; applicant snapshots can become accidental duplicates; staff profile remains incomplete unless separately added. |
| B. Shared `persons` plus role profiles and a login account | Store canonical human identity/contact once in `persons`; let `students`, `staff`, and applications reference it; let `users` reference it for authentication. Keep preferences separate. | One place to correct personal identity/contact; student/staff can be profiles of the same person; applicants can exist before a student account/profile; less duplicated PII. | More joins and backend mapping; the code has no person identifiers today; field ownership and account/person cardinality must be deliberately constrained. |
| C. Separate student and staff profiles, but do not add `persons` | Keep `students` and `staff` distinct and connect each directly to `users` where applicable. | Simpler than a shared-identity model and separates academic/employment fields from credentials. | A person with student and staff records has duplicate names/contact; applicant and contact relationships still lack a common identity target. |

## 4. Recommended Version 1 design

Choose **Option B**, with the following conservative cardinalities:

1. **`persons` represents a real human being.** It owns canonical name and
   personal contact/profile fields that are approved for collection.
2. **`users` represents a login account.** It owns authentication identifiers,
   password hash, account status, and authentication/security state. A user
   references one person; for Version 1, enforce at most one user per person.
   Do not copy a person's name or personal phone into `users`.
3. **`students` and `staff` represent distinct academic/employment profiles,**
   not login accounts and not separate people. Each references one person.
   A person may have both profiles if the institution permits it; the current
   code neither demonstrates nor forbids that case.
4. **Use one role per user for Version 1.** The current account data uses one
   role property per login and the current interface does not demonstrate
   multiple role assignment. Put the role on `users` (or use an equivalent
   single-role relation). Do not add `user_roles` unless the team approves
   multiple or department-scoped roles. A role is authorization, not a student
   or staff profile.
5. **An applicant is a person in an application workflow, not another person
   table.** An application should reference `persons`; it can link to a
   `students` row when one exists. Do not copy applicant names and contact
   details into each application unless immutable submission snapshots are
   explicitly required.
6. **Do not create a separate `student_profiles` table for current fields.**
   Put academic identity/status in `students`, canonical human identity/contact
   in `persons`, and account-specific display/notification choices in
   `user_preferences`.
7. **Postpone guardian/emergency-contact tables from Version 1.** The current
   registrar form collects one guardian and one emergency contact, but has no
   reusable-contact or multiple-contact model. If the team brings them into a
   later phase, represent contacts as people and use a
   student-to-contact relation carrying relationship, contact purpose
   (guardian/emergency), and primary-contact flags. This avoids separate
   duplicate name/phone/address stores and supports a contact shared by
   siblings. Do not require guardians to have login accounts.

This is the simplest recommended model that prevents duplicate personal
identity fields while preserving distinct account, student, and staff
responsibilities. It is somewhat more relational than the root SQL draft but
avoids synchronizing multiple copies of names and contact data.

## 5. Name, email, phone, address, and profile field ownership

| Field class | Recommended owner | Mapping / qualification |
|---|---|---|
| Legal/current first, middle, last name; preferred name if approved | `persons` | The code uses full/display names, first name, and last name, but does not consistently split names. `registrar.js` builds `Last, First Middle`; `script.js` holds `firstName` and `lastName`, with the given-name field containing multiple words. Agree on name components and display formatting before migration. Corrections should update the canonical person only through the approved correction workflow. |
| Personal email and personal phone | `persons` | The profile contains `personalEmail` and `phone`; registry/account objects repeat email/phone. Define whether each value is personal or institutional. Avoid storing the same value independently on `persons`, `students`, and `users`. |
| Login username and login email | `users` | These are authentication identifiers and may differ from personal contact email. Do not assume the student institutional email and login email are always the same without team approval. |
| Institutional student email | `students` only if distinct from login email | Current account/registry/profile samples use an institutional-looking email, but do not define its ownership or whether it can differ from login email. If it is the user's login email, avoid a second copy; if it is an academic contact address, retain it as a student field. |
| Staff work email and work phone | `staff` only if distinct from login email/personal contact | Staff demo accounts have email/contact, but there is no distinct code field proving that account email is always work email. Name the fields by purpose and do not duplicate identical values. |
| Current address, city, country | `persons` as contact/profile data, if retained | The student portal exposes these; the prior design places some address fields on `students`. Decide whether the address is a person's general contact address or an academic-only address. Do not add province/barangay/postal fields solely because the draft contains them. |
| Student number, program, department, year, admission type, student status | `students` | These identify the academic profile and should not be copied to `users` except as a supported login alias/lookup. |
| Employee number, job title, department, hire date, employment status | `staff` | These describe an employment profile, not the person or login. Current demo code uses employee number, title, department, and hire date; validate status and official department relationships. |
| Avatar/profile image reference | A profile field associated with the person or user, selected by team | The code stores an avatar URL in the student profile; the drafts call this `profile_picture` or `avatar_url`. Store a controlled asset key/URL, not image bytes in ordinary identity columns. Decide whether the image follows a person or a specific account. |
| Email visibility, timezone, notification flags | `user_preferences` | These are per-account display/notification choices, not official student or person contact attributes. The previous 48-table design and root SQL draft do not provide this table. Persist only if preferences must follow the user across devices. |
| Guardian/emergency name and contact | Postponed; if approved, contact-person rows plus a student-contact relation | Current write code references `gname`, `gnum`, `ename`, and `enum`, but matching controls are absent. The design draft's repeated contact/address fields are not evidence that all are required. |
| Birth date | `persons` if approved for identity use | Registrar code reads `f_dob`; the design draft places DOB in `persons`, while root SQL places it in `students`. Confirm collection purpose and ownership; do not duplicate it. |

## 6. Tables and relationships affected

Recommended conceptual relationships (not SQL):

- `users.person_id -> persons.person_id`, unique for the Version 1 one-account-
  per-person rule.
- `students.person_id -> persons.person_id`, unique per student profile.
- `staff.person_id -> persons.person_id`, unique per staff profile.
- `users.role_id -> roles.role_id` for the Version 1 single-role rule. If
  multiple or scoped roles are approved, use `user_roles` instead and define
  scope/assignment rules.
- `admission_applications.person_id -> persons.person_id`; optional
  `student_id`/student-profile link only after the person has a student record.
- `user_preferences.user_id -> users.user_id`, one preferences row per account
  if persisted.
- If approved later, `student_contacts.student_id -> students` and
  `student_contacts.person_id -> persons`, with relationship/contact-purpose
  fields on the association.

This replaces the root draft's `student_accounts` special case with a single
`users.person_id` relation usable for both student and staff accounts.
Applications, admissions, and registry code will need backend/API mapping;
these relationships are not implemented in the browser prototype.

## 7. Fields used, proposed-but-unused, and conflicts

### Used or read by the current code

- **Account:** `username`, `email`, password/demo credential, singular `role`,
  display `name`; student login lookup also accepts `studentNumber`.
- **Student:** student number, display name, program, department, year, status,
  admission type, email, mobile, city; registrar write path additionally reads
  DOB and guardian/emergency name/phone values.
- **Staff:** display name, email, username, role, employee number, title,
  department, hire date, contact.
- **Portal profile/preferences:** first name, last name, institutional-looking
  email, personal email, phone, city, country, address, avatar, email
  visibility, timezone, and notification flags.
- **Application:** application id, program, type, term, submission/review/
  decision data, status, remarks, and optional student id. Current application
  objects do not hold applicant names/contact fields.

These values are spread across prototype objects; they do not prove that the
same field has the same meaning in each store.

### Previous-design fields not evidenced as current identity requirements

The 48-table design includes `persons.middle_name`, `suffix`,
`preferred_name`, gender, nationality, civil status, place of birth,
alternate number, and timestamps. The current code's middle-name handling is
inconsistent, and it does not use the other listed demographic fields as
profile inputs. The design's student `barangay`, `province`, and `postal_code`,
staff work email/work contact/employment status, and guardian relationship,
address, primary/emergency flags are likewise not fully represented by active
forms. Do not require these fields in Version 1 without approval.

### Current-code fields/behavior not represented cleanly by the previous design

- `user_preferences` fields: email visibility, timezone, notification flags,
  and account/profile-specific choices.
- The current avatar/address/city/country/phone profile ownership is not
  resolved by the design: some contact fields are on `persons`, others on
  `students`, while there is no preference/profile model.
- The code uses one role per demo account, while the design's `user_roles`
  allows many.
- Code has a distinct student-number login alias and a separate student
  registry; neither `persons` nor `student_accounts` is actually wired up.
- Guardian/emergency values are read by registrar code and the current
  Registrar form has one name/number pair for each; the design models richer,
  separate contact tables.

### Naming and relationship conflicts

| Conflict | Sources | Resolution recommended |
|---|---|---|
| `users.full_name` versus `persons.first_name`/`last_name` versus student display `name` | Root SQL; previous design; current `accounts.js`, `registry.js`, `script.js` | One canonical name in `persons`; construct display forms in the application. Do not retain duplicate `full_name` copies. |
| Student account relation | Root SQL `student_accounts`; previous design `users.person_id`; current code has only student-number lookup and separate storage | Use `users.person_id`; resolve student profile through `students.person_id`. Do not keep both relations unless a real additional account type requires it. |
| Single role versus `user_roles` | Current `accounts.js`; both SQL drafts; Approved Team Decision | Use the approved single `users.role_id` in Version 1. Student/staff profile is not itself a permission role. |
| Student personal/contact fields versus person fields | Root SQL puts names/contact/address in `students`; previous design splits them across `persons` and `students` | Canonical person-owned contact fields in `persons`; student academic identifiers/state in `students`; institutional email only on `students` if it differs from account email. |
| Applicant identity | Root SQL repeats applicant name/email/mobile; previous design references `persons` and optional `students`; current app has no applicant identity payload | Link application to `persons`; do not store repeated applicant fields unless an immutable snapshot is approved. |
| Guardian/emergency contacts | Root SQL has one inline set on `students`; previous design has two separate related tables; Registrar code collects one name/phone pair each | Postpone the entities in Version 1 as approved. If reconsidered in a later phase, use person contacts with a student-contact association rather than duplicated contact rows/columns. |
| Avatar and preferences | Root SQL has `avatar_url`; previous design has `profile_picture` on students but no preferences table; code has avatar and user-specific settings in one profile object | Keep image reference and preferences out of authentication credentials; decide whether avatar belongs to person or account. |

## 8. Questions requiring team approval

1. **Resolved for Version 1:** one login account per person. Could a later
   phase need multiple accounts per person?
2. Can a person simultaneously have student and staff profiles? The approved
   one-account/one-role rule remains; the dual-profile case still needs policy.
3. **Resolved for Version 1:** one role per user via `users.role_id`. Are role
   permissions global, department-scoped, or both, and which permission
   representation is authoritative?
4. Which email is the login identifier, which is personal contact, and which
   is institutional/work contact? Can any be the same value?
5. Are names and contact details authoritative on the person record? Should
   approved student name changes update the same person row used by accounts,
   applications, and staff records?
6. Is address a person-wide contact address or a student-only academic
   address? Which location fields are actually required?
7. Should avatar and preferences follow a person across accounts, or belong to
   one login account? Must preferences persist across devices?
8. **Resolved for Version 1:** guardians and emergency contacts are
   postponed. If considered for a later phase, should contacts be reusable
   across students and serve both purposes?
9. Must admissions retain a submitted-name/contact snapshot, or should the
   application always display the current `persons` record?
10. Is date of birth required? If retained, the approved shared identity model
    places it on `persons`.

## 9. Final recommendation

For Version 1, use one shared `persons` row as the canonical record for a real
individual; separate `users` for credentials and one role; separate `students`
and `staff` for academic and employment attributes; and a `user_preferences`
row only for preferences the team wants persisted across devices. Link users,
students, and staff to the shared person with one-to-one constraints per
profile type. Allow a person to hold both student and staff profiles only if
institutional policy permits it. Treat applicants as persons linked to
applications, not as a second identity table. The one-account-per-person and
one-role-per-user rules, including `users.role_id`, are approved for V1.

Do not duplicate names, personal email, phone, or address in `users`,
`students`, `staff`, and applications. Keep login email separate from personal
contact email, and keep institutional/work addresses on role profiles only
when they are distinct. Use `users.role_id` for the approved single role; do not use `user_roles` in
Version 1. Revisit only if requirements change.

Postpone `guardians` and `emergency_contacts` for Version 1, as approved, even
though the current Registrar form collects one contact of each type. Preserve
them as possible future-phase entities. If reconsidered later, model contacts
as people and link them to students through a relation carrying relationship
and contact-purpose fields. Do not add demographic or address fields just
because they appear in the draft design.

This recommendation requires a backend identity model and frontend mapping:
the current browser stores do not share canonical identity IDs. Before any
migration is designed, resolve the remaining name/email ownership, dual
student/staff profile, permission-scope, and preference questions above.

## Approved Team Decision

**Approval date:** November 10, 2026

The team approved the following Version 1 identity and contact decisions:

- Use a shared `persons` table for identity and contact information.
- Link `users`, `students`, and `staff` to `persons`.
- Allow one user account per person in Version 1.
- Allow one role per user in Version 1; store it as `users.role_id`.
- Do not use a `user_roles` junction table in Version 1 unless the current
  application requirements clearly change to require multiple roles.
- Postpone `guardians` and `emergency_contacts` from Version 1. They remain
  possible future-phase entities and are not permanently rejected.
- These decisions apply to Version 1 only and may be revisited if requirements
  change.

**Affected tables:** `persons`, `users`, `students`, `staff`, `roles`, and
`permissions`.

**Postponed entities:** `guardians` and `emergency_contacts`.

This approval resolves the corresponding identity-cardinality and role-
multiplicity questions above for Version 1. Other field ownership details
(including which email is a login identifier versus a contact address, and
which person fields are required) remain subject to the questions in section 8.
