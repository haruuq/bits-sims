/* =====================================================
   BITS-SIMS ADMIN PORTAL - MODULES 1 & 2 (dummy data)
   -----------------------------------------------------
   Loads after admin2.js and replaces these pages:
   Module 1: Users & Access (accounts, roles, permission grants),
             role-based menu, access-denied guard, role dashboards.
   Module 2: Student Profiles (registry + filters + profile tabs),
             Register Student (full form + validation),
             Admissions & Enrollment (applications -> student,
             term enrollment, class enrollment rules).
   Student data lives in the shared 'bits-sims-registry' store
   (extra fields added to each student), so Modules 3 & 4 keep working.
===================================================== */
(function () {
  const X = window.SIMSAdminX, A = window.SIMSAuth, { esc, badge, log, today, NAV, pages, rd } = X;
  const $ = (s) => document.querySelector(s), val = (id) => (($('#' + id) || {}).value || '').trim();
  const tbl = (h, rows) => `<table class="ad-table"><tr>${h.map((x) => `<th>${esc(x)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c).startsWith('<') ? c : esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table>`;
  const tabsH = (list, cur, key) => `<div class="ad-tabs">${list.map((t) => `<button class="ad-btn ${t === cur ? '' : 'alt'}" data-x="${key}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  const deny = (what) => `<h1>Access denied</h1><p class="ad-note">Your role (${esc(A.roleName(A.role()))}) does not allow ${esc(what)}. The check applies to every action, not only to the menu.</p>`;
  const stCls = (s) => (s === 'Active' ? 'ok' : s === 'On Leave' || s === 'Archived' || s === 'Pending Activation' ? 'warn' : s === 'Locked' || s === 'Suspended' || s === 'Inactive' ? 'risk' : 'info');
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, PHONE = /^(09|\+639)\d{9}$/, cleanNo = (v) => v.replace(/[\s-]/g, '');
  const NOT_ACTIVE = ['Dropped', 'Withdrawn', 'Cancelled'];

  /* ---------- student store (extends the registry students) ---------- */
  function up(d) {
    if (d.m2) return d;
    d.students.forEach((s) => {
      const p = s.name.split(', ');
      s.person = { first: p[1] || '', middle: '', last: p[0] || '', suffix: '', preferred: '', dob: '2005-06-15', gender: '', nationality: 'Filipino', civil: 'Single', pob: '', email: s.email || '', mobile: s.mobile || '', alt: '' };
      s.address = { line: '', barangay: '', city: s.city || '', province: '', postal: '', country: 'Philippines' };
      s.guardians = [{ name: 'Guardian of ' + (p[0] || ''), rel: 'Mother', phone: '09170000000', email: '', primary: true }];
      s.emergency = [{ name: 'Emergency contact', rel: 'Parent', phone: '09170000000' }];
      s.education = { school: 'Sample Senior High School', level: 'Senior High School', strand: 'STEM', year: '2023', prevprog: '' };
      s.enrollments = []; s.classEnr = [];
    });
    const E = (no, ref, status, year, classes) => {
      const s = d.students.find((x) => x.no === no); if (!s) return;
      s.enrollments.push({ ref, term: '1st Sem 2026-27', program: s.program, year, status, date: '2026-08-10', by: 'Regina Aquino' });
      (classes || []).forEach((c) => s.classEnr.push({ enr: ref, code: c[0], section: c[1], added: '2026-08-12', status: 'Enrolled', override: '' }));
    };
    E('2024-12345', 'ENR-0001', 'Enrolled', '3rd', [['IT301', '3B'], ['GE105', '3B']]);
    E('2026-0001', 'ENR-0007', 'Pending', '3rd');
    E('2026-0002', 'ENR-0012', 'Verified', '2nd', [['IT301', '3B']]);
    E('2026-0004', 'ENR-0019', 'Enrolled', '1st', [['IT302', '3B']]);
    d.m2 = true; X.saveDb(d); return d;
  }
  const db = () => up(X.db());
  const save = (d) => X.saveDb(d);
  const U = () => A.user();
  const classOf = (d, c) => d.classes.find((k) => k.code === c.code && k.section === c.section);
  // Row-level scope (8.4): Dept Head -> own department; Faculty -> students in their assigned classes
  const inScope = (s, d) => {
    const u = U(); if (!u) return false;
    if (u.role === 'DEPT_HEAD') return s.dept === u.dept;
    if (u.role === 'FACULTY') return s.classEnr.some((c) => c.status === 'Enrolled' && (classOf(d, c) || {}).faculty === u.facultyName);
    return true;
  };
  const DEPTS = (d) => d.setup.Departments.filter((r) => r[3] === 'Active').map((r) => r[0]);
  const PROGS = (d) => d.setup.Programs.filter((r) => r[3] === 'Active').map((r) => r[0]);
  const unitsOf = (d, code) => { const r = d.setup.Courses.find((x) => x[0] === code); return r ? parseFloat(r[2]) || 3 : 3; };
  const regUnits = (d, s, ref) => s.classEnr.filter((c) => c.enr === ref && c.status === 'Enrolled').reduce((n, c) => n + unitsOf(d, c.code), 0);
  const age = (dob) => (dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : '—');
  const nextNo = (d) => { const n = d.students.map((s) => s.no).filter((x) => /^2026-\d{4}$/.test(x)).map((x) => +x.slice(5)); return '2026-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(4, '0'); };
  const nextRef = (d) => { const n = [].concat(...d.students.map((s) => s.enrollments.map((e) => +e.ref.slice(4)))); return 'ENR-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(4, '0'); };

  let F = { q: '', dept: '', prog: '', yr: '', st: '', adm: '' }, R = {}, viewNo = null, ptab = 'Overview', etab = 'Applications', ut = 'Users', rt = 'REGISTRAR';

  /* =====================================================
     MODULE 2 - STUDENT PROFILES (registry)
  ===================================================== */
  pages.students = () => {
    const d = db(), q = F.q.toLowerCase();
    const L = d.students.filter((s) => inScope(s, d) && (!q || (s.no + ' ' + s.name).toLowerCase().includes(q)) && (!F.dept || s.dept === F.dept) && (!F.prog || s.program === F.prog) && (!F.yr || s.year === F.yr) && (!F.st || s.status === F.st) && (!F.adm || s.admission === F.adm));
    const sel = (id, all, opts, cur) => `<select id="${id}"><option value="">${all}</option>${opts.map((o) => `<option ${cur === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    const rows = L.map((s) => [s.no, s.name, s.program, s.year, s.admission, badge(stCls(s.status), s.status),
      `<a data-x="m_view" data-v="${s.no}">View Profile</a>` + (A.can('STUDENT_DEACTIVATE') ? `<a data-x="m_arch" data-v="${s.no}">${s.status === 'Archived' ? 'Restore' : 'Archive'}</a>` : '')]);
    return `<h1>Student Profiles</h1><p class="ad-note">Search, review, and manage registered students${U().role === 'FACULTY' || U().role === 'DEPT_HEAD' ? ' within your scope' : ''}.</p>
      <p class="ad-filters"><input id="fq" placeholder="Student number or name" value="${esc(F.q)}">${sel('fd', 'All departments', DEPTS(d), F.dept)}${sel('fp', 'All programs', PROGS(d), F.prog)}${sel('fy', 'All years', ['1st', '2nd', '3rd', '4th'], F.yr)}${sel('fs', 'All statuses', ['Active', 'On Leave', 'Archived'], F.st)}${sel('fa', 'All admission types', ['Freshman', 'Transferee', 'Returnee'], F.adm)}
      <button class="ad-btn" data-x="m_filter">Filter</button>${A.can('STUDENT_APPROVE') ? '<button class="ad-btn alt" data-go="corrections">Review Profile Correction</button>' : ''}${A.can('STUDENT_CREATE') ? '<button class="ad-btn" data-x="newstu">Register Student</button>' : ''}</p>
      ${tbl(['Student No.', 'Name', 'Program', 'Year', 'Admission', 'Status', 'Actions'], rows)}<p class="ad-note">Showing ${L.length} of ${d.students.length}. Records are archived, never deleted.</p>`;
  };

  /* ---- Register Student (4.2): personal, contact, guardian, emergency, education ---- */
  const SEC = (d) => {
    const apps = rd(X.K.adm, { applications: [] }).applications.filter((a) => a.status === 'accepted' && !a.studentId);
    return [
      ['Admission', [['app', 'Application No. (optional)', 'app', apps], ['dept', 'Department', 'sel', DEPTS(d)], ['program', 'Program', 'sel', PROGS(d)], ['admission', 'Admission Type', 'sel', ['Freshman', 'Transferee', 'Returnee']], ['year', 'Year Level', 'sel', ['1st', '2nd', '3rd', '4th']]]],
      ['Personal Information', [['first', 'First Name *'], ['middle', 'Middle Name'], ['last', 'Last Name *'], ['suffix', 'Suffix'], ['preferred', 'Preferred Name'], ['dob', 'Date of Birth *', 'date'], ['gender', 'Gender', 'sel', ['', 'Female', 'Male', 'Prefer not to say']], ['nationality', 'Nationality'], ['civil', 'Civil Status', 'sel', ['', 'Single', 'Married']], ['pob', 'Place of Birth']]],
      ['Contact Information', [['email', 'Personal Email *'], ['mobile', 'Mobile Number * (09XXXXXXXXX)'], ['alt', 'Alternate Number'], ['line', 'Address Line'], ['barangay', 'Barangay'], ['city', 'City / Municipality'], ['province', 'Province'], ['postal', 'Postal Code']]],
      ['Parent / Guardian', [['gname', 'Guardian Full Name *'], ['grel', 'Relationship', 'sel', ['Mother', 'Father', 'Guardian']], ['gnum', 'Contact Number *'], ['gemail', 'Guardian Email']]],
      ['Emergency Contact', [['ename', 'Contact Name'], ['erel', 'Relationship'], ['enum', 'Contact Number']]],
      ['Educational Background', [['school', 'Previous School'], ['level', 'Level', 'sel', ['Senior High School', 'College']], ['strand', 'Strand / Track'], ['yeargrad', 'Year Graduated'], ['prevprog', 'Previous Program (transferee)']]]
    ];
  };
  const fld = ([id, label, kind, opts]) => {
    const v = R[id] || '', n = 'r_' + id;
    if (kind === 'sel') return `<label>${label}<select id="${n}">${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    if (kind === 'app') return `<label>${label}<select id="${n}"><option value="">None (walk-in)</option>${opts.map((a) => `<option value="${a.id}" ${a.id === v ? 'selected' : ''}>${esc(a.id + ' · ' + a.program)}</option>`).join('')}</select></label>`;
    return `<label>${label}<input id="${n}" type="${kind || 'text'}" value="${esc(v)}"></label>`;
  };
  pages.register = () => `<h1>Register Student</h1>${SEC(db()).map(([t, fs]) => `<div class="ad-panel"><h3>${t}</h3><div class="ad-grid">${fs.map(fld).join('')}</div></div>`).join('')}
    <p><button class="ad-btn" data-x="m_save">Save Student</button> <button class="ad-btn alt" data-go="students">Cancel</button></p><p class="ad-note">The student number is generated on save and stays unique. Collect only what the school needs.</p>`;

  /* ---- Student profile (9.5) ---- */
  const PT = ['Overview', 'General Information', 'Contact Information', 'Guardian & Emergency', 'Education', 'Enrollment', 'Documents'];
  const kv = (rows) => tbl(['Field', 'Value'], rows.map((r) => [r[0], r[1] === '' || r[1] == null ? '—' : r[1]]));
  pages.profile = () => {
    const d = db(), s = d.students.find((x) => x.no === viewNo) || d.students.filter((x) => inScope(x, d))[0];
    if (!s) return '<h1>Student Profile</h1><p class="ad-note">No student in your scope.</p>';
    if (!inScope(s, d)) return deny('this student record (outside your scope)');
    const p = s.person, a = s.address; let body;
    if (ptab === 'General Information') body = kv([['Student number', s.no], ['Full name', [p.first, p.middle, p.last, p.suffix].filter(Boolean).join(' ')], ['Preferred name', p.preferred], ['Date of birth', p.dob], ['Age', age(p.dob)], ['Gender', p.gender], ['Nationality', p.nationality], ['Civil status', p.civil], ['Place of birth', p.pob], ['Department', s.dept], ['Program', s.program], ['Year level', s.year], ['Admission type', s.admission]]);
    else if (ptab === 'Contact Information') {
      const ed = A.can('STUDENT_EDIT'), f = (id, l, v) => `<label>${l}<input id="e_${id}" value="${esc(v)}" ${ed ? '' : 'disabled'}></label>`;
      body = `<div class="ad-panel"><div class="ad-grid">${f('email', 'Personal Email', p.email)}${f('mobile', 'Mobile Number', p.mobile)}${f('alt', 'Alternate Number', p.alt)}${f('line', 'Address Line', a.line)}${f('barangay', 'Barangay', a.barangay)}${f('city', 'City / Municipality', a.city)}${f('province', 'Province', a.province)}${f('postal', 'Postal Code', a.postal)}</div>${ed ? `<p style="background:none;padding:0"><button class="ad-btn" data-x="m_savecontact" data-v="${s.no}">Save Contact Details</button></p>` : ''}</div><p class="ad-note">Changes to official records are written to the audit log.</p>`;
    } else if (ptab === 'Guardian & Emergency') body = '<h3>Parent / Guardian</h3>' + tbl(['Name', 'Relationship', 'Contact', 'Email', 'Primary'], s.guardians.map((g) => [g.name, g.rel, g.phone, g.email || '—', g.primary ? 'Yes' : 'No'])) + '<h3>Emergency Contacts</h3>' + tbl(['Name', 'Relationship', 'Contact'], s.emergency.map((g) => [g.name, g.rel, g.phone]));
    else if (ptab === 'Education') body = kv([['Previous school', s.education.school], ['Level', s.education.level], ['Strand / track', s.education.strand], ['Year graduated', s.education.year], ['Previous program', s.education.prevprog], ['Transferee', s.admission === 'Transferee' ? 'Yes' : 'No']]);
    else if (ptab === 'Enrollment') body = '<h3>Term Enrollments</h3>' + tbl(['Ref.', 'Term', 'Year', 'Units', 'Status'], s.enrollments.map((e) => [e.ref, e.term, e.year, regUnits(d, s, e.ref).toFixed(1), badge(stCls(e.status === 'Enrolled' ? 'Active' : e.status === 'Pending' ? 'On Leave' : 'x'), e.status)])) + '<h3>Classes</h3>' + tbl(['Class', 'Section', 'Added', 'Status'], s.classEnr.map((c) => [c.code, c.section, c.added, c.status + (c.override ? ' (override)' : '')]));
    else if (ptab === 'Documents') body = s.no === '2024-12345' ? tbl(['Document', 'Status'], rd(X.K.docs, { requirements: [] }).requirements.map((r) => [r.name, r.status])) : '<p class="ad-note">No documents on file for this student yet.</p>';
    else body = kv([['Student number', s.no], ['Name', s.name], ['Department', s.dept], ['Program', s.program], ['Year level', s.year], ['Status', s.status]]);
    return `<h1>${esc(s.name)}</h1><p>${esc(s.no)} · ${esc(s.program)} · ${esc(s.year)} Year · ${esc(s.status)}</p>${tabsH(PT, ptab, 'm_ptab')}${body}<p><button class="ad-btn alt" data-go="students">Back</button></p>`;
  };

  /* =====================================================
     MODULE 2 - ADMISSIONS & ENROLLMENT
  ===================================================== */
  pages.admissions = () => {
    const d = db(), me = A.can('ENROLLMENT_APPROVE'), list = d.students.filter((s) => inScope(s, d));
    let body;
    if (etab === 'Applications') {
      const apps = rd(X.K.adm, { applications: [] }).applications;
      body = tbl(['App. No.', 'Program', 'Type', 'Term', 'Status', 'Actions'], apps.map((a) => [a.id, a.program, a.type, a.term, badge(a.status === 'accepted' ? 'ok' : a.status === 'rejected' ? 'risk' : a.status === 'review' ? 'info' : 'warn', a.status),
        (a.status === 'pending' ? `<a data-app="review" data-id="${a.id}">Start review</a>` : '') + (a.status === 'pending' || a.status === 'review' ? `<a data-app="accepted" data-id="${a.id}">Accept</a><a data-app="rejected" data-id="${a.id}">Reject</a>` : '') + (a.status === 'accepted' && !a.studentId && A.can('STUDENT_CREATE') ? `<a data-x="m_conv" data-v="${a.id}">Register as student</a>` : '') + (a.studentId ? `<small>Student ${esc(a.studentId)}</small>` : '')])) + '<p class="ad-note">Applications stay separate from student records. Accepted applicants are converted by the Registrar.</p>';
    } else if (etab === 'Term Enrollment') {
      const all = [].concat(...list.map((s) => s.enrollments.map((e) => ({ s, e }))));
      body = (A.can('ENROLLMENT_CREATE') ? `<div class="ad-panel"><h3>New Term Enrollment</h3><div class="ad-grid"><label>Student<select id="en_stu">${list.filter((s) => s.status === 'Active').map((s) => `<option value="${s.no}">${esc(s.no + ' · ' + s.name)}</option>`).join('')}</select></label><label>Academic term<select id="en_term"><option>1st Sem 2026-27</option><option>2nd Sem 2026-27</option></select></label><label>Year level<select id="en_yr">${['1st', '2nd', '3rd', '4th'].map((y) => `<option>${y}</option>`).join('')}</select></label></div><p style="background:none;padding:0"><button class="ad-btn" data-x="m_newenr">Create Enrollment</button></p></div>` : '')
        + tbl(['Ref.', 'Student', 'Term', 'Program', 'Year', 'Units', 'Status', 'Actions'], all.map(({ s, e }) => [e.ref, s.name, e.term, e.program, e.year, regUnits(d, s, e.ref).toFixed(1), badge(e.status === 'Enrolled' ? 'ok' : e.status === 'Verified' ? 'info' : e.status === 'Pending' ? 'warn' : 'risk', e.status),
          me && e.status === 'Pending' ? `<a data-x="m_enrstep" data-v="${e.ref}">Verify</a>` : me && e.status === 'Verified' ? `<a data-x="m_enrstep" data-v="${e.ref}">Mark Enrolled</a>` : ''])) + '<p class="ad-note">One active enrollment per student per term. Units are computed from the student’s classes.</p>';
    } else {
      const open = [].concat(...list.map((s) => s.enrollments.filter((e) => e.status === 'Verified' || e.status === 'Enrolled').map((e) => ({ s, e }))));
      const rows = [].concat(...list.map((s) => s.classEnr.map((c) => [s.name, c.code + ' · ' + ((classOf(d, c) || {}).title || ''), c.section, c.added, badge(c.status === 'Enrolled' ? 'ok' : 'risk', c.status) + (c.override ? ' ' + badge('warn', 'Override') : ''), c.status === 'Enrolled' && A.can('ENROLLMENT_EDIT') ? `<a data-x="m_drop" data-v="${s.no}|${c.code}|${c.section}">Drop</a>` : ''])));
      body = (A.can('ENROLLMENT_CREATE') ? `<div class="ad-panel"><h3>Add Student to Class</h3><div class="ad-grid"><label>Term enrollment<select id="ce_enr">${open.map(({ s, e }) => `<option value="${e.ref}">${esc(e.ref + ' · ' + s.name)}</option>`).join('')}</select></label><label>Class offering<select id="ce_cls">${d.classes.map((c) => `<option value="${c.code}|${c.section}">${esc(c.code + ' ' + c.section + ' (' + c.n + '/' + c.cap + ')')}</option>`).join('')}</select></label><label>Override reason (full class only)<input id="ce_over"></label></div><p style="background:none;padding:0"><button class="ad-btn" data-x="m_addclass">Add to Class</button></p></div>` : '')
        + tbl(['Student', 'Class', 'Section', 'Added', 'Status', 'Actions'], rows) + '<p class="ad-note">Blocked: duplicate class, same day/time clash, and a full class (unless an approver records an override reason).</p>';
    }
    return `<h1>Admissions &amp; Enrollment</h1>${tabsH(['Applications', 'Term Enrollment', 'Class Enrollment'], etab, 'm_etab')}${body}`;
  };

  /* =====================================================
     MODULE 1 - USERS & ACCESS
  ===================================================== */
  pages.users = () => {
    const me = U(); let body;
    if (ut === 'Users') {
      body = tbl(['Username', 'Name', 'Role', 'Scope', 'Status', 'MFA', 'Last login', 'Actions'], A.users().map((u) => [u.username, u.name, A.roleName(u.role), u.facultyName || u.dept || 'Institution', badge(stCls(u.status), u.status), u.mfa ? 'On' : 'Off', u.lastLogin || '—',
        u.id === me.id ? '—' : `<a data-x="m_ulock" data-v="${u.id}">${u.status === 'Locked' ? 'Unlock' : 'Lock'}</a><a data-x="m_uact" data-v="${u.id}">${u.status === 'Inactive' ? 'Activate' : 'Deactivate'}</a><a data-x="m_ureset" data-v="${u.id}">Reset password</a><a data-x="m_urole" data-v="${u.id}">Change role</a>`])) + '<p class="ad-note">Deactivating an account never deletes the student or staff record. You cannot change your own account here.</p>';
    } else if (ut === 'Add User') {
      body = `<div class="ad-panel"><h3>New Account</h3><div class="ad-grid"><label>Full name<input id="u_name"></label><label>Username<input id="u_user"></label><label>Email<input id="u_email"></label><label>Role<select id="u_role">${A.ROLES.map((r) => `<option value="${r[0]}">${r[1]}</option>`).join('')}</select></label><label>Department scope<select id="u_dept"><option value="">Institution</option>${DEPTS(db()).map((x) => `<option>${x}</option>`).join('')}</select></label></div><p style="background:none;padding:0"><button class="ad-btn" data-x="m_uadd">Create Account</button></p></div><p class="ad-note">The account starts as Pending Activation with a temporary password the user must change at first login.</p>`;
    } else {
      const gr = A.grants()[rt] || [], can = A.can('ROLE_MANAGE') && rt !== 'STUDENT', g = {};
      A.PERMS.forEach((p) => { (g[p.split('_')[0]] = g[p.split('_')[0]] || []).push(p); });
      body = tabsH(A.ROLES.map((r) => r[0]), rt, 'm_rt') + `<p class="ad-sub">${esc(A.roleName(rt))}${rt === 'STUDENT' ? ': self-service only (own profile, grades, attendance, documents). Students get no staff permissions.' : ''}</p>`
        + Object.entries(g).map(([n, ps]) => `<div class="ad-panel"><h3>${n}</h3><div class="ad-grid">${ps.map((p) => `<label style="flex-direction:row;font-size:.7rem"><input type="checkbox" class="perm" value="${p}" ${gr.includes(p) ? 'checked' : ''} ${can ? '' : 'disabled'}> ${p}</label>`).join('')}</div></div>`).join('')
        + (can ? `<p><button class="ad-btn" data-x="m_saveperm" data-v="${rt}">Save Permissions</button></p>` : '') + '<p class="ad-note">Permissions are checked on every action. Technical admin access should not mean routine authority over official academic data.</p>';
    }
    return `<h1>Users &amp; Access</h1><p class="ad-sub">Manage accounts, roles, and permissions.</p>${tabsH(['Users', 'Add User', 'Roles & Permissions'], ut, 'm_ut')}${body}`;
  };

  /* ---- Role-specific dashboard (9.3). Registrar keeps the queue dashboard. ---- */
  const home0 = pages.home;
  pages.home = () => {
    const u = U(); if (u.role === 'REGISTRAR') return home0();
    const d = db(), L = d.students.filter((s) => inScope(s, d)), us = A.users(), n = (st) => us.filter((x) => x.status === st).length, sys = u.role === 'ICT_ADMIN' || u.role === 'EDTECH';
    const cards = sys ? [['Accounts', us.length], ['Active', n('Active')], ['Locked / Suspended', n('Locked') + n('Suspended')], ['Pending activation', n('Pending Activation')]]
      : [['Students in scope', L.length], ['Active students', L.filter((s) => s.status === 'Active').length], ['Classes', u.role === 'FACULTY' ? d.classes.filter((c) => c.faculty === u.facultyName).length : d.classes.length]];
    const act = A.can('AUDIT_VIEW') ? rd(X.K.aud, []).slice(0, 6) : [];
    return `<h1>${esc(A.roleName(u.role))} Dashboard</h1><p class="ad-sub">Welcome, ${esc(u.name)}.</p><div class="ad-cards">${cards.map((c) => `<div class="ad-card"><small>${c[0]}</small><b>${c[1]}</b></div>`).join('')}</div>${act.length ? `<h3>Recent Activities</h3><ul class="ad-list">${act.map((x) => `<li>${esc(x.a)} <small>· ${esc(x.u)} · ${esc(x.t)}</small></li>`).join('')}</ul>` : ''}`;
  };

  /* =====================================================
     ACTIONS (all re-checked by X.needs before they run)
  ===================================================== */
  const done = (p, page) => { p.then(() => X.go(page)); return false; };
  const H = {
    m_filter: () => { F = { q: val('fq'), dept: val('fd'), prog: val('fp'), yr: val('fy'), st: val('fs'), adm: val('fa') }; return true; },
    m_view: (t, v) => { viewNo = v; ptab = 'Overview'; X.go('profile'); return true; },
    m_ptab: (t, v) => { ptab = v; return true; },
    m_etab: (t, v) => { etab = v; return true; },
    m_ut: (t, v) => { ut = v; return true; },
    m_rt: (t, v) => { rt = v; return true; },
    m_arch: (t, v) => { const d = db(), s = d.students.find((x) => x.no === v); s.status = s.status === 'Archived' ? 'Active' : 'Archived'; save(d); log(`Student ${v} ${s.status}`); return true; },

    m_conv: (t, v) => { // accepted application -> prefilled registration form
      const d = db(), a = rd(X.K.adm, { applications: [] }).applications.find((x) => x.id === v), p = d.setup.Programs.find((r) => r[1] === a.program);
      R = { app: v, admission: a.type.charAt(0).toUpperCase() + a.type.slice(1), program: p ? p[0] : '', dept: p ? p[2] : '' }; X.go('register'); return true;
    },
    m_save: () => {
      const d = db(); SEC(d).forEach(([, fs]) => fs.forEach((f) => { R[f[0]] = val('r_' + f[0]); }));
      const e = [], mob = cleanNo(R.mobile), dob = new Date(R.dob);
      if (!R.first || !R.last) e.push('First and last name are required.');
      if (!R.dob || isNaN(dob) || dob > new Date() || dob.getFullYear() < 1950) e.push('Enter a valid date of birth.');
      if (!EMAIL.test(R.email)) e.push('Enter a valid personal email.');
      if (!PHONE.test(mob)) e.push('Mobile number must look like 09171234567.');
      if (R.alt && !PHONE.test(cleanNo(R.alt))) e.push('Alternate number is not valid.');
      if (!R.gname || !PHONE.test(cleanNo(R.gnum))) e.push('Guardian name and a valid contact number are required.');
      if (R.enum && !PHONE.test(cleanNo(R.enum))) e.push('Emergency contact number is not valid.');
      if (R.yeargrad && !/^\d{4}$/.test(R.yeargrad)) e.push('Year graduated must be 4 digits.');
      const pr = d.setup.Programs.find((r) => r[0] === R.program);
      if (!pr || pr[2] !== R.dept || pr[3] !== 'Active') e.push('Choose a program that belongs to the selected department.');
      if (d.students.some((s) => s.person.first.toLowerCase() === R.first.toLowerCase() && s.person.last.toLowerCase() === R.last.toLowerCase() && s.person.dob === R.dob)) e.push('A student with the same name and birthdate already exists.');
      if (e.length) { alert(e.join('\n')); return true; }
      const no = nextNo(d), full = `${R.last}, ${R.first}`;
      d.students.push({ no, name: full, program: R.program, year: R.year, status: 'Active', dept: R.dept, admission: R.admission, email: R.email, mobile: mob, city: R.city, created: today(),
        person: { first: R.first, middle: R.middle, last: R.last, suffix: R.suffix, preferred: R.preferred, dob: R.dob, gender: R.gender, nationality: R.nationality, civil: R.civil, pob: R.pob, email: R.email, mobile: mob, alt: cleanNo(R.alt) },
        address: { line: R.line, barangay: R.barangay, city: R.city, province: R.province, postal: R.postal, country: 'Philippines' },
        guardians: [{ name: R.gname, rel: R.grel, phone: cleanNo(R.gnum), email: R.gemail, primary: true }], emergency: R.ename ? [{ name: R.ename, rel: R.erel, phone: cleanNo(R.enum) }] : [],
        education: { school: R.school, level: R.level, strand: R.strand, year: R.yeargrad, prevprog: R.prevprog }, enrollments: [], classEnr: [] });
      save(d);
      if (R.app) { const ad = rd(X.K.adm, { applications: [] }), a = ad.applications.find((x) => x.id === R.app); if (a) { a.studentId = no; X.wr(X.K.adm, ad); } }
      log(`Registered student ${no}${R.app ? ' from application ' + R.app : ''}`);
      R = {}; viewNo = no; ptab = 'Overview'; F = { q: '', dept: '', prog: '', yr: '', st: '', adm: '' }; alert('Student registered: ' + no); X.go('profile'); return true;
    },
    m_savecontact: (t, v) => {
      const d = db(), s = d.students.find((x) => x.no === v), g = (k) => val('e_' + k);
      if (!EMAIL.test(g('email'))) return alert('Enter a valid personal email.'), true;
      if (!PHONE.test(cleanNo(g('mobile')))) return alert('Mobile number must look like 09171234567.'), true;
      if (g('alt') && !PHONE.test(cleanNo(g('alt')))) return alert('Alternate number is not valid.'), true;
      const chg = [];
      [['email', s.person, 'email'], ['mobile', s.person, 'mobile'], ['alt', s.person, 'alt'], ['line', s.address, 'line'], ['barangay', s.address, 'barangay'], ['city', s.address, 'city'], ['province', s.address, 'province'], ['postal', s.address, 'postal']].forEach(([k, o, f]) => {
        const n = ['mobile', 'alt'].includes(k) ? cleanNo(g(k)) : g(k); if (o[f] !== n) { chg.push(f); o[f] = n; }
      });
      s.email = s.person.email; s.mobile = s.person.mobile; s.city = s.address.city; save(d);
      log(chg.length ? `Contact details of ${v} updated (${chg.join(', ')})` : `Contact details of ${v} saved (no changes)`); alert('Saved.'); return true;
    },

    m_newenr: () => {
      const d = db(), s = d.students.find((x) => x.no === val('en_stu')), term = val('en_term');
      if (!s) return alert('Choose a student.'), true;
      if (s.enrollments.some((e) => e.term === term && !NOT_ACTIVE.includes(e.status))) return alert('This student already has an active enrollment for that term.'), true;
      const ref = nextRef(d); s.enrollments.push({ ref, term, program: s.program, year: val('en_yr'), status: 'Pending', date: today(), by: U().name });
      save(d); log(`Term enrollment ${ref} created for ${s.no}`); return true;
    },
    m_enrstep: (t, v) => {
      const d = db(); let hit = null; d.students.forEach((s) => s.enrollments.forEach((e) => { if (e.ref === v) hit = { s, e }; }));
      hit.e.status = hit.e.status === 'Pending' ? 'Verified' : 'Enrolled'; hit.e.approvedBy = U().name; hit.e.approved = today();
      save(d); log(`Enrollment ${v} ${hit.e.status.toLowerCase()}`); return true;
    },
    m_addclass: () => {
      const d = db(), ref = val('ce_enr'), key = val('ce_cls').split('|'), over = val('ce_over'); let owner = null, enr = null;
      d.students.forEach((s) => s.enrollments.forEach((e) => { if (e.ref === ref) { owner = s; enr = e; } }));
      if (!enr) return alert('Choose a verified term enrollment first.'), true;
      const k = d.classes.find((c) => c.code === key[0] && c.section === key[1]), act = owner.classEnr.filter((c) => c.status === 'Enrolled');
      if (act.some((c) => c.code === k.code && c.section === k.section)) return alert('The student is already enrolled in this class.'), true;
      const clash = act.map((c) => classOf(d, c)).find((o) => o && o.day === k.day && o.time === k.time);
      if (clash) return alert(`Schedule clash with ${clash.code}: same day and time.`), true;
      if (k.n >= k.cap) {
        if (!A.can('ENROLLMENT_APPROVE')) return alert('This class is full. Only an authorized approver can record an override.'), true;
        if (!over) return alert('This class is full. Enter an override reason to continue.'), true;
      }
      owner.classEnr.push({ enr: ref, code: k.code, section: k.section, added: today(), status: 'Enrolled', override: k.n >= k.cap ? over : '' });
      k.n += 1; save(d); log(`${owner.no} added to ${k.code} ${k.section}${k.n > k.cap ? ' (capacity override: ' + over + ')' : ''}`); return true;
    },
    m_drop: (t, v) => {
      const [no, code, sec] = v.split('|'), reason = prompt('Reason for dropping this class:'); if (reason === null) return false;
      if (!reason.trim()) return alert('A reason is required.'), true;
      const d = db(), s = d.students.find((x) => x.no === no), c = s.classEnr.find((x) => x.code === code && x.section === sec && x.status === 'Enrolled'), k = classOf(d, c);
      c.status = 'Dropped'; c.dropReason = reason; c.dropped = today(); if (k) k.n = Math.max(0, k.n - 1);
      save(d); log(`${no} dropped ${code} ${sec}`); return true;
    },

    m_ulock: (t, v) => { const u = A.users().find((x) => x.id === v); if (!A.setStatus(v, u.status === 'Locked' ? 'Active' : 'Locked')) alert('Not allowed.'); return true; },
    m_uact: (t, v) => { const u = A.users().find((x) => x.id === v); if (!A.setStatus(v, u.status === 'Inactive' ? 'Active' : 'Inactive')) alert('Not allowed.'); return true; },
    m_ureset: (t, v) => done(A.resetPassword(v).then((r) => alert(r.error || `Temporary password: ${r.temp}\nThe user must change it at next login.`)), 'users'),
    m_urole: (t, v) => {
      const u = A.users().find((x) => x.id === v), c = prompt('New role code:\n' + A.ROLES.map((r) => r[0]).join(', '), u.role); if (c === null) return false;
      if (!A.setRole(v, c.trim().toUpperCase())) alert('Not allowed or unknown role.'); return true;
    },
    m_uadd: () => done(A.addUser({ name: val('u_name'), username: val('u_user'), email: val('u_email'), role: val('u_role'), dept: val('u_dept') }).then((r) => { if (r.error) alert(r.error); else { alert(`Account created (Pending Activation).\nTemporary password: ${r.temp}`); ut = 'Users'; } }), 'users'),
    m_saveperm: (t, v) => { const r = A.setGrants(v, [...document.querySelectorAll('.perm:checked')].map((c) => c.value)); alert(r.error || 'Permissions saved.'); return true; }
  };
  const prev = X.act;
  X.act = (t) => (t.dataset.x && H[t.dataset.x] ? H[t.dataset.x](t, t.dataset.v) : prev(t));

  /* ---------- Access control: what each action / page needs ---------- */
  const AN = { newstu: 'STUDENT_CREATE', savestu: 'STUDENT_CREATE', archive: 'STUDENT_DEACTIVATE', restore: 'STUDENT_DEACTIVATE', m_save: 'STUDENT_CREATE', m_conv: 'STUDENT_CREATE', m_savecontact: 'STUDENT_EDIT', m_arch: 'STUDENT_DEACTIVATE', m_newenr: 'ENROLLMENT_CREATE', m_addclass: 'ENROLLMENT_CREATE', m_drop: 'ENROLLMENT_EDIT', m_enrstep: 'ENROLLMENT_APPROVE', savecls: 'ENROLLMENT_EDIT', submitatt: 'ATTENDANCE_ENCODE', rep: 'REPORT_EXPORT', lock: 'USER_MANAGE', unlock: 'USER_MANAGE', m_ulock: 'USER_MANAGE', m_uact: 'USER_MANAGE', m_ureset: 'USER_MANAGE', m_urole: 'USER_MANAGE', m_uadd: 'USER_MANAGE', saveperm: 'ROLE_MANAGE', m_saveperm: 'ROLE_MANAGE' };
  X.needs = (t) => (t.dataset.cor || t.dataset.rel ? 'STUDENT_APPROVE' : t.dataset.app || t.dataset.doc ? 'ENROLLMENT_APPROVE' : t.dataset.gr !== undefined ? 'GRADE_APPROVE' : AN[t.dataset.x] || null);
  const NEED = { students: 'STUDENT_VIEW', profile: 'STUDENT_VIEW', register: 'STUDENT_CREATE', corrections: 'STUDENT_APPROVE', documents: 'STUDENT_APPROVE', admissions: 'ENROLLMENT_VIEW', attendance: 'ATTENDANCE_VIEW', records: 'GRADE_VIEW', grades: 'GRADE_VIEW', reports: 'REPORT_GENERATE', users: 'USER_MANAGE', audit: 'AUDIT_VIEW' };
  Object.keys(NEED).forEach((k) => { const p = pages[k]; if (p) pages[k] = () => (A.can(NEED[k]) ? p() : (log('Access denied: ' + k), deny('this page (' + NEED[k] + ')'))); });

  /* ---------- Role-based menu + header initials ---------- */
  const MASTER = NAV.map((n) => n.slice());
  X.initials = () => (U() ? A.initials(U().name) : 'RA');
  const open0 = window.SIMSAdmin.open;
  window.SIMSAdmin.open = (name) => { NAV.length = 0; MASTER.filter((n) => !NEED[n[0]] || A.can(NEED[n[0]])).forEach((n) => NAV.push(n)); open0(name); };
})();
