/* =====================================================
   BITS-SIMS ACADEMIC DATA STORE  (Modules 3 & 4)
   -----------------------------------------------------
   One shared source of truth for Academic Records and
   Reports & Analytics. Both pages subscribe to it, so a
   change made here shows up on every page right away
   (and in any other open tab of the portal).

   For now the data is SAMPLE data kept in localStorage.
   When the database is ready, only this file needs to
   change: load() would fetch from the API and update()
   would send changes to it. The pages stay the same.

   Follows the BITS-SIMS design reference:
   - Grades go Draft -> Submitted -> Approved -> Posted (5.12).
     Students only see POSTED grades (5.15 step 8, 8.5).
   - Grade scale, passing grade, standing and attendance
     rules live in `rules` instead of in the page code (5.13, 10.1).
   - Grading periods are a list, not fixed columns (5.12 note).
     Current scope: Finals only, so the list is empty and the
     final grade is the only grade. To bring Midterm back, add
     { key: 'midterm', label: 'Midterm' } to rules.gradingPeriods.
   - Attendance counts present / absent / late / excused (6.5).
   - GWA, units and attendance % are computed, never stored (10.1).

   Handy in the browser console:
     SIMSData.get()                              -> raw data
     SIMSData.postGrades('ita312', { final: 1.75 }, 'posted')
     SIMSData.addAttendance('itp3111', 'absent')
     SIMSData.reset()                            -> back to the sample
===================================================== */
(function () {
  const STORE_KEY = 'bits-sims-academic';
  const VERSION = 5;   // bump whenever SAMPLE changes so old browser data resets

  /* ---------- Sample data (1 student) ---------- */
  const SAMPLE = {
    version: VERSION,

    // Institution rules (later: GradeScales / GradingPeriods / settings tables)
    rules: {
      gradingPeriods: [],     // Finals only for now: the final grade is the Finals grade
      passingGrade: 3.0,      // 3.00 or better passes (lower is better)
      failedGrade: 5.0,
      deansListMax: 1.75,     // term GWA at or below this = Dean's Lister
      scale: [                // verbal equivalents, checked top to bottom
        { max: 1.0, verbal: 'Excellent' },
        { max: 1.5, verbal: 'Very Good' },
        { max: 2.0, verbal: 'Good' },
        { max: 2.5, verbal: 'Satisfactory' },
        { max: 3.0, verbal: 'Passing' },
        { max: 5.0, verbal: 'Failed' }
      ],
      attendance: {
        onTrack: 95,                 // % and up = On Track
        watch: 90,                   // % and up = Watch, below = At Risk
        excusedCountsAsAbsent: false // excused sessions are left out of the rate
      }
    },

    student: {
      id: '2024-12345',
      program: 'BS Information Technology',
      section: 'BSIT-3B',
      yearLevel: '3rd Year'
    },

    // Oldest first. Exactly one term is "current".
    terms: [
      { id: '2425-1', sem: '1st Semester', ay: '2024-2025', current: false },
      { id: '2425-2', sem: '2nd Semester', ay: '2024-2025', current: false },
      { id: '2526-1', sem: '1st Semester', ay: '2025-2026', current: false },
      { id: '2526-2', sem: '2nd Semester', ay: '2025-2026', current: false },
      { id: '2627-1', sem: '1st Semester', ay: '2026-2027', current: true }
    ],

    // Class enrollments with grades (1.00 best, 3.00 passing, 5.00 failed)
    //   status:      inprogress | passed | failed | inc
    //   gradeStatus: per period + 'final' -> draft | submitted | approved | posted
    //                (left out = posted, e.g. finished past terms)
    subjects: [
      // AY 2024-2025, 1st Sem
      { id: 'itc111', termId: '2425-1', code: 'ITC111', title: 'Introduction to Computing', units: 3, instructor: 'Prof. Summer Noff', finalGrade: 2.0, status: 'passed', updated: '2024-12-18' },
      { id: 'itc112', termId: '2425-1', code: 'ITC112', title: 'Computer Programming 1', units: 3, instructor: 'Prof. Sam Miguel', finalGrade: 2.0, status: 'passed', updated: '2024-12-18' },
      { id: 'gec-pc', termId: '2425-1', code: 'GEC-PC', title: 'Purposive Communication', units: 3, instructor: 'Prof. Anton Nov', finalGrade: 1.75, status: 'passed', updated: '2024-12-17' },
      { id: 'gec-mmw', termId: '2425-1', code: 'GEC-MMW', title: 'Mathematics in the Modern World', units: 3, instructor: 'Prof. Rey D. Horse', finalGrade: 1.75, status: 'passed', updated: '2024-12-19' },
      { id: 'gec-us', termId: '2425-1', code: 'GEC-US', title: 'Understanding the Self', units: 3, instructor: 'Prof. Anton Nov', finalGrade: 1.75, status: 'passed', updated: '2024-12-16' },

      // AY 2024-2025, 2nd Sem
      { id: 'itc121', termId: '2425-2', code: 'ITC121', title: 'Computer Programming 2', units: 3, instructor: 'Prof. Sam Miguel', finalGrade: 2.0, status: 'passed', updated: '2025-05-20' },
      { id: 'itp122', termId: '2425-2', code: 'ITP122', title: 'Human Computer Interaction 1', units: 3, instructor: 'Prof. Summer Noff', finalGrade: 1.75, status: 'passed', updated: '2025-05-21' },
      { id: 'gec-sts', termId: '2425-2', code: 'GEC-STS', title: 'Science, Technology and Society', units: 3, instructor: 'Prof. Anton Nov', finalGrade: 1.75, status: 'passed', updated: '2025-05-19' },
      { id: 'gec-aa', termId: '2425-2', code: 'GEC-AA', title: 'Art Appreciation', units: 3, instructor: 'Prof. Rey D. Horse', finalGrade: 1.75, status: 'passed', updated: '2025-05-19' },
      { id: 'gec-eth', termId: '2425-2', code: 'GEC-ETH', title: 'Ethics', units: 3, instructor: 'Prof. Anton Nov', finalGrade: 1.75, status: 'passed', updated: '2025-05-22' },

      // AY 2025-2026, 1st Sem
      { id: 'itc211', termId: '2526-1', code: 'ITC211', title: 'Data Structures and Algorithms', units: 3, instructor: 'Prof. Sam Miguel', finalGrade: 2.0, status: 'passed', updated: '2025-12-17' },
      { id: 'itp212', termId: '2526-1', code: 'ITP212', title: 'Object-Oriented Programming', units: 3, instructor: 'Prof. Summer Noff', finalGrade: 1.5, status: 'passed', updated: '2025-12-18' },
      { id: 'itp213', termId: '2526-1', code: 'ITP213', title: 'Information Management 1', units: 3, instructor: 'Prof. Summer Noff', finalGrade: 1.75, status: 'passed', updated: '2025-12-18' },
      { id: 'itp214', termId: '2526-1', code: 'ITP214', title: 'Networking 1', units: 3, instructor: 'Prof. Sam Miguel', finalGrade: 1.75, status: 'passed', updated: '2025-12-19' },

      // AY 2025-2026, 2nd Sem (shown on the Report Card)
      { id: 'itp221', termId: '2526-2', code: 'ITP221', title: 'Web Development Fundamentals', units: 3, instructor: 'Prof. Summer Noff', finalGrade: 1.75, status: 'passed', updated: '2026-05-20' },
      { id: 'itp222', termId: '2526-2', code: 'ITP222', title: 'Database Systems', units: 3, instructor: 'Prof. Summer Noff', finalGrade: 1.5, status: 'passed', updated: '2026-05-21' },
      { id: 'itc223', termId: '2526-2', code: 'ITC223', title: 'Discrete Mathematics', units: 3, instructor: 'Prof. Rey D. Horse', finalGrade: 2.0, status: 'passed', updated: '2026-05-21' },
      { id: 'itp224', termId: '2526-2', code: 'ITP224', title: 'Computer Networks', units: 3, instructor: 'Prof. Sam Miguel', finalGrade: 1.75, status: 'passed', updated: '2026-05-22' },
      { id: 'itp225', termId: '2526-2', code: 'ITP225', title: 'IT Ethics and Professional Practice', units: 3, instructor: 'Prof. Anton Nov', finalGrade: 1.75, status: 'passed', updated: '2026-05-19' },

      // AY 2026-2027, 1st Sem (current - matches the dashboard courses)
      // Finals in mixed states: 2 posted, 1 approved and 1 submitted (both waiting for the Registrar)
      { id: 'itp3112', termId: '2627-1', code: 'ITP3112R', title: 'System Administration and Maintenance 1', units: 3, section: 'BSIT-3B', instructor: 'Prof. Sam Miguel', schedule: 'Mon 1:00-4:00 PM', gradeStatus: { final: 'posted' }, finalGrade: 1.5, status: 'passed', updated: '2026-11-06', attendance: { held: 9, absent: 0, late: 1, excused: 0 } },
      { id: 'gen-rp', termId: '2627-1', code: 'GEN-RP', title: 'Readings in Philippine History', units: 3, section: 'BSIT-3B', instructor: 'Prof. Anton Nov', schedule: 'Tue 9:00 AM-12:00 PM', gradeStatus: { final: 'posted' }, finalGrade: 1.5, status: 'passed', updated: '2026-11-06', attendance: { held: 5, absent: 0, late: 0, excused: 0 } },
      { id: 'itp3111', termId: '2627-1', code: 'ITP3111R', title: 'Network Management 2', units: 3, section: 'BSIT-3B', instructor: 'Prof. Sam Miguel', schedule: 'Wed 1:00-4:00 PM', gradeStatus: { final: 'approved' }, finalGrade: 1.75, status: 'passed', updated: '2026-11-06', attendance: { held: 8, absent: 1, late: 1, excused: 0 } },
      { id: 'ita312', termId: '2627-1', code: 'ITA312R', title: 'Platform Technologies 3 (Cloud Computing)', units: 3, section: 'BSIT-3B', instructor: 'Prof. Summer Noff', schedule: 'Thu 9:00 AM-12:00 PM', gradeStatus: { final: 'submitted' }, finalGrade: 1.75, status: 'passed', updated: '2026-11-06', attendance: { held: 7, absent: 0, late: 1, excused: 0 } }
    ],

    // Overall attendance rate of past terms (for the trend chart)
    attendanceHistory: [
      { termId: '2526-1', rate: 94.0 },
      { termId: '2526-2', rate: 95.2 }
    ]
  };

  /* ---------- Load / save ---------- */
  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && saved.version === VERSION && Array.isArray(saved.subjects)) return saved;
    } catch (err) { /* fall back to the sample */ }
    return clone(SAMPLE);
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (err) { /* storage unavailable */ }
  }

  let data = load();
  const listeners = [];

  function notify() {
    listeners.forEach((fn) => {
      try { fn(data); } catch (err) { console.error('[SIMSData] listener failed', err); }
    });
  }

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const rules = () => data.rules;
  const hasValue = (v) => typeof v === 'number';
  const statusOf = (s, key) => (s.gradeStatus && s.gradeStatus[key]) || 'posted';

  /* ---------- What a STUDENT is allowed to see ----------
     Unposted grades are hidden. A final grade that exists but
     isn't posted yet shows as "Awaiting release" (status: pending). */
  function studentView(s) {
    const v = { ...s, grades: {}, gradeState: {} };

    rules().gradingPeriods.forEach(({ key }) => {
      const raw = s.grades ? s.grades[key] : null;
      const posted = statusOf(s, key) === 'posted';
      v.grades[key] = hasValue(raw) && posted ? raw : null;
      v.gradeState[key] = !hasValue(raw) ? 'none' : statusOf(s, key);
    });

    const hasFinal = hasValue(s.finalGrade) || s.status === 'inc';
    const finalPosted = statusOf(s, 'final') === 'posted';
    v.gradeState.final = !hasFinal ? 'none' : statusOf(s, 'final');

    if (hasFinal && finalPosted) {
      v.finalGrade = hasValue(s.finalGrade) ? s.finalGrade : null;
    } else {
      v.finalGrade = null;
      // Drafts stay invisible; submitted/approved finals show as "Awaiting release"
      const inReview = ['submitted', 'approved'].includes(statusOf(s, 'final'));
      v.status = hasFinal && inReview ? 'pending' : 'inprogress';
    }
    return v;
  }

  const isOpen = (s) => s.status === 'inprogress' || s.status === 'pending';

  /* ---------- Calculations (shared by both modules) ---------- */

  // Units-weighted average of subjects with a posted final grade
  function gwa(subjects) {
    const graded = subjects.filter((s) => hasValue(s.finalGrade));
    const units = graded.reduce((sum, s) => sum + s.units, 0);
    const points = graded.reduce((sum, s) => sum + s.units * s.finalGrade, 0);
    return units ? points / units : null;
  }

  function standing(value, subjects) {
    if (value === null) return 'In Progress';
    if (subjects && subjects.some((s) => s.status === 'failed')) return 'Academic Warning';
    return value <= rules().deansListMax ? "Dean's Lister" : 'Good Standing';
  }

  function verbal(grade) {
    if (!hasValue(grade)) return '';
    const row = rules().scale.find((r) => grade <= r.max);
    return row ? row.verbal : '';
  }

  const termLabel = (t) => `${t.sem}, AY ${t.ay}`;
  const shortTermLabel = (t) => `${t.sem.replace('Semester', 'Sem')} AY${t.ay.slice(2, 4)}-${t.ay.slice(7, 9)}`;

  // attended / countable sessions; excused handled by rules.attendance
  function attendanceRate(a) {
    if (!a || !a.held) return null;
    const excused = a.excused || 0;
    const countable = rules().attendance.excusedCountsAsAbsent ? a.held : a.held - excused;
    const attended = a.held - a.absent - excused;
    return countable > 0 ? (attended / countable) * 100 : null;
  }

  function attendanceStatus(rate) {
    const r = rules().attendance;
    if (rate === null) return { key: 'none', label: 'No sessions yet' };
    if (rate >= r.onTrack) return { key: 'ok', label: 'On Track' };
    if (rate >= r.watch) return { key: 'warn', label: 'Watch' };
    return { key: 'risk', label: 'At Risk' };
  }

  const api = {
    /* Read (student-safe: only posted grades) */
    get: () => data,
    rules,
    student: () => data.student,
    terms: () => data.terms,
    currentTerm: () => data.terms.find((t) => t.current) || data.terms[data.terms.length - 1],
    lastCompletedTerm() {
      const done = data.terms.filter((t) => !t.current && api.subjectsIn(t.id).length && !api.subjectsIn(t.id).some(isOpen));
      return done[done.length - 1] || null;
    },
    term: (id) => data.terms.find((t) => t.id === id),
    subject: (id) => {
      const s = data.subjects.find((x) => x.id === id);
      return s ? studentView(s) : null;
    },
    subjectsIn: (termId) => data.subjects.filter((s) => s.termId === termId).map(studentView),
    allSubjects: () => data.subjects.map(studentView),

    /* Raw records (for staff tools only - includes unposted grades) */
    raw: {
      subject: (id) => data.subjects.find((x) => x.id === id),
      subjectsIn: (termId) => data.subjects.filter((s) => s.termId === termId)
    },

    /* Calculations */
    gwa,
    standing,
    verbal,
    isOpen,
    termLabel,
    shortTermLabel,
    attendanceRate,
    attendanceStatus,
    isPassing: (grade) => hasValue(grade) && grade <= rules().passingGrade,
    termSummary(termId) {
      const subjects = api.subjectsIn(termId);
      // A term's GWA only counts once every final grade is posted
      const value = subjects.some(isOpen) ? null : gwa(subjects);
      return { termId, subjects, gwa: value, standing: standing(value, subjects) };
    },
    cumulativeGwa: () => gwa(api.allSubjects()),
    unitsEarned: () => api.allSubjects().filter((s) => s.status === 'passed').reduce((sum, s) => sum + s.units, 0),

    /* Live updates */
    subscribe(fn) {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    },

    // Change data through here so every page refreshes
    update(mutator) {
      mutator(data);
      save();
      notify();
    },

    /* Staff actions (used by the demo tool for now; later the faculty/registrar screens)
       g = { final }  ('' or null = not entered, can be 'INC'); period keys too if any are configured
       status = draft | submitted | approved | posted  (applied to every grade passed in) */
    postGrades(subjectId, g, status = 'posted') {
      api.update((d) => {
        const s = d.subjects.find((x) => x.id === subjectId);
        if (!s) throw new Error(`No subject "${subjectId}"`);
        s.gradeStatus = s.gradeStatus || {};
        d.rules.gradingPeriods.forEach(({ key }) => {
          if (!(key in g)) return;
          s.grades[key] = g[key] === '' || g[key] === null ? null : Number(g[key]);
          s.gradeStatus[key] = status;
        });
        if ('final' in g) {
          applyFinal(s, g.final, d.rules);
          s.gradeStatus.final = status;
        }
        s.updated = today();
      });
    },

    // mark: present | absent | late | excused
    addAttendance(subjectId, mark) {
      api.update((d) => {
        const s = d.subjects.find((x) => x.id === subjectId);
        if (!s || !s.attendance) throw new Error(`No attendance for "${subjectId}"`);
        s.attendance.held += 1;
        if (mark === 'absent') s.attendance.absent += 1;
        if (mark === 'late') s.attendance.late += 1;
        if (mark === 'excused') s.attendance.excused = (s.attendance.excused || 0) + 1;
        s.updated = today();
      });
    },

    reset() {
      data = clone(SAMPLE);
      save();
      notify();
    }
  };

  function applyFinal(s, grade, r) {
    if (grade === 'INC') {
      s.finalGrade = null;
      s.status = 'inc';
    } else if (grade === '' || grade === null || grade === undefined) {
      s.finalGrade = null;
      s.status = 'inprogress';
    } else {
      const value = Number(grade);
      s.finalGrade = value;
      s.status = value <= r.passingGrade ? 'passed' : 'failed';
    }
  }

  // Another tab (e.g. the demo tool, later the faculty view) changed the data
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY) return;
    data = load();
    notify();
  });

  window.SIMSData = api;
})();
