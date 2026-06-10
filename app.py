import os
import sys
import json
import logging
import requests
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for, abort
)
from authlib.integrations.flask_client import OAuth

sys.path.insert(0, os.path.dirname(__file__))
from database import (
    init_db, get_db, get_next_token, get_tokens_ahead,
    get_doctor_no_show_rate
)
from model.predict import predict_wait

# ─────────────────────────────────────────────────────────
# APP CONFIG
# ─────────────────────────────────────────────────────────

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'clinicflow-dev-secret-change-in-prod')
app.config['JSON_SORT_KEYS'] = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# GOOGLE OAUTH (Authlib)
# ─────────────────────────────────────────────────────────

oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID', ''),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET', ''),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# ─────────────────────────────────────────────────────────
# FIREBASE CONFIG (for phone auth OTP verification)
# ─────────────────────────────────────────────────────────

FIREBASE_API_KEY    = os.environ.get('FIREBASE_API_KEY', '')
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', '')

# ─────────────────────────────────────────────────────────
# AUTH HELPERS
# ─────────────────────────────────────────────────────────

def get_or_create_user(email: str, name: str, google_sub: str) -> dict:
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE google_sub=? OR email=?", (google_sub, email)
        ).fetchone()
        if user:
            conn.execute(
                "UPDATE users SET last_login=CURRENT_TIMESTAMP, name=? WHERE id=?",
                (name, user['id'])
            )
            conn.commit()
            return dict(user)
        conn.execute(
            "INSERT INTO users (email,name,auth_provider,google_sub) VALUES (?,?,?,?)",
            (email, name, 'google', google_sub)
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE google_sub=?", (google_sub,)).fetchone()
        return dict(user)
    finally:
        conn.close()


def get_or_create_phone_user(phone: str, name: str = '') -> dict:
    email_placeholder = f"{phone}@phone.clinicflow"
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE email=?", (email_placeholder,)
        ).fetchone()
        if user:
            conn.execute(
                "UPDATE users SET last_login=CURRENT_TIMESTAMP, phone_verified=1 WHERE id=?",
                (user['id'],)
            )
            conn.commit()
            return dict(user)
        conn.execute(
            "INSERT INTO users (email,name,auth_provider,phone,phone_verified) VALUES (?,?,?,?,?)",
            (email_placeholder, name or f"User {phone[-4:]}", 'phone', phone, 1)
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE email=?", (email_placeholder,)).fetchone()
        return dict(user)
    finally:
        conn.close()


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated


def login_required_api(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentication required', 'redirect': '/login'}), 401
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────

@app.route('/login')
def login_page():
    if 'user' in session:
        return redirect(url_for('index'))
    return render_template('login.html',
        google_client_id=os.environ.get('GOOGLE_CLIENT_ID', ''),
        firebase_api_key=FIREBASE_API_KEY,
        firebase_project_id=FIREBASE_PROJECT_ID,
    )


@app.route('/auth/google')
def auth_google():
    redirect_uri = url_for('auth_google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route('/auth/google/callback')
def auth_google_callback():
    try:
        token = google.authorize_access_token()
        userinfo = token.get('userinfo') or google.userinfo()
        user = get_or_create_user(
            email=userinfo['email'],
            name=userinfo.get('name', userinfo['email']),
            google_sub=userinfo['sub'],
        )
        session['user'] = {
            'id': user['id'], 'name': user['name'],
            'email': user['email'], 'role': user['role'],
            'auth_provider': 'google',
        }
        return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        return redirect(url_for('login_page') + '?error=google_auth_failed')


@app.route('/auth/phone/verify', methods=['POST'])
def auth_phone_verify():
    """
    Verify Firebase phone auth ID token sent from the frontend after OTP success.
    Firebase handles the OTP flow entirely client-side; we just verify the resulting ID token.
    """
    data     = request.get_json() or {}
    id_token = data.get('idToken', '')
    phone    = data.get('phone', '')
    name     = data.get('name', '')

    if not id_token or not phone:
        return jsonify({'error': 'idToken and phone are required'}), 400

    if FIREBASE_API_KEY:
        # Verify the ID token with Firebase REST API
        verify_url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}"
        try:
            resp = requests.post(verify_url, json={'idToken': id_token}, timeout=10)
            firebase_data = resp.json()
            if 'error' in firebase_data:
                logger.warning(f"Firebase token invalid: {firebase_data['error']}")
                return jsonify({'error': 'Invalid OTP token'}), 401
            users_list = firebase_data.get('users', [])
            if not users_list:
                return jsonify({'error': 'Token verification failed'}), 401
            firebase_phone = users_list[0].get('phoneNumber', phone)
            phone = firebase_phone  # use Firebase-verified phone
        except requests.RequestException as e:
            logger.error(f"Firebase verify request failed: {e}")
            # In dev mode (no API key) we trust the client phone — prod MUST have key
            if FIREBASE_API_KEY:
                return jsonify({'error': 'Could not reach Firebase'}), 503
    else:
        logger.warning("FIREBASE_API_KEY not set — skipping server-side token verification (dev only)")

    user = get_or_create_phone_user(phone, name)
    session['user'] = {
        'id': user['id'], 'name': user['name'],
        'email': user['email'], 'role': user['role'],
        'auth_provider': 'phone', 'phone': phone,
    }
    return jsonify({'success': True, 'user': session['user']})


@app.route('/auth/logout')
def auth_logout():
    session.clear()
    return redirect(url_for('index'))


@app.route('/api/me')
def api_me():
    if 'user' in session:
        return jsonify({'user': session['user'], 'authenticated': True})
    return jsonify({'authenticated': False})


# ─────────────────────────────────────────────────────────
# PAGE ROUTES (public)
# ─────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html', user=session.get('user'))


@app.route('/booking')
def booking():
    return render_template('booking.html', user=session.get('user'))


@app.route('/packages')
def packages():
    return render_template('packages.html', user=session.get('user'))


@app.route('/doctors')
def doctors_page():
    specialty = request.args.get('specialty', '')
    return render_template('doctors.html', user=session.get('user'), specialty=specialty)


@app.route('/token')
def token():
    return render_template('token.html', user=session.get('user'))


@app.route('/doctor')
def doctor():
    return render_template('doctor.html', user=session.get('user'))


@app.route('/analytics')
def analytics():
    return render_template('analytics.html', user=session.get('user'))


# ─────────────────────────────────────────────────────────
# API — DOCTORS
# ─────────────────────────────────────────────────────────

@app.route('/api/doctors')
def api_doctors():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM doctors").fetchall()
        return jsonify([dict(r) for r in rows])
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# API — BOOK APPOINTMENT (auth required)
# ─────────────────────────────────────────────────────────

@app.route('/api/book', methods=['POST'])
@login_required_api
def api_book():
    data             = request.get_json() or {}
    name             = data.get('name', '').strip()
    phone            = data.get('phone', '').strip()
    age              = data.get('age')
    doctor_id        = int(data.get('doctor_id', 1))
    appointment_date = data.get('appointment_date', '')
    appointment_time = data.get('appointment_time', '')

    if not all([name, phone, appointment_date, appointment_time]):
        return jsonify({'error': 'Missing required fields'}), 400

    if not phone.isdigit() or len(phone) != 10:
        return jsonify({'error': 'Phone must be a 10-digit number'}), 400

    conn = get_db()
    try:
        # Upsert patient (phone is unique)
        existing = conn.execute(
            "SELECT id FROM patients WHERE phone=?", (phone,)
        ).fetchone()
        if existing:
            patient_id = existing['id']
            if name:
                conn.execute("UPDATE patients SET name=? WHERE id=?", (name, patient_id))
        else:
            cursor = conn.execute(
                "INSERT INTO patients (name,phone,age) VALUES (?,?,?)",
                (name, phone, age)
            )
            patient_id = cursor.lastrowid

        token_number = get_next_token(doctor_id, appointment_date)
        tokens_ahead = get_tokens_ahead(doctor_id, appointment_date, token_number)

        appt_dt = datetime.strptime(f"{appointment_date} {appointment_time}", "%Y-%m-%d %H:%M")
        from datetime import date as _date
        today       = _date.today()
        appt_date   = appt_dt.date()
        day_gap     = max(0, (appt_date - today).days)

        features = {
            'doctor_id':        doctor_id,
            'appointment_hour': appt_dt.hour,
            'day_of_week':      appt_dt.weekday(),
            'tokens_ahead':     tokens_ahead,
            'day_gap':          day_gap,
            'age':              int(age) if age else 35,
            'sms_received':     0,
        }
        predicted_wait = predict_wait(features)

        cursor = conn.execute("""
            INSERT INTO appointments
            (patient_id,doctor_id,appointment_date,appointment_time,
             token_number,status,predicted_wait_minutes)
            VALUES (?,?,?,?,?,?,?)
        """, (patient_id, doctor_id, appointment_date, appointment_time,
              token_number, 'Waiting', predicted_wait))
        appointment_id = cursor.lastrowid

        doc = conn.execute("SELECT name FROM doctors WHERE id=?", (doctor_id,)).fetchone()
        conn.commit()

        return jsonify({
            'appointment_id':        appointment_id,
            'token_number':          token_number,
            'predicted_wait_minutes': predicted_wait,
            'doctor_name':           doc['name'] if doc else '',
            'appointment_date':      appointment_date,
            'appointment_time':      appointment_time,
        })
    except Exception as e:
        conn.rollback()
        logger.error(f"Booking error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# API — AVAILABLE SLOTS
# ─────────────────────────────────────────────────────────

@app.route('/api/slots')
def api_slots():
    doctor_id = request.args.get('doctor_id', type=int)
    date_str  = request.args.get('date', '')

    if not doctor_id or not date_str:
        return jsonify({'error': 'Missing params'}), 400

    conn = get_db()
    try:
        doc = conn.execute("SELECT * FROM doctors WHERE id=?", (doctor_id,)).fetchone()
        if not doc:
            return jsonify({'error': 'Doctor not found'}), 404

        booked = set(
            r['appointment_time'] for r in conn.execute(
                "SELECT appointment_time FROM appointments "
                "WHERE doctor_id=? AND appointment_date=? AND status!='No Show'",
                (doctor_id, date_str)
            ).fetchall()
        )

        # ── FIX 1: Check doctor works on this day of week ──
        from datetime import date as _date_cls
        appt_date = _date_cls.fromisoformat(date_str)
        day_names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        day_name  = day_names[appt_date.weekday()]
        avail_days = [d.strip() for d in (doc['available_days'] or '').split(',')]
        if day_name not in avail_days:
            return jsonify({
                'slots': [],
                'available_days': doc['available_days'],
                'unavailable': f"Doctor is not available on {day_name}. Works on: {', '.join(avail_days)}",
            })

        start_h, start_m = map(int, doc['start_time'].split(':'))
        end_h,   end_m   = map(int, doc['end_time'].split(':'))
        slots, current   = [], datetime(2000, 1, 1, start_h, start_m)
        end              = datetime(2000, 1, 1, end_h, end_m)
        while current < end:
            s = current.strftime('%H:%M')
            slots.append({'time': s, 'booked': s in booked})
            current += timedelta(minutes=30)

        return jsonify({'slots': slots, 'available_days': doc['available_days']})
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# API — LIVE QUEUE
# ─────────────────────────────────────────────────────────

@app.route('/api/queue')
def api_queue():
    doctor_id = request.args.get('doctor_id', type=int)
    today     = datetime.now().strftime('%Y-%m-%d')

    conn = get_db()
    try:
        if doctor_id:
            rows = conn.execute("""
                SELECT a.id, a.token_number, a.appointment_time, a.status,
                       a.predicted_wait_minutes, a.doctor_id,
                       p.name as patient_name,
                       d.name as doctor_name, d.specialization
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN doctors  d ON a.doctor_id  = d.id
                WHERE a.appointment_date=? AND a.doctor_id=?
                ORDER BY a.token_number
            """, (today, doctor_id)).fetchall()
        else:
            rows = conn.execute("""
                SELECT a.id, a.token_number, a.appointment_time, a.status,
                       a.predicted_wait_minutes, a.doctor_id,
                       p.name as patient_name,
                       d.name as doctor_name, d.specialization
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN doctors  d ON a.doctor_id  = d.id
                WHERE a.appointment_date=?
                ORDER BY a.doctor_id, a.token_number
            """, (today,)).fetchall()

        queue = []
        for r in rows:
            d = dict(r)
            d['patient_name'] = d['patient_name'].split()[0]  # first name only
            queue.append(d)

        return jsonify({'queue': queue, 'date': today})
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# API — UPDATE TOKEN STATUS (auth required)
# ─────────────────────────────────────────────────────────

@app.route('/api/update-token', methods=['POST'])
@login_required_api
def api_update_token():
    data           = request.get_json() or {}
    appointment_id = data.get('appointment_id')
    status         = data.get('status')

    valid_statuses = ['Waiting', 'In Progress', 'Done', 'No Show']
    if not appointment_id or status not in valid_statuses:
        return jsonify({'error': 'Invalid data'}), 400

    conn = get_db()
    try:
        if status == 'Done':
            appt = conn.execute(
                "SELECT * FROM appointments WHERE id=?", (appointment_id,)
            ).fetchone()
            if appt:
                created     = datetime.fromisoformat(appt['created_at'])
                actual_wait = int((datetime.now() - created).total_seconds() / 60)
                conn.execute(
                    "UPDATE appointments SET status=?, actual_wait_minutes=? WHERE id=?",
                    (status, actual_wait, appointment_id)
                )
            else:
                conn.execute("UPDATE appointments SET status=? WHERE id=?", (status, appointment_id))
        else:
            conn.execute("UPDATE appointments SET status=? WHERE id=?", (status, appointment_id))
        conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# API — DOCTOR SCHEDULE
# ─────────────────────────────────────────────────────────

@app.route('/api/doctor-schedule')
def api_doctor_schedule():
    doctor_id = request.args.get('doctor_id', type=int)
    date_str  = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))

    if not doctor_id:
        return jsonify({'error': 'Missing doctor_id'}), 400

    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT a.id, a.token_number, a.appointment_time, a.status,
                   a.predicted_wait_minutes, a.actual_wait_minutes,
                   p.name as patient_name, p.age, p.phone
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id=? AND a.appointment_date=?
            ORDER BY a.token_number
        """, (doctor_id, date_str)).fetchall()

        appointments = [dict(r) for r in rows]
        total       = len(appointments)
        done        = sum(1 for a in appointments if a['status'] == 'Done')
        no_show     = sum(1 for a in appointments if a['status'] == 'No Show')
        in_progress = sum(1 for a in appointments if a['status'] == 'In Progress')
        waiting     = sum(1 for a in appointments if a['status'] == 'Waiting')
        no_show_rate = get_doctor_no_show_rate(doctor_id)

        week_data = []
        for i in range(4, -1, -1):
            d     = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            count = conn.execute(
                "SELECT COUNT(*) FROM appointments WHERE doctor_id=? AND appointment_date=?",
                (doctor_id, d)
            ).fetchone()[0]
            week_data.append({'date': d, 'count': count})

        return jsonify({
            'appointments': appointments,
            'summary': {
                'total': total, 'done': done, 'waiting': waiting,
                'in_progress': in_progress, 'no_show': no_show,
                'no_show_rate': round(no_show_rate * 100, 1),
            },
            'week_data': week_data,
        })
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# API — TODAY STATS
# ─────────────────────────────────────────────────────────

@app.route('/api/today-stats')
def api_today_stats():
    today = datetime.now().strftime('%Y-%m-%d')
    conn  = get_db()
    try:
        total_today = conn.execute(
            "SELECT COUNT(*) FROM appointments WHERE appointment_date=?", (today,)
        ).fetchone()[0]

        currently_waiting = conn.execute(
            "SELECT COUNT(*) FROM appointments "
            "WHERE appointment_date=? AND status IN ('Waiting','In Progress')",
            (today,)
        ).fetchone()[0]

        avg_wait_row = conn.execute(
            "SELECT AVG(actual_wait_minutes) FROM appointments "
            "WHERE appointment_date=? AND actual_wait_minutes IS NOT NULL",
            (today,)
        ).fetchone()[0]

        return jsonify({
            'total_today':       total_today,
            'currently_waiting': currently_waiting,
            'avg_wait_today':    round(avg_wait_row or 0, 1),
        })
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# API — ANALYTICS
# ─────────────────────────────────────────────────────────

@app.route('/api/analytics')
def api_analytics():
    range_param = request.args.get('range', 'week')
    today       = datetime.now().date()

    if range_param == 'week':
        start_date, end_date = today - timedelta(days=7), today
    elif range_param == 'month':
        start_date, end_date = today - timedelta(days=30), today
    elif range_param == 'last_month':
        end_date   = today - timedelta(days=30)
        start_date = end_date - timedelta(days=30)
    else:
        start_date, end_date = today - timedelta(days=7), today

    start_str = start_date.isoformat()
    end_str   = end_date.isoformat()

    conn = get_db()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM appointments WHERE appointment_date BETWEEN ? AND ?",
            (start_str, end_str)
        ).fetchone()[0]

        avg_wait_row = conn.execute(
            "SELECT AVG(actual_wait_minutes) FROM appointments "
            "WHERE appointment_date BETWEEN ? AND ? AND actual_wait_minutes IS NOT NULL",
            (start_str, end_str)
        ).fetchone()[0]
        avg_wait = round(avg_wait_row or 0, 1)

        total_done_or_no = conn.execute(
            "SELECT COUNT(*) FROM appointments "
            "WHERE appointment_date BETWEEN ? AND ? AND status IN ('Done','No Show')",
            (start_str, end_str)
        ).fetchone()[0]
        no_shows_count = conn.execute(
            "SELECT COUNT(*) FROM appointments "
            "WHERE appointment_date BETWEEN ? AND ? AND status='No Show'",
            (start_str, end_str)
        ).fetchone()[0]
        no_show_rate = round((no_shows_count / total_done_or_no * 100) if total_done_or_no > 0 else 0, 1)

        today_str   = today.isoformat()
        busiest_row = conn.execute("""
            SELECT SUBSTR(appointment_time,1,2) as hour, COUNT(*) as cnt
            FROM appointments WHERE appointment_date=?
            GROUP BY hour ORDER BY cnt DESC LIMIT 1
        """, (today_str,)).fetchone()
        busiest_hour = f"{busiest_row['hour']}:00" if busiest_row else "N/A"

        by_day_rows = conn.execute("""
            SELECT appointment_date, COUNT(*) as cnt
            FROM appointments WHERE appointment_date BETWEEN ? AND ?
            GROUP BY appointment_date ORDER BY appointment_date
        """, (start_str, end_str)).fetchall()
        day_counts = [0] * 7
        for row in by_day_rows:
            dt = datetime.strptime(row['appointment_date'], '%Y-%m-%d')
            day_counts[dt.weekday()] += row['cnt']
        by_day = {'labels': ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], 'data': day_counts}

        trend_rows = conn.execute("""
            SELECT appointment_date, AVG(actual_wait_minutes) as avg_wait
            FROM appointments
            WHERE appointment_date BETWEEN ? AND ? AND actual_wait_minutes IS NOT NULL
            GROUP BY appointment_date ORDER BY appointment_date
        """, (start_str, end_str)).fetchall()
        wait_trend = {
            'labels': [r['appointment_date'] for r in trend_rows],
            'data':   [round(r['avg_wait'], 1) for r in trend_rows],
        }

        status_rows = conn.execute("""
            SELECT status, COUNT(*) as cnt
            FROM appointments WHERE appointment_date BETWEEN ? AND ?
            GROUP BY status
        """, (start_str, end_str)).fetchall()
        sd = {r['status']: r['cnt'] for r in status_rows}
        status_breakdown = {
            'labels': ['Done', 'No Show', 'Waiting', 'In Progress'],
            'data':   [sd.get('Done',0), sd.get('No Show',0), sd.get('Waiting',0), sd.get('In Progress',0)],
        }

        doc_rows = conn.execute("""
            SELECT d.name, COUNT(*) as cnt
            FROM appointments a JOIN doctors d ON a.doctor_id=d.id
            WHERE a.appointment_date BETWEEN ? AND ?
            GROUP BY a.doctor_id ORDER BY cnt DESC
        """, (start_str, end_str)).fetchall()
        doctor_load = {'labels': [r['name'] for r in doc_rows], 'data': [r['cnt'] for r in doc_rows]}

        hourly_rows = conn.execute("""
            SELECT SUBSTR(appointment_time,1,2) as hour, COUNT(*) as cnt
            FROM appointments WHERE appointment_date BETWEEN ? AND ?
            GROUP BY hour ORDER BY hour
        """, (start_str, end_str)).fetchall()
        all_hours   = [f"{h:02d}" for h in range(8, 20)]
        hour_dict   = {r['hour']: r['cnt'] for r in hourly_rows}
        hourly_volume = {
            'labels': [f"{h}:00" for h in all_hours],
            'data':   [hour_dict.get(h, 0) for h in all_hours],
        }

        pva_rows = conn.execute("""
            SELECT predicted_wait_minutes, actual_wait_minutes
            FROM appointments
            WHERE appointment_date BETWEEN ? AND ?
              AND predicted_wait_minutes IS NOT NULL
              AND actual_wait_minutes IS NOT NULL
            LIMIT 100
        """, (start_str, end_str)).fetchall()
        predicted_vs_actual = {
            'data': [{'x': r['predicted_wait_minutes'], 'y': r['actual_wait_minutes']} for r in pva_rows]
        }

        return jsonify({
            'kpis': {
                'total': total, 'avg_wait': avg_wait,
                'no_show_rate': no_show_rate, 'busiest_hour': busiest_hour,
            },
            'by_day':              by_day,
            'wait_trend':          wait_trend,
            'status_breakdown':    status_breakdown,
            'doctor_load':         doctor_load,
            'hourly_volume':       hourly_volume,
            'predicted_vs_actual': predicted_vs_actual,
        })
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────
# INIT & RUN
# ─────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    print("==" * 25)
    print("  HealthBook Server Starting...")
    print("  http://127.0.0.1:5000")
    print("==" * 25)
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
