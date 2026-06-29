import sqlite3
import os
import random
import logging
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'healthbook.db')
logger = logging.getLogger(__name__)


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=15, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")       # concurrent reads + writes
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA synchronous = NORMAL")   # safe + fast with WAL
    conn.execute("PRAGMA cache_size = -8000")     # 8MB page cache
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS patients (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            phone      TEXT    NOT NULL UNIQUE,
            age        INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS doctors (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            name           TEXT NOT NULL,
            specialization TEXT NOT NULL,
            available_days TEXT,
            start_time     TEXT,
            end_time       TEXT,
            user_id        INTEGER UNIQUE
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id              INTEGER,
            doctor_id               INTEGER,
            appointment_date        TEXT,
            appointment_time        TEXT,
            token_number            INTEGER,
            status                  TEXT    DEFAULT 'Waiting',
            actual_wait_minutes     INTEGER,
            predicted_wait_minutes  INTEGER,
            created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(patient_id) REFERENCES patients(id),
            FOREIGN KEY(doctor_id)  REFERENCES doctors(id),
            UNIQUE(doctor_id, appointment_date, token_number)
        );

        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            email        TEXT    NOT NULL UNIQUE,
            name         TEXT,
            phone        TEXT,
            auth_provider TEXT   NOT NULL DEFAULT 'google',  -- 'google' | 'phone'
            google_sub   TEXT    UNIQUE,
            phone_verified INTEGER DEFAULT 0,
            role         TEXT    DEFAULT 'patient',          -- 'patient' | 'doctor' | 'admin'
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login   TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_appt_doctor_date
            ON appointments(doctor_id, appointment_date);
        CREATE INDEX IF NOT EXISTS idx_appt_date
            ON appointments(appointment_date);
        CREATE INDEX IF NOT EXISTS idx_appt_status
            ON appointments(status);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
    """)
    conn.commit()

    try:
        conn.execute("ALTER TABLE doctors ADD COLUMN user_id INTEGER UNIQUE")
        conn.commit()
    except Exception:
        try:
            conn.execute("ALTER TABLE doctors ADD COLUMN user_id INTEGER")
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id)")
            conn.commit()
        except Exception:
            pass

    # Seed doctors
    if c.execute("SELECT COUNT(*) FROM doctors").fetchone()[0] == 0:
        doctors = [
            ("Dr. Ramesh Patel",  "General Physician", "Mon,Tue,Wed,Thu,Fri", "09:00", "17:00"),
            ("Dr. Priya Mehta",   "Pediatrician",      "Mon,Wed,Fri",         "10:00", "16:00"),
            ("Dr. Suresh Shah",   "ENT Specialist",    "Tue,Thu,Sat",         "09:00", "14:00"),
            ("Dr. Kavita Desai",  "Gynecologist",      "Mon,Tue,Thu,Fri",     "11:00", "18:00"),
        ]
        c.executemany(
            "INSERT INTO doctors (name,specialization,available_days,start_time,end_time) VALUES (?,?,?,?,?)",
            doctors
        )
        conn.commit()

    admin_email = os.environ.get('ADMIN_EMAIL', '')
    if admin_email:
        conn.execute(
            "UPDATE users SET role='admin' WHERE email=?", (admin_email,)
        )
        conn.commit()
        logger.info(f"Admin role granted to {admin_email}")

    # Seed appointments
    if c.execute("SELECT COUNT(*) FROM appointments").fetchone()[0] == 0:
        _seed_appointments(c)
        conn.commit()

    conn.close()


def _seed_appointments(c):
    patient_names = [
        ("Arjun Shah",       "9876543210", 34), ("Meera Patel",   "9876543211", 28),
        ("Rohit Joshi",      "9876543212", 45), ("Sunita Verma",  "9876543213", 52),
        ("Karan Mehta",      "9876543214", 23), ("Priya Singh",   "9876543215", 31),
        ("Deepak Rao",       "9876543216", 67), ("Anita Kumar",   "9876543217", 19),
        ("Vikram Nair",      "9876543218", 40), ("Pooja Sharma",  "9876543219", 26),
        ("Amit Trivedi",     "9876543220", 58), ("Rekha Gupta",   "9876543221", 33),
        ("Nikhil Patil",     "9876543222", 29), ("Sonal Chauhan", "9876543223", 47),
        ("Bhavesh Modi",     "9876543224", 61), ("Jyoti Pandey",  "9876543225", 22),
        ("Manish Agarwal",   "9876543226", 38), ("Kavya Reddy",   "9876543227", 25),
        ("Harsh Vyas",       "9876543228", 44), ("Dipali Solanki","9876543229", 36),
    ]
    doctor_avg_mins  = {1: 8, 2: 12, 3: 10, 4: 15}

    patient_ids = []
    for name, phone, age in patient_names:
        c.execute(
            "INSERT OR IGNORE INTO patients (name,phone,age) VALUES (?,?,?)",
            (name, phone, age)
        )
        row = c.execute("SELECT id FROM patients WHERE phone=?", (phone,)).fetchone()
        if row:
            patient_ids.append(row[0])

    today = datetime.now().date()
    token_counters: dict[tuple, int] = {}

    for _ in range(50):
        pid       = random.choice(patient_ids)
        did       = random.randint(1, 4)
        days_back = random.randint(1, 28)
        date_str  = (today - timedelta(days=days_back)).isoformat()
        hour      = random.randint(9, 16)
        minute    = random.choice([0, 15, 30, 45])
        appt_time = f"{hour:02d}:{minute:02d}"
        status    = random.choices(
            ['Done', 'No Show', 'Waiting'],
            weights=[6, 2, 1]
        )[0]

        key = (did, date_str)
        token_counters[key] = token_counters.get(key, 0) + 1
        token = token_counters[key]

        avg  = doctor_avg_mins[did]
        nsr  = 0.15
        rush = 1 if 9 <= hour <= 11 else 0
        actual_wait = int(
            (token - 1) * avg * (1 - nsr * 0.4)
            + random.uniform(-5, 10)
            + rush * 8
        )
        actual_wait     = max(2, min(90, actual_wait))
        predicted_wait  = max(2, min(90, actual_wait + random.randint(-3, 5)))

        try:
            c.execute("""
                INSERT OR IGNORE INTO appointments
                (patient_id,doctor_id,appointment_date,appointment_time,
                 token_number,status,actual_wait_minutes,predicted_wait_minutes)
                VALUES (?,?,?,?,?,?,?,?)
            """, (pid, did, date_str, appt_time, token, status, actual_wait, predicted_wait))
        except Exception:
            pass

    # Today's seeded appointments
    today_str = today.isoformat()
    today_statuses = ['Done', 'Done', 'In Progress', 'Waiting', 'Waiting', 'Waiting']
    today_counters: dict[int, int] = {}
    for idx, status in enumerate(today_statuses):
        pid  = random.choice(patient_ids)
        did  = (idx % 4) + 1
        hour = 9 + idx
        appt_time = f"{hour:02d}:00"
        today_counters[did] = today_counters.get(did, 0) + 1
        token = today_counters[did]
        avg   = doctor_avg_mins[did]
        actual_wait   = avg * (token - 1) + random.randint(0, 5)
        predicted_wait = avg * (token - 1)
        try:
            c.execute("""
                INSERT OR IGNORE INTO appointments
                (patient_id,doctor_id,appointment_date,appointment_time,
                 token_number,status,actual_wait_minutes,predicted_wait_minutes)
                VALUES (?,?,?,?,?,?,?,?)
            """, (pid, did, today_str, appt_time, token, status, actual_wait, predicted_wait))
        except Exception:
            pass


def get_next_token_atomic(conn, doctor_id: int, date: str) -> int:
    conn.execute("BEGIN IMMEDIATE")
    result = conn.execute(
        "SELECT COALESCE(MAX(token_number), 0) FROM appointments "
        "WHERE doctor_id=? AND appointment_date=?",
        (doctor_id, date)
    ).fetchone()[0]
    return result + 1


def get_tokens_ahead(doctor_id: int, date: str, token_number: int) -> int:
    conn = get_db()
    try:
        return conn.execute(
            "SELECT COUNT(*) FROM appointments "
            "WHERE doctor_id=? AND appointment_date=? AND token_number<? "
            "AND status IN ('Waiting','In Progress')",
            (doctor_id, date, token_number)
        ).fetchone()[0]
    finally:
        conn.close()


def get_doctor_no_show_rate(doctor_id: int) -> float:
    conn = get_db()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM appointments WHERE doctor_id=? AND status IN ('Done','No Show')",
            (doctor_id,)
        ).fetchone()[0]
        no_shows = conn.execute(
            "SELECT COUNT(*) FROM appointments WHERE doctor_id=? AND status='No Show'",
            (doctor_id,)
        ).fetchone()[0]
        return round(no_shows / total, 3) if total > 0 else 0.15
    finally:
        conn.close()
