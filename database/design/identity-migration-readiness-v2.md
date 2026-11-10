# Version 1 Identity Migration Readiness Review — V2

**Review date:** November 10, 2026  
**Status:** Static review only. The migration is not approved for execution.

## Scope and evidence

Reviewed:

- [`../migrations/001_identity_foundation.sql`](../migrations/001_identity_foundation.sql)
- [`decision-01-identity-ownership.md`](./decision-01-identity-ownership.md)
- [`decision-02-login-identifier.md`](./decision-02-login-identifier.md)
- [`backend-identity-and-api-contract.md`](./backend-identity-and-api-contract.md)
- [`v1-gap-resolution-plan.md`](./v1-gap-resolution-plan.md)
- [`v1-implementation-alignment.md`](./v1-implementation-alignment.md)
- [`current-code-reassessment.md`](./current-code-reassessment.md)
- [`BITS-SIMS_Database_Design.md`](./BITS-SIMS_Database_Design.md)

The current application evidence is a browser prototype: its account,
student, and staff data are not yet joined by canonical `person_id` values.
The approved team decisions take precedence over older design drafts and
prototype behavior. The comprehensive design remains a draft, not approval
for its complete schema.

The migration was reviewed as text. No SQL parser or MySQL/MariaDB server was
used. SQLTools was not actively available in this session, so the requested
read-only `SHOW TABLES;` baseline check **could not be performed**.

## Overall conclusion

**The migration matches the approved identity and username decisions, but is
not ready for execution.**

Blocking execution items:

1. The migration remains explicitly review-only. Separate execution approval
   and a verified target database baseline are still required.
2. The target database baseline is unknown because `SHOW TABLES;` was
   unavailable. Confirm the target schema is empty or plan a safe,
   non-conflicting migration after an authorized read-only baseline review.
3. The SQL was only statically inspected; validate syntax and behavior against
   the selected MySQL/MariaDB version and collation in a disposable local
   database before any shared/development deployment.

The approved username character policy removes the earlier ambiguity about
accented and non-ASCII usernames. No unresolved case-sensitivity decision
remains for the approved ASCII username set. The migration was not modified
for this review; its comments already document the new character policy.

## Approved decision checklist

