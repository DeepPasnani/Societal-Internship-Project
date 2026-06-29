/* ============================================================
   token.js — Live Token Queue (bugs fixed)
   ============================================================ */

let activeDoctor = null;
let allQueue     = [];
let doctors      = [];
let refreshTimer = null;
let userRole     = 'guest';

document.addEventListener('DOMContentLoaded', () => {
  userRole = document.getElementById('user-role')?.dataset.role || 'guest';

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  const now = new Date();
  document.getElementById('queue-date').textContent =
    now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  fetch('/api/doctors')
    .then(r => r.json())
    .then(docs => {
      doctors = docs;
      renderDoctorTabs(docs);
      refreshQueue();
    })
    .catch(() => refreshQueue());

  refreshTimer = setInterval(refreshQueue, 8000);
});

function canManageQueue() {
  return userRole === 'doctor' || userRole === 'admin';
}

function renderDoctorTabs(docs) {
  const tabsEl = document.getElementById('queue-tabs');
  docs.forEach(doc => {
    const btn       = document.createElement('button');
    btn.className   = 'queue-tab';
    btn.dataset.doctorId = doc.id;
    // Show last name only for brevity
    btn.innerHTML   = `<i class="fa-solid fa-user-doctor"></i> ${escapeHtml(doc.name.split(' ').pop())}`;
    btn.onclick     = () => filterByDoctor(doc.id, btn);
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

function refreshQueue() {
  const btn = document.getElementById('refresh-btn');
  if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';

  const url = '/api/queue' + (activeDoctor ? `?doctor_id=${activeDoctor}` : '');

  fetch(url)
    .then(r => {
      // FIX: handle 401 gracefully — show action buttons only when authenticated
      if (r.status === 401) { return { queue: [] }; }
      return r.json();
    })
    .then(data => {
      allQueue = data.queue || [];
      renderQueue(allQueue);
      updateNowServing();
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      document.getElementById('last-updated').textContent = timeStr;
      if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh Now';
    })
    .catch(() => {
      if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh Now';
    });
}

function updateNowServing() {
  const visible    = getFilteredQueue();
  const inProgress = visible.filter(a => a.status === 'In Progress');
  const waiting    = visible.filter(a => a.status === 'Waiting');

  const nsTokenEl  = document.getElementById('ns-token');
  const nsDoctorEl = document.getElementById('ns-doctor');

  if (inProgress.length > 0) {
    const cur = inProgress[0];
    nsTokenEl.textContent  = `#${cur.token_number}`;
    nsDoctorEl.textContent = cur.patient_name ? `${cur.patient_name} · ${cur.doctor_name}` : cur.doctor_name;
  } else if (waiting.length > 0) {
    nsTokenEl.textContent  = `#${waiting[0].token_number}`;
    nsDoctorEl.textContent = `Next up — ${waiting[0].doctor_name}`;
  } else {
    nsTokenEl.textContent  = '—';
    nsDoctorEl.textContent = 'No active appointments right now';
  }

  const upNext = waiting.slice(0, 2);
  document.getElementById('next-1').textContent = upNext[0] ? `#${upNext[0].token_number}` : '—';
  document.getElementById('next-2').textContent = upNext[1] ? `#${upNext[1].token_number}` : '—';
  document.getElementById('total-waiting').textContent = waiting.length + inProgress.length;
}

function renderQueue(queue) {
  const tbody    = document.getElementById('queue-tbody');
  const filtered = getFilteredQueue();

  if (filtered.length === 0) {
    const emptyColspan = canManageQueue() ? 7 : 6;
    tbody.innerHTML = `
      <tr>
        <td colspan="${emptyColspan}" style="text-align:center;padding:48px;color:rgba(255,255,255,0.3);">
          <i class="fa-solid fa-calendar-xmark" style="font-size:2rem;display:block;margin-bottom:12px;opacity:0.4;"></i>
          No appointments for today${activeDoctor ? ' for this doctor' : ''}.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const badgeClass = statusBadgeClass(a.status);   // FIX: no double 'badge'
    const rowClass   = a.status === 'In Progress' ? 'inprogress-row' : '';
    const waitText   = a.predicted_wait_minutes != null ? `~${a.predicted_wait_minutes} min` : '—';
    const timeText   = a.appointment_time || '—';
    const specText   = a.specialization || '';
    const patientText = a.patient_name || '';
    const rowId = a.id || `${a.token_number}-${a.doctor_name}`;

    return `
      <tr class="${rowClass}" id="row-${rowId}">
        <td><span class="token-num">#${a.token_number}</span></td>
        <td>${patientText ? escapeHtml(patientText) : '<span style="color:rgba(255,255,255,0.25);font-size:0.8rem;">—</span>'}</td>
        <td>
          <small style="display:block;color:rgba(255,255,255,0.4);font-size:0.72rem;">${escapeHtml(specText)}</small>
          ${escapeHtml(a.doctor_name)}
        </td>
        <td style="font-family:'Space Grotesk',monospace;color:rgba(255,255,255,0.7);">${timeText}</td>
        <td style="font-family:'Space Grotesk',monospace;color:rgba(255,255,255,0.6);">${waitText}</td>
        <td><span class="${badgeClass}">${a.status}</span></td>
        ${canManageQueue() ? `<td>${buildActions(a)}</td>` : ''}
      </tr>`;
  }).join('');
}

function buildActions(appt) {
  const canAct = canManageQueue();
  if (appt.status === 'Done' || appt.status === 'No Show') {
    return canAct
      ? `<span style="color:rgba(255,255,255,0.25);font-size:0.8rem;">Closed</span>`
      : '';
  }
  if (!canAct) return '';
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
  btns.push(`<button class="btn btn-sm" style="background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);"
    onclick="markNoShow(${appt.id})" title="No Show">
    <i class="fa-solid fa-user-slash"></i>
  </button>`);
  return btns.join(' ');
}

function callNext(id)    { updateTokenStatus(id, 'In Progress'); }
function markDone(id)    { updateTokenStatus(id, 'Done'); }
function markNoShow(id)  { updateTokenStatus(id, 'No Show'); }

function updateTokenStatus(appointmentId, status) {
  fetch('/api/update-token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ appointment_id: appointmentId, status })
  })
    .then(r => {
      // FIX: handle 401 gracefully
      if (r.status === 401) {
        showToast('Please sign in to update token status.', 'error');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
        return null;
      }
      return r.json();
    })
    .then(data => {
      if (!data) return;
      if (data.success) {
        showToast(`Status updated to ${status}`, 'success');
        const appt = allQueue.find(a => a.id === appointmentId);
        if (appt) appt.status = status;
        renderQueue(allQueue);
        updateNowServing();
      } else {
        showToast(data.error || 'Update failed.', 'error');
      }
    })
    .catch(() => showToast('Network error. Please try again.', 'error'));
}

function getFilteredQueue() {
  if (!activeDoctor) return allQueue;
  return allQueue.filter(a => a.doctor_id === activeDoctor);
}

// FIX: return just the status class, not 'badge badge-...'
function statusBadgeClass(status) {
  const map = {
    'Waiting':     'badge badge-waiting',
    'In Progress': 'badge badge-inprogress',
    'Done':        'badge badge-done',
    'No Show':     'badge badge-noshow'
  };
  return map[status] || 'badge';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
