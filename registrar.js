/* =====================================================
   BITS-SIMS REGISTRAR PORTAL
   -----------------------------------------------------
   Replaces admin.js + admin2.js. That pair was one portal
   that mixed Registrar work with ICT/EdTech system admin
   (Users & Access, Audit & System, backups, roles). Now:

     Registrar  -> this file       (records, enrollment, documents)
     ICT / EdTech / Dept Head / Faculty -> staff.js

   What the Registrar can do (design reference 8.2):
     Student registration ......... Full
     Student profiles / corrections Full / Approve
     Student documents ............ Full
     Enrollment management ........ Full
     Class assignment / scheduling  View only
     Attendance ................... View only (faculty encode it)
     Grades ....................... Approve / finalize (post)
     Academic records, reports .... Full
     Audit trails ................. Restricted (own activity only)
     Accounts, roles, backup, monitoring ... None (ICT Services)

   Shared stores (localStorage), so each side sees the other:
     bits-sims-corrections  student name-change requests  -> Profile Corrections
     bits-sims-documents    uploads + COR/COE/TOR requests -> Document Management
     bits-sims-admissions   the student's own application  -> Admissions & Enrollment
     bits-sims-academic     grades (via SIMSData)          -> transcripts, report cards, analytics
     bits-sims-profile      official profile (on approval)
     bits-sims-registry     students + setup (registry.js)
   Faculty grade sheets and class offerings come from staff.js
   (window.SIMSStaff), so the grade chain is
   Faculty -> Department Head -> Registrar (posts).

   Log in as registrar.santos (see accounts.js).
===================================================== */
(function () {
  'use strict';

  const K = { docs: 'bits-sims-documents', adm: 'bits-sims-admissions', cor: 'bits-sims-corrections', prof: 'bits-sims-profile' };
  const rd = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const $ = (s) => document.querySelector(s);
  const val = (id) => ($('#' + id) || {}).value || '';
  const badge = (cls, t) => `<span class="dm-status ${cls}">${esc(t)}</span>`;
  const staff = () => window.SIMSStaff || null;

  const DEMO_STUDENT = '2024-12345'; // the student who has a portal login (sample data)
  const DOC_REQ = { cor: 'Certificate of Registration', coe: 'Certificate of Enrollment', tor: 'Transcript of Records' };

  let acct = null, page = 'home', sel = null;
  let fl = { q: '', st: '' }, tab = 'Overview', viewNo = null, rtab = 'Student Records', stab = 'Departments', mtab = 'Applications';

  /* ---------- Registry + settings ---------- */
  const reg = () => window.SIMSRegistry.get();
  const saveReg = (d) => window.SIMSRegistry.save(d);

  /* ---------- Audit (shared with the ICT audit trail) ---------- */
  const log = (desc, mod, ent, rec, action) => {
    if (staff() && acct) staff().record(acct.username, mod || 'Registration', ent || 'Students', rec || '', action || 'UPDATE', desc);
  };

  /* ---------- Queries ---------- */
  const docs = () => rd(K.docs, { requirements: [], requests: {} });
  const corrections = () => rd(K.cor, []);
  const adm = () => rd(K.adm, { applications: [] });
  // Every application the Registrar decides: the portal student's own plus applicants who are not students yet
  const allApplications = () => {
    const stu = reg().students.find((x) => x.no === DEMO_STUDENT);
    return adm().applications.map((a) => Object.assign({ name: stu ? stu.name : '\u2014' }, a)).concat(reg().applicants || []);
  };
  const periods = () => SIMSData.rules().gradingPeriods.map((p) => p.key).concat('final');
  // Student-portal grade releases (what the student sees once POSTED)
  // Grade corrections waiting for the Registrar (Faculty -> Dept Head -> Registrar)
  const gradeCorrections = () => (staff() && staff().corrections ? staff().corrections() : []);
  // Faculty grade sheets that went Faculty -> Dept Head (see staff.js)
  const sheets = () => (staff() ? staff().gradeSheets() : []);

  /* ---------- Small view helpers ---------- */
  const table = (h, rows) => `<table class="ad-table"><tr>${h.map((x) => `<th>${esc(x)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${String(c).startsWith('<') ? c : esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table>`;
  const tabs = (list, cur, key) => `<div class="ad-tabs">${list.map((t) => `<button class="ad-btn ${t === cur ? '' : 'alt'}" data-x="${key}" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
  const stCls = (s) => (s === 'Active' || s === 'Enrolled' ? 'ok' : s === 'On Leave' || s === 'Archived' || s === 'Pending' ? 'warn' : 'info');
  const initials = (n) => n.replace(/^(Dr\.|Prof\.)\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const oldest = (dates) => { const t = dates.filter(Boolean).map((x) => new Date(x).getTime()).filter((n) => n); if (!t.length) return '\u2014'; const n = Math.max(0, Math.round((Date.now() - Math.min(...t)) / 864e5)); return n + (n === 1 ? ' day' : ' days'); };
  const f2 = (n) => (n == null ? '\u2014' : n.toFixed(2));
  const gradeTxt = (g) => (g === 'INC' ? 'INC' : typeof g === 'number' ? g.toFixed(2) : '\u2014');
  // Finals only for now: a subject's grade status is the status of its final grade
  const finalState = (x) => cap(x.finalGrade == null && x.status !== 'inc' ? 'not yet encoded' : (x.gradeStatus && x.gradeStatus.final) || 'posted');
  // Shown to people: Title Case statuses and readable dates (same as the other portals)
  const LABEL = { review: 'Under Review', inprogress: 'In Progress', inc: 'INC' };
  const cap = (t) => LABEL[t] || String(t || '').replace(/^./, (c) => c.toUpperCase());
  const ADM_TYPE = { freshman: 'Freshman', transferee: 'Transferee', returnee: 'Returnee', shiftee: 'Shiftee' };
  const fmtDay = (iso) => { if (!iso) return '\u2014'; const [y, m, dd] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const fmtStamp = (ts) => { if (!ts) return '\u2014'; const [dd, t] = String(ts).split(' '); if (!t) return fmtDay(dd); const [y, m, day] = dd.split('-').map(Number), [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, day, h, mi).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const fullName = (n) => String(n).split(', ').reverse().join(' ');
  const stuName = (no) => { const x = reg().students.find((y) => y.no === no); return x ? `${x.name} (${no})` : no; };

  /* ---------- Toast + confirm dialog (same look as the staff portal) ---------- */
  let toastTimer = null, askFn = null;
  function toast(msg, type) {
    const el = $('#rgToast'); if (!el) return;
    el.textContent = msg; el.className = `toast ${type || 'success'} show`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }
  function ask(title, message, label, fn, danger) {
    $('#rgAskTitle').textContent = title; $('#rgAskMsg').textContent = message;
    const ok = $('#rgAskOk'); ok.textContent = label; ok.classList.toggle('btn-danger', Boolean(danger));
    askFn = fn; $('#rgAsk').classList.remove('hidden'); $('#rgAskCancel').focus();
  }
  function closeAsk() { $('#rgAsk').classList.add('hidden'); askFn = null; }
  function ensureChrome() {
    if ($('#rgToast')) return;
    const box = document.createElement('div');
    box.innerHTML = `<div id="rgAsk" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="rgAskTitle"><div class="modal-card staff-modal-card">
        <header class="modal-head"><h3 id="rgAskTitle"></h3><button type="button" class="modal-close" id="rgAskX" aria-label="Close">&times;</button></header>
        <div class="modal-body"><p class="dm-modal-note" id="rgAskMsg"></p></div>
        <footer class="modal-foot"><button type="button" class="btn-light btn-sm" id="rgAskCancel">Cancel</button><button type="button" class="btn-solid btn-sm" id="rgAskOk">OK</button></footer></div></div>
      <div id="rgToast" class="toast" role="status" aria-live="polite"></div>`;
    while (box.firstChild) document.body.appendChild(box.firstChild);
    $('#rgAskCancel').addEventListener('click', closeAsk); $('#rgAskX').addEventListener('click', closeAsk);
    $('#rgAsk').addEventListener('click', (e) => { if (e.target.id === 'rgAsk') closeAsk(); });
    $('#rgAskOk').addEventListener('click', () => { const fn = askFn; closeAsk(); if (fn) fn(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#rgAsk').classList.contains('hidden')) closeAsk(); });
  }

  /* =====================================================
     PAGES
  ===================================================== */
  const pages = {};

  /* ---- Home ---- */
  pages.home = () => {
    const d = reg(), docsD = docs();
    const apps = allApplications().filter((a) => a.status === 'pending' || a.status === 'review');
    const cor = corrections().filter((c) => c.status === 'pending');
    const dd = docsD.requirements.filter((r) => r.status === 'review');
    const enrWait = d.enrollments.filter((e) => e.status === 'Pending' || e.status === 'Verified').length;
    const gqCorr = gradeCorrections().filter((x) => x.status === 'Endorsed').length, gqFaculty = sheets().filter((s) => s.status === 'Approved').length;
    const act = (staff() ? staff().auditFor(acct.username, 20) : []).filter((x) => x.act !== 'LOGIN' && x.act !== 'LOGOUT').slice(0, 4);
    // Average of every class's attendance rate (what faculty recorded)
    const att = (staff() ? staff().attendanceSummary() : []).map((r) => r.rate).filter((n) => n != null), rate = att.length ? Math.round(att.reduce((a, b) => a + b, 0) / att.length) : 0;
    const now = new Date(), first = new Date(now.getFullYear(), now.getMonth(), 1).getDay(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cal = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => `<b>${x}</b>`).join('') + '<span></span>'.repeat(first) + Array.from({ length: days }, (_, i) => `<span class="${i + 1 === now.getDate() ? 'td' : ''}">${i + 1}</span>`).join('');
    const q = [
      ['Admission applications to decide', apps.length, oldest(apps.map((a) => a.submitted)), 'admissions'],
      ['Term enrollments to verify', enrWait, '\u2014', 'admissions'],
      ['Profile correction requests', cor.length, oldest(cor.map((c) => c.date)), 'corrections'],
      ['Documents awaiting verification', dd.length + Object.keys(docsD.requests).length, oldest(dd.map((r) => r.updated).concat(Object.values(docsD.requests))), 'documents'],
      ['Grades and corrections awaiting posting', gqCorr + gqFaculty, '\u2014', 'records']
    ];
    return `<h1>Welcome back, ${esc(acct.name.split(' ')[0])}</h1><p class="ad-sub">${esc(acct.dept)} \u00B7 ${esc(SIMSData.termLabel(SIMSData.currentTerm()))}</p>
      <div class="ad-stats" style="grid-template-columns:repeat(5,1fr)">${[['Total students', d.students.length], ['Active students', d.students.filter((s) => s.status === 'Active').length], ['Departments', d.setup.Departments.length], ['Programs', d.setup.Programs.length], ['Enrolled this term', d.enrollments.filter((e) => e.status === 'Enrolled').length]].map((r) => `<div class="ad-card"><small>${r[0]}</small><b>${r[1]}</b></div>`).join('')}</div>
      <div class="ad-card" style="margin-bottom:1rem"><small>Overall attendance rate (all classes)</small><b>${rate}%</b></div>
      <div class="ad-row"><div class="ad-card ad-id"><span class="ad-ra big">${esc(initials(acct.name))}</span><span>${esc(acct.name)}<br>${esc(acct.title)}</span></div>
      <div class="ad-card"><table class="ad-queue" style="width:100%;font-size:.8rem;border-collapse:collapse"><tr style="color:#17305e;border-bottom:2px solid var(--blue)"><th style="text-align:left;padding:.4rem">Pending Queues</th><th>Pending</th><th>Oldest</th></tr>${q.map((r) => `<tr data-go="${r[3]}"><td style="padding:.55rem .4rem;color:var(--blue)">${esc(r[0])}</td><td style="color:var(--blue)">${r[1]}</td><td style="color:var(--blue)">${r[2]}</td></tr>`).join('')}</table></div>
      <div class="ad-card ad-cal"><h4>${now.toLocaleString('en', { month: 'long', year: 'numeric' })}</h4><div>${cal}</div></div></div>
      <div class="ad-row2"><div class="ad-card"><h3 style="margin-top:0">Recent Activities</h3><ul class="ad-list ad-feed">${act.length ? act.map((x) => `<li><span>${esc(x.desc)}</span><small>${esc(fmtStamp(x.ts))}</small></li>`).join('') : '<li>No activity yet.</li>'}</ul><p class="ad-more"><a data-go="activity">See all activity</a></p></div><button class="ad-tile" data-x="newstu"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6M9 14h6"/></svg>Register Student</button></div>`;
  };

  /* ---- Student Profiles + Register + Profile + Corrections ---- */
  pages.students = () => {
    const d = reg(), q = fl.q.toLowerCase();
    const rows = d.students.filter((s) => (!q || (s.no + s.name).toLowerCase().includes(q)) && (!fl.st || s.status === fl.st)).map((s) => [s.no, s.name, s.program, s.year, badge(stCls(s.status), s.status), `<a data-x="view" data-v="${esc(s.no)}">View Profile</a><a data-x="${s.status === 'Archived' ? 'restore' : 'archive'}" data-v="${esc(s.no)}">${s.status === 'Archived' ? 'Restore' : 'Archive'}</a>`]);
    return `<h1>Student Profiles</h1><p class="ad-note">Search, review, and manage registered students.</p>
      <p class="ad-filters"><input id="fq" placeholder="Student number or name" value="${esc(fl.q)}"> <select id="fs"><option value="">All statuses</option>${['Active', 'On Leave', 'Archived'].map((x) => `<option ${fl.st === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <button class="ad-btn" data-x="filter">Filter</button> <button class="ad-btn alt" data-go="corrections">Profile Correction Requests</button> <button class="ad-btn" data-x="newstu">Register Student</button></p>
      ${table(['Student No.', 'Name', 'Program', 'Year', 'Status', 'Actions'], rows)}<p class="ad-note">Showing ${rows.length} of ${d.students.length}. Records are deactivated or archived, never deleted.</p>`;
  };

  pages.register = () => {
    const d = reg(), depts = d.setup.Departments.map((x) => x[0]), progs = d.setup.Programs.filter((x) => x[3] === 'Active').map((x) => x[0]);
    const F = [['Admission', [['dept', 'Department', depts], ['program', 'Program', progs], ['admission', 'Admission Type', ['Freshman', 'Transferee', 'Returnee']], ['year', 'Year Level', ['3rd']]]],
      ['Personal Information', [['first', 'First Name *'], ['middle', 'Middle Name'], ['last', 'Last Name *'], ['dob', 'Date of Birth']]], ['Contact Information', [['email', 'Personal Email'], ['mobile', 'Mobile Number'], ['city', 'City']]],
      ['Parent / Guardian', [['gname', 'Guardian Name'], ['gnum', 'Contact Number']]], ['Emergency Contact', [['ename', 'Contact Name'], ['enum', 'Contact Number']]]];
    return `<h1>Register Student</h1>${F.map(([t, fs]) => `<div class="ad-panel"><h3>${t}</h3><div class="ad-grid">${fs.map(([id, l, o]) => `<label>${l}${o ? `<select id="f_${id}">${o.map((x) => `<option>${esc(x)}</option>`).join('')}</select>` : `<input id="f_${id}">`}</label>`).join('')}</div></div>`).join('')}
      <p><button class="ad-btn" data-x="savestu">Save Student</button> <button class="ad-btn alt" data-go="students">Cancel</button></p><p class="ad-note">The student number is generated on save, and a pending term enrollment is created for verification.</p>`;
  };

  pages.profile = () => {
    const d = reg(), s = d.students.find((x) => x.no === viewNo) || d.students[0], real = s.no === DEMO_STUDENT;
    const T = ['Overview', 'General Information', 'Contact Information', 'Guardian Information', 'Grades', 'Documents'];
    let body;
    if (tab === 'Grades') {
      const r = SIMSData.recordFor(s.no);
      body = (r.terms.length ? r.terms.map((t) => `<h3>${esc(SIMSData.termLabel(t.term))} \u00B7 GWA ${f2(t.gwa)} \u00B7 ${esc(t.standing)}</h3>${table(['Course', 'Units', 'Final grade', 'Remarks'], t.subjects.map((g) => [g.code + ' \u00B7 ' + g.title, g.units.toFixed(1), g.status === 'inc' ? 'INC' : f2(g.grade), cap(g.status)]))}`).join('')
          + `<p class="ad-note">Cumulative GWA ${f2(r.cumulative)} \u00B7 ${r.unitsEarned.toFixed(1)} units earned. Only posted grades are shown.</p>` : '<p>No posted grades yet.</p>')
        + (real ? `<h3>Current term (in progress)</h3>${table(['Course', 'Finals', 'Status'], SIMSData.get().subjects.filter((x) => x.termId === SIMSData.currentTerm().id).map((x) => [x.code, x.status === 'inc' ? 'INC' : x.finalGrade == null ? '\u2014' : f2(x.finalGrade), finalState(x)]))}` : '')
        + `<p><button class="ad-btn" data-x="rp-open" data-v="tor">Transcript of Records</button> <button class="ad-btn alt" data-x="rp-open" data-v="reportcard">Report Card</button></p>`;
    }
    else if (tab === 'Documents') body = real ? table(['Document', 'Status'], docs().requirements.map((r) => [r.name, cap(r.status)])) : '<p>No documents on file.</p>';
    else body = table(['Field', 'Value'], tab === 'Contact Information' ? [['Email', s.email || '\u2014'], ['Mobile', s.mobile || '\u2014'], ['City', s.city || '\u2014']]
      : tab === 'General Information' ? [['Admission type', s.admission], ['Department', s.dept], ['Date of birth', s.dob || '\u2014']]
      : tab === 'Guardian Information' ? [['Guardian', s.gname || '\u2014'], ['Guardian contact', s.gnum || '\u2014'], ['Emergency contact', s.ename || '\u2014'], ['Emergency number', s.enum || '\u2014']]
      : [['Student number', s.no], ['Name', s.name], ['Program', s.program], ['Year', s.year], ['Status', s.status]]);
    return `<h1>${esc(s.name)}</h1><p>${esc(s.no)} \u00B7 ${esc(s.program)} \u00B7 ${esc(s.year)} Year \u00B7 ${esc(s.status)}</p>${tabs(T, tab, 'tab')}${body}<p><button class="ad-btn alt" data-go="students">Back</button></p>`;
  };

  pages.corrections = () => {
    const all = corrections();
    const cur = all.find((x) => x.id === sel) || all.find((x) => x.status === 'pending');
    const rows = all.map((x) => `<tr data-sel="${esc(x.id)}" class="${cur && cur.id === x.id ? 'on' : ''}"><td>${esc(stuName(x.student))}</td><td>${esc(x.label)}</td><td>${esc(x.next)}</td><td>${esc(fmtDay(x.date))}</td><td>${badge(x.status === 'pending' ? 'warn' : x.status === 'approved' ? 'ok' : 'risk', cap(x.status))}</td></tr>`).join('');
    const panel = cur ? `<div class="ad-panel"><h3>Review Request</h3>
      <p><small>Field</small> <b>${esc(cur.label)}</b></p><p><small>Existing value</small> <b>${esc(cur.old)}</b></p>
      <p><small>Requested value</small> <b>${esc(cur.next)}</b></p><p><small>Reason</small> <b>${esc(cur.reason || '\u2014')}</b></p>
      ${cur.status === 'pending' ? `<textarea id="adRemarks" placeholder="Review remarks"></textarea>
      <button class="ad-btn" data-cor="approved" data-id="${esc(cur.id)}">Approve</button> <button class="ad-btn alt" data-cor="rejected" data-id="${esc(cur.id)}">Reject</button>`
      : `<p><small>Decision</small> <b>${esc(cap(cur.status))}</b> \u2014 ${esc(cur.remarks || 'no remarks')}</p>`}</div>` : '';
    return `<h1>Profile Correction Requests</h1><p class="ad-sub">Review name and detail changes requested by students.</p><div class="ad-split">
      <table class="ad-table"><tr><th>Student</th><th>Field</th><th>Requested</th><th>Date</th><th>Status</th></tr>${rows || '<tr><td colspan="5">No requests yet. When a student changes their name in My Profile, the request appears here.</td></tr>'}</table>${panel}</div>
      <p><button class="ad-btn alt" data-go="students">Back to Student Profiles</button></p>`;
  };

  /* ---- Admissions & Enrollment ---- */
  pages.admissions = () => {
    const d = reg();
    let body;
    if (mtab === 'Applications') {
      const rows = allApplications().map((a) => `<tr><td>${esc(a.id)}</td><td>${esc(a.name)}</td><td>${esc(a.program)}</td><td>${esc(ADM_TYPE[a.type] || cap(a.type))}${a.year ? ` \u00B7 ${esc(a.year)} Year` : ''}</td><td>${esc(a.term)}</td><td>${esc(fmtDay(a.submitted))}</td><td>${badge(a.status === 'accepted' || a.status === 'enrolled' ? 'ok' : a.status === 'rejected' ? 'risk' : a.status === 'review' ? 'info' : 'warn', cap(a.status))}</td>
        <td>${a.status === 'pending' ? `<a data-app="review" data-id="${esc(a.id)}">Start review</a> ` : ''}${a.status === 'pending' || a.status === 'review' ? `<a data-app="accepted" data-id="${esc(a.id)}">Accept</a> <a data-app="rejected" data-id="${esc(a.id)}">Reject</a>` : ''}</td></tr>`).join('');
      body = `<table class="ad-table"><tr><th>App. No.</th><th>Applicant</th><th>Program</th><th>Type</th><th>Term</th><th>Submitted</th><th>Status</th><th>Actions</th></tr>${rows || '<tr><td colspan="8">No applications yet.</td></tr>'}</table>
        <p class="ad-note">Decisions are shown to the applicant under Admissions &amp; Enrollment \u2192 Application Status.</p>`;
    } else if (mtab === 'Term Enrollment') {
      body = table(['Ref. No.', 'Student', 'Term', 'Program', 'Year', 'Units', 'Status', 'Action'], d.enrollments.map((e) => [e.ref, e.student, e.term, e.program, e.year, e.units, badge(stCls(e.status === 'Verified' ? 'info' : e.status), e.status),
        e.status === 'Pending' ? `<a data-x="enr" data-v="${esc(e.ref)}">Verify</a>` : e.status === 'Verified' ? `<a data-x="enr" data-v="${esc(e.ref)}">Approve &amp; enroll</a>` : '']))
        + '<p class="ad-note">Pending \u2192 Verified \u2192 Enrolled. Each step is recorded in the audit trail.</p>';
    } else {
      // Recent class enrollment changes; a class can only be added once the term enrollment is Enrolled
      const termOf = (no) => (d.enrollments.find((e) => e.no === no) || {}).status;
      const recent = [['2024-10477', 'Dela Cruz, Carlo Miguel', 'ITP3112R', '3B', '2026-08-12'], ['2024-11502', 'Santos, Maria', 'ITP3111R', '3B', '2026-08-13']];
      body = table(['Student', 'Class Offering', 'Section', 'Date Added', 'Status'], recent.map(([no, name, code, sec, date]) => [name, code, sec, fmtDay(date), termOf(no) === 'Enrolled' ? badge('ok', 'Enrolled') : badge('warn', 'Waiting for term enrollment')]))
        + '<p class="ad-note">A student is added to classes once their term enrollment is Enrolled. Duplicate enrollment in the same class is blocked, and enrolling past capacity needs a recorded override.</p>';
    }
    return `<h1>Admissions &amp; Enrollment</h1>${tabs(['Applications', 'Term Enrollment', 'Class Enrollment'], mtab, 'mtab')}${body}`;
  };

  /* ---- Attendance (view only: faculty encode it) ---- */
  pages.attendance = () => {
    const s = staff();
    const rows = (s ? s.attendanceSummary() : []).map((r) => [r.code + ' \u00B7 ' + r.title, r.section, r.faculty, r.held, r.absent, r.late, r.rate == null ? '\u2014' : r.rate.toFixed(1) + '%']);
    const alerts = (s ? s.attendanceAlerts() : []).slice(0, 8).map((a) => [fmtDay(a.date), a.student, a.type, a.message]);
    return `<h1>Attendance</h1><p class="ad-sub">View only. Each class's faculty member records attendance.</p>
      <h3>Class attendance summary</h3>${table(['Course', 'Section', 'Faculty', 'Meetings held', 'Absences', 'Late', 'Rate'], rows)}
      <h3>Attendance alerts</h3>${table(['Date', 'Student', 'Type', 'Details'], alerts)}
      <p class="ad-note">A student is flagged after reaching the absence or late-arrival limit set by ICT Services.</p>`;
  };

  /* ---- Academic Records ---- */
  pages.records = () => {
    const d = reg(), R = ['Student Records', 'Class & Scheduling', 'Grade Management', 'Academic Setup'], t = SIMSData.currentTerm(), sm = SIMSData.termSummary(t.id);
    let body;
    if (rtab === 'Student Records') {
      const me = d.students.find((x) => x.no === DEMO_STUDENT) || d.students[0];
      body = `<div class="ad-row2" style="grid-template-columns:1fr 160px 160px"><div class="ad-card" style="display:flex;gap:1rem;align-items:center"><span class="ad-ra">${esc(initials(me.name.split(', ').reverse().join(' ')))}</span><div><b style="font-size:1.05rem;margin:0">${esc(me.name)}</b><small style="text-transform:none">${esc(me.no)} \u00B7 ${esc(me.program)} \u00B7 ${esc(me.year)} Year</small></div></div><div class="ad-card"><small>Term GWA</small><b>${f2(sm.gwa)}</b></div><div class="ad-card"><small>Cumulative GWA</small><b>${f2(SIMSData.cumulativeGwa())}</b></div></div>
        ${table(['Course', 'Units', 'Finals', 'Remarks', 'Status'], sm.subjects.map((x) => SIMSData.raw.subject(x.id)).map((x) => [x.code + ' \u00B7 ' + x.title, x.units.toFixed(1), x.status === 'inc' ? 'INC' : f2(x.finalGrade), cap(x.status), finalState(x)]))}<p class="ad-note">Posted grades change only through the controlled correction process.</p>`;
    } else if (rtab === 'Grade Management') {
      body = gradePanels();
    } else if (rtab === 'Academic Setup') {
      const SETUP_COLS = { Departments: ['Code', 'Name', 'Head', 'Status'], Programs: ['Code', 'Name', 'Department', 'Status'], Courses: ['Code', 'Title', 'Units', 'Status'], 'Academic Terms': ['Academic Year', 'Semester', 'Dates', 'Status'], Rooms: ['Code', 'Name', 'Capacity', 'Status'] };
      body = tabs(Object.keys(d.setup), stab, 'stab') + table(SETUP_COLS[stab] || ['Code', 'Name', 'Detail', 'Status'], d.setup[stab]) + '<p class="ad-note">View only. Departments, programs and terms follow school policy; schedules are managed by Department Heads and EdTech Services.</p>';
    } else {
      const cl = staff() ? staff().classes() : [];
      body = `${table(['Course', 'Section', 'Faculty', 'Schedule', 'Room', 'Enrolled'], cl.map((c) => [c.code + ' \u00B7 ' + c.title, c.section, staff().userName(c.faculty), c.day.slice(0, 3) + ' ' + c.start + '\u2013' + c.end, c.room, c.size + ' / ' + c.capacity]))}
        <p class="ad-note">View only. Department Heads create class offerings and assign faculty; EdTech Services adjust schedules and rooms.</p>`;
    }
    return `<h1>Academic Records</h1><p class="ad-sub">Review and finalize official grades and academic history.</p>${tabs(R, rtab, 'rtab')}${body}`;
  };

  function gradePanels() {
    const sh = sheets();
    const fRows = sh.map((g, i) => [g.code + ' \u00B7 ' + g.title, g.section, g.faculty, g.period, badge(g.status === 'Posted' ? 'ok' : g.status === 'Approved' ? 'info' : g.status === 'Returned' ? 'risk' : 'warn', g.status === 'Approved' ? 'Approved by Dept Head' : g.status),
      g.status === 'Approved' ? `<a data-x="sheet-post" data-v="${i}">Post official</a><a data-x="sheet-return" data-v="${i}">Return</a>` : g.status === 'Submitted' ? '<small>With Department Head</small>' : '']);
    const gc = gradeCorrections();
    const cRows = gc.map((x) => [x.id, x.name + ' (' + x.sn + ')', x.code + ' \u00B7 ' + x.section, gradeTxt(x.from), gradeTxt(x.to), x.reason,
      badge(x.status === 'Applied' ? 'ok' : x.status === 'Endorsed' ? 'info' : x.status === 'Rejected' ? 'risk' : 'warn', x.status === 'Endorsed' ? 'Endorsed by Dept Head' : x.status),
      x.status === 'Endorsed' ? `<a data-x="gc-apply" data-v="${esc(x.id)}">Apply correction</a> <a data-x="gc-reject" data-v="${esc(x.id)}">Reject</a>` : x.status === 'Requested' ? '<small>With Department Head</small>' : '']);
    return `<h3>Faculty grade sheets</h3>${table(['Course', 'Section', 'Faculty', 'Period', 'Status', 'Action'], fRows)}
      <p class="ad-note">Faculty submit \u2192 Department Head approves \u2192 the Registrar posts. Students see a grade only once it is posted.</p>
      <h3>Grade corrections</h3>${table(['ID', 'Student', 'Course', 'Posted', 'Corrected', 'Reason', 'Status', 'Action'], cRows)}
      <p class="ad-note">A posted grade only changes through a correction: Faculty request it with a reason \u2192 the Department Head endorses \u2192 the Registrar applies it. Every step is in the audit trail.</p>`;
  }

  /* ---- Reports & Analytics (design reference 6.3, 6.5, 6.6) ----
     Every report is a view of the shared records (registry, data.js
     official grades, faculty attendance); none keeps its own copy.
     Generate -> preview -> Export CSV / Print (PDF). Each generation
     and export is logged in the audit trail and report history. */
  const rp = { id: 'master', program: 'all', year: 'all', status: 'all', term: '', student: DEMO_STUDENT, result: null };
  const ALL = 'all';
  const regStudent = (no) => reg().students.find((x) => x.no === no);
  const studentOk = (no) => {
    const x = regStudent(no);
    if (!x) return rp.program === ALL && rp.year === ALL && rp.status === ALL;
    return (rp.program === ALL || x.program === rp.program) && (rp.year === ALL || x.year === rp.year) && (rp.status === ALL || x.status === rp.status);
  };
  const filtStudents = () => reg().students.filter((x) => studentOk(x.no));
  const termById = (id) => SIMSData.term(id) || SIMSData.currentTerm();
  const termName = (id) => SIMSData.termLabel(termById(id));
  const officialIn = (termId) => SIMSData.officialGrades().filter((g) => g.termId === termId && studentOk(g.studentNo));
  const fmtPct = (n) => (n == null ? '—' : n.toFixed(1) + '%');
  const roster = () => (staff() && staff().classRoster ? staff().classRoster() : []);
  const BANDS = [['1.00–1.50', (g) => g <= 1.5], ['1.75–2.25', (g) => g > 1.5 && g <= 2.25], ['2.50–3.00', (g) => g > 2.25 && g <= 3], ['5.00', (g) => g > 3]];

  function studentDoc(no, termId) {
    const r = SIMSData.recordFor(no), x = regStudent(no) || { name: r.name || no, program: '', year: '' };
    const terms = termId ? r.terms.filter((t) => t.term.id === termId) : r.terms;
    return { r, x, terms };
  }

  const REP = {
    master: { name: 'Student Master List', desc: 'Student number, name, program, year level and status.', filters: ['program', 'year', 'status'],
      build: () => ({ cols: ['Student No', 'Name', 'Program', 'Year', 'Status', 'Admission'], rows: filtStudents().map((x) => [x.no, x.name, x.program, x.year, x.status, x.admission]) }) },
    status: { name: 'Student Status Report', desc: 'Active, on leave, inactive and other statuses.', filters: ['program', 'year'],
      build: () => ({ cols: ['Status', 'Students'], rows: Object.entries(filtStudents().reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {})) }) },
    admission: { name: 'Student Admission Report', desc: 'Applications, admission type and decision status.', filters: [],
      build: () => ({ cols: ['App. No.', 'Program', 'Type', 'Term', 'Status'], rows: adm().applications.map((a) => [a.id, a.program, a.type, a.term, a.status]) }) },
    enroll: { name: 'Enrollment Summary', desc: 'Term enrollments by program, year level and term.', filters: ['program', 'year'],
      build: () => {
        const g = {};
        reg().enrollments.filter((e) => (rp.program === ALL || e.program === rp.program) && (rp.year === ALL || e.year === rp.year)).forEach((e) => {
          const k = [e.program, e.year, e.term].join('|'); g[k] = g[k] || { Pending: 0, Verified: 0, Enrolled: 0 }; g[k][e.status] = (g[k][e.status] || 0) + 1;
        });
        return { cols: ['Program', 'Year level', 'Term', 'Pending', 'Verified', 'Enrolled', 'Total'], rows: Object.entries(g).map(([k, v]) => [...k.split('|'), v.Pending, v.Verified, v.Enrolled, v.Pending + v.Verified + v.Enrolled]) };
      } },
    classlist: { name: 'Student Class List', desc: 'Students in each class offering with section and faculty.', filters: ['program', 'year', 'status'],
      build: () => ({ cols: ['Course', 'Section', 'Faculty', 'Student No', 'Name'], rows: roster().flatMap((c) => c.students.filter((x) => studentOk(x.sn)).map((x) => [c.code + ' · ' + c.title, c.section, c.faculty, x.sn, x.name])) }) },
    reportcard: { name: 'Student Report Card', desc: 'One student’s posted grades, units, GWA and standing for a term.', filters: ['student', 'term'], doc: true,
      build: () => {
        const { r, x, terms } = studentDoc(rp.student, rp.term || (SIMSData.recordFor(rp.student).terms.slice(-1)[0] || { term: {} }).term.id);
        const t = terms[0];
        return { cols: ['Course code', 'Course title', 'Units', 'Final grade', 'Remarks'], rows: t ? t.subjects.map((g) => [g.code, g.title, g.units.toFixed(1), g.status === 'inc' ? 'INC' : f2(g.grade), g.status]) : [],
          head: [['Student', `${x.name} (${rp.student})`], ['Program', `${x.program} · ${x.year} Year`], ['Term', t ? SIMSData.termLabel(t.term) : 'No posted grades']],
          foot: t ? [['Term GWA', f2(t.gwa)], ['Academic standing', t.standing]] : [], empty: r.terms.length ? 'No posted grades for this term.' : 'This student has no posted grades yet.' };
      } },
    tor: { name: 'Official Transcript of Records', desc: 'Approved academic history: every posted course, units, grades and standing.', filters: ['student'], doc: true,
      build: () => {
        const { r, x, terms } = studentDoc(rp.student);
        return { cols: ['Term', 'Course code', 'Course title', 'Units', 'Final grade', 'Remarks'],
          rows: terms.flatMap((t) => t.subjects.map((g) => [SIMSData.termLabel(t.term), g.code, g.title, g.units.toFixed(1), g.status === 'inc' ? 'INC' : f2(g.grade), g.status])
            .concat([['', '', `Term GWA ${f2(t.gwa)} · ${t.standing}`, '', '', '']])),
          head: [['Student', `${x.name} (${rp.student})`], ['Program', `${x.program} · ${x.year} Year`], ['Status', x.status || '—']],
          foot: [['Cumulative GWA', f2(r.cumulative)], ['Units earned', r.unitsEarned.toFixed(1)], ['Units failed', r.unitsFailed.toFixed(1)], ['Incomplete (INC)', r.inc]],
          empty: 'This student has no posted grades yet.' };
      } },
    perf: { name: 'Academic Performance Report', desc: 'Grade distribution, average grade and pass rate per course (posted grades).', filters: ['term', 'program', 'year'],
      build: () => {
        const by = {};
        officialIn(rp.term).forEach((g) => { (by[g.code] = by[g.code] || { title: g.title, gs: [] }).gs.push(g.grade); });
        return { cols: ['Course', 'Title', 'Graded', 'Average', 'Highest', 'Lowest', 'Passed', 'Failed', 'Pass rate', ...BANDS.map((b) => b[0])],
          rows: Object.entries(by).map(([code, v]) => { const gs = v.gs.filter((g) => typeof g === 'number'), pass = gs.filter((g) => g <= SIMSData.rules().passingGrade).length;
            return [code, v.title, gs.length, gs.length ? f2(gs.reduce((a, b) => a + b, 0) / gs.length) : '—', gs.length ? f2(Math.min(...gs)) : '—', gs.length ? f2(Math.max(...gs)) : '—', pass, gs.length - pass, gs.length ? fmtPct((pass / gs.length) * 100) : '—', ...BANDS.map((b) => gs.filter(b[1]).length)]; }) };
      } },
    standing: { name: 'Academic Standing Report', desc: 'Students classified by term GWA and the school’s standing rules (posted grades).', filters: ['term', 'program', 'year', 'status'],
      build: () => {
        const by = {};
        officialIn(rp.term).forEach((g) => { (by[g.studentNo] = by[g.studentNo] || { name: g.name, subjects: [] }).subjects.push({ ...g, finalGrade: g.grade }); });
        return { cols: ['Student No', 'Name', 'Program', 'Courses posted', 'Units', 'Term GWA', 'Standing'],
          rows: Object.entries(by).map(([no, v]) => { const gwa = SIMSData.gwa(v.subjects), x = regStudent(no) || {};
            return [no, x.name || v.name, x.program || '—', v.subjects.length, v.subjects.reduce((n, g) => n + g.units, 0).toFixed(1), f2(gwa), SIMSData.standing(gwa, v.subjects)]; })
            .sort((a, b) => (a[5] === '—') - (b[5] === '—') || Number(a[5]) - Number(b[5])) };
      } },
    completion: { name: 'Course Completion Report', desc: 'Completed, failed, incomplete and outstanding courses per student.', filters: ['program', 'year', 'status'],
      build: () => {
        const cur = SIMSData.currentTerm().id, rows = [];
        filtStudents().forEach((x) => {
          const r = SIMSData.recordFor(x.no), all = r.terms.flatMap((t) => t.subjects);
          const outstanding = x.no === DEMO_STUDENT ? SIMSData.subjectsIn(cur).filter(SIMSData.isOpen).length
            : roster().filter((c) => c.status !== 'Posted' && c.students.some((y) => y.sn === x.no)).length;
          if (!all.length && !outstanding) return;
          rows.push([x.no, x.name, x.program, all.filter((g) => g.status === 'passed').length, r.unitsEarned.toFixed(1), all.filter((g) => g.status === 'failed').length, r.inc, outstanding]);
        });
        return { cols: ['Student No', 'Name', 'Program', 'Courses completed', 'Units earned', 'Courses failed', 'Incomplete (INC)', 'Outstanding (in progress)'], rows };
      } },
    att: { name: 'Class Attendance Report', desc: 'Meetings held, absences, late arrivals and attendance rate per class.', filters: [],
      build: () => ({ cols: ['Course', 'Section', 'Faculty', 'Meetings held', 'Absences', 'Late', 'Attendance %'], rows: (staff() ? staff().attendanceSummary() : []).map((r) => [r.code + ' · ' + r.title, r.section, r.faculty, r.held, r.absent, r.late, fmtPct(r.rate)]) }) },
    absence: { name: 'Student Absence Report', desc: 'Students with accumulated absences, flagged against the alert limit.', filters: ['program', 'year', 'status'], build: () => attFlag('absent') },
    tardy: { name: 'Tardiness Report', desc: 'Students with repeated late arrivals, flagged against the alert limit.', filters: ['program', 'year', 'status'], build: () => attFlag('late') }
  };
  const REP_GROUPS = [['Student Reports', ['master', 'status', 'admission']], ['Enrollment Reports', ['enroll', 'classlist']],
    ['Academic Reports', ['reportcard', 'tor', 'perf', 'standing', 'completion']], ['Attendance Reports', ['att', 'absence', 'tardy']]];

  function attFlag(kind) {
    const cfg = staff() && staff().alertConfig ? staff().alertConfig() : { maxAbsences: 3, tardiness: 3 };
    const limit = kind === 'absent' ? cfg.maxAbsences : cfg.tardiness;
    const rows = (staff() && staff().attendanceRows ? staff().attendanceRows() : []).filter((r) => (kind === 'absent' ? r.absent : r.late) > 0 && studentOk(r.sn))
      .map((r) => { const n = kind === 'absent' ? r.absent : r.late, cnt = r.held - r.excused; return [r.sn, r.name, r.code, r.section, n, r.held, fmtPct(cnt ? ((r.held - r.absent - r.excused) / cnt) * 100 : null), n >= limit ? 'Over limit' : 'Watch']; })
      .sort((a, b) => b[4] - a[4]);
    return { cols: ['Student No', 'Name', 'Course', 'Section', kind === 'absent' ? 'Absences' : 'Late arrivals', 'Sessions', 'Attendance %', `Flag (limit ${limit})`], rows };
  }

  function filterBar(def) {
    const d = reg(), sel = (id, label, list, cur) => `<label>${label}<select id="${id}">${list.map(([v, t]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const uniq = (k) => [...new Set(d.students.map((x) => x[k]))].sort();
    const f = {
      program: () => sel('rp_program', 'Program', [[ALL, 'All programs'], ...uniq('program').map((x) => [x, x])], rp.program),
      year: () => sel('rp_year', 'Year level', [[ALL, 'All year levels'], ...uniq('year').map((x) => [x, x + ' Year'])], rp.year),
      status: () => sel('rp_status', 'Student status', [[ALL, 'All statuses'], ...uniq('status').map((x) => [x, x])], rp.status),
      term: () => sel('rp_term', 'Term', SIMSData.terms().slice().reverse().map((t) => [t.id, SIMSData.termLabel(t)]), rp.term),
      student: () => sel('rp_student', 'Student', d.students.map((x) => [x.no, `${x.name} (${x.no})`]), rp.student)
    };
    return def.filters.length ? `<div class="rp-filters">${def.filters.map((k) => f[k]()).join('')}</div>` : '<p class="ad-note">This report has no filters.</p>';
  }

  function previewHtml() {
    const r = rp.result; if (!r) return '<p class="ad-note">Choose the filters, then click Generate to preview the report.</p>';
    const kv = (rows) => rows.length ? `<dl class="rp-kv">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '';
    return `<div class="rp-paper"><div class="rp-paper-head"><strong>BITS-SIMS</strong><span>${esc(r.title)}</span><small>${esc(r.sub)}</small></div>
      ${kv(r.head || [])}${r.rows.length ? table(r.cols, r.rows) : `<p class="ad-note">${esc(r.empty || 'No records match these filters.')}</p>`}${kv(r.foot || [])}
      <p class="rp-stamp">Generated ${esc(r.ts)} by ${esc(acct.name)} · ${r.rows.length} record(s) · System-generated from official records</p></div>`;
  }

  pages.reports = () => {
    const def = REP[rp.id];
    if (!rp.term) rp.term = SIMSData.currentTerm().id;
    return `<h1>Reports &amp; Analytics Generation</h1><p class="ad-sub">Generate, preview, print and export reports within your access scope. Reports read the official records; they never keep their own copy.</p>
      <div class="rp-layout"><nav class="rp-cats">${REP_GROUPS.map(([g, ids]) => `<h4>${esc(g)}</h4>${ids.map((id) => `<button class="rp-item ${id === rp.id ? 'on' : ''}" data-x="rp-pick" data-v="${id}">${esc(REP[id].name)}</button>`).join('')}`).join('')}</nav>
      <section class="rp-main"><h3>${esc(def.name)}</h3><p class="ad-note">${esc(def.desc)}</p>${filterBar(def)}
        <div class="rp-actions"><button class="ad-btn" data-x="rp-gen">Generate</button>${rp.result ? ' <button class="ad-btn alt" data-x="rp-csv">Export CSV</button> <button class="ad-btn alt" data-x="rp-print">Print / Save as PDF</button>' : ''}</div>
        <div id="rpPreview">${previewHtml()}</div></section></div>`;
  };

  function readFilters() {
    ['program', 'year', 'status', 'term', 'student'].forEach((k) => { const el = $('#rp_' + k); if (el) rp[k] = el.value; });
  }

  function reportAction(a, v) {
    if (a === 'rp-pick') { readFilters(); rp.id = v; rp.result = null; return true; }
    if (a === 'rp-open') { rp.id = v; rp.result = null; if (page === 'profile' && viewNo && regStudent(viewNo)) rp.student = viewNo; page = 'reports'; return true; }
    const def = REP[rp.id];
    if (a === 'rp-gen') {
      readFilters();
      const out = def.build();
      const sub = def.filters.filter((k) => k !== 'student').map((k) => ({ program: rp.program === ALL ? '' : rp.program, year: rp.year === ALL ? '' : rp.year + ' Year', status: rp.status === ALL ? '' : rp.status, term: def.doc ? '' : termName(rp.term) }[k])).filter(Boolean).join(' · ');
      rp.result = { ...out, title: def.name, sub: sub || (def.doc ? '' : 'All records'), ts: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) };
      log(`Generated ${def.name} (${out.rows.length} records)`, 'Reports', 'GeneratedReports', rp.id, 'EXPORT');
      if (staff() && staff().logReport) staff().logReport(def.name, acct.username, out.rows.length);
      return true;
    }
    if (a === 'rp-csv' && rp.result) {
      const r = rp.result, lines = [[r.title, r.sub], ...(r.head || []), [], r.cols, ...r.rows, [], ...(r.foot || [])];
      const csv = lines.map((row) => row.map((x) => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')).join('\n');
      const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); l.download = `${r.title}.csv`; l.click();
      log(`Exported ${r.title} to CSV`, 'Reports', 'GeneratedReports', rp.id, 'EXPORT');
      return false;
    }
    if (a === 'rp-print' && rp.result) {
      document.body.classList.add('rp-printing');
      const done = () => { document.body.classList.remove('rp-printing'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      setTimeout(() => { window.print(); setTimeout(done, 1000); }, 50);
      log(`Printed ${rp.result.title}`, 'Reports', 'GeneratedReports', rp.id, 'EXPORT');
      return false;
    }
    return false;
  }

  /* ---- Document Management ---- */
  pages.documents = () => {
    const d = docs(), stu = reg().students.find((x) => x.no === DEMO_STUDENT);
    const who = stu ? `${esc(stu.name)}<br><small>${esc(stu.no)}</small>` : '\u2014';
    const rows = d.requirements.map((r) => `<tr><td>${who}</td><td>${esc(r.name)}${r.file ? `<br><small>${esc(r.file.name)}</small>` : ''}</td><td>${badge(r.status === 'verified' ? 'ok' : r.status === 'review' ? 'info' : r.status === 'rejected' ? 'risk' : 'warn', cap(r.status))}</td><td>${esc(fmtDay(r.updated))}</td>
      <td>${r.status === 'review' ? `<a data-doc="verified" data-id="${esc(r.id)}">Verify</a> <a data-doc="rejected" data-id="${esc(r.id)}">Reject</a>` : ''}</td></tr>`).join('');
    const req = Object.keys(d.requests).map((id) => `<li>${esc(DOC_REQ[id] || id)} <small>\u00B7 ${stu ? esc(fullName(stu.name)) + ' \u00B7 ' : ''}requested ${esc(fmtDay(d.requests[id]))}</small> ${id === 'tor' ? '<a data-x="rp-open" data-v="tor">Generate TOR</a> ' : ''}<a data-rel="${esc(id)}">Mark released</a></li>`).join('');
    return `<h1>Document Management</h1><p class="ad-sub">Verify submitted requirements and release requested documents.</p><h3>Verification queue</h3>
      <table class="ad-table"><tr><th>Student</th><th>Document</th><th>Status</th><th>Updated</th><th>Action</th></tr>${rows || '<tr><td colspan="5">Nothing to verify.</td></tr>'}</table>
      <h3>Official document requests</h3><ul class="ad-list">${req || '<li>No pending requests.</li>'}</ul>`;
  };

  /* ---- Activity Log (audit trails: restricted to the Registrar's own activity) ---- */
  pages.activity = () => {
    const l = staff() ? staff().auditFor(acct.username, 60) : [];
    return `<h1>Activity Log</h1><p class="ad-sub">Your own recent activity. Full audit trails are available to ICT Services.</p>
      ${table(['Time', 'Module', 'Action', 'Description'], l.map((x) => [fmtStamp(x.ts), x.mod, x.act, x.desc]))}
      <p class="ad-note">Entries are append-only and never store passwords.</p>`;
  };

  /* ---- My Account (same as the staff portal: profile is managed by ICT) ---- */
  const pwBox = (id, ac) => `<div class="pw-wrap"><input id="${id}" type="password" autocomplete="${ac}" /><button type="button" class="pw-toggle" data-x="pwtoggle" data-v="${id}" aria-pressed="false" aria-label="Show password">Show</button></div>`;
  pages.settings = () => `<div class="staff-panel"><div class="dm-head"><h1>My Account</h1><p class="ad-sub">Your staff profile is managed by ICT Services. You can change your own password here.</p></div>
      <div class="staff-split staff-split-even">
        <div class="dash-card dm-card staff-card"><div class="staff-identity"><div class="staff-big-avatar">${esc(initials(acct.name))}</div><h3>${esc(acct.name)}</h3><p class="dm-modal-note">${esc(acct.title)}</p></div>
          <dl class="set-info">
            <div><dt>Role</dt><dd>Registrar</dd></div><div><dt>Employee no.</dt><dd>${esc(acct.employeeNo)}</dd></div>
            <div><dt>Office</dt><dd>${esc(acct.dept)}</dd></div><div><dt>Work email</dt><dd>${esc(acct.email)}</dd></div>
            <div><dt>Contact</dt><dd>${esc(acct.contact)}</dd></div><div><dt>Date hired</dt><dd>${esc(fmtDay(acct.hired))}</dd></div>
          </dl></div>
        <form id="rgPwForm" class="dash-card dm-card staff-card staff-form" novalidate>
          <h3 class="adm-sec-title">Change password</h3>
          <div class="set-field"><label for="p_cur">Current password</label>${pwBox('p_cur', 'current-password')}</div>
          <div class="set-field"><label for="p_new">New password</label>${pwBox('p_new', 'new-password')}<small class="set-hint">At least ${SIMSAuth.policy().minPw} characters with upper and lower case letters, a number and a symbol.</small></div>
          <div class="set-field"><label for="p_con">Confirm new password</label>${pwBox('p_con', 'new-password')}</div>
          <small class="set-error" id="p_err" role="alert"></small>
          <div class="set-actions"><button type="button" class="btn-solid" data-x="savepw">Update password</button></div>
        </form>
      </div></div>`;

  /* =====================================================
     SHELL
  ===================================================== */
  const NAV = [['home', 'Home'], ['students', 'Student Profiles'], ['admissions', 'Admissions & Enrollment'], ['attendance', 'Attendance'], ['records', 'Academic Records'], ['reports', 'Reports & Analytics Generation'], ['documents', 'Document Management'], ['activity', 'Activity Log'], ['settings', 'My Account']];
  // Sub-pages highlight their parent in the sidebar
  const PARENT = { register: 'students', profile: 'students', corrections: 'students' };

  const ICON = { activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>' };
  const icon = (k) => {
    const src = { home: 'home', students: 'profile', admissions: 'admissions', attendance: 'attendance', records: 'records', reports: 'reports', documents: 'documents', settings: 'settings' }[k];
    const el = src && document.querySelector(`.sidebar-item[data-page="${src}"] svg`);
    if (el) return el.outerHTML;
    if (k === 'logout') { const lo = document.querySelector('#logoutBtn svg'); if (lo) return lo.outerHTML; }
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;
  };

  function render() {
    const root = $('#registrarView');
    const cur = NAV.find((n) => n[0] === page) || NAV.find((n) => n[0] === (PARENT[page] || 'home'));
    const logo = document.querySelector('.nav-logo');
    root.innerHTML = `<header class="top-nav"><div class="nav-brand">${logo ? `<img class="nav-logo" src="${esc(logo.getAttribute('src'))}" alt="">` : ''}<span class="nav-title">BITS-SIMS</span><span class="staff-role-chip">Registrar Portal</span></div>
      <div class="nav-user-area"><span class="nav-page-label">${esc(cur[1])}</span><span class="nav-divider"></span><span class="ad-ra" title="${esc(acct.name)}">${esc(initials(acct.name))}</span></div></header>
      <div class="app-layout"><nav class="sidebar"><ul class="sidebar-menu">${NAV.map((n) => `<li><a href="#" class="sidebar-item ${n[0] === cur[0] ? 'active' : ''}" data-go="${n[0]}">${icon(n[0])}<span>${esc(n[1])}</span></a></li>`).join('')}
      <li><a href="#" class="sidebar-item logout-link" data-go="logout">${icon('logout')}<span>Log Out</span></a></li></ul></nav>
      <main class="dashboard-main"><div class="dashboard-panel ad-body">${pages[page]()}</div></main></div>`;
    root.querySelectorAll('.ad-table').forEach((t) => { if (!t.parentElement.classList.contains('ad-tw')) { const w = document.createElement('div'); w.className = 'ad-tw'; t.replaceWith(w); w.appendChild(t); } });
  }
  const go = (p) => { page = p; sel = null; render(); };

  /* =====================================================
     ACTIONS
  ===================================================== */
  function act(t) {
    const d = t.dataset;
    if (d.go) { if (d.go === 'logout') return close(); return go(d.go); }
    if (d.sel) { sel = d.sel; return render(); }

    if (d.cor) {                               // approve / reject a profile correction
      const all = corrections(), x = all.find((c) => c.id === d.id);
      const remarks = ($('#adRemarks') || {}).value || '';
      if (d.cor === 'rejected' && !remarks.trim()) return toast('Add review remarks before rejecting.', 'error');
      x.status = d.cor; x.remarks = remarks; x.reviewedBy = acct.username; x.reviewed = today();
      if (x.status === 'approved') { const p = rd(K.prof, {}); p[x.field] = x.next; wr(K.prof, p); }
      wr(K.cor, all); log(`Profile correction ${x.status}: ${x.label} for ${x.student}`, 'Profile Management', 'ProfileCorrectionRequests', x.id, x.status === 'approved' ? 'APPROVE' : 'UPDATE');
      toast(`Correction ${x.status}.`, x.status === 'approved' ? 'success' : 'info');
    } else if (d.app) {                        // admission decision
      const reason = d.app === 'rejected' ? prompt('Reason for rejection (shown to the applicant):') : '';
      if (reason === null) return;
      const decide = (a) => {
        a.status = d.app; a.verified = a.verified || today(); a.verifiedTime = a.verifiedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (a.status !== 'review') { a.decision = today(); a.remarks = reason || (a.status === 'accepted' ? 'Congratulations on your admission. Please continue to enrollment.' : ''); }
        log(`Application ${a.id} set to ${cap(a.status)}`, 'Registration', 'AdmissionApplications', a.id, a.status === 'review' ? 'UPDATE' : 'APPROVE');
        toast(`${a.id}: ${cap(a.status)}.`);
      };
      const ap = adm(), mine = ap.applications.find((i) => i.id === d.id);
      if (mine) { decide(mine); wr(K.adm, ap); }
      else { const rg = reg(), x = (rg.applicants || []).find((i) => i.id === d.id); if (!x) return; decide(x); saveReg(rg); }
    } else if (d.doc) {                        // verify / reject an uploaded requirement
      const dc = docs(), r = dc.requirements.find((i) => i.id === d.id);
      let note = '';
      if (d.doc === 'rejected') { note = prompt('Reason for rejection (shown to the student):'); if (note === null) return; }
      Object.assign(r, { status: d.doc, note, updated: today() });
      wr(K.docs, dc); log(`Document ${r.name} ${r.status}`, 'Documents', 'StudentDocuments', r.id, 'APPROVE'); toast(`${r.name} ${r.status}.`, r.status === 'verified' ? 'success' : 'info');
    } else if (d.rel) {                        // official document request released
      const dc = docs(); delete dc.requests[d.rel]; wr(K.docs, dc); log(`${DOC_REQ[d.rel]} released`, 'Documents', 'StudentDocuments', d.rel, 'EXPORT'); toast(`${DOC_REQ[d.rel]} marked released.`);
    } else if (d.x) {
      if (!doX(d.x, d.v)) return;
    } else return;
    render();
  }

  // Actions that use data-x / data-v. Returns false when it handled everything itself (no re-render needed).
  function doX(a, v) {
    const d = reg();
    if (a === 'filter') fl = { q: val('fq'), st: val('fs') };
    else if (a === 'newstu') { go('register'); return false; }
    else if (a === 'view') { viewNo = v; tab = 'Overview'; go('profile'); return false; }
    else if (a === 'tab') tab = v;
    else if (a === 'rtab') rtab = v;
    else if (a === 'stab') stab = v;
    else if (a === 'mtab') mtab = v;
    else if (a === 'archive' || a === 'restore') {
      const s = d.students.find((x) => x.no === v); if (!s) return false;
      const doIt = () => {
        const rg = reg(), st = rg.students.find((x) => x.no === v), before = st.status;
        if (a === 'archive') { st.prevStatus = st.status; st.status = 'Archived'; } else { st.status = st.prevStatus || 'Active'; delete st.prevStatus; }
        saveReg(rg); log(`Student ${v} ${st.status === 'Archived' ? 'archived' : 'restored'}`, 'Registration', 'Students', v, 'UPDATE');
        render(); toast(`${fullName(st.name)} ${a === 'archive' ? 'archived' : 'restored (' + st.status + ')'}.`, a === 'archive' ? 'info' : 'success');
        void before;
      };
      if (a === 'archive') ask('Archive student?', `${fullName(s.name)} (${s.no}) will be marked Archived. The record is kept and can be restored.`, 'Archive', doIt, true);
      else doIt();
      return false;
    } else if (a === 'savestu') {
      if (!val('f_first').trim() || !val('f_last').trim()) { toast('First and last name are required.', 'error'); return false; }
      const no = '2026-' + String(d.students.filter((s) => s.no.startsWith('2026-')).length + 1).padStart(4, '0');
      const name = `${val('f_last').trim()}, ${val('f_first').trim()}${val('f_middle').trim() ? ' ' + val('f_middle').trim() : ''}`;
      d.students.push({ no, name, program: val('f_program'), year: val('f_year'), status: 'Active', dept: val('f_dept'), admission: val('f_admission'), email: val('f_email'), mobile: val('f_mobile'), city: val('f_city'), dob: val('f_dob'), gname: val('f_gname'), gnum: val('f_gnum'), ename: val('f_ename'), enum: val('f_enum') });
      d.enrollments.push({ ref: 'ENR-' + String(d.enrollments.length + 1).padStart(4, '0'), student: name, no, term: SIMSData.termLabel(SIMSData.currentTerm()), program: val('f_program'), year: val('f_year'), units: '\u2014', status: 'Pending' });
      saveReg(d); log(`Registered student ${no}`, 'Registration', 'Students', no, 'CREATE'); fl = { q: '', st: '' }; go('students'); toast('Student registered: ' + no); return false;
    } else if (a === 'enr') {
      const e = d.enrollments.find((x) => x.ref === v); if (!e) return false;
      e.status = e.status === 'Pending' ? 'Verified' : 'Enrolled'; saveReg(d);
      log(`Enrollment ${e.ref} ${e.status.toLowerCase()}`, 'Enrollment', 'StudentEnrollments', e.ref, e.status === 'Enrolled' ? 'APPROVE' : 'UPDATE'); toast(`${e.ref} ${e.status.toLowerCase()}.`);
    } else if (a === 'sheet-post' || a === 'sheet-return') {
      const g = sheets()[Number(v)]; if (!g || g.status !== 'Approved') return false;
      let note = '';
      if (a === 'sheet-return') { note = prompt('Reason for returning the grades to the faculty:'); if (note === null) return false; if (!note.trim()) { toast('A reason is required.', 'error'); return false; } }
      staff().setGradeStatus(g.classId, g.period, a === 'sheet-post' ? 'Posted' : 'Returned', acct.username, note);
      toast(a === 'sheet-post' ? `${g.code} grades posted.` : `${g.code} grades returned to the faculty.`, a === 'sheet-post' ? 'success' : 'info');
    } else if (a === 'gc-apply' || a === 'gc-reject') {
      const x = gradeCorrections().find((y) => y.id === v); if (!x) return false;
      let note = '';
      const decide = () => {
        const r = staff().decideCorrection(v, a === 'gc-apply' ? 'apply' : 'reject', acct.username, note);
        if (!r.ok) { toast(r.message, 'error'); return; }
        render(); toast(a === 'gc-apply' ? `Correction ${x.id} applied.` : `Correction ${x.id} rejected.`, a === 'gc-apply' ? 'success' : 'info');
      };
      if (a === 'gc-reject') { note = prompt('Reason for rejecting the correction (shown to the faculty):'); if (note === null) return false; if (!note.trim()) { toast('A reason is required.', 'error'); return false; } decide(); return false; }
      ask('Apply correction?', `${x.name}'s ${x.code} grade changes from ${gradeTxt(x.from)} to ${gradeTxt(x.to)}.`, 'Apply correction', decide);
      return false;
    } else if (a.startsWith('rp-')) {
      return reportAction(a, v);
    } else if (a === 'pwtoggle') {
      const inp = $('#' + v), btn = document.querySelector(`[data-x="pwtoggle"][data-v="${v}"]`); if (!inp) return false;
      const show = inp.type === 'password'; inp.type = show ? 'text' : 'password';
      if (btn) { btn.textContent = show ? 'Hide' : 'Show'; btn.setAttribute('aria-pressed', String(show)); btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); }
      return false;
    } else if (a === 'savepw') {
      const n = val('p_new'), problem = SIMSAuth.passwordProblem(n), err = (m) => { $('#p_err').textContent = m; return false; };
      if (!val('p_cur')) return err('Enter your current password.');
      if (!SIMSAuth.verify(acct, val('p_cur'))) return err('Current password is incorrect.');
      if (problem) return err(problem);
      if (n !== val('p_con')) return err('Passwords do not match.');
      SIMSAuth.setPassword(acct.username, n); log('Changed own password', 'Authentication', 'Users', acct.username, 'UPDATE');
      $('#rgPwForm').reset(); $('#p_err').textContent = ''; toast('Password updated.'); return false;
    } else return false;
    return true;
  }

  /* =====================================================
     LOGIN HOOKS
  ===================================================== */
  const find = (id) => { const a = window.SIMSAccounts && SIMSAccounts.find(id); return a && a.role === 'REGISTRAR' ? a : null; };

  function authenticate(username, password) {
    const a = find(username);
    if (!a) return { ok: false, message: 'Incorrect username or password.' };
    const r = SIMSAuth.check(a, password);   // lockout + generic errors live in auth.js
    return r.ok ? { ok: true, account: a } : r;
  }

  function bind(root) {
    if (root.dataset.bound) return;
    root.dataset.bound = 1;
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-go],[data-sel],[data-cor],[data-app],[data-doc],[data-rel],[data-x]');
      if (!t || !root.contains(t)) return;
      e.preventDefault(); act(t);
    });
  }

  function open(account) {
    acct = account; page = 'home'; sel = null; fl = { q: '', st: '' }; tab = 'Overview'; rtab = 'Student Records'; mtab = 'Applications';
    const root = $('#registrarView'); root.classList.remove('hidden'); bind(root); ensureChrome();
    log('Successful login', 'Authentication', 'Users', acct.username, 'LOGIN');
    SIMSAuth.watchIdle(close);
    render();
  }

  function close() {
    if (!acct) return;
    SIMSAuth.stopIdle();
    log('Signed out', 'Authentication', 'Users', acct.username, 'LOGOUT');
    acct = null;
    const root = $('#registrarView'); root.classList.add('hidden'); root.innerHTML = '';
    const form = $('#loginForm'); if (form) form.reset();
    const lv = $('#loginView'); if (lv) lv.classList.remove('hidden');
  }

  window.SIMSRegistrar = { isRegistrar: (u) => Boolean(find(u)), authenticate, open, close };
})();
