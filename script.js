document.addEventListener('DOMContentLoaded', () => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const loginForm = $('#loginForm');
  const loginView = $('#loginView');
  const dashboardView = $('#dashboardView');
  const logoutBtn = $('#logoutBtn');
  const sidebarItems = $$('.sidebar-item:not(#logoutBtn)');
  const currentViewTitle = $('#currentViewTitle');

  const DEFAULT_AVATAR = 'https://api.iconify.design/fluent-emoji-flat:cat-face.svg';
  const STORE_KEY = 'bits-sims-profile';

  /* =====================================================
     TOAST
  ===================================================== */
  const toastEl = $('#toast');
  let toastTimer;

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  /* =====================================================
     PROFILE STATE (saved in localStorage when available)
  ===================================================== */
  const defaults = {
    firstName: 'Dawson James',
    lastName: 'Garcia',
    email: 'dawson.garcia@bits.edu.ph',
    emailVisibility: 'course',
    city: 'Muntinlupa',
    country: 'Philippines',
    timezone: 'Asia/Manila',
    phone: '09171234567',
    avatar: DEFAULT_AVATAR,
    personalEmail: 'dawson.garcia@example.com',
    address: '',
    notifications: {
      admissions: true,
      grades: true,
      documents: true,
      announcements: false
    }
  };

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
      const merged = Object.assign({}, defaults, saved);
      merged.notifications = Object.assign({}, defaults.notifications, saved.notifications);
      return merged;
    } catch (err) {
      return Object.assign({}, defaults);
    }
  }

  function persistProfile() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(profile));
      return true;
    } catch (err) {
      return false;
    }
  }

  let profile = loadProfile();

  /* =====================================================
     LOGIN / LOGOUT
  ===================================================== */
  /* Hardcoded demo logins live in accounts.js. Each role opens its own portal:
       STUDENT                                -> the student dashboard below
       REGISTRAR                              -> registrar.js
       ICT_ADMIN / EDTECH / DEPT_HEAD / FACULTY -> staff.js */
  const loginError = $('#loginError');

  function showLoginError(message) {
    loginError.textContent = message;
    loginError.hidden = !message;
  }

  let studentAccount = null;   // the signed-in student (for change password)

  function authenticate(username, password) {
    const account = window.SIMSAccounts && SIMSAccounts.find(username);
    // Same message for a wrong username and a wrong password (no account guessing)
    if (!account) return { ok: false, message: SIMSAuth.GENERIC };
    if (account.role === 'STUDENT') {
      const r = SIMSAuth.check(account, password);   // lockout lives in auth.js
      return r.ok ? { ok: true, account } : r;
    }
    if (account.role === 'REGISTRAR') return SIMSRegistrar.authenticate(username, password);
    return SIMSStaff.authenticate(username, password);
  }

  function openPortal(account) {
    loginView.classList.add('hidden');
    if (account.role === 'STUDENT') {
      studentAccount = account;
      dashboardView.classList.remove('hidden');
    } else if (account.role === 'REGISTRAR') {
      persistProfile(); persistDocs(); persistAdm(); // make sure the Registrar sees the student's stores
      SIMSRegistrar.open(account);
    } else {
      SIMSStaff.open(account);
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = $('#username').value.trim();
    const password = $('#password').value;

    if (!username || !password) {
      showLoginError('Please fill in both Username/Email and Password.');
      return;
    }

    const result = authenticate(username, password);
    if (!result.ok) {
      showLoginError(result.message);
      return;
    }
    showLoginError('');
    if (loginNotice) loginNotice.hidden = true;
    openPortal(result.account);
  });

  loginForm.addEventListener('input', () => showLoginError(''));

  /* ---- Forgot password (rules and codes live in auth.js) ---- */
  const loginPanel = $('#loginPanel');
  const resetPanel = $('#resetPanel');
  const resetRequestForm = $('#resetRequestForm');
  const resetCompleteForm = $('#resetCompleteForm');
  const loginNotice = $('#loginNotice');
  let resetFor = '';   // what the user typed in step 1

  const showMsg = (el, message) => { el.textContent = message || ''; el.hidden = !message; };

  function showLogin(notice) {
    resetPanel.hidden = true;
    loginPanel.hidden = false;
    showMsg(loginNotice, notice);
    $('#username').focus();
  }

  function showReset() {
    showLoginError('');
    showMsg(loginNotice, '');
    resetRequestForm.reset();
    resetCompleteForm.reset();
    resetRequestForm.hidden = false;
    resetCompleteForm.hidden = true;
    showMsg($('#resetRequestError'), '');
    $('#resetId').value = $('#username').value.trim();
    loginPanel.hidden = true;
    resetPanel.hidden = false;
    $('#resetId').focus();
  }

  function sendCode(id) {
    const reply = SIMSAuth.requestReset(id);
    resetFor = id;
    $('#resetSentMsg').textContent = reply.message;
    const inbox = $('#resetDemoInbox');
    if (reply.demo) {
      inbox.innerHTML = '<strong>Demo inbox</strong> <small>(prototype: stands in for the email)</small><br>' +
        `To: ${reply.demo.email}<br>` +
        (reply.demo.code ? `Your BITS-SIMS password reset code is <b class="reset-code">${reply.demo.code}</b>. It expires in 15 minutes.` : '') +
        (reply.demo.note ? `<br><small>${reply.demo.note}</small>` : '');
      inbox.hidden = false;
    } else {
      inbox.innerHTML = '';
      inbox.hidden = true;
    }
    showMsg($('#resetError'), '');
    resetRequestForm.hidden = true;
    resetCompleteForm.hidden = false;
    $('#resetCode').focus();
  }

  $('#forgotLink').addEventListener('click', (e) => { e.preventDefault(); showReset(); });
  $('#resetBack').addEventListener('click', (e) => { e.preventDefault(); showLogin(''); });
  $('#resetResend').addEventListener('click', (e) => { e.preventDefault(); sendCode(resetFor); });

  resetRequestForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('#resetId').value.trim();
    if (!id) { showMsg($('#resetRequestError'), 'Enter your username, email or student number.'); return; }
    showMsg($('#resetRequestError'), '');
    sendCode(id);
  });

  resetCompleteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = SIMSAuth.completeReset(resetFor, $('#resetCode').value, $('#resetPw').value, $('#resetConfirm').value);
    if (!r.ok) {
      showMsg($('#resetError'), r.message);
      const field = { code: '#resetCode', pw: '#resetPw', confirm: '#resetConfirm' }[r.field];
      if (field) $(field).focus();
      return;
    }
    loginForm.reset();
    $('#username').value = resetFor;
    showLogin('Your password was changed. Log in with your new password.');
    $('#password').focus();
  });

  // Demo accounts list (prototype) - built from accounts.js so it never drifts
  const demoList = $('#demoAccounts');
  if (demoList && window.SIMSAccounts) {
    const ROLE_NAME = { ICT_ADMIN: 'ICT Services', EDTECH: 'EdTech Services', DEPT_HEAD: 'Department Head', FACULTY: 'Faculty', REGISTRAR: 'Registrar', STUDENT: 'Student' };
    demoList.innerHTML = SIMSAccounts.all().map((a) =>
      `<li><button type="button" data-user="${a.username}" data-pass="${a.password}"><strong>${ROLE_NAME[a.role]}</strong><span>${a.username}</span></button></li>`).join('');
    demoList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-user]');
      if (!btn) return;
      $('#username').value = btn.dataset.user;
      $('#password').value = btn.dataset.pass;
      showLoginError('');
      $('#password').focus();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.reset();
      dashboardView.classList.add('hidden');
      loginView.classList.remove('hidden');
    });
  }

  /* =====================================================
     SIDEBAR NAVIGATION + PAGE SWITCHING
  ===================================================== */
  const pages = {
    home: $('#page-home'),
    profile: $('#page-profile'),
    records: $('#page-records'),
    attendance: $('#page-attendance'),
    admissions: $('#page-admissions'),
    documents: $('#page-documents'),
    settings: $('#page-settings'),
    reports: $('#page-reports'),
    userprofile: $('#page-userprofile'),
    placeholder: $('#page-placeholder')
  };

  function showPage(item) {
    const key = item.dataset.page;
    Object.values(pages).forEach((page) => page.classList.add('hidden'));

    if (key !== 'placeholder' && key !== 'userprofile' && pages[key]) {
      pages[key].classList.remove('hidden');
      if (key === 'reports') {
        showReportsOverview();
        animateStats();
      }
      if (key === 'admissions') admShowTab('overview');
      if (key === 'records') renderRecords();
    } else {
      $('#placeholderTitle').textContent = item.textContent.trim();
      pages.placeholder.classList.remove('hidden');
    }
  }

  function setActivePage(item) {
    sidebarItems.forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
    showPage(item);

    if (currentViewTitle) {
      currentViewTitle.textContent =
        item.dataset.page === 'home' ? 'Dashboard' : item.textContent.trim();
    }
  }

  sidebarItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      setActivePage(item);
    });
  });

  // Opens the read-only "My Profile" page (not tied to a sidebar item)
  function openUserProfile() {
    sidebarItems.forEach((nav) => nav.classList.remove('active'));
    Object.values(pages).forEach((page) => page.classList.add('hidden'));
    pages.userprofile.classList.remove('hidden');
    if (currentViewTitle) currentViewTitle.textContent = 'My Profile';
    window.scrollTo(0, 0);
  }

  const studentCard = $('#studentCard');
  if (studentCard) {
    studentCard.addEventListener('click', openUserProfile);
    studentCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openUserProfile();
      }
    });
  }

  $('#navAvatarBtn').addEventListener('click', openUserProfile);

  $('#editProfileBtn').addEventListener('click', () => {
    const target = $('.sidebar-item[data-page="profile"]');
    if (target) setActivePage(target);
  });

  const academicRecordsCard = $('#academicRecordsCard');
  if (academicRecordsCard) {
    academicRecordsCard.addEventListener('click', () => {
      const target = $('.sidebar-item[data-page="records"]');
      if (target) setActivePage(target);
    });
  }

  /* =====================================================
     HOME: COURSE LIST SELECTION
  ===================================================== */
  $$('.course-pill').forEach((pill) => {
    const toggle = () => pill.classList.toggle('selected');
    pill.addEventListener('click', toggle);
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  /* =====================================================
     HOME: INTERACTIVE CALENDAR
  ===================================================== */
  const calendarGrid = $('#calendarGrid');
  const calendarTitle = $('#calendarTitle');
  const calSelected = $('#calSelected');
  const today = new Date();

  const cal = {
    year: today.getFullYear(),
    month: today.getMonth(),
    selected: new Date(today.getFullYear(), today.getMonth(), today.getDate())
  };

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  function renderCalendar() {
    const monthName = new Date(cal.year, cal.month, 1).toLocaleString('en-US', { month: 'long' });
    const daysInMonth = new Date(cal.year, cal.month + 1, 0).getDate();

    calendarTitle.textContent = `${monthName} ${cal.year}`;
    calendarGrid.innerHTML = '';

    ['Sun', 'Mon', 'Tue', 'Wed'].forEach((label) => {
      const header = document.createElement('span');
      header.className = 'cal-header';
      header.textContent = label;
      calendarGrid.appendChild(header);
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(cal.year, cal.month, day);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-day';
      cell.textContent = day;
      cell.dataset.day = day;
      cell.setAttribute('aria-label', date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));

      if (sameDay(date, today)) cell.classList.add('is-today');
      if (sameDay(date, cal.selected)) {
        cell.classList.add('active-date');
        cell.setAttribute('aria-pressed', 'true');
      }
      calendarGrid.appendChild(cell);
    }

    calSelected.textContent = cal.selected.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  }

  function changeMonth(delta) {
    const d = new Date(cal.year, cal.month + delta, 1);
    cal.year = d.getFullYear();
    cal.month = d.getMonth();
    renderCalendar();
  }

  calendarGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.cal-day');
    if (!btn) return;
    cal.selected = new Date(cal.year, cal.month, Number(btn.dataset.day));
    renderCalendar();
  });

  $('#calPrev').addEventListener('click', () => changeMonth(-1));
  $('#calNext').addEventListener('click', () => changeMonth(1));
  $('#calToday').addEventListener('click', () => {
    cal.year = today.getFullYear();
    cal.month = today.getMonth();
    cal.selected = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    renderCalendar();
  });

  renderCalendar();

  /* =====================================================
     STUDENT PROFILE
  ===================================================== */
  const generalForm = $('#generalForm');
  const pictureForm = $('#pictureForm');
  const contactForm = $('#contactForm');

  /* ---- Shared helpers ---- */
  function setError(id, message) {
    const input = $('#' + id);
    const error = $('#' + id + 'Error');
    if (error) error.textContent = message || '';
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors(form) {
    $$('input', form).forEach((input) => input.setAttribute('aria-invalid', 'false'));
    $$('.field-error', form).forEach((el) => (el.textContent = ''));
  }

  // Clear a field's error as soon as the person edits it
  $$('.field input').forEach((input) => {
    input.addEventListener('input', () => setError(input.id, ''));
  });

  function formatPhone(digits) {
    if (!digits) return '';
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`.trim();
  }

  // Accepts 09XXXXXXXXX or +639XXXXXXXXX (spaces/dashes ignored); returns 09XXXXXXXXX or null
  function normalizePhone(raw) {
    let value = raw.replace(/[\s\-()]/g, '');
    if (value.startsWith('+63')) value = '0' + value.slice(3);
    return /^09\d{9}$/.test(value) ? value : null;
  }

  function setAvatars(src) {
    const isCustom = src !== DEFAULT_AVATAR;
    $$('[data-avatar]').forEach((img) => {
      img.src = src;
      if (isCustom) img.setAttribute('data-custom', '');
      else img.removeAttribute('data-custom');
    });
  }

  function setNames() {
    $$('[data-student-name]').forEach((el) => {
      el.textContent = '';
      el.appendChild(document.createTextNode(profile.firstName));
      el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(profile.lastName));
    });
    renderUserProfile();
    renderReports();
    renderAccount();
  }

  /* ---- Read-only "My Profile" page ---- */
  function renderUserProfile() {
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    const visibility = $(`#emailVisibility option[value="${profile.emailVisibility}"]`);
    const timezone = $(`#timezone option[value="${profile.timezone}"]`);

    const values = {
      fullName,
      email: profile.email,
      emailVisibility: visibility ? visibility.textContent : '',
      phone: profile.phone ? formatPhone(profile.phone) : 'No number on file',
      city: profile.city || '\u2014',
      country: profile.country,
      timezone: timezone ? timezone.textContent : profile.timezone
    };

    $$('[data-full-name]').forEach((el) => (el.textContent = fullName));
    $$('[data-up]').forEach((el) => {
      el.textContent = values[el.dataset.up] || '\u2014';
    });
  }

  // Courses and attendance are read from the dashboard so there is one source of truth
  function buildAcademicSummary() {
    const courseList = $('#upCourses');
    const attendanceList = $('#upAttendance');
    courseList.innerHTML = '';
    attendanceList.innerHTML = '';

    $$('.course-pill').forEach((pill) => {
      const li = document.createElement('li');
      li.textContent = pill.textContent.trim();
      courseList.appendChild(li);
    });

    $$('.info-row').forEach((row) => {
      const date = $('.attendance-date', row).lastChild.textContent.trim();
      const li = document.createElement('li');

      const course = document.createElement('span');
      course.textContent = $('.course-text', row).textContent.trim();

      const dateEl = document.createElement('span');
      dateEl.className = 'up-att-meta';
      dateEl.textContent = `Attendance: ${date}`;

      const sessions = document.createElement('span');
      sessions.className = 'up-att-meta';
      sessions.textContent = $('.sessions-count', row).textContent.trim();

      li.append(course, dateEl, sessions);
      attendanceList.appendChild(li);
    });
  }

  /* ---- Fill forms from saved state ---- */
  function fillGeneral() {
    $('#firstName').value = profile.firstName;
    $('#lastName').value = profile.lastName;
    $('#email').value = profile.email;
    $('#emailVisibility').value = profile.emailVisibility;
    $('#city').value = profile.city;
    $('#country').value = profile.country;
    $('#timezone').value = profile.timezone;
    clearErrors(generalForm);
  }

  function fillContact() {
    $('#currentNumber').value = formatPhone(profile.phone);
    $('#newNumber').value = '';
    $('#newNumber').disabled = false;
    $('#deleteNumber').checked = false;
    clearErrors(contactForm);
    renderUserProfile();
    renderAccount();
  }

  function applyProfile() {
    setNames();
    setAvatars(profile.avatar);
    fillGeneral();
    fillContact();
  }

  /* ---- Tabs ---- */
  const tabs = $$('.profile-tab');
  const panels = $$('.tab-panel');

  function openTab(name) {
    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.panel !== name));
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => openTab(tab.dataset.tab)));

  /* ---- General tab ---- */
  generalForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const firstName = $('#firstName').value.trim();
    const lastName = $('#lastName').value.trim();
    const email = $('#email').value.trim();
    let valid = true;

    clearErrors(generalForm);

    if (!firstName) { setError('firstName', 'First name is required.'); valid = false; }
    if (!lastName) { setError('lastName', 'Last name is required.'); valid = false; }
    if (!email) {
      setError('email', 'Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('email', 'Enter a valid email address.');
      valid = false;
    }

    if (!valid) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    // Official name changes go to the registrar as a correction request instead of applying directly
    const COR_KEY = 'bits-sims-corrections';
    const nameChanges = [['firstName', 'First name', firstName], ['lastName', 'Last name', lastName]].filter((c) => c[2] !== profile[c[0]]);
    if (nameChanges.length) {
      const reason = window.prompt('Your name is an official record, so the registrar must approve this change.\nReason (e.g. marriage certificate):', '');
      if (reason === null) { fillGeneral(); return; }
      let list = [];
      try { list = JSON.parse(localStorage.getItem(COR_KEY)) || []; } catch (err) { list = []; }
      nameChanges.forEach((c) => list.push({
        id: 'COR-' + Date.now() + '-' + c[0], student: '2024-12345', field: c[0], label: c[1],
        old: profile[c[0]], next: c[2], reason: reason.trim(), date: isoToday(), status: 'pending', remarks: ''
      }));
      try { localStorage.setItem(COR_KEY, JSON.stringify(list)); } catch (err) { /* storage unavailable */ }
    }

    profile = Object.assign({}, profile, {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email,
      emailVisibility: $('#emailVisibility').value,
      city: $('#city').value.trim(),
      country: $('#country').value,
      timezone: $('#timezone').value
    });

    persistProfile();
    setNames();
    showToast(nameChanges.length ? 'Details saved. Your name change was sent to the registrar for approval.' : 'Profile details saved.', nameChanges.length ? 'info' : 'success');
    if (nameChanges.length) fillGeneral();
  });

  $('#generalCancel').addEventListener('click', () => {
    fillGeneral();
    showToast('Changes discarded.', 'info');
  });

  /* ---- User Picture tab ---- */
  const dropzone = $('#dropzone');
  const pictureInput = $('#pictureInput');
  const dzEmpty = $('#dzEmpty');
  const dzPreview = $('#dzPreview');
  const dzPreviewImg = $('#dzPreviewImg');
  const dzFileName = $('#dzFileName');
  const deletePicture = $('#deletePicture');
  const currentPictureFrame = $('#currentPictureFrame');
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  let pendingAvatar = null;

  function resetPictureForm() {
    pendingAvatar = null;
    pictureInput.value = '';
    deletePicture.checked = false;
    currentPictureFrame.classList.remove('marked-delete');
    dzPreview.classList.add('hidden');
    dzEmpty.classList.remove('hidden');
    dzPreviewImg.removeAttribute('src');
    dzFileName.textContent = '';
  }

  function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('That image is over 5 MB. Please pick a smaller one.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      pendingAvatar = reader.result;
      dzPreviewImg.src = pendingAvatar;
      dzFileName.textContent = file.name;
      dzEmpty.classList.add('hidden');
      dzPreview.classList.remove('hidden');
      deletePicture.checked = false;
      currentPictureFrame.classList.remove('marked-delete');
    };
    reader.onerror = () => showToast('Could not read that file.', 'error');
    reader.readAsDataURL(file);
  }

  dropzone.addEventListener('click', () => pictureInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pictureInput.click();
    }
  });
  pictureInput.addEventListener('change', () => handleFile(pictureInput.files[0]));

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    })
  );
  dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

  deletePicture.addEventListener('change', () => {
    currentPictureFrame.classList.toggle('marked-delete', deletePicture.checked);
    if (deletePicture.checked) {
      // Deleting and uploading at once makes no sense, so drop the pending upload
      pendingAvatar = null;
      pictureInput.value = '';
      dzPreview.classList.add('hidden');
      dzEmpty.classList.remove('hidden');
    }
  });

  pictureForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (deletePicture.checked) {
      profile.avatar = DEFAULT_AVATAR;
    } else if (pendingAvatar) {
      profile.avatar = pendingAvatar;
    } else {
      showToast('Choose a new picture or tick "Delete picture" first.', 'info');
      return;
    }

    const stored = persistProfile();
    setAvatars(profile.avatar);
    resetPictureForm();
    showToast(stored ? 'Profile picture updated.' : 'Picture updated for this session only (too large to store).', stored ? 'success' : 'info');
  });

  $('#pictureCancel').addEventListener('click', () => {
    resetPictureForm();
    showToast('Changes discarded.', 'info');
  });

  /* ---- Contact Information tab ---- */
  const deleteNumber = $('#deleteNumber');
  const newNumber = $('#newNumber');

  deleteNumber.addEventListener('change', () => {
    newNumber.disabled = deleteNumber.checked;
    if (deleteNumber.checked) {
      newNumber.value = '';
      setError('newNumber', '');
    }
  });

  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(contactForm);

    if (deleteNumber.checked) {
      profile.phone = '';
      persistProfile();
      fillContact();
      showToast('Contact number deleted.');
      return;
    }

    const raw = newNumber.value.trim();
    if (!raw) {
      showToast('Enter a new number or tick "Delete number" first.', 'info');
      return;
    }

    const normalized = normalizePhone(raw);
    if (!normalized) {
      setError('newNumber', 'Use a PH mobile number, e.g. 0917 123 4567.');
      showToast('Please fix the highlighted field.', 'error');
      return;
    }

    profile.phone = normalized;
    persistProfile();
    fillContact();
    showToast('Contact number updated.');
  });

  $('#contactCancel').addEventListener('click', () => {
    fillContact();
    showToast('Changes discarded.', 'info');
  });

  /* =====================================================
     REPORTS & ANALYTICS
     (all figures below are sample data for the prototype)
  ===================================================== */
  const DOC_LABELS = {
    report: 'Report Card',
    enrollment: 'Enrollment Summary',
    records: 'Academic Records',
    attendance: 'Attendance Analytics'
  };

  // Module 3 & 4 share one data source (data.js). This rebuilds the shape the
  // report builders below expect, every time that data changes.
  let reportData = buildReportData();

  function buildReportData() {
    const D = window.SIMSData;
    const st = D.student();
    const last = D.lastCompletedTerm();
    const current = D.currentTerm();
    const currentSubjects = D.subjectsIn(current.id);

    return {
      studentId: st.id,
      program: st.program,
      section: st.section,
      yearLevel: st.yearLevel,

      // Last completed semester
      reportCard: {
        term: last ? last.sem : '',
        ay: last ? `AY ${last.ay}` : '',
        subjects: (last ? D.subjectsIn(last.id) : [])
          .filter((s) => typeof s.finalGrade === 'number')
          .map((s) => ({ title: s.title, units: s.units, grade: s.finalGrade }))
      },

      // Current semester
      enrolled: {
        term: current.sem,
        ay: `AY ${current.ay}`,
        termLabel: D.shortTermLabel(current),
        subjects: currentSubjects.map((s) => ({ code: s.code, title: s.title, units: s.units, section: s.section || st.section }))
      },

      // Completed terms only
      records: D.terms()
        .filter((t) => !t.current)
        .map((t) => ({ ay: t.ay, sem: t.sem.replace('Semester', 'Sem'), gwa: D.termSummary(t.id).gwa, termId: t.id }))
        .filter((r) => r.gwa !== null),

      attendance: {
        subjects: currentSubjects
          .filter((s) => s.attendance && s.attendance.held)
          .map((s) => ({ title: s.title, held: s.attendance.held, absent: s.attendance.absent, late: s.attendance.late, excused: s.attendance.excused || 0 })),
        pastTerms: D.get().attendanceHistory.map((h) => ({ label: D.shortTermLabel(D.term(h.termId)), rate: h.rate }))
      }
    };
  }

  const generatedAt = {
    report: new Date(),
    enrollment: new Date(),
    records: new Date(),
    attendance: new Date()
  };

  const pageReports = $('#page-reports');
  const repOverview = $('#repOverview');
  const repDocuments = $('#repDocuments');

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  const studentFullName = () => `${profile.firstName} ${profile.lastName}`.trim();

  const weighted = (subjects) => {
    const units = subjects.reduce((sum, s) => sum + s.units, 0);
    const points = subjects.reduce((sum, s) => sum + s.units * s.grade, 0);
    return units ? points / units : 0;
  };

  // Passing grade, Dean's List cut-off and attendance thresholds come from data.js rules
  const standingFor = (gwa, subjects = []) =>
    subjects.some((s) => !window.SIMSData.isPassing(s.grade))
      ? 'Academic Warning'
      : gwa <= window.SIMSData.rules().deansListMax ? "Dean's Lister" : 'Good Standing';

  function attendanceTotals() {
    const subjects = reportData.attendance.subjects;
    const sum = (key) => subjects.reduce((total, s) => total + (s[key] || 0), 0);
    const totals = { held: sum('held'), absent: sum('absent'), late: sum('late'), excused: sum('excused') };
    totals.rate = window.SIMSData.attendanceRate(totals) || 0;
    return totals;
  }

  function attendanceStatus(rate) {
    const st = window.SIMSData.attendanceStatus(rate);
    return { cls: `badge-${st.key === 'none' ? 'warn' : st.key}`, label: st.label };
  }

  const recordRows = () =>
    reportData.records.map((r) => ({ ay: r.ay, sem: r.sem, gwa: r.gwa, status: window.SIMSData.termSummary(r.termId).standing }));

  const formatStamp = (date) =>
    date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  function computeStats() {
    return {
      subjects: reportData.enrolled.subjects.length,
      attendance: Math.round(attendanceTotals().rate),
      gpa: weighted(reportData.reportCard.subjects)
    };
  }

  /* ---- Paper builders ---- */
  function paperHead(title, subtitle) {
    return `
      <div class="paper-head">
        <div class="paper-brand">
          <span class="paper-mark" aria-hidden="true">B</span>
          <div><strong>BITS-SIMS</strong><small>Student Information Management System</small></div>
        </div>
        <span class="paper-sample">System-generated &middot; Sample data</span>
      </div>
      <h3 class="paper-title">${title}</h3>
      <p class="paper-subtitle">${subtitle}</p>`;
  }

  function infoRows(rows) {
    return `<dl class="paper-info">${rows
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join('')}</dl>`;
  }

  const stampLine = (doc) => `<p class="paper-stamp">Generated ${esc(formatStamp(generatedAt[doc]))}</p>`;

  function reportCardHtml() {
    const rc = reportData.reportCard;
    const gwa = weighted(rc.subjects);
    const rows = rc.subjects
      .map((s) => `<tr><td>${esc(s.title)}</td><td class="num">${s.units.toFixed(1)}</td><td class="num">${s.grade.toFixed(2)}</td><td>${window.SIMSData.isPassing(s.grade) ? 'Passed' : 'Failed'}</td></tr>`)
      .join('');

    return `
      ${paperHead('REPORT CARD', `${esc(rc.term)}, ${esc(rc.ay)}`)}
      ${infoRows([
        ['Student Name', studentFullName()],
        ['Student ID', reportData.studentId],
        ['Course', reportData.program],
        ['Year Level', reportData.yearLevel]
      ])}
      <table class="paper-table">
        <thead><tr><th>Subject</th><th class="num">Units</th><th class="num">Final Grade</th><th>Remarks</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="paper-summary">
        <strong>General Weighted Average (GWA): ${gwa.toFixed(2)}</strong><br />
        Academic Standing: <strong>${standingFor(gwa, rc.subjects)}</strong>
      </div>
      ${stampLine('report')}`;
  }

  function enrollmentHtml() {
    const en = reportData.enrolled;
    const totalUnits = en.subjects.reduce((sum, s) => sum + s.units, 0);
    const rows = en.subjects
      .map((s) => `<tr><td>${esc(s.code)}</td><td>${esc(s.title)}</td><td class="num">${s.units.toFixed(1)}</td><td class="num">${esc(s.section)}</td></tr>`)
      .join('');

    return `
      ${paperHead('ENROLLMENT SUMMARY', esc(en.ay))}
      ${infoRows([
        ['Name', studentFullName()],
        ['Student ID', reportData.studentId],
        ['Course', reportData.program],
        ['Year Level', reportData.yearLevel]
      ])}
      <p class="paper-section">Enrolled Subjects</p>
      <table class="paper-table">
        <thead><tr><th>Subject Code</th><th>Subject Title</th><th class="num">Units</th><th class="num">Section</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2">Total Units: ${totalUnits.toFixed(1)}</td><td colspan="2" class="num">${esc(en.ay)} &middot; ${esc(en.term)}</td></tr></tfoot>
      </table>
      ${stampLine('enrollment')}`;
  }

  function recordsHtml() {
    const rows = recordRows();
    const cumulative = window.SIMSData.cumulativeGwa() || 0;
    const body = rows
      .map((r) => `<tr><td>${esc(r.ay)}</td><td>${esc(r.sem)}</td><td class="num">${r.gwa.toFixed(2)}</td><td>${esc(r.status)}</td></tr>`)
      .join('');

    return `
      ${paperHead('ACADEMIC RECORDS', 'Academic History')}
      ${infoRows([
        ['Student Name', studentFullName()],
        ['Student ID', reportData.studentId],
        ['Course', reportData.program],
        ['Year Level', reportData.yearLevel]
      ])}
      <table class="paper-table">
        <thead><tr><th>School Year</th><th>Semester</th><th class="num">GWA</th><th>Academic Status</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="paper-summary"><strong>Cumulative GWA: ${fmtGwa(cumulative)}</strong></div>
      ${stampLine('records')}`;
  }

  function trendChart(points) {
    const w = 300, h = 130, padL = 46, padR = 30, padT = 16, padB = 28;
    const min = 90, max = 100;
    const x = (i) => padL + (i * (w - padL - padR)) / (points.length - 1);
    const y = (v) => padT + ((max - Math.min(Math.max(v, min), max)) * (h - padT - padB)) / (max - min);

    const grid = [90, 95, 100]
      .map((v) => `<line x1="${padL}" x2="${w - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#d9e0ea" stroke-width="1"/><text x="${padL - 6}" y="${y(v) + 3}" text-anchor="end" font-size="8" fill="#667085">${v}%</text>`)
      .join('');
    const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join(' ');
    const dots = points
      .map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.rate).toFixed(1)}" r="3.5" fill="#1565c0"><title>${esc(p.label)}: ${p.rate.toFixed(1)}%</title></circle>
        <text x="${x(i).toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="7.5" fill="#556070">${esc(p.label)}</text>`)
      .join('');

    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Attendance rate trend">${grid}<polyline points="${line}" fill="none" stroke="#1565c0" stroke-width="2"/>${dots}</svg>`;
  }

  function attendanceHtml() {
    const totals = attendanceTotals();
    const points = [...reportData.attendance.pastTerms, { label: reportData.enrolled.termLabel, rate: totals.rate }];
    const rows = reportData.attendance.subjects
      .map((s) => {
        const rate = window.SIMSData.attendanceRate(s) || 0;
        const status = attendanceStatus(rate);
        return `<tr><td>${esc(s.title)}</td><td class="num">${s.held}</td><td class="num">${s.absent}</td><td class="num">${s.late}</td><td class="num">${s.excused || 0}</td><td class="num">${rate.toFixed(1)}%</td><td class="num"><span class="badge ${status.cls}">${status.label}</span></td></tr>`;
      })
      .join('');

    return `
      ${paperHead('ATTENDANCE ANALYTICS REPORT', `${esc(reportData.enrolled.ay)} &middot; ${esc(reportData.enrolled.term)} (to date)`)}
      ${infoRows([
        ['Student Name', studentFullName()],
        ['Student ID', reportData.studentId],
        ['Course', reportData.program],
        ['Section', reportData.section]
      ])}
      <div class="paper-stats has-4">
        <div class="paper-stat"><strong>${totals.rate.toFixed(1)}%</strong>Overall Attendance</div>
        <div class="paper-stat"><strong>${totals.absent}</strong>Total Absences</div>
        <div class="paper-stat"><strong>${totals.late}</strong>Total Tardiness</div>
        <div class="paper-stat"><strong>${totals.excused}</strong>Excused</div>
      </div>
      <p class="paper-section">Attendance Rate Trend</p>
      <div class="paper-chart">${trendChart(points)}</div>
      <p class="paper-section">By Subject</p>
      <table class="paper-table">
        <thead><tr><th>Subject</th><th class="num">Sessions</th><th class="num">Absent</th><th class="num">Late</th><th class="num">Excused</th><th class="num">Attendance Rate</th><th class="num">Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${stampLine('attendance')}`;
  }

  const paperBuilders = {
    report: reportCardHtml,
    enrollment: enrollmentHtml,
    records: recordsHtml,
    attendance: attendanceHtml
  };

  function renderDocument(doc) {
    $('#paper-' + doc).innerHTML = paperBuilders[doc]();
  }

  function renderReports() {
    const firstName = (profile.firstName || '').trim().split(/\s+/)[0] || 'there';
    $('#repWelcome').textContent = `Welcome back, ${firstName}!`;

    Object.keys(paperBuilders).forEach(renderDocument);

    // Stats show their final values (animateStats counts up to them)
    const stats = computeStats();
    $('[data-stat="subjects"]').textContent = stats.subjects;
    $('[data-stat="attendance"]').textContent = `${stats.attendance}%`;
    $('[data-stat="gpa"]').textContent = stats.gpa.toFixed(2);
  }

  // Live updates: whenever Module 3 data changes, rebuild and redraw the reports
  window.SIMSData.subscribe(() => {
    reportData = buildReportData();
    Object.keys(generatedAt).forEach((doc) => (generatedAt[doc] = new Date()));
    renderReports();
    renderAccount();
  });

  function animateStats() {
    const stats = computeStats();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    $$('[data-stat]').forEach((el) => {
      const key = el.dataset.stat;
      const target = stats[key];
      const decimals = key === 'gpa' ? 2 : 0;
      const suffix = key === 'attendance' ? '%' : '';

      if (reduceMotion) {
        el.textContent = target.toFixed(decimals) + suffix;
        return;
      }

      const start = performance.now();
      const duration = 700;
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (target * eased).toFixed(decimals) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---- Views ---- */
  function showReportsOverview() {
    repDocuments.classList.add('hidden');
    repOverview.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  function generateDocument(doc) {
    const card = $('#doc-' + doc);
    card.classList.add('doc-loading');
    setTimeout(() => {
      generatedAt[doc] = new Date();
      renderDocument(doc);
      card.classList.remove('doc-loading');
      showToast(`${DOC_LABELS[doc]} generated.`);
    }, 700);
  }

  function openDocument(doc, action) {
    repOverview.classList.add('hidden');
    repDocuments.classList.remove('hidden');

    // Show only the chosen report; the tabs switch between them
    $$('.doc-card').forEach((c) => c.classList.toggle('hidden', c.id !== 'doc-' + doc));
    $$('.rep-doc-tab').forEach((tab) => {
      const active = tab.dataset.docTab === doc;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    const card = $('#doc-' + doc);
    window.scrollTo(0, 0);
    if (action === 'generate') generateDocument(doc);

    card.classList.remove('doc-flash');
    void card.offsetWidth; // restart the highlight animation
    card.classList.add('doc-flash');
  }

  /* ---- "Export CSV" (opens in Excel / Google Sheets) ---- */
  function csvRows(doc) {
    const head = [['Student Name', studentFullName()], ['Student ID', reportData.studentId], ['Course', reportData.program], ['Year Level', reportData.yearLevel], []];

    if (doc === 'report') {
      const rc = reportData.reportCard;
      const gwa = weighted(rc.subjects);
      return [['REPORT CARD', `${rc.term}, ${rc.ay}`], ...head, ['Subject', 'Units', 'Final Grade', 'Remarks'],
        ...rc.subjects.map((s) => [s.title, s.units, s.grade.toFixed(2), window.SIMSData.isPassing(s.grade) ? 'Passed' : 'Failed']),
        [], ['GWA', gwa.toFixed(2)], ['Academic Standing', standingFor(gwa, rc.subjects)]];
    }
    if (doc === 'enrollment') {
      const en = reportData.enrolled;
      return [['ENROLLMENT SUMMARY', `${en.term}, ${en.ay}`], ...head, ['Subject Code', 'Subject Title', 'Units', 'Section'],
        ...en.subjects.map((s) => [s.code, s.title, s.units, s.section]),
        [], ['Total Units', en.subjects.reduce((sum, s) => sum + s.units, 0)]];
    }
    if (doc === 'records') {
      const cumulative = window.SIMSData.cumulativeGwa();
      return [['ACADEMIC RECORDS', 'Academic History'], ...head, ['School Year', 'Semester', 'GWA', 'Academic Status'],
        ...recordRows().map((r) => [r.ay, r.sem, r.gwa.toFixed(2), r.status]),
        [], ['Cumulative GWA', cumulative === null ? '' : cumulative.toFixed(2)]];
    }
    const totals = attendanceTotals();
    return [['ATTENDANCE ANALYTICS', `${reportData.enrolled.term}, ${reportData.enrolled.ay}`], ...head,
      ['Subject', 'Sessions', 'Absent', 'Late', 'Excused', 'Attendance Rate (%)', 'Status'],
      ...reportData.attendance.subjects.map((s) => {
        const rate = window.SIMSData.attendanceRate(s) || 0;
        return [s.title, s.held, s.absent, s.late, s.excused || 0, rate.toFixed(1), attendanceStatus(rate).label];
      }),
      [], ['Overall', totals.held, totals.absent, totals.late, totals.excused, totals.rate.toFixed(1), attendanceStatus(totals.rate).label]];
  }

  function exportCsv(doc) {
    const cell = (v) => {
      const text = String(v === undefined || v === null ? '' : v);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = csvRows(doc).map((row) => row.map(cell).join(',')).join('\r\n');
    // The BOM makes Excel read the file as UTF-8 (so names with n-tilde etc. show correctly)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BITS-SIMS ${DOC_LABELS[doc]} - ${studentFullName()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${DOC_LABELS[doc]} exported as CSV.`);
  }

  /* ---- "Download PDF" uses the browser's print dialog (Save as PDF) ---- */
  function downloadDocument(doc) {
    const paper = $('#paper-' + doc);
    const originalTitle = document.title;

    const cleanup = () => {
      paper.classList.remove('print-target');
      document.body.classList.remove('printing');
      document.title = originalTitle;
      window.removeEventListener('afterprint', cleanup);
    };

    paper.classList.add('print-target');
    document.body.classList.add('printing');
    document.title = `BITS-SIMS ${DOC_LABELS[doc]} - ${studentFullName()}`;
    window.addEventListener('afterprint', cleanup);

    showToast('Choose "Save as PDF" in the print dialog.', 'info');
    setTimeout(() => window.print(), 200);
  }

  pageReports.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('.rep-action');
    if (actionBtn) {
      openDocument(actionBtn.dataset.doc, actionBtn.dataset.action);
      return;
    }

    const statBtn = e.target.closest('.rep-stat');
    if (statBtn) {
      openDocument(statBtn.dataset.doc, 'view');
      return;
    }

    const docTab = e.target.closest('.rep-doc-tab');
    if (docTab) {
      openDocument(docTab.dataset.docTab, 'view');
      return;
    }

    const csvBtn = e.target.closest('.doc-csv');
    if (csvBtn) {
      exportCsv(csvBtn.dataset.csv);
      return;
    }

    const downloadBtn = e.target.closest('.doc-download');
    if (downloadBtn) {
      downloadDocument(downloadBtn.dataset.download);
      return;
    }

    if (e.target.closest('#repBack')) showReportsOverview();
  });

  /* =====================================================
     ACCOUNT SETTINGS
  ===================================================== */
  const accountContactForm = $('#accountContactForm');
  const passwordForm = $('#passwordForm');
  const pwMeter = $('#pwMeter');
  const pwMeterLabel = $('#pwMeterLabel');

  // Fill the contact form, identity card and notification switches from saved data
  function renderAccount() {
    $('#acctEmail').value = profile.personalEmail;
    $('#acctPhone').value = formatPhone(profile.phone);
    $('#acctAddress').value = profile.address;
    clearErrors(accountContactForm);

    $('[data-acct="studentId"]').textContent = reportData.studentId;
    $('[data-acct="program"]').textContent = reportData.program;
    $('[data-acct="schoolEmail"]').textContent = profile.email;

    $$('.switch').forEach((sw) => {
      sw.setAttribute('aria-checked', String(Boolean(profile.notifications[sw.dataset.notif])));
    });
  }

  // Clear a field's error as soon as the person edits it
  $$('.set-field input, .set-field textarea').forEach((input) => {
    input.addEventListener('input', () => setError(input.id, ''));
  });

  /* ---- Contact details ---- */
  accountContactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(accountContactForm);

    const email = $('#acctEmail').value.trim();
    const phoneRaw = $('#acctPhone').value.trim();
    const address = $('#acctAddress').value.trim();
    let phone = '';
    let valid = true;

    if (!email) {
      setError('acctEmail', 'Personal email is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('acctEmail', 'Enter a valid email address.');
      valid = false;
    }

    if (phoneRaw) {
      phone = normalizePhone(phoneRaw);
      if (!phone) {
        setError('acctPhone', 'Use a PH mobile number, e.g. 0917 123 4567.');
        valid = false;
      }
    }

    if (!valid) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    profile = Object.assign({}, profile, { personalEmail: email, phone, address });
    persistProfile();
    fillContact(); // keeps the Contact Information tab in sync (and refreshes this form)
    showToast('Contact details saved.');
  });

  $('#accountContactCancel').addEventListener('click', () => {
    renderAccount();
    showToast('Changes discarded.', 'info');
  });

  /* ---- Change password (checked and saved through auth.js) ---- */
  function passwordStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    return Math.max(1, score);
  }

  function updateMeter() {
    const level = passwordStrength($('#pwNew').value);
    pwMeter.dataset.level = level;
    pwMeterLabel.textContent = ['', 'Weak', 'Fair', 'Good', 'Strong'][level];
  }

  $('#pwNew').addEventListener('input', updateMeter);

  $$('.pw-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $('#' + btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
    });
  });

  passwordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors(passwordForm);

    const current = $('#pwCurrent').value;
    const next = $('#pwNew').value;
    const confirm = $('#pwConfirm').value;
    let valid = true;

    if (!current) {
      setError('pwCurrent', 'Enter your current password.');
      valid = false;
    } else if (studentAccount && !SIMSAuth.verify(studentAccount, current)) {
      setError('pwCurrent', 'Current password is incorrect.');
      valid = false;
    }

    const problem = SIMSAuth.passwordProblem(next);
    if (problem) {
      setError('pwNew', problem);
      valid = false;
    } else if (next === current) {
      setError('pwNew', 'Choose a password different from your current one.');
      valid = false;
    }

    if (!confirm) {
      setError('pwConfirm', 'Please confirm your new password.');
      valid = false;
    } else if (confirm !== next) {
      setError('pwConfirm', 'Passwords do not match.');
      valid = false;
    }

    if (!valid) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    if (studentAccount) SIMSAuth.setPassword(studentAccount.username, next);
    passwordForm.reset();
    $$('.pw-toggle').forEach((btn) => {
      $('#' + btn.dataset.target).type = 'password';
      btn.textContent = 'Show';
      btn.setAttribute('aria-pressed', 'false');
    });
    updateMeter();
    showToast('Password updated.');
  });

  /* ---- Notifications (saved as soon as a switch is flipped) ---- */
  $$('.switch').forEach((sw) => {
    sw.addEventListener('click', () => {
      const key = sw.dataset.notif;
      const on = !profile.notifications[key];
      profile.notifications[key] = on;
      sw.setAttribute('aria-checked', String(on));
      persistProfile();
      showToast(`${sw.getAttribute('aria-label')} notifications ${on ? 'on' : 'off'}.`, on ? 'success' : 'info');
    });
  });

  /* =====================================================
     DOCUMENT MANAGEMENT
  ===================================================== */
  const DM_KEY = 'bits-sims-documents';
  const DM_ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const DM_ALLOWED_EXT = /\.(pdf|jpe?g|png)$/i;
  const DM_MAX_BYTES = 5 * 1024 * 1024;

  const DM_STATUS = {
    verified: { label: 'Verified', cls: 'ok' },
    review: { label: 'Under review', cls: 'info' },
    rejected: { label: 'Rejected', cls: 'risk' },
    missing: { label: 'Not submitted', cls: 'warn' }
  };

  const DM_REQUESTABLE = [
    { id: 'cor', name: 'Certificate of Registration' },
    { id: 'coe', name: 'Certificate of Enrollment' },
    { id: 'tor', name: 'Transcript of Records' }
  ];

  const dmDefaults = () => ({
    requirements: [
      { id: 'psa', name: 'PSA Birth Certificate', status: 'verified', updated: '2026-10-03', note: '', file: null },
      { id: 'f138', name: 'Form 138 (Report Card)', status: 'verified', updated: '2026-10-05', note: '', file: null },
      { id: 'moral', name: 'Certificate of Good Moral Character', status: 'review', updated: '2026-10-24', note: '', file: null },
      { id: 'photo', name: '2\u00D72 ID Photo', status: 'rejected', updated: '2026-10-24', note: 'The photo is blurry. Please upload a clearer copy.', file: null },
      { id: 'medical', name: 'Medical Certificate', status: 'missing', updated: null, note: '', file: null }
    ],
    requests: {}
  });

  function loadDocs() {
    try {
      const saved = JSON.parse(localStorage.getItem(DM_KEY));
      if (saved && Array.isArray(saved.requirements)) {
        return { requirements: saved.requirements, requests: saved.requests || {} };
      }
    } catch (err) { /* fall through to defaults */ }
    return dmDefaults();
  }

  let docs = loadDocs();
  const dmFiles = {}; // real File objects, kept only for the current session (for previews)
  let dmFilter = 'all';
  let dmFlashId = null;
  let dmStagedFile = null;
  let dmRowUploadId = null;
  let dmModalUrl = null;
  let dmModalTrigger = null;

  function persistDocs() {
    try { localStorage.setItem(DM_KEY, JSON.stringify(docs)); } catch (err) { /* storage unavailable */ }
  }

  function mk(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function formatDate(iso) {
    if (!iso) return '\u2014';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const formatSize = (bytes) =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

  function validateDocFile(file) {
    if (!file) return 'No file selected.';
    if (!DM_ALLOWED_TYPES.includes(file.type) && !DM_ALLOWED_EXT.test(file.name)) {
      return 'Only PDF, JPG or PNG files are accepted.';
    }
    if (file.size > DM_MAX_BYTES) return 'That file is over 5 MB. Please pick a smaller one.';
    return '';
  }

  const needsAction = (r) => r.status === 'rejected' || r.status === 'missing';

  function docCounts() {
    const c = { verified: 0, review: 0, needs: 0, submitted: 0, all: docs.requirements.length };
    docs.requirements.forEach((r) => {
      if (r.status === 'verified') c.verified++;
      if (r.status === 'review') c.review++;
      if (needsAction(r)) c.needs++;
      if (r.status !== 'missing') c.submitted++;
    });
    return c;
  }

  /* ---- Rendering ---- */
  function renderDocuments() {
    const counts = docCounts();

    $$('[data-dm-stat]').forEach((node) => (node.textContent = counts[node.dataset.dmStat]));

    const chipLabels = { all: 'All', needs: 'Needs action', submitted: 'Submitted' };
    $$('.dm-chip').forEach((chip) => {
      const key = chip.dataset.filter;
      const active = key === dmFilter;
      chip.textContent = `${chipLabels[key]} (${counts[key]})`;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    const rows = docs.requirements.filter((r) =>
      dmFilter === 'all' ||
      (dmFilter === 'needs' && needsAction(r)) ||
      (dmFilter === 'submitted' && r.status !== 'missing')
    );

    const tbody = $('#dmTableBody');
    tbody.replaceChildren();

    rows.forEach((r) => {
      const tr = mk('tr');
      if (r.id === dmFlashId) tr.classList.add('dm-row-flash');

      const tdName = mk('td');
      tdName.appendChild(mk('div', 'dm-doc-name', r.name));
      if (r.status === 'rejected' && r.note) tdName.appendChild(mk('div', 'dm-note', r.note));

      const status = DM_STATUS[r.status];
      const tdStatus = mk('td');
      tdStatus.appendChild(mk('span', `dm-status ${status.cls}`, status.label));

      const tdDate = mk('td', '', formatDate(r.updated));

      const label = r.status === 'rejected' ? 'Replace' : r.status === 'missing' ? 'Upload' : 'View';
      const btn = mk('button', needsAction(r) ? 'btn-solid btn-sm' : 'btn-light btn-sm', label);
      btn.type = 'button';
      btn.dataset.id = r.id;
      btn.dataset.dmAction = needsAction(r) ? 'upload' : 'view';
      btn.setAttribute('aria-label', `${label} ${r.name}`);
      const tdAction = mk('td', 'dm-actions-col');
      tdAction.appendChild(btn);

      tr.append(tdName, tdStatus, tdDate, tdAction);
      tbody.appendChild(tr);
    });
    dmFlashId = null;

    const empty = $('#dmEmpty');
    empty.classList.toggle('hidden', rows.length > 0);
    empty.textContent =
      dmFilter === 'needs' ? 'Nothing needs your action right now.' : 'No documents submitted yet.';

    renderRequests();
    if (dmStagedFile) fillTargetOptions();
  }

  function renderRequests() {
    const list = $('#dmRequests');
    list.replaceChildren();

    DM_REQUESTABLE.forEach((item) => {
      const requestedOn = docs.requests[item.id];
      const li = mk('li', 'dm-request-row');

      const text = mk('div');
      text.appendChild(mk('strong', '', item.name));
      if (requestedOn) text.appendChild(mk('small', '', `Requested ${formatDate(requestedOn)} \u00B7 Processing`));

      const btn = mk('button', requestedOn ? 'btn-light btn-sm requested' : 'btn-light btn-sm', requestedOn ? 'Cancel' : 'Request');
      btn.type = 'button';
      btn.dataset.req = item.id;
      btn.setAttribute('aria-label', `${requestedOn ? 'Cancel request for' : 'Request'} ${item.name}`);

      li.append(text, btn);
      list.appendChild(li);
    });
  }

  /* ---- Filters ---- */
  $$('.dm-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      dmFilter = chip.dataset.filter;
      renderDocuments();
    });
  });

  $('#dmNeedsStat').addEventListener('click', () => {
    dmFilter = 'needs';
    renderDocuments();
    $('#dmRequirements').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  /* ---- Submitting files ---- */
  function submitFile(id, file) {
    const error = validateDocFile(file);
    if (error) {
      showToast(error, 'error');
      return false;
    }

    const req = docs.requirements.find((r) => r.id === id);
    if (!req) return false;

    if (req.status === 'verified' &&
        !window.confirm(`"${req.name}" is already verified. Uploading a new file will send it back for review. Continue?`)) {
      return false;
    }

    Object.assign(req, {
      status: 'review',
      updated: isoToday(),
      note: '',
      file: { name: file.name, size: file.size, type: file.type }
    });
    dmFiles[id] = file;
    dmFlashId = id;

    persistDocs();
    renderDocuments();
    showToast(`${req.name} submitted for review.`);
    return true;
  }

  // Upload / Replace buttons in the table pick a file straight for that row
  $('#dmTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dm-action]');
    if (!btn) return;

    if (btn.dataset.dmAction === 'view') {
      openDocModal(btn.dataset.id, btn);
    } else {
      dmRowUploadId = btn.dataset.id;
      const input = $('#dmRowFileInput');
      input.value = '';
      input.click();
    }
  });

  $('#dmRowFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && dmRowUploadId) submitFile(dmRowUploadId, file);
    dmRowUploadId = null;
  });

  /* ---- "Upload a document" card: choose or drop a file, then say what it's for ---- */
  function fillTargetOptions() {
    const select = $('#dmTarget');
    const previous = select.value;
    select.replaceChildren();

    docs.requirements.forEach((r) => {
      const option = document.createElement('option');
      option.value = r.id;
      option.textContent = `${r.name} \u2014 ${DM_STATUS[r.status].label}`;
      select.appendChild(option);
    });

    const firstNeeded = docs.requirements.find(needsAction);
    const keep = previous && docs.requirements.some((r) => r.id === previous);
    select.value = keep ? previous : (firstNeeded || docs.requirements[0]).id;
  }

  function stageFile(file) {
    const error = validateDocFile(file);
    if (error) {
      showToast(error, 'error');
      return;
    }
    dmStagedFile = file;
    $('#dmStagedName').textContent = file.name;
    $('#dmStagedSize').textContent = formatSize(file.size);
    $('#dmDzEmpty').classList.add('hidden');
    $('#dmStaged').classList.remove('hidden');
    fillTargetOptions();
  }

  function clearStaged() {
    dmStagedFile = null;
    $('#dmFileInput').value = '';
    $('#dmStaged').classList.add('hidden');
    $('#dmDzEmpty').classList.remove('hidden');
  }

  $('#dmChoose').addEventListener('click', () => $('#dmFileInput').click());
  $('#dmFileInput').addEventListener('change', (e) => stageFile(e.target.files[0]));

  const dmDropzone = $('#dmDropzone');
  ['dragenter', 'dragover'].forEach((evt) =>
    dmDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dmDropzone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dmDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dmDropzone.classList.remove('dragover');
    })
  );
  dmDropzone.addEventListener('drop', (e) => stageFile(e.dataTransfer.files[0]));

  $('#dmSubmitStaged').addEventListener('click', () => {
    if (dmStagedFile && submitFile($('#dmTarget').value, dmStagedFile)) clearStaged();
  });
  $('#dmCancelStaged').addEventListener('click', clearStaged);

  /* ---- Requesting official documents ---- */
  $('#dmRequests').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-req]');
    if (!btn) return;

    const item = DM_REQUESTABLE.find((r) => r.id === btn.dataset.req);
    if (docs.requests[item.id]) {
      delete docs.requests[item.id];
      showToast(`Request for ${item.name} cancelled.`, 'info');
    } else {
      docs.requests[item.id] = isoToday();
      showToast(`Request for ${item.name} sent to the registrar.`);
    }
    persistDocs();
    renderRequests();
  });

  /* ---- View dialog ---- */
  const dmModal = $('#dmModal');

  function openDocModal(id, trigger) {
    const req = docs.requirements.find((r) => r.id === id);
    if (!req) return;

    const body = $('#dmModalBody');
    body.replaceChildren();
    $('#dmModalTitle').textContent = req.name;

    const status = DM_STATUS[req.status];
    body.appendChild(mk('span', `dm-status ${status.cls}`, status.label));

    const list = mk('dl', 'dm-modal-list');
    [
      ['Last updated', formatDate(req.updated)],
      ['File', req.file ? req.file.name : '\u2014'],
      ['Size', req.file ? formatSize(req.file.size) : '\u2014']
    ].forEach(([key, value]) => {
      const row = mk('div');
      row.append(mk('dt', '', key), mk('dd', '', value));
      list.appendChild(row);
    });
    body.appendChild(list);

    const download = $('#dmModalDownload');
    download.classList.add('hidden');
    download.removeAttribute('href');

    const file = dmFiles[id];
    if (file) {
      dmModalUrl = URL.createObjectURL(file);
      const preview = mk('div', 'dm-preview');

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = dmModalUrl;
        img.alt = `Preview of ${file.name}`;
        preview.appendChild(img);
      } else {
        const frame = document.createElement('iframe');
        frame.src = dmModalUrl;
        frame.title = `Preview of ${file.name}`;
        preview.appendChild(frame);
      }
      body.appendChild(preview);

      download.href = dmModalUrl;
      download.download = file.name;
      download.classList.remove('hidden');
    } else {
      body.appendChild(mk('p', 'dm-modal-note', req.file
        ? 'A preview is only available during the session the file was uploaded.'
        : 'Sample record \u2014 this prototype has no stored file to preview.'));
    }

    dmModalTrigger = trigger;
    dmModal.classList.remove('hidden');
    $('#dmModalDone').focus();
  }

  function closeDocModal() {
    dmModal.classList.add('hidden');
    if (dmModalUrl) {
      URL.revokeObjectURL(dmModalUrl);
      dmModalUrl = null;
    }
    $('#dmModalBody').replaceChildren();
    if (dmModalTrigger && document.contains(dmModalTrigger)) dmModalTrigger.focus();
    dmModalTrigger = null;
  }

  $('#dmModalClose').addEventListener('click', closeDocModal);
  $('#dmModalDone').addEventListener('click', closeDocModal);
  dmModal.addEventListener('click', (e) => {
    if (e.target === dmModal) closeDocModal();
  });

  document.addEventListener('keydown', (e) => {
    if (dmModal.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      closeDocModal();
      return;
    }

    if (e.key === 'Tab') {
      // Keep keyboard focus inside the dialog
      const focusable = $$('button, a[href]', dmModal).filter((n) => n.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* =====================================================
     ADMISSIONS & ENROLLMENT
     (applications and dates below are sample data)
  ===================================================== */
  const ADM_KEY = 'bits-sims-admissions';
  const ADM_TYPES = { freshman: 'Freshman', transferee: 'Transferee', returnee: 'Returnee' };
  const ADM_TABS = ['overview', 'new', 'status', 'enroll'];
  const ADM_MIN_UNITS = 12;
  const ADM_MAX_UNITS = 24;

  const ADM_STATUS = {
    pending: { label: 'Pending', cls: 'warn', info: 'Submitted and waiting to be verified.' },
    review: { label: 'Under Review', cls: 'info', info: 'The admissions office is evaluating your credentials.' },
    accepted: { label: 'Accepted', cls: 'ok', info: 'You are admitted. Continue to enrollment.' },
    rejected: { label: 'Rejected', cls: 'risk', info: 'Not selected for this term. Review the reasons why.' },
    withdrawn: { label: 'Withdrawn', cls: 'muted', info: 'Application cancelled. No further action needed.' },
    enrolled: { label: 'Enrolled', cls: 'ok', info: 'You completed enrollment for this term.' }
  };
  const ADM_LEGEND_ORDER = ['pending', 'review', 'accepted', 'rejected', 'withdrawn'];

  const ADM_OFFERINGS = [
    { code: 'CS 101', title: 'Introduction to Computing', units: 3 },
    { code: 'CS 102', title: 'Computer Programming 1', units: 3 },
    { code: 'GE-MMW', title: 'Mathematics in the Modern World', units: 3 },
    { code: 'GE-UTS', title: 'Understanding the Self', units: 3 },
    { code: 'GE-RPH', title: 'Readings in Philippine History', units: 3 },
    { code: 'PE 1', title: 'Physical Fitness and Wellness', units: 2 },
    { code: 'NSTP 1', title: 'National Service Training Program 1', units: 3 }
  ];

  const ADM_CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const ADM_X = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ADM_FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M9 14h6"/></svg>';

  const admDefaults = () => ({
    currentId: 'ADM-2026-004821',
    applications: [
      {
        id: 'ADM-2026-004821', program: 'BS Computer Science', type: 'freshman',
        term: '1st Semester, AY 2027\u20132028', submitted: '2026-10-06',
        verified: '2026-10-08', verifiedTime: '10:42 AM', decision: '2026-10-21',
        status: 'accepted', studentId: 'S-2027-00412', completedOn: null,
        remarks: 'Congratulations on your admission. Please confirm your slot and complete your student registration so we can issue your student record. (Sample remark from the admissions office.)'
      },
      {
        id: 'ADM-2026-004822', program: 'BS Information Technology', type: 'freshman',
        term: '1st Semester, AY 2027\u20132028', submitted: '2026-10-06',
        verified: '2026-10-08', verifiedTime: '10:51 AM', decision: null,
        status: 'review', studentId: null, completedOn: null, remarks: ''
      },
      {
        id: 'ADM-2026-001377', program: 'BS Nursing', type: 'freshman',
        term: '1st Semester, AY 2026\u20132027', submitted: '2026-07-12',
        verified: null, verifiedTime: '', decision: null,
        status: 'withdrawn', studentId: null, completedOn: null, remarks: ''
      }
    ],
    enrollment: {
      confirmedOn: '2026-10-25',
      step2Done: false,
      personal: null,
      draft: null,
      requirementsDone: false,
      enlisted: null,
      completedOn: null
    }
  });

  function loadAdm() {
    try {
      const saved = JSON.parse(localStorage.getItem(ADM_KEY));
      if (saved && Array.isArray(saved.applications) && saved.enrollment) return saved;
    } catch (err) { /* fall through to defaults */ }
    return admDefaults();
  }

  let adm = loadAdm();

  function persistAdm() {
    try { localStorage.setItem(ADM_KEY, JSON.stringify(adm)); } catch (err) { /* storage unavailable */ }
  }

  const pageAdm = $('#page-admissions');
  const admApp = (id) => adm.applications.find((a) => a.id === id);
  const admCurrent = () => admApp(adm.currentId) || adm.applications[0] || null;
  const admEnrollApp = () => adm.applications.find((a) => a.status === 'accepted' || a.status === 'enrolled') || null;
  const admBadge = (status) => `<span class="dm-status ${ADM_STATUS[status].cls}">${ADM_STATUS[status].label}</span>`;

  /* ---- Confirm dialog (returns a Promise<boolean>) ---- */
  const confirmModal = $('#confirmModal');
  let confirmResolve = null;
  let confirmTrigger = null;

  function askConfirm({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
      confirmTrigger = document.activeElement;
      $('#confirmTitle').textContent = title;
      $('#confirmMsg').textContent = message;
      const ok = $('#confirmOk');
      ok.textContent = confirmLabel;
      ok.classList.toggle('btn-danger', danger);
      $('#confirmCancel').textContent = cancelLabel;
      confirmModal.classList.remove('hidden');
      $('#confirmCancel').focus();
    });
  }

  function closeConfirm(result) {
    if (confirmModal.classList.contains('hidden')) return;
    confirmModal.classList.add('hidden');
    const resolve = confirmResolve;
    confirmResolve = null;
    if (confirmTrigger && document.contains(confirmTrigger)) confirmTrigger.focus();
    if (resolve) resolve(result);
  }

  $('#confirmOk').addEventListener('click', () => closeConfirm(true));
  $('#confirmCancel').addEventListener('click', () => closeConfirm(false));
  $('#confirmClose').addEventListener('click', () => closeConfirm(false));
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirm(false);
  });

  document.addEventListener('keydown', (e) => {
    if (confirmModal.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      closeConfirm(false);
    } else if (e.key === 'Tab') {
      const focusable = $$('button', confirmModal).filter((n) => n.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ---- Progress steps for one application ---- */
  function appSteps(app) {
    const s = app.status;
    const afterVerify = ['review', 'accepted', 'rejected', 'enrolled'].includes(s);
    const afterReview = ['accepted', 'rejected', 'enrolled'].includes(s);
    const admitted = s === 'accepted' || s === 'enrolled';
    const skip = (label, title, detail) => ({ label, sub: '\u2014', title, detail, state: 'skip' });

    const steps = [{
      label: 'Submitted', sub: formatDate(app.submitted),
      title: 'Application submitted', detail: formatDate(app.submitted), state: 'done'
    }];

    if (s === 'withdrawn') {
      steps.push(
        skip('Verified', 'Verification', 'Application withdrawn'),
        skip('Under review', 'Review', 'Application withdrawn'),
        skip('Decision', 'Decision', 'Application withdrawn'),
        skip('Enrolled', 'Enrollment', 'Application withdrawn')
      );
      return steps;
    }

    steps.push(afterVerify
      ? {
          label: 'Verified', sub: formatDate(app.verified),
          title: 'Verified by the admissions office',
          detail: formatDate(app.verified) + (app.verifiedTime ? ` \u00B7 ${app.verifiedTime}` : ''),
          state: 'done'
        }
      : {
          label: 'Verified', sub: 'Waiting', title: 'Verification',
          detail: 'Waiting for the admissions office to verify your documents', state: 'current'
        });

    if (afterReview) {
      steps.push({ label: 'Under review', sub: 'Completed', title: 'Under review', detail: 'Review completed', state: 'done' });
    } else if (s === 'review') {
      steps.push({ label: 'Under review', sub: 'In progress', title: 'Under review', detail: 'The admissions office is evaluating your credentials', state: 'current' });
    } else {
      steps.push({ label: 'Under review', sub: '', title: 'Under review', detail: 'Starts after verification', state: 'todo' });
    }

    if (admitted) {
      steps.push({ label: 'Decision: Accepted', sub: formatDate(app.decision), title: 'Decision released: Accepted', detail: formatDate(app.decision), state: 'done' });
    } else if (s === 'rejected') {
      steps.push({ label: 'Decision: Rejected', sub: formatDate(app.decision), title: 'Decision released: Rejected', detail: formatDate(app.decision), state: 'fail' });
    } else {
      steps.push({ label: 'Decision', sub: '', title: 'Decision', detail: 'Pending', state: 'todo' });
    }

    if (s === 'enrolled') {
      steps.push({ label: 'Enrolled', sub: formatDate(app.completedOn), title: 'Enrollment', detail: 'Enrollment completed', state: 'done' });
    } else if (s === 'accepted') {
      steps.push({ label: 'Enrolled', sub: 'Action needed', title: 'Enrollment', detail: 'Action needed: confirm your slot and complete registration', state: 'current' });
    } else if (s === 'rejected') {
      steps.push(skip('Enrolled', 'Enrollment', 'Not applicable'));
    } else {
      steps.push({ label: 'Enrolled', sub: '', title: 'Enrollment', detail: 'Available once you are accepted', state: 'todo' });
    }

    return steps;
  }

  const stepDot = (state, number) =>
    state === 'done' ? ADM_CHECK : state === 'fail' ? ADM_X : state === 'skip' ? '\u2013' : number;

  /* ---- Tabs ---- */
  function admShowTab(name) {
    ADM_TABS.forEach((tab) => {
      const on = tab === name;
      $('#adm-' + tab).classList.toggle('hidden', !on);
      const btn = $(`[data-adm-tab="${tab}"]`);
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
    });

    if (name === 'overview') renderAdmOverview();
    if (name === 'new') prepAdmForm();
    if (name === 'status') renderAdmStatus();
    if (name === 'enroll') renderAdmEnrollment();
    window.scrollTo(0, 0);
  }

  $$('.adm-tab').forEach((tab) => {
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const index = ADM_TABS.indexOf(tab.dataset.admTab);
      const next = ADM_TABS[(index + (e.key === 'ArrowRight' ? 1 : ADM_TABS.length - 1)) % ADM_TABS.length];
      admShowTab(next);
      $(`[data-adm-tab="${next}"]`).focus();
    });
  });

  /* ---- Overview ---- */
  function renderAdmOverview() {
    const app = admCurrent();
    const enrollApp = admEnrollApp();

    $('[data-adm="studentId"]').textContent = enrollApp && enrollApp.studentId ? enrollApp.studentId : 'Not yet assigned';

    // Current application card
    $('#admCurrent').innerHTML = app
      ? `<p class="adm-label">CURRENT APPLICATION</p>
         <h3 class="adm-cur-title">${esc(app.program)}</h3>
         <p class="adm-cur-meta">${esc(app.id)} &middot; ${esc(ADM_TYPES[app.type])} &middot; ${esc(app.term)}</p>
         <div class="adm-cur-foot">${admBadge(app.status)}<button type="button" class="btn-light btn-sm" data-adm-go="status">View application details</button></div>`
      : `<p class="adm-label">CURRENT APPLICATION</p>
         <h3 class="adm-cur-title">No application yet</h3>
         <p class="adm-cur-meta">Start one to begin your admission.</p>
         <div class="adm-cur-foot"><button type="button" class="btn-solid btn-sm" data-adm-go="new">Start an application</button></div>`;

    // Call-to-action card changes with the application's status
    let cta = { go: 'new', title: 'Start a new application', sub: 'Apply again' };
    if (app && app.status === 'accepted') cta = { go: 'enroll', title: 'Continue to enrollment', sub: 'Action needed' };
    else if (app && app.status === 'enrolled') cta = { go: 'enroll', title: 'Enrollment complete', sub: 'View your record' };
    else if (app && (app.status === 'pending' || app.status === 'review')) cta = { go: 'status', title: 'Track your application', sub: 'See where it stands' };

    const ctaBtn = $('#admCta');
    ctaBtn.dataset.admGo = cta.go;
    ctaBtn.innerHTML = `${ADM_FOLDER}<strong>${cta.title}</strong><small>${cta.sub}</small>`;

    // Stepper
    $('#admSteps').innerHTML = app
      ? appSteps(app).map((s, i) => `
          <li class="adm-step is-${s.state}">
            <span class="adm-step-dot">${stepDot(s.state, i + 1)}</span>
            <span class="adm-step-label">${esc(s.label)}</span>
            <span class="adm-step-sub">${esc(s.sub)}</span>
          </li>`).join('')
      : '<li class="en-note">Your progress will show here once you submit an application.</li>';

    // Applications table
    $('#admAppsBody').innerHTML = adm.applications.map((a) => `
      <tr data-adm-select="${esc(a.id)}" class="${a.id === (app && app.id) ? 'selected' : ''}">
        <td><button type="button" class="adm-link" data-adm-select="${esc(a.id)}">${esc(a.id)}</button></td>
        <td>${esc(a.program)}</td>
        <td>${esc(ADM_TYPES[a.type])}</td>
        <td>${formatDate(a.submitted)}</td>
        <td>${admBadge(a.status)}</td>
      </tr>`).join('');

    // Legend
    $('#admLegend').innerHTML = ADM_LEGEND_ORDER.map((key) =>
      `<li>${admBadge(key)}<span>${esc(ADM_STATUS[key].info)}</span></li>`).join('');
  }

  /* ---- New application ---- */
  const admForm = $('#admForm');
  const admSelectedType = () => admForm.querySelector('input[name="admType"]:checked').value;

  function updateAdmSummary() {
    $('#admSumType').textContent = ADM_TYPES[admSelectedType()];
    $('#admSumProgram').textContent = $('#admProgram').value || '\u2014';
    $('#admSumTerm').textContent = $('#admTerm').value;
    $('#admSumDate').textContent = formatDate(isoToday());
  }

  function resetAdmForm() {
    admForm.reset();
    clearErrors(admForm);
    $$('.set-error', admForm).forEach((n) => (n.textContent = ''));
    updateAdmSummary();
  }

  function prepAdmForm() {
    $('#admFormEmail').textContent = profile.personalEmail;
    updateAdmSummary();
  }

  function nextApplicationId() {
    const highest = adm.applications.reduce((max, a) => {
      const n = parseInt(a.id.split('-')[2], 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `ADM-${new Date().getFullYear()}-${String(highest + 1).padStart(6, '0')}`;
  }

  function submitNewApplication() {
    clearErrors(admForm);
    const program = $('#admProgram').value;
    const term = $('#admTerm').value;
    let valid = true;

    if (!program) {
      setError('admProgram', 'Choose the program you are applying for.');
      valid = false;
    } else if (adm.applications.some((a) =>
      a.program === program && a.term === term && a.status !== 'rejected' && a.status !== 'withdrawn')) {
      setError('admProgram', 'You already have an active application for this program and term.');
      valid = false;
    }

    if (!$('#admConfirm').checked) {
      setError('admConfirm', 'Please confirm before submitting.');
      valid = false;
    }

    if (!valid) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    const application = {
      id: nextApplicationId(), program, type: admSelectedType(), term,
      submitted: isoToday(), verified: null, verifiedTime: '', decision: null,
      status: 'pending', studentId: null, completedOn: null, remarks: ''
    };

    adm.applications.unshift(application);
    adm.currentId = application.id;
    persistAdm();
    resetAdmForm();
    admShowTab('overview');
    showToast(`Application ${application.id} submitted.`);
  }

  // Clear errors and refresh the summary as the form changes
  admForm.addEventListener('input', (e) => {
    if (e.target.id) setError(e.target.id, '');
    updateAdmSummary();
  });
  admForm.addEventListener('change', (e) => {
    if (e.target.id) setError(e.target.id, '');
    updateAdmSummary();
  });

  $('#admCancel').addEventListener('click', () => {
    resetAdmForm();
    admShowTab('overview');
  });

  /* ---- Application status ---- */
  function renderAdmStatus() {
    const root = $('#adm-status');
    const app = admCurrent();

    if (!app) {
      root.innerHTML = `<section class="dash-card dm-card adm-empty">
        <h3>No application selected</h3>
        <p>Submit an application to see its progress here.</p>
        <button type="button" class="btn-solid" data-adm-go="new">New application</button>
      </section>`;
      return;
    }

    const canEnroll = app.status === 'accepted' || app.status === 'enrolled';
    const withdrawable = ['pending', 'review', 'accepted'].includes(app.status);
    const steps = appSteps(app);

    const details = [
      ['Application no.', app.id],
      ['Date submitted', formatDate(app.submitted)],
      ['Admission type', ADM_TYPES[app.type]],
      ['Applied program', app.program],
      ['Intended term', app.term],
      ['Verified on', formatDate(app.verified)],
      ['Decision date', formatDate(app.decision)],
      ['Student ID', app.studentId || '\u2014']
    ];

    root.innerHTML = `
      <section class="dash-card dm-card adm-status-head">
        <div>
          <p class="adm-label">APPLICATION</p>
          <h2 class="adm-status-id">${esc(app.id)}</h2>
          <p class="adm-cur-meta">${esc(app.program)} &middot; ${esc(ADM_TYPES[app.type])} &middot; ${esc(app.term)}</p>
        </div>
        <div class="adm-status-side">
          ${admBadge(app.status)}
          ${canEnroll ? `<button type="button" class="btn-solid" data-adm-go="enroll">${app.status === 'enrolled' ? 'View enrollment' : 'Continue to enrollment'} &rarr;</button>` : ''}
        </div>
      </section>

      <div class="adm-status-layout">
        <div class="adm-stack">
          <section class="dash-card dm-card adm-card-pad">
            <h3 class="adm-sec-title">Progress</h3>
            <ol class="adm-timeline">
              ${steps.map((s, i) => `
                <li class="adm-tl is-${s.state}">
                  <span class="adm-step-dot">${stepDot(s.state, i + 1)}</span>
                  <span class="adm-tl-text"><strong>${esc(s.title)}</strong><small>${esc(s.detail)}</small></span>
                </li>`).join('')}
            </ol>
          </section>

          ${app.remarks ? `
            <section class="dash-card dm-card adm-card-pad">
              <h3 class="adm-sec-title">Decision remarks</h3>
              <blockquote class="adm-remarks">${esc(app.remarks)}</blockquote>
              <p class="adm-posted">Posted with your decision on ${formatDate(app.decision)}.</p>
            </section>` : ''}

          ${withdrawable ? '<button type="button" class="adm-withdraw" data-adm-action="withdraw">Withdraw this application</button>' : ''}
        </div>

        <aside class="dash-card dm-card adm-card-pad">
          <h3 class="adm-sec-title">Application details</h3>
          <dl class="set-info adm-kv">
            ${details.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
          </dl>
        </aside>
      </div>`;
  }

  async function withdrawCurrent() {
    const app = admCurrent();
    if (!app) return;

    const confirmed = await askConfirm({
      title: 'Withdraw application?',
      message: `This will cancel ${app.id} for ${app.program}. You can submit a new application later, but this one cannot be restored.`,
      confirmLabel: 'Withdraw',
      cancelLabel: 'Keep application',
      danger: true
    });
    if (!confirmed) return;

    app.status = 'withdrawn';
    persistAdm();
    renderAdmStatus();
    showToast(`${app.id} withdrawn.`, 'info');
  }

  /* ---- Enrollment ---- */
  function enrollStates() {
    const e = adm.enrollment;
    return [
      'done',
      e.step2Done ? 'done' : 'current',
      e.requirementsDone ? 'done' : (e.step2Done ? 'current' : 'locked'),
      e.enlisted ? 'done' : (e.requirementsDone ? 'current' : 'locked')
    ];
  }

  const enTag = { done: 'Done', current: 'In progress', locked: 'Locked' };

  const enStep = (n, title, sub, state, body = '') => `
    <section class="en-step ${state}" aria-labelledby="enStepTitle${n}">
      <div class="en-step-head">
        <span class="en-step-icon">${state === 'done' ? ADM_CHECK : n}</span>
        <div class="en-step-text"><h3 id="enStepTitle${n}">${title}</h3><p>${sub}</p></div>
        <span class="en-step-tag">${enTag[state]}</span>
      </div>
      ${body ? `<div class="en-step-body">${body}</div>` : ''}
    </section>`;

  const enField = (id, label, value, cls = '') => `
    <div class="set-field ${cls}">
      <label for="${id}">${label}</label>
      <input type="text" id="${id}" value="${esc(value || '')}" />
      <small class="set-error" id="${id}Error"></small>
    </div>`;

  function renderAdmEnrollment() {
    const root = $('#adm-enroll');
    const app = admEnrollApp();

    if (!app) {
      root.innerHTML = `
        <header class="adm-head"><div><h2>Enrollment</h2><p>Complete these steps to finish enrolling once you are accepted.</p></div></header>
        <section class="dash-card dm-card adm-empty">
          <h3>Enrollment isn't open yet</h3>
          <p>Enrollment opens once one of your applications is accepted.</p>
          <button type="button" class="btn-solid" data-adm-go="overview">Back to overview</button>
        </section>`;
      return;
    }

    const e = adm.enrollment;
    const states = enrollStates();
    const done = states.filter((s) => s === 'done').length;
    const finished = Boolean(e.enlisted);

    // Step 2: personal information
    const d = e.draft || e.personal || {
      first: profile.firstName, middle: '', last: profile.lastName,
      dob: '', mobile: formatPhone(profile.phone), address: profile.address
    };

    const step2Body = states[1] === 'current' ? `
      <form id="enPersonalForm" novalidate>
        <div class="en-form">
          ${enField('enFirst', 'First name', d.first)}
          ${enField('enMiddle', 'Middle name', d.middle)}
          ${enField('enLast', 'Last name', d.last)}
          <div class="set-field">
            <label for="enDob">Date of birth</label>
            <input type="date" id="enDob" value="${esc(d.dob || '')}" max="${isoToday()}" />
            <small class="set-error" id="enDobError"></small>
          </div>
          <div class="set-field">
            <label for="enMobile">Mobile number</label>
            <input type="tel" id="enMobile" value="${esc(d.mobile || '')}" placeholder="e.g. 0917 123 4567" inputmode="tel" />
            <small class="set-error" id="enMobileError"></small>
          </div>
          <div class="set-field full">
            <label for="enAddress">Home address</label>
            <textarea id="enAddress" rows="2" placeholder="Street, barangay, city, province">${esc(d.address || '')}</textarea>
            <small class="set-error" id="enAddressError"></small>
          </div>
        </div>
        <div class="set-actions" style="margin-top:0.9rem">
          <button type="submit" class="btn-solid">Save and continue</button>
          <button type="button" class="btn-light" data-adm-action="draft">Save draft</button>
        </div>
      </form>` : '';

    // Step 3: requirements (live from Document Management)
    const needs = docs.requirements.filter(needsAction);
    const submittedCount = docs.requirements.length - needs.length;
    const step3Body = states[2] === 'current' ? `
      <p class="en-note">${submittedCount} of ${docs.requirements.length} requirements submitted.</p>
      ${needs.length
        ? `<ul class="en-list">${needs.map((r) => `<li>${esc(r.name)} ${admDocBadge(r.status)}</li>`).join('')}</ul>`
        : '<p class="en-note">All requirements are in. You can continue.</p>'}
      <div class="set-actions">
        <button type="button" class="btn-light" data-adm-action="open-docs">Go to Document Management</button>
        <button type="button" class="btn-solid" data-adm-action="req-done" ${needs.length ? 'disabled' : ''}>Continue</button>
      </div>` : '';

    // Step 4: enlist subjects
    const enlistedList = e.enlisted ? ADM_OFFERINGS.filter((o) => e.enlisted.includes(o.code)) : [];
    const enlistedUnits = enlistedList.reduce((sum, o) => sum + o.units, 0);

    let step4Body = '';
    if (states[3] === 'current') {
      step4Body = `
        <div id="enSubjects" class="en-subjects">
          ${ADM_OFFERINGS.map((o) => `
            <label class="en-subject">
              <input type="checkbox" value="${esc(o.code)}" data-units="${o.units}" checked />
              <span><strong>${esc(o.code)}</strong> ${esc(o.title)}</span>
              <em>${o.units} units</em>
            </label>`).join('')}
        </div>
        <p class="en-units" id="enUnitsLine"></p>
        <div class="set-actions">
          <button type="button" class="btn-solid" id="enConfirmBtn" data-adm-action="confirm-subjects">Confirm enlistment</button>
        </div>`;
    } else if (finished) {
      step4Body = `<ul class="en-list">${enlistedList.map((o) => `<li><span><strong>${esc(o.code)}</strong> ${esc(o.title)}</span><span>${o.units} units</span></li>`).join('')}</ul>`;
    }

    const sub = {
      1: `You confirmed on ${formatDate(e.confirmedOn)}`,
      2: states[1] === 'done' ? `Saved on ${formatDate(e.personal && e.personal.savedOn)}` : 'Tell us a few details for your student record',
      3: states[2] === 'locked' ? 'Opens when step 2 is done' : states[2] === 'done' ? 'All requirements submitted' : 'Upload anything that is missing or rejected',
      4: states[3] === 'locked' ? 'Opens when steps 1\u20133 are complete'
        : finished ? `${enlistedList.length} subjects &middot; ${enlistedUnits} units &middot; ${formatDate(e.completedOn)}`
        : `Choose ${ADM_MIN_UNITS}\u2013${ADM_MAX_UNITS} units for ${esc(app.term)}`
    };

    root.innerHTML = `
      <header class="adm-head">
        <div>
          <h2>Enrollment</h2>
          <p>Complete these steps to finish enrolling in ${esc(app.term)}.</p>
        </div>
      </header>

      <div class="en-layout">
        <div class="en-main">
          ${finished ? `<div class="en-banner">You're officially enrolled for ${esc(app.term)}. Your student record is now active.</div>` : ''}
          ${enStep(1, 'Accept your admission offer', sub[1], states[0])}
          ${enStep(2, 'Student registration: personal information', sub[2], states[1], step2Body)}
          ${enStep(3, 'Submit your requirements', sub[3], states[2], step3Body)}
          ${enStep(4, 'Enlist your subjects', sub[4], states[3], step4Body)}
        </div>

        <aside class="en-side">
          <section class="dash-card dm-card en-record">
            <h3 class="adm-sec-title">Your student record</h3>
            <dl class="set-info adm-kv">
              <div><dt>Student ID</dt><dd>${esc(app.studentId || '\u2014')}</dd></div>
              <div><dt>Program</dt><dd>${esc(app.program)}</dd></div>
              <div><dt>Term</dt><dd>${esc(app.term)}</dd></div>
              <div><dt>Application</dt><dd>${esc(app.id)}</dd></div>
            </dl>
          </section>

          <section class="dash-card dm-card en-progress">
            <strong>Enrollment progress</strong>
            <small>${done} of 4 steps</small>
            <div class="en-bar" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${done}" aria-label="Enrollment progress"><span style="width:${done * 25}%"></span></div>
          </section>
        </aside>
      </div>`;

    if (states[3] === 'current') updateEnUnits();
  }

  const admDocBadge = (status) => `<span class="dm-status ${DM_STATUS[status].cls}">${DM_STATUS[status].label}</span>`;

  function updateEnUnits() {
    const boxes = $$('#enSubjects input:checked');
    const total = boxes.reduce((sum, box) => sum + Number(box.dataset.units), 0);
    const ok = total >= ADM_MIN_UNITS && total <= ADM_MAX_UNITS;
    const line = $('#enUnitsLine');

    line.textContent = `Total units: ${total} (minimum ${ADM_MIN_UNITS}, maximum ${ADM_MAX_UNITS})`;
    line.classList.toggle('bad', !ok);
    $('#enConfirmBtn').disabled = !ok;
  }

  function readPersonalForm() {
    return {
      first: $('#enFirst').value.trim(),
      middle: $('#enMiddle').value.trim(),
      last: $('#enLast').value.trim(),
      dob: $('#enDob').value,
      mobile: $('#enMobile').value.trim(),
      address: $('#enAddress').value.trim()
    };
  }

  function savePersonalStep() {
    const form = $('#enPersonalForm');
    clearErrors(form);
    const data = readPersonalForm();
    let valid = true;

    if (!data.first) { setError('enFirst', 'First name is required.'); valid = false; }
    if (!data.last) { setError('enLast', 'Last name is required.'); valid = false; }

    if (!data.dob) {
      setError('enDob', 'Enter your date of birth.');
      valid = false;
    } else if (data.dob > isoToday()) {
      setError('enDob', 'Date of birth cannot be in the future.');
      valid = false;
    }

    const mobile = data.mobile ? normalizePhone(data.mobile) : null;
    if (!mobile) {
      setError('enMobile', data.mobile ? 'Use a PH mobile number, e.g. 0917 123 4567.' : 'Mobile number is required.');
      valid = false;
    }

    if (data.address.length < 5) { setError('enAddress', 'Enter your complete home address.'); valid = false; }

    if (!valid) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    adm.enrollment.personal = Object.assign({}, data, { mobile, savedOn: isoToday() });
    adm.enrollment.draft = null;
    adm.enrollment.step2Done = true;
    persistAdm();
    renderAdmEnrollment();
    showToast('Personal information saved.');
  }

  function saveDraftStep() {
    adm.enrollment.draft = readPersonalForm();
    persistAdm();
    showToast('Draft saved.', 'info');
  }

  function finishRequirementsStep() {
    if (docs.requirements.some(needsAction)) {
      showToast('Some requirements still need your action.', 'error');
      return;
    }
    adm.enrollment.requirementsDone = true;
    persistAdm();
    renderAdmEnrollment();
    showToast('Requirements step complete.');
  }

  function confirmEnlistment() {
    const codes = $$('#enSubjects input:checked').map((box) => box.value);
    const units = ADM_OFFERINGS.filter((o) => codes.includes(o.code)).reduce((sum, o) => sum + o.units, 0);
    if (units < ADM_MIN_UNITS || units > ADM_MAX_UNITS) return;

    const app = admEnrollApp();
    adm.enrollment.enlisted = codes;
    adm.enrollment.completedOn = isoToday();
    if (app) {
      app.status = 'enrolled';
      app.completedOn = adm.enrollment.completedOn;
    }
    persistAdm();
    renderAdmEnrollment();
    showToast(`You're enrolled for ${app ? app.term : 'the term'}!`);
  }

  /* ---- Page-level events ---- */
  pageAdm.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-adm-tab]');
    if (tabBtn) {
      admShowTab(tabBtn.dataset.admTab);
      return;
    }

    const go = e.target.closest('[data-adm-go]');
    if (go) {
      admShowTab(go.dataset.admGo);
      return;
    }

    const select = e.target.closest('[data-adm-select]');
    if (select) {
      adm.currentId = select.dataset.admSelect;
      persistAdm();
      renderAdmOverview();
      return;
    }

    const action = e.target.closest('[data-adm-action]');
    if (!action) return;

    switch (action.dataset.admAction) {
      case 'withdraw': withdrawCurrent(); break;
      case 'draft': saveDraftStep(); break;
      case 'open-docs': setActivePage($('.sidebar-item[data-page="documents"]')); break;
      case 'req-done': finishRequirementsStep(); break;
      case 'confirm-subjects': confirmEnlistment(); break;
      default: break;
    }
  });

  pageAdm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'admForm') submitNewApplication();
    else if (e.target.id === 'enPersonalForm') savePersonalStep();
  });

  pageAdm.addEventListener('change', (e) => {
    if (e.target.closest('#enSubjects')) updateEnUnits();
  });

  pageAdm.addEventListener('input', (e) => {
    if (e.target.closest('#enPersonalForm') && e.target.id) setError(e.target.id, '');
  });

  /* =====================================================
     ACADEMIC RECORDS (Module 3)
     Grades come from the shared data store (data.js), the same
     source the Reports page uses, and the page redraws itself
     whenever that data changes. Students only see POSTED grades.
  ===================================================== */
  const REC = window.SIMSData;
  let recSelected = REC.currentTerm().id;

  // Rounds to two decimals without floating-point surprises (1.7875 -> 1.79)
  function fmtGwa(value) {
    return (Math.round(Number(value.toPrecision(12)) * 100) / 100).toFixed(2);
  }

  const recUnits = (subjects) => subjects.reduce((sum, s) => sum + s.units, 0);

  // "1st Semester" + "2026-2027" -> "1st Sem, AY 2026-27"
  const recTermLabel = (t) => `${t.sem.replace('Semester', 'Sem')}, AY ${t.ay.slice(0, 4)}\u2013${t.ay.slice(7, 9)}`;

  const REC_REMARKS = {
    passed: '<span class="dm-status ok">Passed</span>',
    failed: '<span class="dm-status risk">Failed</span>',
    inc: '<span class="dm-status warn">Incomplete</span>',
    pending: '<span class="dm-status info">Awaiting release</span>',
    inprogress: '<span class="dm-status info">In progress</span>'
  };

  function renderRecRequest() {
    const requestedOn = docs.requests.tor;
    $('#recRequest').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>
      <strong>${requestedOn ? 'Transcript requested' : 'Request transcript of records'}</strong>
      ${requestedOn ? `<small>Requested ${esc(formatDate(requestedOn))} &middot; Processing. Track it in Document Management.</small>` : ''}`;
  }

  function renderRecords() {
    if (!REC.term(recSelected)) recSelected = REC.currentTerm().id;
    const term = REC.term(recSelected);
    const summary = REC.termSummary(term.id);
    const subjects = summary.subjects;
    const units = recUnits(subjects);
    const gwa = summary.gwa;
    const cumulative = REC.cumulativeGwa();

    // Student card
    $('[data-rec="program"]').textContent = reportData.program;
    $('[data-rec="idLine"]').textContent =
      `${reportData.studentId} \u00B7 ${reportData.yearLevel}, Section ${reportData.section.slice(-1)}`;

    // Stat cards
    $('#recTermGwa').textContent = gwa === null ? '\u2014' : fmtGwa(gwa);
    $('#recTermGwaSub').textContent = gwa === null ? 'Grades not yet posted' : summary.standing;
    $('#recUnits').textContent = units;
    $('#recUnitsSub').textContent = `${subjects.length} courses`;
    $('#recCumulative').textContent = cumulative === null ? '\u2014' : fmtGwa(cumulative);

    // Term chips (newest first)
    $('#recTerms').innerHTML = [...REC.terms()].reverse().map((t) => `
      <button type="button" class="dm-chip${t.id === term.id ? ' active' : ''}" data-term="${esc(t.id)}" aria-pressed="${t.id === term.id}">${esc(recTermLabel(t))}</button>`).join('');

    // Grades table
    const periods = REC.rules().gradingPeriods;
    $('#recBody').innerHTML = subjects.map((s) => {
      // While the final grade isn't out, show the period grades that are already posted
      const partial = typeof s.finalGrade === 'number' ? '' : periods
        .filter((p) => typeof s.grades[p.key] === 'number' || ['submitted', 'approved'].includes(s.gradeState[p.key]))
        .map((p) => `${esc(p.label)}: ${typeof s.grades[p.key] === 'number' ? s.grades[p.key].toFixed(2) : 'under review'}`)
        .join(' \u00B7 ');
      const grade = s.status === 'inc' ? 'INC' : typeof s.finalGrade === 'number' ? s.finalGrade.toFixed(2) : '\u2014';
      return `
        <tr>
          <td>${esc(s.code)}</td>
          <td>${esc(s.title)}</td>
          <td class="num">${s.units}</td>
          <td class="num">${grade}${partial ? `<small class="rec-partial">${partial}</small>` : ''}</td>
          <td>${REC_REMARKS[s.status] || REC_REMARKS.inprogress}</td>
        </tr>`;
    }).join('');

    $('#recFoot').innerHTML = `
      <tr>
        <td colspan="2">Total for this term</td>
        <td class="num">${units}</td>
        <td class="num">${gwa === null ? '\u2014' : fmtGwa(gwa)}</td>
        <td>${gwa === null ? '' : esc(summary.standing)}</td>
      </tr>`;

    $('#recNote').textContent = gwa !== null
      ? 'All grades for this term have been posted.'
      : 'Grades appear here once your instructors post them. This page updates by itself.';

    // Grading scale card follows the rules in data.js
    const r = REC.rules();
    $('.rec-scale-list').innerHTML = `
      <li><span>${r.scale[0].max.toFixed(2)}</span><strong>Highest</strong></li>
      <li><span>${r.passingGrade.toFixed(2)}</span><strong>Passing</strong></li>
      <li><span>${r.failedGrade.toFixed(2)}</span><strong>Failed</strong></li>`;

    renderRecRequest();
  }

  $('#recTerms').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-term]');
    if (!chip) return;
    recSelected = chip.dataset.term;
    renderRecords();
    const active = $(`#recTerms [data-term="${recSelected}"]`);
    if (active) active.focus();
  });

  // Live updates: redraw when grades change (e.g. a grade gets posted)
  let recLastSeen = JSON.stringify(REC.allSubjects());
  REC.subscribe(() => {
    const now = JSON.stringify(REC.allSubjects());
    const visibleChange = now !== recLastSeen;
    recLastSeen = now;
    renderRecords();
    if (visibleChange && !pages.records.classList.contains('hidden')) {
      showToast('Your academic records were updated.', 'info');
    }
  });

  $('#recRequest').addEventListener('click', async () => {
    // Already requested: take the person to where it can be tracked or cancelled
    if (docs.requests.tor) {
      setActivePage($('.sidebar-item[data-page="documents"]'));
      return;
    }

    const confirmed = await askConfirm({
      title: 'Request transcript of records?',
      message: 'Your request goes to the registrar. You can track or cancel it in Document Management.',
      confirmLabel: 'Send request',
      cancelLabel: 'Not now'
    });
    if (!confirmed) return;

    docs.requests.tor = isoToday();
    persistDocs();
    renderRequests();
    renderRecRequest();
    showToast('Request for Transcript of Records sent to the registrar.');
  });

  /* =====================================================
     ATTENDANCE
     (sample data; the Reports page reads its numbers from here)
  ===================================================== */
  const ATT_COURSES = [
    { code: 'ITP3112R', title: 'System Administration and Maintenance 1', start: '2026-08-06', count: 9, late: [4], absent: [] },
    { code: 'GEN-RP', title: 'Readings in Philippine History', start: '2026-09-04', count: 5, late: [], absent: [] },
    { code: 'ITP3111R', title: 'Network Management 2', start: '2026-08-17', count: 8, late: [6], absent: [3] },
    { code: 'ITA312R', title: 'Platform Technologies 3 (Cloud Computing)', start: '2026-08-25', count: 7, late: [2], absent: [] }
  ];

  const ATT_STATUS = {
    present: { label: 'Present', cls: 'ok' },
    late: { label: 'Late', cls: 'warn' },
    absent: { label: 'Absent', cls: 'risk' }
  };

  const attPad = (n) => String(n).padStart(2, '0');
  const pillTexts = $$('.course-pill').map((pill) => pill.textContent.trim());

  // Classes meet weekly: build one record per session from the start date
  function buildSessions(course) {
    const [y, m, d] = course.start.split('-').map(Number);
    return Array.from({ length: course.count }, (_, i) => {
      const date = new Date(y, m - 1, d + i * 7);
      return {
        iso: `${date.getFullYear()}-${attPad(date.getMonth() + 1)}-${attPad(date.getDate())}`,
        status: course.absent.includes(i) ? 'absent' : course.late.includes(i) ? 'late' : 'present'
      };
    });
  }

  const attRows = ATT_COURSES.map((course, i) => {
    const sessions = buildSessions(course);
    const held = sessions.length;
    const absent = sessions.filter((s) => s.status === 'absent').length;
    const late = sessions.filter((s) => s.status === 'late').length;
    const points = held - absent; // 1 point per attended session
    return {
      code: course.code,
      title: course.title,
      label: pillTexts[i] || course.title,
      sessions, held, absent, late, points,
      pct: held ? (points / held) * 100 : 0,
      last: held ? sessions[held - 1].iso : ''
    };
  });

  // Keep the Reports & Analytics figures in step with this page
  reportData.attendance.subjects = attRows.map((r) => ({
    title: r.title, held: r.held, absent: r.absent, late: r.late
  }));

  const attFmtShort = (iso) => {
    if (!iso) return '\u2014';
    const [y, m, d] = iso.split('-').map(Number);
    return `${m}-${d}-${y}`; // 10-1-2026, as on the dashboard
  };

  const attFmtLong = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const attTone = (pct) => (pct >= 95 ? 'ok' : pct >= 90 ? 'warn' : 'risk');

  let attSort = { key: null, dir: 1 };
  const attOpen = new Set();

  function renderAttendance() {
    const rows = [...attRows];
    if (attSort.key) {
      rows.sort((a, b) => {
        const va = a[attSort.key];
        const vb = b[attSort.key];
        return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * attSort.dir;
      });
    }

    $('#attBody').innerHTML = rows.map((r) => {
      const open = attOpen.has(r.code);
      const tone = attTone(r.pct);
      const main = `
        <tr class="att-row${open ? ' open' : ''}" data-att="${esc(r.code)}">
          <td>
            <button type="button" class="att-toggle" aria-expanded="${open}" aria-controls="attDetail-${esc(r.code)}">
              <span class="att-chev" aria-hidden="true">&#8250;</span>
              <span>${esc(r.label)}</span>
            </button>
          </td>
          <td>${attFmtShort(r.last)}</td>
          <td>${r.held} Sessions</td>
          <td>${r.points} / ${r.held}</td>
          <td>
            <span class="att-pct ${tone}">${r.pct.toFixed(2)}%</span>
            <span class="att-bar ${tone}" aria-hidden="true"><span style="width:${r.pct.toFixed(1)}%"></span></span>
          </td>
        </tr>`;

      const detail = open ? `
        <tr class="att-detail" id="attDetail-${esc(r.code)}">
          <td colspan="5">
            <div class="att-sessions">
              ${r.sessions.map((s) => `
                <div class="att-session">
                  <span>${esc(attFmtLong(s.iso))}</span>
                  <span class="dm-status ${ATT_STATUS[s.status].cls}">${ATT_STATUS[s.status].label}</span>
                </div>`).join('')}
            </div>
            <p class="att-summary">${r.held - r.absent - r.late} on time &middot; ${r.late} late &middot; ${r.absent} absent</p>
          </td>
        </tr>` : '';

      return main + detail;
    }).join('');

    const held = attRows.reduce((sum, r) => sum + r.held, 0);
    const points = attRows.reduce((sum, r) => sum + r.points, 0);
    const pct = held ? (points / held) * 100 : 0;
    $('#attFoot').innerHTML = `
      <tr>
        <td>Overall</td>
        <td></td>
        <td>${held} Sessions</td>
        <td>${points} / ${held}</td>
        <td><span class="att-pct ${attTone(pct)}">${pct.toFixed(2)}%</span></td>
      </tr>`;

    // Sort indicators
    $$('.att-sort').forEach((btn) => {
      const active = btn.dataset.sort === attSort.key;
      btn.closest('th').setAttribute('aria-sort', active ? (attSort.dir === 1 ? 'ascending' : 'descending') : 'none');
      $('.att-arrow', btn).textContent = active ? (attSort.dir === 1 ? '\u25B2' : '\u25BC') : '';
    });
  }

  $('#attBody').addEventListener('click', (e) => {
    const row = e.target.closest('.att-row');
    if (!row) return;

    const code = row.dataset.att;
    if (attOpen.has(code)) attOpen.delete(code);
    else attOpen.add(code);

    renderAttendance();
    const toggle = $(`.att-row[data-att="${code}"] .att-toggle`);
    if (toggle) toggle.focus();
  });

  $$('.att-sort').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sort;
      attSort = attSort.key === key ? { key, dir: -attSort.dir } : { key, dir: 1 };
      renderAttendance();
      $(`.att-sort[data-sort="${key}"]`).focus();
    });
  });

  renderAttendance();

  /* ---- Init ---- */
  renderDocuments();
  buildAcademicSummary();
  applyProfile();
  openTab('general');

  /* =====================================================
     ADMIN -> STUDENT SYNC
     When the registrar (another tab, or a previous session) changes a shared
     store, reload it here and refresh the screens that show it.
  ===================================================== */
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { profile = loadProfile(); setNames(); fillGeneral(); showToast('Your profile was updated by the registrar.', 'info'); }
    if (e.key === DM_KEY) { docs = loadDocs(); renderDocuments(); renderRequests(); renderRecRequest(); showToast('A document status was updated.', 'info'); }
    if (e.key === ADM_KEY) { adm = loadAdm(); renderAdmOverview(); renderAdmStatus(); showToast('Your admission status was updated.', 'info'); }
  });
});