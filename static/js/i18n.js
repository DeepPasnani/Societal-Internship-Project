/* ============================================================
   i18n.js — Gujarati/English language toggle for all pages
   Include on every page. Persists choice to localStorage.
   ============================================================ */

const HB_TRANSLATIONS = {
  en: {
    // Nav (inner pages)
    navHome: "Home", navBook: "Book", navQueue: "Queue",
    navDoctor: "Doctor", navAnalytics: "Analytics",

    // Token page
    liveTokenQueue: "Live Token Queue", nowServing: "Now Serving",
    upNext: "Up Next", afterThat: "After That", totalWaiting: "Total Waiting",
    tokenNumber: "Token #", patient: "Patient", doctor: "Doctor",
    time: "Time", estWait: "Est. Wait", status: "Status", actions: "Actions",

    // Booking form
    bookAppointment: "Book Appointment",
    step1: "Patient Details", step2: "Doctor & Time", step3: "Confirmation",
    yourName: "Your Name", phoneNumber: "Phone Number",
    selectDate: "Select Date", selectDoctor: "Select Doctor",
    confirmBooking: "Confirm Booking",
    consultFee: "Consultation Fee", amountDue: "Amount Due",
    predictedWait: "Predicted Wait Time", minutes: "minutes",
    tokenNumber2: "Your Token Number",
    doctorUnavail: "Doctor is not available on this day. Available: ",
    noSlotsDay: "No slots available — doctor does not work on this day.",

    // Homepage sections
    findCareTitle: "Find Care by Specialty",
    topHospitals: "Top Hospitals Near You",
    topDoctors: "Top Doctors by Specialty",
    topDoctorsSub: "Experienced doctors with live availability status",
    healthPackages: "Health Packages & Special Offers",
    healthPackagesSub: "Comprehensive health checkups and exclusive offers designed for your wellness journey",
    howItWorks: "How It Works",
    howItWorksSub: "Book your appointments in just 4 simple steps. Our smart token system ensures you never have to wait in long queues.",
    trustedBy: "Trusted by Thousands",
    trustedBySub: "Join millions of patients who trust HealthBook for their healthcare needs",

    // Buttons
    bookNow: "Book Now",
    viewProfile: "View Profile",
    bookAppointmentBtn: "Book Appointment",
    bookPackage: "Book Package",
    viewAllPackages: "View All Health Packages",
    viewAllDoctors: "View All Doctors",
    viewLiveQueue: "View Live Queue",
    downloadApp: "Download Our App",
    subscribe: "Subscribe",

    // Specialties
    specGeneral: "General Physicians", specPediatric: "Pediatricians",
    specDental: "Dentists", specENT: "ENT",
    specGynec: "Gynecologists", specCardio: "Cardiologists",
    specDerma: "Dermatologists", specPsych: "Psychiatrists",
    specOrtho: "Orthopedic Surgeon",

    // Packages page
    packagesTitle: "Health Packages & Offers",
    packagesSub: "Select a package that fits your health needs",
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
    yourName: "તમારું નામ", phoneNumber: "ફોન નંબર",
    selectDate: "તારીખ પસંદ કરો", selectDoctor: "ડૉક્ટર પસંદ કરો",
    confirmBooking: "બુકિંગ કન્ફર્મ કરો",
    consultFee: "પરામર્શ ફી", amountDue: "ચૂકવવાપાત્ર રકમ",
    predictedWait: "અંદાજિત રાહ સમય", minutes: "મિનિટ",
    tokenNumber2: "તમારો ટોકન નંબર",
    doctorUnavail: "ડૉક્ટર આ દિવસે ઉપલબ્ધ નથી. ઉપલબ્ધ: ",
    noSlotsDay: "સ્લોટ ઉપલબ્ધ નથી — ડૉક્ટર આ દિવસે કામ કરતા નથી.",

    findCareTitle: "વિશેષતા દ્વારા સારવાર શોધો",
    topHospitals: "નજીકની શ્રેષ્ઠ હૉસ્પિટલ",
    topDoctors: "વિશેષતા પ્રમાણે ડૉક્ટર",
    topDoctorsSub: "અનુભવી ડૉક્ટરો સાથે જીવંત ઉપલબ્ધતા",
    healthPackages: "આરોગ્ય પૅકેજ અને ઑફર",
    healthPackagesSub: "તમારી સ્વાસ્થ્ય જરૂરિયાત માટે વ્યાપક ચેકઅપ",
    howItWorks: "કેવી રીતે કામ કરે છે",
    howItWorksSub: "4 સરળ પગલામાં એપોઇન્ટમેન્ટ બુક કરો. અમારી સ્માર્ટ ટોકન સિસ્ટમ લાંબી રાહ દૂર કરે છે.",
    trustedBy: "હજારો દ્વારા વિશ્વસ્ત",
    trustedBySub: "લાખો દર્દીઓ HealthBook પર વિશ્વાસ કરે છે",

    bookNow: "અત્યારે બુક કરો",
    viewProfile: "પ્રોફાઇલ જુઓ",
    bookAppointmentBtn: "એપોઇન્ટમેન્ટ બુક કરો",
    bookPackage: "પૅકેજ બુક કરો",
    viewAllPackages: "બધા પૅકેજ જુઓ",
    viewAllDoctors: "બધા ડૉક્ટર જુઓ",
    viewLiveQueue: "જીવંત કતાર જુઓ",
    downloadApp: "અમારી એપ ડાઉનલોડ કરો",
    subscribe: "સબ્સ્ક્રાઇબ",

    specGeneral: "સામાન્ય ચિકિત્સક", specPediatric: "બાળ ચિકિત્સક",
    specDental: "દંત ચિકિત્સક", specENT: "કાન-નાક-ગળા",
    specGynec: "સ્ત્રીરોગ ચિકિત્સક", specCardio: "હ્રદય ચિકિત્સક",
    specDerma: "ત્વચા ચિકિત્સક", specPsych: "માનસ ચિકિત્સક",
    specOrtho: "અસ્થિ શલ્ય ચિકિત્સક",

    packagesTitle: "આરોગ્ય પૅકેજ અને ઑફર",
    packagesSub: "તમારી સ્વાસ્થ્ય જરૂરિયાત અનુસાર પૅકેજ પસંદ કરો",
  }
};

