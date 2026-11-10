# Version 1 Identity Migration Readiness Review — V3

**Review date:** November 10, 2026  
**Target stated for review:** MariaDB 11.8.9, database
`u659680966_bitssims_dev`; the user reports the current baseline is empty.  
**Status:** Static compatibility review only. The migration was not executed
and no database connection was made.

## Executive conclusion

The migration uses conventional MariaDB 11.8.9-compatible `CREATE TABLE`
syntax and appears structurally compatible with an empty MariaDB 11.8.9
database. All seven tables use InnoDB, `utf8mb4_unicode_ci`, `BIGINT
UNSIGNED AUTO_INCREMENT` primary keys, and dependency-ordered foreign keys.
The approved identity and username decisions are reflected.

**Manual-execution readiness: conditionally ready, subject to the team’s
separate execution approval and use of the stated empty target database.**
This report is not permission to execute the migration. Compatibility was
assessed statically; no MariaDB parser/server validation was performed.

No structural error was found, so the migration was not modified.

## Sources compared

- [`../migrations/001_identity_foundation.sql`](../migrations/001_identity_foundation.sql)
- [`decision-01-identity-ownership.md`](./decision-01-identity-ownership.md)
- [`decision-02-login-identifier.md`](./decision-02-login-identifier.md)
- [`backend-identity-and-api-contract.md`](./backend-identity-and-api-contract.md)
- [`identity-migration-readiness-v2.md`](./identity-migration-readiness-v2.md)

The current frontend remains a browser prototype and does not yet implement
these relational identity records. The older comprehensive design is a draft;
its `INT` keys, `user_roles`, password-reset and contact entities do not
supersede the approved Version 1 decisions.

## MariaDB 11.8.9 compatibility checklist

