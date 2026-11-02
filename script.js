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

  const toastEl = $('#toast');
  let toastTimer;

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  const defaults = {
    firstName: 'Dawson James',
    lastName: 'Garcia',
    email: 'dawson.garcia@bits.edu.ph',
    emailVisibility: 'course',
    city: 'Muntinlupa',
    country: 'Philippines',
    timezone: 'Asia/Manila',
    phone: '09171234567',
    avatar: DEFAULT_AVATAR
  };

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      return Object.assign({}, defaults, saved || {});
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

  const pages = {
    home: $('#page-home'),
    profile: $('#page-profile'),
    userprofile: $('#page-userprofile'),
    placeholder: $('#page-placeholder')
  };

  function showPage(item) {
    const key = item.dataset.page;
    Object.values(pages).forEach((page) => page.classList.add('hidden'));

    if (key === 'home' || key === 'profile') {
      pages[key].classList.remove('hidden');
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
  const generalForm = $('#generalForm');
  const pictureForm = $('#pictureForm');
  const contactForm = $('#contactForm');

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

  $$('.field input').forEach((input) => {
    input.addEventListener('input', () => setError(input.id, ''));
  });

  function formatPhone(digits) {
    if (!digits) return '';
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`.trim();
  }

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
  }

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
  }

  function applyProfile() {
    setNames();
    setAvatars(profile.avatar);
    fillGeneral();
    fillContact();
  }

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

  buildAcademicSummary();
  applyProfile();
  openTab('general');
});