let _currentLang = localStorage.getItem('hb_lang') || 'en';

function hbSetLang(lang) {
  _currentLang = lang;
  localStorage.setItem('hb_lang', lang);

  // Update floating toggle buttons
  document.querySelectorAll('.glt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });

  // Update navbar lang display
  const display = document.getElementById('global-lang-display');
  if (display) display.textContent = lang === 'gu' ? 'ગુ' : 'EN';

  // Apply translations to data-i18n elements
  applyTranslations(lang);

  // Sync booking.js setLang if on booking page
  if (typeof setLang === 'function') setLang(lang);
}

function hbToggleLang() {
  hbSetLang(_currentLang === 'en' ? 'gu' : 'en');
}

function applyTranslations(lang) {
  const T = HB_TRANSLATIONS[lang] || HB_TRANSLATIONS['en'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (T[key] !== undefined) el.textContent = T[key];
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Inject floating toggle on every page (bottom-right corner)
  if (!document.getElementById('global-lang-toggle')) {
    const toggle = document.createElement('div');
    toggle.id = 'global-lang-toggle';
    toggle.innerHTML = `
      <button class="glt-btn ${_currentLang==='en'?'active':''}" data-lang="en" onclick="hbSetLang('en')">EN</button>
      <button class="glt-btn ${_currentLang==='gu'?'active':''}" data-lang="gu" onclick="hbSetLang('gu')">ગુ</button>`;
    document.body.appendChild(toggle);
  }

  // Update navbar display text
  const display = document.getElementById('global-lang-display');
  if (display) display.textContent = _currentLang === 'gu' ? 'ગુ' : 'EN';

  // Apply saved lang on load
  applyTranslations(_currentLang);
  if (_currentLang === 'gu' && typeof setLang === 'function') setLang('gu');
});