| Check | Result | Notes |
|---|---|---|
| MariaDB 11.8.9 syntax | Pass by static review | Conventional `CREATE TABLE`, key, constraint, engine, charset, and collation clauses; not run through a MariaDB server/parser. |
| `BIGINT UNSIGNED` primary keys | Pass | Each table has one numeric surrogate PK of this type. |
| `BIGINT UNSIGNED` foreign keys | Pass | All FK columns match the referenced `BIGINT UNSIGNED` PKs. |
| InnoDB compatibility | Pass | All seven tables specify `ENGINE=InnoDB`. |
| `utf8mb4_unicode_ci` | Pass | Explicitly declared for each table and supported by MariaDB. |
| `AUTO_INCREMENT` | Pass | One `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT` primary key per table. |
| FK creation order | Pass | Referenced tables precede tables that reference them. |
| FK indexes | Pass | Each FK has a direct index or is the leftmost column of a unique index. |
| Unique constraints | Pass | No duplicate or contradictory unique constraints found. |
| Required/null fields | Pass against approved decisions | Optional personal email and profile details remain nullable; required identity links and username are `NOT NULL`. |
| Username case-insensitivity | Pass | The users table uses `utf8mb4_unicode_ci`; its unique username index is case-insensitive. |
| Username normalization comments | Pass | Migration documents lowercase account creation, trim/lowercase login, and allowed characters; implementation rules are specified in the backend contract. |
| Naming and reserved words | Pass by static review | Identifiers are clear snake_case names; no obvious MariaDB reserved-word collision was found. |
| FK actions | Pass | `ON UPDATE CASCADE` is valid; deletes use `RESTRICT` for identity links and `CASCADE` for role-permission associations. |
| Duplicate constraints/indexes | Pass | Constraint/index names are distinct in their tables; unique pair constraint and supporting reverse FK index are purposeful. |
| Unsupported/risky syntax | None found | No dynamic SQL, procedural blocks, vendor-specific functions, or unsupported table options. |
| Empty-database failure risk | None apparent | Tables are not conditional on pre-existing objects; dependencies exist before each FK is declared. This assumes the user-provided empty baseline. |
| Destructive statements | Pass | No `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, or `INSERT` statements. |
| Email-login logic | Pass | No login email field or email-login logic. |
| `user_roles` | Pass | Not present. |
| Guardians/emergency contacts | Pass | Not present. |

## Table and relationship review

Creation order:

1. `persons`
2. `roles`
3. `permissions`
4. `role_permissions`
5. `users`
6. `students`
7. `staff`

Primary keys:

- `persons.person_id`
- `roles.role_id`
- `permissions.permission_id`
- `role_permissions.role_permission_id`
- `users.user_id`
- `students.student_id`
- `staff.staff_id`

All primary keys are `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT`.

Foreign keys and supporting indexes:

- `role_permissions.role_id` → `roles.role_id`; leftmost in
  `uq_role_permissions_role_permission`.
- `role_permissions.permission_id` → `permissions.permission_id`;
  `ix_role_permissions_permission_id` and the unique pair index.
- `users.person_id` → `persons.person_id`; unique index
  `uq_users_person_id`.
- `users.role_id` → `roles.role_id`; index `ix_users_role_id`.
- `students.person_id` → `persons.person_id`; unique index
  `uq_students_person_id`.
- `staff.person_id` → `persons.person_id`; unique index
  `uq_staff_person_id`.

All referenced primary keys are defined before dependent tables, and all
foreign-key types and signedness match.

## Unique constraints and field nullability

Unique constraints:

- `roles.role_code`
- `permissions.permission_code`
- `(role_permissions.role_id, role_permissions.permission_id)`
- `users.person_id` (one account per person)
- `users.username` (required, unique V1 login identifier)
- `students.person_id`
- `students.student_number`
- `staff.person_id`
- `staff.employee_number`

`persons.personal_email` is nullable and has only a non-unique index.
`users` has no email/login field. This matches the approved username-only
login decision.

Required fields include person first/last name; role code/name; permission
code; role-permission FKs; user person/role/username/account status; student
person/student number/status; and staff person. Optional fields include
middle name, birth date, contact/address values, descriptions, password hash,
student year/admission type, and staff employment attributes. No mismatch
with the approved identity or login decisions was found.

## Username policy and collation

- Account creation must trim surrounding whitespace, lowercase the username,
  then accept only `a-z`, `0-9`, `_`, `.`, and `-`.
- Login must trim and lowercase the submitted username and validate the same
  allowed character set before lookup.
- Password verification remains separate and unchanged by username
  normalization.
- `utf8mb4_unicode_ci` is case-insensitive, so the database unique constraint
  and lookups are case-insensitive. The approved ASCII-only username
  validation excludes accented characters from usernames; display names and
  personal information remain Unicode-capable.
- The SQL does not independently enforce the username character set.
  Enforcement is specified at the application/API boundary. Ensure every
  account creation and username update path uses that validation.

## Blocking issues and future decisions

**Blocking issues found in the SQL:** None, assuming the target is empty as
reported and the migration receives separate execution approval.

**Non-blocking implementation/operational cautions:**

- Run a local syntax/behavior validation against MariaDB 11.8.9 before a
  shared deployment; this review did not execute SQL.
- Keep all application write paths aligned with the username trim/lowercase
  and character-validation rules. Direct SQL writers would otherwise be able
  to store usernames outside that policy.
- Confirm target database name and empty baseline immediately before any
  separately approved execution; they were not verified in this review.
- Later work still needs canonical status values, permission assignments,
  dual student/staff profile policy, catalog relationships, activation and
  password lifecycle implementation, and any approved preferences/reset
  schema. These do not make the current identity-only DDL syntactically
  invalid.

## Final status and database activity

- MariaDB 11.8.9 syntax compatibility: **Appears compatible by static
  inspection; not server-validated.**
- Migration ready for manual execution: **Conditionally ready**, provided
  the target is confirmed empty and execution is separately authorized.
- Migration changed by this review: **No**.
- `identity-migration-readiness-v3.md` created: **Yes**.
- SQL executed: **No**.
- Hostinger connected to, accessed, or modified: **No**.
