# BITS-SIMS Database Design and SQL Migration (Draft)

**Review status:** Draft only. Review with the project team and the institution before running against any database. The SQL was not executed.

## A. Proposed database design summary

The design is a normalized relational schema for the BITS-SIMS Student Information Management System. It keeps shared identity (`persons`) separate from student (`students`), staff (`staff`), and login (`users`) records. Access control uses role-based access control (RBAC) through `user_roles` and `role_permissions`. Academic delivery is separated into catalogue courses, term-specific class offerings, overall student term enrollment, individual class enrollment, attendance sessions/records, assessment scores, and official student grades.

The migration creates **48 tables**: the PDF inventory tables, the separately field-defined `password_reset_requests` table, and the optional `course_prerequisites` junction table. It uses `INT UNSIGNED AUTO_INCREMENT` identifiers, `InnoDB`, `utf8mb4`, foreign keys, unique constraints, and indexes. This key strategy is an implementation choice because the PDF allows `INT / UUID` and does not select one.

### Source coverage and non-table items

- The database inventory contains the core data entities; the migration also includes `password_reset_requests`, which has its own field catalogue in the authentication section but is not repeated in the inventory.
- `course_prerequisites` is included as an optional self-referencing many-to-many table suggested in the Courses section.
- The optional separate Profile-control record (`ProfileID`, `LastProfileUpdate`, `LastUpdatedBy`, `ProfileCompletionStatus`, `ProfileVerificationStatus`) is not created. Those fields are marked optional in the PDF and the underlying person/student profile is already held in `persons` and `students`.
- Login form controls, report filter controls, and dashboard metrics are not independent entities. Report filter values are stored as JSON snapshots on generated report/history rows.
- Derived values such as age, full name, current class size, total registered units, attendance percentage, weighted percentage, GPA/CGPA, and dashboard counts should be computed from source records or cached with an explicit invalidation policy; they are not duplicated as routine stored columns.

## B. Table-by-table schema specification

**Required/optional legend:** “Required” means the draft column is `NOT NULL`; “Optional” means `NULL` is allowed. The PDF generally describes recommended fields and generic types but does not formally specify column nullability. Therefore these labels are draft implementation decisions, not assertions that the PDF makes every field mandatory.
**Type note:** SQL types below are the selected MySQL/MariaDB types, not always a verbatim type from the PDF. For example, the PDF permits `INT / UUID`; this migration chooses integer auto-increment keys and matching foreign keys.

### `persons`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `person_id` | `INT UNSIGNED` | Required |
| `first_name` | `VARCHAR(100)` | Required |
| `middle_name` | `VARCHAR(100)` | Optional |
| `last_name` | `VARCHAR(100)` | Required |
| `suffix` | `VARCHAR(20)` | Optional |
| `preferred_name` | `VARCHAR(100)` | Optional |
| `date_of_birth` | `DATE` | Optional |
| `gender` | `VARCHAR(30)` | Optional |
| `nationality` | `VARCHAR(100)` | Optional |
| `civil_status` | `VARCHAR(30)` | Optional |
| `place_of_birth` | `VARCHAR(150)` | Optional |
| `personal_email` | `VARCHAR(255)` | Optional |
| `mobile_number` | `VARCHAR(30)` | Optional |
| `alternate_number` | `VARCHAR(30)` | Optional |
| `created_at` | `DATETIME` | Required |
| `updated_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (person_id)`
- `KEY idx_persons_last_name (last_name)`
- `KEY idx_persons_personal_email (personal_email)`

### `departments`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `department_id` | `INT UNSIGNED` | Required |
| `department_code` | `VARCHAR(20)` | Required |
| `department_name` | `VARCHAR(150)` | Required |
| `department_description` | `TEXT` | Optional |
| `department_head_staff_id` | `INT UNSIGNED` | Optional |
| `department_email` | `VARCHAR(255)` | Optional |
| `contact_number` | `VARCHAR(30)` | Optional |
| `office_location` | `VARCHAR(100)` | Optional |
| `department_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (department_id)`
- `UNIQUE KEY uq_departments_code (department_code)`
- `KEY idx_departments_head (department_head_staff_id)`
- `KEY idx_departments_status (department_status)`

