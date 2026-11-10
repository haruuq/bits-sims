# Decision 02: Login Identifier

**Status:** Approved for Version 1  
**Approval date:** November 10, 2026

## Approved Team Decision

- Users log in with `username` and password.
- `username` is the only login identifier for Version 1 and must be unique.
- `persons.personal_email` is optional contact information, not a login
  identifier, and must not have a `UNIQUE` constraint in Version 1.
- Email-based login and a separate email-login flow are postponed to a later
  phase.
- A person is not required to have an email address.

### Affected tables and fields

- `users.username`: required, unique Version 1 login identifier.
- `users.password_hash`: credential verifier used with the username; never
  store a plaintext password.
- `persons.personal_email`: optional, non-unique contact information.
- No separate email-login field or flow is included in Version 1.

### Postponed

- Email-based login, including use of personal, institutional, or work email
  as an authentication identifier.
- Any separate email-login flow.

## Approved Username Case Decision

- Usernames are case-insensitive for login.
- Normalize usernames to lowercase when accounts are created.
- Trim login input and normalize it to lowercase before comparison.
- Affected field: `users.username`.
- `users.username` remains the required, unique Version 1 login identifier.
- `persons.personal_email` remains optional contact information and is not
  used for login.
- Email-based login remains postponed.
- Password behavior is unchanged by this decision.

## Approved Username Character Policy

- Usernames may contain only lowercase letters `a-z`, numbers `0-9`,
  underscore (`_`), period (`.`), and hyphen (`-`).
- Account creation trims surrounding whitespace and normalizes usernames to
  lowercase before storage.
- Login trims surrounding whitespace and normalizes the submitted username
  to lowercase before lookup.
- Reject spaces, accented letters, and all other unsupported characters.
- Username uniqueness and login lookup are case-insensitive.
- `users.username` remains the only Version 1 login identifier.
- `persons.personal_email` is optional contact information, not a login
  identifier. Email-based login remains postponed.
- These username normalization rules do not change password handling.
