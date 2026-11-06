/* =====================================================
   BITS-SIMS REGISTRAR / ADMIN PORTAL
   -----------------------------------------------------
   Reads and writes the SAME localStorage stores as the
   student portal, so every student action lands here and
   every admin decision shows up for the student:

   bits-sims-corrections  student name-change requests  -> Profile Corrections
   bits-sims-documents    uploads + COR/COE/TOR requests -> Document Management
   bits-sims-admissions   applications                   -> Admissions & Enrollment
   bits-sims-academic     grades (via SIMSData)          -> Grade Approval
   bits-sims-profile      official profile (applied on approval)
   bits-sims-audit        append-only admin activity log

   Log in with a username starting with "registrar" or "admin"
   (any password) to open this side. Anything else = student.
===================================================== */
(function () {
  const K = { docs: 'bits-sims-documents', adm: 'bits-sims-admissions', cor: 'bits-sims-corrections', prof: 'bits-sims-profile', aud: 'bits-sims-audit' };
  const rd = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const $ = (s) => document.querySelector(s);
  const badge = (cls, t) => `<span class="dm-status ${cls}">${esc(t)}</span>`;

  let user = 'registrar01', page = 'home', sel = null;

  const log = (a) => { const l = rd(K.aud, []); l.unshift({ t: new Date().toLocaleString(), u: user, a }); wr(K.aud, l.slice(0, 60)); };
  const periods = () => SIMSData.rules().gradingPeriods.map((p) => p.key).concat('final');

  /* ---------- Queries ---------- */
  const corrections = () => rd(K.cor, []);
  const docs = () => rd(K.docs, { requirements: [], requests: {} });
  const adm = () => rd(K.adm, { applications: [] });
  function gradeQueue() {
    const out = [];
    SIMSData.get().subjects.forEach((s) => periods().forEach((k) => {
      const st = s.gradeStatus && s.gradeStatus[k];
      if (st === 'submitted' || st === 'approved') out.push({ s, k, st, v: k === 'final' ? s.finalGrade : s.grades[k] });
    }));
    return out;
  }
  const DOC_REQ = { cor: 'Certificate of Registration', coe: 'Certificate of Enrollment', tor: 'Transcript of Records' };

  /* ---------- Pages ---------- */
  const pages = {
    home() {
      const c = corrections().filter((x) => x.status === 'pending').length;
      const d = docs();
      const q = [
        ['Applications awaiting decision', adm().applications.filter((a) => a.status === 'pending' || a.status === 'review').length, 'admissions'],
        ['Profile correction requests', c, 'corrections'],
        ['Documents awaiting verification', d.requirements.filter((r) => r.status === 'review').length, 'documents'],
        ['Official document requests', Object.keys(d.requests).length, 'documents'],
        ['Grade submissions awaiting approval', gradeQueue().length, 'grades']
      ];
      const a = rd(K.aud, []).slice(0, 5);
      return `<h1>Registrar Dashboard</h1>
        <div class="ad-cards">${q.map((r) => `<button class="ad-card" data-go="${r[2]}"><small>${esc(r[0])}</small><b>${r[1]}</b></button>`).join('')}</div>
        <h3>Recent Activities</h3>
        <ul class="ad-list">${a.length ? a.map((x) => `<li>${esc(x.a)} <small>· ${esc(x.u)} · ${esc(x.t)}</small></li>`).join('') : '<li>No activity yet.</li>'}</ul>`;
    },

    corrections() {
      const all = corrections();
      const cur = all.find((x) => x.id === sel) || all.find((x) => x.status === 'pending');
      const rows = all.map((x) => `<tr data-sel="${x.id}" class="${cur && cur.id === x.id ? 'on' : ''}"><td>${esc(x.student)}</td><td>${esc(x.label)}</td><td>${esc(x.next)}</td><td>${esc(x.date)}</td><td>${badge(x.status === 'pending' ? 'warn' : x.status === 'approved' ? 'ok' : 'risk', x.status)}</td></tr>`).join('');
      const panel = cur ? `<div class="ad-panel"><h3>Review Request</h3>
        <p><small>Field</small> <b>${esc(cur.label)}</b></p><p><small>Existing value</small> <b>${esc(cur.old)}</b></p>
        <p><small>Requested value</small> <b>${esc(cur.next)}</b></p><p><small>Reason</small> <b>${esc(cur.reason || '—')}</b></p>
        ${cur.status === 'pending' ? `<textarea id="adRemarks" placeholder="Review remarks"></textarea>
        <button class="ad-btn" data-cor="approved" data-id="${cur.id}">Approve</button> <button class="ad-btn alt" data-cor="rejected" data-id="${cur.id}">Reject</button>`
        : `<p><small>Decision</small> <b>${esc(cur.status)}</b> — ${esc(cur.remarks || 'no remarks')}</p>`}</div>` : '';
      return `<h1>Profile Correction Requests</h1><p class="ad-sub">Review name and detail changes requested by students.</p><div class="ad-split">
        <table class="ad-table"><tr><th>Student</th><th>Field</th><th>Requested</th><th>Date</th><th>Status</th></tr>${rows || '<tr><td colspan="5">No requests yet. A student name change in Account Settings appears here.</td></tr>'}</table>${panel}</div>`;
    },

    admissions() {
      const rows = adm().applications.map((a) => `<tr><td>${esc(a.id)}</td><td>${esc(a.program)}</td><td>${esc(a.type)}</td><td>${esc(a.term)}</td><td>${badge(a.status === 'accepted' ? 'ok' : a.status === 'rejected' ? 'risk' : a.status === 'review' ? 'info' : 'warn', a.status)}</td>
        <td>${a.status === 'pending' ? `<a data-app="review" data-id="${a.id}">Start review</a> ` : ''}${a.status === 'pending' || a.status === 'review' ? `<a data-app="accepted" data-id="${a.id}">Accept</a> <a data-app="rejected" data-id="${a.id}">Reject</a>` : ''}</td></tr>`).join('');
      return `<h1>Admissions &amp; Enrollment</h1><table class="ad-table"><tr><th>App. No.</th><th>Program</th><th>Type</th><th>Term</th><th>Status</th><th>Actions</th></tr>${rows}</table>
        <p class="ad-note">Decisions are shown to the applicant under Admissions &amp; Enrollment → Application Status.</p>`;
    },

    documents() {
      const d = docs();
      const rows = d.requirements.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.file ? esc(r.file.name) : '—'}</td><td>${badge(r.status === 'verified' ? 'ok' : r.status === 'review' ? 'info' : r.status === 'rejected' ? 'risk' : 'warn', r.status)}</td><td>${esc(r.updated || '—')}</td>
        <td>${r.status === 'review' ? `<a data-doc="verified" data-id="${r.id}">Verify</a> <a data-doc="rejected" data-id="${r.id}">Reject</a>` : ''}</td></tr>`).join('');
      const req = Object.keys(d.requests).map((id) => `<li>${esc(DOC_REQ[id] || id)} <small>· requested ${esc(d.requests[id])}</small> <a data-rel="${id}">Mark released</a></li>`).join('');
      return `<h1>Document Management</h1><h3>Verification queue</h3>
        <table class="ad-table"><tr><th>Document</th><th>File</th><th>Status</th><th>Updated</th><th>Action</th></tr>${rows}</table>
        <h3>Official document requests</h3><ul class="ad-list">${req || '<li>No pending requests.</li>'}</ul>`;
    },

    grades() {
      const q = gradeQueue();
      const rows = q.map((g, i) => `<tr><td>${esc(g.s.code)}</td><td>${esc(g.s.title)}</td><td>${esc(g.k)}</td><td>${g.v == null ? '—' : Number(g.v).toFixed(2)}</td><td>${badge(g.st === 'approved' ? 'info' : 'warn', g.st)}</td>
        <td><a data-gr="${i}">${g.st === 'submitted' ? 'Approve' : 'Post official'}</a></td></tr>`).join('');
      return `<h1>Grade Approval</h1><table class="ad-table"><tr><th>Code</th><th>Course</th><th>Period</th><th>Grade</th><th>Status</th><th>Action</th></tr>${rows || '<tr><td colspan="6">Nothing awaiting approval.</td></tr>'}</table>
        <p class="ad-note">Students only see grades once they are posted. Posted grades change only through a correction process.</p>`;
    },

    audit() {
      const l = rd(K.aud, []);
      return `<h1>Audit Log</h1><table class="ad-table"><tr><th>Time</th><th>User</th><th>Action</th></tr>${l.map((x) => `<tr><td>${esc(x.t)}</td><td>${esc(x.u)}</td><td>${esc(x.a)}</td></tr>`).join('') || '<tr><td colspan="3">Empty.</td></tr>'}</table>
        <p class="ad-note">Entries are append-only and never store passwords.</p>`;
    }
  };

  const NAV = [['home', 'Home'], ['corrections', 'Profile Corrections'], ['admissions', 'Admissions & Enrollment'], ['documents', 'Document Management'], ['grades', 'Grade Approval'], ['audit', 'Audit Log']];

  const ICON = { users: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', audit: '<path d="M3 12h4l3-8 4 16 3-8h4"/>' };
  const icon = (k) => {
    const src = { home: 'home', students: 'profile', admissions: 'admissions', attendance: 'attendance', records: 'records', reports: 'reports', documents: 'documents', settings: 'settings' }[k];
    const el = src && document.querySelector(`.sidebar-item[data-page="${src}"] svg`);
    if (el) return el.outerHTML;
    if (k === 'logout') return document.querySelector('#logoutBtn svg').outerHTML;
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;
  };
  function render() {
    const root = $('#adminView');
    const X = window.SIMSAdminX, cur = NAV.find((n) => n[0] === page) || NAV.find((n) => n[0] === (X.parent[page] || 'home'));
    const logo = document.querySelector('.nav-logo');
    root.innerHTML = `<header class="top-nav"><div class="nav-brand">${logo ? `<img class="nav-logo" src="${esc(logo.getAttribute('src'))}" alt="">` : ''}<span class="nav-title">BITS-SIMS</span></div>
      <div class="nav-user-area"><span class="nav-page-label">${esc(cur[0] === 'home' ? 'Dashboard' : cur[1])}</span><span class="nav-divider"></span><span class="ad-ra" title="${esc(user)}">${esc(X.initials())}</span></div></header>
      <div class="app-layout"><nav class="sidebar"><ul class="sidebar-menu">${NAV.map((n) => `<li><a href="#" class="sidebar-item ${n[0] === cur[0] ? 'active' : ''}" data-go="${n[0]}">${icon(n[0])}<span>${esc(n[1])}</span></a></li>`).join('')}
      <li><a href="#" class="sidebar-item logout-link" data-go="logout">${icon('logout')}<span>Log Out</span></a></li></ul></nav>
      <main class="dashboard-main"><div class="dashboard-panel ad-body">${pages[page]()}</div></main></div>`;
    root.querySelectorAll('.ad-table').forEach((t) => { if (!t.parentElement.classList.contains('ad-tw')) { const w = document.createElement('div'); w.className = 'ad-tw'; t.replaceWith(w); w.appendChild(t); } });
  }

  /* ---------- Actions ---------- */
  function act(t) {
    const need = window.SIMSAdminX.needs(t);
    if (need && !SIMSAuth.can(need)) { log('Access denied: ' + need); return alert('Access denied. Your role does not include ' + need + '.'); }
    const go = t.dataset.x ? null : t.closest('[data-go]');
    if (go) { if (go.dataset.go === 'logout') { SIMSAuth.logout(); return location.reload(); } page = go.dataset.go; sel = null; return render(); }
    const row = t.closest('[data-sel]');
    if (row) { sel = row.dataset.sel; return render(); }

    if (t.dataset.cor) {                       // approve / reject a profile correction
      const all = corrections(), x = all.find((c) => c.id === t.dataset.id);
      const remarks = ($('#adRemarks') || {}).value || '';
      if (t.dataset.cor === 'rejected' && !remarks.trim()) return alert('Add review remarks before rejecting.');
      x.status = t.dataset.cor; x.remarks = remarks; x.reviewedBy = user; x.reviewed = today();
      if (x.status === 'approved') { const p = rd(K.prof, {}); p[x.field] = x.next; wr(K.prof, p); }
      wr(K.cor, all); log(`Profile correction ${x.status}: ${x.label} for ${x.student}`);
    } else if (t.dataset.app) {                // admission decision
      const d = adm(), a = d.applications.find((i) => i.id === t.dataset.id);
      let remarks = '';
      if (t.dataset.app === 'rejected') { remarks = prompt('Reason for rejection (shown to the applicant):'); if (remarks === null) return; }
      a.status = t.dataset.app; a.verified = a.verified || today(); a.verifiedTime = a.verifiedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (a.status !== 'review') { a.decision = today(); a.remarks = remarks || (a.status === 'accepted' ? 'Congratulations on your admission. Please continue to enrollment.' : ''); }
      wr(K.adm, d); log(`Application ${a.id} set to ${a.status}`);
    } else if (t.dataset.doc) {                // verify / reject an uploaded requirement
      const d = docs(), r = d.requirements.find((i) => i.id === t.dataset.id);
      let note = '';
      if (t.dataset.doc === 'rejected') { note = prompt('Reason for rejection (shown to the student):'); if (note === null) return; }
      Object.assign(r, { status: t.dataset.doc, note, updated: today() });
      wr(K.docs, d); log(`Document ${r.name} ${r.status}`);
    } else if (t.dataset.rel) {                // official document request released
      const d = docs(); delete d.requests[t.dataset.rel]; wr(K.docs, d); log(`${DOC_REQ[t.dataset.rel]} released`);
    } else if (t.dataset.gr !== undefined) {   // grade workflow: submitted -> approved -> posted
      const g = gradeQueue()[Number(t.dataset.gr)], next = g.st === 'submitted' ? 'approved' : 'posted';
      SIMSData.update((d) => { d.subjects.find((s) => s.id === g.s.id).gradeStatus[g.k] = next; });
      log(`${g.s.code} ${g.k} grade ${next}`);
    } else if (!window.SIMSAdminX.act(t)) return;
    render();
  }

  window.SIMSAdminX = { pages, NAV, rd, wr, esc, badge, log, today, K, parent: {}, act: () => false, needs: () => null, initials: () => 'RA', go: (p) => { page = p; sel = null; render(); } };
  window.SIMSAdmin = {
    isAdminUser: (u) => /^(registrar|admin)/i.test(u),
    open(name) {
      user = name; page = 'home'; sel = null;
      const root = $('#adminView'); root.classList.remove('hidden');
      if (!root.dataset.bound) { root.dataset.bound = 1; root.addEventListener('click', (e) => { if (e.target.closest('a,button,tr[data-sel],[data-x]')) { e.preventDefault(); act(e.target.closest('[data-go],[data-sel],[data-cor],[data-app],[data-doc],[data-rel],[data-gr],[data-x]') || e.target); } }); }
      log('Signed in'); render();
    }
  };
})();
