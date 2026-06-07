"""
ClinicFlow — Wait Time Predictor
Loads the trained RandomForest model and exposes predict_wait().
"""

import os

try:
    import joblib
    import numpy as np
    HAS_ML = True
except ImportError:
    HAS_ML = False

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'wait_model.pkl')
_model_bundle = None

DOCTOR_AVG_MINS      = {1: 8, 2: 12, 3: 10, 4: 15}
DOCTOR_NO_SHOW_RATES = {1: 0.12, 2: 0.18, 3: 0.10, 4: 0.20}

FEATURE_COLS = [
    'doctor_id', 'appointment_hour', 'day_of_week', 'tokens_ahead',
    'doctor_avg_consultation_minutes', 'is_morning_rush', 'no_show_rate_doctor',
    'day_gap', 'age', 'sms_received',
]


def _load_model():
    global _model_bundle
    if not HAS_ML:
        raise FileNotFoundError("ML libraries not installed")
    if _model_bundle is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError("wait_model.pkl not found. Run: python model/train.py")
        _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def predict_wait(features_dict: dict) -> int:
    """
    Predict wait time in minutes.

    Keys accepted in features_dict:
      doctor_id (int)       : 1-4
      appointment_hour (int): 0-23
      day_of_week (int)     : 0=Mon, 6=Sun
      tokens_ahead (int)    : active patients before this one
      day_gap (int)         : days between scheduling and appointment (default 0)
      age (int)             : patient age in years (default 35)
      sms_received (int)    : 1 if SMS reminder sent (default 0)
    """
    doctor_id        = int(features_dict.get('doctor_id', 1))
    appointment_hour = int(features_dict.get('appointment_hour', 10))
    day_of_week      = int(features_dict.get('day_of_week', 0))
    tokens_ahead     = int(features_dict.get('tokens_ahead', 0))
    day_gap          = int(features_dict.get('day_gap', 0))
    age              = int(features_dict.get('age', 35))
    sms_received     = int(features_dict.get('sms_received', 0))

    avg_mins      = DOCTOR_AVG_MINS.get(doctor_id, 10)
    no_show_rate  = DOCTOR_NO_SHOW_RATES.get(doctor_id, 0.15)
    is_morning_rush = 1 if 9 <= appointment_hour <= 11 else 0

    if HAS_ML:
        try:
            import pandas as pd
            bundle = _load_model()
            model  = bundle['model']
            cols   = bundle.get('feature_cols', FEATURE_COLS)

            feature_vector = pd.DataFrame([[
                doctor_id, appointment_hour, day_of_week, tokens_ahead,
                avg_mins, is_morning_rush, no_show_rate,
                day_gap, age, sms_received,
            ]], columns=cols)
            prediction = model.predict(feature_vector)[0]
            return int(round(float(np.clip(prediction, 2, 90))))
        except Exception:
            pass  # fall through to formula

    # Fallback formula
    fallback = (
        tokens_ahead * avg_mins * (1 - no_show_rate * 0.4)
        + is_morning_rush * 8
        + min(day_gap * 0.25, 7)
    )
    return max(2, min(90, int(fallback)))
