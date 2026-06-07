/* ============================================================
   token.js — Live Token Queue Display
   Auto-refreshes queue data every 8 seconds via fetch().
   Handles now-serving display, up-next, filter tabs, and
   Mark Done / Call Next actions for reception staff.
   ============================================================ */

let activeDoctor = null;   // null = all doctors
let allQueue     = [];
let doctors      = [];
let refreshTimer = null;

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  // Set date display
  const now = new Date();
  document.getElementById('queue-date').textContent =
    now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Load doctors for tabs then load queue
  fetch('/api/doctors')
    .then(r => r.json())
    .then(docs => {
      doctors = docs;
      renderDoctorTabs(docs);
      refreshQueue();
    })
    .catch(() => refreshQueue());

  // Start auto-refresh every 8 seconds
  refreshTimer = setInterval(refreshQueue, 8000);
});

// ── DOCTOR FILTER TABS ────────────────────────────────────────
function renderDoctorTabs(docs) {
  const tabsEl = document.getElementById('queue-tabs');
  docs.forEach(doc => {
    const btn = document.createElement('button');
    btn.className = 'queue-tab';
    btn.dataset.doctorId = doc.id;
    btn.innerHTML = `<i class="fa-solid fa-user-doctor"></i> ${escapeHtml(doc.name.split(' ').pop())}`;
    btn.onclick = () => filterByDoctor(doc.id, btn);
    tabsEl.appendChild(btn);
  });
}

function filterByDoctor(doctorId, btnEl) {
  activeDoctor = doctorId;
  document.querySelectorAll('.queue-tab').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  renderQueue(allQueue);
  updateNowServing();
}

// ── QUEUE REFRESH ─────────────────────────────────────────────
function refreshQueue() {
  const btn = document.getElementById('refresh-btn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';

  const url = '/api/queue' + (activeDoctor ? `?doctor_id=${activeDoctor}` : '');

  fetch(url)
    .then(r => r.json())
    .then(data => {
      allQueue = data.queue || [];
      renderQueue(allQueue);
      updateNowServing();

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      document.getElementById('last-updated').textContent = timeStr;
      if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh Now';
    })
    .catch(() => {
      if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh Now';
    });
}

// ── NOW SERVING + UP NEXT ─────────────────────────────────────
function updateNowServing() {
  const visible = getFilteredQueue();

  const inProgress = visible.filter(a => a.status === 'In Progress');
  const waiting    = visible.filter(a => a.status === 'Waiting');

  // Now Serving
  const nsTokenEl  = document.getElementById('ns-token');
  const nsDoctorEl = document.getElementById('ns-doctor');

  if (inProgress.length > 0) {
    const current = inProgress[0];
    nsTokenEl.textContent = `#${current.token_number}`;
    nsDoctorEl.textContent = `${current.patient_name} · ${current.doctor_name}`;
  } else if (waiting.length > 0) {
    nsTokenEl.textContent = `#${waiting[0].token_number}`;
    nsDoctorEl.textContent = `Next up — ${waiting[0].doctor_name}`;
  } else {
    nsTokenEl.textContent = '—';
    nsDoctorEl.textContent = 'No active appointments right now';
  }

  // Up Next: next 2 waiting after in-progress
  const upNext = waiting.slice(0, 2);
  document.getElementById('next-1').textContent = upNext[0] ? `#${upNext[0].token_number}` : '—';
  document.getElementById('next-2').textContent = upNext[1] ? `#${upNext[1].token_number}` : '—';

  // Total waiting
  document.getElementById('total-waiting').textContent = waiting.length + inProgress.length;
}

// ── RENDER TABLE ──────────────────────────────────────────────
function renderQueue(queue) {
  const tbody = document.getElementById('queue-tbody');
  const filtered = getFilteredQueue();

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:48px; color:rgba(255,255,255,0.3);">
          <i class="fa-solid fa-calendar-xmark" style="font-size:2rem; display:block; margin-bottom:12px; opacity:0.4;"></i>
          No appointments for today${activeDoctor ? ' for this doctor' : ''}.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const badgeClass = statusBadgeClass(a.status);
    const rowClass   = a.status === 'In Progress' ? 'inprogress-row' : '';
    const actions    = buildActions(a);
    const waitText   = a.predicted_wait_minutes ? `~${a.predicted_wait_minutes} min` : '—';

    return `
      <tr class="${rowClass}" id="row-${a.id}">
        <td><span class="token-num">#${a.token_number}</span></td>
        <td>${escapeHtml(a.patient_name)}</td>
        <td>
          <small style="display:block; color:rgba(255,255,255,0.4); font-size:0.72rem;">
            ${escapeHtml(a.specialization)}
          </small>
          ${escapeHtml(a.doctor_name)}
        </td>
        <td style="font-family:'Space Grotesk',monospace; color:rgba(255,255,255,0.7);">${a.appointment_time}</td>
        <td style="font-family:'Space Grotesk',monospace; color:rgba(255,255,255,0.6);">${waitText}</td>
        <td><span class="badge ${badgeClass}">${a.status}</span></td>
        <td>${actions}</td>
      </tr>`;
  }).join('');
}

function buildActions(appt) {
  if (appt.status === 'Done' || appt.status === 'No Show') {
    return `<span style="color:rgba(255,255,255,0.25); font-size:0.8rem;">Closed</span>`;
  }

  const btns = [];
  if (appt.status === 'Waiting') {
    btns.push(`<button class="btn btn-warning btn-sm" onclick="callNext(${appt.id})">
      <i class="fa-solid fa-bell"></i> Call
    </button>`);
  }
  if (appt.status === 'In Progress') {
    btns.push(`<button class="btn btn-accent btn-sm" onclick="markDone(${appt.id})">
      <i class="fa-solid fa-circle-check"></i> Done
    </button>`);
  }
  btns.push(`<button class="btn btn-sm" style="background:rgba(225,112,85,0.15); color:#e17055; border:1px solid rgba(225,112,85,0.3);"
    onclick="markNoShow(${appt.id})">
    <i class="fa-solid fa-user-slash"></i>
  </button>`);

  return btns.join(' ');
}

// ── STATUS ACTIONS ────────────────────────────────────────────
function callNext(appointmentId) {
  updateTokenStatus(appointmentId, 'In Progress');
}

function markDone(appointmentId) {
  updateTokenStatus(appointmentId, 'Done');
}

function markNoShow(appointmentId) {
  updateTokenStatus(appointmentId, 'No Show');
}

function updateTokenStatus(appointmentId, status) {
  fetch('/api/update-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id: appointmentId, status })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(`Status updated to ${status}`, 'success');
        // Optimistically update local state
        const appt = allQueue.find(a => a.id === appointmentId);
        if (appt) appt.status = status;
        renderQueue(allQueue);
        updateNowServing();
      } else {
        showToast('Update failed. Please try again.', 'error');
      }
    })
    .catch(() => showToast('Network error. Please try again.', 'error'));
}

// ── HELPERS ───────────────────────────────────────────────────
function getFilteredQueue() {
  if (!activeDoctor) return allQueue;
  return allQueue.filter(a => a.doctor_id === activeDoctor);
}

function statusBadgeClass(status) {
  const map = {
    'Waiting':     'badge-waiting',
    'In Progress': 'badge-inprogress',
    'Done':        'badge-done',
    'No Show':     'badge-noshow'
  };
  return 'badge ' + (map[status] || '');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
