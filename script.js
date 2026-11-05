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
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = $('#username').value.trim();
    const password = $('#password').value;

    if (!username || !password) {
      alert('Please fill in both Username/Email and Password.');
      return;
    }

    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
  });

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
    documents: $('#page-documents'),
    settings: $('#page-settings'),
    reports: $('#page-reports'),
    records: $('#page-records'),
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

    profile = Object.assign({}, profile, {
      firstName,
      lastName,
      email,
      emailVisibility: $('#emailVisibility').value,
      city: $('#city').value.trim(),
      country: $('#country').value,
      timezone: $('#timezone').value
    });

    persistProfile();
    setNames();
    showToast('Profile details saved.');
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
      <div class="paper-summary"><strong>Cumulative GWA: ${cumulative.toFixed(2)}</strong></div>
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

  /* ---- Change password (prototype: no server to verify the current password) ---- */
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
    }

    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      setError('pwNew', 'Use at least 8 characters with letters and numbers.');
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

  /* ---- Init ---- */
  renderDocuments();
  buildAcademicSummary();
  applyProfile();
  openTab('general');
});