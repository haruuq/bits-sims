/* =========================================================
   BITS-SIMS - STAFF PORTALS
   ICT Services (admin), Education Technology Services,
   Department Head, Faculty. (Registrar and Student have their
   own files: registrar.js and script.js.)
   Loaded before script.js. Exposes window.SIMSStaff:
     isStaffUser(username)            -> true if it matches a staff account
     authenticate(username, password) -> { ok, account, message }
     open(account)                    -> shows that account's portal
     classes(), gradeSheets(), setGradeStatus(), attendanceSummary(),
     attendanceAlerts(), record(), auditFor(), userName()
                                      -> shared with registrar.js
   Logins live in accounts.js. All data is sample data kept in
   localStorage (prototype only).
   ========================================================= */
(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const nowStamp = () => { const d = new Date(); return `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
  const fmtTime = (t) => { if (!t) return '\u2014'; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`; };
  const fmtDate = (iso) => { if (!iso) return '\u2014'; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const fmtDateLong = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }); };
  const fmtBytes = (b) => b > 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : `${Math.round(b / 1048576)} MB`;
  const rnd = (seed) => { const x = Math.sin(seed * 9999.37) * 10000; return x - Math.floor(x); };

  // Prototype-only hash (NOT secure). A real build must use Argon2id / bcrypt on the server.
  const hash = (str) => {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  };

  const K = {
    users: 'bits-sims-staff-users', perms: 'bits-sims-staff-perms', audit: 'bits-sims-staff-audit',
    backups: 'bits-sims-staff-backups', events: 'bits-sims-staff-events', classes: 'bits-sims-staff-classes',
    fac: 'bits-sims-staff-faculty', policy: 'bits-sims-staff-policy', alerts: 'bits-sims-staff-alertcfg',
    reports: 'bits-sims-staff-reports', pw: 'bits-sims-staff-pw', locks: 'bits-sims-staff-locks'
  };
  // Bump when the seed data changes so everyone's old browser data resets
  const STAFF_VERSION = 5;
  try {
    if (localStorage.getItem('bits-sims-staff-version') !== String(STAFF_VERSION)) {
      Object.values(K).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem('bits-sims-staff-version', String(STAFF_VERSION));
    }
  } catch (e) { /* storage unavailable */ }
  const load = (key, seed) => {
    try { const v = JSON.parse(localStorage.getItem(key)); if (v !== null && v !== undefined) return v; } catch (e) { /* ignore */ }
    return seed();
  };
  const persist = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    if (key === K.fac || key === K.classes) queueSync();   // grades/attendance -> academic records
  };
  let syncQueued = false;   // see queueSync()

  /* =====================================================
     STAFF ACCOUNTS (the logins) - hardcoded in accounts.js
     ICT Admin : ict.admin      / Ict@2026
     EdTech    : edtech.staff   / Edtech@2026
     Dept Head : dept.cruz      / Dept@2026
     Faculty   : faculty.reyes  / Faculty@2026
     (the work email also works as the username)
  ===================================================== */
  const STAFF_ROLES = ['ICT_ADMIN', 'EDTECH', 'DEPT_HEAD', 'FACULTY'];
  const ACCOUNTS = (window.SIMSAccounts ? window.SIMSAccounts.byRole(...STAFF_ROLES) : []).map((a) => Object.assign({}, a, { pwHash: hash(a.password) }));
  ACCOUNTS.forEach((a) => { delete a.password; });

  const ROLE_LABEL = {
    ICT_ADMIN: 'ICT Services', EDTECH: 'Education Technology Services', DEPT_HEAD: 'Department Head',
    FACULTY: 'Faculty Member', REGISTRAR: 'Registrar', STUDENT: 'Student'
  };

  // What each portal can do (the access matrix in the planning reference, section 8.2)
  const CAPS = {
    ICT_ADMIN: ['accounts.manage', 'roles.manage', 'audit.full', 'backup.manage', 'monitor.manage', 'reports.all', 'config'],
    // EdTech only gets pages where it can act; view-only pages (roles, audit, backups) were removed
    EDTECH: ['accounts.support', 'monitor.manage', 'classes.edit', 'reports.ops'],
    DEPT_HEAD: ['classes.edit', 'classes.create', 'grades.review', 'attendance.view', 'students.view', 'reports.dept'],
    FACULTY: ['classes.assigned', 'attendance.encode', 'grades.encode', 'reports.class']
  };

  const NAV = {
    ICT_ADMIN: [
      ['dashboard', 'Dashboard', 'home'], ['accounts', 'User Accounts', 'users'], ['roles', 'Roles & Permissions', 'shield'],
      ['audit', 'Audit Trails', 'list'], ['backups', 'Backup Management', 'db'], ['monitoring', 'System Monitoring', 'pulse'],
      ['reports', 'Reports', 'doc'], ['settings', 'System Settings', 'gear'], ['account', 'My Account', 'user']
    ],
    EDTECH: [
      ['dashboard', 'Dashboard', 'home'], ['accounts', 'Account Support', 'users'], ['classes', 'Classes & Schedules', 'cal'],
      ['monitoring', 'System Monitoring', 'pulse'], ['reports', 'Reports', 'doc'], ['account', 'My Account', 'user']
    ],
    DEPT_HEAD: [
      ['dashboard', 'Dashboard', 'home'], ['classes', 'Classes & Faculty', 'cal'], ['review', 'Grade Review', 'star'],
      ['attendance', 'Attendance Overview', 'check'], ['students', 'Department Students', 'users'], ['reports', 'Reports', 'doc'], ['account', 'My Account', 'user']
    ],
    FACULTY: [
      ['dashboard', 'Dashboard', 'home'], ['classes', 'My Classes', 'cal'], ['attendance', 'Attendance', 'check'],
      ['grades', 'Grade Management', 'star'], ['reports', 'Reports', 'doc'], ['account', 'My Account', 'user']
    ]
  };

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1z"/><path d="M17 4a4 4 0 0 1 0 7M22 21v-1a5 5 0 0 0-3-4.6"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    pulse: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    check: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9z"/><path d="M9 14l2 2 4-4"/>',
    star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'
  };
  const icon = (n) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

  /* =====================================================
     SEED DATA
  ===================================================== */
  const PERMISSIONS = [
    ['STUDENT_VIEW', 'Student Records'], ['STUDENT_CREATE', 'Student Records'], ['STUDENT_EDIT', 'Student Records'],
    ['STUDENT_DEACTIVATE', 'Student Records'], ['STUDENT_APPROVE', 'Student Records'],
    ['ENROLLMENT_VIEW', 'Enrollment'], ['ENROLLMENT_CREATE', 'Enrollment'], ['ENROLLMENT_EDIT', 'Enrollment'], ['ENROLLMENT_APPROVE', 'Enrollment'],
    ['ATTENDANCE_VIEW', 'Attendance'], ['ATTENDANCE_ENCODE', 'Attendance'], ['ATTENDANCE_EDIT', 'Attendance'],
    ['GRADE_VIEW', 'Grades'], ['GRADE_ENCODE', 'Grades'], ['GRADE_EDIT', 'Grades'], ['GRADE_APPROVE', 'Grades'], ['GRADE_POST', 'Grades'],
    ['REPORT_GENERATE', 'Reports'], ['REPORT_EXPORT', 'Reports'],
    ['USER_MANAGE', 'System'], ['ROLE_MANAGE', 'System'], ['AUDIT_VIEW', 'System'], ['BACKUP_MANAGE', 'System'], ['SYSTEM_CONFIGURE', 'System']
  ];
  const ROLE_ORDER = ['ICT_ADMIN', 'EDTECH', 'DEPT_HEAD', 'FACULTY', 'REGISTRAR', 'STUDENT'];
  const seedPerms = () => ({
    ICT_ADMIN: ['USER_MANAGE', 'ROLE_MANAGE', 'AUDIT_VIEW', 'BACKUP_MANAGE', 'SYSTEM_CONFIGURE', 'REPORT_GENERATE', 'REPORT_EXPORT'],
    EDTECH: ['REPORT_GENERATE', 'ENROLLMENT_VIEW'],
    DEPT_HEAD: ['STUDENT_VIEW', 'ENROLLMENT_VIEW', 'ENROLLMENT_EDIT', 'ATTENDANCE_VIEW', 'GRADE_VIEW', 'GRADE_APPROVE', 'REPORT_GENERATE', 'REPORT_EXPORT'],
    FACULTY: ['ENROLLMENT_VIEW', 'ATTENDANCE_VIEW', 'ATTENDANCE_ENCODE', 'ATTENDANCE_EDIT', 'GRADE_VIEW', 'GRADE_ENCODE', 'GRADE_EDIT', 'REPORT_GENERATE'],
    REGISTRAR: ['STUDENT_VIEW', 'STUDENT_CREATE', 'STUDENT_EDIT', 'STUDENT_DEACTIVATE', 'STUDENT_APPROVE', 'ENROLLMENT_VIEW', 'ENROLLMENT_CREATE', 'ENROLLMENT_EDIT', 'ENROLLMENT_APPROVE', 'ATTENDANCE_VIEW', 'GRADE_VIEW', 'GRADE_APPROVE', 'GRADE_POST', 'REPORT_GENERATE', 'REPORT_EXPORT'],
    STUDENT: ['STUDENT_VIEW', 'ENROLLMENT_VIEW', 'ATTENDANCE_VIEW', 'GRADE_VIEW']
  });

  const mkUser = (id, username, name, email, role, status, mfa, failed, last, created) =>
    ({ id, username, name, email, role, status, failed, lockoutUntil: '', lastLogin: last, mustChange: status === 'Pending Activation', created: created || '2026-06-01' });
  const seedUsers = () => [
    mkUser(1, 'ict.admin', 'Marco Villanueva', 'ict.admin@bits.edu.ph', 'ICT_ADMIN', 'Active', true, 0, '2026-11-09 08:14', '2019-06-03'),
    mkUser(2, 'edtech.staff', 'Lara Mendoza', 'edtech@bits.edu.ph', 'EDTECH', 'Active', true, 0, '2026-11-09 07:50', '2021-01-18'),
    mkUser(3, 'faculty.reyes', 'Daniel Reyes', 'f.reyes@bits.edu.ph', 'FACULTY', 'Active', false, 0, '2026-11-09 07:02', '2020-08-10'),
    mkUser(4, 'registrar.santos', 'Elena Santos', 'e.santos@bits.edu.ph', 'REGISTRAR', 'Active', true, 0, '2026-11-08 16:40', '2018-03-12'),
    mkUser(5, 'dept.cruz', 'Dr. Ramon Cruz', 'r.cruz@bits.edu.ph', 'DEPT_HEAD', 'Active', false, 1, '2026-11-07 13:22', '2017-07-01'),
    mkUser(6, 'faculty.tan', 'Grace Tan', 'g.tan@bits.edu.ph', 'FACULTY', 'Active', false, 0, '2026-11-08 09:31', '2022-08-15'),
    mkUser(7, 'faculty.lim', 'Paolo Lim', 'p.lim@bits.edu.ph', 'FACULTY', 'Locked', false, 5, '2026-11-04 10:05', '2023-01-09'),
    mkUser(8, 'faculty.ocampo', 'Bea Ocampo', 'b.ocampo@bits.edu.ph', 'FACULTY', 'Pending Activation', false, 0, '', '2026-11-05'),
    mkUser(9, 'registrar.dizon', 'Nico Dizon', 'n.dizon@bits.edu.ph', 'REGISTRAR', 'Suspended', false, 0, '2026-09-30 15:12', '2024-02-20'),
    mkUser(10, 'dawson.garcia', 'Dawson James Garcia', 'dawson.garcia@bits.edu.ph', 'STUDENT', 'Active', false, 0, '2026-11-09 06:48', '2024-07-22')
  ];

  const seedAudit = () => {
    const a = (ts, user, mod, ent, rec, act, desc, status, ip, prev, next) => ({ id: 0, ts, user, mod, ent, rec, act, desc, status: status || 'Success', ip: ip || '10.10.1.24', prev: prev || '', next: next || '' });
    const list = [
      a('2026-11-09 08:14', 'ict.admin', 'Authentication', 'Users', 'ict.admin', 'LOGIN', 'Successful login', 'Success', '10.10.1.5'),
      a('2026-11-09 07:50', 'edtech.staff', 'Authentication', 'Users', 'edtech.staff', 'LOGIN', 'Successful login', 'Success', '10.10.2.17'),
      a('2026-11-09 07:02', 'faculty.reyes', 'Authentication', 'Users', 'faculty.reyes', 'LOGIN', 'Successful login', 'Success', '10.10.3.40'),
      a('2026-11-09 02:14', 'SYSTEM', 'Backup', 'BackupHistory', 'BK-0021', 'BACKUP', 'Scheduled full backup completed', 'Success', ''),
      a('2026-11-08 17:05', 'faculty.reyes', 'Attendance', 'AttendanceSessions', 'ITA312R|2026-11-04', 'SUBMIT', 'Attendance submitted for ITA312R 3B', 'Success', '10.10.3.40'),
      a('2026-11-08 16:40', 'registrar.santos', 'Registration', 'Students', '2024-12345', 'UPDATE', 'Updated contact number', 'Success', '10.10.4.8', 'mobile: 0917 000 0000', 'mobile: 0917 123 4567'),
      a('2026-11-07 14:02', 'ict.admin', 'User Accounts', 'Users', 'faculty.ocampo', 'CREATE', 'Created account faculty.ocampo', 'Success', '10.10.1.5'),
      a('2026-11-06 09:10', 'ict.admin', 'Backup', 'BackupHistory', 'BK-0018', 'UPDATE', 'Restore test passed for BK-0018', 'Success', '10.10.1.5'),
      a('2026-11-06 02:12', 'SYSTEM', 'Backup', 'BackupHistory', 'BK-0018', 'BACKUP', 'Scheduled full backup completed', 'Success', ''),
      a('2026-11-05 11:31', 'faculty.lim', 'Authentication', 'Users', 'faculty.lim', 'LOGIN', 'Failed login (wrong password) x5 - account locked', 'Failed', '10.10.3.77'),
      a('2026-11-04 15:20', 'ict.admin', 'User Accounts', 'Users', 'registrar.dizon', 'UPDATE', 'Suspended account registrar.dizon', 'Success', '10.10.1.5', 'status: Active', 'status: Suspended'),
      a('2026-11-03 10:11', 'edtech.staff', 'Scheduling', 'ClassSchedules', 'CO-4', 'UPDATE', 'Changed room for GEN-RP 3B', 'Success', '10.10.2.17', 'room: RM-101', 'room: RM-204'),
      a('2026-11-02 09:45', 'dept.cruz', 'Grades', 'StudentGrades', 'GEN-RP', 'APPROVE', 'Approved Final grades', 'Success', '10.10.5.3'),
      a('2026-10-30 13:09', 'ict.admin', 'Roles', 'RolePermissions', 'FACULTY', 'UPDATE', 'Granted REPORT_GENERATE to FACULTY', 'Success', '10.10.1.5', 'REPORT_GENERATE: not granted', 'REPORT_GENERATE: granted')
    ];
    list.forEach((e, i) => { e.id = list.length - i; });
    return list;
  };

  const seedBackups = () => ({
    config: { frequency: 'Daily', time: '02:00', type: 'Full', location: '/secure/backups/bits-sims', retention: 30, enabled: true },
    history: [
      { id: 'BK-0021', type: 'Full', start: '2026-11-09 02:00', end: '2026-11-09 02:14', size: 1288490188, status: 'Completed', checksum: 'sha256:9f2c\u20268ab1', by: 'SYSTEM', restoreTested: '', failure: '' },
      { id: 'BK-0020', type: 'Full', start: '2026-11-08 02:00', end: '2026-11-08 02:13', size: 1277098598, status: 'Completed', checksum: 'sha256:41ad\u20260e77', by: 'SYSTEM', restoreTested: '', failure: '' },
      { id: 'BK-0019', type: 'Full', start: '2026-11-07 02:00', end: '2026-11-07 02:02', size: 0, status: 'Failed', checksum: '', by: 'SYSTEM', restoreTested: '', failure: 'Storage volume unreachable (timeout after 120 s).' },
      { id: 'BK-0018', type: 'Full', start: '2026-11-06 02:00', end: '2026-11-06 02:12', size: 1265401702, status: 'Completed', checksum: 'sha256:c7e5\u2026b310', by: 'SYSTEM', restoreTested: '2026-11-06', failure: '' },
      { id: 'BK-0017', type: 'Full', start: '2026-11-05 02:00', end: '2026-11-05 02:13', size: 1259292835, status: 'Completed', checksum: 'sha256:7d10\u2026f2c9', by: 'SYSTEM', restoreTested: '', failure: '' },
      { id: 'BK-0016', type: 'Full', start: '2026-11-04 14:30', end: '2026-11-04 14:44', size: 1250819481, status: 'Completed', checksum: 'sha256:aa83\u20263d5e', by: 'ict.admin', restoreTested: '', failure: '' }
    ]
  });

  const seedEvents = () => [
    { id: 'EV-0104', ts: '2026-11-09 07:58', type: 'Performance Alert', module: 'Reports', desc: 'Report generation queue exceeded 8 s average.', severity: 'Warning', status: 'Investigating', by: '', resolved: '' },
    { id: 'EV-0103', ts: '2026-11-08 22:40', type: 'Database Issue', module: 'Attendance', desc: 'Slow query on AttendanceRecords (3.1 s).', severity: 'Error', status: 'Open', by: '', resolved: '' },
    { id: 'EV-0102', ts: '2026-11-07 02:02', type: 'Application Error', module: 'Backup', desc: 'Scheduled backup BK-0019 failed: storage unreachable.', severity: 'Critical', status: 'Resolved', by: 'ict.admin', resolved: '2026-11-07 09:30' },
    { id: 'EV-0101', ts: '2026-11-05 11:31', type: 'Server Warning', module: 'Authentication', desc: 'Repeated failed logins for faculty.lim (5).', severity: 'Warning', status: 'Resolved', by: 'ict.admin', resolved: '2026-11-05 11:50' },
    { id: 'EV-0100', ts: '2026-11-03 08:15', type: 'Performance Alert', module: 'Enrollment', desc: 'Peak enrollment load: 1,040 concurrent sessions.', severity: 'Information', status: 'Resolved', by: 'ict.admin', resolved: '2026-11-03 10:00' }
  ];

  // Scope for now: 3rd year only, all classes face-to-face
  const YEAR_LEVEL = '3rd Year';
  const MODALITY = 'Face-to-Face';
  // Rooms come from the Registrar's Academic Setup; rooms under maintenance can't be booked
  const ROOMS_ALL = () => (window.SIMSRegistry ? SIMSRegistry.get().setup.Rooms : []).map((r) => ({ code: r[0], status: r[3] }));
  const ROOMS_OK = () => ROOMS_ALL().filter((r) => r.status !== 'Under Maintenance').map((r) => r.code);
  const seedClasses = () => [
    { id: 'CO-1', code: 'ITP3112R', title: 'System Administration and Maintenance 1', section: '3B', year: '3rd Year', faculty: 'faculty.reyes', day: 'Monday', start: '08:00', end: '11:00', room: 'ITLAB-01', modality: 'Face-to-Face', type: 'Combined', capacity: 40, size: 8, status: 'Open' },
    { id: 'CO-2', code: 'ITP3111R', title: 'Network Management 2', section: '3B', year: '3rd Year', faculty: 'faculty.reyes', day: 'Tuesday', start: '13:00', end: '16:00', room: 'ITLAB-02', modality: 'Face-to-Face', type: 'Combined', capacity: 40, size: 8, status: 'Open' },
    { id: 'CO-3', code: 'ITA312R', title: 'Platform Technologies 3 (Cloud Computing)', section: '3B', year: '3rd Year', faculty: 'faculty.reyes', day: 'Wednesday', start: '09:00', end: '12:00', room: 'ITLAB-01', modality: 'Face-to-Face', type: 'Combined', capacity: 40, size: 8, status: 'Open' },
    { id: 'CO-4', code: 'GEN-RP', title: 'Readings in Philippine History', section: '3B', year: '3rd Year', faculty: 'faculty.tan', day: 'Friday', start: '10:00', end: '12:00', room: 'RM-204', modality: 'Face-to-Face', type: 'Lecture', capacity: 45, size: 8, status: 'Open' }
  ];

  const ROSTER = [
    { sn: '2024-12345', name: 'Dawson James Garcia' }, { sn: '2024-10231', name: 'Angela Mae Bautista' },
    { sn: '2024-10477', name: 'Carlo Miguel Dela Cruz' }, { sn: '2024-10586', name: 'Jasmine Faith Ramos' },
    { sn: '2024-10902', name: 'Kyle Andrei Navarro' }, { sn: '2024-11019', name: 'Marianne Joy Santiago' },
    { sn: '2024-11248', name: 'Paolo Enrico Villanueva' }, { sn: '2024-11373', name: 'Trisha Anne Mercado' }
  ];
  const PERIODS = ['Final'];   // Finals only for now (add 'Midterm' back here if needed)
  const DAY_IDX = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

  // Grading scale (matches the student portal: 1.00 highest, 3.00 passing, 5.00 failed)
  const SCALE = [[97, 1.00], [94, 1.25], [91, 1.50], [88, 1.75], [85, 2.00], [82, 2.25], [79, 2.50], [76, 2.75], [75, 3.00]];
  const toGrade = (pct) => { for (const [min, g] of SCALE) if (pct >= min) return g; return 5.00; };

  function meetingDates(c) {
    const d = new Date(2026, 7, 3);
    while (d.getDay() !== DAY_IDX[c.day]) d.setDate(d.getDate() + 1);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const out = [];
    while (d <= end) { out.push(isoDate(d)); d.setDate(d.getDate() + 7); }
    return out.reverse().slice(0, 10);
  }

  // Sample Finals states: 2 posted, 1 approved (waiting for the Registrar),
  // 1 still a draft so the whole Faculty -> Dept Head -> Registrar chain can be demoed
  const SEED_STATUS = { 'CO-1': 'Posted', 'CO-4': 'Posted', 'CO-2': 'Approved', 'CO-3': 'Draft' };

  function seedFaculty() {
    const fac = { attendance: {}, assessments: [], scores: {}, gradeStatus: {}, alerts: [], corrections: [], overrides: {}, postedAt: {} };
    const classes = seedClasses();
    classes.forEach((c, ci) => {
      fac.attendance[c.id] = {};
      meetingDates(c).slice(1).forEach((date, di) => {   // newest meeting stays open (a pending task)
        const rows = {};
        ROSTER.forEach((s, si) => {
          const r = rnd(ci * 100 + di * 10 + si + 1);
          const status = r > 0.93 ? 'Absent' : r > 0.84 ? 'Late' : 'Present';
          rows[s.sn] = { status, timeIn: status === 'Absent' ? '' : (status === 'Late' ? '' + (c.start.slice(0, 2)) + ':' + pad(12 + si) : c.start), timeOut: '', remarks: '' };
        });
        fac.attendance[c.id][date] = { status: 'Submitted', rows, recordedAt: date + ' 17:00' };
      });
      [['Quiz 1', 'Quiz', 20, 20], ['Quiz 2', 'Quiz', 30, 20], ['Final Examination', 'Examination', 50, 60]].forEach(([name, type, max, weight], i) => {
        const id = `A-${c.id}-${i + 1}`;
        fac.assessments.push({ id, classId: c.id, period: 'Final', name, type, max, weight, date: '2026-11-' + pad(2 + i * 2) });
        fac.scores[id] = {};
        ROSTER.forEach((s, si) => { fac.scores[id][s.sn] = Math.round(max * (0.7 + rnd(ci * 50 + i * 9 + si + 3) * 0.28)); });
      });
      fac.gradeStatus[`${c.id}|Final`] = SEED_STATUS[c.id] || 'Draft';
      if (fac.gradeStatus[`${c.id}|Final`] === 'Posted') fac.postedAt[`${c.id}|Final`] = '2026-11-06 15:30';
    });
    return fac;
  }

  const seedPolicy = () => ({ maxFailed: 5, lockMin: 15, minPw: 8, timeoutMin: 20 });
  const seedAlertCfg = () => ({ maxAbsences: 3, tardiness: 3, enabled: true });

  /* =====================================================
     STATE
  ===================================================== */
  const db = {
    users: load(K.users, seedUsers), perms: load(K.perms, seedPerms), audit: load(K.audit, seedAudit),
    backups: load(K.backups, seedBackups), events: load(K.events, seedEvents), classes: load(K.classes, seedClasses),
    fac: load(K.fac, seedFaculty), policy: load(K.policy, seedPolicy), alertCfg: load(K.alerts, seedAlertCfg),
    reports: load(K.reports, () => []), pw: load(K.pw, () => ({})), locks: load(K.locks, () => ({}))
  };
  const save = (...names) => names.forEach((n) => persist(K[n === 'alertCfg' ? 'alerts' : n], db[n]));
  db.fac.corrections = db.fac.corrections || [];
  db.fac.overrides = db.fac.overrides || {};
  queueSync();   // bring the academic records in line with the faculty data on load
  // Raise attendance alerts for what is already recorded (not only on the next submit)
  Promise.resolve().then(() => db.classes.forEach((c) => evaluateAlerts(c)));

  // Another tab (e.g. the Registrar or a faculty member) changed staff data: reload it here
  window.addEventListener('storage', (e) => {
    const name = Object.keys(K).find((n) => K[n] === e.key);
    const prop = name === 'alerts' ? 'alertCfg' : name;
    if (!prop || !(prop in db) || e.newValue === null) return;
    try { db[prop] = JSON.parse(e.newValue); } catch (err) { /* ignore bad data */ }
  });

  let me = null;          // signed-in staff account
  let page = 'dashboard';
  let root = null;
  let modalOk = null;
  let toastTimer = null;
  let monTimer = null;
  let idleTimer = null;
  let lastActive = Date.now();
  let metrics = null;
  let rolesDraft = null;

  const ui = {
    acct: { q: '', status: 'all', role: 'all' },
    audit: { q: '', mod: 'all', status: 'all' },
    att: { cls: '', date: '', draft: null, key: '' },
    gr: { cls: '', period: 'Final' },
    stu: { q: '', status: 'all' },
    rep: { id: '', cls: '', date: '', period: 'Final', from: '', to: '', result: null }
  };

  const can = (cap) => me && CAPS[me.role].includes(cap);
  const userName = (username) => { const u = db.users.find((x) => x.username === username); return u ? u.name : username; };

  // Sample workstation IPs per role (shown in the audit trail)
  const ROLE_IP = { ICT_ADMIN: '10.10.1.5', EDTECH: '10.10.2.17', FACULTY: '10.10.3.40', REGISTRAR: '10.10.4.8', DEPT_HEAD: '10.10.5.3', STUDENT: '10.10.6.21' };
  const ipFor = (username) => { const u = db.users.find((x) => x.username === username); return (u && ROLE_IP[u.role]) || '10.10.1.24'; };
  // Login accounts are always recorded by username in the audit trail
  const userRec = (ent, rec) => { if (ent !== 'Users') return rec; const m = /^U-(\d+)$/.exec(String(rec)); const u = m && db.users.find((x) => x.id === Number(m[1])); return u ? u.username : rec; };
  function audit(mod, ent, rec, act, desc, status, prev, next) {
    db.audit.unshift({ id: (db.audit[0] ? db.audit[0].id : 0) + 1, ts: nowStamp(), user: me ? me.username : 'SYSTEM', mod, ent, rec: userRec(ent, rec), act, desc, status: status || 'Success', ip: me ? ipFor(me.username) : '10.10.1.24', prev: prev || '', next: next || '' });
    if (db.audit.length > 300) db.audit.length = 300;
    save('audit');
  }

  /* =====================================================
     AUTHENTICATION
  ===================================================== */
  const findAccount = (id) => {
    const key = String(id || '').trim().toLowerCase();
    return ACCOUNTS.find((a) => a.username === key || a.email === key) || null;
  };

  function isStaffUser(username) { return Boolean(findAccount(username)); }

  function authenticate(username, password) {
    const acc = findAccount(username);
    if (!acc) return { ok: false, message: 'Account not found.' };
    const rec = db.users.find((u) => u.username === acc.username);
    const lock = db.locks[acc.username] || { fails: 0, until: 0 };

    if (rec && (rec.status === 'Suspended' || rec.status === 'Inactive')) return { ok: false, message: `This account is ${rec.status.toLowerCase()}. Please contact ICT Services.` };
    if (lock.until && Date.now() < lock.until) {
      const mins = Math.ceil((lock.until - Date.now()) / 60000);
      return { ok: false, message: `Too many failed attempts. This account is locked for about ${mins} more minute(s). You can also reset your password.` };
    }

    const current = db.pw[acc.username] || acc.pwHash;
    if (hash(password) !== current) {
      lock.fails = (lock.fails || 0) + 1;
      if (lock.fails >= db.policy.maxFailed) {
        lock.until = Date.now() + db.policy.lockMin * 60000;
        lock.fails = 0;
        if (rec) { rec.status = 'Locked'; rec.lockoutUntil = new Date(lock.until).toISOString(); save('users'); }
      }
      if (rec) { rec.failed = lock.fails || db.policy.maxFailed; save('users'); }
      db.locks[acc.username] = lock; save('locks');
      me = acc; audit('Authentication', 'Users', 'U-' + (rec ? rec.id : '?'), 'LOGIN', 'Failed login (wrong password)', 'Failed'); me = null;
      // Generic message: don't reveal whether the username exists (same as auth.js)
      return { ok: false, message: lock.until ? `Too many failed attempts. The account is locked for ${db.policy.lockMin} minutes. You can also reset your password.` : 'Incorrect username or password.' };
    }

    db.locks[acc.username] = { fails: 0, until: 0 }; save('locks');
    if (rec) { rec.failed = 0; rec.lockoutUntil = ''; rec.lastLogin = nowStamp(); if (rec.status === 'Locked') rec.status = 'Active'; save('users'); }
    return { ok: true, account: acc };
  }

  // Forgot-password reset (called by auth.js once the one-time code checks out).
  // Sets the new password and lifts a lockout; suspended accounts stay suspended.
  function setPassword(username, pw) {
    const acc = findAccount(username);
    if (!acc) return false;
    db.pw[acc.username] = hash(pw); save('pw');
    db.locks[acc.username] = { fails: 0, until: 0 }; save('locks');
    const rec = db.users.find((u) => u.username === acc.username);
    if (rec) { rec.failed = 0; rec.lockoutUntil = ''; rec.mustChange = false; if (rec.status === 'Locked') rec.status = 'Active'; save('users'); }
    return true;
  }

  /* =====================================================
     SHELL
  ===================================================== */
  const initials = (name) => name.replace(/^(Dr\.|Prof\.)\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  function buildShell() {
    root = $('#staffView');
    if (!root) {
      root = document.createElement('div');
      root.id = 'staffView';
      root.className = 'dashboard-wrapper hidden';
      document.body.appendChild(root);
    }
    const label = { ICT_ADMIN: 'ICT Services Console', EDTECH: 'EdTech Services Console', DEPT_HEAD: 'Department Head Portal', FACULTY: 'Faculty Portal' }[me.role];
    root.innerHTML = `
      <header class="top-nav">
        <div class="nav-brand">
          <img src="images/BITS_WHITE-BLUE LOGO 2.png" alt="BITS-SIMS Logo" class="nav-logo" />
          <span class="nav-title">BITS-SIMS</span>
          <span class="staff-role-chip">${esc(label)}</span>
        </div>
        <div class="nav-user-area">
          <span class="nav-page-label" id="stPageLabel">Dashboard</span>
          <span class="nav-divider" aria-hidden="true"></span>
          <button type="button" class="user-avatar-badge staff-avatar" data-nav="account" aria-label="My account" title="${esc(me.name)}">${esc(initials(me.name))}</button>
        </div>
      </header>
      <div class="app-layout">
        <nav class="sidebar" aria-label="Main Navigation">
          <ul class="sidebar-menu">
            ${NAV[me.role].map(([key, text, ic]) => `<li><a href="#" class="sidebar-item" data-nav="${key}">${icon(ic)}<span>${esc(text)}</span></a></li>`).join('')}
            <li><a href="#" class="sidebar-item logout-link" data-act="logout">${icon('out')}<span>Log Out</span></a></li>
          </ul>
        </nav>
        <main class="dashboard-main"><div id="stMain" class="dm-panel staff-panel"></div></main>
      </div>
      <div id="stModal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="stModalTitle">
        <div class="modal-card staff-modal-card">
          <header class="modal-head"><h3 id="stModalTitle"></h3><button type="button" class="modal-close" data-act="modal-close" aria-label="Close">&times;</button></header>
          <div class="modal-body" id="stModalBody"></div>
          <footer class="modal-foot" id="stModalFoot">
            <button type="button" class="btn-light btn-sm" data-act="modal-close" id="stModalCancel">Cancel</button>
            <button type="button" class="btn-solid btn-sm" data-act="modal-ok" id="stModalOk">Save</button>
          </footer>
        </div>
      </div>
      <div id="stToast" class="toast" role="status" aria-live="polite"></div>`;
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('submit', onSubmit);
  }

  function toast(msg, type) {
    const el = $('#stToast');
    if (!el) return;
    el.textContent = msg;
    el.className = `toast ${type || 'success'} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function openModal({ title, body, ok = 'Save', cancel = 'Cancel', onOk, hideFoot }) {
    $('#stModalTitle').textContent = title;
    $('#stModalBody').innerHTML = body;
    $('#stModalOk').textContent = ok;
    $('#stModalCancel').textContent = cancel;
    $('#stModalFoot').classList.toggle('hidden', Boolean(hideFoot));
    modalOk = onOk || null;
    $('#stModal').classList.remove('hidden');
    const first = $('#stModalBody input, #stModalBody select, #stModalBody textarea');
    if (first) first.focus(); else $('#stModalOk').focus();
  }
  function closeModal() { $('#stModal').classList.add('hidden'); modalOk = null; $('#stModalBody').innerHTML = ''; }
  function ask(title, message, label, fn, danger) {
    openModal({ title, body: `<p class="dm-modal-note staff-ask">${esc(message)}</p>`, ok: label, onOk: () => { fn(); } });
    $('#stModalOk').classList.toggle('btn-danger', Boolean(danger));
  }

  function go(key) {
    if (!NAV[me.role].some((n) => n[0] === key)) key = 'dashboard';
    page = key;
    clearInterval(monTimer); monTimer = null;
    $$('.sidebar-item[data-nav]', root).forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
    const item = NAV[me.role].find((n) => n[0] === key);
    $('#stPageLabel').textContent = key === 'dashboard' ? 'Dashboard' : item[1];
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const fn = PAGES[page];
    $('#stMain').innerHTML = fn ? fn() : '';
    if (page === 'monitoring') monTimer = setInterval(tickMetrics, 4000);
    if (page === 'accounts') refreshAccounts();
    if (page === 'audit') refreshAudit();
    if (page === 'attendance') updateAttSummary();
    if (page === 'students') refreshStudents();
  }

  /* ---------- small view helpers ---------- */
  const STATUS_CLS = {
    Active: 'ok', Completed: 'ok', Resolved: 'ok', Success: 'ok', Normal: 'ok', Present: 'ok', Verified: 'ok', Open: 'warn', Approved: 'ok',
    'Pending Activation': 'warn', Pending: 'warn', Draft: 'warn', Warning: 'warn', Late: 'warn', 
    Running: 'info', Investigating: 'info', Submitted: 'info', Excused: 'info', Information: 'info',
    Suspended: 'risk', Locked: 'risk', Failed: 'risk', Critical: 'risk', Error: 'risk', Absent: 'risk',
    Inactive: 'muted', Full: 'warn', Posted: 'ok', Returned: 'risk', 'On Leave': 'warn', Archived: 'muted'
  };
  const badge = (s) => `<span class="dm-status ${STATUS_CLS[s] || 'muted'}">${esc(s)}</span>`;
  const head = (title, sub, extra) => `<header class="adm-head"><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>${extra || ''}</header>`;
  const stat = (label, value, sub, tone) => `<div class="dash-card dm-card staff-stat ${tone || ''}"><span class="dm-stat-label">${esc(label)}</span><span class="dm-stat-value">${value}</span><span class="dm-stat-sub">${esc(sub || '')}</span></div>`;
  // Password box with a Show/Hide button (same look as the student settings)
  const pwInput = (id, ac) => `<div class="pw-wrap"><input id="${id}" type="password" autocomplete="${ac}" /><button type="button" class="pw-toggle" data-act="pw-toggle" data-target="${id}" aria-pressed="false" aria-label="Show password">Show</button></div>`;
  // Dates shown to people: "Nov 12, 2026, 11:39 PM" (stored as YYYY-MM-DD HH:MM)
  const fmtStamp = (ts) => {
    if (!ts) return '\u2014';
    const [d, t] = String(ts).split(' ');
    const [y, m, day] = d.split('-').map(Number);
    if (!t) return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const [h, mi] = t.split(':').map(Number);
    return new Date(y, m - 1, day, h, mi).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const table = (cols, rows, empty, id) => `
    <div class="dm-table-wrap staff-table-wrap"><table class="dm-table staff-table" ${id ? `id="${id}"` : ''}>
      <thead><tr>${cols.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.length ? rows.join('') : `<tr><td colspan="${cols.length}" class="dm-empty">${esc(empty || 'Nothing to show.')}</td></tr>`}</tbody>
    </table></div>`;
  const card = (title, body, cls) => `<section class="dash-card dm-card staff-card ${cls || ''}">${title ? `<h3 class="adm-sec-title">${esc(title)}</h3>` : ''}${body}</section>`;
  const opts = (list, sel, all) => (all ? `<option value="all">${esc(all)}</option>` : '') + list.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const field = (id, label, input, hint) => `<div class="set-field"><label for="${id}">${esc(label)}</label>${input}${hint ? `<small class="set-hint">${esc(hint)}</small>` : ''}<small class="set-error" id="${id}Error"></small></div>`;
  const setErr = (id, msg) => { const e = $('#' + id + 'Error'); if (e) e.textContent = msg || ''; const i = $('#' + id); if (i) i.setAttribute('aria-invalid', msg ? 'true' : 'false'); };
  const recentAudit = (n, full, id) => table(full ? ['Time', 'User', 'Action', 'Description', 'Status'] : ['Time', 'Action', 'Description', 'Status'],
    db.audit.slice(0, n).map((a) => `<tr><td>${esc(fmtStamp(a.ts))}</td>${full ? `<td>${esc(a.user)}</td>` : ''}<td>${esc(a.act)}</td><td>${esc(a.desc)}</td><td>${badge(a.status)}</td></tr>`), undefined, id);

  /* =====================================================
     MONITORING DATA (simulated)
  ===================================================== */
  const METRIC_DEFS = [
    { key: 'resp', name: 'API response time', unit: 'ms', base: 220, jit: 80, warn: 500, crit: 1000, dec: 0 },
    { key: 'sess', name: 'Concurrent sessions', unit: '', base: 310, jit: 90, warn: 800, crit: 1200, dec: 0 },
    { key: 'cpu', name: 'CPU utilization', unit: '%', base: 46, jit: 14, warn: 70, crit: 90, dec: 0 },
    { key: 'dbq', name: 'Database query time', unit: 'ms', base: 95, jit: 45, warn: 200, crit: 500, dec: 0 },
    { key: 'err', name: 'Error rate', unit: '%', base: 0.4, jit: 0.5, warn: 1, crit: 5, dec: 2 },
    { key: 'avail', name: 'Database availability', unit: '%', base: 99.97, jit: 0.04, warn: 99.5, crit: 99, dec: 2, invert: true }
  ];
  const metricStatus = (d, v) => d.invert ? (v < d.crit ? 'Critical' : v < d.warn ? 'Warning' : 'Normal') : (v >= d.crit ? 'Critical' : v >= d.warn ? 'Warning' : 'Normal');
  function tickMetrics(force) {
    metrics = METRIC_DEFS.map((d, i) => {
      const v = d.base + (rnd(Date.now() / 4000 + i) - 0.5) * 2 * d.jit;
      return { d, v: d.invert ? Math.min(100, v) : Math.max(0, v) };
    });
    const box = $('#stMetrics');
    if (box) box.innerHTML = metricsHtml();
    if (force === true) toast('Metrics refreshed.', 'info');
  }
  function metricsHtml() {
    if (!metrics) tickMetrics();
    return metrics.map(({ d, v }) => {
      const st = metricStatus(d, v);
      const pct = d.invert ? Math.max(4, Math.min(100, (v - 98) / 2 * 100)) : Math.min(100, (v / d.crit) * 100);
      return `<div class="dash-card dm-card staff-metric"><span class="dm-stat-label">${esc(d.name.toUpperCase())}</span>
        <span class="dm-stat-value">${v.toFixed(d.dec)}<small>${esc(d.unit)}</small></span>
        <span class="staff-meter ${st.toLowerCase()}"><span style="width:${pct.toFixed(0)}%"></span></span>
        <span class="dm-stat-sub">${badge(st)} warn ${d.invert ? '&lt;' : '&ge;'} ${d.warn}${esc(d.unit)}</span></div>`;
    }).join('');
  }
  const healthSummary = () => { if (!metrics) tickMetrics(); const s = metrics.map(({ d, v }) => metricStatus(d, v)); return s.includes('Critical') ? 'Critical' : s.includes('Warning') ? 'Warning' : 'Normal'; };

  /* =====================================================
     CLASS HELPERS (schedules, conflicts, faculty scope)
  ===================================================== */
  const myClasses = () => db.classes.filter((c) => c.faculty === me.username && c.status !== 'Cancelled');
  const overlap = (a, b) => a.day === b.day && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
  function findConflicts(c) {
    const out = [];
    db.classes.forEach((o) => {
      if (o.id === c.id || o.status === 'Cancelled' || !overlap(c, o)) return;
      if (o.room === c.room) out.push(`Room ${c.room} is already used by ${o.code} ${o.section} (${fmtTime(o.start)}\u2013${fmtTime(o.end)}).`);
      if (o.faculty === c.faculty) out.push(`${userName(c.faculty)} already teaches ${o.code} ${o.section} at that time.`);
    });
    return out;
  }
  const totalConflicts = () => db.classes.reduce((n, c) => n + findConflicts(c).length, 0) / 2;
  const schedText = (c) => `${c.day.slice(0, 3)} ${fmtTime(c.start)}\u2013${fmtTime(c.end)}`;

  /* =====================================================
     PAGES
  ===================================================== */
  const PAGES = {};

  /* ---------- DASHBOARDS ---------- */
  PAGES.dashboard = () => {
    const u = db.users;
    if (me.role === 'ICT_ADMIN') {
      const last = db.backups.history.find((b) => b.status === 'Completed');
      return `${head(`Welcome back, ${me.name.split(' ')[0]}`, 'System administration overview for BITS-SIMS.')}
        <div class="staff-stats">
          ${stat('TOTAL ACCOUNTS', u.length, `${u.filter((x) => x.status === 'Active').length} active`)}
          ${stat('NEED ATTENTION', u.filter((x) => ['Locked', 'Suspended', 'Pending Activation'].includes(x.status)).length, 'Locked, suspended or pending')}
          ${(() => { const open = db.events.filter((e) => e.status !== 'Resolved'), bad = open.filter((e) => ['Error', 'Critical'].includes(e.severity)).length; return stat('OPEN SYSTEM EVENTS', open.length, bad ? `Needs attention: ${bad} error${bad === 1 ? '' : 's'} open` : `System health: ${healthSummary()}`); })()}
          ${stat('LAST GOOD BACKUP', last ? fmtDate(last.end) : '\u2014', last ? `${last.id} \u00B7 ${fmtBytes(last.size)}` : 'No completed backup', 'is-blue')}
        </div>
        <div class="staff-split">
          ${card('Recent activity', recentAudit(7, true, 'dashRecent'))}
          <div class="staff-stack">
            ${card('Quick actions', `<div class="staff-quick">
              <button type="button" class="btn-solid" data-act="acct-add">+ New account</button>
              <button type="button" class="btn-light" data-nav="audit">Open audit trail</button>
              <button type="button" class="btn-light" data-nav="backups">Backups</button>
              <button type="button" class="btn-light" data-nav="monitoring">Monitoring</button></div>`)}
            ${card('Accounts by role', `<ul class="staff-bars">${ROLE_ORDER.map((r) => { const n = u.filter((x) => x.role === r).length; return `<li><span>${esc(ROLE_LABEL[r])}</span><span class="staff-bar"><span style="width:${(n / u.length) * 100}%"></span></span><strong>${n}</strong></li>`; }).join('')}</ul>`)}
          </div>
        </div>`;
    }
    if (me.role === 'EDTECH') {
      const help = u.filter((x) => ['Locked', 'Pending Activation'].includes(x.status) && x.role !== 'ICT_ADMIN');
      return `${head(`Welcome back, ${me.name.split(' ')[0]}`, 'Education technology operations: schedules, class assignments and platform health.')}
        <div class="staff-stats">
          ${(() => { const bad = db.events.filter((e) => e.status !== 'Resolved' && ['Error', 'Critical'].includes(e.severity)).length; return bad ? stat('PLATFORM HEALTH', 'Attention', `${bad} error event${bad === 1 ? '' : 's'} still open`) : stat('PLATFORM HEALTH', healthSummary(), 'From live monitoring'); })()}
          ${stat('OPEN SYSTEM EVENTS', db.events.filter((e) => e.status !== 'Resolved').length, 'Awaiting resolution')}
          ${stat('CLASS OFFERINGS', db.classes.length, `${totalConflicts()} schedule conflict(s)`)}
          ${stat('ACCOUNTS NEEDING HELP', help.length, 'Locked or pending activation', 'is-blue')}
        </div>
        <div class="staff-split">
          ${card('Open system events', table(['Event', 'Description', 'Severity', 'Status'], db.events.filter((e) => e.status !== 'Resolved').map((e) => `<tr><td><strong>${esc(e.id)}</strong><br><small>${esc(fmtStamp(e.ts))}</small></td><td>${esc(e.desc)}<br><small>${esc(e.module)}</small></td><td>${badge(e.severity)}</td><td>${badge(e.status)}</td></tr>`), 'No open events.', 'edEvents'))}
          <div class="staff-stack">
            ${card('Quick actions', `<div class="staff-quick"><button type="button" class="btn-solid" data-nav="classes">Manage schedules</button><button type="button" class="btn-light" data-nav="monitoring">Monitoring</button><button type="button" class="btn-light" data-nav="accounts">Account support</button></div>`)}
            ${card('Accounts needing help', help.length ? `<ul class="staff-list">${help.map((x) => `<li><div><strong>${esc(x.name)}</strong><small>${esc(x.username)} \u00B7 ${esc(ROLE_LABEL[x.role])}</small></div>${badge(x.status)}</li>`).join('')}</ul>` : '<p class="dm-modal-note">No locked or pending accounts.</p>')}
          </div>
        </div>`;
    }
    if (me.role === 'DEPT_HEAD') {
      const waiting = gradeSheetsList().filter((s) => s.status === 'Submitted'), studs = deptStudents();
      const facs = [...new Set(db.classes.map((c) => c.faculty))];
      return `${head(`Welcome back, ${me.name}`, `${me.dept} Department \u00B7 1st Semester, AY 2026\u20132027`)}
        <div class="staff-stats">
          ${stat('GRADES TO REVIEW', waiting.length, waiting.length ? 'Submitted by faculty' : 'Nothing waiting')}
          ${stat('CLASS OFFERINGS', db.classes.length, `${totalConflicts()} schedule conflict(s)`)}
          ${stat('ACTIVE STUDENTS', studs.filter((s) => s.status === 'Active').length, `of ${studs.length} department students on record`)}
          ${stat('FACULTY TEACHING', facs.length, 'With at least one class', 'is-blue')}
        </div>
        <div class="staff-split">
          ${card('Grade sheets awaiting review', table(['Course', 'Faculty', ...(PERIODS.length > 1 ? ['Period'] : []), ''], waiting.map((g) => `<tr><td><strong>${esc(g.code)}</strong> ${esc(g.section)}<br><small>${esc(g.title)}</small></td><td>${esc(g.faculty)}</td>${PERIODS.length > 1 ? `<td>${esc(g.period)}</td>` : ''}<td><button type="button" class="btn-solid btn-sm" data-act="rev-open" data-id="${g.classId}" data-period="${g.period}">Review</button></td></tr>`), 'No grade sheets are waiting for your review.'))}
          <div class="staff-stack">
            ${card('Quick actions', `<div class="staff-quick"><button type="button" class="btn-solid" data-act="cls-new">+ New class offering</button><button type="button" class="btn-light" data-nav="review">Grade review</button><button type="button" class="btn-light" data-nav="attendance">Attendance</button></div>`)}
            ${card('Faculty workload', `<ul class="staff-list">${facs.map((u) => { const mine = db.classes.filter((c) => c.faculty === u); return `<li><div><strong>${esc(userName(u))}</strong><small>${esc(mine.map((c) => c.code).join(', '))}</small></div><span>${mine.length} class${mine.length === 1 ? '' : 'es'}</span></li>`; }).join('')}</ul>`)}
          </div>
        </div>`;
    }
    // Faculty
    const cls = myClasses();
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todays = cls.filter((c) => c.day === dayName);
    const attTasks = cls.filter((c) => { const d = meetingDates(c)[0]; const s = db.fac.attendance[c.id] && db.fac.attendance[c.id][d]; return d && !(s && s.status === 'Submitted'); });
    const gradeTasks = [];
    cls.forEach((c) => PERIODS.forEach((p) => { if (db.fac.assessments.some((a) => a.classId === c.id && a.period === p) && ['Draft', 'Returned'].includes(db.fac.gradeStatus[`${c.id}|${p}`] || 'Draft')) gradeTasks.push([c, p]); }));
    return `${head(`Welcome back, ${me.name.split(' ')[0]}`, `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} \u00B7 1st Semester, AY 2026\u20132027`)}
      <div class="staff-stats">
        ${stat('ASSIGNED CLASSES', cls.length, `${cls.length ? ROSTER.length : 0} students \u00B7 ${cls.reduce((n, c) => n + c.size, 0)} class enrollments`)}
        ${stat('CLASSES TODAY', todays.length, todays.length ? todays.map((c) => c.code).join(', ') : 'No class meetings today')}
        ${stat('ATTENDANCE TO SUBMIT', attTasks.length, 'Latest meeting not yet submitted')}
        ${stat('GRADES TO SUBMIT', gradeTasks.length, 'Grade sheets still in draft', 'is-blue')}
      </div>
      <div class="staff-split">
        <div class="staff-stack">
          ${card('Today\u2019s schedule', todays.length ? `<ul class="staff-list">${todays.map((c) => `<li><div><strong>${esc(c.code)} \u00B7 ${esc(c.title)}</strong><small>${esc(c.section)} \u00B7 ${fmtTime(c.start)}\u2013${fmtTime(c.end)} \u00B7 ${esc(c.room)}</small></div><button type="button" class="btn-solid btn-sm" data-act="att-open" data-id="${c.id}">Take attendance</button></li>`).join('')}</ul>` : '<p class="dm-modal-note">You have no class meetings today.</p>')}
          ${card('My classes', table(['Course', 'Schedule', 'Room', 'Students'], cls.map((c) => `<tr><td><strong>${esc(c.code)} \u00B7 ${esc(c.section)}</strong><br><small>${esc(c.title)}</small></td><td>${esc(schedText(c))}</td><td>${esc(c.room)}</td><td>${c.size}/${c.capacity}</td></tr>`), undefined, 'dashClasses'))}
        </div>
        <div class="staff-stack">
          ${card('To do', `<ul class="staff-list">${attTasks.map((c) => `<li><div><strong>Submit attendance</strong><small>${esc(c.code)} ${esc(c.section)} \u00B7 ${fmtDate(meetingDates(c)[0])}</small></div><button type="button" class="btn-light btn-sm" data-act="att-open" data-id="${c.id}">Open</button></li>`).join('')}${gradeTasks.map(([c, p]) => `<li><div><strong>Submit ${esc(p)} grades</strong><small>${esc(c.code)} ${esc(c.section)}</small></div><button type="button" class="btn-light btn-sm" data-act="gr-open" data-id="${c.id}" data-period="${p}">Open</button></li>`).join('')}</ul>${attTasks.length + gradeTasks.length ? '' : '<p class="dm-modal-note">You\u2019re all caught up.</p>'}`)}
          ${(() => { const mine = db.fac.alerts.filter((a) => cls.some((c) => c.id === a.cls)); return card('Attendance alerts', mine.length ? `<ul class="staff-list">${mine.slice(0, 5).map((a) => `<li><div><strong>${esc(a.student)}</strong><small>${esc(a.message)}</small></div>${badge(a.type === 'Absence' ? 'Absent' : 'Late')}</li>`).join('')}</ul>` : '<p class="dm-modal-note">No students have crossed an alert threshold.</p>'); })()}
        </div>
      </div>`;
  };

  /* ---------- USER ACCOUNTS ---------- */
  PAGES.accounts = () => {
    const full = can('accounts.manage');
    return `${head(full ? 'User Accounts' : 'Account Support', full ? 'Create, update, lock and reset login accounts. Institutional student and staff records are not affected.' : 'Help users who are locked out. You can unlock accounts and issue password-reset codes; you cannot change roles or personal details.', full ? '<button type="button" class="btn-solid" data-act="acct-add">+ New account</button>' : '')}
      <div class="staff-stats">
        ${stat('ACTIVE', db.users.filter((x) => x.status === 'Active').length, 'Can sign in')}
        ${stat('LOCKED', db.users.filter((x) => x.status === 'Locked').length, 'Too many failed logins')}
        ${stat('SUSPENDED', db.users.filter((x) => x.status === 'Suspended').length, 'Access blocked')}
        ${stat('PENDING', db.users.filter((x) => x.status === 'Pending Activation').length, 'Not yet activated')}
      </div>
      ${card('', `<div class="staff-toolbar">
        <input type="search" id="acctQ" class="dm-select staff-search" placeholder="Search name, username or email" value="${esc(ui.acct.q)}" aria-label="Search accounts" />
        <select id="acctStatus" class="dm-select" aria-label="Filter by status">${opts(['Active', 'Pending Activation', 'Inactive', 'Suspended', 'Locked'].map((s) => [s, s]), ui.acct.status, 'All statuses')}</select>
        ${full ? `<select id="acctRole" class="dm-select" aria-label="Filter by role">${opts(ROLE_ORDER.map((r) => [r, ROLE_LABEL[r]]), ui.acct.role, 'All roles')}</select>` : ''}
      </div><div id="acctTable"></div>`)}`;
  };
  function refreshAccounts() {
    const full = can('accounts.manage');
    const q = ui.acct.q.toLowerCase();
    const list = db.users.filter((u) => (ui.acct.status === 'all' || u.status === ui.acct.status) && (ui.acct.role === 'all' || u.role === ui.acct.role) &&
      (!q || [u.name, u.username, u.email].some((v) => v.toLowerCase().includes(q))));
    const maskEmail = (e) => e.replace(/^(.).*(@.*)$/, '$1\u2022\u2022\u2022$2');
    const cols = full ? ['Account', 'Role', 'Status', 'Failed logins', 'Last login', 'Actions'] : ['Account', 'Status', 'Failed logins', 'Last login', 'Actions'];
    const rows = list.map((u) => {
      const self = u.username === me.username;
      const protectedAcct = !full && u.role === 'ICT_ADMIN';
      const acts = full
        ? `<button type="button" class="btn-light btn-sm" data-act="acct-edit" data-id="${u.id}">Edit</button>
           <button type="button" class="btn-light btn-sm" data-act="acct-reset" data-id="${u.id}">Reset password</button>
           ${u.status === 'Locked' ? `<button type="button" class="btn-solid btn-sm" data-act="acct-unlock" data-id="${u.id}">Unlock</button>` : ''}
           ${self ? '' : `<button type="button" class="btn-light btn-sm" data-act="acct-toggle" data-id="${u.id}">${u.status === 'Suspended' ? 'Reactivate' : 'Suspend'}</button>`}`
        : (protectedAcct ? '<small>Restricted</small>' : `${u.status === 'Locked' ? `<button type="button" class="btn-solid btn-sm" data-act="acct-unlock" data-id="${u.id}">Unlock</button>` : ''}${u.status === 'Suspended' ? '<small>Ask ICT Services</small>' : `<button type="button" class="btn-light btn-sm" data-act="acct-reset" data-id="${u.id}">Send reset code</button>`}`);
      return full
        ? `<tr><td><strong>${esc(u.name)}</strong><br><small>${esc(u.username)} \u00B7 ${esc(u.email)}</small></td><td>${esc(ROLE_LABEL[u.role])}</td><td>${badge(u.status)}</td><td>${u.failed}</td><td>${esc(u.lastLogin ? fmtStamp(u.lastLogin) : 'Never')}</td><td class="staff-actions">${acts}</td></tr>`
        : `<tr><td><strong>${esc(u.name)}</strong><br><small>${esc(u.username)} \u00B7 ${esc(maskEmail(u.email))}</small></td><td>${badge(u.status)}</td><td>${u.failed}</td><td>${esc(u.lastLogin ? fmtStamp(u.lastLogin) : 'Never')}</td><td class="staff-actions">${acts}</td></tr>`;
    });
    $('#acctTable').innerHTML = table(cols, rows, 'No accounts match your filters.', 'acctList');
  }

  function accountForm(u) {
    return `<form id="acctForm" class="staff-form" novalidate>
      ${field('afName', 'Full name', `<input id="afName" value="${esc(u ? u.name : '')}" />`)}
      <div class="set-grid-2">
        ${field('afUser', 'Username', `<input id="afUser" value="${esc(u ? u.username : '')}" autocomplete="off" />`, 'Must be unique.')}
        ${field('afEmail', 'Account email', `<input id="afEmail" type="email" value="${esc(u ? u.email : '')}" />`)}
      </div>
      <div class="set-grid-2">
        ${field('afRole', 'Role', `<select id="afRole" class="dm-select">${opts(ROLE_ORDER.map((r) => [r, ROLE_LABEL[r]]), u ? u.role : 'FACULTY')}</select>`)}
        ${field('afStatus', 'Account status', `<select id="afStatus" class="dm-select">${opts(['Pending Activation', 'Active', 'Inactive', 'Suspended', 'Locked'].map((s) => [s, s]), u ? u.status : 'Pending Activation')}</select>`)}
      </div>
      <label class="check-row staff-check"><input type="checkbox" id="afMust" ${!u || u.mustChange ? 'checked' : ''}/><span>Require a password change at next login</span></label>
    </form>`;
  }
  function saveAccount(u) {
    const name = $('#afName').value.trim(), username = $('#afUser').value.trim().toLowerCase(), email = $('#afEmail').value.trim().toLowerCase();
    const role = $('#afRole').value, status = $('#afStatus').value;
    let ok = true;
    ['afName', 'afUser', 'afEmail'].forEach((i) => setErr(i, ''));
    if (!name) { setErr('afName', 'Name is required.'); ok = false; }
    if (!/^[a-z0-9._-]{4,}$/.test(username)) { setErr('afUser', 'Use at least 4 letters, numbers, dots or dashes.'); ok = false; }
    else if (db.users.some((x) => x.username === username && (!u || x.id !== u.id))) { setErr('afUser', 'That username is already taken.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('afEmail', 'Enter a valid email address.'); ok = false; }
    else if (db.users.some((x) => x.email === email && (!u || x.id !== u.id))) { setErr('afEmail', 'That email is already registered.'); ok = false; }
    if (u && u.username === me.username && (role !== u.role || ['Suspended', 'Inactive', 'Locked'].includes(status))) {
      setErr('afRole', 'You cannot change your own role or lock yourself out.'); ok = false;
    }
    if (!ok) return false;

    if (u) {
      const before = `${u.role}/${u.status}`;
      Object.assign(u, { name, username, email, role, status, mustChange: $('#afMust').checked });
      if (status !== 'Locked') { u.failed = 0; u.lockoutUntil = ''; }
      audit('User Accounts', 'Users', 'U-' + u.id, 'UPDATE', `Updated account ${username}`, 'Success', before, `${role}/${status}`);
      toast('Account updated.');
    } else {
      const id = Math.max(0, ...db.users.map((x) => x.id)) + 1;
      db.users.push({ id, username, name, email, role, status, failed: 0, lockoutUntil: '', lastLogin: '', mustChange: $('#afMust').checked, created: isoDate(new Date()) });
      audit('User Accounts', 'Users', 'U-' + id, 'CREATE', `Created account ${username} (${ROLE_LABEL[role]})`);
      toast(`Account ${username} created.`);
    }
    save('users'); render();
    return true;
  }
  function resetPassword(u) {
    const temp = 'Tmp-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!7';
    u.mustChange = true; u.failed = 0; if (u.status === 'Locked') u.status = 'Active';
    if (findAccount(u.username)) { db.pw[u.username] = hash(temp); save('pw'); }
    save('users');
    audit('User Accounts', 'Users', 'U-' + u.id, 'UPDATE', `Issued temporary password for ${u.username}`);
    render();
    openModal({ title: 'Temporary password issued', hideFoot: false, ok: 'Done', cancel: 'Close',
      body: `<p class="dm-modal-note">Give this one-time code to <strong>${esc(u.name)}</strong> through a secure channel. They must change it at next login. It is shown only once.</p><div class="staff-code">${esc(temp)}</div>` });
  }

  /* ---------- ROLES & PERMISSIONS ---------- */
  PAGES.roles = () => {
    const edit = can('roles.manage');
    const perms = rolesDraft || db.perms;
    const groups = [...new Set(PERMISSIONS.map((p) => p[1]))];
    const rows = [];
    groups.forEach((g) => {
      rows.push(`<tr class="staff-group"><td colspan="${ROLE_ORDER.length + 1}">${esc(g)}</td></tr>`);
      PERMISSIONS.filter((p) => p[1] === g).forEach(([code]) => rows.push(`<tr><td><code>${code}</code></td>${ROLE_ORDER.map((r) => `<td class="num"><input type="checkbox" data-perm="${r}|${code}" ${perms[r].includes(code) ? 'checked' : ''} ${edit ? '' : 'disabled'} aria-label="${code} for ${esc(ROLE_LABEL[r])}" /></td>`).join('')}</tr>`));
    });
    return `${head('Roles & Permissions', edit ? 'Decide which actions each role may perform. Changes take effect after you save and are recorded in the audit trail.' : 'Read-only view of what each role may do. Only ICT Services can change roles and permissions.',
      edit ? `<span class="staff-quick"><button type="button" class="btn-light" data-act="roles-discard">Discard</button><button type="button" class="btn-solid" data-act="roles-save" ${rolesDraft ? '' : 'disabled'}>Save changes</button></span>` : '')}
      <div class="staff-stats staff-stats-6">${ROLE_ORDER.map((r) => { const n = db.users.filter((u) => u.role === r).length; return stat(ROLE_LABEL[r].toUpperCase(), `${perms[r].length}<small> permissions</small>`, `${n} account${n === 1 ? '' : 's'}`); }).join('')}</div>
      ${card('Permission matrix', `<div class="dm-table-wrap staff-table-wrap"><table class="dm-table staff-table staff-matrix"><thead><tr><th>Permission</th>${ROLE_ORDER.map((r) => `<th class="num">${esc(ROLE_LABEL[r])}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
        <p class="dm-foot">Students only ever see their own records.</p>`)}`;
  };

  /* ---------- AUDIT TRAILS ---------- */
  PAGES.audit = () => {
    const full = can('audit.full');
    const mods = [...new Set(db.audit.map((a) => a.mod))].sort();
    return `${head('Audit Trails', full ? 'Append-only record of who did what, when and from where.' : 'Read-only activity history. IP addresses and before/after values are available to ICT Services only.',
      full ? '<button type="button" class="btn-light" data-act="audit-export">Export CSV</button>' : '')}
      ${card('', `<div class="staff-toolbar">
        <input type="search" id="auQ" class="dm-select staff-search" placeholder="Search user, action or description" value="${esc(ui.audit.q)}" aria-label="Search audit log" />
        <select id="auMod" class="dm-select" aria-label="Filter by module">${opts(mods.map((m) => [m, m]), ui.audit.mod, 'All modules')}</select>
        <select id="auStatus" class="dm-select" aria-label="Filter by result">${opts([['Success', 'Success'], ['Failed', 'Failed']], ui.audit.status, 'All results')}</select>
      </div><div id="auTable"></div><p class="dm-foot">Passwords, reset tokens and other secrets are never written to the audit log.</p>`)}`;
  };
  const auditRows = () => {
    const q = ui.audit.q.toLowerCase();
    return db.audit.filter((a) => (ui.audit.mod === 'all' || a.mod === ui.audit.mod) && (ui.audit.status === 'all' || a.status === ui.audit.status) &&
      (!q || [a.user, a.act, a.desc, a.mod, a.rec].some((v) => String(v).toLowerCase().includes(q))));
  };
  function refreshAudit() {
    const full = can('audit.full');
    const list = auditRows();
    const cols = full ? ['Time', 'User', 'Module', 'Entity / record', 'Action', 'Description', 'Changes', 'IP', 'Result'] : ['Time', 'User', 'Module', 'Action', 'Description', 'Result'];
    $('#auTable').innerHTML = table(cols, list.slice(0, 100).map((a) => full
      ? `<tr><td>${esc(fmtStamp(a.ts))}</td><td>${esc(a.user)}</td><td>${esc(a.mod)}</td><td>${esc(a.ent)}<br><small>${esc(a.rec)}</small></td><td>${esc(a.act)}</td><td>${esc(a.desc)}</td><td>${a.prev || a.next ? `<small>${esc(a.prev)}<br>\u2192 ${esc(a.next)}</small>` : '\u2014'}</td><td>${esc(a.ip || '\u2014')}</td><td>${badge(a.status)}</td></tr>`
      : `<tr><td>${esc(fmtStamp(a.ts))}</td><td>${esc(a.user)}</td><td>${esc(a.mod)}</td><td>${esc(a.act)}</td><td>${esc(a.desc)}</td><td>${badge(a.status)}</td></tr>`), 'No audit events match.');
  }

  /* ---------- BACKUPS ---------- */
  PAGES.backups = () => {
    const full = can('backup.manage');
    const b = db.backups, c = b.config;
    const lastOk = b.history.find((h) => h.status === 'Completed');
    const tested = b.history.filter((h) => h.restoreTested).sort((x, y) => y.restoreTested.localeCompare(x.restoreTested))[0];
    const cfgCard = full ? card('Backup schedule', `<form id="bkForm" class="staff-form" novalidate>
        <div class="set-grid-2">
          ${field('bkFreq', 'Frequency', `<select id="bkFreq" class="dm-select">${opts(['Daily', 'Weekly', 'Monthly'].map((x) => [x, x]), c.frequency)}</select>`)}
          ${field('bkTime', 'Backup time', `<input id="bkTime" type="time" value="${esc(c.time)}" />`)}
          ${field('bkType', 'Backup type', `<select id="bkType" class="dm-select">${opts(['Full', 'Incremental', 'Differential'].map((x) => [x, x]), c.type)}</select>`)}
          ${field('bkRet', 'Retention (days)', `<input id="bkRet" type="number" min="1" max="3650" value="${c.retention}" />`)}
        </div>
        ${field('bkLoc', 'Storage location', `<input id="bkLoc" value="${esc(c.location)}" />`, 'Use a protected destination, separate from the production server.')}
        <label class="check-row staff-check"><input type="checkbox" id="bkOn" ${c.enabled ? 'checked' : ''}/><span>Scheduled backups enabled</span></label>
        <div class="set-actions"><button type="submit" class="btn-solid">Save schedule</button></div></form>`)
      : card('Backup schedule', `<dl class="set-info"><div><dt>Frequency</dt><dd>${esc(c.frequency)}</dd></div><div><dt>Time</dt><dd>${fmtTime(c.time)}</dd></div><div><dt>Type</dt><dd>${esc(c.type)}</dd></div><div><dt>Scheduled</dt><dd>${c.enabled ? 'Enabled' : 'Disabled'}</dd></div></dl><p class="dm-foot">Only ICT Services can change the schedule or run backups.</p>`);
    return `${head(full ? 'Backup Management' : 'Backup Status', full ? 'Schedule backups, run one on demand and confirm that restores actually work.' : 'Read-only status of automated backups.', full ? '<button type="button" class="btn-solid" data-act="bk-run">Run backup now</button>' : '')}
      <div class="staff-stats">
        ${stat('LAST SUCCESSFUL', lastOk ? fmtDate(lastOk.end) : '\u2014', lastOk ? `${lastOk.id} \u00B7 ${fmtBytes(lastOk.size)}` : '')}
        ${stat('LAST RESTORE TEST', tested ? fmtDate(tested.restoreTested) : 'Never', tested ? tested.id : 'A backup is not proven until restored')}
        ${stat('FAILED (LAST 30 DAYS)', b.history.filter((h) => h.status === 'Failed').length, 'Review the failure reason')}
        ${stat('SCHEDULE', c.enabled ? c.frequency : 'Off', `${c.type} \u00B7 ${fmtTime(c.time)}`, 'is-blue')}
      </div>
      <div class="staff-stack">
        ${card('Backup history', table(full ? ['ID', 'Started', 'Type', 'Size / checksum', 'Status', 'Restore test', ''] : ['ID', 'Started', 'Type', 'Status'],
          b.history.map((h) => full
            ? `<tr><td>${esc(h.id)}</td><td>${esc(fmtStamp(h.start))}<br><small>by ${esc(h.by)}</small></td><td>${esc(h.type)}</td><td>${h.size ? fmtBytes(h.size) : '\u2014'}${h.checksum ? `<br><small>${esc(h.checksum)}</small>` : ''}</td><td>${badge(h.status)}${h.failure ? `<br><small class="dm-note">${esc(h.failure)}</small>` : ''}</td><td>${h.restoreTested ? fmtDate(h.restoreTested) : '\u2014'}</td><td class="staff-actions">${h.status === 'Completed' ? `<button type="button" class="btn-light btn-sm" data-act="bk-verify" data-id="${h.id}">Test restore</button>` : ''}</td></tr>`
            : `<tr><td>${esc(h.id)}</td><td>${esc(fmtStamp(h.start))}</td><td>${esc(h.type)}</td><td>${badge(h.status)}</td></tr>`), undefined, 'bkHist'))}
        ${cfgCard}
      </div>`;
  };

  /* ---------- MONITORING ---------- */
  PAGES.monitoring = () => {
    tickMetrics();
    return `${head('System Monitoring', 'Live health indicators and the event log. Collected automatically; refreshes every few seconds.', '<button type="button" class="btn-light" data-act="mon-refresh">Refresh now</button>')}
      <div class="staff-metrics" id="stMetrics">${metricsHtml()}</div>
      ${card('System events', table(['Event', 'Time', 'Module', 'Description', 'Severity', 'Status', ''], db.events.map((e) => `<tr><td>${esc(e.id)}<br><small>${esc(e.type)}</small></td><td>${esc(fmtStamp(e.ts))}</td><td>${esc(e.module)}</td><td>${esc(e.desc)}${e.resolved ? `<br><small>Resolved ${esc(fmtStamp(e.resolved))} by ${esc(e.by)}</small>` : ''}</td><td>${badge(e.severity)}</td><td>${badge(e.status)}</td><td>${e.status === 'Resolved' ? '' : `<button type="button" class="btn-light btn-sm" data-act="mon-resolve" data-id="${e.id}">Mark resolved</button>`}</td></tr>`)))}`;
  };

  /* ---------- CLASSES (EdTech: all classes, editable; Faculty: assigned only) ---------- */
  PAGES.classes = () => {
    if (me.role === 'FACULTY') {
      const cls = myClasses();
      return `${head('My Classes', 'You can only see classes assigned to you.')}
        <div class="staff-cards">${cls.map((c) => card('', `<div class="staff-class"><span class="dm-stat-label">${esc(c.code)} \u00B7 SECTION ${esc(c.section)}</span><h3>${esc(c.title)}</h3>
          <dl class="set-info"><div><dt>Schedule</dt><dd>${esc(schedText(c))}</dd></div><div><dt>Room</dt><dd>${esc(c.room)}</dd></div><div><dt>Mode</dt><dd>${esc(c.modality)}</dd></div><div><dt>Enrolled</dt><dd>${c.size} / ${c.capacity}</dd></div></dl>
          <div class="staff-quick"><button type="button" class="btn-solid btn-sm" data-act="cls-roster" data-id="${c.id}">Class list</button><button type="button" class="btn-light btn-sm" data-act="att-open" data-id="${c.id}">Attendance</button><button type="button" class="btn-light btn-sm" data-act="gr-open" data-id="${c.id}" data-period="Final">Grades</button></div></div>`)).join('')}</div>`;
    }
    const conflicts = totalConflicts();
    const isDH = me.role === 'DEPT_HEAD';
    return `${head(isDH ? 'Classes & Faculty' : 'Classes & Schedules', isDH ? 'Create class offerings, assign faculty and set schedules and rooms. Changes are checked for room and faculty conflicts.' : 'Adjust meeting times, rooms and faculty assignment. Changes are checked for room and faculty conflicts.', isDH ? '<button type="button" class="btn-solid" data-act="cls-new">+ New class offering</button>' : '')}
      <div class="staff-stats">${stat('OFFERINGS', db.classes.length, '1st Semester, AY 2026\u20132027')}${stat('SCHEDULE CONFLICTS', conflicts, conflicts ? 'Needs fixing' : 'None found')}${stat('ROOMS IN USE', new Set(db.classes.map((c) => c.room)).size, `of ${ROOMS_OK().length} available`)}${stat('FACULTY ASSIGNED', new Set(db.classes.map((c) => c.faculty)).size, 'With at least one class', 'is-blue')}</div>
      ${card('', table(['Course', 'Section', 'Faculty', 'Schedule', 'Room', 'Enrolled', 'Status', ''], db.classes.map((c) => { const cf = findConflicts(c); return `<tr><td><strong>${esc(c.code)}</strong><br><small>${esc(c.title)}</small></td><td>${esc(c.section)}</td><td>${esc(userName(c.faculty))}</td><td>${esc(schedText(c))}</td><td>${esc(c.room)}</td><td>${c.size}/${c.capacity}</td><td>${(c.status === 'Open' ? '<span class="dm-status info">Open</span>' : badge(c.status))}${cf.length ? '<br><span class="dm-status risk">Conflict</span>' : ''}</td><td><button type="button" class="btn-light btn-sm" data-act="cls-edit" data-id="${c.id}">Edit</button></td></tr>`; })))}`;
  };
  function classForm(c) {
    const faculty = db.users.filter((u) => u.role === 'FACULTY' && (u.status === 'Active' || u.username === c.faculty));
    const facField = me.role === 'EDTECH'
      ? field('cfFacRO', 'Assigned faculty', `<input id="cfFacRO" value="${esc(userName(c.faculty))}" disabled />`, 'Faculty are assigned by the Department Head.')
      : field('cfFac', 'Assigned faculty', `<select id="cfFac" class="dm-select">${opts(faculty.map((u) => [u.username, u.name]), c.faculty)}</select>`);
    return `<form id="clsForm" class="staff-form" novalidate>
      <p class="dm-modal-note"><strong>${esc(c.code)} ${esc(c.section)}</strong> \u2014 ${esc(c.title)}</p>
      <div class="set-grid-2">
        ${facField}
        ${field('cfRoom', 'Room', `<select id="cfRoom" class="dm-select">${opts([...new Set(ROOMS_OK().concat(c.room))].map((r) => [r, r]), c.room)}</select>`)}
        ${field('cfDay', 'Day', `<select id="cfDay" class="dm-select">${opts(Object.keys(DAY_IDX).map((d) => [d, d]), c.day)}</select>`)}
        ${field('cfStart', 'Start time', `<input id="cfStart" type="time" value="${c.start}" />`)}
        ${field('cfEnd', 'End time', `<input id="cfEnd" type="time" value="${c.end}" />`)}
      </div></form>`;
  }
  function saveClass(c) {
    const next = Object.assign({}, c, { faculty: $('#cfFac') ? $('#cfFac').value : c.faculty, room: $('#cfRoom').value, day: $('#cfDay').value, modality: MODALITY, start: $('#cfStart').value, end: $('#cfEnd').value });
    setErr('cfEnd', '');
    if (!next.start || !next.end || toMin(next.end) <= toMin(next.start)) { setErr('cfEnd', 'End time must be after the start time.'); return false; }
    const conflicts = findConflicts(next);
    if (conflicts.length) { setErr('cfEnd', conflicts[0]); return false; }
    const before = `${c.day} ${c.start}-${c.end} ${c.room} ${c.faculty}`;
    Object.assign(c, next);
    save('classes');
    audit('Scheduling', 'ClassSchedules', c.id, 'UPDATE', `Updated schedule/assignment for ${c.code} ${c.section}`, 'Success', before, `${c.day} ${c.start}-${c.end} ${c.room} ${c.faculty}`);
    toast('Class updated.'); render();
    return true;
  }
  function rosterModal(c) {
    openModal({ title: `Class list \u00B7 ${c.code} ${c.section}`, ok: 'Export CSV', cancel: 'Close',
      body: table(['#', 'Student number', 'Name', 'Program'], ROSTER.map((s, i) => `<tr><td>${i + 1}</td><td>${s.sn}</td><td>${esc(s.name)}</td><td>BSIT</td></tr>`)) + `<p class="dm-foot">${ROSTER.length} enrolled students.</p>`,
      onOk: () => { downloadCsv(`Class list ${c.code} ${c.section}`, ['Student number', 'Name', 'Program'], ROSTER.map((s) => [s.sn, s.name, 'BSIT'])); return false; } });
  }

  /* ---------- ATTENDANCE (Faculty) ---------- */
  const ATT_STATUS = ['Present', 'Absent', 'Late', 'Excused'];
  function attSession(c, date) { const m = db.fac.attendance[c.id] || (db.fac.attendance[c.id] = {}); return m[date]; }
  function attDraftFor(c, date) {
    const key = c.id + '|' + date;
    if (ui.att.key !== key) {
      const s = attSession(c, date);
      ui.att.draft = s ? clone(s.rows) : Object.fromEntries(ROSTER.map((r) => [r.sn, { status: 'Present', timeIn: c.start, timeOut: '', remarks: '' }]));
      ui.att.key = key;
    }
    return ui.att.draft;
  }
  PAGES.attendance = () => {
    if (me.role === 'DEPT_HEAD') return deptAttendance();
    const cls = myClasses();
    if (!cls.length) return head('Attendance', 'You have no assigned classes.');
    if (!cls.some((c) => c.id === ui.att.cls)) ui.att.cls = cls[0].id;
    const c = cls.find((x) => x.id === ui.att.cls);
    const dates = meetingDates(c);
    if (!dates.includes(ui.att.date)) ui.att.date = dates[0];
    const sess = attSession(c, ui.att.date);
    const submitted = sess && sess.status === 'Submitted';
    const draft = attDraftFor(c, ui.att.date);
    const lock = submitted ? 'disabled' : '';
    return `${head('Attendance', 'Record attendance for one class meeting. One result per student per meeting.')}
      ${card('', `<div class="staff-toolbar">
        <select id="attCls" class="dm-select" aria-label="Class">${opts(cls.map((x) => [x.id, `${x.code} \u00B7 ${x.section}`]), c.id)}</select>
        <select id="attDate" class="dm-select" aria-label="Meeting date">${opts(dates.map((d) => [d, fmtDateLong(d)]), ui.att.date)}</select>
        <span class="staff-meta">${esc(schedText(c))} \u00B7 ${esc(c.room)}</span>
        <span class="staff-spacer"></span>${submitted ? badge('Submitted') : badge('Open')}
      </div>
      <div class="staff-summary" id="attSummary"></div>
      ${table(['#', 'Student number', 'Name', 'Status', 'Time in', 'Time out', 'Late by', 'Remarks'], ROSTER.map((s, i) => { const r = draft[s.sn]; return `<tr data-sn="${s.sn}"><td>${i + 1}</td><td>${s.sn}</td><td>${esc(s.name)}</td>
        <td><select class="dm-select staff-mini" data-att-f="status" ${lock} aria-label="Status for ${esc(s.name)}">${opts(ATT_STATUS.map((x) => [x, x]), r.status)}</select></td>
        <td><input type="time" class="staff-mini" data-att-f="timeIn" value="${esc(r.timeIn)}" ${lock} ${['Absent', 'Excused'].includes(r.status) ? 'disabled' : ''} aria-label="Time in" /></td>
        <td><input type="time" class="staff-mini" data-att-f="timeOut" value="${esc(r.timeOut)}" ${lock} ${['Absent', 'Excused'].includes(r.status) ? 'disabled' : ''} aria-label="Time out" /></td>
        <td class="att-late" data-late>${lateText(c, r)}</td>
        <td><input type="text" class="staff-mini staff-wide" data-att-f="remarks" value="${esc(r.remarks)}" ${lock} placeholder="Optional" aria-label="Remarks" /></td></tr>`; }))}
      <small class="set-error" id="attError"></small>
      <div class="set-actions">
        ${submitted ? `<button type="button" class="btn-light" data-act="att-reopen">Reopen to edit</button><span class="staff-meta">Submitted ${esc(sess.recordedAt || '')}</span>`
          : `<button type="button" class="btn-light" data-act="att-all">Mark all present</button><button type="button" class="btn-light" data-act="att-save">Save draft</button><button type="button" class="btn-solid" data-act="att-submit">Submit attendance</button>`}
      </div>`)}`;
  };
  function lateText(c, r) { if (r.status !== 'Late' || !r.timeIn) return '\u2014'; const m = toMin(r.timeIn) - toMin(c.start); return m > 0 ? `${m} min` : '\u2014'; }
  function updateAttSummary() {
    const box = $('#attSummary'); if (!box || !ui.att.draft) return;
    const counts = Object.fromEntries(ATT_STATUS.map((s) => [s, 0]));
    Object.values(ui.att.draft).forEach((r) => { counts[r.status]++; });
    box.innerHTML = ATT_STATUS.map((s) => `<span class="staff-pill">${badge(s)} <strong>${counts[s]}</strong></span>`).join('');
  }
  function attValidate(c) {
    for (const s of ROSTER) {
      const r = ui.att.draft[s.sn];
      if (r.status === 'Late' && !r.timeIn) return `${s.name}: enter the time in for a late student.`;
      if (r.timeIn && r.timeOut && toMin(r.timeOut) < toMin(r.timeIn)) return `${s.name}: time out cannot be earlier than time in.`;
    }
    return '';
  }
  function attPersist(c, date, status) {
    const m = db.fac.attendance[c.id] || (db.fac.attendance[c.id] = {});
    m[date] = { status, rows: clone(ui.att.draft), recordedAt: nowStamp() };
    persist(K.fac, db.fac);
  }
  function evaluateAlerts(c) {
    const cfg = db.alertCfg; if (!cfg.enabled) return 0;
    let added = 0;
    ROSTER.forEach((s) => {
      let abs = 0, late = 0;
      Object.values(db.fac.attendance[c.id] || {}).forEach((sess) => { if (sess.status !== 'Submitted') return; const r = sess.rows[s.sn]; if (!r) return; if (r.status === 'Absent') abs++; if (r.status === 'Late') late++; });
      [['Absence', abs, cfg.maxAbsences, `${abs} absences in ${c.code} ${c.section}`], ['Tardiness', late, cfg.tardiness, `${late} late arrivals in ${c.code} ${c.section}`]].forEach(([type, n, limit, msg]) => {
        if (n >= limit && !db.fac.alerts.some((a) => a.sn === s.sn && a.cls === c.id && a.type === type && a.count === n)) {
          db.fac.alerts.unshift({ sn: s.sn, student: s.name, cls: c.id, type, count: n, message: msg, date: isoDate(new Date()) }); added++;
        }
      });
    });
    if (added) persist(K.fac, db.fac);
    return added;
  }

  /* ---------- GRADES (Faculty) ---------- */
  const assessmentsFor = (cid, period) => db.fac.assessments.filter((a) => a.classId === cid && a.period === period);
  function periodResult(cid, period, sn) {
    const list = assessmentsFor(cid, period);
    const totalW = list.reduce((n, a) => n + a.weight, 0);
    if (!list.length || !totalW) return { pct: null, complete: false };
    let earned = 0, complete = true;
    list.forEach((a) => { const v = (db.fac.scores[a.id] || {})[sn]; if (typeof v !== 'number') complete = false; else earned += (v / a.max) * a.weight; });
    return { pct: (earned / totalW) * 100, complete };
  }
  PAGES.grades = () => {
    const cls = myClasses();
    if (!cls.length) return head('Grade Management', 'You have no assigned classes.');
    if (!cls.some((c) => c.id === ui.gr.cls)) ui.gr.cls = cls[0].id;
    const c = cls.find((x) => x.id === ui.gr.cls);
    const list = assessmentsFor(c.id, ui.gr.period);
    const totalW = list.reduce((n, a) => n + a.weight, 0);
    const status = db.fac.gradeStatus[`${c.id}|${ui.gr.period}`] || 'Draft';
    const locked = !['Draft', 'Returned'].includes(status);
    const gnote = (db.fac.gradeNotes || {})[`${c.id}|${ui.gr.period}`];
    return `${head('Grade Management', 'Define assessments, encode scores and submit Final grades for Department Head review. The Registrar posts approved grades.',
      locked ? '' : '<button type="button" class="btn-solid" data-act="gr-add">+ Add assessment</button>')}
      ${card('', `<div class="staff-toolbar">
        <select id="grCls" class="dm-select" aria-label="Class">${opts(cls.map((x) => [x.id, `${x.code} \u00B7 ${x.section}`]), c.id)}</select>
        ${PERIODS.length > 1 ? `<select id="grPeriod" class="dm-select" aria-label="Grading period">${opts(PERIODS.map((p) => [p, p]), ui.gr.period)}</select>` : `<span class="staff-meta"><strong>${esc(PERIODS[0])} grades</strong></span>`}
        <span class="staff-meta">Weights total <strong class="${totalW === 100 ? '' : 'staff-bad'}">${totalW}%</strong>${totalW === 100 || !list.length ? '' : ' (should be 100%)'}</span>
        <span class="staff-spacer"></span>${badge(status)}
      </div>
      ${list.length ? `<div class="dm-table-wrap staff-table-wrap"><table class="dm-table staff-table"><thead><tr><th>Student</th>${list.map((a) => `<th class="num">${esc(a.name)}<br><small>/${a.max} \u00B7 ${a.weight}%</small>${locked ? '' : `<br><button type="button" class="staff-x" data-act="gr-del" data-id="${a.id}" aria-label="Remove ${esc(a.name)}">remove</button>`}</th>`).join('')}<th class="num">${esc(ui.gr.period)} %</th><th class="num">Equivalent</th></tr></thead>
        <tbody>${ROSTER.map((s) => { const r = periodResult(c.id, ui.gr.period, s.sn); return `<tr data-sn="${s.sn}"><td><strong>${esc(s.name)}</strong><br><small>${s.sn}</small></td>${list.map((a) => { const v = (db.fac.scores[a.id] || {})[s.sn]; return `<td class="num"><input type="number" class="staff-score" min="0" max="${a.max}" step="0.5" value="${typeof v === 'number' ? v : ''}" data-score="${a.id}|${s.sn}" ${locked ? 'disabled' : ''} aria-label="${esc(a.name)} score for ${esc(s.name)}" /></td>`; }).join('')}
          <td class="num" data-pct>${r.pct === null ? '\u2014' : r.pct.toFixed(1) + '%'}</td><td class="num" data-eq>${r.pct === null || !r.complete ? '\u2014' : toGrade(r.pct).toFixed(2)}</td></tr>`; }).join('')}</tbody></table></div>`
        : '<p class="dm-empty">No assessments for this period yet. Add a quiz, exam or project to start encoding scores.</p>'}
      ${status === 'Returned' && gnote ? `<p class="staff-bad"><strong>Returned by ${esc(userName(gnote.by))}:</strong> ${esc(gnote.note)}</p>` : ''}
      <small class="set-error" id="grError"></small>
      <div class="set-actions">${locked ? (status === 'Submitted' ? '<button type="button" class="btn-light" data-act="gr-recall">Recall to draft</button><span class="staff-meta">Submitted for Department Head review.</span>' : status === 'Approved' ? '<span class="staff-meta">Approved by the Department Head. Waiting for the Registrar to post.</span>' : '<span class="staff-meta">Posted by the Registrar. A posted grade only changes through a correction request.</span><button type="button" class="btn-light" data-act="gc-new">Request grade correction</button>') : `<button type="button" class="btn-solid" data-act="gr-submit" ${list.length ? '' : 'disabled'}>Submit ${esc(ui.gr.period)} grades</button>`}</div>
      <p class="dm-foot">Equivalent grade: 1.00 highest, 3.00 passing (75%), 5.00 failed. A grade shows once every score is encoded.</p>`)}
      ${status === 'Posted' ? correctionsCard(corrections().filter((x) => x.classId === c.id), 'Grade corrections for this class') : ''}`;
  };

  // Shared list of grade corrections (faculty: own class; Dept Head: to review)
  const CORR_TONE = { Requested: 'Submitted', Endorsed: 'Approved', Applied: 'Posted', Rejected: 'Returned' };
  function correctionsCard(list, title, actions) {
    return card(title, list.length ? table(['ID', 'Student', 'Course', 'Posted', 'Corrected', 'Reason', 'Status', ''], list.map((x) => {
      const last = x.history[x.history.length - 1];
      return `<tr><td>${esc(x.id)}<br><small>${esc(fmtDate(x.ts))}</small></td><td><strong>${esc(x.name)}</strong><br><small>${esc(x.sn)}</small></td><td>${esc(x.code)} \u00B7 ${esc(x.section)}</td>
        <td class="num">${fmtGrade(x.from)}</td><td class="num"><strong>${fmtGrade(x.to)}</strong></td><td>${esc(x.reason)}</td>
        <td><span class="dm-status ${STATUS_CLS[CORR_TONE[x.status]] || 'muted'}">${esc(x.status)}</span>${x.status === 'Rejected' && last.note ? `<br><small>${esc(last.note)}</small>` : ''}</td>
        <td>${actions && x.status === 'Requested' ? `<button type="button" class="btn-solid btn-sm" data-act="gc-endorse" data-id="${x.id}">Endorse</button> <button type="button" class="btn-light btn-sm" data-act="gc-reject" data-id="${x.id}">Reject</button>` : x.status === 'Endorsed' ? '<small>With the Registrar</small>' : x.status === 'Requested' ? '<small>With the Department Head</small>' : ''}</td></tr>`;
    })) : '<p class="dm-empty">No grade corrections yet.</p>');
  }

  function correctionForm(c) {
    return `<form id="gcForm" class="staff-form" novalidate>
      <p class="dm-modal-note">Posted ${esc(FINAL)} grades for <strong>${esc(c.code)} ${esc(c.section)}</strong>. The Department Head endorses the request and the Registrar applies it.</p>
      ${field('gcStudent', 'Student', `<select id="gcStudent" class="dm-select">${opts(ROSTER.map((x) => [x.sn, `${x.name} (${x.sn}) \u2014 posted ${fmtGrade(officialGrade(c.id, x.sn))}`]), '')}</select>`)}
      ${field('gcGrade', 'Corrected grade', `<select id="gcGrade" class="dm-select"><option value="">Choose\u2026</option>${opts(GRADE_CHOICES.map((g) => [g, g]), '')}</select>`)}
      ${field('gcReason', 'Reason', '<textarea id="gcReason" rows="3" placeholder="e.g. Quiz 2 score was encoded as 18 instead of 28."></textarea>', 'Required. This is kept in the audit trail.')}
    </form>`;
  }
  function updateGradeRow(sn) {
    const tr = $(`tr[data-sn="${sn}"]`, $('#stMain')); if (!tr) return;
    const r = periodResult(ui.gr.cls, ui.gr.period, sn);
    $('[data-pct]', tr).textContent = r.pct === null ? '\u2014' : r.pct.toFixed(1) + '%';
    $('[data-eq]', tr).textContent = r.pct === null || !r.complete ? '\u2014' : toGrade(r.pct).toFixed(2);
  }
  function assessmentForm() {
    return `<form id="asForm" class="staff-form" novalidate>
      ${field('asName', 'Assessment name', '<input id="asName" placeholder="e.g. Quiz 3" />')}
      <div class="set-grid-2">
        ${field('asType', 'Type', `<select id="asType" class="dm-select">${opts(['Quiz', 'Examination', 'Laboratory', 'Project', 'Assignment'].map((x) => [x, x]), 'Quiz')}</select>`)}
        ${field('asDate', 'Date', `<input id="asDate" type="date" value="${isoDate(new Date())}" />`)}
        ${field('asMax', 'Maximum score', '<input id="asMax" type="number" min="1" step="0.5" />')}
        ${field('asWeight', 'Weight (%)', '<input id="asWeight" type="number" min="1" max="100" step="1" />', 'Weights for a period should total 100%.')}
      </div></form>`;
  }

  /* ---------- REPORTS ---------- */
  const attPct = (cid, sn) => { let held = 0, att = 0, exc = 0; Object.values(db.fac.attendance[cid] || {}).forEach((s) => { if (s.status !== 'Submitted' || !s.rows[sn]) return; const st = s.rows[sn].status; held++; if (st === 'Excused') exc++; else if (st !== 'Absent') att++; }); const base = held - exc; return { held, att, pct: base ? (att / base) * 100 : 0 }; };
  const inRange = (ts) => { const d = String(ts).slice(0, 10); return (!ui.rep.from || d >= ui.rep.from) && (!ui.rep.to || d <= ui.rep.to); };
  const REPORTS = [
    { id: 'users', name: 'User Accounts Report', roles: ['ICT_ADMIN'], filters: [], build: () => ({ cols: ['Username', 'Name', 'Email', 'Role', 'Status', 'Failed logins', 'Last login'], rows: db.users.map((u) => [u.username, u.name, u.email, ROLE_LABEL[u.role], u.status, u.failed, u.lastLogin ? fmtStamp(u.lastLogin) : 'Never']) }) },
    { id: 'roles', name: 'Role Assignment Report', roles: ['ICT_ADMIN'], filters: [], build: () => ({ cols: ['Role', 'Users assigned', 'Permissions granted'], rows: ROLE_ORDER.map((r) => [ROLE_LABEL[r], db.users.filter((u) => u.role === r).length, db.perms[r].join(', ')]) }) },
    { id: 'audit', name: 'Audit Activity Report', roles: ['ICT_ADMIN'], filters: ['range'], build: () => ({ cols: ['Time', 'User', 'Module', 'Action', 'Description', 'Result'], rows: db.audit.filter((a) => inRange(a.ts)).map((a) => [fmtStamp(a.ts), a.user, a.mod, a.act, a.desc, a.status]) }) },
    { id: 'backups', name: 'Backup History Report', roles: ['ICT_ADMIN'], filters: ['range'], build: () => ({ cols: ['ID', 'Started', 'Type', 'Size', 'Status', 'Restore tested'], rows: db.backups.history.filter((b) => inRange(b.start)).map((b) => [b.id, b.start, b.type, b.size ? fmtBytes(b.size) : '\u2014', b.status, b.restoreTested || '\u2014']) }) },
    { id: 'events', name: 'System Event Report', roles: ['ICT_ADMIN', 'EDTECH'], filters: ['range'], build: () => ({ cols: ['ID', 'Time', 'Type', 'Module', 'Description', 'Severity', 'Status'], rows: db.events.filter((e) => inRange(e.ts)).map((e) => [e.id, fmtStamp(e.ts), e.type, e.module, e.desc, e.severity, e.status]) }) },
    { id: 'history', name: 'Report Generation History', roles: ['ICT_ADMIN'], filters: [], build: () => ({ cols: ['Generated', 'Report', 'By', 'Records'], rows: db.reports.map((r) => [r.ts, r.name, r.by, r.count]) }) },
    { id: 'schedule', name: 'Class Schedule Report', roles: ['EDTECH', 'DEPT_HEAD'], filters: [], build: () => ({ cols: ['Course', 'Section', 'Faculty', 'Day', 'Time', 'Room', 'Modality', 'Status'], rows: db.classes.map((c) => [c.code, c.section, userName(c.faculty), c.day, `${fmtTime(c.start)}\u2013${fmtTime(c.end)}`, c.room, c.modality, c.status]) }) },
    { id: 'assign', name: 'Faculty Teaching Assignment Report', roles: ['EDTECH', 'DEPT_HEAD'], filters: [], build: () => ({ cols: ['Faculty', 'Course', 'Section', 'Enrolled', 'Capacity'], rows: [...db.classes].sort((a, b) => userName(a.faculty).localeCompare(userName(b.faculty))).map((c) => [userName(c.faculty), `${c.code} ${c.title}`, c.section, c.size, c.capacity]) }) },
    { id: 'rooms', name: 'Room Utilization Report', roles: ['EDTECH'], filters: [], build: () => ({ cols: ['Room', 'Weekly meetings', 'Hours per week', 'Classes'], rows: ROOMS_ALL().map(({ code: r, status }) => { const l = db.classes.filter((c) => c.room === r); return [status === 'Under Maintenance' ? `${r} (under maintenance)` : r, l.length, (l.reduce((n, c) => n + toMin(c.end) - toMin(c.start), 0) / 60).toFixed(1), l.map((c) => `${c.code} ${c.section}`).join(', ') || '\u2014']; }) }) },
    { id: 'deptstudents', name: 'Department Student List', roles: ['DEPT_HEAD'], filters: [], build: () => ({ cols: ['Student no.', 'Name', 'Program', 'Year', 'Admission', 'Status'], rows: deptStudents().map((s) => [s.no, s.name, s.program, s.year, s.admission, s.status]) }) },
    { id: 'deptstatus', name: 'Department Student Status Report', roles: ['DEPT_HEAD'], filters: [], build: () => ({ cols: ['Status', 'Students'], rows: Object.entries(deptStudents().reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {})) }) },
    { id: 'deptatt', name: 'Department Attendance Summary', roles: ['DEPT_HEAD'], filters: [], build: () => ({ cols: ['Course', 'Section', 'Faculty', 'Meetings', 'Absences', 'Late', 'Attendance %'], rows: attendanceSummary().map((r) => [r.code, r.section, r.faculty, r.held, r.absent, r.late, r.rate === null ? '\u2014' : r.rate.toFixed(1) + '%']) }) },
    { id: 'deptgrades', name: 'Grade Submission Status', roles: ['DEPT_HEAD'], filters: [], build: () => ({ cols: ['Course', 'Section', 'Faculty', ...(PERIODS.length > 1 ? ['Period'] : []), 'Status'], rows: gradeSheetsList().map((g) => [g.code, g.section, g.faculty, ...(PERIODS.length > 1 ? [g.period] : []), g.status]) }) },
    { id: 'classlist', name: 'Class List', roles: ['FACULTY'], filters: ['class'], build: (c) => ({ cols: ['#', 'Student number', 'Name', 'Course', 'Section', 'Faculty'], rows: ROSTER.map((s, i) => [i + 1, s.sn, s.name, c.code, c.section, me.name]) }) },
    { id: 'daily', name: 'Daily Attendance Report', roles: ['FACULTY'], filters: ['class', 'date'], build: (c) => { const s = attSession(c, ui.rep.date); return { cols: ['Student number', 'Name', 'Status', 'Time in', 'Time out', 'Remarks'], rows: s ? ROSTER.map((r) => { const x = s.rows[r.sn] || {}; return [r.sn, r.name, x.status || '\u2014', x.timeIn || '\u2014', x.timeOut || '\u2014', x.remarks || '']; }) : [] }; } },
    { id: 'attsum', name: 'Student Attendance Summary', roles: ['FACULTY'], filters: ['class'], build: (c) => ({ cols: ['Student number', 'Name', 'Sessions', 'Attended', 'Attendance %'], rows: ROSTER.map((s) => { const a = attPct(c.id, s.sn); return [s.sn, s.name, a.held, a.att, a.pct.toFixed(1) + '%']; }) }) },
    { id: 'gradesrep', name: 'Student Grade Report', roles: ['FACULTY'], filters: ['class'], build: (c) => ({ cols: ['Student number', 'Name', ...PERIODS.flatMap((p) => [`${p} %`, `${p} grade`]), 'Status'], rows: ROSTER.map((s) => [s.sn, s.name, ...PERIODS.flatMap((p) => { const r = periodResult(c.id, p, s.sn); return [r.pct === null ? '\u2014' : r.pct.toFixed(1), r.pct === null || !r.complete ? '\u2014' : toGrade(r.pct).toFixed(2)]; }), PERIODS.map((p) => (PERIODS.length > 1 ? `${p}: ` : '') + (db.fac.gradeStatus[`${c.id}|${p}`] || 'Draft')).join(' \u00B7 ')]) }) },
    // Academic performance, absence and tardiness (design reference 6.5); faculty see their class, Dept Heads every class
    { id: 'perf', name: 'Academic Performance Report', roles: ['FACULTY'], filters: ['class'], build: (c) => perfReport([c]) },
    { id: 'deptperf', name: 'Department Academic Performance', roles: ['DEPT_HEAD'], filters: [], build: () => perfReport(db.classes) },
    { id: 'absence', name: 'Student Absence Report', roles: ['FACULTY'], filters: ['class'], build: (c) => attFlagReport([c], 'absent') },
    { id: 'deptabsence', name: 'Student Absence Report (Department)', roles: ['DEPT_HEAD'], filters: [], build: () => attFlagReport(db.classes, 'absent') },
    { id: 'tardy', name: 'Tardiness Report', roles: ['FACULTY'], filters: ['class'], build: (c) => attFlagReport([c], 'late') },
    { id: 'depttardy', name: 'Tardiness Report (Department)', roles: ['DEPT_HEAD'], filters: [], build: () => attFlagReport(db.classes, 'late') },
  ];
  // Grade distribution, average and pass rate per class (uses official grades, corrections included)
  function perfReport(classes) {
    const bands = [['1.00\u20131.50', (g) => g <= 1.5], ['1.75\u20132.25', (g) => g > 1.5 && g <= 2.25], ['2.50\u20133.00', (g) => g > 2.25 && g <= 3], ['5.00', (g) => g > 3]];
    return { cols: ['Course', 'Section', 'Faculty', 'Sheet status', 'Graded', 'Average', 'Highest', 'Lowest', 'Passed', 'Failed', 'Pass rate', ...bands.map((b) => b[0])],
      rows: classes.map((c) => {
        const gs = ROSTER.map((x) => officialGrade(c.id, x.sn)).filter((g) => typeof g === 'number');
        const passed = gs.filter((g) => g <= 3).length;
        const avg = gs.length ? gs.reduce((n, g) => n + g, 0) / gs.length : null;
        return [c.code, c.section, userName(c.faculty), db.fac.gradeStatus[`${c.id}|${FINAL}`] || 'Draft', gs.length,
          avg === null ? '\u2014' : avg.toFixed(2), gs.length ? Math.min(...gs).toFixed(2) : '\u2014', gs.length ? Math.max(...gs).toFixed(2) : '\u2014',
          passed, gs.length - passed, gs.length ? ((passed / gs.length) * 100).toFixed(1) + '%' : '\u2014', ...bands.map((b) => gs.filter(b[1]).length)];
      }) };
  }

  // Students with absences or late arrivals, flagged against ICT's alert thresholds
  function attFlagReport(classes, kind) {
    const limit = kind === 'absent' ? db.alertCfg.maxAbsences : db.alertCfg.tardiness;
    const rows = [];
    classes.forEach((c) => ROSTER.forEach((x) => {
      const a = attendanceFor(c.id, x.sn), n = kind === 'absent' ? a.absent : a.late;
      if (!n) return;
      const rate = a.held - a.excused ? ((a.held - a.absent - a.excused) / (a.held - a.excused)) * 100 : null;
      rows.push([x.sn, x.name, c.code, c.section, n, a.held, rate === null ? '\u2014' : rate.toFixed(1) + '%', n >= limit ? 'Over limit' : 'Watch']);
    }));
    rows.sort((a, b) => b[4] - a[4]);
    return { cols: ['Student number', 'Name', 'Course', 'Section', kind === 'absent' ? 'Absences' : 'Late arrivals', 'Sessions', 'Attendance %', `Flag (limit ${limit})`], rows };
  }

  const myReports = () => REPORTS.filter((r) => r.roles.includes(me.role));

  PAGES.reports = () => {
    const list = myReports();
    if (!list.some((r) => r.id === ui.rep.id)) { ui.rep.id = list[0].id; ui.rep.result = null; }
    const def = list.find((r) => r.id === ui.rep.id);
    const cls = myClasses();
    if (me.role === 'FACULTY') {
      if (!cls.some((c) => c.id === ui.rep.cls)) ui.rep.cls = cls[0] ? cls[0].id : '';
      const c = cls.find((x) => x.id === ui.rep.cls);
      if (c && !meetingDates(c).includes(ui.rep.date)) ui.rep.date = meetingDates(c)[1] || meetingDates(c)[0] || '';
    }
    const c = cls.find((x) => x.id === ui.rep.cls);
    const mine = db.reports.filter((r) => me.role === 'ICT_ADMIN' || r.by === me.username).slice(0, 6);
    return `${head('Reports', me.role === 'FACULTY' ? 'Reports are limited to the classes assigned to you.' : me.role === 'EDTECH' ? 'Operational reports for schedules, assignments and platform events.' : me.role === 'DEPT_HEAD' ? 'Departmental reports for your students, classes, attendance and grade submissions.' : 'Administrative and security reports. Student academic data is not included.')}
      ${card('Generate a report', `<div class="staff-toolbar">
        <select id="repId" class="dm-select" aria-label="Report">${opts(list.map((r) => [r.id, r.name]), ui.rep.id)}</select>
        ${def.filters.includes('class') ? `<select id="repCls" class="dm-select" aria-label="Class">${opts(cls.map((x) => [x.id, `${x.code} \u00B7 ${x.section}`]), ui.rep.cls)}</select>` : ''}
        ${def.filters.includes('date') && c ? `<select id="repDate" class="dm-select" aria-label="Meeting date">${opts(meetingDates(c).map((d) => [d, fmtDateLong(d)]), ui.rep.date)}</select>` : ''}
        ${def.filters.includes('range') ? `<label class="staff-inline">From <input type="date" id="repFrom" class="dm-select" value="${esc(ui.rep.from)}" /></label><label class="staff-inline">To <input type="date" id="repTo" class="dm-select" value="${esc(ui.rep.to)}" /></label>` : ''}
        <button type="button" class="btn-solid" data-act="rep-generate">Generate</button></div>
        <div id="repOut">${ui.rep.result ? reportPaper(ui.rep.result) : '<p class="dm-empty">Choose a report and press Generate.</p>'}</div>`)}
      ${mine.length ? card('Recently generated', table(['Generated', 'Report', 'By', 'Records'], mine.map((r) => `<tr><td>${esc(fmtStamp(r.ts))}</td><td>${esc(r.name)}</td><td>${esc(r.by)}</td><td>${r.count}</td></tr>`))) : ''}`;
  };
  function reportPaper(r) {
    return `<div class="staff-report-bar"><button type="button" class="btn-light btn-sm" data-act="rep-csv">Export CSV</button><button type="button" class="btn-solid btn-sm" data-act="rep-print">Print / Save as PDF</button></div>
      <div class="doc-paper staff-paper">${paperHtml(r)}</div>`;
  }
  function paperHtml(r) {
    return `<div class="paper-head"><div class="paper-brand"><span class="paper-mark" aria-hidden="true">B</span><div><strong>BITS-SIMS</strong><small>Student Information Management System</small></div></div></div>
      <h3 class="paper-title">${esc(r.title.toUpperCase())}</h3><p class="paper-subtitle">${esc(r.sub)}</p>
      <dl class="paper-info"><div><dt>Generated by:</dt><dd>${esc(me.name)}</dd></div><div><dt>Role:</dt><dd>${esc(ROLE_LABEL[me.role])}</dd></div><div><dt>Date:</dt><dd>${esc(fmtStamp(r.ts))}</dd></div><div><dt>Records:</dt><dd>${r.rows.length}</dd></div></dl>
      <table class="paper-table"><thead><tr>${r.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.rows.length ? r.rows.map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${r.cols.length}">No records for the selected filters.</td></tr>`}</tbody></table>`;
  }
  function generateReport() {
    const def = REPORTS.find((r) => r.id === ui.rep.id);
    const c = db.classes.find((x) => x.id === ui.rep.cls && x.faculty === me.username);
    if (def.filters.includes('class') && !c) { toast('Choose one of your classes first.', 'error'); return; }
    const out = def.build(c);
    const sub = c ? `${c.code} ${c.section} \u00B7 ${c.title}${def.filters.includes('date') ? ' \u00B7 ' + fmtDateLong(ui.rep.date) : ''}` : (ui.rep.from || ui.rep.to ? `${ui.rep.from || 'start'} to ${ui.rep.to || 'today'}` : '1st Semester, AY 2026\u20132027');
    ui.rep.result = { title: def.name, sub, cols: out.cols, rows: out.rows, ts: nowStamp() };
    db.reports.unshift({ ts: ui.rep.result.ts, name: def.name, by: me.username, count: out.rows.length });
    if (db.reports.length > 60) db.reports.length = 60;
    save('reports');
    audit('Reports', 'GeneratedReports', def.id, 'EXPORT', `Generated ${def.name} (${out.rows.length} records)`);
    render();
  }

  function downloadCsv(name, cols, rows) {
    const cell = (v) => { const t = String(v === undefined || v === null ? '' : v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const csv = [cols, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `BITS-SIMS ${name}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function printReport() {
    const box = document.createElement('div');
    box.id = 'stPrint'; box.className = 'doc-paper'; box.innerHTML = paperHtml(ui.rep.result);
    document.body.appendChild(box); document.body.classList.add('staff-printing');
    const done = () => { box.remove(); document.body.classList.remove('staff-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    toast('Choose \u201CSave as PDF\u201D in the print dialog.', 'info');
    setTimeout(() => window.print(), 200);
  }

  /* =====================================================
     DEPARTMENT HEAD
     Class offerings + faculty assignment, grade review, and a
     read-only view of the department's students and attendance.
     Scope: the Department Head's own department (me.deptCode).
     Grade chain (design reference 5.15): Faculty submits ->
     Department Head approves/returns -> Registrar posts.
  ===================================================== */
  const deptCode = () => (me && me.deptCode) || 'IT';
  const deptStudents = () => (window.SIMSRegistry ? window.SIMSRegistry.inDepartment(deptCode()) : []);

  function gradeSheetsList() {
    const out = [];
    db.classes.forEach((c) => PERIODS.forEach((p) => {
      if (!db.fac.assessments.some((a) => a.classId === c.id && a.period === p)) return;
      const key = `${c.id}|${p}`;
      out.push({ classId: c.id, code: c.code, section: c.section, title: c.title, faculty: userName(c.faculty), period: p, status: db.fac.gradeStatus[key] || 'Draft', note: (db.fac.gradeNotes || {})[key] || null });
    }));
    return out;
  }

  // Write to the shared audit trail on behalf of another portal (e.g. the Registrar)
  function record(user, mod, ent, rec, act, desc, status, prev, next) {
    db.audit.unshift({ id: (db.audit[0] ? db.audit[0].id : 0) + 1, ts: nowStamp(), user, mod, ent, rec: userRec(ent, rec), act, desc, status: status || 'Success', ip: ipFor(user), prev: prev || '', next: next || '' });
    if (db.audit.length > 300) db.audit.length = 300;
    save('audit');
  }

  function setGradeStatus(classId, period, status, by, note) {
    const key = `${classId}|${period}`, before = db.fac.gradeStatus[key] || 'Draft';
    db.fac.gradeStatus[key] = status;
    db.fac.postedAt = db.fac.postedAt || {};
    if (status === 'Posted') db.fac.postedAt[key] = nowStamp();
    db.fac.gradeNotes = db.fac.gradeNotes || {};
    if (note) db.fac.gradeNotes[key] = { by, note, ts: nowStamp(), status };
    else delete db.fac.gradeNotes[key];
    persist(K.fac, db.fac);
    const c = db.classes.find((x) => x.id === classId);
    record(by, 'Grades', 'StudentGrades', `${c ? c.code : classId}|${period}`, status === 'Returned' ? 'UPDATE' : 'APPROVE',
      `${status} ${period} grades for ${c ? c.code + ' ' + c.section : classId}${note ? ' \u2014 ' + note : ''}`, 'Success', 'status: ' + before, 'status: ' + status);
  }

  /* =====================================================
     ACADEMIC RECORDS LINK (Module 3 -> data.js)
     The faculty grade sheet is the source of truth. Whenever faculty
     data changes, the student-portal record (SIMSData) is brought in
     line: Draft/Returned = hidden, Submitted/Approved = awaiting release,
     Posted = official. Posted sheets are also stored for the whole class
     (classGrades) for transcripts and analytics. Attendance submitted by
     faculty becomes the student's attendance record.
  ===================================================== */
  const FINAL = PERIODS[PERIODS.length - 1];
  const RECORD_STATE = { Submitted: 'submitted', Approved: 'approved', Posted: 'posted' };

  // Official grade for one student: an applied correction wins, otherwise the computed grade
  function officialGrade(classId, sn) {
    const o = (db.fac.overrides || {})[`${classId}|${FINAL}|${sn}`];
    if (o !== undefined && o !== null) return o;   // number or 'INC'
    const r = periodResult(classId, FINAL, sn);
    return r.pct !== null && r.complete ? toGrade(r.pct) : null;
  }

  function attendanceFor(classId, sn) {
    const sessions = Object.entries(db.fac.attendance[classId] || {})
      .filter(([, x]) => x.status === 'Submitted' && x.rows[sn])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, x]) => ({ date, status: x.rows[sn].status }));
    const count = (st) => sessions.filter((x) => x.status === st).length;
    return { held: sessions.length, absent: count('Absent'), late: count('Late'), excused: count('Excused'), sessions };
  }

  const gradeRemark = (g, passing) => (g === 'INC' ? 'inc' : typeof g === 'number' ? (g <= passing ? 'passed' : 'failed') : 'inprogress');

  function syncRecords() {
    const D = window.SIMSData;
    if (!D || !D.raw) return;
    const term = D.currentTerm(), sn = D.student().id, passing = D.rules().passingGrade;
    const subjects = D.raw.subjectsIn(term.id);
    const changes = [], classGrades = {};
    db.classes.forEach((c) => {
      const key = `${c.id}|${FINAL}`, st = db.fac.gradeStatus[key] || 'Draft';
      const subj = subjects.find((x) => x.code === c.code);
      if (st === 'Posted') {
        classGrades[`${c.code}|${term.id}`] = {
          code: c.code, title: c.title, termId: term.id, units: subj ? subj.units : 3, section: c.section,
          faculty: userName(c.faculty), postedAt: (db.fac.postedAt || {})[key] || '',
          rows: Object.fromEntries(ROSTER.map((x) => { const g = officialGrade(c.id, x.sn); return [x.sn, { name: x.name, grade: typeof g === 'number' ? g : null, status: gradeRemark(g, passing) }]; }))
        };
      }
      if (!subj || !ROSTER.some((r) => r.sn === sn)) return;
      const g = officialGrade(c.id, sn), rs = RECORD_STATE[st];
      const want = rs && g !== null
        ? { finalGrade: typeof g === 'number' ? g : null, status: gradeRemark(g, passing), gradeStatus: { final: rs } }
        : { finalGrade: null, status: 'inprogress', gradeStatus: {} };
      const att = attendanceFor(c.id, sn);
      Object.assign(want, {
        attendance: { held: att.held, absent: att.absent, late: att.late, excused: att.excused },
        sessions: att.sessions,
        instructor: userName(c.faculty),
        schedule: `${c.day.slice(0, 3)} ${fmtTime(c.start)}-${fmtTime(c.end)}`
      });
      const differs = Object.keys(want).some((k) => JSON.stringify(subj[k] === undefined ? null : subj[k]) !== JSON.stringify(want[k]));
      if (differs) changes.push([subj.id, want]);
    });
    const cgSame = JSON.stringify(D.get().classGrades || {}) === JSON.stringify(classGrades);
    if (!changes.length && cgSame) return;
    D.update((d) => {
      changes.forEach(([id, want]) => {
        const x = d.subjects.find((y) => y.id === id);
        const gradeMoved = x.finalGrade !== want.finalGrade || JSON.stringify(x.gradeStatus || {}) !== JSON.stringify(want.gradeStatus);
        Object.assign(x, want);
        if (gradeMoved) x.updated = isoDate(new Date());
      });
      d.classGrades = classGrades;
    });
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    Promise.resolve().then(() => { syncQueued = false; try { syncRecords(); } catch (e) { console.error('[SIMSStaff] sync failed', e); } });
  }

  /* ---------- Grade corrections (design reference rule 15) ----------
     A posted grade only changes through: Faculty requests (with a reason)
     -> Department Head endorses -> Registrar applies. Rejections need a
     reason. Every step is in the audit trail with the old and new grade. */
  const GRADE_CHOICES = ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00', '5.00', 'INC'];
  const fmtGrade = (g) => (g === 'INC' ? 'INC' : typeof g === 'number' ? g.toFixed(2) : '\u2014');
  const corrections = () => (db.fac.corrections = db.fac.corrections || []);

  function requestCorrection(classId, sn, to, reason, by) {
    const c = db.classes.find((x) => x.id === classId), st = ROSTER.find((x) => x.sn === sn);
    if (!c || !st) return { ok: false, message: 'Unknown class or student.' };
    if ((db.fac.gradeStatus[`${classId}|${FINAL}`] || 'Draft') !== 'Posted') return { ok: false, message: 'Only posted grades go through a correction.' };
    const from = officialGrade(classId, sn);
    const next = to === 'INC' ? 'INC' : Number(to);
    if (next !== 'INC' && !(next >= 1 && next <= 5)) return { ok: false, message: 'Choose the corrected grade.' };
    if (fmtGrade(from) === fmtGrade(next)) return { ok: false, message: 'The corrected grade is the same as the posted grade.' };
    if (!reason || reason.trim().length < 10) return { ok: false, message: 'Explain the reason (at least 10 characters).' };
    if (corrections().some((x) => x.classId === classId && x.sn === sn && ['Requested', 'Endorsed'].includes(x.status))) return { ok: false, message: 'This student already has an open correction for this class.' };
    const n = corrections().length + 1, id = 'GC-' + String(n).padStart(4, '0');
    corrections().unshift({ id, classId, code: c.code, section: c.section, title: c.title, sn, name: st.name, from, to: next, reason: reason.trim(), by, ts: nowStamp(), status: 'Requested', history: [{ status: 'Requested', by, ts: nowStamp(), note: reason.trim() }] });
    persist(K.fac, db.fac);
    record(by, 'Grades', 'GradeCorrections', id, 'CREATE', `Requested grade correction for ${st.name} in ${c.code}: ${fmtGrade(from)} \u2192 ${fmtGrade(next)}`, 'Success', 'grade: ' + fmtGrade(from), 'grade: ' + fmtGrade(next));
    return { ok: true, id };
  }

  // action: 'endorse' (Dept Head) | 'apply' (Registrar) | 'reject' (either; needs a note)
  function decideCorrection(id, action, by, note) {
    const x = corrections().find((y) => y.id === id);
    if (!x) return { ok: false, message: 'Correction not found.' };
    const allowed = { endorse: ['Requested'], apply: ['Endorsed'], reject: ['Requested', 'Endorsed'] }[action];
    if (!allowed || !allowed.includes(x.status)) return { ok: false, message: 'This correction can no longer be changed.' };
    if (action === 'reject' && !(note && note.trim())) return { ok: false, message: 'A reason is required to reject a correction.' };
    x.status = { endorse: 'Endorsed', apply: 'Applied', reject: 'Rejected' }[action];
    x.history.push({ status: x.status, by, ts: nowStamp(), note: (note || '').trim() });
    if (action === 'apply') {
      db.fac.overrides = db.fac.overrides || {};
      db.fac.overrides[`${x.classId}|${FINAL}|${x.sn}`] = x.to;
    }
    persist(K.fac, db.fac);
    record(by, 'Grades', 'GradeCorrections', x.id, action === 'apply' ? 'UPDATE' : 'APPROVE',
      `${x.status} grade correction ${x.id} (${x.name}, ${x.code}: ${fmtGrade(x.from)} \u2192 ${fmtGrade(x.to)})${note ? ' \u2014 ' + note.trim() : ''}`, 'Success',
      action === 'apply' ? 'grade: ' + fmtGrade(x.from) : 'status: ' + x.history[x.history.length - 2].status, action === 'apply' ? 'grade: ' + fmtGrade(x.to) : 'status: ' + x.status);
    return { ok: true };
  }

  function attendanceSummary() {
    return db.classes.map((c) => {
      const sessions = Object.values(db.fac.attendance[c.id] || {}).filter((s) => s.status === 'Submitted');
      let present = 0, absent = 0, late = 0;
      sessions.forEach((s) => ROSTER.forEach((st) => {
        const r = s.rows[st.sn]; if (!r) return;
        if (r.status === 'Absent') absent++; else if (r.status === 'Excused') return; else { present++; if (r.status === 'Late') late++; }
      }));
      return { code: c.code, title: c.title, section: c.section, faculty: userName(c.faculty), held: sessions.length, absent, late, rate: present + absent ? (present / (present + absent)) * 100 : null };
    });
  }

  /* ---------- Attendance overview (read only) ---------- */
  function deptAttendance() {
    const rows = attendanceSummary();
    const held = rows.reduce((n, r) => n + r.held, 0), withData = rows.filter((r) => r.rate !== null);
    const avg = withData.length ? withData.reduce((n, r) => n + r.rate, 0) / withData.length : null;
    return `${head('Attendance Overview', 'Attendance for your department\u2019s classes. Assigned faculty encode it; you can review it here.')}
      <div class="staff-stats">
        ${stat('AVERAGE ATTENDANCE', avg === null ? '\u2014' : avg.toFixed(1) + '%', 'Across classes with records')}
        ${stat('MEETINGS RECORDED', held, 'Submitted by faculty')}
        ${stat('ACTIVE ALERTS', db.fac.alerts.length, 'Absence or tardiness thresholds', 'is-blue')}
      </div>
      ${card('Class attendance', table(['Course', 'Section', 'Faculty', 'Meetings', 'Absences', 'Late', 'Rate'], rows.map((r) => `<tr><td><strong>${esc(r.code)}</strong><br><small>${esc(r.title)}</small></td><td>${esc(r.section)}</td><td>${esc(r.faculty)}</td><td>${r.held}</td><td>${r.absent}</td><td>${r.late}</td><td>${r.rate === null ? '\u2014' : r.rate.toFixed(1) + '%'}</td></tr>`)))}
      ${card('Attendance alerts', db.fac.alerts.length ? `<ul class="staff-list">${db.fac.alerts.slice(0, 8).map((a) => `<li><div><strong>${esc(a.student)}</strong><small>${esc(a.message)}</small></div>${badge(a.type === 'Absence' ? 'Absent' : 'Late')}</li>`).join('')}</ul>` : '<p class="dm-modal-note">No students have crossed an alert threshold.</p>')}`;
  }

  /* ---------- Department students (read only, from the Registrar's registry) ---------- */
  PAGES.students = () => `${head('Department Students', `Students in the ${me.dept} department. View only \u2014 registration and record changes are handled by the Registrar.`)}
    ${card('', `<div class="staff-toolbar">
      <input type="search" id="stuQ" class="dm-select staff-search" placeholder="Search student number or name" value="${esc(ui.stu.q)}" aria-label="Search students" />
      <select id="stuStatus" class="dm-select" aria-label="Filter by status">${opts(['Active', 'On Leave', 'Archived'].map((s) => [s, s]), ui.stu.status, 'All statuses')}</select>
    </div><div id="stuTable"></div>`)}`;
  function refreshStudents() {
    const box = $('#stuTable'); if (!box) return;
    const q = ui.stu.q.toLowerCase();
    const list = deptStudents().filter((s) => (ui.stu.status === 'all' || s.status === ui.stu.status) && (!q || (s.no + ' ' + s.name).toLowerCase().includes(q)));
    box.innerHTML = table(['Student no.', 'Name', 'Program', 'Year', 'Admission', 'Status'], list.map((s) => `<tr><td>${esc(s.no)}</td><td><strong>${esc(s.name)}</strong></td><td>${esc(s.program)}</td><td>${esc(s.year)}</td><td>${esc(s.admission)}</td><td>${badge(s.status)}</td></tr>`), 'No students match.')
      + `<p class="dm-foot">Showing ${list.length} of ${deptStudents().length} students in ${esc(me.dept)}.</p>`;
  }

  /* ---------- Grade review ---------- */
  PAGES.review = () => {
    const order = { Submitted: 0, Returned: 1, Approved: 2, Posted: 3, Draft: 4 };
    const list = gradeSheetsList().sort((a, b) => order[a.status] - order[b.status]);
    const n = (s) => list.filter((x) => x.status === s).length;
    return `${head('Grade Review', 'Review grade sheets submitted by your faculty. Approved sheets go to the Registrar for posting; returned sheets go back to the faculty with your remarks.')}
      <div class="staff-stats">
        ${stat('AWAITING REVIEW', n('Submitted'), 'Submitted by faculty')}
        ${stat('RETURNED', n('Returned'), 'Back with the faculty')}
        ${stat('APPROVED', n('Approved'), 'Waiting for the Registrar')}
        ${stat('POSTED', n('Posted'), 'Official grades', 'is-blue')}
      </div>
      ${correctionsCard(corrections().filter((x) => x.status !== 'Applied' || x.history.some((h) => h.by === me.username)), 'Grade corrections', true)}
      ${card('', table(['Course', 'Section', 'Faculty', ...(PERIODS.length > 1 ? ['Period'] : []), 'Status', 'Remarks', ''], list.map((g) => `<tr><td><strong>${esc(g.code)}</strong><br><small>${esc(g.title)}</small></td><td>${esc(g.section)}</td><td>${esc(g.faculty)}</td>${PERIODS.length > 1 ? `<td>${esc(g.period)}</td>` : ''}<td>${badge(g.status)}</td><td><small>${g.note ? esc(g.note.note) : '\u2014'}</small></td>
        <td>${g.status === 'Draft' ? '<small>Not yet submitted</small>' : `<button type="button" class="btn-${g.status === 'Submitted' ? 'solid' : 'light'} btn-sm" data-act="rev-open" data-id="${g.classId}" data-period="${g.period}">${g.status === 'Submitted' ? 'Review' : 'View'}</button>`}</td></tr>`), 'No grade sheets yet.'))}`;
  };

  function reviewModal(classId, period) {
    const c = db.classes.find((x) => x.id === classId); if (!c) return;
    const key = `${classId}|${period}`, status = db.fac.gradeStatus[key] || 'Draft', list = assessmentsFor(classId, period);
    const totalW = list.reduce((n, a) => n + a.weight, 0);
    const res = ROSTER.map((s) => ({ s, r: periodResult(classId, period, s.sn) }));
    const done = res.filter((x) => x.r.pct !== null && x.r.complete);
    const avg = done.length ? done.reduce((n, x) => n + x.r.pct, 0) / done.length : null;
    const failing = done.filter((x) => toGrade(x.r.pct) > 3).length;
    const act = status === 'Submitted';
    openModal({ title: `${period} grades \u00B7 ${c.code} ${c.section}`, ok: act ? 'Approve grades' : 'Close', cancel: act ? 'Cancel' : 'Close',
      body: `<p class="dm-modal-note"><strong>${esc(c.title)}</strong> \u2014 ${esc(userName(c.faculty))} \u00B7 ${badge(status)}</p>
        <div class="dm-table-wrap staff-table-wrap"><table class="dm-table staff-table"><thead><tr><th>Student</th>${list.map((a) => `<th class="num">${esc(a.name)}<br><small>/${a.max} \u00B7 ${a.weight}%</small></th>`).join('')}<th class="num">${esc(period)} %</th><th class="num">Grade</th></tr></thead>
        <tbody>${res.map(({ s, r }) => `<tr><td><strong>${esc(s.name)}</strong><br><small>${s.sn}</small></td>${list.map((a) => { const v = (db.fac.scores[a.id] || {})[s.sn]; return `<td class="num">${typeof v === 'number' ? v : '\u2014'}</td>`; }).join('')}<td class="num">${r.pct === null ? '\u2014' : r.pct.toFixed(1) + '%'}</td><td class="num">${r.pct === null || !r.complete ? '\u2014' : toGrade(r.pct).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>
        <p class="dm-foot">Class average ${avg === null ? '\u2014' : avg.toFixed(1) + '%'} \u00B7 ${failing} failing \u00B7 weights total <strong class="${totalW === 100 ? '' : 'staff-bad'}">${totalW}%</strong>${totalW === 100 ? '' : ' (should be 100%)'}</p>
        ${act ? `<div class="set-field"><label for="revNote">Remarks (required to return the grades)</label><textarea id="revNote" rows="3" placeholder="e.g. Please recheck the Quiz 2 scores."></textarea></div>
        <div class="set-actions"><button type="button" class="btn-light" data-act="rev-return" data-id="${classId}" data-period="${period}">Return for correction</button></div>` : ''}`,
      onOk: () => {
        if (!act) return true;
        setGradeStatus(classId, period, 'Approved', me.username);
        toast(`${period} grades approved. The Registrar can now post them.`); render(); return true;
      } });
  }

  /* ---------- New class offering ---------- */
  function newClassForm() {
    const faculty = db.users.filter((u) => u.role === 'FACULTY' && u.status === 'Active');
    return `<form id="ncForm" class="staff-form" novalidate>
      <div class="set-grid-2">
        ${field('ncCode', 'Course code', '<input id="ncCode" placeholder="e.g. ITP3113R" />')}
        ${field('ncTitle', 'Course title', '<input id="ncTitle" />')}
        ${field('ncSection', 'Section', '<input id="ncSection" placeholder="e.g. 3B" />')}
        ${field('ncFac', 'Assigned faculty', `<select id="ncFac" class="dm-select">${opts(faculty.map((u) => [u.username, u.name]), '')}</select>`)}
        ${field('ncRoom', 'Room', `<select id="ncRoom" class="dm-select">${opts(ROOMS_OK().map((r) => [r, r]), '')}</select>`)}
        ${field('ncDay', 'Day', `<select id="ncDay" class="dm-select">${opts(Object.keys(DAY_IDX).map((d) => [d, d]), 'Monday')}</select>`)}
        ${field('ncStart', 'Start time', '<input id="ncStart" type="time" />')}
        ${field('ncEnd', 'End time', '<input id="ncEnd" type="time" />')}
        ${field('ncCap', 'Class capacity', '<input id="ncCap" type="number" min="1" max="200" value="40" />')}
      </div></form>`;
  }
  function saveNewClass() {
    ['ncCode', 'ncTitle', 'ncSection', 'ncEnd', 'ncCap'].forEach((i) => setErr(i, ''));
    const v = { code: $('#ncCode').value.trim().toUpperCase(), title: $('#ncTitle').value.trim(), section: $('#ncSection').value.trim().toUpperCase(), start: $('#ncStart').value, end: $('#ncEnd').value, cap: Number($('#ncCap').value) };
    let ok = true;
    if (!v.code) { setErr('ncCode', 'Course code is required.'); ok = false; }
    if (!v.title) { setErr('ncTitle', 'Course title is required.'); ok = false; }
    if (!v.section) { setErr('ncSection', 'Section is required.'); ok = false; }
    if (!(v.cap >= 1)) { setErr('ncCap', 'Enter a capacity of at least 1.'); ok = false; }
    if (!v.start || !v.end || toMin(v.end) <= toMin(v.start)) { setErr('ncEnd', 'Set a start time, and an end time after it.'); ok = false; }
    if (v.code && v.section && db.classes.some((c) => c.code === v.code && c.section === v.section)) { setErr('ncSection', `${v.code} section ${v.section} already exists.`); ok = false; }
    if (!ok) return false;
    const next = { id: 'CO-' + (db.classes.reduce((n, c) => Math.max(n, parseInt(c.id.split('-')[1], 10) || 0), 0) + 1), code: v.code, title: v.title, section: v.section, year: YEAR_LEVEL, faculty: $('#ncFac').value,
      day: $('#ncDay').value, start: v.start, end: v.end, room: $('#ncRoom').value, modality: MODALITY, type: 'Lecture', capacity: v.cap, size: 0, status: 'Open' };
    const conflicts = findConflicts(next);
    if (conflicts.length) { setErr('ncEnd', conflicts[0]); return false; }
    db.classes.push(next); save('classes');
    audit('Scheduling', 'ClassOfferings', next.id, 'CREATE', `Created class offering ${next.code} ${next.section} (${userName(next.faculty)})`, 'Success', '', `${next.day} ${next.start}-${next.end} ${next.room}`);
    toast('Class offering created.'); render();
    return true;
  }

  /* ---------- SYSTEM SETTINGS (ICT) ---------- */
  PAGES.settings = () => {
    const p = db.policy, a = db.alertCfg;
    return `${head('System Settings', 'Security policy and attendance alert rules. Changes apply immediately and are audited.')}
      <div class="staff-split">
        <form id="polForm" class="dash-card dm-card staff-card staff-form" novalidate>
          <h3 class="adm-sec-title">Security policy</h3>
          <div class="set-grid-2">
            ${field('plFail', 'Failed logins before lockout', `<input id="plFail" type="number" min="3" max="10" value="${p.maxFailed}" />`)}
            ${field('plLock', 'Lockout duration (minutes)', `<input id="plLock" type="number" min="1" max="1440" value="${p.lockMin}" />`)}
            ${field('plMin', 'Minimum password length', `<input id="plMin" type="number" min="8" max="64" value="${p.minPw}" />`)}
            ${field('plIdle', 'Session timeout (minutes)', `<input id="plIdle" type="number" min="5" max="240" value="${p.timeoutMin}" />`, 'Everyone (students and staff) is signed out after this much inactivity.')}
          </div>
          <div class="set-actions"><button type="submit" class="btn-solid">Save policy</button></div>
        </form>
        <form id="alForm" class="dash-card dm-card staff-card staff-form" novalidate>
          <h3 class="adm-sec-title">Attendance alert rules</h3>
          <div class="set-grid-2">
            ${field('alAbs', 'Absences before an alert', `<input id="alAbs" type="number" min="1" max="20" value="${a.maxAbsences}" />`)}
            ${field('alLate', 'Late arrivals before an alert', `<input id="alLate" type="number" min="1" max="20" value="${a.tardiness}" />`)}
          </div>
          <label class="check-row staff-check"><input type="checkbox" id="alOn" ${a.enabled ? 'checked' : ''}/><span>Alert rules enabled</span></label>
          <p class="dm-foot">Students get a warning on their Attendance page, faculty see alerts for their own classes and the Department Head sees all of them. The absence and tardiness reports use the same limits.</p>
          <div class="set-actions"><button type="submit" class="btn-solid">Save alert rules</button></div>
        </form>
      </div>`;
  };

  /* ---------- MY ACCOUNT (all staff) ---------- */
  PAGES.account = () => {
    const rec = db.users.find((u) => u.username === me.username) || {};
    return `${head('My Account', 'Your staff profile is managed by ICT Services. You can change your own password here.')}
      <div class="staff-split staff-split-even">
        ${card('', `<div class="staff-identity"><div class="staff-big-avatar">${esc(initials(me.name))}</div><h3>${esc(me.name)}</h3><p class="dm-modal-note">${esc(me.title)}</p></div>
          <dl class="set-info">
            <div><dt>Role</dt><dd>${esc(ROLE_LABEL[me.role])}</dd></div><div><dt>Employee no.</dt><dd>${esc(me.employeeNo)}</dd></div>
            <div><dt>Department</dt><dd>${esc(me.dept)}</dd></div><div><dt>Work email</dt><dd>${esc(me.email)}</dd></div>
            <div><dt>Contact</dt><dd>${esc(me.contact)}</dd></div><div><dt>Date hired</dt><dd>${fmtDate(me.hired)}</dd></div>
            <div><dt>Account status</dt><dd>${esc(rec.status || 'Active')}</dd></div><div><dt>Last login</dt><dd>${esc(fmtStamp(rec.lastLogin))}</dd></div>
          </dl>`)}
        <form id="pwForm" class="dash-card dm-card staff-card staff-form" novalidate>
          <h3 class="adm-sec-title">Change password</h3>
          ${field('spCur', 'Current password', pwInput('spCur', 'current-password'))}
          ${field('spNew', 'New password', pwInput('spNew', 'new-password'), `At least ${db.policy.minPw} characters with upper and lower case letters, a number and a symbol.`)}
          ${field('spConf', 'Confirm new password', pwInput('spConf', 'new-password'))}
          <div class="pw-meter-row"><div class="pw-meter" id="spMeter" data-level="0"><span></span></div><small id="spMeterLabel"></small></div>
          <div class="set-actions"><button type="submit" class="btn-solid">Update password</button></div>
        </form>
      </div>`;
  };
  const pwScore = (pw) => { if (!pw) return 0; let s = 0; if (pw.length >= db.policy.minPw) s++; if (pw.length >= 12) s++; if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++; if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++; return Math.max(1, s); };

  /* =====================================================
     EVENTS
  ===================================================== */
  function onClick(e) {
    const navEl = e.target.closest('[data-nav]');
    if (navEl) { e.preventDefault(); go(navEl.dataset.nav); return; }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const id = el.dataset.id;
    switch (el.dataset.act) {
      case 'logout': close(); break;
      case 'modal-close': closeModal(); break;
      case 'modal-ok': { const r = modalOk ? modalOk() : undefined; if (r !== false) closeModal(); break; }

      case 'acct-add': if (!can('accounts.manage')) break; openModal({ title: 'New account', body: accountForm(null), ok: 'Create account', onOk: () => saveAccount(null) }); break;
      case 'acct-edit': { const u = db.users.find((x) => x.id === Number(id)); if (u && can('accounts.manage')) openModal({ title: `Edit ${u.username}`, body: accountForm(u), onOk: () => saveAccount(u) }); break; }
      case 'acct-reset': { const u = db.users.find((x) => x.id === Number(id)); if (!u || (!can('accounts.manage') && u.role === 'ICT_ADMIN')) break; ask('Reset password?', `Issue a temporary password for ${u.name}? Their current password stops working.`, 'Issue code', () => resetPassword(u)); break; }
      case 'acct-unlock': { const u = db.users.find((x) => x.id === Number(id)); if (!u || (!can('accounts.manage') && u.role === 'ICT_ADMIN')) break; u.status = 'Active'; u.failed = 0; u.lockoutUntil = ''; delete db.locks[u.username]; save('users', 'locks'); audit('User Accounts', 'Users', 'U-' + u.id, 'UPDATE', `Unlocked account ${u.username}`, 'Success', 'status: Locked', 'status: Active'); toast(`${u.username} unlocked.`); render(); break; }
      case 'acct-toggle': { const u = db.users.find((x) => x.id === Number(id)); if (!u || !can('accounts.manage') || u.username === me.username) break; const susp = u.status !== 'Suspended';
        ask(susp ? 'Suspend account?' : 'Reactivate account?', susp ? `${u.name} will no longer be able to sign in. Their records are kept.` : `${u.name} will be able to sign in again.`, susp ? 'Suspend' : 'Reactivate', () => { const before = u.status; u.status = susp ? 'Suspended' : 'Active'; save('users'); audit('User Accounts', 'Users', 'U-' + u.id, 'UPDATE', `${susp ? 'Suspended' : 'Reactivated'} account ${u.username}`, 'Success', 'status: ' + before, 'status: ' + u.status); toast(`Account ${susp ? 'suspended' : 'reactivated'}.`, susp ? 'info' : 'success'); render(); }, susp); break; }

      case 'roles-save': if (!rolesDraft || !can('roles.manage')) break;
        if (!rolesDraft.ICT_ADMIN.includes('ROLE_MANAGE') || !rolesDraft.ICT_ADMIN.includes('USER_MANAGE')) { toast('ICT Services must keep USER_MANAGE and ROLE_MANAGE.', 'error'); break; }
        { const diffs = []; ROLE_ORDER.forEach((r) => PERMISSIONS.forEach(([p]) => { const a = db.perms[r].includes(p), b = rolesDraft[r].includes(p); if (a !== b) diffs.push(`${b ? '+' : '-'}${p} (${r})`); }));
          db.perms = rolesDraft; rolesDraft = null; save('perms'); audit('Roles', 'RolePermissions', 'MATRIX', 'UPDATE', `Updated ${diffs.length} permission(s)`, 'Success', '', diffs.join(', ')); toast('Permissions saved.'); render(); }
        break;
      case 'roles-discard': rolesDraft = null; render(); break;

      case 'audit-export': if (!can('audit.full')) break; downloadCsv('Audit Trail', ['Time', 'User', 'Module', 'Entity', 'Record', 'Action', 'Description', 'Previous', 'New', 'IP', 'Result'], auditRows().map((a) => [a.ts, a.user, a.mod, a.ent, a.rec, a.act, a.desc, a.prev, a.next, a.ip, a.status])); audit('Audit', 'AuditLogs', 'EXPORT', 'EXPORT', 'Exported audit trail to CSV'); break;

      case 'bk-run': { if (!can('backup.manage')) break; const n = db.backups.history.length ? parseInt(db.backups.history[0].id.split('-')[1], 10) + 1 : 1; const entry = { id: 'BK-' + pad(n).padStart(4, '0'), type: db.backups.config.type, start: nowStamp(), end: '', size: 0, status: 'Running', checksum: '', by: me.username, restoreTested: '', failure: '' };
        db.backups.history.unshift(entry); save('backups'); toast('Backup started\u2026', 'info'); render();
        setTimeout(() => { entry.status = 'Completed'; entry.end = nowStamp(); entry.size = 1288000000 + Math.floor(Math.random() * 40000000); entry.checksum = 'sha256:' + Math.random().toString(16).slice(2, 6) + '\u2026' + Math.random().toString(16).slice(2, 6); save('backups'); audit('Backup', 'BackupHistory', entry.id, 'BACKUP', 'Manual backup completed'); if (page === 'backups' && root) { render(); toast(`${entry.id} completed.`); } }, 1800); break; }
      case 'bk-verify': { const h = db.backups.history.find((x) => x.id === id); if (!h || !can('backup.manage')) break; ask('Test restore?', `Restore ${h.id} into a scratch database and verify its checksum. Production data is not touched.`, 'Run test', () => { h.restoreTested = isoDate(new Date()); save('backups'); audit('Backup', 'BackupHistory', h.id, 'UPDATE', `Restore test passed for ${h.id}`); toast(`Restore test passed for ${h.id}.`); render(); }); break; }

      case 'mon-refresh': tickMetrics(true); break;
      case 'mon-resolve': { const ev = db.events.find((x) => x.id === id); if (!ev) break; ev.status = 'Resolved'; ev.by = me.username; ev.resolved = nowStamp(); save('events'); audit('Monitoring', 'SystemEvents', ev.id, 'UPDATE', `Resolved ${ev.id}`); toast(`${ev.id} marked resolved.`); render(); break; }

      case 'cls-edit': { const c = db.classes.find((x) => x.id === id); if (c && can('classes.edit')) openModal({ title: 'Edit schedule & assignment', body: classForm(c), onOk: () => saveClass(c) }); break; }
      case 'cls-new': if (!can('classes.create')) break; openModal({ title: 'New class offering', body: newClassForm(), ok: 'Create offering', onOk: () => saveNewClass() }); break;
      case 'rev-open': if (!can('grades.review')) break; reviewModal(id, el.dataset.period); break;
      case 'rev-return': { if (!can('grades.review')) break; const note = ($('#revNote') || {}).value || ''; if (!note.trim()) { toast('Add remarks so the faculty knows what to fix.', 'error'); break; }
        setGradeStatus(id, el.dataset.period, 'Returned', me.username, note.trim()); closeModal(); toast('Grades returned to the faculty.'); render(); break; }
      case 'cls-roster': { const c = myClasses().find((x) => x.id === id); if (c) rosterModal(c); break; }

      case 'att-open': { ui.att.cls = id; ui.att.key = ''; ui.att.date = ''; go('attendance'); break; }
      case 'att-all': { const c = myClasses().find((x) => x.id === ui.att.cls); Object.values(ui.att.draft).forEach((r) => { r.status = 'Present'; r.timeIn = c.start; r.timeOut = ''; }); render(); break; }
      case 'att-save': { const c = myClasses().find((x) => x.id === ui.att.cls); const err = attValidate(c); $('#attError').textContent = err; if (err) break; attPersist(c, ui.att.date, 'Open'); toast('Draft saved.', 'info'); break; }
      case 'att-submit': { const c = myClasses().find((x) => x.id === ui.att.cls); const err = attValidate(c); $('#attError').textContent = err; if (err) break;
        attPersist(c, ui.att.date, 'Submitted'); const n = evaluateAlerts(c);
        audit('Attendance', 'AttendanceSessions', `${c.code}|${ui.att.date}`, 'APPROVE', `Attendance submitted for ${c.code} ${c.section}`);
        toast(n ? `Attendance submitted. ${n} alert(s) triggered.` : 'Attendance submitted.'); render(); break; }
      case 'att-reopen': { const c = myClasses().find((x) => x.id === ui.att.cls); ask('Reopen attendance?', 'Edits to submitted attendance are recorded in the audit trail.', 'Reopen', () => { attSession(c, ui.att.date).status = 'Open'; persist(K.fac, db.fac); audit('Attendance', 'AttendanceSessions', `${c.code}|${ui.att.date}`, 'UPDATE', 'Reopened submitted attendance for editing'); render(); }); break; }

      case 'gr-open': { ui.gr.cls = id; ui.gr.period = el.dataset.period || 'Final'; go('grades'); break; }
      case 'gr-add': openModal({ title: `Add ${ui.gr.period} assessment`, body: assessmentForm(), ok: 'Add assessment', onOk: () => {
        const name = $('#asName').value.trim(), max = Number($('#asMax').value), weight = Number($('#asWeight').value); let ok = true;
        ['asName', 'asMax', 'asWeight'].forEach((i) => setErr(i, ''));
        if (!name) { setErr('asName', 'Name is required.'); ok = false; }
        if (!(max > 0)) { setErr('asMax', 'Enter a maximum score above 0.'); ok = false; }
        if (!(weight > 0 && weight <= 100)) { setErr('asWeight', 'Weight must be 1\u2013100.'); ok = false; }
        if (!ok) return false;
        db.fac.assessments.push({ id: `A-${ui.gr.cls}-${Date.now()}`, classId: ui.gr.cls, period: ui.gr.period, name, type: $('#asType').value, max, weight, date: $('#asDate').value });
        persist(K.fac, db.fac); audit('Grades', 'Assessments', name, 'CREATE', `Added assessment ${name} (${weight}%)`); toast('Assessment added.'); render(); return true; } }); break;
      case 'gr-del': { const a = db.fac.assessments.find((x) => x.id === id); if (!a) break; ask('Remove assessment?', `Remove \u201C${a.name}\u201D and all scores recorded for it?`, 'Remove', () => { db.fac.assessments = db.fac.assessments.filter((x) => x.id !== id); delete db.fac.scores[id]; persist(K.fac, db.fac); audit('Grades', 'Assessments', a.name, 'DELETE', `Removed assessment ${a.name}`); render(); }, true); break; }
      case 'gr-submit': { const list = assessmentsFor(ui.gr.cls, ui.gr.period); const totalW = list.reduce((n, a) => n + a.weight, 0); let err = '';
        if (totalW !== 100) err = `Assessment weights total ${totalW}%. They must total 100% before submitting.`;
        else if (ROSTER.some((s) => list.some((a) => typeof (db.fac.scores[a.id] || {})[s.sn] !== 'number'))) err = 'Every student needs a score for every assessment before you can submit.';
        $('#grError').textContent = err; if (err) break;
        ask('Submit grades?', `Submit ${ui.gr.period} grades for review? You won\u2019t be able to edit scores unless you recall them.`, 'Submit', () => { db.fac.gradeStatus[`${ui.gr.cls}|${ui.gr.period}`] = 'Submitted'; if (db.fac.gradeNotes) delete db.fac.gradeNotes[`${ui.gr.cls}|${ui.gr.period}`]; persist(K.fac, db.fac); audit('Grades', 'StudentGrades', `${ui.gr.cls}|${ui.gr.period}`, 'APPROVE', `Submitted ${ui.gr.period} grades`); toast('Grades submitted for review.'); render(); }); break; }
      case 'gr-recall': if ((db.fac.gradeStatus[`${ui.gr.cls}|${ui.gr.period}`] || 'Draft') !== 'Submitted') break; ask('Recall to draft?', 'The submission is withdrawn so you can edit scores again.', 'Recall', () => { db.fac.gradeStatus[`${ui.gr.cls}|${ui.gr.period}`] = 'Draft'; persist(K.fac, db.fac); audit('Grades', 'StudentGrades', `${ui.gr.cls}|${ui.gr.period}`, 'UPDATE', `Recalled ${ui.gr.period} grades to draft`); render(); }); break;

      case 'gc-new': { if (!can('grades.encode')) break; const c = myClasses().find((x) => x.id === ui.gr.cls); if (!c) break;
        openModal({ title: 'Request grade correction', ok: 'Send request', body: correctionForm(c), onOk: () => {
          ['gcStudent', 'gcGrade', 'gcReason'].forEach((i) => setErr(i, ''));
          if (!$('#gcGrade').value) { setErr('gcGrade', 'Choose the corrected grade.'); return false; }
          const r = requestCorrection(c.id, $('#gcStudent').value, $('#gcGrade').value, $('#gcReason').value, me.username);
          if (!r.ok) { setErr(/reason/i.test(r.message) ? 'gcReason' : /grade/i.test(r.message) ? 'gcGrade' : 'gcStudent', r.message); return false; }
          toast(`Correction ${r.id} sent to the Department Head.`); render(); return true; } }); break; }
      case 'gc-endorse': { if (!can('grades.review')) break; const r = decideCorrection(id, 'endorse', me.username); toast(r.ok ? 'Correction endorsed. The Registrar can now apply it.' : r.message, r.ok ? '' : 'error'); render(); break; }
      case 'gc-reject': { if (!can('grades.review')) break;
        openModal({ title: 'Reject correction', ok: 'Reject', body: field('gcNote', 'Reason (shown to the faculty)', '<textarea id="gcNote" rows="3"></textarea>'), onOk: () => {
          const r = decideCorrection(id, 'reject', me.username, $('#gcNote').value);
          if (!r.ok) { setErr('gcNote', r.message); return false; }
          toast('Correction rejected.'); render(); return true; } }); break; }
      case 'pw-toggle': { const inp = $('#' + el.dataset.target); if (!inp) break; const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show'; el.setAttribute('aria-pressed', String(show)); el.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); break; }
      case 'rep-generate': generateReport(); break;
      case 'rep-csv': if (ui.rep.result) { downloadCsv(ui.rep.result.title, ui.rep.result.cols, ui.rep.result.rows); audit('Reports', 'GeneratedReports', ui.rep.id, 'EXPORT', `Exported ${ui.rep.result.title} to CSV`); } break;
      case 'rep-print': if (ui.rep.result) printReport(); break;
      default: break;
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.dataset.perm) {
      if (!can('roles.manage')) return;
      if (!rolesDraft) rolesDraft = clone(db.perms);
      const [r, p] = t.dataset.perm.split('|');
      rolesDraft[r] = t.checked ? [...new Set([...rolesDraft[r], p])] : rolesDraft[r].filter((x) => x !== p);
      const btn = $('[data-act="roles-save"]'); if (btn) btn.disabled = false;
      return;
    }
    if (t.dataset.attF) {
      const sn = t.closest('tr').dataset.sn, r = ui.att.draft[sn], c = myClasses().find((x) => x.id === ui.att.cls);
      r[t.dataset.attF] = t.value;
      if (t.dataset.attF === 'status') {
        if (['Absent', 'Excused'].includes(t.value)) { r.timeIn = ''; r.timeOut = ''; } else if (!r.timeIn) r.timeIn = c.start;
        const tr = t.closest('tr');
        $$('input[type="time"]', tr).forEach((i) => { i.disabled = ['Absent', 'Excused'].includes(t.value); i.value = i.dataset.attF === 'timeIn' ? r.timeIn : r.timeOut; });
      }
      t.closest('tr').querySelector('[data-late]').textContent = lateText(c, r);
      updateAttSummary();
      return;
    }
    if (t.dataset.score) {
      const [aid, sn] = t.dataset.score.split('|'); const a = db.fac.assessments.find((x) => x.id === aid);
      if (t.value === '') delete db.fac.scores[aid][sn];
      else { const v = Number(t.value); if (!(v >= 0 && v <= a.max)) { toast(`Score must be between 0 and ${a.max}.`, 'error'); t.value = typeof db.fac.scores[aid][sn] === 'number' ? db.fac.scores[aid][sn] : ''; return; } db.fac.scores[aid][sn] = v; }
      persist(K.fac, db.fac); updateGradeRow(sn);
      return;
    }
    switch (t.id) {
      case 'acctStatus': ui.acct.status = t.value; refreshAccounts(); break;
      case 'acctRole': ui.acct.role = t.value; refreshAccounts(); break;
      case 'auMod': ui.audit.mod = t.value; refreshAudit(); break;
      case 'auStatus': ui.audit.status = t.value; refreshAudit(); break;
      case 'attCls': ui.att.cls = t.value; ui.att.key = ''; ui.att.date = ''; render(); break;
      case 'attDate': ui.att.date = t.value; render(); break;
      case 'grCls': ui.gr.cls = t.value; render(); break;
      case 'grPeriod': ui.gr.period = t.value; render(); break;
      case 'stuStatus': ui.stu.status = t.value; refreshStudents(); break;
      case 'repId': ui.rep.id = t.value; ui.rep.result = null; render(); break;
      case 'repCls': ui.rep.cls = t.value; ui.rep.result = null; render(); break;
      case 'repDate': ui.rep.date = t.value; ui.rep.result = null; break;
      case 'repFrom': ui.rep.from = t.value; break;
      case 'repTo': ui.rep.to = t.value; break;
      default: break;
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.id === 'acctQ') { ui.acct.q = t.value; refreshAccounts(); }
    else if (t.id === 'auQ') { ui.audit.q = t.value; refreshAudit(); }
    else if (t.id === 'stuQ') { ui.stu.q = t.value; refreshStudents(); }
    else if (t.id === 'spNew') { const l = pwScore(t.value); $('#spMeter').dataset.level = l; $('#spMeterLabel').textContent = t.value ? ['', 'Weak', 'Fair', 'Good', 'Strong'][l] : ''; }
  }

  function onSubmit(e) {
    e.preventDefault();
    const id = e.target.id;
    if (id === 'bkForm' && can('backup.manage')) {
      const ret = Number($('#bkRet').value); setErr('bkRet', ''); setErr('bkLoc', '');
      if (!(ret >= 1)) { setErr('bkRet', 'Enter a retention of at least 1 day.'); return; }
      if (!$('#bkLoc').value.trim()) { setErr('bkLoc', 'A storage location is required.'); return; }
      db.backups.config = { frequency: $('#bkFreq').value, time: $('#bkTime').value || '02:00', type: $('#bkType').value, location: $('#bkLoc').value.trim(), retention: ret, enabled: $('#bkOn').checked };
      save('backups'); audit('Backup', 'BackupConfigurations', 'CFG', 'UPDATE', 'Updated backup schedule'); toast('Backup schedule saved.'); render();
    } else if (id === 'polForm' && can('config')) {
      const v = { maxFailed: Number($('#plFail').value), lockMin: Number($('#plLock').value), minPw: Number($('#plMin').value), timeoutMin: Number($('#plIdle').value) };
      ['plFail', 'plLock', 'plMin', 'plIdle'].forEach((i) => setErr(i, ''));
      let ok = true;
      if (!(v.maxFailed >= 3 && v.maxFailed <= 10)) { setErr('plFail', 'Use 3\u201310.'); ok = false; }
      if (!(v.lockMin >= 1)) { setErr('plLock', 'At least 1 minute.'); ok = false; }
      if (!(v.minPw >= 8)) { setErr('plMin', 'Minimum is 8.'); ok = false; }
      if (!(v.timeoutMin >= 5)) { setErr('plIdle', 'At least 5 minutes.'); ok = false; }
      if (!ok) return;
      db.policy = v; save('policy'); audit('System', 'SystemConfiguration', 'SECURITY', 'UPDATE', 'Updated security policy', 'Success', '', JSON.stringify(v)); toast('Security policy saved.');
    } else if (id === 'alForm' && can('config')) {
      const v = { maxAbsences: Number($('#alAbs').value), tardiness: Number($('#alLate').value), enabled: $('#alOn').checked };
      ['alAbs', 'alLate'].forEach((i) => setErr(i, ''));
      if (!(v.maxAbsences >= 1)) { setErr('alAbs', 'Enter 1 or more.'); return; }
      if (!(v.tardiness >= 1)) { setErr('alLate', 'Enter 1 or more.'); return; }
      db.alertCfg = v; save('alertCfg'); audit('System', 'AttendanceAlertSettings', 'ALERT', 'UPDATE', 'Updated attendance alert rules', 'Success', '', JSON.stringify(v)); toast('Alert rules saved.');
    } else if (id === 'pwForm') {
      ['spCur', 'spNew', 'spConf'].forEach((i) => setErr(i, ''));
      const cur = $('#spCur').value, nw = $('#spNew').value, conf = $('#spConf').value; let ok = true;
      if (hash(cur) !== (db.pw[me.username] || me.pwHash)) { setErr('spCur', 'Current password is incorrect.'); ok = false; }
      const pwIssue = window.SIMSAuth ? SIMSAuth.passwordProblem(nw) : (nw.length < db.policy.minPw ? `Use at least ${db.policy.minPw} characters.` : '');
      if (pwIssue) { setErr('spNew', pwIssue); ok = false; }
      else if (nw === cur) { setErr('spNew', 'Choose a password different from the current one.'); ok = false; }
      if (conf !== nw) { setErr('spConf', 'Passwords do not match.'); ok = false; }
      if (!ok) return;
      db.pw[me.username] = hash(nw); save('pw');
      const rec = db.users.find((u) => u.username === me.username); if (rec) { rec.mustChange = false; save('users'); }
      audit('Authentication', 'Users', me.username, 'UPDATE', 'Changed own password'); e.target.reset(); $('#spMeter').dataset.level = 0; $('#spMeterLabel').textContent = ''; toast('Password updated.');
    }
  }

  /* =====================================================
     OPEN / CLOSE
  ===================================================== */
  function markActive() { lastActive = Date.now(); }
  function open(account) {
    me = account;
    page = 'dashboard'; rolesDraft = null; metrics = null;
    ui.att.key = ''; ui.att.cls = ''; ui.att.date = ''; ui.gr.cls = ''; ui.rep.id = ''; ui.rep.result = null;
    buildShell();
    root.classList.remove('hidden');
    audit('Authentication', 'Users', me.username, 'LOGIN', 'Successful login');
    go('dashboard');
    ['click', 'keydown', 'mousemove'].forEach((ev) => document.addEventListener(ev, markActive, { passive: true }));
    markActive();
    idleTimer = setInterval(() => {
      if (Date.now() - lastActive > db.policy.timeoutMin * 60000) { close(); window.alert('You were signed out after a period of inactivity.'); }
    }, 15000);
  }

  function close() {
    if (!me) return;
    audit('Authentication', 'Users', me.username, 'LOGOUT', 'Signed out');
    clearInterval(monTimer); clearInterval(idleTimer);
    ['click', 'keydown', 'mousemove'].forEach((ev) => document.removeEventListener(ev, markActive));
    if (root) { root.classList.add('hidden'); root.innerHTML = ''; }
    me = null;
    const loginForm = $('#loginForm'); if (loginForm) loginForm.reset();
    const loginView = $('#loginView'); if (loginView) loginView.classList.remove('hidden');
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root && $('#stModal') && !$('#stModal').classList.contains('hidden')) closeModal(); });

  // Read/write hooks used by registrar.js so the portals share one set of records
  window.SIMSStaff = {
    isStaffUser, authenticate, open, close, setPassword,
    classes: () => db.classes,
    userName,
    gradeSheets: gradeSheetsList,
    setGradeStatus,
    officialGrade,
    corrections: () => corrections().map((x) => ({ ...x })),
    decideCorrection,
    attendanceRows: () => db.classes.flatMap((c) => ROSTER.map((st) => ({ code: c.code, title: c.title, section: c.section, faculty: userName(c.faculty), sn: st.sn, name: st.name, ...attendanceFor(c.id, st.sn) }))),
    alertConfig: () => ({ ...db.alertCfg }),
    classRoster: () => db.classes.map((c) => ({ id: c.id, code: c.code, title: c.title, section: c.section, faculty: userName(c.faculty), status: db.fac.gradeStatus[`${c.id}|${FINAL}`] || 'Draft', students: ROSTER.map((x) => ({ ...x })) })),
    // Report history (design reference 6.4) for reports generated in other portals
    logReport: (name, by, count) => { db.reports.unshift({ ts: nowStamp(), name, by, count }); if (db.reports.length > 60) db.reports.length = 60; save('reports'); },
    attendanceSummary,
    attendanceAlerts: () => db.fac.alerts.map((a) => ({ date: a.date, student: a.student, type: a.type, message: a.message })),
    record,
    auditFor: (username, n) => db.audit.filter((a) => a.user === username).slice(0, n || 50).map((a) => ({ ts: a.ts, mod: a.mod, act: a.act, desc: a.desc }))
  };
})();