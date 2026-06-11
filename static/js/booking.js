/* ============================================================
   booking.js — Appointment Booking (all bugs fixed)
   ============================================================ */

// ── TRANSLATIONS ─────────────────────────────────────────────
const translations = {
  en: {
    bookAppointment: "Book Appointment",
    selectDoctor:    "Select Doctor",
    yourName:        "Your Name",
    phoneNumber:     "Phone Number",
    selectDate:      "Select Date",
    confirmBooking:  "Confirm Booking",
    tokenNumber:     "Your Token Number",
    predictedWait:   "Predicted Wait Time",
    minutes:         "minutes",
    step1:           "Patient Details",
    step2:           "Doctor & Time",
    step3:           "Confirmation"
  },
  gu: {
    bookAppointment: "એપોઇન્ટમેન્ટ બુક કરો",
    selectDoctor:    "ડૉક્ટર પસંદ કરો",
    yourName:        "તમારું નામ",
    phoneNumber:     "ફોન નંબર",
    selectDate:      "તારીખ પસંદ કરો",
    confirmBooking:  "બુકિંગ કન્ફર્મ કરો",
    tokenNumber:     "તમારો ટોકન નંબર",
    predictedWait:   "અંદાજિત રાહ સમય",
    minutes:         "મિનિટ",
    step1:           "દર્દીની વિગતો",
    step2:           "ડૉક્ટર અને સમય",
    step3:           "પુષ્ટિ"
  }
};

// ── STATE ────────────────────────────────────────────────────
let currentStep       = 1;
let currentLang       = 'en';
let selectedDoctorId  = null;
let selectedDoctorName = '';
let selectedDoctorDays = '';   // FIX: track available days
let selectedSlot      = null;
let allDoctors        = [];

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  // Date: today as default, no past dates, no dates more than 30 days out
  const dateInput = document.getElementById('inp-date');
  const today     = new Date().toISOString().split('T')[0];
  const maxDate   = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  dateInput.min   = today;
  dateInput.max   = maxDate.toISOString().split('T')[0];
  dateInput.value = today;
  dateInput.addEventListener('change', onDateChange);

  loadDoctors();
});

// ── LANGUAGE TOGGLE ──────────────────────────────────────────
function setLang(lang) {
  currentLang = lang;
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('lang-gu').classList.toggle('active', lang === 'gu');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) el.textContent = translations[lang][key];
  });
}

