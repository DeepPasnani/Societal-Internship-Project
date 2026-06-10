/* ============================================================
   booking.js — Appointment Booking Logic
   Handles 3-step form, doctor card selection, slot loading,
   form submission, success screen, Gujarati language toggle,
   day-of-week validation, and consultation fee display.
   ============================================================ */

// ── TRANSLATIONS ────────────────────────────────────────────
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
    step3:           "Confirmation",
    consultFee:      "Consultation Fee",
    amountDue:       "Amount Due",
    doctorUnavail:   "Doctor is not available on this day. Available: ",
    noSlotsDay:      "No slots available — doctor does not work on this day.",
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
    step3:           "પુષ્ટિ",
    consultFee:      "પરામર્શ ફી",
    amountDue:       "ચૂકવવાપાત્ર રકમ",
    doctorUnavail:   "ડૉક્ટર આ દિવસે ઉપલબ્ધ નથી. ઉપલબ્ધ: ",
    noSlotsDay:      "સ્લોટ ઉપલબ્ધ નથી — ડૉક્ટર આ દિવસે કામ કરતા નથી.",
  }
};

// Day name maps
const DAY_MAP_EN = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:0 };
const DAY_NAMES_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_NAMES_GU = ['રવિ','સોમ','મંગળ','બુધ','ગુરુ','શુક્ર','શનિ'];

// ── STATE ───────────────────────────────────────────────────
let currentStep      = 1;
let currentLang      = 'en';
let selectedDoctorId   = null;
let selectedDoctorName = '';
let selectedDoctorData = null;   // full doctor object
let selectedSlot       = null;
let allDoctors         = [];

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      document.getElementById('navLinks').classList.toggle('open');
    });
  }

  // Date: today as default, no past dates
  const dateInput = document.getElementById('inp-date');
  const today = new Date().toISOString().split('T')[0];
  dateInput.min   = today;
  dateInput.value = today;
  dateInput.addEventListener('change', onDateChange);

  loadDoctors();

  // Pre-select specialty or doctor_id if passed in URL
  const params = new URLSearchParams(window.location.search);
  const spec   = params.get('specialty');
  const docId  = params.get('doctor_id');
  if (spec)  window._preSelectSpecialty = spec.toLowerCase();
  if (docId) window._preSelectDoctorId  = parseInt(docId);
});

// ── LANGUAGE TOGGLE ──────────────────────────────────────────
function setLang(lang) {
  currentLang = lang;
  const enBtn = document.getElementById('lang-en');
  const guBtn = document.getElementById('lang-gu');
  if (enBtn) enBtn.classList.toggle('active', lang === 'en');
  if (guBtn) guBtn.classList.toggle('active', lang === 'gu');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) el.textContent = translations[lang][key];
  });

  // Re-render doctor cards with new language if loaded
  if (allDoctors.length) renderDoctorCards(allDoctors);
  // Update fee display language
  updateFeeDisplay();
}

// ── STEP NAVIGATION ───────────────────────────────────────────
function goToStep(step) {
  if (step > currentStep && !validateStep(currentStep)) return;

  for (let i = 1; i <= 3; i++) {
    const sidebar = document.getElementById(`sidebar-step-${i}`);
    if (!sidebar) continue;
    sidebar.classList.remove('active', 'completed');
    if (i < step) sidebar.classList.add('completed');
    if (i === step) sidebar.classList.add('active');
    const numEl = sidebar.querySelector('.step-number');
    if (numEl) {
      if (i < step) numEl.innerHTML = '<i class="fa-solid fa-check" style="font-size:13px;"></i>';
      else numEl.textContent = i;
    }
  }

  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`step-${step}`);
  if (target) target.classList.add('active');
  currentStep = step;

  if (step === 3) fillConfirmation();
  window.scrollTo({ top: 100, behavior: 'smooth' });
}

