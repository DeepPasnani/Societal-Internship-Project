/* ============================================================
   booking.js — Appointment Booking Logic
   Handles 3-step form, doctor card selection, slot loading,
   form submission, success screen, and Gujarati language toggle.
   ============================================================ */

// ── TRANSLATIONS ────────────────────────────────────────────
const translations = {
  en: {
    bookAppointment:  "Book Appointment",
    selectDoctor:     "Select Doctor",
    yourName:         "Your Name",
    phoneNumber:      "Phone Number",
    selectDate:       "Select Date",
    confirmBooking:   "Confirm Booking",
    tokenNumber:      "Your Token Number",
    predictedWait:    "Predicted Wait Time",
    minutes:          "minutes",
    step1:            "Patient Details",
    step2:            "Doctor & Time",
    step3:            "Confirmation"
  },
  gu: {
    bookAppointment:  "એપોઇન્ટમેન્ટ બુક કરો",
    selectDoctor:     "ડૉક્ટર પસંદ કરો",
    yourName:         "તમારું નામ",
    phoneNumber:      "ફોન નંબર",
    selectDate:       "તારીખ પસંદ કરો",
    confirmBooking:   "બુકિંગ કન્ફર્મ કરો",
    tokenNumber:      "તમારો ટોકન નંબર",
    predictedWait:    "અંદાજિત રાહ સમય",
    minutes:          "મિનિટ",
    step1:            "દર્દીની વિગતો",
    step2:            "ડૉક્ટર અને સમય",
    step3:            "પુષ્ટિ"
  }
};

// ── STATE ───────────────────────────────────────────────────
let currentStep = 1;
let currentLang = 'en';
let selectedDoctorId = null;
let selectedDoctorName = '';
let selectedSlot = null;
let allDoctors = [];

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  // Set today's date as default, disable past dates
  const dateInput = document.getElementById('inp-date');
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  dateInput.value = today;
  dateInput.addEventListener('change', onDateChange);

  // Load doctors
  loadDoctors();
});

// ── LANGUAGE TOGGLE ──────────────────────────────────────────
function setLang(lang) {
  currentLang = lang;
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('lang-gu').classList.toggle('active', lang === 'gu');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

// ── STEP NAVIGATION ───────────────────────────────────────────
function goToStep(step) {
  // Validate before advancing
  if (step > currentStep) {
    if (!validateStep(currentStep)) return;
  }

  // Update sidebar
  for (let i = 1; i <= 3; i++) {
    const sidebar = document.getElementById(`sidebar-step-${i}`);
    sidebar.classList.remove('active', 'completed');
    if (i < step) sidebar.classList.add('completed');
    if (i === step) sidebar.classList.add('active');

    const numEl = sidebar.querySelector('.step-number');
    if (i < step) {
      numEl.innerHTML = '<i class="fa-solid fa-check" style="font-size:13px;"></i>';
    } else {
      numEl.textContent = i;
    }
  }

  // Update content panels
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`step-${step}`).classList.add('active');
  currentStep = step;

  // Pre-fill confirmation
  if (step === 3) fillConfirmation();

  // Scroll to top of form
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById('inp-name').value.trim();
    const phone = document.getElementById('inp-phone').value.trim();
    const errEl = document.getElementById('step1-error');

    if (!name) {
      showStepError(errEl, 'Please enter your full name.');
      return false;
    }
    if (!/^\d{10}$/.test(phone)) {
      showStepError(errEl, 'Please enter a valid 10-digit phone number.');
      return false;
    }
    errEl.style.display = 'none';
    return true;
  }

  if (step === 2) {
    const errEl = document.getElementById('step2-error');
    if (!selectedDoctorId) {
      showStepError(errEl, 'Please select a doctor.');
      return false;
    }
    if (!document.getElementById('inp-date').value) {
      showStepError(errEl, 'Please select an appointment date.');
      return false;
    }
    if (!selectedSlot) {
      showStepError(errEl, 'Please select a time slot.');
      return false;
    }
    errEl.style.display = 'none';
    return true;
  }

  return true;
}

function showStepError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = ''; });
}

// ── DOCTORS ──────────────────────────────────────────────────
function loadDoctors() {
  fetch('/api/doctors')
    .then(r => r.json())
    .then(docs => {
      allDoctors = docs;
      renderDoctorCards(docs);
    })
    .catch(() => {
      document.getElementById('doctor-cards').innerHTML =
        '<p style="color:var(--danger);">Failed to load doctors. Please refresh.</p>';
    });
}

const DOC_ICONS = ['fa-stethoscope', 'fa-baby', 'fa-ear-listen', 'fa-venus'];
const DOC_COLORS = [
  'linear-gradient(135deg,#1a6cf5,#5b8af5)',
  'linear-gradient(135deg,#00b894,#00cec9)',
  'linear-gradient(135deg,#6c5ce7,#a29bfe)',
  'linear-gradient(135deg,#e17055,#fab1a0)'
];