// ── STEP NAVIGATION ──────────────────────────────────────────
function goToStep(step) {
  if (step > currentStep && !validateStep(currentStep)) return;

  for (let i = 1; i <= 3; i++) {
    const sidebar = document.getElementById(`sidebar-step-${i}`);
    sidebar.classList.remove('active', 'completed');
    if (i < step)  sidebar.classList.add('completed');
    if (i === step) sidebar.classList.add('active');

    const numEl = sidebar.querySelector('.step-number');
    numEl.innerHTML = i < step
      ? '<i class="fa-solid fa-check" style="font-size:13px;"></i>'
      : String(i);
  }

  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  currentStep = step;

  if (step === 3) fillConfirmation();
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

function validateStep(step) {
  if (step === 1) {
    const name  = document.getElementById('inp-name').value.trim();
    const phone = document.getElementById('inp-phone').value.trim();
    const errEl = document.getElementById('step1-error');
    if (!name) {
      showStepError(errEl, 'Please enter your full name.'); return false;
    }
    if (!/^\d{10}$/.test(phone)) {
      showStepError(errEl, 'Please enter a valid 10-digit phone number.'); return false;
    }
    errEl.style.display = 'none';
    return true;
  }
  if (step === 2) {
    const errEl = document.getElementById('step2-error');
    if (!selectedDoctorId) {
      showStepError(errEl, 'Please select a doctor.'); return false;
    }
    const date = document.getElementById('inp-date').value;
    if (!date) {
      showStepError(errEl, 'Please select an appointment date.'); return false;
    }
    // FIX: check doctor availability on selected day
    if (!isDoctorAvailable(selectedDoctorDays, date)) {
      const dayName = new Date(date + 'T00:00:00')
        .toLocaleDateString('en-IN', { weekday: 'long' });
      showStepError(errEl, `${selectedDoctorName} is not available on ${dayName}. Please choose a different date.`);
      return false;
    }
    if (!selectedSlot) {
      showStepError(errEl, 'Please select a time slot.'); return false;
    }
    errEl.style.display = 'none';
    return true;
  }
  return true;
}

function showStepError(el, msg) {
  el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
  el.style.display = 'block';
}

// FIX: Check if a date falls on one of doctor's available days
function isDoctorAvailable(availableDays, dateStr) {
  if (!availableDays) return true; // no restriction set
  const dayMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  const dow    = new Date(dateStr + 'T00:00:00').getDay();
  const dayAbbr = dayMap[dow];
  return availableDays.split(',').map(d => d.trim()).includes(dayAbbr);
}

// ── DOCTORS ──────────────────────────────────────────────────
const DOC_ICONS  = ['fa-stethoscope', 'fa-baby', 'fa-ear-listen', 'fa-venus'];
const DOC_COLORS = [
  'linear-gradient(135deg,#0d9488,#0ea5e9)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#6c5ce7,#a29bfe)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)'
];

function loadDoctors() {
  fetch('/api/doctors')
    .then(r => r.json())
    .then(docs => {
      allDoctors = docs;
      renderDoctorCards(docs);
    })
    .catch(() => {
      document.getElementById('doctor-cards').innerHTML =
        '<p style="color:var(--danger);padding:12px;"><i class="fa-solid fa-circle-exclamation"></i> Failed to load doctors. Please refresh.</p>';
    });
}

function renderDoctorCards(docs) {
  const grid = document.getElementById('doctor-cards');
  if (!docs.length) {
    grid.innerHTML = '<p style="color:var(--muted);padding:12px;">No doctors available.</p>';
    return;
  }
  grid.innerHTML = docs.map((doc, i) => `
    <div class="doctor-card" id="doc-card-${doc.id}"
         onclick="selectDoctor(${doc.id}, '${escapeAttr(doc.name)}', '${escapeAttr(doc.available_days || '')}')">
      <div class="doc-avatar" style="background:${DOC_COLORS[i % 4]};">
        <i class="fa-solid ${DOC_ICONS[i % 4]}"></i>
      </div>
      <div class="doc-info">
        <h4>${escapeHtml(doc.name)}</h4>
        <small>${escapeHtml(doc.specialization)}</small>
        <span class="doc-days">${escapeHtml(doc.available_days || 'Mon–Fri')}</span>
      </div>
    </div>
  `).join('');
}

function selectDoctor(id, name, availableDays) {
  selectedDoctorId   = id;
  selectedDoctorName = name;
  selectedDoctorDays = availableDays;  // FIX: store days
  selectedSlot       = null;

  document.querySelectorAll('.doctor-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`doc-card-${id}`);
  if (card) card.classList.add('selected');

  // FIX: clear any previous step2 error
  document.getElementById('step2-error').style.display = 'none';

  const date = document.getElementById('inp-date').value;
  if (date) {
    if (!isDoctorAvailable(availableDays, date)) {
      // Show availability warning without blocking slot load
      const container = document.getElementById('slot-container');
      const dayName   = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' });
      container.innerHTML = `<p style="color:var(--warning);font-size:0.875rem;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        ${escapeHtml(name)} is not available on ${dayName}. Please pick another date.
      </p>`;
    } else {
      loadSlots(id, date);
    }
  }
}

function onDateChange() {
  selectedSlot = null;
  document.getElementById('step2-error').style.display = 'none';

  if (!selectedDoctorId) {
    document.getElementById('slot-container').innerHTML =
      '<p style="color:var(--muted);font-size:0.875rem;"><i class="fa-solid fa-info-circle"></i> Select a doctor first.</p>';
    return;
  }
  const date = document.getElementById('inp-date').value;
  if (!isDoctorAvailable(selectedDoctorDays, date)) {
    const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' });
    document.getElementById('slot-container').innerHTML = `
      <p style="color:var(--warning);font-size:0.875rem;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        ${escapeHtml(selectedDoctorName)} is not available on ${dayName}. Please select a different date.
      </p>`;
    return;
  }
  loadSlots(selectedDoctorId, date);
}

// ── TIME SLOTS ────────────────────────────────────────────────
function loadSlots(doctorId, date) {
  const container = document.getElementById('slot-container');
  container.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0;"><i class="fa-solid fa-spinner fa-spin"></i> Loading slots...</div>';
  selectedSlot = null;

  fetch(`/api/slots?doctor_id=${doctorId}&date=${date}`)
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      if (!data.slots || data.slots.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);font-size:0.875rem;">No slots available for this date.</p>';
        return;
      }
      renderSlots(data.slots);
    })
    .catch(err => {
      container.innerHTML = `<p style="color:var(--danger);font-size:0.875rem;"><i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(err.message || 'Failed to load slots.')}</p>`;
    });
}