function validateStep(step) {
  if (step === 1) {
    const name  = document.getElementById('inp-name').value.trim();
    const phone = document.getElementById('inp-phone').value.trim();
    const errEl = document.getElementById('step1-error');
    if (!name)  { showStepError(errEl, 'Please enter your full name.'); return false; }
    if (!/^\d{10}$/.test(phone)) { showStepError(errEl, 'Please enter a valid 10-digit phone number.'); return false; }
    errEl.style.display = 'none';
    return true;
  }
  if (step === 2) {
    const errEl = document.getElementById('step2-error');
    if (!selectedDoctorId) { showStepError(errEl, 'Please select a doctor.'); return false; }
    const date = document.getElementById('inp-date').value;
    if (!date)             { showStepError(errEl, 'Please select an appointment date.'); return false; }

    // ── FIX 1: Validate doctor available on chosen day ──
    if (selectedDoctorData) {
      const dayIdx = new Date(date + 'T00:00:00').getDay(); // 0=Sun
      const dayName = DAY_NAMES_EN[dayIdx];
      const availDays = (selectedDoctorData.available_days || '').split(',').map(d => d.trim());
      if (!availDays.includes(dayName)) {
        const availStr = availDays.join(', ');
        showStepError(errEl, (translations[currentLang].doctorUnavail || 'Doctor unavailable. Available: ') + availStr);
        return false;
      }
    }

    if (!selectedSlot) { showStepError(errEl, 'Please select a time slot.'); return false; }
    errEl.style.display = 'none';
    return true;
  }
  return true;
}

function showStepError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

// ── DOCTORS ──────────────────────────────────────────────────
function loadDoctors() {
  fetch('/api/doctors')
    .then(r => r.json())
    .then(docs => {
      allDoctors = docs;
      renderDoctorCards(docs);
      // Auto-select by doctor_id (from "Book Now" link)
      if (window._preSelectDoctorId) {
        const match = docs.find(d => d.id === window._preSelectDoctorId);
        if (match) { selectDoctor(match.id, match.name, match); goToStep(2); }
      }
      // Auto-select if specialty pre-filter
      else if (window._preSelectSpecialty) {
        const match = docs.find(d =>
          d.specialization.toLowerCase().includes(window._preSelectSpecialty)
        );
        if (match) selectDoctor(match.id, match.name, match);
      }
    })
    .catch(() => {
      const grid = document.getElementById('doctor-cards');
      if (grid) grid.innerHTML = '<p style="color:var(--danger);">Failed to load doctors. Please refresh.</p>';
    });
}

const DOC_ICONS   = ['fa-stethoscope','fa-baby','fa-ear-listen','fa-venus'];
const DOC_COLORS  = [
  'linear-gradient(135deg,#1a6cf5,#5b8af5)',
  'linear-gradient(135deg,#00b894,#00cec9)',
  'linear-gradient(135deg,#6c5ce7,#a29bfe)',
  'linear-gradient(135deg,#e17055,#fab1a0)',
];

function renderDoctorCards(docs) {
  const grid = document.getElementById('doctor-cards');
  if (!grid) return;
  const today     = new Date();
  const todayName = DAY_NAMES_EN[today.getDay()];

  grid.innerHTML = docs.map((doc, i) => {
    const availDays = (doc.available_days || '').split(',').map(d => d.trim());
    const isAvailToday = availDays.includes(todayName);
    const availLabel = currentLang === 'gu'
      ? availDays.map(d => { const idx = DAY_NAMES_EN.indexOf(d); return idx>=0 ? DAY_NAMES_GU[idx] : d; }).join(', ')
      : availDays.join(', ');
    const feeLabel = doc.consultation_fee
      ? `<span class="doc-fee">₹${doc.consultation_fee}</span>`
      : '';
    const availDot = isAvailToday
      ? '<span class="doc-avail-dot avail-green" title="Available today"></span>'
      : '<span class="doc-avail-dot avail-grey" title="Not available today"></span>';
    const selected = selectedDoctorId === doc.id ? ' selected' : '';

    return `
      <div class="doctor-card${selected}" id="doc-card-${doc.id}"
           onclick="selectDoctor(${doc.id}, '${escapeHtml(doc.name)}', ${JSON.stringify(doc).replace(/'/g,"&#39;")})">
        <div class="doc-avatar" style="background:${DOC_COLORS[i % 4]};">
          <i class="fa-solid ${DOC_ICONS[i % 4]}"></i>
          ${availDot}
        </div>
        <div class="doc-info">
          <h4>${escapeHtml(doc.name)}</h4>
          <small>${escapeHtml(doc.specialization)}</small>
          <span class="doc-days">${availLabel}</span>
          ${feeLabel}
        </div>
      </div>`;
  }).join('');
}

