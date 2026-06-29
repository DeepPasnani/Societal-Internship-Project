<div align="center">

# 🏥 HealthBook

### Smart Clinic Management for Small Clinics & PHCs

**Live Queue · ML Wait Predictions · Google & Phone Auth · Gujarati Support**

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)](https://flask.palletsprojects.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://docker.com)
[![GTU](https://img.shields.io/badge/GTU-Societal%20Internship-orange)](https://gtu.ac.in)

> Developed as part of the **GTU Societal Internship** · Subject Code **BE05000011**  
> Built for small clinics and Primary Health Centres in Vadodara, Gujarat

</div>

---

## 🩺 The Problem

Small clinics and PHCs in Gujarat run entirely on paper. Patients arrive with no idea how long they'll wait. Doctors have no visibility into their daily load. Administrators have no data to make decisions with. HealthBook digitizes the entire workflow — from the moment a patient books to the moment they are called in — with zero external infrastructure dependencies.

---

## ✨ What It Can Do

### For Patients
- Book appointments in 3 steps with real-time slot availability
- Receive a token number with an ML-predicted wait time at the moment of booking
- View the live queue on a TV-display-ready screen that auto-refreshes every 8 seconds
- Use the booking form in **Gujarati** for accessibility

### For Doctors
- View the full day schedule with patient names, ages, and appointment times
- Mark patients as In Progress, Done, or No Show in one click
- Track weekly appointment volume and personal no-show rates

### For Administrators
- Analytics dashboard with 6 charts and 4 live KPIs
- Insights into busiest hours, day-of-week patterns, doctor load distribution, and average wait times
- Predicted vs actual wait time scatter plot to monitor ML model accuracy over time

### Authentication
- **Google Sign-In** — one-click OAuth 2.0 login
- **Phone OTP** — Firebase SMS verification for patients without a Google account

---

## 🤖 ML Wait Time Predictor

When a patient completes booking, the system instantly predicts how long they will wait using a trained **RandomForest model**. The model accounts for:

- Number of patients ahead in the queue
- Doctor's average consultation time and historical no-show rate
- Time of day (morning rush 09–11 adds ~8 min on average)
- Day of the week, patient age, and whether an SMS reminder was sent
- Days between when the appointment was booked vs when it is scheduled

Training data is calibrated to real-world no-show statistics from the Kaggle Medical Appointments dataset (110k appointments).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · Flask 3.0 |
| Frontend | HTML5 · Vanilla CSS · JavaScript ES6 |
| Auth | Google OAuth 2.0 · Firebase Phone OTP |
| Database | SQLite3 with WAL mode |
| ML Model | scikit-learn RandomForestRegressor |
| Charts | Chart.js 4.x |
| Server | Gunicorn · Docker |

## 🗂️ Project Structure

├── app.py                  # All routes and auth logic
├── database.py             # SQLite setup, WAL mode, atomic token allocation
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .gitignore
├── model/
│   ├── train.py            # Model trainer
│   ├── predict.py          # Wait time prediction with fallback formula
│   └── wait_model.pkl      # Trained model file (auto-generated)
├── data/
│   └── KaggleV2-May-2016.csv   # Optional real-world training data
├── static/
│   ├── css/style.css
│   └── js/
│       ├── booking.js
│       ├── token.js
│       ├── dashboard.js
│       └── analytics.js
└── templates/
├── login.html
├── index.html
├── booking.html
├── token.html
├── doctor.html
└── analytics.html

---

<div align="center">

**GTU Societal Internship · BE05000011 · SVIT Vasad**

</div>
