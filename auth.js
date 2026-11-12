/* =====================================================
   BITS-SIMS SHARED LOGIN SECURITY  (prototype)
   -----------------------------------------------------
   Loaded right after accounts.js. Handles, for every role:
     - Forgot password: one-time 6-digit reset code that
       expires in 15 minutes and can be tried 5 times
     - Password rules (minimum length from ICT's security
       policy, upper and lower case letters, a number and a symbol)
   and, for Students and the Registrar:
     - Lockout after too many failed logins (same numbers
       as ICT's security policy: 5 tries, 15 minutes)
     - Their changed passwords (stored hashed)

   Staff accounts (ICT, EdTech, Dept Head, Faculty) keep
   their lockout and passwords in staff.js, because ICT's
   User Accounts page manages them there. A staff reset is
   handed to SIMSStaff.setPassword().

   PROTOTYPE ONLY: there is no email server yet, so the
   reset code is shown in a "demo inbox" on the login page.
   When the database is ready, all of this moves to the
   server: codes are emailed, and hashing uses Argon2id or
   bcrypt (design reference 3.2 / 3.7).

   Console: SIMSAuth.reset() -> clears saved passwords,
   lockouts and reset codes
===================================================== */
(function () {
  'use strict';

  const KEY = { pw: 'bits-sims-auth-pw', locks: 'bits-sims-auth-locks', resets: 'bits-sims-auth-resets' };
  const STAFF_ROLES = ['ICT_ADMIN', 'EDTECH', 'DEPT_HEAD', 'FACULTY'];
  const CODE_MIN = 15;          // reset code lifetime
  const CODE_TRIES = 5;         // wrong codes before it stops working
  const RESEND_SEC = 60;        // wait between reset requests

  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

  // Prototype-only hash (NOT secure), same as staff.js
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
  const pwHash = (username, pw) => hash(username + ':' + pw);

  const isStaff = (acct) => STAFF_ROLES.includes(acct.role);
  const staff = () => window.SIMSStaff || null;
  const findAccount = (id) => (window.SIMSAccounts ? SIMSAccounts.find(id) : null);

  // ICT's security policy (System Settings) applies to everyone
  function policy() {
    const p = rd('bits-sims-staff-policy', {}) || {};
    return { maxFailed: p.maxFailed || 5, lockMin: p.lockMin || 15, minPw: p.minPw || 8 };
  }

  function audit(username, act, desc, status) {
    if (staff() && staff().record) staff().record(username, 'Authentication', 'Users', username, act, desc, status || 'Success');
  }

  /* ---------- Password rules ---------- */
  function passwordProblem(pw) {
    const min = policy().minPw;
    if (!pw || pw.length < min || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) return `Use at least ${min} characters with upper and lower case letters, a number and a symbol.`;
    return '';
  }

  /* ---------- Students and Registrar: passwords + lockout ---------- */
  const matches = (acct, password) => {
    const saved = rd(KEY.pw, {})[acct.username];
    return saved ? pwHash(acct.username, password) === saved : password === acct.password;
  };

  function lockedMessage(until) {
    const mins = Math.max(1, Math.ceil((until - Date.now()) / 60000));
    return `Too many failed attempts. This account is locked for about ${mins} more minute(s). You can also reset your password.`;
  }

  // Login check with lockout. Returns { ok, message }
  function check(acct, password) {
    const p = policy(), locks = rd(KEY.locks, {});
    const lock = locks[acct.username] || { fails: 0, until: 0 };
    if (lock.until && Date.now() < lock.until) return { ok: false, message: lockedMessage(lock.until) };

    if (!matches(acct, password)) {
      lock.fails = (lock.fails || 0) + 1;
      let message = GENERIC;
      if (lock.fails >= p.maxFailed) {
        lock.until = Date.now() + p.lockMin * 60000;
        lock.fails = 0;
        message = `Too many failed attempts. The account is locked for ${p.lockMin} minutes. You can also reset your password.`;
        audit(acct.username, 'LOCK', `Account locked after ${p.maxFailed} failed logins`, 'Failed');
      } else {
        audit(acct.username, 'LOGIN', 'Failed login (wrong password)', 'Failed');
      }
      locks[acct.username] = lock; wr(KEY.locks, locks);
      return { ok: false, message };
    }
    delete locks[acct.username]; wr(KEY.locks, locks);
    return { ok: true };
  }

  function setOwnPassword(username, pw) {
    const all = rd(KEY.pw, {}); all[username] = pwHash(username, pw); wr(KEY.pw, all);
    const locks = rd(KEY.locks, {}); delete locks[username]; wr(KEY.locks, locks);
  }

  // Same message whether the username or the password was wrong,
  // so nobody can use the login form to find out which accounts exist
  const GENERIC = 'Incorrect username or password.';

  /* ---------- Forgot password (every role) ---------- */
  function newCode() {
    const n = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(n);
    return String(n[0] % 1000000).padStart(6, '0');
  }

  // Demo inbox only (stands in for real email): the last code sent to each
  // account, kept for this browser session so a repeat request or a page
  // refresh can show the earlier "email" again. Delete with the demo inbox.
  const DEMO_KEY = 'bits-sims-demo-inbox';
  const demoGet = (u) => { try { return (JSON.parse(sessionStorage.getItem(DEMO_KEY)) || {})[u] || null; } catch (e) { return null; } };
  const demoPut = (u, code) => { try { const all = JSON.parse(sessionStorage.getItem(DEMO_KEY)) || {}; all[u] = code; sessionStorage.setItem(DEMO_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ } };

  // Always answers the same way to the page. `demo` is only for the
  // prototype's demo inbox and stands in for the user's real email.
  function requestReset(id) {
    const acct = findAccount(id);
    const reply = { message: 'If that account exists, a 6-digit reset code was sent to its registered email. The code expires in 15 minutes.', demo: null };
    if (!acct) return reply;

    let resets = rd(KEY.resets, []).filter((r) => r.exp > Date.now() && !r.used);
    const last = resets.filter((r) => r.username === acct.username).pop();
    if (last && Date.now() - last.at < RESEND_SEC * 1000) {
      reply.demo = { email: acct.email, code: demoGet(acct.username), note: 'A code was already sent less than a minute ago. Use that one, or wait a minute before asking for a new one.' };
      return reply;
    }
    const code = newCode();
    resets = resets.filter((r) => r.username !== acct.username);   // older codes stop working
    resets.push({ username: acct.username, codeHash: pwHash(acct.username, code), at: Date.now(), exp: Date.now() + CODE_MIN * 60000, tries: 0, used: false });
    wr(KEY.resets, resets);
    audit(acct.username, 'RESET_REQUEST', 'Password reset code requested');
    demoPut(acct.username, code);
    reply.demo = { email: acct.email, code };
    return reply;
  }

  // Returns { ok, field, message }  field = 'code' | 'pw' | 'confirm'
  function completeReset(id, code, pw, confirm) {
    const bad = { ok: false, field: 'code', message: 'That code is invalid or has expired. Request a new one.' };
    const acct = findAccount(id);
    if (!acct) return bad;
    const resets = rd(KEY.resets, []);
    const r = resets.filter((x) => x.username === acct.username && !x.used && x.exp > Date.now()).pop();
    if (!r) return bad;

    if (pwHash(acct.username, String(code || '').trim()) !== r.codeHash) {
      r.tries += 1;
      if (r.tries >= CODE_TRIES) { r.used = true; audit(acct.username, 'RESET_FAIL', 'Reset code blocked after too many wrong tries', 'Failed'); }
      wr(KEY.resets, resets);
      return r.used ? { ok: false, field: 'code', message: 'Too many wrong codes. Request a new one.' } : bad;
    }
    const problem = passwordProblem(pw);
    if (problem) return { ok: false, field: 'pw', message: problem };
    if (pw !== confirm) return { ok: false, field: 'confirm', message: 'Passwords do not match.' };

    if (isStaff(acct)) {
      if (!staff() || !staff().setPassword) return { ok: false, field: 'code', message: 'Password reset is unavailable right now.' };
      staff().setPassword(acct.username, pw);
    } else {
      setOwnPassword(acct.username, pw);
    }
    r.used = true; wr(KEY.resets, resets);
    audit(acct.username, 'RESET', 'Password reset with a one-time code');
    return { ok: true };
  }

  window.SIMSAuth = {
    GENERIC,
    policy,
    passwordProblem,
    check,                                     // Students and Registrar login
    verify: (acct, pw) => matches(acct, pw),   // current-password check, no lockout
    setPassword: setOwnPassword,               // Students and Registrar only
    requestReset,
    completeReset,
    reset() { Object.values(KEY).forEach((k) => localStorage.removeItem(k)); }
  };
})();
