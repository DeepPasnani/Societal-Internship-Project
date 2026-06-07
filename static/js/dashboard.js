/* ============================================================
   dashboard.js — Doctor Schedule Dashboard
   Handles doctor selection, schedule loading, weekly calendar,
   status update modal, and appointment management.
   ============================================================ */

let selectedDoctorId = null;
let selectedAppointmentId = null;
let allDoctors = [];

const DOC_COLORS = [
  'linear-gradient(135deg,#1a6cf5,#5b8af5)',
  'linear-gradient(135deg,#00b894,#00cec9)',
  'linear-gradient(135deg,#6c5ce7,#a29bfe)',
  'linear-gradient(135deg,#e17055,#fab1a0)'
];
const DOC_ICONS = ['fa-stethoscope', 'fa-baby', 'fa-ear-listen', 'fa-venus'];

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  // Default date = today
  const dateInput = document.getElementById('schedule-date');
  dateInput.value = new Date().toISOString().split('T')[0];
  dateInput.addEventListener('change', loadSchedule);

  loadDoctors();
});

// ── DOCTORS ──────────────────────────────────────────────────
function loadDoctors() {
  fetch('/api/doctors')
    .then(r => r.json())
    .then(docs => {
      allDoctors = docs;
      renderDoctorList(docs);
    })
    .catch(() => {
      document.getElementById('doctor-list').innerHTML =
        '<p style="color:var(--danger); font-size:0.875rem;">Failed to load doctors.</p>';
    });
}

function renderDoctorList(docs) {
  const el = document.getElementById('doctor-list');
  el.innerHTML = docs.map((doc, i) => `
    <div class="doctor-option" id="doc-opt-${doc.id}" onclick="selectDoctor(${doc.id})">
      <div class="doc-avatar" style="background:${DOC_COLORS[i % 4]};">
        <i class="fa-solid ${DOC_ICONS[i % 4]}"></i>
      </div>
      <div>
        <h4>${escapeHtml(doc.name)}</h4>
        <small>${escapeHtml(doc.specialization)}</small>
      </div>
    </div>
  `).join('');
}

function selectDoctor(id) {
  selectedDoctorId = id;
  document.querySelectorAll('.doctor-option').forEach(el => el.classList.remove('selected'));
  const optEl = document.getElementById(`doc-opt-${id}`);
  if (optEl) optEl.classList.add('selected');
  loadSchedule();
}

// ── LOAD SCHEDULE ─────────────────────────────────────────────
function loadSchedule() {
  if (!selectedDoctorId) return;
  const date = document.getElementById('schedule-date').value;
  const contentEl = document.getElementById('schedule-content');

  contentEl.innerHTML = `
    <div class="card">
      <div class="card-body" style="text-align:center; padding:32px; color:var(--muted);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;"></i>
        <p style="margin-top:12px;">Loading schedule...</p>
      </div>
    </div>`;

  fetch(`/api/doctor-schedule?doctor_id=${selectedDoctorId}&date=${date}`)
    .then(r => r.json())
    .then(data => renderSchedule(data, date))
    .catch(() => {
      contentEl.innerHTML = `
        <div class="card">
          <div class="card-body">
            <div class="alert alert-error">Failed to load schedule. Please try again.</div>
          </div>
        </div>`;
    });
}

// ── RENDER SCHEDULE ───────────────────────────────────────────
function renderSchedule(data, date) {
  const doc = allDoctors.find(d => d.id === selectedDoctorId);
  const docName = doc ? doc.name : 'Doctor';
  const docSpec = doc ? doc.specialization : '';
  const summary = data.summary || {};
  const appts   = data.appointments || [];
  const weekData = data.week_data || [];

  const docIdx = allDoctors.findIndex(d => d.id === selectedDoctorId);

  const contentEl = document.getElementById('schedule-content');
  contentEl.innerHTML = `
    <!-- Doctor Header -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-body" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <div class="doc-avatar" style="width:56px; height:56px; border-radius:14px; font-size:22px; background:${DOC_COLORS[docIdx % 4]}; display:flex; align-items:center; justify-content:center; color:white;">
            <i class="fa-solid ${DOC_ICONS[docIdx % 4]}"></i>
          </div>
          <div>
            <h2 style="font-size:1.2rem; margin-bottom:3px;">${escapeHtml(docName)}</h2>
            <p style="color:var(--muted); font-size:0.875rem;">${escapeHtml(docSpec)}</p>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="badge badge-noshow" style="font-size:0.8rem; padding:6px 14px;">
            <i class="fa-solid fa-chart-pie"></i>
            No-Show Rate: ${summary.no_show_rate || 0}%
          </div>
          <div class="badge badge-waiting" style="font-size:0.8rem; padding:6px 14px;">
            ${formatDateDisplay(date)}
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="summary-grid" style="margin-bottom:20px;">
      <div class="summary-card">
        <div class="s-num blue">${summary.total || 0}</div>
        <div class="s-label">Total Today</div>
      </div>
      <div class="summary-card">
        <div class="s-num green">${summary.done || 0}</div>
        <div class="s-label">Completed</div>
      </div>
      <div class="summary-card">
        <div class="s-num orange">${(summary.waiting || 0) + (summary.in_progress || 0)}</div>
        <div class="s-label">Remaining</div>
      </div>
      <div class="summary-card">
        <div class="s-num red">${summary.no_show || 0}</div>
        <div class="s-label">No Shows</div>
      </div>
    </div>

    <!-- Appointments List -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <h3><i class="fa-solid fa-list-check" style="color:var(--primary);"></i> Today's Appointments</h3>
        <button class="btn btn-ghost btn-sm" onclick="loadSchedule()">
          <i class="fa-solid fa-rotate-right"></i> Refresh
        </button>
      </div>
      <div class="card-body">
        <div class="appt-list" id="appt-list">
          ${appts.length === 0 ? renderEmptyAppts() : appts.map(a => renderApptItem(a)).join('')}
        </div>
      </div>
    </div>

    <!-- Weekly Calendar -->
    <div class="card">
      <div class="card-header">
        <h3><i class="fa-solid fa-calendar-week" style="color:var(--accent);"></i> 5-Day Calendar</h3>
      </div>
      <div class="card-body">
        ${renderWeekCalendar(weekData, date)}
      </div>
    </div>
  `;
}