### `programs`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `program_id` | `INT UNSIGNED` | Required |
| `department_id` | `INT UNSIGNED` | Required |
| `program_code` | `VARCHAR(30)` | Required |
| `program_name` | `VARCHAR(150)` | Required |
| `program_description` | `TEXT` | Optional |
| `degree_level` | `VARCHAR(30)` | Optional |
| `program_duration_years` | `DECIMAL(3,1)` | Optional |
| `program_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (program_id)`
- `UNIQUE KEY uq_programs_code (program_code)`
- `KEY idx_programs_department (department_id)`
- `CONSTRAINT fk_programs_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `staff`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `staff_id` | `INT UNSIGNED` | Required |
| `person_id` | `INT UNSIGNED` | Required |
| `employee_number` | `VARCHAR(30)` | Optional |
| `department_id` | `INT UNSIGNED` | Optional |
| `position_title` | `VARCHAR(100)` | Optional |
| `employment_status` | `VARCHAR(30)` | Optional |
| `work_email` | `VARCHAR(255)` | Optional |
| `work_contact_number` | `VARCHAR(30)` | Optional |
| `date_hired` | `DATE` | Optional |
| `created_at` | `DATETIME` | Required |
| `updated_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (staff_id)`
- `UNIQUE KEY uq_staff_person (person_id)`
- `UNIQUE KEY uq_staff_employee_number (employee_number)`
- `KEY idx_staff_department (department_id)`
- `CONSTRAINT fk_staff_person FOREIGN KEY (person_id) REFERENCES persons (person_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_staff_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `academic_terms`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `academic_term_id` | `INT UNSIGNED` | Required |
| `academic_year` | `VARCHAR(20)` | Required |
| `semester` | `VARCHAR(30)` | Required |
| `start_date` | `DATE` | Required |
| `end_date` | `DATE` | Required |
| `enrollment_start_date` | `DATE` | Optional |
| `enrollment_end_date` | `DATE` | Optional |
| `term_status` | `VARCHAR(20)` | Required |
| `is_current_term` | `BOOLEAN` | Required |

**Keys and indexes**
- `PRIMARY KEY (academic_term_id)`
- `UNIQUE KEY uq_academic_terms_year_semester (academic_year, semester)`
- `KEY idx_academic_terms_status (term_status)`
- `KEY idx_academic_terms_current (is_current_term)`

### `courses`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `course_id` | `INT UNSIGNED` | Required |
| `course_code` | `VARCHAR(30)` | Required |
| `course_name` | `VARCHAR(150)` | Required |
| `course_description` | `TEXT` | Optional |
| `department_id` | `INT UNSIGNED` | Required |
| `units` | `DECIMAL(4,2)` | Required |
| `lecture_hours` | `DECIMAL(4,2)` | Optional |
| `laboratory_hours` | `DECIMAL(4,2)` | Optional |
| `course_type` | `VARCHAR(30)` | Optional |
| `is_active` | `BOOLEAN` | Required |
| `course_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (course_id)`
- `UNIQUE KEY uq_courses_code (course_code)`
- `KEY idx_courses_department (department_id)`
- `KEY idx_courses_status (course_status)`
- `CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `course_prerequisites`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `course_prerequisite_id` | `INT UNSIGNED` | Required |
| `course_id` | `INT UNSIGNED` | Required |
| `prerequisite_course_id` | `INT UNSIGNED` | Required |
| `minimum_grade` | `VARCHAR(20)` | Optional |
| `requirement_type` | `VARCHAR(30)` | Optional |

**Keys and indexes**
- `PRIMARY KEY (course_prerequisite_id)`
- `UNIQUE KEY uq_course_prerequisite_pair (course_id, prerequisite_course_id)`
- `KEY idx_course_prerequisites_prerequisite (prerequisite_course_id)`
- `CONSTRAINT fk_course_prerequisites_course FOREIGN KEY (course_id) REFERENCES courses (course_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_course_prerequisites_required_course FOREIGN KEY (prerequisite_course_id) REFERENCES courses (course_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `students`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `student_id` | `INT UNSIGNED` | Required |
| `person_id` | `INT UNSIGNED` | Required |
| `student_number` | `VARCHAR(30)` | Required |
| `institutional_email` | `VARCHAR(255)` | Optional |
| `profile_picture` | `VARCHAR(500)` | Optional |
| `address_line` | `VARCHAR(255)` | Optional |
| `barangay` | `VARCHAR(100)` | Optional |
| `city` | `VARCHAR(100)` | Optional |
| `province` | `VARCHAR(100)` | Optional |
| `postal_code` | `VARCHAR(10)` | Optional |
| `country` | `VARCHAR(100)` | Optional |
| `student_status` | `VARCHAR(30)` | Required |
| `admission_date` | `DATE` | Optional |
| `admission_type` | `VARCHAR(30)` | Optional |
| `department_id` | `INT UNSIGNED` | Optional |
| `program_id` | `INT UNSIGNED` | Optional |
| `current_year_level` | `VARCHAR(20)` | Optional |
| `created_at` | `DATETIME` | Required |
| `updated_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (student_id)`
- `UNIQUE KEY uq_students_person (person_id)`
- `UNIQUE KEY uq_students_student_number (student_number)`
- `KEY idx_students_department (department_id)`
- `KEY idx_students_program (program_id)`
- `KEY idx_students_status (student_status)`
- `CONSTRAINT fk_students_person FOREIGN KEY (person_id) REFERENCES persons (person_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_students_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_students_program FOREIGN KEY (program_id) REFERENCES programs (program_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `users`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `user_id` | `INT UNSIGNED` | Required |
| `person_id` | `INT UNSIGNED` | Optional |
| `username` | `VARCHAR(100)` | Required |
| `email` | `VARCHAR(255)` | Required |
| `password_hash` | `VARCHAR(255)` | Required |
| `account_status` | `VARCHAR(30)` | Required |
| `email_verified` | `BOOLEAN` | Required |
| `mfa_enabled` | `BOOLEAN` | Required |
| `failed_login_attempts` | `INT UNSIGNED` | Required |
| `lockout_until` | `DATETIME` | Optional |
| `last_login_at` | `DATETIME` | Optional |
| `password_changed_at` | `DATETIME` | Optional |
| `must_change_password` | `BOOLEAN` | Required |
| `created_at` | `DATETIME` | Required |
| `created_by` | `INT UNSIGNED` | Optional |
| `updated_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (user_id)`
- `UNIQUE KEY uq_users_person (person_id)`
- `UNIQUE KEY uq_users_username (username)`
- `UNIQUE KEY uq_users_email (email)`
- `KEY idx_users_account_status (account_status)`
- `CONSTRAINT fk_users_person FOREIGN KEY (person_id) REFERENCES persons (person_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `roles`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `role_id` | `INT UNSIGNED` | Required |
| `role_name` | `VARCHAR(100)` | Required |
| `role_code` | `VARCHAR(30)` | Required |
| `role_description` | `TEXT` | Optional |
| `role_level` | `INT` | Optional |
| `role_status` | `VARCHAR(20)` | Required |
| `created_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (role_id)`
- `UNIQUE KEY uq_roles_role_code (role_code)`
- `KEY idx_roles_status (role_status)`

### `permissions`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `permission_id` | `INT UNSIGNED` | Required |
| `permission_name` | `VARCHAR(100)` | Required |
| `permission_code` | `VARCHAR(100)` | Required |
| `module_name` | `VARCHAR(100)` | Required |
| `action_type` | `VARCHAR(30)` | Required |
| `permission_description` | `TEXT` | Optional |

**Keys and indexes**
- `PRIMARY KEY (permission_id)`
- `UNIQUE KEY uq_permissions_code (permission_code)`
- `KEY idx_permissions_module_action (module_name, action_type)`

### `user_roles`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `user_role_id` | `INT UNSIGNED` | Required |
| `user_id` | `INT UNSIGNED` | Required |
| `role_id` | `INT UNSIGNED` | Required |
| `department_id` | `INT UNSIGNED` | Optional |
| `effective_from` | `DATE` | Optional |
| `effective_until` | `DATE` | Optional |
| `assigned_at` | `DATETIME` | Required |
| `assigned_by` | `INT UNSIGNED` | Optional |
| `assignment_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (user_role_id)`
- `UNIQUE KEY uq_user_roles_assignment (user_id, role_id, department_id, effective_from)`
- `KEY idx_user_roles_role (role_id)`
- `KEY idx_user_roles_department (department_id)`
- `KEY idx_user_roles_status_dates (assignment_status, effective_from, effective_until)`
- `CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_user_roles_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `role_permissions`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `role_permission_id` | `INT UNSIGNED` | Required |
| `role_id` | `INT UNSIGNED` | Required |
| `permission_id` | `INT UNSIGNED` | Required |
| `granted_at` | `DATETIME` | Required |
| `granted_by` | `INT UNSIGNED` | Optional |

**Keys and indexes**
- `PRIMARY KEY (role_permission_id)`
- `UNIQUE KEY uq_role_permissions_pair (role_id, permission_id)`
- `KEY idx_role_permissions_permission (permission_id)`
- `CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (permission_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_role_permissions_granted_by FOREIGN KEY (granted_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `password_reset_requests`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `reset_id` | `INT UNSIGNED` | Required |
| `user_id` | `INT UNSIGNED` | Required |
| `reset_token_hash` | `VARCHAR(255)` | Required |
| `request_date` | `DATETIME` | Required |
| `expiration_date` | `DATETIME` | Required |
| `is_used` | `BOOLEAN` | Required |
| `date_used` | `DATETIME` | Optional |

**Keys and indexes**
- `PRIMARY KEY (reset_id)`
- `UNIQUE KEY uq_password_reset_token_hash (reset_token_hash)`
- `KEY idx_password_reset_user_expiry (user_id, expiration_date)`
- `CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `admission_applications`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `application_id` | `INT UNSIGNED` | Required |
| `application_number` | `VARCHAR(30)` | Required |
| `person_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Optional |
| `application_date` | `DATE` | Required |
| `admission_type` | `VARCHAR(30)` | Required |
| `applied_program_id` | `INT UNSIGNED` | Required |
| `intended_academic_term_id` | `INT UNSIGNED` | Optional |
| `application_status` | `VARCHAR(30)` | Required |
| `admission_decision_date` | `DATE` | Optional |
| `verified_by` | `INT UNSIGNED` | Optional |
| `verification_date` | `DATETIME` | Optional |
| `admission_remarks` | `TEXT` | Optional |

**Keys and indexes**
- `PRIMARY KEY (application_id)`
- `UNIQUE KEY uq_admission_applications_number (application_number)`
- `KEY idx_admission_applications_person (person_id)`
- `KEY idx_admission_applications_student (student_id)`
- `KEY idx_admission_applications_program (applied_program_id)`
- `KEY idx_admission_applications_term (intended_academic_term_id)`
- `KEY idx_admission_applications_status (application_status)`
- `CONSTRAINT fk_admission_applications_person FOREIGN KEY (person_id) REFERENCES persons (person_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_admission_applications_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_admission_applications_program FOREIGN KEY (applied_program_id) REFERENCES programs (program_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_admission_applications_term FOREIGN KEY (intended_academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_admission_applications_verified_by FOREIGN KEY (verified_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `guardians`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `guardian_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `guardian_first_name` | `VARCHAR(100)` | Required |
| `guardian_middle_name` | `VARCHAR(100)` | Optional |
| `guardian_last_name` | `VARCHAR(100)` | Required |
| `relationship` | `VARCHAR(50)` | Required |
| `contact_number` | `VARCHAR(30)` | Optional |
| `email_address` | `VARCHAR(255)` | Optional |
| `address` | `VARCHAR(255)` | Optional |
| `is_primary_contact` | `BOOLEAN` | Required |
| `is_emergency_contact` | `BOOLEAN` | Required |

**Keys and indexes**
- `PRIMARY KEY (guardian_id)`
- `KEY idx_guardians_student (student_id)`
- `KEY idx_guardians_primary (student_id, is_primary_contact)`
- `CONSTRAINT fk_guardians_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `emergency_contacts`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `emergency_contact_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `contact_name` | `VARCHAR(150)` | Required |
| `relationship` | `VARCHAR(50)` | Optional |
| `contact_number` | `VARCHAR(30)` | Required |
| `alternate_number` | `VARCHAR(30)` | Optional |
| `address` | `VARCHAR(255)` | Optional |

**Keys and indexes**
- `PRIMARY KEY (emergency_contact_id)`
- `KEY idx_emergency_contacts_student (student_id)`
- `CONSTRAINT fk_emergency_contacts_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `educational_background`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `educational_background_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `previous_school` | `VARCHAR(200)` | Optional |
| `previous_school_address` | `VARCHAR(255)` | Optional |
| `previous_school_level` | `VARCHAR(50)` | Optional |
| `strand_or_track` | `VARCHAR(100)` | Optional |
| `year_graduated` | `YEAR` | Optional |
| `previous_program` | `VARCHAR(150)` | Optional |
| `is_transferee` | `BOOLEAN` | Required |
| `transfer_credentials_verified` | `BOOLEAN` | Required |

**Keys and indexes**
- `PRIMARY KEY (educational_background_id)`
- `KEY idx_educational_background_student (student_id)`
- `CONSTRAINT fk_educational_background_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `profile_correction_requests`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `correction_request_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `field_to_change` | `VARCHAR(100)` | Required |
| `existing_value` | `TEXT` | Optional |
| `requested_value` | `TEXT` | Required |
| `request_reason` | `TEXT` | Required |
| `supporting_document_id` | `INT UNSIGNED` | Optional |
| `request_date` | `DATETIME` | Required |
| `request_status` | `VARCHAR(30)` | Required |
| `reviewed_by` | `INT UNSIGNED` | Optional |
| `review_date` | `DATETIME` | Optional |
| `review_remarks` | `TEXT` | Optional |
| `applied_at` | `DATETIME` | Optional |

**Keys and indexes**
- `PRIMARY KEY (correction_request_id)`
- `KEY idx_profile_correction_student_status (student_id, request_status)`
- `KEY idx_profile_correction_reviewer (reviewed_by)`
- `CONSTRAINT fk_profile_correction_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_profile_correction_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `student_enrollments`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `enrollment_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `academic_term_id` | `INT UNSIGNED` | Required |
| `program_id` | `INT UNSIGNED` | Required |
| `department_id` | `INT UNSIGNED` | Required |
| `year_level` | `VARCHAR(20)` | Required |
| `enrollment_date` | `DATETIME` | Required |
| `enrollment_status` | `VARCHAR(30)` | Required |
| `enrollment_reference_number` | `VARCHAR(50)` | Optional |
| `processed_by` | `INT UNSIGNED` | Optional |
| `approved_by` | `INT UNSIGNED` | Optional |
| `approval_date` | `DATETIME` | Optional |
| `enrollment_remarks` | `TEXT` | Optional |

**Keys and indexes**
- `PRIMARY KEY (enrollment_id)`
- `UNIQUE KEY uq_student_enrollments_student_term (student_id, academic_term_id)`
- `UNIQUE KEY uq_student_enrollments_reference (enrollment_reference_number)`
- `KEY idx_student_enrollments_term (academic_term_id)`
- `KEY idx_student_enrollments_program (program_id)`
- `KEY idx_student_enrollments_department (department_id)`
- `KEY idx_student_enrollments_status (enrollment_status)`
- `CONSTRAINT fk_student_enrollments_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_enrollments_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_enrollments_program FOREIGN KEY (program_id) REFERENCES programs (program_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_enrollments_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_enrollments_processed_by FOREIGN KEY (processed_by) REFERENCES staff (staff_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_student_enrollments_approved_by FOREIGN KEY (approved_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `document_types`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `document_type_id` | `INT UNSIGNED` | Required |
| `document_name` | `VARCHAR(150)` | Required |
| `document_description` | `TEXT` | Optional |
| `applicable_admission_type` | `VARCHAR(50)` | Optional |
| `is_required` | `BOOLEAN` | Required |
| `allowed_file_types` | `JSON` | Optional |
| `maximum_file_size` | `BIGINT UNSIGNED` | Optional |
| `is_active` | `BOOLEAN` | Required |

**Keys and indexes**
- `PRIMARY KEY (document_type_id)`
- `KEY idx_document_types_active (is_active)`
- `KEY idx_document_types_admission_type (applicable_admission_type)`

### `student_documents`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `student_document_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `document_type_id` | `INT UNSIGNED` | Required |
| `file_name` | `VARCHAR(255)` | Required |
| `storage_path` | `VARCHAR(500)` | Required |
| `file_type` | `VARCHAR(50)` | Optional |
| `file_size` | `BIGINT UNSIGNED` | Optional |
| `file_hash` | `VARCHAR(255)` | Optional |
| `version_number` | `INT UNSIGNED` | Required |
| `upload_date` | `DATETIME` | Required |
| `uploaded_by` | `INT UNSIGNED` | Optional |
| `verification_status` | `VARCHAR(30)` | Required |
| `verified_by` | `INT UNSIGNED` | Optional |
| `verification_date` | `DATETIME` | Optional |
| `rejection_reason` | `TEXT` | Optional |
| `expiration_date` | `DATE` | Optional |
| `retention_until` | `DATE` | Optional |

**Keys and indexes**
- `PRIMARY KEY (student_document_id)`
- `KEY idx_student_documents_student (student_id)`
- `KEY idx_student_documents_type (document_type_id)`
- `KEY idx_student_documents_status (verification_status)`
- `CONSTRAINT fk_student_documents_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_documents_type FOREIGN KEY (document_type_id) REFERENCES document_types (document_type_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_student_documents_verified_by FOREIGN KEY (verified_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `document_verifications`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `verification_id` | `INT UNSIGNED` | Required |
| `student_document_id` | `INT UNSIGNED` | Required |
| `verified_by` | `INT UNSIGNED` | Optional |
| `verification_status` | `VARCHAR(30)` | Required |
| `verification_remarks` | `TEXT` | Optional |
| `verification_date` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (verification_id)`
- `KEY idx_document_verifications_document (student_document_id)`
- `KEY idx_document_verifications_reviewer (verified_by)`
- `CONSTRAINT fk_document_verifications_document FOREIGN KEY (student_document_id) REFERENCES student_documents (student_document_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_document_verifications_verified_by FOREIGN KEY (verified_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `rooms`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `room_id` | `INT UNSIGNED` | Required |
| `room_code` | `VARCHAR(30)` | Required |
| `room_name` | `VARCHAR(100)` | Optional |
| `building` | `VARCHAR(100)` | Optional |
| `floor` | `VARCHAR(30)` | Optional |
| `room_capacity` | `INT UNSIGNED` | Optional |
| `room_type` | `VARCHAR(30)` | Optional |
| `room_status` | `VARCHAR(30)` | Required |

**Keys and indexes**
- `PRIMARY KEY (room_id)`
- `UNIQUE KEY uq_rooms_code (room_code)`
- `KEY idx_rooms_status (room_status)`

### `class_offerings`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `class_offering_id` | `INT UNSIGNED` | Required |
| `course_id` | `INT UNSIGNED` | Required |
| `academic_term_id` | `INT UNSIGNED` | Required |
| `department_id` | `INT UNSIGNED` | Required |
| `program_id` | `INT UNSIGNED` | Optional |
| `section_code` | `VARCHAR(30)` | Required |
| `year_level` | `VARCHAR(20)` | Optional |
| `class_capacity` | `INT UNSIGNED` | Optional |
| `class_type` | `VARCHAR(30)` | Optional |
| `class_modality` | `VARCHAR(30)` | Optional |
| `class_status` | `VARCHAR(20)` | Required |
| `created_by` | `INT UNSIGNED` | Optional |
| `created_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (class_offering_id)`
- `UNIQUE KEY uq_class_offerings_course_term_section (course_id, academic_term_id, section_code)`
- `KEY idx_class_offerings_term (academic_term_id)`
- `KEY idx_class_offerings_department (department_id)`
- `KEY idx_class_offerings_program (program_id)`
- `KEY idx_class_offerings_status (class_status)`
- `CONSTRAINT fk_class_offerings_course FOREIGN KEY (course_id) REFERENCES courses (course_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_class_offerings_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_class_offerings_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_class_offerings_program FOREIGN KEY (program_id) REFERENCES programs (program_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_class_offerings_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `class_schedules`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `schedule_id` | `INT UNSIGNED` | Required |
| `class_offering_id` | `INT UNSIGNED` | Required |
| `day_of_week` | `VARCHAR(15)` | Required |
| `start_time` | `TIME` | Required |
| `end_time` | `TIME` | Required |
| `room_id` | `INT UNSIGNED` | Optional |
| `building` | `VARCHAR(100)` | Optional |
| `schedule_type` | `VARCHAR(30)` | Optional |
| `effective_from` | `DATE` | Optional |
| `effective_until` | `DATE` | Optional |
| `schedule_status` | `VARCHAR(20)` | Required |
| `last_modified_by` | `INT UNSIGNED` | Optional |
| `last_modified_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (schedule_id)`
- `KEY idx_class_schedules_offering (class_offering_id)`
- `KEY idx_class_schedules_room_day_time (room_id, day_of_week, start_time, end_time)`
- `KEY idx_class_schedules_status (schedule_status)`
- `CONSTRAINT fk_class_schedules_offering FOREIGN KEY (class_offering_id) REFERENCES class_offerings (class_offering_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_class_schedules_room FOREIGN KEY (room_id) REFERENCES rooms (room_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_class_schedules_modified_by FOREIGN KEY (last_modified_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `faculty_assignments`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `faculty_assignment_id` | `INT UNSIGNED` | Required |
| `class_offering_id` | `INT UNSIGNED` | Required |
| `faculty_staff_id` | `INT UNSIGNED` | Required |
| `assignment_role` | `VARCHAR(30)` | Required |
| `assigned_by` | `INT UNSIGNED` | Optional |
| `assignment_date` | `DATETIME` | Required |
| `assignment_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (faculty_assignment_id)`
- `UNIQUE KEY uq_faculty_assignments_offering_staff (class_offering_id, faculty_staff_id)`
- `KEY idx_faculty_assignments_staff (faculty_staff_id)`
- `KEY idx_faculty_assignments_status (assignment_status)`
- `CONSTRAINT fk_faculty_assignments_offering FOREIGN KEY (class_offering_id) REFERENCES class_offerings (class_offering_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_faculty_assignments_staff FOREIGN KEY (faculty_staff_id) REFERENCES staff (staff_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_faculty_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `class_enrollments`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `class_enrollment_id` | `INT UNSIGNED` | Required |
| `enrollment_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `class_offering_id` | `INT UNSIGNED` | Required |
| `date_added` | `DATETIME` | Required |
| `enrollment_status` | `VARCHAR(30)` | Required |
| `date_dropped` | `DATETIME` | Optional |
| `drop_reason` | `TEXT` | Optional |
| `added_by` | `INT UNSIGNED` | Optional |

**Keys and indexes**
- `PRIMARY KEY (class_enrollment_id)`
- `UNIQUE KEY uq_class_enrollments_student_offering (student_id, class_offering_id)`
- `KEY idx_class_enrollments_enrollment (enrollment_id)`
- `KEY idx_class_enrollments_offering_status (class_offering_id, enrollment_status)`
- `CONSTRAINT fk_class_enrollments_enrollment FOREIGN KEY (enrollment_id) REFERENCES student_enrollments (enrollment_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_class_enrollments_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_class_enrollments_offering FOREIGN KEY (class_offering_id) REFERENCES class_offerings (class_offering_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_class_enrollments_added_by FOREIGN KEY (added_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `attendance_sessions`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `attendance_session_id` | `INT UNSIGNED` | Required |
| `class_offering_id` | `INT UNSIGNED` | Required |
| `schedule_id` | `INT UNSIGNED` | Optional |
| `attendance_date` | `DATE` | Required |
| `session_number` | `INT UNSIGNED` | Optional |
| `start_time` | `TIME` | Optional |
| `end_time` | `TIME` | Optional |
| `attendance_deadline` | `TIME` | Optional |
| `recorded_by` | `INT UNSIGNED` | Optional |
| `recorded_at` | `DATETIME` | Optional |
| `session_remarks` | `TEXT` | Optional |
| `session_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (attendance_session_id)`
- `KEY idx_attendance_sessions_offering_date (class_offering_id, attendance_date)`
- `KEY idx_attendance_sessions_schedule (schedule_id)`
- `CONSTRAINT fk_attendance_sessions_offering FOREIGN KEY (class_offering_id) REFERENCES class_offerings (class_offering_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_attendance_sessions_schedule FOREIGN KEY (schedule_id) REFERENCES class_schedules (schedule_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_attendance_sessions_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `attendance_records`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `attendance_id` | `INT UNSIGNED` | Required |
| `attendance_session_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `class_enrollment_id` | `INT UNSIGNED` | Required |
| `attendance_status` | `VARCHAR(20)` | Required |
| `time_in` | `TIME` | Optional |
| `time_out` | `TIME` | Optional |
| `minutes_late` | `INT UNSIGNED` | Optional |
| `reason_for_absence` | `TEXT` | Optional |
| `remarks` | `TEXT` | Optional |
| `recorded_by` | `INT UNSIGNED` | Optional |
| `recorded_at` | `DATETIME` | Required |
| `last_modified_by` | `INT UNSIGNED` | Optional |
| `last_modified_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (attendance_id)`
- `UNIQUE KEY uq_attendance_records_session_student (attendance_session_id, student_id)`
- `KEY idx_attendance_records_student (student_id)`
- `KEY idx_attendance_records_class_enrollment (class_enrollment_id)`
- `KEY idx_attendance_records_status (attendance_status)`
- `CONSTRAINT fk_attendance_records_session FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions (attendance_session_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_attendance_records_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_attendance_records_class_enrollment FOREIGN KEY (class_enrollment_id) REFERENCES class_enrollments (class_enrollment_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_attendance_records_recorded_by FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_attendance_records_modified_by FOREIGN KEY (last_modified_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `attendance_alert_settings`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `alert_setting_id` | `INT UNSIGNED` | Required |
| `maximum_allowed_absences` | `INT UNSIGNED` | Optional |
| `tardiness_threshold` | `INT UNSIGNED` | Optional |
| `notify_guardian` | `BOOLEAN` | Required |
| `notify_faculty` | `BOOLEAN` | Required |
| `notify_registrar` | `BOOLEAN` | Required |
| `is_enabled` | `BOOLEAN` | Required |
| `effective_from` | `DATE` | Optional |
| `effective_until` | `DATE` | Optional |

**Keys and indexes**
- `PRIMARY KEY (alert_setting_id)`
- `KEY idx_attendance_alert_settings_enabled_dates (is_enabled, effective_from, effective_until)`

### `attendance_alerts`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `alert_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `attendance_id` | `INT UNSIGNED` | Required |
| `recipient_name` | `VARCHAR(150)` | Optional |
| `recipient_contact` | `VARCHAR(255)` | Optional |
| `alert_type` | `VARCHAR(30)` | Required |
| `alert_message` | `TEXT` | Required |
| `notification_channel` | `VARCHAR(20)` | Optional |
| `date_triggered` | `DATETIME` | Required |
| `date_sent` | `DATETIME` | Optional |
| `delivery_status` | `VARCHAR(30)` | Required |

**Keys and indexes**
- `PRIMARY KEY (alert_id)`
- `KEY idx_attendance_alerts_student (student_id)`
- `KEY idx_attendance_alerts_attendance (attendance_id)`
- `KEY idx_attendance_alerts_delivery (delivery_status)`
- `CONSTRAINT fk_attendance_alerts_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_attendance_alerts_attendance FOREIGN KEY (attendance_id) REFERENCES attendance_records (attendance_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `grading_periods`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `grading_period_id` | `INT UNSIGNED` | Required |
| `academic_term_id` | `INT UNSIGNED` | Required |
| `period_name` | `VARCHAR(50)` | Required |
| `period_start_date` | `DATE` | Optional |
| `period_end_date` | `DATE` | Optional |
| `submission_deadline` | `DATETIME` | Optional |
| `period_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (grading_period_id)`
- `UNIQUE KEY uq_grading_periods_term_name (academic_term_id, period_name)`
- `KEY idx_grading_periods_status (period_status)`
- `CONSTRAINT fk_grading_periods_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `assessments`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `assessment_id` | `INT UNSIGNED` | Required |
| `class_offering_id` | `INT UNSIGNED` | Required |
| `grading_period_id` | `INT UNSIGNED` | Required |
| `assessment_name` | `VARCHAR(150)` | Required |
| `assessment_type` | `VARCHAR(50)` | Required |
| `maximum_score` | `DECIMAL(8,2)` | Required |
| `weight_percentage` | `DECIMAL(5,2)` | Optional |
| `assessment_date` | `DATE` | Optional |
| `created_by` | `INT UNSIGNED` | Optional |
| `date_created` | `DATETIME` | Required |
| `assessment_status` | `VARCHAR(20)` | Required |

**Keys and indexes**
- `PRIMARY KEY (assessment_id)`
- `KEY idx_assessments_offering (class_offering_id)`
- `KEY idx_assessments_grading_period (grading_period_id)`
- `KEY idx_assessments_status (assessment_status)`
- `CONSTRAINT fk_assessments_offering FOREIGN KEY (class_offering_id) REFERENCES class_offerings (class_offering_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_assessments_grading_period FOREIGN KEY (grading_period_id) REFERENCES grading_periods (grading_period_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_assessments_created_by FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `assessment_scores`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `assessment_score_id` | `INT UNSIGNED` | Required |
| `assessment_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `raw_score` | `DECIMAL(8,2)` | Required |
| `remarks` | `TEXT` | Optional |
| `encoded_by` | `INT UNSIGNED` | Optional |
| `encoded_at` | `DATETIME` | Required |
| `updated_by` | `INT UNSIGNED` | Optional |
| `updated_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (assessment_score_id)`
- `UNIQUE KEY uq_assessment_scores_assessment_student (assessment_id, student_id)`
- `KEY idx_assessment_scores_student (student_id)`
- `CONSTRAINT fk_assessment_scores_assessment FOREIGN KEY (assessment_id) REFERENCES assessments (assessment_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_assessment_scores_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_assessment_scores_encoded_by FOREIGN KEY (encoded_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_assessment_scores_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `student_grades`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `grade_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `class_enrollment_id` | `INT UNSIGNED` | Required |
| `academic_term_id` | `INT UNSIGNED` | Required |
| `grading_period_id` | `INT UNSIGNED` | Optional |
| `preliminary_grade` | `DECIMAL(5,2)` | Optional |
| `midterm_grade` | `DECIMAL(5,2)` | Optional |
| `final_grade` | `DECIMAL(5,2)` | Optional |
| `letter_grade` | `VARCHAR(5)` | Optional |
| `grade_point` | `DECIMAL(4,2)` | Optional |
| `remarks` | `VARCHAR(50)` | Optional |
| `is_official` | `BOOLEAN` | Required |
| `grade_status` | `VARCHAR(30)` | Required |
| `encoded_by` | `INT UNSIGNED` | Optional |
| `submitted_at` | `DATETIME` | Optional |
| `reviewed_by` | `INT UNSIGNED` | Optional |
| `reviewed_at` | `DATETIME` | Optional |
| `approved_by` | `INT UNSIGNED` | Optional |
| `approved_at` | `DATETIME` | Optional |
| `posted_by` | `INT UNSIGNED` | Optional |
| `posted_at` | `DATETIME` | Optional |

**Keys and indexes**
- `PRIMARY KEY (grade_id)`
- `KEY idx_student_grades_student_term (student_id, academic_term_id)`
- `KEY idx_student_grades_class_enrollment (class_enrollment_id)`
- `KEY idx_student_grades_period (grading_period_id)`
- `KEY idx_student_grades_status_official (grade_status, is_official)`
- `CONSTRAINT fk_student_grades_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_grades_class_enrollment FOREIGN KEY (class_enrollment_id) REFERENCES class_enrollments (class_enrollment_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_grades_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_grades_period FOREIGN KEY (grading_period_id) REFERENCES grading_periods (grading_period_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_student_grades_encoded_by FOREIGN KEY (encoded_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_student_grades_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_student_grades_approved_by FOREIGN KEY (approved_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_student_grades_posted_by FOREIGN KEY (posted_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `grade_scales`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `grade_scale_id` | `INT UNSIGNED` | Required |
| `grade_equivalent` | `VARCHAR(10)` | Required |
| `minimum_percentage` | `DECIMAL(5,2)` | Required |
| `maximum_percentage` | `DECIMAL(5,2)` | Required |
| `grade_point` | `DECIMAL(4,2)` | Optional |
| `verbal_equivalent` | `VARCHAR(50)` | Optional |
| `is_passing` | `BOOLEAN` | Required |
| `academic_term_id` | `INT UNSIGNED` | Optional |

**Keys and indexes**
- `PRIMARY KEY (grade_scale_id)`
- `KEY idx_grade_scales_term (academic_term_id)`
- `KEY idx_grade_scales_percentage (minimum_percentage, maximum_percentage)`
- `CONSTRAINT fk_grade_scales_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `student_academic_records`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `academic_record_id` | `INT UNSIGNED` | Required |
| `student_id` | `INT UNSIGNED` | Required |
| `academic_term_id` | `INT UNSIGNED` | Required |
| `program_id` | `INT UNSIGNED` | Optional |
| `year_level` | `VARCHAR(20)` | Optional |
| `total_units_enrolled` | `DECIMAL(5,2)` | Optional |
| `total_units_completed` | `DECIMAL(5,2)` | Optional |
| `total_units_failed` | `DECIMAL(5,2)` | Optional |
| `term_gpa` | `DECIMAL(4,2)` | Optional |
| `cumulative_gpa` | `DECIMAL(4,2)` | Optional |
| `academic_standing` | `VARCHAR(50)` | Optional |
| `record_status` | `VARCHAR(20)` | Required |
| `last_verified_by` | `INT UNSIGNED` | Optional |
| `last_verified_at` | `DATETIME` | Optional |

**Keys and indexes**
- `PRIMARY KEY (academic_record_id)`
- `UNIQUE KEY uq_student_academic_records_student_term (student_id, academic_term_id)`
- `KEY idx_student_academic_records_program (program_id)`
- `KEY idx_student_academic_records_status (record_status)`
- `CONSTRAINT fk_student_academic_records_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_academic_records_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_student_academic_records_program FOREIGN KEY (program_id) REFERENCES programs (program_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_student_academic_records_verified_by FOREIGN KEY (last_verified_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `report_definitions`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `report_definition_id` | `INT UNSIGNED` | Required |
| `report_code` | `VARCHAR(30)` | Required |
| `report_name` | `VARCHAR(150)` | Required |
| `report_type` | `VARCHAR(50)` | Required |
| `report_description` | `TEXT` | Optional |
| `required_permission_code` | `VARCHAR(100)` | Optional |
| `default_format` | `VARCHAR(20)` | Optional |
| `is_active` | `BOOLEAN` | Required |

**Keys and indexes**
- `PRIMARY KEY (report_definition_id)`
- `UNIQUE KEY uq_report_definitions_code (report_code)`
- `KEY idx_report_definitions_type_active (report_type, is_active)`
- `KEY idx_report_definitions_permission (required_permission_code)`
- `CONSTRAINT fk_report_definitions_permission_code FOREIGN KEY (required_permission_code) REFERENCES permissions (permission_code) ON DELETE SET NULL ON UPDATE CASCADE`

### `generated_reports`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `report_id` | `INT UNSIGNED` | Required |
| `report_definition_id` | `INT UNSIGNED` | Required |
| `report_code` | `VARCHAR(30)` | Optional |
| `report_name` | `VARCHAR(150)` | Optional |
| `report_type` | `VARCHAR(50)` | Optional |
| `generated_by` | `INT UNSIGNED` | Optional |
| `date_generated` | `DATETIME` | Required |
| `academic_term_id` | `INT UNSIGNED` | Optional |
| `department_id` | `INT UNSIGNED` | Optional |
| `program_id` | `INT UNSIGNED` | Optional |
| `report_format` | `VARCHAR(20)` | Optional |
| `report_file_path` | `VARCHAR(500)` | Optional |
| `report_status` | `VARCHAR(30)` | Required |
| `expiration_date` | `DATETIME` | Optional |
| `filters_applied` | `JSON` | Optional |

**Keys and indexes**
- `PRIMARY KEY (report_id)`
- `KEY idx_generated_reports_definition (report_definition_id)`
- `KEY idx_generated_reports_user_date (generated_by, date_generated)`
- `KEY idx_generated_reports_term (academic_term_id)`
- `KEY idx_generated_reports_department (department_id)`
- `KEY idx_generated_reports_program (program_id)`
- `KEY idx_generated_reports_status (report_status)`
- `CONSTRAINT fk_generated_reports_definition FOREIGN KEY (report_definition_id) REFERENCES report_definitions (report_definition_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_generated_reports_generated_by FOREIGN KEY (generated_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_generated_reports_term FOREIGN KEY (academic_term_id) REFERENCES academic_terms (academic_term_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_generated_reports_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_generated_reports_program FOREIGN KEY (program_id) REFERENCES programs (program_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `report_history`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `report_history_id` | `INT UNSIGNED` | Required |
| `user_id` | `INT UNSIGNED` | Required |
| `report_id` | `INT UNSIGNED` | Required |
| `date_generated` | `DATETIME` | Required |
| `filters_applied` | `JSON` | Optional |
| `number_of_records` | `INT UNSIGNED` | Optional |
| `export_format` | `VARCHAR(20)` | Optional |
| `generation_status` | `VARCHAR(30)` | Required |
| `downloaded_at` | `DATETIME` | Optional |

**Keys and indexes**
- `PRIMARY KEY (report_history_id)`
- `KEY idx_report_history_user_date (user_id, date_generated)`
- `KEY idx_report_history_report (report_id)`
- `CONSTRAINT fk_report_history_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE`
- `CONSTRAINT fk_report_history_report FOREIGN KEY (report_id) REFERENCES generated_reports (report_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### `audit_logs`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `audit_log_id` | `INT UNSIGNED` | Required |
| `user_id` | `INT UNSIGNED` | Optional |
| `username_snapshot` | `VARCHAR(100)` | Optional |
| `module_name` | `VARCHAR(100)` | Required |
| `entity_name` | `VARCHAR(100)` | Optional |
| `record_id` | `VARCHAR(100)` | Optional |
| `action_type` | `VARCHAR(30)` | Required |
| `previous_value` | `JSON` | Optional |
| `new_value` | `JSON` | Optional |
| `action_description` | `TEXT` | Optional |
| `action_reason` | `TEXT` | Optional |
| `ip_address` | `VARCHAR(45)` | Optional |
| `user_agent` | `VARCHAR(500)` | Optional |
| `action_status` | `VARCHAR(30)` | Required |
| `action_timestamp` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (audit_log_id)`
- `KEY idx_audit_logs_user_timestamp (user_id, action_timestamp)`
- `KEY idx_audit_logs_module_entity (module_name, entity_name)`
- `KEY idx_audit_logs_action_timestamp (action_type, action_timestamp)`
- `KEY idx_audit_logs_record (record_id)`
- `CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `notifications`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `notification_id` | `INT UNSIGNED` | Required |
| `user_id` | `INT UNSIGNED` | Optional |
| `student_id` | `INT UNSIGNED` | Optional |
| `notification_type` | `VARCHAR(50)` | Required |
| `notification_title` | `VARCHAR(150)` | Required |
| `notification_message` | `TEXT` | Required |
| `notification_channel` | `VARCHAR(30)` | Required |
| `related_record_id` | `VARCHAR(100)` | Optional |
| `is_read` | `BOOLEAN` | Required |
| `date_created` | `DATETIME` | Required |
| `date_read` | `DATETIME` | Optional |
| `delivery_status` | `VARCHAR(30)` | Required |

**Keys and indexes**
- `PRIMARY KEY (notification_id)`
- `KEY idx_notifications_user_read_date (user_id, is_read, date_created)`
- `KEY idx_notifications_student (student_id)`
- `KEY idx_notifications_delivery (delivery_status)`
- `CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_notifications_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `backup_configurations`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `backup_config_id` | `INT UNSIGNED` | Required |
| `backup_frequency` | `VARCHAR(30)` | Required |
| `backup_time` | `TIME` | Optional |
| `backup_type` | `VARCHAR(30)` | Required |
| `storage_location` | `VARCHAR(500)` | Required |
| `retention_period_days` | `INT UNSIGNED` | Required |
| `is_enabled` | `BOOLEAN` | Required |
| `last_backup_date` | `DATETIME` | Optional |
| `next_backup_date` | `DATETIME` | Optional |

**Keys and indexes**
- `PRIMARY KEY (backup_config_id)`
- `KEY idx_backup_configurations_enabled (is_enabled)`
- `KEY idx_backup_configurations_next_backup (next_backup_date)`

### `backup_history`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `backup_id` | `INT UNSIGNED` | Required |
| `backup_config_id` | `INT UNSIGNED` | Optional |
| `backup_type` | `VARCHAR(30)` | Required |
| `backup_start_time` | `DATETIME` | Required |
| `backup_end_time` | `DATETIME` | Optional |
| `backup_size` | `BIGINT UNSIGNED` | Optional |
| `backup_file_path` | `VARCHAR(500)` | Optional |
| `backup_status` | `VARCHAR(30)` | Required |
| `backup_checksum` | `VARCHAR(255)` | Optional |
| `failure_reason` | `TEXT` | Optional |
| `initiated_by` | `INT UNSIGNED` | Optional |

**Keys and indexes**
- `PRIMARY KEY (backup_id)`
- `KEY idx_backup_history_config (backup_config_id)`
- `KEY idx_backup_history_status_start (backup_status, backup_start_time)`
- `CONSTRAINT fk_backup_history_config FOREIGN KEY (backup_config_id) REFERENCES backup_configurations (backup_config_id) ON DELETE SET NULL ON UPDATE CASCADE`
- `CONSTRAINT fk_backup_history_initiated_by FOREIGN KEY (initiated_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `retention_policies`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `retention_policy_id` | `INT UNSIGNED` | Required |
| `record_type` | `VARCHAR(100)` | Required |
| `retention_duration` | `INT UNSIGNED` | Optional |
| `retention_unit` | `VARCHAR(20)` | Required |
| `retention_start_event` | `VARCHAR(50)` | Optional |
| `archive_after_days` | `INT UNSIGNED` | Optional |
| `archive_at` | `DATE` | Optional |
| `disposal_action` | `VARCHAR(30)` | Required |
| `is_active` | `BOOLEAN` | Required |
| `updated_by` | `INT UNSIGNED` | Optional |
| `updated_at` | `DATETIME` | Required |

**Keys and indexes**
- `PRIMARY KEY (retention_policy_id)`
- `KEY idx_retention_policies_type_active (record_type, is_active)`
- `CONSTRAINT fk_retention_policies_updated_by FOREIGN KEY (updated_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `system_events`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `system_event_id` | `INT UNSIGNED` | Required |
| `event_type` | `VARCHAR(50)` | Required |
| `module_affected` | `VARCHAR(100)` | Optional |
| `event_description` | `TEXT` | Required |
| `severity_level` | `VARCHAR(20)` | Required |
| `event_timestamp` | `DATETIME` | Required |
| `resolution_status` | `VARCHAR(30)` | Required |
| `resolved_by` | `INT UNSIGNED` | Optional |
| `resolution_date` | `DATETIME` | Optional |

**Keys and indexes**
- `PRIMARY KEY (system_event_id)`
- `KEY idx_system_events_severity_time (severity_level, event_timestamp)`
- `KEY idx_system_events_status (resolution_status)`
- `KEY idx_system_events_resolved_by (resolved_by)`
- `CONSTRAINT fk_system_events_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE`

### `system_performance_metrics`

| Column | MySQL/MariaDB type | Required? |
|---|---|---:|
| `metric_id` | `INT UNSIGNED` | Required |
| `metric_name` | `VARCHAR(100)` | Required |
| `metric_value` | `DECIMAL(12,3)` | Required |
| `metric_unit` | `VARCHAR(30)` | Required |
| `component_name` | `VARCHAR(100)` | Required |
| `measured_at` | `DATETIME` | Required |
| `threshold_value` | `DECIMAL(12,3)` | Optional |
| `threshold_status` | `VARCHAR(20)` | Optional |
| `environment` | `VARCHAR(30)` | Optional |

**Keys and indexes**
- `PRIMARY KEY (metric_id)`
- `KEY idx_system_metrics_name_time (metric_name, measured_at)`
- `KEY idx_system_metrics_component_time (component_name, measured_at)`
- `KEY idx_system_metrics_threshold (threshold_status)`

**Additional foreign keys added after table creation**
- `departments.department_head_staff_id` references `staff.staff_id` with `ON DELETE SET NULL ON UPDATE CASCADE`.
- `profile_correction_requests.supporting_document_id` references `student_documents.student_document_id` with `ON DELETE SET NULL ON UPDATE CASCADE`.

## C. Relationships

### Identity and organization
- `persons` 1-to-zero/one `students`; `persons` 1-to-zero/one `staff`; `persons` 1-to-zero/one `users` in this draft. The PDF allows person-to-student/staff associations depending on the identity model and allows `users.person_id` to be NULL for special service accounts.
- `departments` 1-to-many `programs`, `staff`, `students`, `courses`, `class_offerings`, and term `student_enrollments`.
- `departments.department_head_staff_id` optionally references `staff.staff_id`; this is added after `staff` exists to resolve the circular department/staff dependency.
- `programs` 1-to-many `students`, `class_offerings`, `admission_applications`, `student_enrollments`, and `student_academic_records`.
- `academic_terms` 1-to-many `student_enrollments`, `class_offerings`, `grading_periods`, `student_grades`, `student_academic_records`, and generated reports.
- `courses` 1-to-many `class_offerings`; optional `course_prerequisites` links one course to another course (self-referencing many-to-many).

### Authentication and authorization
- `users` many-to-many `roles` through `user_roles`. `user_roles.department_id` provides optional departmental scope; `assigned_by` references the assigning user.
- `roles` many-to-many `permissions` through `role_permissions`.
- `users` 1-to-many `password_reset_requests`; `users` also self-reference through `created_by`.
- Staff members such as ICT Services and Education Technology Services are represented by `staff` plus a `users` account where login is needed; their role is assigned through `user_roles` (for example, `ICT_ADMIN` or `EDTECH`). No separate ICT/EdTech account tables are required.

### Admissions, profiles, and enrollment
- `persons` 1-to-many `admission_applications`; an application may later link to a `students` row after conversion.
- `students` 1-to-many `guardians`, `emergency_contacts`, `educational_background`, `profile_correction_requests`, `student_documents`, `student_enrollments`, and `student_academic_records`.
- A profile correction may optionally reference supporting evidence in `student_documents`; each review record references its reviewer in `users`.
- `student_enrollments` belongs to one `students` row and one `academic_terms` row; it references the program and department for that term.
- `student_enrollments` 1-to-many `class_enrollments`; each `class_enrollments` row connects one student to one `class_offerings` row. This is the student-to-class many-to-many junction over time.
- `document_types` 1-to-many `student_documents`; `student_documents` 1-to-many `document_verifications` to preserve verification history.

### Academic delivery, attendance, and grades
- `class_offerings` belongs to one course and academic term, and may be scoped to a program; it has many `class_schedules`, `faculty_assignments`, `class_enrollments`, `attendance_sessions`, and `assessments`.
- `faculty_assignments` connects `staff` to `class_offerings` and is the faculty-to-class junction table.
- `class_schedules` optionally references a `rooms` row.
- `attendance_sessions` belongs to a class offering and may reference a schedule; each session has many `attendance_records`.
- `attendance_records` references a student and the associated class enrollment; a unique `(attendance_session_id, student_id)` constraint prevents duplicate attendance rows for one student/session.
- `attendance_alerts` references the student and attendance record that triggered the alert; `attendance_alert_settings` stores the rules, but the PDF does not define the rule scope (system-wide, per-term, per-class, etc.).
- `grading_periods` belongs to an academic term; `assessments` belongs to a class offering and grading period; `assessment_scores` connects each assessment to a student.
- `student_grades` references a student, class enrollment, academic term, and optionally a grading period, with user references for encode/review/approve/post actors.
- `grade_scales` may be global or term-specific; `student_academic_records` stores or caches a term-level summary for a student.

### Reports and system support
- `report_definitions` optionally references a required permission code; `generated_reports` references its definition and optional user/term/department/program filters; `report_history` references the user and generated report.
- `audit_logs` optionally references the user responsible for an event; a NULL user can represent a system-originated event.
- `notifications` can reference a user, a student, or both, depending on recipient identity/account availability.
- `backup_history` optionally references a backup configuration and the initiating user; a NULL initiating user is reserved for system-initiated jobs in this draft.
- `retention_policies` and `system_events` optionally reference the user who updated/resolved them; `system_performance_metrics` is an independent monitoring measurement table.

## D. Assumptions, ambiguities, and approval questions

1. **Primary key strategy:** The PDF permits `INT / UUID`. The migration chooses `INT UNSIGNED AUTO_INCREMENT` for all internal IDs and matching foreign keys. Confirm that this is acceptable before implementation.
2. **Column nullability:** The PDF does not supply a required/optional matrix for every field. The `NOT NULL` / `NULL` decisions in this draft are inferred from the field purpose, relationship requirements, and explicit qualifiers such as “if needed,” “if applicable,” and “optional.” Review every column before production.
3. **Uniqueness:** Unique constraints for usernames, account email, student number, employee number, course/department/program codes, application number, term-year/semester, enrollment-by-student-and-term, and selected junction pairs are implementation choices where not fully prescribed. Confirm whether codes are globally unique or unique only within a department/term.
4. **Optional person account mapping:** `students.person_id` and `staff.person_id` are unique to implement one row per person in each subtype. `users.person_id` is nullable for service accounts and unique where populated. Confirm whether one person can hold multiple login accounts.
5. **Role scope and multiplicity:** `user_roles` allows multiple roles and optional department scope. Its composite unique key includes nullable scope/date fields; MySQL/MariaDB allow multiple NULL combinations in unique indexes, so the backend should validate effective duplicate assignments or the team should choose a normalized scope key.
6. **Role names:** The seed includes the five roles listed in the PDF: `ICT_ADMIN`, `EDTECH`, `DEPT_HEAD`, `FACULTY`, and `REGISTRAR`. The `STUDENT` role is explicitly optional in the PDF and is not seeded. Confirm whether students will authenticate.
7. **Permissions:** The PDF provides a starting matrix and suggested permission codes, not a finalized role-permission assignment. `seed.sql` inserts role and permission definitions only; it deliberately does not assign permissions to roles. Obtain approval for the role-permission matrix before adding `role_permissions` rows.
8. **User actors versus staff actors:** Fields such as `VerifiedBy`, `ApprovedBy`, `EncodedBy`, and `ResolvedBy` are described variously as Staff/User/authorized user. This draft maps most action actors to `users.user_id`; `student_enrollments.processed_by` and faculty assignment use `staff.staff_id` where the PDF explicitly says staff/faculty staff. Confirm actor semantics field by field.
9. **Department/staff circular relationship:** `departments.department_head_staff_id` and `staff.department_id` reference each other conceptually. The migration creates the department table first and adds the department-head FK after staff creation. Confirm that department heads must be staff records.
10. **Course prerequisites:** Included as an optional self-referencing junction table. `minimum_grade` is stored as `VARCHAR(20)` because the PDF does not decide numeric versus letter-grade representation; confirm the grading convention.
11. **Profile control fields:** The separate profile-control table is optional in the PDF and is omitted. Decide whether `LastProfileUpdate`, `LastUpdatedBy`, `ProfileCompletionStatus`, and `ProfileVerificationStatus` should be stored on `students`, in a dedicated table, or derived.
12. **CurrentYearLevel:** Included on `students` as optional for convenience, although the PDF says it should preferably be derived from the current enrollment. Decide whether to remove it from persistent storage and always derive it.
13. **Calculated values:** `TotalRegisteredUnits` is omitted from `student_enrollments` because the PDF says it should preferably be calculated. `CurrentClassSize`, `PercentageScore`, full name, age, attendance percentage, GPA/CGPA, and dashboard totals are also calculated rather than stored as ordinary columns. If caching is needed, define refresh/invalidation rules.
14. **Grade model conflict:** The PDF both lists `PreliminaryGrade`, `MidtermGrade`, and `FinalGrade` columns and recommends a flexible `GradingPeriods` model rather than hardcoding a fixed period set. This draft preserves those three optional fields and also adds `grading_period_id`; confirm whether the final data model should instead use one grade row per grading period and remove the fixed period columns.
15. **Grade-scale representation:** `GradeEquivalent` is VARCHAR(10) to support either letter or numeric-looking labels; the PDF also permits DECIMAL. Confirm whether the school needs separate numeric and letter columns.
16. **Attendance alert settings scope:** The PDF does not identify whether alert settings are global, term-specific, per-class, per-department, or versioned. The current table has no scope FK; decide the intended scope before using it.
17. **Student class re-enrollment:** The migration uses a unique `(student_id, class_offering_id)` constraint. This prevents a second row after a dropped enrollment. Confirm whether re-enrollment should update the existing record or create a new enrollment attempt with history.
18. **One current term:** The PDF says a single current academic term should be enforced only if that is institutional policy. The migration indexes `is_current_term` but does not enforce one current term; decide whether to enforce it with application logic or a generated unique constraint.
19. **Schedule conflicts and capacities:** Room overlaps, faculty conflicts, class capacity, assessment score bounds, weighted assessment totals, and cross-table student/enrollment consistency cannot be safely enforced by simple row-level FK constraints alone. Implement transactional backend validation and tests; the PDF identifies these as business rules.
20. **Lookup tables and controlled vocabularies:** The PDF recommends lookup tables for changing values (statuses, admission type, document type, course type, notification channel, grade remarks) but does not enumerate all lookup tables/columns. This draft retains VARCHAR columns for these values; confirm whether dedicated lookup tables are required for the project.
21. **Document storage:** `storage_path` and report/backup paths are references to protected external storage; file binaries are not stored in normal rows. Confirm storage provider, allowed MIME/file types, maximum sizes, antivirus validation, and retention policy.
22. **JSON compatibility:** `JSON` columns are used for allowed file types, audit values, and report filters. MySQL stores native JSON; MariaDB exposes JSON as a LONGTEXT alias with JSON validation behavior depending on version. Confirm the minimum server versions and whether explicit JSON validation checks are needed.
23. **Timestamps and timezone:** Creation timestamps default to `CURRENT_TIMESTAMP`; update timestamps use `ON UPDATE CURRENT_TIMESTAMP` where applicable. The migration sets the session timezone to UTC for the migration connection; confirm the deployment-wide timezone policy.
24. **Password/session/MFA details:** Only the password hash and MFA-enabled flag are in the specified user table. Session storage, remembered devices, MFA secret/challenge storage, rate-limit history, and reset-token throttling are not specified and need separate security design.
25. **Audit log immutability:** The PDF calls for append-only audit records for ordinary users. The schema does not itself make rows immutable; enforce insert-only permissions for application roles and protect audit storage operationally.
26. **Retention/disposal:** No retention duration is hardcoded. Confirm approved institutional data-retention, archival, and secure disposal policies before writing any automated archival/disposal process.
27. **Profile/admissions field placement:** `CivilStatus` and `PlaceOfBirth` are stored on `persons` as shared personal attributes, consistent with the PDF field-ownership note that personal details belong in `Persons`. Confirm this is how the team wants to organize those values.
28. **Report filters:** Report filter controls are stored in JSON on `generated_reports` and `report_history`, not as a separate table. The PDF explicitly allows typed parameters or validated JSON. Confirm the JSON structure and versioning policy.

## E. MySQL/MariaDB migration file

The accompanying `001_initial_schema.sql` creates the 48-table schema in dependency order, adds the two foreign keys that require later table creation through `ALTER TABLE`, and includes primary keys, foreign keys, selected unique constraints, indexes, InnoDB, `utf8mb4`, and timestamp defaults. It is written for a new, empty development database and contains no destructive commands.

## F. Optional seed file

The accompanying `seed.sql` inserts only the five staff roles named in the PDF and the suggested permission definitions. It does not create sample people/users, credentials, or role-to-permission assignments. The actual permission assignments should be inserted only after the project team approves the access matrix.

## G. Verification queries

Run these manually after applying the migration to a new empty development database:

```sql
-- List created tables
SHOW TABLES;

-- Inspect selected tables; repeat for all 48 tables as required
DESCRIBE persons;
DESCRIBE students;
DESCRIBE staff;
DESCRIBE users;
DESCRIBE roles;
DESCRIBE user_roles;
DESCRIBE role_permissions;
DESCRIBE student_enrollments;
DESCRIBE class_enrollments;
DESCRIBE attendance_records;
DESCRIBE student_grades;

-- List every foreign-key relationship in the active database
SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME,
       REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- Find tables with no declared foreign keys (review; some are valid lookup/log tables)
SELECT t.TABLE_NAME
FROM information_schema.TABLES AS t
LEFT JOIN information_schema.KEY_COLUMN_USAGE AS k
  ON k.TABLE_SCHEMA = t.TABLE_SCHEMA
 AND k.TABLE_NAME = t.TABLE_NAME
 AND k.REFERENCED_TABLE_NAME IS NOT NULL
WHERE t.TABLE_SCHEMA = DATABASE()
  AND t.TABLE_TYPE = 'BASE TABLE'
GROUP BY t.TABLE_NAME
HAVING COUNT(k.CONSTRAINT_NAME) = 0
ORDER BY t.TABLE_NAME;

-- Confirm no orphaned student-to-person references (expected result: zero)
SELECT s.student_id, s.person_id
FROM students AS s
LEFT JOIN persons AS p ON p.person_id = s.person_id
WHERE p.person_id IS NULL;

-- Confirm no orphaned class-enrollment references (expected result: zero)
SELECT ce.class_enrollment_id
FROM class_enrollments AS ce
LEFT JOIN student_enrollments AS se ON se.enrollment_id = ce.enrollment_id
LEFT JOIN students AS s ON s.student_id = ce.student_id
LEFT JOIN class_offerings AS co ON co.class_offering_id = ce.class_offering_id
WHERE se.enrollment_id IS NULL OR s.student_id IS NULL OR co.class_offering_id IS NULL;

-- Confirm attendance uniqueness by session and student (expected result: no rows)
SELECT attendance_session_id, student_id, COUNT(*) AS duplicate_count
FROM attendance_records
GROUP BY attendance_session_id, student_id
HAVING COUNT(*) > 1;
```

## Review notes

- The migration is a draft and must be reviewed before execution.
- The SQL was not run against any database.
- Run it only after creating/selecting a new empty development database and confirming server version, character set, SQL mode, timezone, and team-approved assumptions.
- Application-level authorization, validations, schedule conflict detection, capacity checks, grade computation, and audit immutability must also be implemented; schema constraints alone do not satisfy those requirements.
