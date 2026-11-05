/* =====================================================
   MODULE 3: ACADEMIC RECORD MANAGEMENT (student view)
   -----------------------------------------------------
   Reads everything from SIMSData (data.js) and re-renders
   whenever that data changes, so the page is always live.
===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.querySelector('#page-records');
  if (!page || !window.SIMSData) return;

  const D = window.SIMSData;
  const $ = (sel, root = page) => root.querySelector(sel);
  const $$ = (sel, root = page) => Array.from(root.querySelectorAll(sel));

  const STATUS = {
    passed: { label: 'Passed', cls: 'ok' },
    inprogress: { label: 'In progress', cls: 'info' },
    pending: { label: 'Awaiting release', cls: 'info' },
    inc: { label: 'Incomplete', cls: 'warn' },
    failed: { label: 'Failed', cls: 'risk' }
  };

  let termId = D.currentTerm().id;
  let filter = 'all';
  let flashIds = new Set();
  let lastSnapshot = snapshot();
  let lastChange = new Date();
  let openSubjectId = null;
  let modalTrigger = null;

  /* ---------- Helpers ---------- */
  function mk(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const fmtGrade = (g) => (typeof g === 'number' ? g.toFixed(2) : '—');

  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toast(message, type = 'success') {
    const el = document.querySelector('#toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast ${type} show`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function snapshot() {
    const map = {};
    // Student-visible version only, so unposted changes don't flash or notify
    D.allSubjects().forEach((s) => (map[s.id] = JSON.stringify({ ...s, updated: null, gradeStatus: null })));
    return map;
  }

  const isCompleted = (s) => !D.isOpen(s);

  /* ---------- Rendering ---------- */
  function renderStats() {
    const cumulative = D.cumulativeGwa();
    const completedTerms = D.terms().filter((t) => !t.current).length;
    const latest = D.lastCompletedTerm();
    const latestSummary = latest ? D.termSummary(latest.id) : null;
    const inProgress = D.allSubjects().filter(D.isOpen).length;

    const set = (key, text) => ($(`[data-rec-stat="${key}"]`).textContent = text);
    set('cumulative', cumulative === null ? '—' : cumulative.toFixed(2));
    set('cumulativeSub', `Across ${completedTerms} completed term${completedTerms === 1 ? '' : 's'}`);
    set('units', D.unitsEarned());
    set('unitsSub', `${inProgress} subject${inProgress === 1 ? '' : 's'} in progress`);
    set('standing', latestSummary ? latestSummary.standing : '—');
    set('standingSub', latest ? `${D.shortTermLabel(latest)} · Generate record →` : 'Generate academic record →');
  }

  function renderTermSelect() {
    const select = $('#recTerm');
    select.replaceChildren();
    [...D.terms()].reverse().forEach((t) => {
      const opt = mk('option', '', `${D.termLabel(t)}${t.current ? ' (current)' : ''}`);
      opt.value = t.id;
      opt.selected = t.id === termId;
      select.appendChild(opt);
    });
  }

  function renderTable() {
    const subjects = D.subjectsIn(termId);
    const counts = {
      all: subjects.length,
      inprogress: subjects.filter((s) => !isCompleted(s)).length,
      completed: subjects.filter(isCompleted).length
    };

    const chipLabels = { all: 'All', inprogress: 'In progress', completed: 'Completed' };
    $$('.rec-chip').forEach((chip) => {
      const key = chip.dataset.recFilter;
      const active = key === filter;
      chip.textContent = `${chipLabels[key]} (${counts[key]})`;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    const rows = subjects.filter((s) =>
      filter === 'all' ||
      (filter === 'inprogress' && !isCompleted(s)) ||
      (filter === 'completed' && isCompleted(s))
    );

    const tbody = $('#recTableBody');
    tbody.replaceChildren();

    rows.forEach((s) => {
      const tr = mk('tr');
      if (flashIds.has(s.id)) tr.classList.add('dm-row-flash');

      const tdName = mk('td');
      tdName.appendChild(mk('div', 'dm-doc-name', s.title));
      tdName.appendChild(mk('div', 'rec-sub', `${s.code} · ${s.instructor}`));

      const tdUnits = mk('td', 'rec-num', s.units.toFixed(1));

      const tdGrade = mk('td', 'rec-num rec-grade', fmtGrade(s.finalGrade));
      if (s.status === 'pending') {
        tdGrade.appendChild(mk('small', 'rec-sub', 'Final grade under review'));
      } else if (s.status === 'inprogress') {
        const periods = D.rules().gradingPeriods;
        const posted = periods.filter((p) => typeof s.grades[p.key] === 'number').length;
        tdGrade.appendChild(mk('small', 'rec-sub', `${posted}/${periods.length} periods posted`));
      } else if (typeof s.finalGrade === 'number') {
        tdGrade.appendChild(mk('small', 'rec-sub', D.verbal(s.finalGrade)));
      } else if (s.status === 'inc') {
        tdGrade.firstChild.textContent = 'INC';
      }

      const st = STATUS[s.status] || STATUS.inprogress;
      const tdStatus = mk('td');
      tdStatus.appendChild(mk('span', `dm-status ${st.cls}`, st.label));

      const tdDate = mk('td', '', fmtDate(s.updated));

      const btn = mk('button', 'btn-light btn-sm', 'View');
      btn.type = 'button';
      btn.dataset.recView = s.id;
      btn.setAttribute('aria-label', `View ${s.title}`);
      const tdAction = mk('td', 'dm-actions-col');
      tdAction.appendChild(btn);

      tr.append(tdName, tdUnits, tdGrade, tdStatus, tdDate, tdAction);
      tbody.appendChild(tr);
    });

    const empty = $('#recEmpty');
    empty.classList.toggle('hidden', rows.length > 0);
    empty.textContent = filter === 'inprogress'
      ? 'No subjects in progress for this term.'
      : filter === 'completed'
        ? 'No completed subjects yet. Final grades will appear here once posted.'
        : 'No subjects recorded for this term.';

    const summary = D.termSummary(termId);
    $('#recTermGwa').textContent = summary.gwa === null
      ? 'Term GWA: available once final grades are posted'
      : `Term GWA: ${summary.gwa.toFixed(2)} · ${summary.standing}`;
  }

  function renderHistory() {
    const list = $('#recHistory');
    list.replaceChildren();

    [...D.terms()].reverse().forEach((t) => {
      const summary = D.termSummary(t.id);
      const li = mk('li');
      const btn = mk('button', 'rec-history-row');
      btn.type = 'button';
      btn.dataset.recTerm = t.id;
      if (t.id === termId) btn.classList.add('active');
      btn.setAttribute('aria-pressed', String(t.id === termId));

      const left = mk('div');
      left.appendChild(mk('strong', '', `${t.sem.replace('Semester', 'Sem')} · AY ${t.ay}`));
      left.appendChild(mk('small', '', t.current ? `${summary.subjects.length} subjects · in progress` : summary.standing));

      const right = mk('span', 'rec-history-gwa', summary.gwa === null ? '—' : summary.gwa.toFixed(2));

      btn.append(left, right);
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function renderLive() {
    $('#recLiveTime').textContent = lastChange.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function renderScale() {
    const r = D.rules();
    $('#recScale').textContent = `Grading scale: ${r.scale[0].max.toFixed(2)} (highest) \u00B7 ${r.passingGrade.toFixed(2)} (passing) \u00B7 ${r.failedGrade.toFixed(2)} (failed)`;
  }

  function render() {
    renderScale();
    renderStats();
    renderTermSelect();
    renderTable();
    renderHistory();
    renderLive();
    if (openSubjectId) fillModal(openSubjectId); // keep an open dialog up to date too
  }

  /* ---------- Subject details dialog ---------- */
  const modal = $('#recModal');

  function fillModal(id) {
    const s = D.subject(id);
    if (!s) return;
    const t = D.term(s.termId);
    const st = STATUS[s.status] || STATUS.inprogress;

    $('#recModalTitle').textContent = s.title;
    const body = $('#recModalBody');
    body.replaceChildren();

    const list = mk('dl', 'dm-modal-list');
    const rows = [
      ['Subject code', s.code],
      ['Term', D.termLabel(t)],
      ['Units', s.units.toFixed(1)],
      ['Instructor', s.instructor]
    ];
    if (s.section) rows.push(['Section', s.section]);
    if (s.schedule) rows.push(['Schedule', s.schedule]);
    rows.forEach(([k, v]) => {
      const div = mk('div');
      div.append(mk('dt', '', k), mk('dd', '', v));
      list.appendChild(div);
    });
    const statusRow = mk('div');
    const dd = mk('dd');
    dd.appendChild(mk('span', `dm-status ${st.cls}`, st.label));
    statusRow.append(mk('dt', '', 'Status'), dd);
    list.appendChild(statusRow);
    body.appendChild(list);

    // Grade breakdown
    body.appendChild(mk('p', 'rec-modal-section', 'Grade breakdown'));
    const grid = mk('div', 'rec-grade-grid');
    const cells = D.rules().gradingPeriods.map((p) => [p.label, s.grades[p.key], s.gradeState[p.key], false]);
    cells.push(['Final Grade', s.finalGrade, s.gradeState.final, true]);
    grid.style.gridTemplateColumns = `repeat(${Math.min(cells.length, 4)}, minmax(0, 1fr))`;
    cells.forEach(([label, g, state, isFinal]) => {
      const cell = mk('div', isFinal ? 'rec-grade-cell is-final' : 'rec-grade-cell');
      cell.append(mk('strong', '', fmtGrade(g)), mk('span', '', label));
      const caption = typeof g === 'number'
        ? (isFinal ? D.verbal(g) : '')
        : state === 'submitted' || state === 'approved' ? 'Under review' : 'Not yet posted';
      if (isFinal && s.status === 'inc') cell.querySelector('strong').textContent = 'INC';
      else if (caption) cell.appendChild(mk('small', 'rec-cell-note', caption));
      grid.appendChild(cell);
    });
    body.appendChild(grid);
    if (D.isOpen(s)) {
      body.appendChild(mk('p', 'dm-modal-note', 'You only see grades after they are officially posted. This page updates automatically once they are released.'));
    }

    // Attendance (current term only)
    if (s.attendance) {
      const rate = D.attendanceRate(s.attendance);
      body.appendChild(mk('p', 'rec-modal-section', 'Attendance'));
      const att = mk('div', 'rec-grade-grid');
      att.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
      [['Sessions', s.attendance.held], ['Absences', s.attendance.absent], ['Lates', s.attendance.late], ['Excused', s.attendance.excused || 0], ['Rate', rate === null ? '—' : `${rate.toFixed(1)}%`]].forEach(([label, v]) => {
        const cell = mk('div', 'rec-grade-cell');
        cell.append(mk('strong', '', String(v)), mk('span', '', label));
        att.appendChild(cell);
      });
      body.appendChild(att);
      const attStatus = D.attendanceStatus(rate);
      body.appendChild(mk('p', 'dm-modal-note', `Attendance status: ${attStatus.label}. Excused absences ${D.rules().attendance.excusedCountsAsAbsent ? 'count' : 'do not count'} against your rate.`));
    }

    body.appendChild(mk('p', 'dm-modal-note', `Last updated ${fmtDate(s.updated)}.`));
  }

  function openModal(id, trigger) {
    openSubjectId = id;
    modalTrigger = trigger || null;
    fillModal(id);
    modal.classList.remove('hidden');
    $('#recModalClose').focus();
  }

  function closeModal() {
    openSubjectId = null;
    modal.classList.add('hidden');
    if (modalTrigger && document.body.contains(modalTrigger)) modalTrigger.focus();
  }

  $('#recModalClose').addEventListener('click', closeModal);
  $('#recModalDone').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    } else if (e.key === 'Tab') {
      const focusable = $$('button', modal).filter((n) => n.offsetParent !== null);
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

  /* ---------- Jump to Module 4 (Reports) ---------- */
  function generateReport(doc) {
    const nav = document.querySelector('.sidebar-item[data-page="reports"]');
    if (!nav) return;
    nav.click();
    const action = document.querySelector(`.rep-action[data-doc="${doc}"][data-action="generate"]`);
    if (action) action.click();
  }

  /* ---------- Events ---------- */
  page.addEventListener('click', (e) => {
    const chip = e.target.closest('.rec-chip');
    if (chip) {
      filter = chip.dataset.recFilter;
      renderTable();
      return;
    }

    const view = e.target.closest('[data-rec-view]');
    if (view) {
      openModal(view.dataset.recView, view);
      return;
    }

    const historyRow = e.target.closest('.rec-history-row');
    if (historyRow) {
      termId = historyRow.dataset.recTerm;
      filter = 'all';
      flashIds = new Set();
      render();
      return;
    }

    const report = e.target.closest('[data-rec-report]');
    if (report) {
      generateReport(report.dataset.recReport);
      return;
    }

    if (e.target.closest('#recStandingStat')) generateReport('records');
  });

  $('#recTerm').addEventListener('change', (e) => {
    termId = e.target.value;
    filter = 'all';
    flashIds = new Set();
    renderTable();
    renderHistory();
  });

  /* ---------- Live updates ---------- */
  D.subscribe(() => {
    const next = snapshot();
    const changed = Object.keys(next).filter((id) => next[id] !== lastSnapshot[id]);
    lastSnapshot = next;
    lastChange = new Date();

    // A reset can remove the selected term
    if (!D.term(termId)) termId = D.currentTerm().id;
    flashIds = new Set(changed);
    render();

    if (changed.length && !page.classList.contains('hidden')) {
      const s = D.subject(changed[0]);
      toast(changed.length === 1 && s ? `${s.title} was updated.` : 'Your academic records were updated.', 'info');
    }
  });

  render();
});
