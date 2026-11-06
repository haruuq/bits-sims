/* =====================================================
   BITS-SIMS MODULE 1 - User Authentication & Access Control
   -----------------------------------------------------
   Dummy data kept in localStorage ('bits-sims-auth'). Follows the
   design reference section 3: Users, Roles, Permissions,
   role->permission grants, PasswordResetRequests, lockout, MFA.

   DEMO ONLY: hashing happens in the browser. The real system must
   hash with Argon2id/bcrypt and check permissions on the SERVER.

   Demo accounts (password for all: Sims@2026)
     ict.admin (MFA code 123456) | edtech01 | dh.it | faculty.reyes
     registrar01 | dgarcia (student) | faculty.santos (must change pw)

   Console: SIMSAuth.reset() -> back to the sample accounts
===================================================== */
(function () {
  const KEY = 'bits-sims-auth', AUD = 'bits-sims-audit', REM = 'bits-sims-remember';
  const MAX_FAIL = 5, LOCK_MIN = 15, RESET_MIN = 15, DEMO_CODE = '123456', DEMO_PW = 'Sims@2026';

  const PERMS = ['STUDENT_VIEW', 'STUDENT_CREATE', 'STUDENT_EDIT', 'STUDENT_DEACTIVATE', 'STUDENT_APPROVE', 'ENROLLMENT_VIEW', 'ENROLLMENT_CREATE', 'ENROLLMENT_EDIT', 'ENROLLMENT_APPROVE', 'ATTENDANCE_VIEW', 'ATTENDANCE_ENCODE', 'ATTENDANCE_EDIT', 'GRADE_VIEW', 'GRADE_ENCODE', 'GRADE_EDIT', 'GRADE_APPROVE', 'GRADE_POST', 'REPORT_GENERATE', 'REPORT_EXPORT', 'USER_MANAGE', 'ROLE_MANAGE', 'AUDIT_VIEW', 'BACKUP_MANAGE', 'SYSTEM_CONFIGURE'];
  const ROLES = [['ICT_ADMIN', 'ICT Services'], ['EDTECH', 'Education Technology Services'], ['DEPT_HEAD', 'Department Head'], ['FACULTY', 'Faculty Member'], ['REGISTRAR', 'Registrar'], ['STUDENT', 'Student']];
  // Starting point from the access matrix (8.2). Student = self-service only, no staff permissions.
  const GRANTS = {
    ICT_ADMIN: ['STUDENT_VIEW', 'REPORT_GENERATE', 'REPORT_EXPORT', 'USER_MANAGE', 'ROLE_MANAGE', 'AUDIT_VIEW', 'BACKUP_MANAGE', 'SYSTEM_CONFIGURE'],
    EDTECH: ['AUDIT_VIEW', 'REPORT_GENERATE', 'SYSTEM_CONFIGURE'],
    DEPT_HEAD: ['STUDENT_VIEW', 'ENROLLMENT_VIEW', 'ENROLLMENT_EDIT', 'ATTENDANCE_VIEW', 'GRADE_VIEW', 'GRADE_APPROVE', 'REPORT_GENERATE'],
    FACULTY: ['STUDENT_VIEW', 'ENROLLMENT_VIEW', 'ATTENDANCE_VIEW', 'ATTENDANCE_ENCODE', 'ATTENDANCE_EDIT', 'GRADE_VIEW', 'GRADE_ENCODE', 'REPORT_GENERATE'],
    REGISTRAR: ['STUDENT_VIEW', 'STUDENT_CREATE', 'STUDENT_EDIT', 'STUDENT_DEACTIVATE', 'STUDENT_APPROVE', 'ENROLLMENT_VIEW', 'ENROLLMENT_CREATE', 'ENROLLMENT_EDIT', 'ENROLLMENT_APPROVE', 'ATTENDANCE_VIEW', 'GRADE_VIEW', 'GRADE_APPROVE', 'GRADE_POST', 'REPORT_GENERATE', 'REPORT_EXPORT', 'AUDIT_VIEW'],
    STUDENT: []
  };

  const mkUser = (id, username, name, role, extra) => Object.assign({ id, username, name, role, email: username + '@bits-sims.edu', dept: '', status: 'Active', mfa: false, fails: 0, lockUntil: null, lastLogin: null, mustChange: false, emailVerified: true, created: '2026-08-01' }, extra);
  const SEED_USERS = [
    mkUser('U1', 'ict.admin', 'Ian Cruz', 'ICT_ADMIN', { mfa: true }),
    mkUser('U2', 'edtech01', 'Eden Tan', 'EDTECH'),
    mkUser('U3', 'dh.it', 'Dr. Lorna Santos', 'DEPT_HEAD', { dept: 'IT' }),
    mkUser('U4', 'faculty.reyes', 'Prof. Mark Reyes', 'FACULTY', { dept: 'IT', facultyName: 'Reyes, M.' }),
    mkUser('U5', 'registrar01', 'Regina Aquino', 'REGISTRAR'),
    mkUser('U6', 'dgarcia', 'Dawson James Garcia', 'STUDENT', { dept: 'IT', studentNo: '2024-12345' }),
    mkUser('U7', 'faculty.santos', 'Prof. Leo Santos', 'FACULTY', { dept: 'IT', facultyName: 'Santos, L.', status: 'Pending Activation', mustChange: true, emailVerified: false })
  ];

  /* ---------- helpers ---------- */
  const now = () => Date.now();
  const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
  async function hash(salt, pw) {
    const text = salt + ':' + pw;
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0; // demo fallback
    return 'x' + h;
  }
  const policy = (pw) => pw.length >= 8 && /[a-z]/i.test(pw) && /\d/.test(pw);
  const audit = (u, a) => { try { const l = JSON.parse(localStorage.getItem(AUD)) || []; l.unshift({ t: new Date().toLocaleString(), u, a }); localStorage.setItem(AUD, JSON.stringify(l.slice(0, 60))); } catch (e) { /* storage unavailable */ } };
  const initials = (n) => (n || '?').replace(/^(Dr|Prof)\.\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  /* ---------- store ---------- */
  let db = null, cur = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage unavailable */ } };
  async function seed() {
    const users = [];
    for (const u of SEED_USERS) { const salt = rand(8); users.push(Object.assign({}, u, { salt, hash: await hash(salt, DEMO_PW) })); }
    return { version: 1, users, grants: JSON.parse(JSON.stringify(GRANTS)), resets: [] };
  }
  const ready = (async () => {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 1 && s.users) { db = s; return; } } catch (e) { /* use the sample */ }
    db = await seed(); save();
  })();
  const find = (id) => db.users.find((u) => u.username.toLowerCase() === id.toLowerCase() || u.email.toLowerCase() === id.toLowerCase());
  const pub = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, dept: u.dept, facultyName: u.facultyName, studentNo: u.studentNo });
  const roleName = (code) => (ROLES.find((r) => r[0] === code) || [0, code])[1];

  /* ---------- public API ---------- */
  const api = {
    ready, PERMS, ROLES, roleName, initials,
    user: () => cur, role: () => (cur ? cur.role : null),
    can: (code) => !!cur && ((db.grants[cur.role] || []).indexOf(code) > -1),
    users: () => db.users, grants: () => db.grants,
    audit,

    async login(id, pw, code) {
      await ready;
      const u = find(id);
      if (!u) { audit(id, 'Failed login (unknown account)'); return { error: 'Invalid username or password.' }; }
      if (u.lockUntil && u.lockUntil < now()) { u.lockUntil = null; u.fails = 0; if (u.status === 'Locked') u.status = 'Active'; }
      if (u.status === 'Locked') { save(); return { error: u.lockUntil ? `Account locked. Try again in ${Math.ceil((u.lockUntil - now()) / 60000)} min or contact ICT Services.` : 'Account locked. Contact ICT Services.' }; }
      if (u.status === 'Suspended' || u.status === 'Inactive') return { error: 'This account is not active. Contact ICT Services.' };
      const bad = async (why) => {
        u.fails += 1;
        if (u.fails >= MAX_FAIL) { u.status = 'Locked'; u.lockUntil = now() + LOCK_MIN * 60000; audit(u.username, 'Account locked after failed logins'); save(); return { error: `Too many attempts. Account locked for ${LOCK_MIN} minutes.` }; }
        audit(u.username, 'Failed login (' + why + ')'); save();
        return { error: `${why === 'code' ? 'Incorrect verification code.' : 'Invalid username or password.'} ${MAX_FAIL - u.fails} attempt(s) left.` };
      };
      if (await hash(u.salt, pw) !== u.hash) return bad('password');
      if (u.mfa && !code) return { mfa: true };
      if (u.mfa && code !== DEMO_CODE) return bad('code');
      u.fails = 0; u.lastLogin = new Date().toLocaleString();
      cur = pub(u); save(); audit(u.username, 'Signed in (' + roleName(u.role) + ')');
      return { ok: true, user: cur, mustChange: u.mustChange };
    },
    logout() { if (cur) audit(cur.username, 'Signed out'); cur = null; const m = document.getElementById('auMfaGroup'); if (m) m.classList.add('hidden'); },

    async changePassword(pw) {
      if (!cur) return { error: 'Not signed in.' };
      if (!policy(pw)) return { error: 'Use at least 8 characters with letters and numbers.' };
      const u = db.users.find((x) => x.id === cur.id);
      u.salt = rand(8); u.hash = await hash(u.salt, pw); u.mustChange = false; u.passwordChanged = new Date().toLocaleString();
      if (u.status === 'Pending Activation') u.status = 'Active';
      save(); audit(u.username, 'Password changed'); return { ok: true };
    },

    /* Password recovery (3.6): token is stored hashed, expires, single use. Always answers the same. */
    async requestReset(id) {
      await ready; const u = find(id); if (!u) return { sent: true };
      const token = rand(6), salt = rand(8);
      db.resets.push({ userId: u.id, salt, hash: await hash(salt, token), exp: now() + RESET_MIN * 60000, used: false, at: new Date().toLocaleString() });
      save(); audit(u.username, 'Password reset requested');
      return { sent: true, demoToken: token }; // a real system emails this; shown on screen for the demo
    },
    async completeReset(id, token, pw) {
      await ready; const u = find(id);
      const r = u && db.resets.filter((x) => x.userId === u.id && !x.used && x.exp > now()).pop();
      if (!r || await hash(r.salt, token.trim().toUpperCase()) !== r.hash) return { error: 'The code is invalid or has expired.' };
      if (!policy(pw)) return { error: 'Use at least 8 characters with letters and numbers.' };
      r.used = true; u.salt = rand(8); u.hash = await hash(u.salt, pw); u.fails = 0; u.lockUntil = null; u.mustChange = false;
      if (u.status === 'Locked' || u.status === 'Pending Activation') u.status = 'Active';
      save(); audit(u.username, 'Password reset completed'); return { ok: true };
    },

    /* Administration (ICT Services). The UI also checks, but these re-check the permission. */
    async addUser(f) {
      if (!api.can('USER_MANAGE')) return { error: 'Access denied.' };
      if (!f.name || !f.username || !f.email) return { error: 'Name, username and email are required.' };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return { error: 'Enter a valid email address.' };
      if (find(f.username) || find(f.email)) return { error: 'That username or email is already in use.' };
      const temp = 'Temp@' + Math.floor(1000 + Math.random() * 9000), salt = rand(8);
      db.users.push(mkUser('U' + (db.users.length + 1 + Math.floor(Math.random() * 90)), f.username, f.name, f.role, { email: f.email, dept: f.dept || '', status: 'Pending Activation', mustChange: true, emailVerified: false, salt, hash: await hash(salt, temp) }));
      save(); audit(cur.username, `Created account ${f.username} (${f.role})`); return { ok: true, temp };
    },
    async resetPassword(id) {
      if (!api.can('USER_MANAGE')) return { error: 'Access denied.' };
      const u = db.users.find((x) => x.id === id), temp = 'Temp@' + Math.floor(1000 + Math.random() * 9000);
      u.salt = rand(8); u.hash = await hash(u.salt, temp); u.mustChange = true; u.fails = 0; u.lockUntil = null;
      if (u.status === 'Locked') u.status = 'Active';
      save(); audit(cur.username, `Reset password for ${u.username}`); return { ok: true, temp };
    },
    setStatus(id, status) {
      if (!api.can('USER_MANAGE')) return false;
      const u = db.users.find((x) => x.id === id); if (!u || u.id === cur.id) return false;
      u.status = status; u.fails = 0; u.lockUntil = null; save(); audit(cur.username, `Account ${u.username} set to ${status}`); return true;
    },
    setRole(id, role) {
      if (!api.can('USER_MANAGE') || !ROLES.some((r) => r[0] === role)) return false;
      const u = db.users.find((x) => x.id === id); if (!u || u.id === cur.id) return false;
      u.role = role; save(); audit(cur.username, `Role of ${u.username} changed to ${role}`); return true;
    },
    setGrants(role, codes) {
      if (!api.can('ROLE_MANAGE')) return { error: 'Access denied.' };
      if (role === 'ICT_ADMIN' && !(codes.includes('ROLE_MANAGE') && codes.includes('USER_MANAGE'))) return { error: 'ICT Services must keep USER_MANAGE and ROLE_MANAGE.' };
      db.grants[role] = codes.filter((c) => PERMS.includes(c)); save(); audit(cur.username, `Permissions updated for ${role}`); return { ok: true };
    },
    reset() { localStorage.removeItem(KEY); return seed().then((s) => { db = s; save(); cur = null; }); }
  };
  window.SIMSAuth = api;

  /* =====================================================
     LOGIN SCREEN ADD-ONS (remember me, MFA code, messages,
     forgot-password and first-login password change)
  ===================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm'); if (!form) return;
    const $ = (s) => document.querySelector(s);
    form.querySelector('#password').closest('.input-group').insertAdjacentHTML('afterend',
      `<div class="input-group hidden" id="auMfaGroup"><label for="authMfa">Verification code</label><input type="text" id="authMfa" inputmode="numeric" maxlength="6" placeholder="6-digit code (demo: ${DEMO_CODE})" autocomplete="one-time-code" /></div>
       <label class="au-remember"><input type="checkbox" id="authRemember" /> Remember me</label><p class="au-msg" id="auMsg" role="alert"></p>`);
    const link = $('.forgot-link a'); if (link) { link.textContent = 'Forgot your password?'; link.addEventListener('click', (e) => { e.preventDefault(); resetModal(); }); }
    $('.form-section').insertAdjacentHTML('beforeend', `<details class="au-demo"><summary>Demo accounts</summary><table>${SEED_USERS.map((u) => `<tr><td>${u.username}</td><td>${roleName(u.role)}</td></tr>`).join('')}</table><small>Password for all: ${DEMO_PW} &middot; ict.admin code: ${DEMO_CODE}</small></details>`);
    const saved = localStorage.getItem(REM); if (saved) { $('#username').value = saved; $('#authRemember').checked = true; }

    const msg = (t, info) => { const m = $('#auMsg'); m.textContent = t || ''; m.className = 'au-msg' + (info ? ' info' : ''); return null; };
    api.attempt = async function () {
      const id = $('#username').value.trim(), pw = $('#password').value, code = $('#authMfa').value.trim();
      msg('');
      if (!id || !pw) return msg('Please enter your username or email and your password.');
      const r = await api.login(id, pw, code);
      if (r.mfa) { $('#auMfaGroup').classList.remove('hidden'); $('#authMfa').focus(); return msg('Enter your verification code to continue.', true); }
      if (r.error) return msg(r.error);
      if ($('#authRemember').checked) localStorage.setItem(REM, id); else localStorage.removeItem(REM);
      if (r.mustChange && !(await changeModal())) { api.logout(); return msg('You must set a new password before continuing.'); }
      return r.user;
    };

    /* ---- modal ---- */
    let ov = null;
    const close = () => { if (ov) { ov.remove(); ov = null; } };
    function open(html) {
      close(); ov = document.createElement('div'); ov.className = 'au-ov';
      ov.innerHTML = `<div class="au-box" role="dialog" aria-modal="true">${html}</div>`; document.body.appendChild(ov);
      ov.addEventListener('click', (e) => { if (e.target === ov && !ov.dataset.lock) close(); });
      return ov;
    }
    const field = (id, label, type, ph) => `<label class="au-f">${label}<input id="${id}" type="${type || 'text'}" placeholder="${ph || ''}" autocomplete="off" /></label>`;
    const note = (m, ok) => { const n = ov.querySelector('.au-note'); n.textContent = m; n.className = 'au-note' + (ok ? ' ok' : ''); };

    function changeModal() {
      return new Promise((resolve) => {
        const o = open(`<h2>Set a new password</h2><p>For security, replace your temporary password before continuing.</p>${field('auNew', 'New password', 'password')}${field('auCon', 'Confirm password', 'password')}<p class="au-note"></p><div class="au-row"><button class="submit-btn" id="auOk">Save password</button><button class="au-link" id="auNo" type="button">Cancel</button></div>`);
        o.dataset.lock = 1;
        o.querySelector('#auNo').onclick = () => { close(); resolve(false); };
        o.querySelector('#auOk').onclick = async () => {
          const a = o.querySelector('#auNew').value;
          if (a !== o.querySelector('#auCon').value) return note('The passwords do not match.');
          const r = await api.changePassword(a); if (r.error) return note(r.error);
          close(); resolve(true);
        };
      });
    }

    function resetModal() {
      const o = open(`<h2>Reset your password</h2><p>Enter your username or email. If an account exists, a reset code is sent. The code expires in ${RESET_MIN} minutes and works once.</p>${field('auId', 'Username or email')}<p class="au-note"></p><div class="au-row"><button class="submit-btn" id="auSend">Send reset code</button><button class="au-link" id="auX" type="button">Close</button></div>`);
      o.querySelector('#auX').onclick = close;
      o.querySelector('#auSend').onclick = async () => {
        const id = o.querySelector('#auId').value.trim(); if (!id) return note('Enter your username or email.');
        const r = await api.requestReset(id);
        o.querySelector('.au-box').innerHTML = `<h2>Enter your code</h2><p>If that account exists, a code was sent. ${r.demoToken ? `<b class="au-demo-code">Demo code: ${r.demoToken}</b> (a real system emails it).` : ''}</p>${field('auCode', 'Reset code')}${field('auNew', 'New password', 'password')}${field('auCon', 'Confirm password', 'password')}<p class="au-note"></p><div class="au-row"><button class="submit-btn" id="auGo">Reset password</button><button class="au-link" id="auX2" type="button">Close</button></div>`;
        o.querySelector('#auX2').onclick = close;
        o.querySelector('#auGo').onclick = async () => {
          const pw = o.querySelector('#auNew').value;
          if (pw !== o.querySelector('#auCon').value) return note('The passwords do not match.');
          const s = await api.completeReset(id, o.querySelector('#auCode').value, pw);
          if (s.error) return note(s.error);
          note('Password updated. You can now log in.', true); $('#username').value = id; $('#password').value = '';
          setTimeout(close, 1400);
        };
      };
    }
  });
})();