function renderEmptyAppts() {
  return `
    <div class="empty-state">
      <i class="fa-solid fa-calendar-xmark"></i>
      <h3>No Appointments</h3>
      <p>No appointments scheduled for this date.</p>
    </div>`;
}

function renderApptItem(appt) {
  const statusClass = appt.status.toLowerCase().replace(' ', '');
  const badgeClass  = {
    'Waiting': 'badge-waiting',
    'In Progress': 'badge-inprogress',
    'Done': 'badge-done',
    'No Show': 'badge-noshow'
  }[appt.status] || '';

  let waitCompare = '';
  if (appt.predicted_wait_minutes != null) {
    const pred = appt.predicted_wait_minutes;
    const act  = appt.actual_wait_minutes;
    if (act != null) {
      const diff = act - pred;
      const cls  = diff > 0 ? 'wait-diff-pos' : 'wait-diff-neg';
      const sign = diff > 0 ? '+' : '';
      waitCompare = `
        <div class="wait-compare">
          <div class="predicted">Pred: ${pred} min</div>
          <div class="actual ${cls}">${act} min (${sign}${diff})</div>
        </div>`;
    } else {
      waitCompare = `
        <div class="wait-compare">
          <div class="predicted" style="font-size:0.8rem;">Est. Wait</div>
          <div class="actual" style="color:var(--primary);">~${pred} min</div>
        </div>`;
    }
  }

  const actionBtn = buildActionBtn(appt);

  return `
    <div class="appt-item ${statusClass}" id="appt-${appt.id}">
      <div class="appt-token-badge">
        #${appt.token_number}
        <small>Token</small>
      </div>
      <div class="appt-info">
        <h4>${escapeHtml(appt.patient_name)}</h4>
        <small>
          <i class="fa-solid fa-clock" style="color:var(--primary);"></i> ${appt.appointment_time}
          &nbsp;·&nbsp;
          Age: ${appt.age || '—'}
          &nbsp;·&nbsp;
          <i class="fa-solid fa-phone" style="color:var(--muted);"></i> ${appt.phone || '—'}
        </small>
      </div>
      ${waitCompare}
      <div>
        <span class="badge ${badgeClass}" style="display:block; margin-bottom:8px;">${appt.status}</span>
        ${actionBtn}
      </div>
    </div>`;
}

function buildActionBtn(appt) {
  if (appt.status === 'Done' || appt.status === 'No Show') {
    return `<span style="font-size:0.75rem; color:var(--muted);">Closed</span>`;
  }
  return `<button class="btn btn-sm btn-outline" onclick="openModal(${appt.id}, ${appt.token_number}, '${escapeHtml(appt.patient_name)}')">
    <i class="fa-solid fa-pen-to-square"></i> Update
  </button>`;
}

function renderWeekCalendar(weekData, selectedDate) {
  if (!weekData || weekData.length === 0) return '<p style="color:var(--muted);">No data available.</p>';

  const maxCount = Math.max(...weekData.map(d => d.count), 1);
  const today = new Date().toISOString().split('T')[0];

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return `<div class="week-grid">
    ${weekData.map(d => {
      const dt   = new Date(d.date + 'T00:00:00');
      const dow  = dt.getDay(); // 0=Sun, 1=Mon...
      const label = days[dow - 1] || days[4];
      const isToday = d.date === today;
      const fillPct = Math.round((d.count / maxCount) * 100);
      return `
        <div class="week-day${isToday ? ' today' : ''}">
          <div class="wd-label">${label}<br/><span style="font-weight:400; font-size:0.65rem;">${d.date.slice(5)}</span></div>
          <div class="wd-count">${d.count}</div>
          <div class="wd-bar">
            <div class="wd-bar-fill" style="width:${fillPct}%;"></div>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

// ── STATUS MODAL ──────────────────────────────────────────────
function openModal(apptId, tokenNum, patientName) {
  selectedAppointmentId = apptId;
  document.getElementById('modal-token').textContent   = tokenNum;
  document.getElementById('modal-patient').textContent = patientName;
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  selectedAppointmentId = null;
}

function updateStatus(status) {
  if (!selectedAppointmentId) return;
  closeModal();

  fetch('/api/update-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id: selectedAppointmentId, status })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(`Marked as "${status}"`, 'success');
        loadSchedule();
      } else {
        showToast('Update failed. Please try again.', 'error');
      }
    })
    .catch(() => showToast('Network error.', 'error'));
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
});

// ── HELPERS ───────────────────────────────────────────────────
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