function selectDoctor(id, name, docData) {
  // docData might be a JSON string from inline onclick
  if (typeof docData === 'string') {
    try { docData = JSON.parse(docData); } catch(e) { docData = null; }
  }
  selectedDoctorId   = id;
  selectedDoctorName = name;
  selectedDoctorData = docData;
  selectedSlot       = null;

  document.querySelectorAll('.doctor-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`doc-card-${id}`);
  if (card) card.classList.add('selected');

  // Show fee for selected doctor
  updateFeeDisplay();

  const date = document.getElementById('inp-date').value;
  if (date) loadSlots(id, date);
}

function updateFeeDisplay() {
  const feeWrap = document.getElementById('fee-display');
  if (!feeWrap) return;
  if (selectedDoctorData && selectedDoctorData.consultation_fee) {
    const label = translations[currentLang].consultFee || 'Consultation Fee';
    feeWrap.style.display = 'flex';
    feeWrap.innerHTML = `<i class="fa-solid fa-indian-rupee-sign"></i>&nbsp;<strong>${label}:</strong>&nbsp;₹${selectedDoctorData.consultation_fee}`;
  } else {
    feeWrap.style.display = 'none';
  }
}

function onDateChange() {
  if (selectedDoctorId) {
    const date = document.getElementById('inp-date').value;
    // Warn if doctor unavailable on this day
    if (selectedDoctorData) {
      const dayIdx  = new Date(date + 'T00:00:00').getDay();
      const dayName = DAY_NAMES_EN[dayIdx];
      const availDays = (selectedDoctorData.available_days || '').split(',').map(d => d.trim());
      const warnEl  = document.getElementById('date-unavail-warn');
      if (!availDays.includes(dayName) && warnEl) {
        warnEl.textContent = (translations[currentLang].doctorUnavail || 'Doctor unavailable. Available: ') + availDays.join(', ');
        warnEl.style.display = 'block';
      } else if (warnEl) {
        warnEl.style.display = 'none';
      }
    }
    loadSlots(selectedDoctorId, date);
  }
}

// ── TIME SLOTS ────────────────────────────────────────────────
function loadSlots(doctorId, date) {
  const container = document.getElementById('slot-container');
  if (!container) return;
  container.innerHTML = '<div style="color:var(--muted); font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading slots...</div>';
  selectedSlot = null;

  fetch(`/api/slots?doctor_id=${doctorId}&date=${date}`)
    .then(r => r.json())
    .then(data => {
      if (data.error) { container.innerHTML = `<p style="color:var(--danger);">${data.error}</p>`; return; }
      // FIX 1: Backend returns available_days — check it
      if (data.unavailable) {
        const t = translations[currentLang];
        container.innerHTML = `<div class="slot-unavail-msg"><i class="fa-solid fa-calendar-xmark"></i> ${t.noSlotsDay || data.unavailable}</div>`;
        return;
      }
      if (!data.slots || data.slots.length === 0) {
        container.innerHTML = '<p style="color:var(--muted); font-size:0.875rem;">No slots available for this date.</p>';
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
             id="slot-${s.time.replace(':','')}"
             onclick="${s.booked ? '' : `selectSlot('${s.time}')`}"
             title="${s.booked ? 'Already booked' : s.time}">
          ${s.time}
        </div>
      `).join('')}
    </div>`;
}

function selectSlot(time) {
  selectedSlot = time;
  document.querySelectorAll('.time-slot:not(.booked)').forEach(el => el.classList.remove('selected'));
  const slotEl = document.getElementById(`slot-${time.replace(':','')}`);
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

  // FIX 3: Show amount due in confirmation
  const feeRow = document.getElementById('confirm-fee-row');
  if (feeRow && selectedDoctorData && selectedDoctorData.consultation_fee) {
    feeRow.style.display = 'flex';
    document.getElementById('confirm-fee').textContent = `₹${selectedDoctorData.consultation_fee}`;
  } else if (feeRow) {
    feeRow.style.display = 'none';
  }
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
    appointment_time: selectedSlot,
  };

  fetch('/api/book', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        if (data.redirect) { window.location.href = data.redirect; return; }
        throw new Error(data.error);
      }
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

  document.getElementById('success-token').textContent  = `#${data.token_number}`;
  document.getElementById('success-wait').textContent   = data.predicted_wait_minutes;
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
  selectedDoctorId   = null;
  selectedDoctorName = '';
  selectedDoctorData = null;
  selectedSlot       = null;

  document.querySelectorAll('.doctor-card').forEach(c => c.classList.remove('selected'));
  const sc = document.getElementById('slot-container');
  if (sc) sc.innerHTML = '<p style="color:var(--muted); font-size:0.875rem;"><i class="fa-solid fa-info-circle"></i> Select a doctor and date first</p>';
  const fd = document.getElementById('fee-display');
  if (fd) fd.style.display = 'none';
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
