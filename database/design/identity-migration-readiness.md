# Version 1 Identity Migration Readiness Review

**Review date:** November 10, 2026  
**Status:** Review only. The migration has not been executed and is not
approved for deployment by this report.

## Review scope

Reviewed the identity migration and the requested planning sources:

- [`../migrations/001_identity_foundation.sql`](../migrations/001_identity_foundation.sql)
- [`decision-01-identity-ownership.md`](./decision-01-identity-ownership.md)
- [`decision-02-login-identifier.md`](./decision-02-login-identifier.md)
- [`backend-identity-and-api-contract.md`](./backend-identity-and-api-contract.md)
- [`v1-gap-resolution-plan.md`](./v1-gap-resolution-plan.md)
- [`v1-implementation-alignment.md`](./v1-implementation-alignment.md)
- [`current-code-reassessment.md`](./current-code-reassessment.md)
- [`BITS-SIMS_Database_Design.md`](./BITS-SIMS_Database_Design.md)

The current frontend evidence describes a browser prototype with separate
demo accounts, student registry/profile data, and staff account data. It does
not implement the shared relational identity relationships. The design
documents are planning references; the two approved team decisions take
precedence over earlier drafts and current prototype behavior.

No database connection was made. This is a static review of SQL text, not a
server-side parse or test against a particular MySQL/MariaDB version.

## Readiness conclusion

**The migration is structurally consistent with the approved identity and
login decisions, but it is not ready for execution.**

Blocking items before execution:

1. The migration is explicitly marked review-only and says to wait for
   approval of its assumptions and review of the target database baseline.
   Neither execution approval nor baseline verification is established by
   this review.
2. The backend contract still contains superseded email-login language in
   its identity section (see “Planning-document inconsistencies”). Reconcile
   that contract text with approved Decision 02 before implementing against
   it.
3. The username column inherits `utf8mb4_unicode_ci`. This is
   case-insensitive, but also has accent/Unicode equivalences beyond simple
   lowercase normalization. The allowed username character set and whether
   those equivalences are intended are not specified. Decide this before
   relying on the database unique constraint and application lookup for all
   possible usernames.

No clear structural error was found in the migration, so it was not changed.

## Approved-decision verification

