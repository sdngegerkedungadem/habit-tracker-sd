  'use strict';

  const HABITS = [
    { key: 'bangunPagi', icon: '🌅', title: 'Bangun pagi', prompt: 'Jam berapa bangun? Apa yang dirasakan?' },
    { key: 'ibadah', icon: '🙏', title: 'Taat beribadah', prompt: 'Ibadah apa yang dilakukan hari ini?' },
    { key: 'olahraga', icon: '⚽', title: 'Berolahraga teratur', prompt: 'Aktivitas fisik/olahraga apa yang dilakukan?' },
    { key: 'makanSehat', icon: '🥗', title: 'Makan sehat dan bergizi', prompt: 'Makanan sehat apa yang dikonsumsi?' },
    { key: 'membaca', icon: '📚', title: 'Gemar membaca', prompt: 'Buku/bacaan apa yang dibaca hari ini?' },
    { key: 'bermasyarakat', icon: '🤝', title: 'Bermasyarakat', prompt: 'Kebaikan/tolong-menolong apa yang dilakukan ke orang lain?' },
    { key: 'tidurTepat', icon: '🌙', title: 'Tidur tepat waktu', prompt: 'Jam berapa rencana tidur malam ini?' }
  ];

  const state = {
    token: sessionStorage.getItem('habitToken') || '',
    user: readStoredUser(),
    bootstrap: null,
    loadingCount: 0,
    studentData: null,
    selectedJournalDate: '',
    monitor: null,
    monitoredStudent: null,
    selectedMonitorStudentId: '',
    selectedMonitorDate: '',
    admin: null
  };
  let confettiLoader = null;

  document.addEventListener('DOMContentLoaded', initApp);

  async function initApp() {
    bindBaseEvents();
    showLoading('Menyiapkan petualangan...');
    try {
      state.bootstrap = await gas('getPublicBootstrap');
      populateLoginClasses(state.bootstrap.classes || []);
      document.getElementById('studentMonth').value = state.bootstrap.month;
      document.getElementById('monitorMonth').value = state.bootstrap.month;
      document.getElementById('journalDate').value = state.bootstrap.today;
      document.getElementById('journalDate').max = state.bootstrap.today;

      if (state.token && state.user) {
        try {
          await enterApplication();
        } catch (error) {
          clearLocalSession();
          showLogin();
          toast('Sesi sebelumnya telah berakhir. Silakan masuk kembali.', 'info');
        }
      } else {
        showLogin();
      }
    } catch (error) {
      showLogin();
      handleError(error);
    } finally {
      hideLoading();
    }
  }

  function bindBaseEvents() {
    document.getElementById('loginClass').addEventListener('change', loadLoginStudents);
    document.getElementById('studentLoginForm').addEventListener('submit', submitStudentLogin);
    document.getElementById('staffLoginForm').addEventListener('submit', submitStaffLogin);
    document.getElementById('togglePassword').addEventListener('click', togglePasswordVisibility);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('homeLink').addEventListener('click', event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

    document.getElementById('studentMonth').addEventListener('change', event => loadStudentDashboard(event.target.value));
    document.getElementById('journalDate').addEventListener('change', event => selectStudentDate(event.target.value));
    document.getElementById('habitForm').addEventListener('submit', saveHabitJournal);
    document.getElementById('habitList').addEventListener('change', event => {
      if (event.target.classList.contains('habit-toggle')) updateHabitProgress();
    });
    document.getElementById('studentPdfBtn').addEventListener('click', exportStudentPdf);

    document.getElementById('monitorClass').addEventListener('change', () => loadMonitorDashboard());
    document.getElementById('monitorMonth').addEventListener('change', () => loadMonitorDashboard());
    document.getElementById('studentSearch').addEventListener('input', renderMonitorTable);
    document.getElementById('monitorTableBody').addEventListener('click', handleMonitorAction);
    document.getElementById('classPdfBtn').addEventListener('click', exportClassPdf);
    document.getElementById('selectedStudentPdfBtn').addEventListener('click', exportSelectedStudentPdf);

    document.getElementById('refreshAdminBtn').addEventListener('click', loadAdminData);
    document.getElementById('studentAdminForm').addEventListener('submit', saveAdminStudent);
    document.getElementById('userAdminForm').addEventListener('submit', saveAdminUser);
    document.getElementById('cancelStudentEdit').addEventListener('click', resetStudentAdminForm);
    document.getElementById('cancelUserEdit').addEventListener('click', resetUserAdminForm);
    document.getElementById('adminStudentsBody').addEventListener('click', handleAdminStudentAction);
    document.getElementById('adminUsersBody').addEventListener('click', handleAdminUserAction);
    document.getElementById('adminRole').addEventListener('change', updateRoleFields);
  }

  async function gas(name, ...args) {
    return window.habitApi.call(name, args);
  }

  function showLoading(message) {
    state.loadingCount += 1;
    document.getElementById('loadingText').textContent = message || 'Sedang memuat...';
    document.getElementById('loadingOverlay').classList.remove('d-none');
  }

  function hideLoading() {
    state.loadingCount = Math.max(0, state.loadingCount - 1);
    if (!state.loadingCount) document.getElementById('loadingOverlay').classList.add('d-none');
  }

  function toast(message, type = 'success') {
    const id = 'toast-' + Date.now();
    const icons = { success: 'check-circle-fill', danger: 'exclamation-triangle-fill', info: 'info-circle-fill' };
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div id="${id}" class="toast toast-${type}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex"><div class="toast-body"><i class="bi bi-${icons[type] || icons.info} me-2"></i>${escapeHtml(message)}</div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Tutup"></button></div></div>`;
    const element = wrapper.firstElementChild;
    document.getElementById('toastArea').appendChild(element);
    element.addEventListener('hidden.bs.toast', () => element.remove());
    bootstrap.Toast.getOrCreateInstance(element, { delay: 4500 }).show();
  }

  function handleError(error) {
    const message = error && error.message ? error.message : 'Terjadi kesalahan. Silakan coba lagi.';
    toast(message.replace(/^Exception:\s*/i, ''), 'danger');
    if (/sesi (tidak valid|telah berakhir)|akun sudah tidak aktif|role akun sudah tidak valid|tidak memiliki izin/i.test(message)) {
      clearLocalSession();
      showLogin();
    }
    console.error(error);
  }

  function populateLoginClasses(classes) {
    const select = document.getElementById('loginClass');
    select.innerHTML = '<option value="">Pilih kelasmu...</option>' + classes.map(item => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`).join('');
  }

  async function loadLoginStudents() {
    const className = document.getElementById('loginClass').value;
    const select = document.getElementById('loginStudent');
    select.disabled = true;
    select.innerHTML = '<option value="">Memuat daftar siswa...</option>';
    if (!className) {
      select.innerHTML = '<option value="">Pilih namamu...</option>';
      return;
    }
    try {
      const students = await gas('getStudentsByClass', className);
      select.innerHTML = '<option value="">Pilih namamu...</option>' + students.map(student => `<option value="${escapeAttr(student.id)}">${escapeHtml(student.name)}</option>`).join('');
      select.disabled = false;
      if (!students.length) select.innerHTML = '<option value="">Belum ada siswa di kelas ini</option>';
    } catch (error) {
      select.innerHTML = '<option value="">Gagal memuat siswa</option>';
      handleError(error);
    }
  }

  async function submitStudentLogin(event) {
    event.preventDefault();
    const className = document.getElementById('loginClass').value;
    const studentId = document.getElementById('loginStudent').value;
    if (!className || !studentId) return toast('Pilih kelas dan namamu terlebih dahulu.', 'info');
    showLoading('Membuka jurnalmu...');
    try {
      const response = await gas('loginStudent', className, studentId);
      saveSession(response);
      await enterApplication();
    } catch (error) {
      handleError(error);
    } finally {
      hideLoading();
    }
  }

  async function submitStaffLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) return toast('Username dan password wajib diisi.', 'info');
    showLoading('Memeriksa akun...');
    try {
      const response = await gas('loginStaff', username, password);
      saveSession(response);
      document.getElementById('loginPassword').value = '';
      await enterApplication();
    } catch (error) {
      handleError(error);
    } finally {
      hideLoading();
    }
  }

  function togglePasswordVisibility() {
    const input = document.getElementById('loginPassword');
    const icon = document.querySelector('#togglePassword i');
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.className = input.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
  }

  function saveSession(response) {
    state.token = response.token;
    state.user = response.user;
    sessionStorage.setItem('habitToken', state.token);
    sessionStorage.setItem('habitUser', JSON.stringify(state.user));
  }

  function readStoredUser() {
    try { return JSON.parse(sessionStorage.getItem('habitUser') || 'null'); }
    catch (error) { return null; }
  }

  function clearLocalSession() {
    state.token = '';
    state.user = null;
    state.studentData = null;
    state.monitor = null;
    state.monitoredStudent = null;
    state.admin = null;
    sessionStorage.removeItem('habitToken');
    sessionStorage.removeItem('habitUser');
  }

  async function logout() {
    const token = state.token;
    clearLocalSession();
    showLogin();
    try { if (token) await gas('logout', token); } catch (error) { console.warn(error); }
  }

  function showLogin() {
    document.getElementById('loginScreen').classList.remove('d-none');
    document.getElementById('appShell').classList.add('d-none');
    document.getElementById('studentView').classList.add('d-none');
    document.getElementById('staffView').classList.add('d-none');
  }

  async function enterApplication() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('appShell').classList.remove('d-none');
    document.getElementById('navIdentity').textContent = `${state.user.name} · ${state.user.role}`;
    if (state.user.role === 'Siswa') {
      document.getElementById('studentView').classList.remove('d-none');
      document.getElementById('staffView').classList.add('d-none');
      await loadStudentDashboard(document.getElementById('studentMonth').value || state.bootstrap.month);
    } else {
      document.getElementById('studentView').classList.add('d-none');
      document.getElementById('staffView').classList.remove('d-none');
      document.getElementById('staffRole').textContent = state.user.role;
      document.getElementById('adminSection').classList.toggle('d-none', state.user.role !== 'Admin');
      await loadMonitorDashboard();
      if (state.user.role === 'Admin') {
        document.getElementById('adminStudentsBody').innerHTML = '<tr><td colspan="3" class="text-center text-secondary py-4">Memuat data siswa...</td></tr>';
        document.getElementById('adminUsersBody').innerHTML = '<tr><td colspan="4" class="text-center text-secondary py-4">Memuat data akun...</td></tr>';
        setTimeout(() => loadAdminData({ silent: true }), 0);
      }
    }
  }

  // -------------------- Student experience --------------------

  async function loadStudentDashboard(month, options = {}) {
    if (!options.silent) showLoading('Memuat kalender dan jurnal...');
    try {
      const data = await gas('getStudentDashboard', state.token, month);
      state.studentData = data;
      document.getElementById('studentMonth').value = data.month;
      document.getElementById('studentGreeting').textContent = `Halo, ${data.student.name}! 👋`;
      document.getElementById('studentClass').textContent = `Kelas ${data.student.className}`;
      document.getElementById('studentStreak').textContent = data.streak;

      let selected = state.selectedJournalDate;
      if (!selected || selected.slice(0, 7) !== data.month) selected = data.month === data.today.slice(0, 7) ? data.today : `${data.month}-01`;
      if (selected > data.today) selected = data.today;
      state.selectedJournalDate = selected;
      document.getElementById('journalDate').value = selected;
      renderCalendar('studentCalendar', data.month, data.logs, selected, data.today, selectStudentDate);
      renderStudentJournal(selected);
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      if (!options.silent) hideLoading();
    }
  }

  function selectStudentDate(date) {
    if (!state.studentData || !date || date > state.studentData.today) return;
    if (date.slice(0, 7) !== state.studentData.month) {
      state.selectedJournalDate = date;
      loadStudentDashboard(date.slice(0, 7));
      return;
    }
    state.selectedJournalDate = date;
    document.getElementById('journalDate').value = date;
    renderCalendar('studentCalendar', state.studentData.month, state.studentData.logs, date, state.studentData.today, selectStudentDate);
    renderStudentJournal(date);
  }

  function renderStudentJournal(date) {
    const log = state.studentData && state.studentData.logs.find(item => item.date === date);
    const answers = log ? log.habits : {};
    document.getElementById('habitList').innerHTML = HABITS.map((habit, index) => {
      const answer = answers[habit.key] || { done: false, note: '' };
      const inputId = `habit-${habit.key}`;
      return `<div class="habit-item ${answer.done ? 'checked' : ''}" data-habit="${habit.key}">
        <input id="${inputId}" class="form-check-input habit-toggle" type="checkbox" ${answer.done ? 'checked' : ''}>
        <div class="habit-copy">
          <label class="habit-label" for="${inputId}"><span>${habit.icon}</span><span>${index + 1}. ${escapeHtml(habit.title)}</span></label>
          <textarea class="form-control habit-note" maxlength="500" rows="1" placeholder="${escapeAttr(habit.prompt)}">${escapeHtml(answer.note || '')}</textarea>
        </div>
      </div>`;
    }).join('');
    document.querySelectorAll('.habit-toggle').forEach(toggle => toggle.addEventListener('change', event => {
      event.target.closest('.habit-item').classList.toggle('checked', event.target.checked);
    }));
    updateHabitProgress();
  }

  function updateHabitProgress() {
    const completed = document.querySelectorAll('#habitList .habit-toggle:checked').length;
    document.getElementById('habitProgressText').textContent = `${completed} dari 7 kebiasaan selesai`;
  }

  async function saveHabitJournal(event) {
    event.preventDefault();
    const date = document.getElementById('journalDate').value;
    if (!date) return toast('Pilih tanggal jurnal.', 'info');
    const habits = {};
    document.querySelectorAll('#habitList .habit-item').forEach(item => {
      habits[item.dataset.habit] = {
        done: item.querySelector('.habit-toggle').checked,
        note: item.querySelector('.habit-note').value.trim()
      };
    });
    showLoading('Menyimpan jurnal hebatmu...');
    try {
      const result = await gas('submitHabit', state.token, { date, habits });
      await loadStudentDashboard(date.slice(0, 7), { silent: true });
      if (result.complete) celebrate(result);
      else toast(result.message, 'success');
    } catch (error) {
      handleError(error);
    } finally {
      hideLoading();
    }
  }

  function celebrate(result) {
    document.getElementById('celebrationMessage').textContent = result.message;
    document.getElementById('celebrationStreak').textContent = result.streak;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('celebrationModal')).show();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    loadConfetti().then(() => {
      if (typeof confetti !== 'function') return;
      const isSmallScreen = window.matchMedia('(max-width: 575px)').matches;
      const end = Date.now() + (isSmallScreen ? 900 : 1500);
      (function frame() {
        const particleCount = isSmallScreen ? 3 : 5;
        confetti({ particleCount, angle: 60, spread: 65, origin: { x: 0 }, colors: ['#4f46e5', '#fbbf24', '#10b981', '#ec4899'] });
        confetti({ particleCount, angle: 120, spread: 65, origin: { x: 1 }, colors: ['#4f46e5', '#fbbf24', '#10b981', '#ec4899'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
    }).catch(() => {});
  }

  function loadConfetti() {
    if (typeof confetti === 'function') return Promise.resolve();
    if (confettiLoader) return confettiLoader;
    confettiLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Hindari literal "//" di inline script karena sanitizer HtmlService dapat memotongnya.
      script.src = ['https:', '', 'cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'].join('/');
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return confettiLoader;
  }

  async function exportStudentPdf() {
    if (!state.studentData) return;
    await requestPdf({ type: 'student', studentId: state.studentData.student.id, month: state.studentData.month });
  }

  // -------------------- Monitoring --------------------

  async function loadMonitorDashboard() {
    showLoading('Menyusun ringkasan kelas...');
    try {
      const month = document.getElementById('monitorMonth').value || state.bootstrap.month;
      const requestedClass = document.getElementById('monitorClass').value || '';
      state.monitor = await gas('getMonitorDashboard', state.token, month, requestedClass);
      document.getElementById('monitorMonth').value = state.monitor.month;
      populateMonitorClasses();
      renderMonitorStats();
      renderMonitorTable();
      state.monitoredStudent = null;
      state.selectedMonitorStudentId = '';
      document.getElementById('monitorCalendarPanel').classList.add('d-none');
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      hideLoading();
    }
  }

  function populateMonitorClasses() {
    const select = document.getElementById('monitorClass');
    select.innerHTML = state.monitor.classes.map(item => `<option value="${escapeAttr(item)}">${escapeHtml(item === 'Semua' ? 'Semua kelas' : `Kelas ${item}`)}</option>`).join('');
    select.value = state.monitor.selectedClass;
    select.disabled = state.user.role === 'Guru';
  }

  function renderMonitorStats() {
    document.getElementById('statStudents').textContent = state.monitor.stats.studentCount;
    document.getElementById('statComplete').textContent = state.monitor.stats.completeDays;
    document.getElementById('statCompliance').textContent = `${state.monitor.stats.compliance}%`;
    document.getElementById('statDays').textContent = state.monitor.stats.eligibleDays;
  }

  function renderMonitorTable() {
    if (!state.monitor) return;
    const query = document.getElementById('studentSearch').value.trim().toLowerCase();
    const students = state.monitor.students.filter(item => `${item.name} ${item.className}`.toLowerCase().includes(query));
    const body = document.getElementById('monitorTableBody');
    body.innerHTML = students.map(student => `<tr>
      <td data-label="Siswa"><div class="student-cell"><span class="student-avatar">${escapeHtml(initials(student.name))}</span><div><strong>${escapeHtml(student.name)}</strong><small>Kelas ${escapeHtml(student.className)}</small></div></div></td>
      <td data-label="Terisi">${student.filledDays} hari</td><td data-label="Hari lengkap">${student.completeDays} hari</td><td data-label="Streak terbaik">🔥 ${student.bestStreak}</td>
      <td data-label="Kepatuhan"><div class="score-progress"><span style="width:${Math.min(100, student.compliance)}%"></span></div><span class="score-label">${student.compliance}%</span></td>
      <td data-label="Aksi" class="text-end text-nowrap"><button class="btn btn-sm btn-outline-primary rounded-pill" data-action="calendar" data-id="${escapeAttr(student.id)}"><i class="bi bi-calendar3"></i> Detail</button>
      <button class="btn btn-sm btn-light rounded-pill" data-action="pdf" data-id="${escapeAttr(student.id)}" title="Unduh PDF"><i class="bi bi-file-earmark-pdf"></i></button></td>
    </tr>`).join('');
    document.getElementById('monitorEmpty').classList.toggle('d-none', students.length > 0);
  }

  async function handleMonitorAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    if (button.dataset.action === 'pdf') {
      await requestPdf({ type: 'student', studentId: button.dataset.id, month: state.monitor.month });
      return;
    }
    await loadMonitoredStudent(button.dataset.id);
  }

  async function loadMonitoredStudent(studentId) {
    showLoading('Membuka kalender siswa...');
    try {
      state.monitoredStudent = await gas('getMonitoredStudent', state.token, studentId, state.monitor.month);
      state.selectedMonitorStudentId = studentId;
      state.selectedMonitorDate = '';
      document.getElementById('monitorStudentName').textContent = state.monitoredStudent.student.name;
      document.getElementById('monitorStudentMeta').textContent = `Kelas ${state.monitoredStudent.student.className} · 🔥 ${state.monitoredStudent.streak} hari streak aktif`;
      document.getElementById('monitorCalendarPanel').classList.remove('d-none');
      renderCalendar('monitorCalendar', state.monitoredStudent.month, state.monitoredStudent.logs, '', state.monitoredStudent.today, showMonitorJournal);
      document.getElementById('monitorJournalDetail').innerHTML = '<div class="empty-state"><span>👆</span><p>Klik tanggal berwarna untuk melihat rincian jurnal.</p></div>';
      setTimeout(() => document.getElementById('monitorCalendarPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (error) {
      handleError(error);
    } finally {
      hideLoading();
    }
  }

  function showMonitorJournal(date) {
    if (!state.monitoredStudent) return;
    state.selectedMonitorDate = date;
    renderCalendar('monitorCalendar', state.monitoredStudent.month, state.monitoredStudent.logs, date, state.monitoredStudent.today, showMonitorJournal);
    const log = state.monitoredStudent.logs.find(item => item.date === date);
    const container = document.getElementById('monitorJournalDetail');
    if (!log) {
      container.innerHTML = `<div class="empty-state"><span>📝</span><p>Belum ada jurnal pada ${escapeHtml(formatDate(date))}.</p></div>`;
      return;
    }
    container.innerHTML = `<div class="detail-date"><h4>${escapeHtml(formatDate(date))}</h4><span class="badge ${log.complete ? 'text-bg-success' : 'text-bg-warning'}">${log.doneCount}/7 selesai</span></div>` +
      HABITS.map(habit => {
        const answer = log.habits[habit.key];
        return `<div class="detail-habit"><b>${answer.done ? '✅' : '⬜'} ${habit.icon} ${escapeHtml(habit.title)}</b><p>${answer.note ? escapeHtml(answer.note) : '<em>Tanpa catatan</em>'}</p></div>`;
      }).join('');
  }

  async function exportClassPdf() {
    if (!state.monitor) return;
    await requestPdf({ type: 'class', className: state.monitor.selectedClass, month: state.monitor.month });
  }

  async function exportSelectedStudentPdf() {
    if (!state.selectedMonitorStudentId || !state.monitor) return;
    await requestPdf({ type: 'student', studentId: state.selectedMonitorStudentId, month: state.monitor.month });
  }

  // -------------------- Admin --------------------

  async function loadAdminData(options = {}) {
    if (state.user.role !== 'Admin') return;
    if (!options.silent) showLoading('Memuat data administrasi...');
    try {
      state.admin = await gas('getAdminData', state.token);
      renderAdminStudents();
      renderAdminUsers();
      populateAdminClasses();
    } catch (error) {
      handleError(error);
    } finally {
      if (!options.silent) hideLoading();
    }
  }

  function renderAdminStudents() {
    const body = document.getElementById('adminStudentsBody');
    body.innerHTML = state.admin.students.length ? state.admin.students.map(student => `<tr><td><strong>${escapeHtml(student.name)}</strong></td><td><span class="badge text-bg-light">${escapeHtml(student.className)}</span></td><td class="text-end text-nowrap">
      <button class="action-btn edit" data-action="edit" data-id="${escapeAttr(student.id)}" title="Edit"><i class="bi bi-pencil"></i></button>
      <button class="action-btn delete" data-action="delete" data-id="${escapeAttr(student.id)}" title="Hapus"><i class="bi bi-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="3" class="text-center text-secondary py-4">Belum ada siswa.</td></tr>';
  }

  function renderAdminUsers() {
    const body = document.getElementById('adminUsersBody');
    body.innerHTML = state.admin.users.length ? state.admin.users.map(user => `<tr><td><strong>${escapeHtml(user.username)}</strong></td><td><span class="badge ${user.role === 'Admin' ? 'text-bg-primary' : 'text-bg-success'}">${escapeHtml(user.role)}</span></td><td>${escapeHtml(user.classAccess)}</td><td class="text-end text-nowrap">
      <button class="action-btn edit" data-action="edit" data-id="${escapeAttr(user.id)}" title="Edit"><i class="bi bi-pencil"></i></button>
      <button class="action-btn delete" data-action="delete" data-id="${escapeAttr(user.id)}" title="Hapus"><i class="bi bi-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="4" class="text-center text-secondary py-4">Belum ada akun.</td></tr>';
  }

  function populateAdminClasses() {
    document.getElementById('classSuggestions').innerHTML = state.admin.classes.map(item => `<option value="${escapeAttr(item)}"></option>`).join('');
    document.getElementById('adminClassAccess').innerHTML = '<option value="">Pilih kelas...</option>' + state.admin.classes.map(item => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`).join('');
  }

  async function saveAdminStudent(event) {
    event.preventDefault();
    const data = {
      id: document.getElementById('adminStudentId').value,
      name: document.getElementById('adminStudentName').value.trim(),
      className: document.getElementById('adminStudentClass').value.trim()
    };
    showLoading('Menyimpan data siswa...');
    try {
      const result = await gas('saveStudent', state.token, data);
      toast(result.message);
      resetStudentAdminForm();
      await refreshAfterAdminChange();
    } catch (error) { handleError(error); }
    finally { hideLoading(); }
  }

  async function saveAdminUser(event) {
    event.preventDefault();
    const data = {
      id: document.getElementById('adminUserId').value,
      username: document.getElementById('adminUsername').value.trim(),
      role: document.getElementById('adminRole').value,
      classAccess: document.getElementById('adminClassAccess').value,
      password: document.getElementById('adminPassword').value
    };
    showLoading('Menyimpan akun...');
    try {
      const result = await gas('saveUser', state.token, data);
      toast(result.message);
      resetUserAdminForm();
      await loadAdminDataSilently();
    } catch (error) { handleError(error); }
    finally { hideLoading(); }
  }

  function handleAdminStudentAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !state.admin) return;
    const student = state.admin.students.find(item => item.id === button.dataset.id);
    if (!student) return;
    if (button.dataset.action === 'edit') {
      document.getElementById('adminStudentId').value = student.id;
      document.getElementById('adminStudentName').value = student.name;
      document.getElementById('adminStudentClass').value = student.className;
      document.getElementById('studentFormTitle').textContent = 'Edit Siswa';
      document.getElementById('cancelStudentEdit').classList.remove('d-none');
      document.getElementById('studentAdminForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirm(`Hapus ${student.name} dari daftar siswa? Histori jurnalnya tetap disimpan.`)) return;
    deleteAdminStudent(student.id);
  }

  async function deleteAdminStudent(id) {
    showLoading('Menghapus data siswa...');
    try {
      const result = await gas('deleteStudent', state.token, id);
      toast(result.message);
      await refreshAfterAdminChange();
    } catch (error) { handleError(error); }
    finally { hideLoading(); }
  }

  function handleAdminUserAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !state.admin) return;
    const user = state.admin.users.find(item => item.id === button.dataset.id);
    if (!user) return;
    if (button.dataset.action === 'edit') {
      document.getElementById('adminUserId').value = user.id;
      document.getElementById('adminUsername').value = user.username;
      document.getElementById('adminRole').value = user.role;
      document.getElementById('adminClassAccess').value = user.classAccess;
      document.getElementById('adminPassword').value = '';
      document.getElementById('userFormTitle').textContent = 'Edit Akun';
      document.getElementById('cancelUserEdit').classList.remove('d-none');
      updateRoleFields();
      document.getElementById('userAdminForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirm(`Hapus akun ${user.username}?`)) return;
    deleteAdminUser(user.id);
  }

  async function deleteAdminUser(id) {
    showLoading('Menghapus akun...');
    try {
      const result = await gas('deleteUser', state.token, id);
      toast(result.message);
      await loadAdminDataSilently();
    } catch (error) { handleError(error); }
    finally { hideLoading(); }
  }

  async function refreshAfterAdminChange() {
    await loadAdminDataSilently();
    state.bootstrap = await gas('getPublicBootstrap');
    populateLoginClasses(state.bootstrap.classes || []);
    const currentClass = document.getElementById('monitorClass').value;
    const validClass = currentClass === 'Semua' || state.admin.classes.includes(currentClass) ? currentClass : 'Semua';
    state.monitor = await gas('getMonitorDashboard', state.token, document.getElementById('monitorMonth').value, validClass);
    populateMonitorClasses();
    renderMonitorStats();
    renderMonitorTable();
  }

  async function loadAdminDataSilently() {
    state.admin = await gas('getAdminData', state.token);
    renderAdminStudents();
    renderAdminUsers();
    populateAdminClasses();
  }

  function resetStudentAdminForm() {
    document.getElementById('studentAdminForm').reset();
    document.getElementById('adminStudentId').value = '';
    document.getElementById('studentFormTitle').textContent = 'Tambah Siswa';
    document.getElementById('cancelStudentEdit').classList.add('d-none');
  }

  function resetUserAdminForm() {
    document.getElementById('userAdminForm').reset();
    document.getElementById('adminUserId').value = '';
    document.getElementById('userFormTitle').textContent = 'Tambah Akun';
    document.getElementById('cancelUserEdit').classList.add('d-none');
    updateRoleFields();
  }

  function updateRoleFields() {
    const isAdmin = document.getElementById('adminRole').value === 'Admin';
    document.getElementById('classAccessGroup').classList.toggle('d-none', isAdmin);
    document.getElementById('adminClassAccess').required = !isAdmin;
  }

  // -------------------- Calendar and PDF helpers --------------------

  function renderCalendar(containerId, month, logs, selectedDate, today, onSelect) {
    const container = document.getElementById(containerId);
    const [year, monthNumber] = month.split('-').map(Number);
    const firstDay = new Date(year, monthNumber - 1, 1);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const logMap = Object.fromEntries((logs || []).map(log => [log.date, log]));
    const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    let cells = weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join('');
    for (let blank = 0; blank < offset; blank += 1) cells += '<button class="calendar-day" disabled aria-hidden="true"></button>';
    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const log = logMap[date];
      let status = 'future';
      let mark = '';
      let label = 'belum dapat diisi';
      if (log) {
        status = log.complete ? 'complete' : 'partial';
        mark = log.complete ? '✓' : `${log.doneCount}/7`;
        label = log.complete ? 'lengkap' : `${log.doneCount} dari 7`;
      } else if (date <= today) {
        status = 'empty-day';
        mark = '×';
        label = 'belum diisi';
      }
      cells += `<button class="calendar-day ${status} ${date === selectedDate ? 'selected' : ''} ${date === today ? 'today' : ''}" data-date="${date}" aria-label="${day}, ${label}">
        <span>${day}</span><small class="day-mark">${mark}</small></button>`;
    }
    const title = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(firstDay);
    container.innerHTML = `<div class="calendar-title">${escapeHtml(title)}</div><div class="calendar-grid">${cells}</div>`;
    container.querySelectorAll('.calendar-day[data-date]').forEach(button => button.addEventListener('click', () => onSelect(button.dataset.date)));
  }

  async function requestPdf(options) {
    showLoading('Menyiapkan dokumen PDF...');
    try {
      const response = await gas('exportPdf', state.token, options);
      downloadBase64(response.base64, response.mimeType, response.filename);
      toast('PDF berhasil dibuat dan mulai diunduh.');
    } catch (error) {
      handleError(error);
    } finally {
      hideLoading();
    }
  }

  function downloadBase64(base64, mimeType, filename) {
    const binary = atob(base64);
    const chunkSize = 1024;
    const chunks = [];
    for (let offset = 0; offset < binary.length; offset += chunkSize) {
      const slice = binary.slice(offset, offset + chunkSize);
      const bytes = new Uint8Array(slice.length);
      for (let i = 0; i < slice.length; i += 1) bytes[i] = slice.charCodeAt(i);
      chunks.push(bytes);
    }
    const url = URL.createObjectURL(new Blob(chunks, { type: mimeType || 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'rekap.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function formatDate(date) {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day));
  }

  function initials(name) {
    return String(name).split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#096;'); }
