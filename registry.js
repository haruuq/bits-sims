/* =====================================================
   BITS-SIMS STUDENT REGISTRY  (shared, sample data)
   -----------------------------------------------------
   The institutional student list plus the setup tables it
   hangs off (departments, programs, courses, terms, rooms)
   and term enrollments. Design reference sections 2.2-2.7
   and 4.5.
   Current scope: 3rd year only.

   Who touches it:
     Registrar  -> reads and writes (registration, status,
                   enrollment verification)         registrar.js
     Dept Head  -> reads only, scoped to own department staff.js
   Faculty class rosters in staff.js use the same student
   numbers, so a student appears the same way everywhere.

   Later this becomes the Students / Persons / Departments /
   Programs tables behind an API; the pages stay the same.
===================================================== */
(function () {
  'use strict';

  const KEY = 'bits-sims-registry';
  const VERSION = 3;   // bump whenever the seed changes so old browser data resets

  const S = (no, name, program, year, status, dept, admission, extra) => Object.assign({
    no, name, program, year, status, dept: dept || 'IT', admission: admission || 'Freshman', email: '', mobile: '', city: ''
  }, extra || {});

  const seed = () => ({
    version: VERSION,
    students: [
      S('2024-12345', 'Garcia, Dawson James', 'BSIT', '3rd', 'Active', 'IT', 'Freshman', { email: 'dawson.garcia@bits.edu.ph', mobile: '09171234567', city: 'Muntinlupa' }),
      S('2024-10231', 'Bautista, Angela Mae', 'BSIT', '3rd', 'Active'),
      S('2024-10477', 'Dela Cruz, Carlo Miguel', 'BSIT', '3rd', 'Active'),
      S('2024-10586', 'Ramos, Jasmine Faith', 'BSIT', '3rd', 'Active'),
      S('2024-10902', 'Navarro, Kyle Andrei', 'BSIT', '3rd', 'Active'),
      S('2024-11019', 'Santiago, Marianne Joy', 'BSIT', '3rd', 'Active'),
      S('2024-11248', 'Villanueva, Paolo Enrico', 'BSIT', '3rd', 'Active', 'IT', 'Transferee'),
      S('2024-11373', 'Mercado, Trisha Anne', 'BSIT', '3rd', 'Active'),
      S('2024-10655', 'Reyes, Pedro', 'BSCS', '3rd', 'On Leave'),
      S('2024-11502', 'Santos, Maria', 'BSIT', '3rd', 'Active', 'IT', 'Returnee'),
      S('2024-11610', 'Garcia, Ana', 'BSCS', '3rd', 'Active'),
      S('2024-11734', 'Lopez, Carmen', 'BSBA', '3rd', 'Active', 'BA')
    ],
    setup: {
      Departments: [['IT', 'Information Technology', 'Cruz, R.', 'Active'], ['BA', 'Business Administration', 'Cruz, A.', 'Active'], ['ED', 'Education', 'Santos, L.', 'Inactive']],
      Programs: [['BSIT', 'BS Information Technology', 'IT', 'Active'], ['BSCS', 'BS Computer Science', 'IT', 'Active'], ['BSIS', 'BS Information Systems', 'IT', 'Inactive'], ['BSBA', 'BS Business Administration', 'BA', 'Active']],
      Courses: [['ITP3112R', 'System Administration and Maintenance 1', '3.0 units', 'Active'], ['ITP3111R', 'Network Management 2', '3.0 units', 'Active'], ['ITA312R', 'Platform Technologies 3 (Cloud Computing)', '3.0 units', 'Active'], ['GEN-RP', 'Readings in Philippine History', '3.0 units', 'Active']],
      'Academic Terms': [['2026-2027', '1st Semester', 'Aug 17 - Dec 18', 'Ongoing (current)'], ['2026-2027', '2nd Semester', 'Jan 11 - May 14', 'Upcoming']],
      Rooms: [['ITLAB-01', 'IT Laboratory 1', '40', 'Available'], ['ITLAB-02', 'IT Laboratory 2', '40', 'Available'], ['RM-204', 'Room 204', '45', 'Under Maintenance']]
    },
    // Term enrollments (StudentEnrollments, 4.5): Pending -> Verified -> Enrolled
    enrollments: [
      { ref: 'ENR-0007', student: 'Santos, Maria', no: '2024-11502', term: '1st Sem 2026-27', program: 'BSIT', year: '3rd', units: '21.0', status: 'Pending' },
      { ref: 'ENR-0012', student: 'Reyes, Pedro', no: '2024-10655', term: '1st Sem 2026-27', program: 'BSCS', year: '3rd', units: '18.0', status: 'Verified' },
      { ref: 'ENR-0019', student: 'Garcia, Ana', no: '2024-11610', term: '1st Sem 2026-27', program: 'BSCS', year: '3rd', units: '24.0', status: 'Enrolled' }
    ]
  });

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function get() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && saved.version === VERSION && Array.isArray(saved.students)) return saved;
    } catch (e) { /* fall back to the sample */ }
    return seed();
  }
  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable */ }
  }

  window.SIMSRegistry = {
    KEY,
    get,
    save,
    reset: () => { const d = seed(); save(d); return clone(d); },
    // Code of the department a student belongs to ('IT', 'BA', ...)
    inDepartment: (code) => get().students.filter((s) => s.dept === code)
  };
})();
