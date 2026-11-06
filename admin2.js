/* Remaining Registrar pages: Student Profiles, Register Student, Attendance, Academic Records,
   Reports, Users & Access, Audit & System, Account Settings. Plugs into admin.js (SIMSAdminX). */
(function () {
  const X = window.SIMSAdminX, { rd, wr, esc, badge, log, today, NAV, pages } = X;
  const $ = (s) => document.querySelector(s), val = (id) => ($('#' + id) || {}).value || '';
  const RK = 'bits-sims-registry';
  const S = (n, name, prog, yr, st, dept) => ({ no: n, name, program: prog, year: yr, status: st, dept: dept || 'IT', admission: 'Freshman', email: '', mobile: '', city: '' });
  const seed = () => ({
    students: [S('2024-12345', 'Garcia, Dawson James', 'BSIT', '3rd', 'Active'), S('2026-0001', 'Dela Cruz, Juan', 'BSIT', '3rd', 'Active'), S('2026-0002', 'Santos, Maria', 'BSIT', '2nd', 'Active'), S('2026-0003', 'Reyes, Pedro', 'BSCS', '4th', 'On Leave'), S('2026-0004', 'Garcia, Ana', 'BSCS', '1st', 'Active')],
    classes: [{ code: 'IT301', title: 'Systems Administration', section: '3B', faculty: 'Reyes, M.', day: 'Mon', time: '8:00-11:00', room: 'ITLAB-01', cap: 40, n: 38 }, { code: 'IT302', title: 'Network Management', section: '3B', faculty: 'Santos, L.', day: 'Tue', time: '1:00-4:00', room: 'ITLAB-02', cap: 40, n: 40 }, { code: 'GE105', title: 'Readings in History', section: '3B', faculty: 'Cruz, A.', day: 'Thu', time: '9:00-12:00', room: 'RM-204', cap: 45, n: 35 }],
    setup: {
      Departments: [['IT', 'Information Technology', 'Reyes, M.', 'Active'], ['BA', 'Business Administration', 'Cruz, A.', 'Active'], ['ED', 'Education', 'Santos, L.', 'Inactive']],
      Programs: [['BSIT', 'BS Information Technology', 'IT', 'Active'], ['BSCS', 'BS Computer Science', 'IT', 'Active'], ['BSIS', 'BS Information Systems', 'IT', 'Inactive']],
      Courses: [['IT301', 'Systems Administration', '3.0 units', 'Active'], ['IT302', 'Network Management', '3.0 units', 'Active'], ['GE105', 'Readings in History', '3.0 units', 'Active']],
      'Academic Terms': [['2026-2027', '1st Semester', 'Aug 17 - Dec 18', 'Ongoing (current)'], ['2026-2027', '2nd Semester', 'Jan 11 - May 14', 'Upcoming']],
      Rooms: [['ITLAB-01', 'IT Laboratory 1', '40', 'Available'], ['ITLAB-02', 'IT Laboratory 2', '40', 'Available'], ['RM-204', 'Room 204', '45', 'Under Maintenance']]
    },
    users: [['registrar01', 'Registrar', 'Institution', 'Active'], ['dh.it', 'Department Head', 'IT Dept.', 'Active'], ['faculty.reyes', 'Faculty', 'Assigned classes', 'Locked'], ['ict.admin', 'ICT Services', 'System', 'Active']],
    perms: ['STUDENT_VIEW', 'STUDENT_CREATE', 'STUDENT_EDIT', 'STUDENT_DEACTIVATE', 'STUDENT_APPROVE', 'ENROLLMENT_VIEW', 'ENROLLMENT_CREATE', 'ENROLLMENT_EDIT', 'ENROLLMENT_APPROVE', 'ATTENDANCE_VIEW', 'GRADE_VIEW', 'GRADE_APPROVE', 'GRADE_POST', 'REPORT_GENERATE', 'REPORT_EXPORT', 'USER_MANAGE', 'ROLE_MANAGE', 'AUDIT_VIEW', 'BACKUP_MANAGE', 'SYSTEM_CONFIGURE'],
    granted: ['STUDENT_VIEW', 'STUDENT_CREATE', 'STUDENT_EDIT', 'STUDENT_APPROVE', 'ENROLLMENT_VIEW', 'ENROLLMENT_CREATE', 'ENROLLMENT_EDIT', 'ENROLLMENT_APPROVE', 'ATTENDANCE_VIEW', 'GRADE_VIEW', 'GRADE_APPROVE', 'GRADE_POST', 'REPORT_GENERATE', 'REPORT_EXPORT'],
    me: { email: '', mobile: '', office: '', notif: { queue: true, grades: true, login: false } }
  });
  const db = () => { const d = rd(RK, null) || seed(); return d; };
  const save = (d) => wr(RK, d);
  const table = (h, rows) => `<table class="ad-table"><tr>${h.map((x) => `<th>${esc(x)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td>${String(c).startsWith('<') ? c : esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table>`;
  const tabs = (list, cur, key) => `<div class="ad-tabs">${list.map((t) => `<button class="ad-btn ${t === cur ? '' : 'alt'}" data-x="${key}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  let fl = { q: '', st: '' }, tab = 'Overview', viewNo = null, rtab = 'Student Records', stab = 'Departments', utab = 'Users', atab = 'Audit Logs', mtab = 'Applications', cls = null;
  const stCls = (s) => (s === 'Active' ? 'ok' : s === 'On Leave' || s === 'Archived' ? 'warn' : 'info');

  /* ---- Student Profiles + Register ---- */
  pages.students = () => {
    const d = db(), q = fl.q.toLowerCase();
    const rows = d.students.filter((s) => (!q || (s.no + s.name).toLowerCase().includes(q)) && (!fl.st || s.status === fl.st)).map((s) => [s.no, s.name, s.program, s.year, badge(stCls(s.status), s.status), `<a data-x="view" data-v="${s.no}">View Profile</a><a data-x="${s.status === 'Archived' ? 'restore' : 'archive'}" data-v="${s.no}">${s.status === 'Archived' ? 'Restore' : 'Archive'}</a>`]);
    return `<h1>Student Profiles</h1><p class="ad-note">Search, review, and manage registered students.</p>
      <p><input id="fq" placeholder="Student number or name" value="${esc(fl.q)}"> <select id="fs"><option value="">All statuses</option>${['Active', 'On Leave', 'Archived'].map((x) => `<option ${fl.st === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <button class="ad-btn" data-x="filter">Filter</button> <button class="ad-btn" data-x="newstu">Register Student</button></p>
      ${table(['Student No.', 'Name', 'Program', 'Year', 'Status', 'Actions'], rows)}<p class="ad-note">Showing ${rows.length} of ${d.students.length}. Records are deactivated or archived, never deleted.</p>`;
  };
  X.parent.register = X.parent.profile = 'students';
  const F = [['Admission', [['dept', 'Department', ['IT', 'BA', 'ED']], ['program', 'Program', ['BSIT', 'BSCS', 'BSIS']], ['admission', 'Admission Type', ['Freshman', 'Transferee', 'Returnee']], ['year', 'Year Level', ['1st', '2nd', '3rd', '4th']]]],
    ['Personal Information', [['first', 'First Name *'], ['middle', 'Middle Name'], ['last', 'Last Name *'], ['dob', 'Date of Birth']]], ['Contact Information', [['email', 'Personal Email'], ['mobile', 'Mobile Number'], ['city', 'City']]],
    ['Parent / Guardian', [['gname', 'Guardian Name'], ['gnum', 'Contact Number']]], ['Emergency Contact', [['ename', 'Contact Name'], ['enum', 'Contact Number']]]];
  pages.register = () => `<h1>Register Student</h1>${F.map(([t, fs]) => `<div class="ad-panel"><h3>${t}</h3><div class="ad-grid">${fs.map(([id, l, o]) => `<label>${l}${o ? `<select id="f_${id}">${o.map((x) => `<option>${x}</option>`).join('')}</select>` : `<input id="f_${id}">`}</label>`).join('')}</div></div>`).join('')}
    <p><button class="ad-btn" data-x="savestu">Save Student</button> <button class="ad-btn alt" data-go="students">Cancel</button></p><p class="ad-note">The student number is generated on save.</p>`;
  pages.profile = () => {
    const d = db(), s = d.students.find((x) => x.no === viewNo) || d.students[0], real = s.no === '2024-12345';
    const T = ['Overview', 'General Information', 'Contact Information', 'Grades', 'Documents'];
    let body;
    if (tab === 'Grades') body = real ? table(['Course', 'Midterm', 'Final', 'Status'], SIMSData.get().subjects.filter((x) => x.termId === '2627-1').map((x) => [x.code, x.grades.midterm == null ? '—' : x.grades.midterm, x.finalGrade == null ? '—' : x.finalGrade, (x.gradeStatus && x.gradeStatus.midterm) || 'posted'])) : '<p>No grades on file.</p>';
    else if (tab === 'Documents') body = real ? table(['Document', 'Status'], rd(X.K.docs, { requirements: [] }).requirements.map((r) => [r.name, r.status])) : '<p>No documents on file.</p>';
    else body = table(['Field', 'Value'], (tab === 'Contact Information' ? [['Email', s.email || '—'], ['Mobile', s.mobile || '—'], ['City', s.city || '—']] : tab === 'General Information' ? [['Admission type', s.admission], ['Department', s.dept]] : [['Student number', s.no], ['Name', s.name], ['Program', s.program], ['Year', s.year], ['Status', s.status]]));
    return `<h1>${esc(s.name)}</h1><p>${esc(s.no)} · ${esc(s.program)} · ${esc(s.year)} Year · ${esc(s.status)}</p>${tabs(T, tab, 'tab')}${body}<p><button class="ad-btn alt" data-go="students">Back</button></p>`;
  };

  /* ---- Attendance (marks for the portal student reach their Attendance page) ---- */
  pages.attendance = () => {
    const subs = SIMSData.get().subjects.filter((x) => x.termId === '2627-1' && x.attendance), cur = subs.find((x) => x.id === cls) || subs[0];
    const d = db();
    return `<h1>Attendance</h1><p><select id="acls">${subs.map((x) => `<option value="${x.id}" ${x === cur ? 'selected' : ''}>${x.code} · ${x.section}</option>`).join('')}</select> <button class="ad-btn alt" data-x="pickcls">Load roster</button></p>
      ${table(['Student No.', 'Name', 'Status'], d.students.filter((s) => s.status === 'Active' && s.program === 'BSIT').map((s) => [s.no, s.name, `<select class="att" data-no="${s.no}">${['Present', 'Late', 'Absent', 'Excused'].map((m) => `<option>${m}</option>`).join('')}</select>`]))}
      <p><button class="ad-btn" data-x="submitatt" data-v="${cur ? cur.id : ''}">Submit Attendance</button></p><p class="ad-note">Submitting records one class meeting. Late/absent/excused marks for Dawson Garcia update the student portal.</p>`;
  };

  /* ---- Academic Records ---- */
  pages.records = () => {
    const d = db(), R = ['Student Records', 'Class & Scheduling', 'Grade Management', 'Academic Setup'], t = SIMSData.currentTerm(), sm = SIMSData.termSummary(t.id), f2 = (n) => (n == null ? '—' : n.toFixed(2));
    let body;
    if (rtab === 'Student Records') body = `<div class="ad-row2" style="grid-template-columns:1fr 160px 160px"><div class="ad-card" style="display:flex;gap:1rem;align-items:center"><span class="ad-ra">JD</span><div><b style="font-size:1.05rem;margin:0">Garcia, Dawson James</b><small style="text-transform:none">2024-12345 · BSIT · 3rd Year</small></div></div><div class="ad-card"><small>Term GPA</small><b>${f2(sm.gwa)}</b></div><div class="ad-card"><small>Cumulative GPA</small><b>${f2(SIMSData.cumulativeGwa())}</b></div></div>
      ${table(['Course', 'Units', 'Midterm', 'Final', 'Remarks', 'Status'], sm.subjects.map((x) => [x.code + ' · ' + x.title, x.units.toFixed(1), f2(x.grades.midterm), f2(x.finalGrade), x.status === 'inprogress' ? 'In progress' : x.status, (SIMSData.raw.subject(x.id).gradeStatus || {}).midterm || 'posted']))}<p class="ad-note">Posted grades change only through the controlled correction process.</p>`;
    else if (rtab === 'Grade Management') body = pages.grades().replace(/<h1>.*?<\/h1>/, '');
    else if (rtab === 'Academic Setup') body = tabs(Object.keys(d.setup), stab, 'stab') + table(['Code', 'Name', 'Detail', 'Status'], d.setup[stab]);
    else body = `${table(['Course', 'Section', 'Faculty', 'Schedule', 'Room', 'Enrolled'], d.classes.map((c) => [c.code + ' · ' + c.title, c.section, c.faculty, c.day + ' ' + c.time, c.room, c.n + ' / ' + c.cap]))}
      <h3>Create Class Offering</h3><div class="ad-panel"><div class="ad-grid">${[['code', 'Course code'], ['title', 'Title'], ['section', 'Section'], ['faculty', 'Faculty'], ['day', 'Day'], ['time', 'Time (8:00-11:00)'], ['room', 'Room'], ['cap', 'Capacity']].map(([i, l]) => `<label>${l}<input id="c_${i}"></label>`).join('')}</div>
      <p style="background:none;padding:0"><button class="ad-btn" data-x="savecls">Save Offering</button></p></div><p class="ad-note">Rooms cannot have overlapping active classes, and faculty cannot hold conflicting assignments.</p>`;
    return `<h1>Academic Records</h1><p class="ad-sub">Review and approve official grades and academic history.</p>${tabs(R, rtab, 'rtab')}${body}`;
  };
  X.parent.grades = 'records';

  /* ---- Reports (CSV export, logged) ---- */
  const REP = { master: ['Student Master List', () => [['Student No', 'Name', 'Program', 'Year', 'Status']].concat(db().students.map((s) => [s.no, s.name, s.program, s.year, s.status]))],
    enroll: ['Enrollment Summary', () => [['Program', 'Students']].concat(Object.entries(db().students.reduce((a, s) => (a[s.program] = (a[s.program] || 0) + 1, a), {})))],
    classlist: ['Class List', () => [['Course', 'Section', 'Faculty', 'Enrolled']].concat(db().classes.map((c) => [c.code, c.section, c.faculty, c.n]))],
    att: ['Attendance Summary', () => [['Course', 'Held', 'Absent', 'Late']].concat(SIMSData.get().subjects.filter((s) => s.attendance && s.termId === '2627-1').map((s) => [s.code, s.attendance.held, s.attendance.absent, s.attendance.late]))] };
  pages.reports = () => `<h1>Reports &amp; Analytics Generation</h1><p class="ad-note">Generate and export reports within your access scope.</p><div class="ad-cards">${Object.entries(REP).map(([k, r]) => `<button class="ad-card" data-x="rep" data-v="${k}"><small>Export CSV</small><b style="font-size:1.1rem">${r[0]}</b></button>`).join('')}</div>`;

  /* ---- Users & Access ---- */
  pages.users = () => { const d = db(), body = utab === 'Users'
    ? table(['Username', 'Role', 'Scope', 'Status', 'Actions'], d.users.map((u) => [u[0], u[1], u[2], badge(u[3] === 'Active' ? 'ok' : 'risk', u[3]), `<a data-x="${u[3] === 'Locked' ? 'unlock' : 'lock'}" data-v="${u[0]}">${u[3] === 'Locked' ? 'Unlock' : 'Lock'}</a>`])) + '<p class="ad-note">Deactivating an account never deletes the student or staff record. Permissions are enforced on the server.</p>'
    : `<div class="ad-panel"><h3>Registrar</h3><div class="ad-grid">${d.perms.map((p) => `<label style="flex-direction:row;font-size:.7rem"><input type="checkbox" class="perm" value="${p}" ${d.granted.includes(p) ? 'checked' : ''}> ${p}</label>`).join('')}</div></div><p><button class="ad-btn" data-x="saveperm">Save Permissions</button></p><p class="ad-note">Permissions are enforced on the server. Hiding a button is not access control.</p>`;
    return `<h1>Users &amp; Access</h1><p class="ad-sub">Manage accounts, roles, and permissions.</p>${tabs(['Users', 'Roles & Permissions'], utab, 'utab')}${body}`; };

  /* ---- Audit & System (5 tabs) ---- */
  const AUD = { Backup: [['Started', 'Type', 'Size', 'Status'], [['Nov 5, 2:00 AM', 'Full', '1.2 GB', badge('ok', 'Completed')], ['Nov 4, 2:00 AM', 'Full', '1.2 GB', badge('ok', 'Completed')], ['Nov 3, 2:00 AM', 'Full', '—', badge('risk', 'Failed')]]],
    Retention: [['Record Type', 'Duration', 'Start Event', 'Disposal Action'], [['Academic Record', 'Permanent', 'Record creation', 'Permanent retention'], ['Student Document', '5 years', 'Graduation', 'Archive'], ['Enrollment', '10 years', 'Withdrawal', 'Archive']]],
    'System Events': [['Time', 'Type', 'Module', 'Severity', 'Status'], [['9:05 AM', 'Performance Alert', 'Reports', badge('warn', 'Warning'), 'Open'], ['Yesterday', 'Application Error', 'Enrollment', badge('info', 'Error'), 'Resolved']]],
    Notifications: [['Time', 'Type', 'Recipient', 'Channel', 'Status'], [['9:12 AM', 'Enrollment', '2026-0007', 'Portal', badge('ok', 'Delivered')], ['9:05 AM', 'Attendance', 'Guardian of 2026-0003', 'Email', badge('risk', 'Failed')]]] };
  pages.audit = () => { const l = rd(X.K.aud, []);
    const body = atab === 'Audit Logs' ? `<div class="ad-stats">${[['Avg. response time', '240 ms'], ['Concurrent sessions', '86'], ['Last backup', '2:00 AM'], ['Open system events', '1']].map((r) => `<div class="ad-card"><small>${r[0]}</small><b>${r[1]}</b></div>`).join('')}</div>${table(['Time', 'User', 'Action'], l.map((x) => [x.t, x.u, x.a]))}<p class="ad-note">Audit entries are append-only and never store passwords or reset tokens.</p>` : table(AUD[atab][0], AUD[atab][1]);
    return `<h1>Audit &amp; System</h1>${tabs(['Audit Logs', 'Backup', 'Retention', 'System Events', 'Notifications'], atab, 'atab')}${body}`; };

  /* ---- Account Settings ---- */
  pages.settings = () => { const m = db().me; return `<h1>Account Settings</h1><div class="ad-panel"><h3>Contact details</h3><div class="ad-grid"><label>Work email<input id="s_email" value="${esc(m.email)}"></label><label>Mobile<input id="s_mobile" value="${esc(m.mobile)}"></label><label>Office<input id="s_office" value="${esc(m.office)}"></label></div><p><button class="ad-btn" data-x="savecontact">Save changes</button></p></div>
    <div class="ad-panel"><h3>Change password</h3><div class="ad-grid"><label>Current<input id="p_cur" type="password"></label><label>New<input id="p_new" type="password"></label><label>Confirm<input id="p_con" type="password"></label></div><p><button class="ad-btn" data-x="savepw">Update password</button></p><p class="ad-note">Use at least 8 characters with letters and numbers.</p></div>
    <div class="ad-panel"><h3>Alerts</h3>${[['queue', 'Queue alerts'], ['grades', 'Grade submissions'], ['login', 'Login alerts']].map(([k, l]) => `<label><input type="checkbox" class="nt" value="${k}" ${m.notif[k] ? 'checked' : ''}> ${l}</label> `).join('')}<p><button class="ad-btn" data-x="savenotif">Save alerts</button></p></div>`; };

  /* ---- Actions ---- */
  X.act = (t) => {
    const a = t.dataset.x, v = t.dataset.v, d = db();
    if (!a) return false;
    if (a === 'filter') { fl = { q: val('fq'), st: val('fs') }; }
    else if (a === 'newstu') X.go('register');
    else if (a === 'view') { viewNo = v; tab = 'Overview'; X.go('profile'); }
    else if (a === 'tab') tab = v;
    else if (a === 'archive' || a === 'restore') { const s = d.students.find((x) => x.no === v); s.status = a === 'archive' ? 'Archived' : 'Active'; save(d); log(`Student ${v} ${s.status}`); }
    else if (a === 'savestu') {
      if (!val('f_first').trim() || !val('f_last').trim()) return alert('First and last name are required.'), true;
      const no = '2026-' + String(d.students.filter((s) => s.no.startsWith('2026-')).length + 1).padStart(4, '0');
      d.students.push({ no, name: `${val('f_last')}, ${val('f_first')}`, program: val('f_program'), year: val('f_year'), status: 'Active', dept: val('f_dept'), admission: val('f_admission'), email: val('f_email'), mobile: val('f_mobile'), city: val('f_city') });
      save(d); log(`Registered student ${no}`); fl = { q: '', st: '' }; X.go('students'); alert('Student registered: ' + no); return true;
    }
    else if (a === 'pickcls') cls = val('acls');
    else if (a === 'submitatt') {
      const mark = ((document.querySelector('.att[data-no="2024-12345"]') || {}).value || 'Present').toLowerCase();
      if (v && mark !== 'present') SIMSData.addAttendance(v, mark); else if (v) SIMSData.update((x) => { x.subjects.find((s) => s.id === v).attendance.held += 1; });
      log(`Attendance submitted for ${v}`); alert('Attendance submitted.');
    }
    else if (a === 'rtab') rtab = v;
    else if (a === 'stab') stab = v;
    else if (a === 'utab') utab = v;
    else if (a === 'atab') atab = v;
    else if (a === 'mtab') mtab = v;
    else if (a === 'savecls') {
      const c = {}; ['code', 'title', 'section', 'faculty', 'day', 'time', 'room', 'cap'].forEach((k) => { c[k] = val('c_' + k).trim(); });
      if (Object.values(c).some((x) => !x)) return alert('Fill in every field.'), true;
      const clash = d.classes.find((o) => o.day === c.day && o.time === c.time && (o.room === c.room || o.faculty === c.faculty));
      if (clash) return alert(`Conflict with ${clash.code}: the ${clash.room === c.room ? 'room' : 'faculty'} is already booked at that time.`), true;
      d.classes.push({ ...c, cap: +c.cap || 40, n: 0 }); save(d); log(`Class offering ${c.code} created`);
    }
    else if (a === 'rep') {
      const r = REP[v], csv = r[1]().map((row) => row.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
      const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); l.download = v + '.csv'; l.click(); log(`Exported ${r[0]}`); return true;
    }
    else if (a === 'lock' || a === 'unlock') { d.users.find((u) => u[0] === v)[3] = a === 'lock' ? 'Locked' : 'Active'; save(d); log(`Account ${v} ${a}ed`); }
    else if (a === 'saveperm') { d.granted = [...document.querySelectorAll('.perm:checked')].map((c) => c.value); save(d); log('Registrar permissions updated'); }
    else if (a === 'savecontact') { Object.assign(d.me, { email: val('s_email'), mobile: val('s_mobile'), office: val('s_office') }); save(d); alert('Saved.'); }
    else if (a === 'savepw') {
      const n = val('p_new'); if (!val('p_cur')) return alert('Enter your current password.'), true;
      if (n.length < 8 || !/[a-z]/i.test(n) || !/\d/.test(n)) return alert('Use at least 8 characters with letters and numbers.'), true;
      if (n !== val('p_con')) return alert('Passwords do not match.'), true; log('Password changed'); alert('Password updated.');
    }
    else if (a === 'savenotif') { document.querySelectorAll('.nt').forEach((c) => { d.me.notif[c.value] = c.checked; }); save(d); alert('Saved.'); }
    else return false;
    return true;
  };

  /* ---- Admissions & Enrollment tabs ---- */
  const admApps = pages.admissions;
  pages.admissions = () => `<h1>Admissions &amp; Enrollment</h1>${tabs(['Applications', 'Term Enrollment', 'Class Enrollment'], mtab, 'mtab')}` + (mtab === 'Applications' ? admApps().replace(/<h1>.*?<\/h1>/, '')
    : mtab === 'Term Enrollment' ? table(['Ref. No.', 'Student', 'Term', 'Program', 'Year', 'Units', 'Status'], [['ENR-0007', 'Dela Cruz, Juan', '1st Sem 2026-27', 'BSIT', '3rd', '21.0', badge('warn', 'Pending')], ['ENR-0012', 'Santos, Maria', '1st Sem 2026-27', 'BSIT', '2nd', '18.0', badge('info', 'Verified')], ['ENR-0019', 'Garcia, Ana', '1st Sem 2026-27', 'BSCS', '1st', '24.0', badge('ok', 'Enrolled')]])
    : table(['Student', 'Class Offering', 'Section', 'Date Added', 'Status'], [['Dela Cruz, Juan', 'IT301', '3B', 'Aug 12', badge('ok', 'Enrolled')], ['Santos, Maria', 'IT302', '3B', 'Aug 13', badge('warn', 'Full, override needed')]]) + '<p class="ad-note">Duplicate enrollment in the same class is blocked. Enrolling past capacity needs a recorded override.</p>');
  X.parent.corrections = 'students';
  pages.students = ((old) => () => old().replace('<button class="ad-btn" data-x="newstu">', '<button class="ad-btn alt" data-go="corrections">Review Profile Correction</button> <button class="ad-btn" data-x="newstu">').replace('<p><input', '<p class="ad-filters"><input'))(pages.students);

  /* ---- Navigation in the mockup order + Home like the mockup ---- */
  NAV.length = 0;
  [['home', 'Home'], ['students', 'Student Profiles'], ['admissions', 'Admissions & Enrollment'], ['attendance', 'Attendance'], ['records', 'Academic Records'], ['reports', 'Reports & Analytics Generation'], ['documents', 'Document Management'], ['users', 'Users & Access'], ['audit', 'Audit & System'], ['settings', 'Account Settings']].forEach((n) => NAV.push(n));
  const oldest = (dates) => { const t = dates.filter(Boolean).map((x) => new Date(x).getTime()).filter((n) => n); if (!t.length) return '—'; const n = Math.max(0, Math.round((Date.now() - Math.min(...t)) / 864e5)); return n + (n === 1 ? ' day' : ' days'); };
  pages.home = () => {
    const d = db(), docsD = rd(X.K.docs, { requirements: [], requests: {} }), apps = rd(X.K.adm, { applications: [] }).applications.filter((a) => a.status === 'pending' || a.status === 'review'), cor = rd(X.K.cor, []).filter((c) => c.status === 'pending'), dd = docsD.requirements.filter((r) => r.status === 'review');
    const gq = SIMSData.get().subjects.filter((x) => Object.values(x.gradeStatus || {}).includes('submitted')), act = rd(X.K.aud, []).filter((x) => x.a !== 'Signed in').slice(0, 4);
    const att = SIMSData.get().subjects.map((x) => SIMSData.attendanceRate(x.attendance)).filter((n) => n != null), rate = att.length ? Math.round(att.reduce((a, b) => a + b, 0) / att.length) : 0;
    const now = new Date(), first = new Date(now.getFullYear(), now.getMonth(), 1).getDay(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cal = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => `<b>${x}</b>`).join('') + '<span></span>'.repeat(first) + Array.from({ length: days }, (_, i) => `<span class="${i + 1 === now.getDate() ? 'td' : ''}">${i + 1}</span>`).join('');
    const q = [['Enrollments awaiting verification', apps.length, oldest(apps.map((a) => a.submitted)), 'admissions'], ['Profile correction requests', cor.length, oldest(cor.map((c) => c.date)), 'corrections'], ['Documents awaiting verification', dd.length + Object.keys(docsD.requests).length, oldest(dd.map((r) => r.updated).concat(Object.values(docsD.requests))), 'documents'], ['Grade submissions awaiting approval', gq.length, oldest(gq.map((x) => x.updated)), 'records']];
    return `<div class="ad-stats" style="grid-template-columns:repeat(5,1fr)">${[['Total students', d.students.length], ['Active students', d.students.filter((s) => s.status === 'Active').length], ['Departments', d.setup.Departments.length], ['Programs', d.setup.Programs.length], ['Current enrollment', d.students.filter((s) => s.status === 'Active').length]].map((r) => `<div class="ad-card"><small>${r[0]}</small><b>${r[1]}</b></div>`).join('')}</div>
      <div class="ad-card" style="margin-bottom:1rem"><small>Attendance today</small><b>${rate}%</b></div>
      <div class="ad-row"><div class="ad-card ad-id"><span class="ad-ra big">RA</span><span>Registrar Admin<br>Registrar’s Office</span></div>
      <div class="ad-card"><table class="ad-queue" style="width:100%;font-size:.8rem;border-collapse:collapse"><tr style="color:#17305e;border-bottom:2px solid var(--blue)"><th style="text-align:left;padding:.4rem">Pending Queues</th><th>Pending</th><th>Oldest</th></tr>${q.map((r) => `<tr data-go="${r[3]}"><td style="padding:.55rem .4rem;color:var(--blue)">${r[0]}</td><td style="color:var(--blue)">${r[1]}</td><td style="color:var(--blue)">${r[2]}</td></tr>`).join('')}</table></div>
      <div class="ad-card ad-cal"><h4>${now.toLocaleString('en', { month: 'long', year: 'numeric' })}</h4><div>${cal}</div></div></div>
      <div class="ad-row2"><div class="ad-card"><h3 style="margin-top:0">Recent Activities</h3><ul class="ad-list">${act.length ? act.map((x) => `<li>${esc(x.a)}</li>`).join('') : '<li>No activity yet.</li>'}</ul></div><button class="ad-tile" data-x="newstu"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6M9 14h6"/></svg>Register Student</button></div>`;
  };
})();
