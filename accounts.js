/* =====================================================
   BITS-SIMS DEMO ACCOUNTS  (hardcoded - prototype only)
   -----------------------------------------------------
   One place for every login, one account per role from
   section 3.3 of the design reference. Loaded first, so
   staff.js, registrar.js and script.js all read from here.

   Role        Username         Password        Opens
   ----------  ---------------  --------------  -----------------
   ICT_ADMIN   ict.admin        Ict@2026        staff.js
   EDTECH      edtech.staff     Edtech@2026     staff.js
   DEPT_HEAD   dept.cruz        Dept@2026       staff.js
   FACULTY     faculty.reyes    Faculty@2026    staff.js
   REGISTRAR   registrar.santos Registrar@2026  registrar.js
   STUDENT     dawson.garcia    Student@2026    script.js (student portal)

   The work email (or the student number, for the student)
   also works as the username.

   When the database is ready, delete this file: login moves
   to the server and passwords are stored as Argon2id/bcrypt
   hashes, never as text (section 3.2 / 3.7).
===================================================== */
(function () {
  'use strict';

  const ACCOUNTS = [
    { role: 'ICT_ADMIN', username: 'ict.admin', email: 'ict.admin@bits.edu.ph', password: 'Ict@2026', name: 'Marco Villanueva', title: 'System Administrator', dept: 'ICT Services', employeeNo: 'EMP-0012', hired: '2019-06-03', contact: '0917 555 0112' },
    { role: 'EDTECH', username: 'edtech.staff', email: 'edtech@bits.edu.ph', password: 'Edtech@2026', name: 'Lara Mendoza', title: 'Learning Systems Specialist', dept: 'Education Technology Services', employeeNo: 'EMP-0027', hired: '2021-01-18', contact: '0917 555 0127' },
    { role: 'DEPT_HEAD', username: 'dept.cruz', email: 'r.cruz@bits.edu.ph', password: 'Dept@2026', name: 'Dr. Ramon Cruz', title: 'Head, Information Technology Department', dept: 'Information Technology', deptCode: 'IT', employeeNo: 'EMP-0031', hired: '2017-07-01', contact: '0917 555 0131' },
    { role: 'FACULTY', username: 'faculty.reyes', email: 'f.reyes@bits.edu.ph', password: 'Faculty@2026', name: 'Daniel Reyes', title: 'Instructor, BSIT', dept: 'Information Technology', employeeNo: 'EMP-0143', hired: '2020-08-10', contact: '0917 555 0143' },
    { role: 'REGISTRAR', username: 'registrar.santos', email: 'e.santos@bits.edu.ph', password: 'Registrar@2026', name: 'Elena Santos', title: 'University Registrar', dept: 'Registrar\u2019s Office', employeeNo: 'EMP-0008', hired: '2018-03-12', contact: '0917 555 0108' },
    { role: 'STUDENT', username: 'dawson.garcia', email: 'dawson.garcia@bits.edu.ph', password: 'Student@2026', name: 'Dawson James Garcia', title: 'BSIT, 3rd Year', dept: 'Information Technology', studentNumber: '2024-12345' }
  ];

  const norm = (v) => String(v || '').trim().toLowerCase();

  // Find an account by username, email or (students) student number
  function find(id) {
    const key = norm(id);
    if (!key) return null;
    return ACCOUNTS.find((a) => a.username === key || norm(a.email) === key || (a.studentNumber && a.studentNumber === key)) || null;
  }

  window.SIMSAccounts = {
    all: () => ACCOUNTS.slice(),
    find,
    byRole: (...roles) => ACCOUNTS.filter((a) => roles.includes(a.role))
  };
})();
