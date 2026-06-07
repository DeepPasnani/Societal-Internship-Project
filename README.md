# ClinicFlow — Healthcare Appointment & Analytics System

> A production-grade clinic management system for small clinics and PHCs in Vadodara, Gujarat, India.
> Developed as part of the **GTU Societal Internship** (Subject Code: **BE05000011**).

---

## What's Included

| Feature | Status |
|---|---|
| 3-step patient appointment booking | ✅ |
| Live token queue (TV display mode, 8s refresh) | ✅ |
| Doctor schedule dashboard | ✅ |
| Analytics dashboard (6 charts + 4 KPIs) | ✅ |
| ML wait-time predictor (RandomForest) | ✅ |
| Gujarati language toggle | ✅ |
| **Google OAuth 2.0 sign-in** | ✅ New |
| **Firebase Phone OTP sign-in** | ✅ New |
| **Docker + docker-compose deployment** | ✅ New |
| **SQLite WAL mode (concurrent writes)** | ✅ New |
| **Atomic token allocation (no race condition)** | ✅ New |
| **Phone number uniqueness + validation** | ✅ New |
| **`debug=False` in production** | ✅ New |
| **`.gitignore`** | ✅ New |
| **ML trained on real-world calibrated data** | ✅ New |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Vanilla CSS, JavaScript ES6+ |
| Backend | Python 3.11 + Flask 3.0 |
| Auth | Authlib (Google OAuth 2.0) + Firebase Phone Auth |
| Database | SQLite3 with WAL mode |
| ML Model | scikit-learn RandomForestRegressor |
| Training Data | Kaggle No-Show Dataset (optional) or calibrated synthetic |
| Charts | Chart.js 4.x |
| Deployment | Docker + Gunicorn |

---

## Quick Start (Docker — Recommended)

### 1. Clone and configure

```bash
git clone <repo>
cd clinicflow
cp .env.example .env
# Edit .env with your credentials (see Setup section below)
```

### 2. Run

```bash
docker compose up --build
```

Open **http://localhost:5000**

The database is seeded automatically. The ML model trains during the Docker build.

---

## Local Development Setup

### 1. Install dependencies

```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in .env (at minimum, set SECRET_KEY)
```

### 3. Train the ML model

```bash
python model/train.py
# Optional: python model/train.py --rows 5000
```

To use the real Kaggle dataset (improves model quality):
1. Download `KaggleV2-May-2016.csv` from https://www.kaggle.com/joniarroba/noshowappointments
2. Place it at `data/KaggleV2-May-2016.csv`
3. Re-run `python model/train.py` — it will auto-detect and use it

### 4. Start the server

```bash
python app.py
```

Open **http://localhost:5000**

---

## Authentication Setup

### Google OAuth 2.0

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized redirect URIs:
   - `http://localhost:5000/auth/google/callback` (dev)
   - `https://your-domain.com/auth/google/callback` (prod)
5. Copy **Client ID** and **Client Secret** into `.env`:
   ```
   GOOGLE_CLIENT_ID=....apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=....
   ```

### Firebase Phone Auth (OTP)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. **Create project** (or use existing)
3. **Authentication → Sign-in method → Phone → Enable**
4. **Authentication → Settings → Authorized domains** — add your domain
5. **Project Settings → General → Your apps → Web API Key**
6. Copy into `.env`:
   ```
   FIREBASE_API_KEY=AIza...
   FIREBASE_PROJECT_ID=your-project-id
   ```

> **Note:** Phone auth works without Firebase credentials in dev mode (OTP flow is skipped). Production deployments MUST set both Firebase variables.

---

## API Reference

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | `/` | No | Landing page |
| GET | `/login` | No | Sign-in page |
| GET | `/auth/google` | No | Initiate Google OAuth |
| GET | `/auth/google/callback` | No | Google OAuth callback |
| POST | `/auth/phone/verify` | No | Verify Firebase phone OTP |
| GET | `/auth/logout` | No | Sign out |
| GET | `/api/me` | No | Current user info |
| GET | `/booking` | No | Patient booking page |
| GET | `/token` | No | Live queue display |
| GET | `/doctor` | No | Doctor dashboard |
| GET | `/analytics` | No | Analytics dashboard |
| POST | `/api/book` | **Yes** | Create appointment |
| GET | `/api/slots` | No | Available time slots |
| GET | `/api/queue` | No | Live queue data |
| POST | `/api/update-token` | **Yes** | Update appointment status |
| GET | `/api/doctor-schedule` | No | Doctor schedule |
| GET | `/api/today-stats` | No | Today's KPIs |
| GET | `/api/analytics` | No | Analytics data |
| GET | `/api/doctors` | No | List all doctors |

---

## ML Model

The RandomForest model uses 10 features:

| Feature | Source |
|---|---|
| `tokens_ahead` | Live queue count |
| `doctor_avg_consultation_minutes` | Per-doctor constant |
| `is_morning_rush` | Derived from hour (09–11) |
| `appointment_hour` | Booking time |
| `day_of_week` | Mon=0, Sun=6 |
| `no_show_rate_doctor` | Per-doctor historical rate |
| `day_gap` | Days between booking and appointment |
| `age` | Patient age |
| `sms_received` | SMS reminder flag |
| `doctor_id` | Doctor identifier |

**Training data calibration (from Kaggle no-show dataset analysis):**
- 20% overall no-show rate
- Younger patients (<35) have ~4% higher no-show probability
- Longer day-gap between booking and appointment → more no-shows
- Morning rush (09–11) adds ~8 min average wait

---

## Folder Structure

```
clinicflow/
├── app.py                  # Flask app — all routes + auth
├── database.py             # SQLite init, WAL mode, helpers
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── model/
│   ├── __init__.py
│   ├── train.py            # Kaggle-aware + calibrated synthetic trainer
│   ├── predict.py          # predict_wait() with ML + formula fallback
│   └── wait_model.pkl      # Generated after training (gitignored)
├── data/
│   ├── training_appointments.csv     # Generated (gitignored)
│   └── KaggleV2-May-2016.csv         # Optional (gitignored)
├── static/
│   ├── css/style.css
│   └── js/
│       ├── booking.js
│       ├── token.js
│       ├── dashboard.js
│       └── analytics.js
└── templates/
    ├── login.html          # Google + Phone sign-in
    ├── index.html
    ├── booking.html
    ├── token.html
    ├── doctor.html
    └── analytics.html
```

---

*Built with ❤️ for Vadodara's healthcare community · GTU Societal Internship BE05000011*
