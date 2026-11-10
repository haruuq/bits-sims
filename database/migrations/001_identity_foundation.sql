-- Version 1 identity foundation migration draft.
-- REVIEW ONLY: do not execute until the assumptions and open decisions below
-- are approved by the project team and the target database baseline is reviewed.
--
-- Scope: persons, roles, permissions, role_permissions, users, students, staff.
-- No seed data, reset-request table, preferences table, or guardian/contact
-- tables are included. Password reset and preferences are later/conditional
-- work; guardians and emergency contacts are postponed.
--
-- Approved key decision: every internal primary key and its referencing
-- foreign keys use BIGINT UNSIGNED. Numeric surrogate keys use AUTO_INCREMENT.
--
-- Approved login identifier decision: users.username is the only Version 1
-- login identifier and is unique. persons.personal_email is optional contact
-- information, is not used for login, and has no UNIQUE constraint. Email
-- login and a separate email-login flow are postponed.
--
-- Approved username policy: account creation trims and lowercases usernames;
-- login trims and lowercases input before lookup. The application must reject
-- characters outside lowercase a-z, 0-9, underscore, period, and hyphen
-- after normalization. Password handling is separate from username handling.
-- The users table uses utf8mb4_unicode_ci, a case-insensitive collation, so
-- the username unique constraint also compares case-insensitively. Keep
-- application normalization/validation and database uniqueness aligned.
--
-- Other assumptions: account rows may exist before activation, so
-- password_hash is nullable and must be set before password authentication;
-- account_status is an extensible string because the prototype uses multiple
-- states and the canonical status vocabulary is not approved.
--
-- Department/program catalogs are outside this identity-only migration.
-- Their foreign keys and student/staff catalog fields must be designed with
-- the later academic catalog migration rather than invented here.
--
-- No sample/demo accounts or permission assignments are inserted.

CREATE TABLE persons (
  person_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NULL,
  personal_email VARCHAR(254) NULL,
  mobile_number VARCHAR(32) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  country VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (person_id),
  KEY ix_persons_name (last_name, first_name),
  KEY ix_persons_personal_email (personal_email)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
  role_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_code VARCHAR(32) NOT NULL,
  role_name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roles_role_code (role_code)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
  permission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  permission_code VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  PRIMARY KEY (permission_id),
  UNIQUE KEY uq_permissions_permission_code (permission_code)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
  role_permission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_permission_id),
  UNIQUE KEY uq_role_permissions_role_permission (role_id, permission_id),
  KEY ix_role_permissions_permission_id (permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles (role_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (permission_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  person_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NULL,
  account_status VARCHAR(32) NOT NULL DEFAULT 'pending_activation',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_person_id (person_id),
  UNIQUE KEY uq_users_username (username),
  KEY ix_users_role_id (role_id),
  KEY ix_users_account_status (account_status),
  CONSTRAINT fk_users_person
    FOREIGN KEY (person_id) REFERENCES persons (person_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles (role_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  student_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  person_id BIGINT UNSIGNED NOT NULL,
  student_number VARCHAR(32) NOT NULL,
  year_level VARCHAR(16) NULL,
  admission_type VARCHAR(32) NULL,
  student_status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id),
  UNIQUE KEY uq_students_person_id (person_id),
  UNIQUE KEY uq_students_student_number (student_number),
  KEY ix_students_status (student_status),
  CONSTRAINT fk_students_person
    FOREIGN KEY (person_id) REFERENCES persons (person_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

CREATE TABLE staff (
  staff_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  person_id BIGINT UNSIGNED NOT NULL,
  employee_number VARCHAR(30) NULL,
  position_title VARCHAR(100) NULL,
  date_hired DATE NULL,
  employment_status VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id),
  UNIQUE KEY uq_staff_person_id (person_id),
  UNIQUE KEY uq_staff_employee_number (employee_number),
  KEY ix_staff_employment_status (employment_status),
  CONSTRAINT fk_staff_person
    FOREIGN KEY (person_id) REFERENCES persons (person_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