| # | Requirement | Result | Review evidence |
|---:|---|---|---|
| 1 | Shared `persons` table | Pass | `persons` is created and owns names/contact information. |
| 2 | `users.person_id` | Pass | Required `BIGINT UNSIGNED` FK; unique. |
| 3 | `students.person_id` | Pass | Required `BIGINT UNSIGNED` FK; unique. |
| 4 | `staff.person_id` | Pass | Required `BIGINT UNSIGNED` FK; unique. |
| 5 | `users.role_id` | Pass | Required FK to `roles.role_id`. |
| 6 | One user account per person | Pass | `UNIQUE (users.person_id)`. |
| 7 | One role per user | Pass | Required scalar `users.role_id`. |
| 8 | No `user_roles` | Pass | No such table is created. |
| 9 | Username-only Version 1 login | Pass | `users.username` is the only login identifier represented. |
| 10 | Username required and unique | Pass | `VARCHAR(80) NOT NULL`, with exactly one unique constraint. |
| 11 | Username case-insensitive | Pass | `users` uses `utf8mb4_unicode_ci`; its unique index inherits this collation. |
| 12 | Lowercase application normalization | Pass, documented | Contract and migration comments require trim/lowercase normalization at creation and login. |
| 13 | Email not used for login | Pass | No `users` email/login field or email alias is included. |
| 14 | Optional, non-unique `persons.personal_email` | Pass | Nullable column with only a non-unique index. |
| 15 | BIGINT key consistency | Pass | All PKs and FK columns are `BIGINT UNSIGNED`; numeric surrogate PKs use `AUTO_INCREMENT`. |
| 16 | InnoDB tables | Pass | All seven tables specify InnoDB. |
| 17 | Indexed foreign keys | Pass | Every FK is covered by a direct, unique, or leftmost composite index. |
| 18 | Dependency creation order | Pass | Referenced tables are created before their dependents. |
| 19 | No guardians/emergency contacts | Pass | Neither tables nor fields are present. |
| 20 | No destructive/data-changing SQL | Pass | No `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, or `INSERT` statements. |
| 21 | Username character restriction | Pass in application contract | Account creation and lookup must reject anything outside `[a-z0-9_.-]` after normalization. |
| 22 | Password independent of username normalization | Pass, documented | Contract treats password verification separately; password behavior is unchanged. |

## Table inventory and structure

Creation order and primary keys:

| Order | Table | Primary key (`BIGINT UNSIGNED AUTO_INCREMENT`) |
|---:|---|---|
| 1 | `persons` | `person_id` |
| 2 | `roles` | `role_id` |
| 3 | `permissions` | `permission_id` |
| 4 | `role_permissions` | `role_permission_id` |
| 5 | `users` | `user_id` |
| 6 | `students` | `student_id` |
| 7 | `staff` | `staff_id` |

Foreign-key relationships and indexes:

- `role_permissions.role_id` → `roles.role_id`: indexed as the first column
  of `uq_role_permissions_role_permission`.
- `role_permissions.permission_id` → `permissions.permission_id`: indexed
  by `ix_role_permissions_permission_id` and the unique pair.
- `users.person_id` → `persons.person_id`: indexed by
  `uq_users_person_id`.
- `users.role_id` → `roles.role_id`: indexed by `ix_users_role_id`.
- `students.person_id` → `persons.person_id`: indexed by
  `uq_students_person_id`.
- `staff.person_id` → `persons.person_id`: indexed by `uq_staff_person_id`.

The referenced columns exist as primary keys before each dependent table is
created, and each referencing key has matching `BIGINT UNSIGNED` type and
signedness.

## Unique constraints

- `roles.role_code`
- `permissions.permission_code`
- `(role_permissions.role_id, role_permissions.permission_id)`
- `users.person_id` — at most one account for each person
- `users.username` — sole unique V1 login identifier
- `students.person_id`
- `students.student_number`
- `staff.person_id`
- `staff.employee_number`

There is no unique constraint on `persons.personal_email`. Its optional
non-unique index does not make email an identifier.

## Required and nullable fields

- Required core fields include person first/last name; role code/name;
  permission code; role-permission references; user person/role/username and
  account status; student person/student number/status; and staff person.
- Nullable fields include person middle name, date of birth, personal email,
  phone and address/location; descriptions; user password hash; student year
  and admission type; and staff employee number, position, hire date and
  employment status.
- `users.password_hash` being nullable is documented as supporting
  pending-activation accounts. The backend must reject password login until
  a valid hash is set.
- `staff.employee_number` is nullable but unique when present; MySQL/MariaDB
  permit multiple `NULL` values in a unique index.
- Optional email is consistent with the decision that every person need not
  provide an email address.

No requiredness conflict with the approved identity/login decisions was
found. Business owners should still approve the nullable DOB/address and
profile fields before deployment.

## Username and collation review

- Account creation: trim surrounding whitespace, lowercase the value, then
  reject it unless it contains only lowercase ASCII letters `a-z`, digits
  `0-9`, underscore, period, and hyphen.
- Login: trim and lowercase submitted username, validate the same character
  set, and perform a case-insensitive username lookup.
- Password handling is separate; username normalization must not alter the
  password.
- The `users` table explicitly declares `utf8mb4_unicode_ci`, which compares
  username values case-insensitively. Under the approved ASCII-only username
  restriction, accented characters are rejected by the application before
  persistence or lookup. The general display-name and personal-information
  columns remain Unicode-capable.
- The migration does not add a database `CHECK` constraint for the allowed
  username characters. The contract requires backend validation on every
  account creation and username-change path. Consider database-level
  validation only after confirming the deployed MySQL/MariaDB version and
  enforcing equivalent validation in all write paths.

## Syntax, scope, and conflict review

- Statements use conventional MySQL/MariaDB `CREATE TABLE`, InnoDB,
  `AUTO_INCREMENT`, timestamp defaults, indexes, and FK actions.
- All tables use `utf8mb4_unicode_ci`; `users.username` is therefore
  case-insensitive, consistent with the approved policy.
- No email-login field or logic is in the migration. Email-based login and
  student-number login aliases are postponed.
- `user_roles`, `guardians`, and `emergency_contacts` are absent.
- `password_reset_requests` and `user_preferences` are absent; neither is
  included in the approved identity-foundation scope for this draft.
- No seed data, credentials, or destructive/data-changing SQL is present.
- The older comprehensive design differs in key types, supports `user_roles`,
  and contains reset/contact tables. Those are not grounds to restore those
  items to this approved Version 1 identity scope.
- Current code does not yet implement these relational identities; backend
  and frontend mapping remain later implementation work.

## Remaining non-blocking decisions

These are not conflicts with the approved identity/username rules, but need
resolution before related functionality or later schema phases:

- Account, student, and employment status vocabularies; pending-activation
  lifecycle and password-hash requiredness after activation.
- Permission-code catalog and role-permission assignments; no seed data is
  included.
- Whether a person may simultaneously have student and staff profiles.
- Department/program references and whether employee numbers are required.
- Whether the optional personal-email lookup index is needed.
- Password reset, sessions, activation delivery, audit retention, and
  preferences are later-phase design/implementation decisions.
- Username length has a database maximum of 80 characters; the contract
  should retain an aligned input length limit when validation is implemented.

## Baseline and final status

- `SHOW TABLES;`: **Could not be performed**; no active SQLTools connection
  was available.
- Migration structure changed for this review: **No**.
- Migration execution approval: **Not established**.
- Readiness for execution: **Not ready** until authorized execution approval,
  target baseline review, and local/version-specific SQL validation are
  complete.
- SQL executed: **No**.
- Hostinger accessed or modified: **No**.