function renderDoctorCards(docs) {
  const grid = document.getElementById('doctor-cards');
  grid.innerHTML = docs.map((doc, i) => `
    <div class="doctor-card" id="doc-card-${doc.id}" onclick="selectDoctor(${doc.id}, '${escapeHtml(doc.name)}')">
      <div class="doc-avatar" style="background:${DOC_COLORS[i % 4]};">
        <i class="fa-solid ${DOC_ICONS[i % 4]}"></i>
      </div>
      <div class="doc-info">
        <h4>${escapeHtml(doc.name)}</h4>
        <small>${escapeHtml(doc.specialization)}</small>
        <span class="doc-days">${escapeHtml(doc.available_days || '')}</span>
      </div>
    </div>
  `).join('');
}

function selectDoctor(id, name) {
  selectedDoctorId = id;
  selectedDoctorName = name;
  selectedSlot = null;

  // Highlight selected card
  document.querySelectorAll('.doctor-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`doc-card-${id}`).classList.add('selected');

  // Load slots if date is set
  const date = document.getElementById('inp-date').value;
  if (date) loadSlots(id, date);
}

function onDateChange() {
  if (selectedDoctorId) {
    const date = document.getElementById('inp-date').value;
    loadSlots(selectedDoctorId, date);
  }
}

// ── TIME SLOTS ────────────────────────────────────────────────
function loadSlots(doctorId, date) {
  const container = document.getElementById('slot-container');
  container.innerHTML = '<div style="color:var(--muted); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading slots...</div>';
  selectedSlot = null;

  fetch(`/api/slots?doctor_id=${doctorId}&date=${date}`)
    .then(r => r.json())
    .then(data => {
      if (!data.slots || data.slots.length === 0) {
        container.innerHTML = '<p style="color:var(--muted); font-size:0.875rem;">No slots available for this doctor on the selected date.</p>';
        return;
      }
      renderSlots(data.slots);
    })
    .catch(() => {
      container.innerHTML = '<p style="color:var(--danger); font-size:0.875rem;">Failed to load slots.</p>';
    });
}

function renderSlots(slots) {
  const container = document.getElementById('slot-container');
  container.innerHTML = `
    <div class="slot-grid">
      ${slots.map(s => `
        <div class="time-slot${s.booked ? ' booked' : ''}"
             id="slot-${s.time.replace(':', '')}"
             onclick="${s.booked ? '' : `selectSlot('${s.time}')`}"
             title="${s.booked ? 'Already booked' : s.time}">
          ${s.time}
        </div>
      `).join('')}
    </div>
  `;
}

function selectSlot(time) {
  selectedSlot = time;
  document.querySelectorAll('.time-slot:not(.booked)').forEach(el => el.classList.remove('selected'));
  const slotEl = document.getElementById(`slot-${time.replace(':', '')}`);
  if (slotEl) slotEl.classList.add('selected');
}

// ── CONFIRMATION ──────────────────────────────────────────────
function fillConfirmation() {
  const name  = document.getElementById('inp-name').value.trim();
  const phone = document.getElementById('inp-phone').value.trim();
  const date  = document.getElementById('inp-date').value;

  document.getElementById('confirm-name').textContent   = name;
  document.getElementById('confirm-phone').textContent  = phone;
  document.getElementById('confirm-doctor').textContent = selectedDoctorName;
  document.getElementById('confirm-date').textContent   = formatDate(date);
  document.getElementById('confirm-time').textContent   = selectedSlot || '—';
}

// ── SUBMIT ────────────────────────────────────────────────────
function submitBooking() {
  const errEl = document.getElementById('step3-error');
  errEl.style.display = 'none';

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      showSuccess(data);
    })
    .catch(err => {
      showStepError(errEl, 'Booking failed: ' + (err.message || 'Please try again.'));
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-calendar-check"></i> <span data-i18n="confirmBooking">${translations[currentLang].confirmBooking}</span>`;
    });
}

function showSuccess(data) {
  document.getElementById('booking-form-wrap').style.display = 'none';
  const screen = document.getElementById('success-screen');
  screen.classList.add('show');

  document.getElementById('success-token').textContent = `#${data.token_number}`;
  document.getElementById('success-wait').textContent  = data.predicted_wait_minutes;
  document.getElementById('success-doctor').textContent = data.doctor_name;
  document.getElementById('success-time').textContent   = `${formatDate(data.appointment_date)} · ${data.appointment_time}`;

  showToast('Appointment booked successfully!', 'success');
}

function resetBooking() {
  document.getElementById('booking-form-wrap').style.display = 'block';
  document.getElementById('success-screen').classList.remove('show');
  document.getElementById('inp-name').value  = '';
  document.getElementById('inp-phone').value = '';
  document.getElementById('inp-age').value   = '';
  selectedDoctorId = null;
  selectedDoctorName = '';
  selectedSlot = null;

  document.querySelectorAll('.doctor-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('slot-container').innerHTML = '<p style="color:var(--muted); font-size:0.875rem;"><i class="fa-solid fa-info-circle"></i> Select a doctor and date first</p>';
  document.getElementById('step-submit-btn')?.removeAttribute('disabled');
  goToStep(1);
}

// ── HELPERS ───────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