function renderSlots(slots) {
  const container = document.getElementById('slot-container');
  const available = slots.filter(s => !s.booked).length;
  container.innerHTML = `
    <p style="font-size:0.78rem;color:var(--muted);margin-bottom:10px;">
      <i class="fa-solid fa-circle-check" style="color:var(--accent);"></i>
      ${available} slot${available !== 1 ? 's' : ''} available
    </p>
    <div class="slot-grid">
      ${slots.map(s => {
        const slotId = `slot-${s.time.replace(':', '')}`;
        const cls    = s.booked ? 'time-slot booked' : 'time-slot';
        const onclick = s.booked ? '' : `onclick="selectSlot('${s.time}')"`;
        const title  = s.booked ? 'Already booked' : `Select ${s.time}`;
        return `<div class="${cls}" id="${slotId}" ${onclick} title="${title}">${s.time}</div>`;
      }).join('')}
    </div>`;
}

function selectSlot(time) {
  selectedSlot = time;
  document.querySelectorAll('.time-slot:not(.booked)').forEach(el => el.classList.remove('selected'));
  const el = document.getElementById(`slot-${time.replace(':', '')}`);
  if (el) el.classList.add('selected');
  // FIX: clear error when slot is picked
  document.getElementById('step2-error').style.display = 'none';
}

// ── CONFIRMATION ─────────────────────────────────────────────
function fillConfirmation() {
  const name  = document.getElementById('inp-name').value.trim();
  const phone = document.getElementById('inp-phone').value.trim();
  const date  = document.getElementById('inp-date').value;

  document.getElementById('confirm-name').textContent   = name;
  document.getElementById('confirm-phone').textContent  = phone;
  document.getElementById('confirm-doctor').textContent = selectedDoctorName;
  document.getElementById('confirm-date').textContent   = formatDate(date);   // FIX: always formatted
  document.getElementById('confirm-time').textContent   = selectedSlot || '—';
}

// ── SUBMIT ────────────────────────────────────────────────────
function submitBooking() {
  const errEl    = document.getElementById('step3-error');
  const submitBtn = document.getElementById('submit-btn');
  errEl.style.display = 'none';
  submitBtn.disabled  = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';

  const payload = {
    name:             document.getElementById('inp-name').value.trim(),
    phone:            document.getElementById('inp-phone').value.trim(),
    age:              parseInt(document.getElementById('inp-age').value) || null,
    doctor_id:        selectedDoctorId,
    appointment_date: document.getElementById('inp-date').value,
    appointment_time: selectedSlot
  };

  fetch('/api/book', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  })
    .then(r => {
      // FIX: handle 401 redirect to login
      if (r.status === 401) {
        window.location.href = '/login?next=/booking';
        throw new Error('Please sign in to book an appointment.');
      }
      return r.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      showSuccess(data);
    })
    .catch(err => {
      showStepError(errEl, err.message || 'Booking failed. Please try again.');
      submitBtn.disabled  = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-calendar-check"></i> <span data-i18n="confirmBooking">${translations[currentLang].confirmBooking}</span>`;
    });
}

function showSuccess(data) {
  document.getElementById('booking-form-wrap').style.display = 'none';
  const screen = document.getElementById('success-screen');
  screen.classList.add('show');
  screen.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('success-token').textContent  = `#${data.token_number}`;
  document.getElementById('success-wait').textContent   = data.predicted_wait_minutes;
  document.getElementById('success-doctor').textContent = data.doctor_name;
  document.getElementById('success-time').textContent   = `${formatDate(data.appointment_date)} · ${data.appointment_time}`;
  showToast('Appointment booked successfully!', 'success');
}

function resetBooking() {
  // FIX: properly reset all state
  selectedDoctorId   = null;
  selectedDoctorName = '';
  selectedDoctorDays = '';
  selectedSlot       = null;
  currentStep        = 1;

  document.getElementById('booking-form-wrap').style.display = 'block';
  document.getElementById('success-screen').classList.remove('show');
  document.getElementById('inp-name').value  = '';
  document.getElementById('inp-phone').value = '';
  document.getElementById('inp-age').value   = '';
  document.getElementById('step1-error').style.display = 'none';
  document.getElementById('step2-error').style.display = 'none';
  document.getElementById('step3-error').style.display = 'none';
  document.getElementById('submit-btn').disabled = false;  // FIX: correct ID
  document.getElementById('submit-btn').innerHTML = '<i class="fa-solid fa-calendar-check"></i> <span data-i18n="confirmBooking">Confirm Booking</span>';

  document.querySelectorAll('.doctor-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('slot-container').innerHTML =
    '<p style="color:var(--muted);font-size:0.875rem;"><i class="fa-solid fa-info-circle"></i> Select a doctor and date first</p>';

  goToStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── HELPERS ───────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
