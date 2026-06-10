/* ============================================================
   i18n.js — Gujarati language toggle for all pages
   Include on every page. Reads/writes localStorage 'hb_lang'.
   ============================================================ */

const HB_TRANSLATIONS = {
  en: {
    // Nav
    navHome: "Home", navBook: "Book", navQueue: "Queue",
    navDoctor: "Doctor", navAnalytics: "Analytics",
    // Token page
    liveTokenQueue: "Live Token Queue", nowServing: "Now Serving",
    upNext: "Up Next", afterThat: "After That", totalWaiting: "Total Waiting",
    tokenNumber: "Token #", patient: "Patient", doctor: "Doctor",
    time: "Time", estWait: "Est. Wait", status: "Status", actions: "Actions",
    // Booking
    bookAppointment: "Book Appointment",
    step1: "Patient Details", step2: "Doctor & Time", step3: "Confirmation",
    // Index
    topHospitals: "Top Hospitals Near You", topDoctors: "Top Doctors by Specialty",
    healthPackages: "Health Packages & Special Offers",
    howItWorks: "How It Works", trustedBy: "Trusted by Thousands",
    bookNow: "Book Now", viewProfile: "View Profile",
    bookAppointmentBtn: "Book Appointment",
  },
  gu: {
    navHome: "હોમ", navBook: "બુક", navQueue: "કતાર",
    navDoctor: "ડૉક્ટર", navAnalytics: "વિશ્લેષણ",
    liveTokenQueue: "જીવંત ટોકન કતાર", nowServing: "હવે સેવા",
    upNext: "આગળ", afterThat: "ત્યારબાદ", totalWaiting: "કુલ રાહ",
    tokenNumber: "ટોકન #", patient: "દર્દી", doctor: "ડૉક્ટર",
    time: "સમય", estWait: "અંદાજ. રાહ", status: "સ્થિતિ", actions: "ક્રિયાઓ",
    bookAppointment: "એપોઇન્ટમેન્ટ બુક કરો",
    step1: "દર્દીની વિગતો", step2: "ડૉક્ટર અને સમય", step3: "પુષ્ટિ",
    topHospitals: "નજીકની શ્રેષ્ઠ હૉસ્પિટલ", topDoctors: "વિશેષતા પ્રમાણે ડૉક્ટર",
    healthPackages: "આરોગ્ય પૅકેજ અને ઑફર",
    howItWorks: "કેવી રીતે કામ કરે છે", trustedBy: "હજારો દ્વારા વિશ્વસ્ત",
    bookNow: "અત્યારે બુક કરો", viewProfile: "પ્રોફાઇલ જુઓ",
    bookAppointmentBtn: "એપોઇન્ટમેન્ટ બુક કરો",
  }
};

let _currentLang = localStorage.getItem('hb_lang') || 'en';

function hbSetLang(lang) {
  _currentLang = lang;
  localStorage.setItem('hb_lang', lang);

  // Update toggle buttons
  document.querySelectorAll('.hb-lang-btn-en, .hb-lang-btn-gu, #lang-en, #lang-gu').forEach(btn => {
    const isEn = btn.id === 'lang-en' || btn.classList.contains('hb-lang-btn-en');
    btn.classList.toggle('active', isEn ? lang === 'en' : lang === 'gu');
  });
  // Update global toggle
  const globalToggle = document.getElementById('global-lang-display');
  if (globalToggle) globalToggle.textContent = lang === 'gu' ? 'ગુ' : 'EN';

  // Apply to data-i18n elements
  applyTranslations(lang);

  // Tell booking.js if present
  if (typeof setLang === 'function') setLang(lang);
}

function applyTranslations(lang) {
  const T = HB_TRANSLATIONS[lang] || HB_TRANSLATIONS['en'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (T[key] !== undefined) el.textContent = T[key];
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Inject floating toggle on every page if not already present
  if (!document.getElementById('global-lang-toggle')) {
    const toggle = document.createElement('div');
    toggle.id = 'global-lang-toggle';
    toggle.innerHTML = `
      <button class="glt-btn ${_currentLang==='en'?'active':''}" onclick="hbSetLang('en')">EN</button>
      <button class="glt-btn ${_currentLang==='gu'?'active':''}" onclick="hbSetLang('gu')">ગુ</button>`;
    document.body.appendChild(toggle);
  }
  // Apply saved language on load
  applyTranslations(_currentLang);
  if (_currentLang === 'gu' && typeof setLang === 'function') setLang('gu');
});
