# ── Stage 1: Builder ─────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: Runtime ─────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create data directory and ensure writable
RUN mkdir -p /app/data /app/model && \
    chmod -R 777 /app/data

# Train the ML model at build time (uses calibrated synthetic data)
RUN python model/train.py --rows 2000

# Expose port
EXPOSE 8196

# Environment defaults (override in docker-compose or at runtime)
ENV FLASK_DEBUG=false \
    SECRET_KEY=change-me-in-production \
    GOOGLE_CLIENT_ID="" \
    GOOGLE_CLIENT_SECRET="" \
    FIREBASE_API_KEY="" \
    FIREBASE_PROJECT_ID="" \
    PYTHONUNBUFFERED=1

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/today-stats')" || exit 1

# Entrypoint: init DB then launch gunicorn
CMD ["sh", "-c", "python -c 'from database import init_db; init_db()' && \
     gunicorn --bind 0.0.0.0:8196 \
              --workers 2 \
              --threads 4 \
              --timeout 120 \
              --access-logfile - \
              --error-logfile - \
              app:app"]