| Requirement | Result | Evidence |
|---|---|---|
| Shared `persons` table | Pass | `persons` is created first and owns name/contact fields. |
| `users.person_id` | Pass | Required `BIGINT UNSIGNED` FK to `persons`; unique. |
| `students.person_id` | Pass | Required `BIGINT UNSIGNED` FK to `persons`; unique. |
| `staff.person_id` | Pass | Required `BIGINT UNSIGNED` FK to `persons`; unique. |
| `users.role_id` | Pass | Required FK to `roles`; no user-role junction. |
| At most one user per person | Pass | `UNIQUE (person_id)` on `users`. |
| One role per user | Pass | Required scalar `users.role_id`. |
| No `user_roles` | Pass | Table is absent. |
| Username-only V1 login | Pass in migration | `users.username` is the only login field; no email field in `users`. |
| Username required and unique | Pass | `username VARCHAR(80) NOT NULL` and one unique key. |
| Case-insensitive username | Pass with qualification | `users` uses `utf8mb4_unicode_ci`; this collation is case-insensitive. |
| Lowercase application normalization | Documented | Migration comments require lowercase creation and trimmed/lowercase login lookup; backend contract auth section also specifies normalization. |
| Email not used for login | Pass in migration | No user login-email field or email-login logic. |
| Optional, non-unique personal email | Pass | `persons.personal_email` is nullable; only a non-unique index exists. |
| `BIGINT UNSIGNED` primary/foreign keys | Pass | Every table has a `BIGINT UNSIGNED AUTO_INCREMENT` surrogate primary key; each FK column matches its referenced key. |
| InnoDB | Pass | All seven tables declare `ENGINE=InnoDB`. |
| Foreign-key indexes | Pass | Every FK is indexed by a direct, unique, or leftmost composite index. |
| Dependency order | Pass | `persons`, `roles`, `permissions`, `role_permissions`, `users`, `students`, `staff`. |
| No guardians/emergency contacts | Pass | Neither table nor fields are present. |
| No destructive SQL | Pass | No `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, or other data-changing statement is present. |

## Tables, fields, and constraints

| Table | Primary key | Fields and notable constraints |
|---|---|---|
| `persons` | `person_id BIGINT UNSIGNED AUTO_INCREMENT` | Required `first_name`, `last_name`; optional `middle_name`, `date_of_birth`, `personal_email`, `mobile_number`, `address`, `city`, `country`; timestamps. Non-unique name and personal-email indexes. |
| `roles` | `role_id BIGINT UNSIGNED AUTO_INCREMENT` | Required `role_code`, `role_name`; optional description; unique `role_code`; timestamps. |
| `permissions` | `permission_id BIGINT UNSIGNED AUTO_INCREMENT` | Required unique `permission_code`; optional description. |
| `role_permissions` | `role_permission_id BIGINT UNSIGNED AUTO_INCREMENT` | Required `role_id`, `permission_id`; unique role/permission pair; both are FKs. |
| `users` | `user_id BIGINT UNSIGNED AUTO_INCREMENT` | Required `person_id`, `role_id`, `username`; nullable `password_hash`; required status and timestamps. Unique `person_id` and `username`; FKs to `persons` and `roles`. |
| `students` | `student_id BIGINT UNSIGNED AUTO_INCREMENT` | Required `person_id`, `student_number`, `student_status`; optional year and admission type. Unique `person_id` and student number; FK to `persons`. |
| `staff` | `staff_id BIGINT UNSIGNED AUTO_INCREMENT` | Required `person_id`; optional employee number, position, hire date and employment status. Unique `person_id` and employee number; FK to `persons`. |

Foreign-key relationships:

- `role_permissions.role_id` → `roles.role_id`
- `role_permissions.permission_id` → `permissions.permission_id`
- `users.person_id` → `persons.person_id`
- `users.role_id` → `roles.role_id`
- `students.person_id` → `persons.person_id`
- `staff.person_id` → `persons.person_id`

The `role_permissions` surrogate key plus its unique pair constraint is
consistent with the approved all-surrogate-primary-key decision. It does not
allow duplicate role/permission assignments.

## Structural review

- **Primary keys:** one per table; all are numeric `BIGINT UNSIGNED
  AUTO_INCREMENT`.
- **Foreign keys:** all columns are `BIGINT UNSIGNED`; all point to existing,
  previously created primary keys of the same type.
- **Indexes:** `users.person_id` and each student/staff `person_id` are
  indexed by unique constraints. `users.role_id` has a direct index.
  `role_permissions.role_id` is the leftmost column of its unique pair index;
  `permission_id` has a direct index. All profile FKs have unique indexes.
- **Unique constraints:** role code; permission code; role/permission pair;
  one user per person; username; one student/staff profile per person;
  student number; employee number. No unique constraint exists on
  `persons.personal_email`.
- **Nullability:** names, username, role/person links, student number, and
  account/student status fields are required. Contact fields, middle name,
  birth date, student year/admission type, staff attributes, descriptions,
  and `users.password_hash` are nullable. These choices do not violate the
  approved identity decisions.
- **Creation order:** each referenced table exists before its FK is declared.
- **Syntax:** statements use conventional MySQL/MariaDB `CREATE TABLE`,
  InnoDB, `AUTO_INCREMENT`, timestamp defaults, indexes and FK actions.
  Syntax was inspected statically only; it was not parsed or run on a server.
- **Collation:** every table explicitly uses `utf8mb4_unicode_ci`. This
  supports case-insensitive username uniqueness/lookups but may equate some
  accent variants too. The username character-set/equivalence policy needs
  resolution; if exact behavior is required, consider a username-column
  collation or character restriction rather than changing the whole database.
- **No unnecessary identity tables:** `password_reset_requests` and
  `user_preferences` are absent; neither is required by the approved
  identity-foundation scope. Seed data, `user_roles`, guardians, and
  emergency contacts are also absent.

## Planning-document inconsistencies and non-blocking decisions

### Contract text to reconcile

`backend-identity-and-api-contract.md` §5 still says login email may be stored
on `users` and that username/email uniqueness and case rules require approval.
That conflicts with approved Decision 02, which selects username-only login
and postpones email login. The contract's authentication flow and endpoint
tables have already been updated, but this stale section should be reconciled
before implementation.

`v1-gap-resolution-plan.md` and `decision-01-identity-ownership.md` contain
earlier references to “username/login email” and open questions about which
email is a login identifier. Treat those passages as superseded for V1 by
Decision 02; personal/work/institutional email field ownership as contact
information can still need separate policy.

### Non-blocking decisions for this identity-only draft

- Define the accepted username characters and whether Unicode accent
  equivalence from `utf8mb4_unicode_ci` is intentional. Application
  lowercasing handles case normalization, but does not itself specify accent
  normalization.
- Confirm whether nullable `password_hash` is the intended representation for
  pending activation. Backend authentication must reject accounts without a
  password hash.
- Approve canonical account and employment status values; these columns are
  extensible strings to avoid inventing a status enum.
- Confirm retention/purpose for optional date of birth and person address
  fields. Existing forms use some of these values, but the code alone does
  not establish institutional retention requirements.
- Confirm whether the non-unique `ix_persons_personal_email` index is needed
  for supported contact lookup. It is not a uniqueness constraint and does
  not make email a login identifier.
- Define the permission catalog and assignments before using the empty
  `roles`/`permissions` tables; the migration intentionally inserts no seed
  data.
- Review the target database's existing tables, collation/version, backup,
  and migration procedure before any execution.

The older comprehensive design is a draft and includes `INT UNSIGNED`,
`user_roles`, email-related account fields, reset requests, guardians and
emergency contacts. Those portions are superseded or postponed for this
Version 1 identity migration and are not included.

## Final table list

`persons`, `roles`, `permissions`, `role_permissions`, `users`, `students`,
`staff`.

## Execution and database activity

- Migration readiness: **Not ready for execution** until execution approval,
  target baseline review, stale contract language reconciliation, and
  username collation/character policy review are complete.
- Migration modified during this review: **No**.
- SQL executed: **No**.
- Hostinger accessed or modified: **No**.
