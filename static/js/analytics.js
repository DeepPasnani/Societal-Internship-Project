/* ============================================================
   analytics.js — Clinic Analytics Dashboard
   Manages 6 Chart.js charts + 4 KPI cards.
   All data fetched from /api/analytics?range=week|month|last_month
   ============================================================ */

// ── CHART.JS GLOBAL DEFAULTS ──────────────────────────────────
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color       = '#64748b';
Chart.defaults.borderColor = '#e2e8f0';

// ── PALETTE ───────────────────────────────────────────────────
const COLORS = {
  primary:     '#0d9488',
  primaryAlpha:'rgba(13,148,136,0.12)',
  accent:      '#10b981',
  accentAlpha: 'rgba(16,185,129,0.12)',
  warning:     '#fdcb6e',
  danger:      '#e17055',
  purple:      '#6c5ce7',
  muted:       '#64748b',
};

const STATUS_COLORS = ['#10b981', '#ef4444', '#0d9488', '#f59e0b'];
const DOC_COLORS    = ['#0d9488', '#10b981', '#6c5ce7', '#f59e0b'];

// ── CHART INSTANCES ───────────────────────────────────────────
let charts = {};

// ── STATE ─────────────────────────────────────────────────────
let currentRange = 'week';

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('hamburger')?.addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('open');
  });

  initEmptyCharts();
  loadAnalytics('week');
});

// ── RANGE FILTER ──────────────────────────────────────────────
function setRange(range, btnEl) {
  currentRange = range;
  document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  loadAnalytics(range);
}

// ── FETCH DATA ────────────────────────────────────────────────
function loadAnalytics(range) {
  setKPILoading();

  fetch(`/api/analytics?range=${range}`)
    .then(r => r.json())
    .then(data => {
      updateKPIs(data.kpis || {});
      updateByDayChart(data.by_day || {});
      updateWaitTrendChart(data.wait_trend || {});
      updateStatusChart(data.status_breakdown || {});
      updateDoctorLoadChart(data.doctor_load || {});
      updateHourlyChart(data.hourly_volume || {});
      updatePVAChart(data.predicted_vs_actual || {});
    })
    .catch(err => {
      console.error('Analytics fetch failed:', err);
      showToast('Failed to load analytics data.', 'error');
    });
}

// ── KPI CARDS ─────────────────────────────────────────────────
function setKPILoading() {
  ['kpi-total', 'kpi-wait', 'kpi-noshow', 'kpi-busy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const span = el.querySelector('span') || el;
      span.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:1.2rem;"></i>';
    }
  });
}

function updateKPIs(kpis) {
  animateCount('kpi-total',  kpis.total   || 0);
  animateCount('kpi-wait',   kpis.avg_wait || 0, true);
  animateCount('kpi-noshow', kpis.no_show_rate || 0, true);
  document.getElementById('kpi-busy').textContent = kpis.busiest_hour || 'N/A';
}

function animateCount(elId, target, isDecimal = false) {
  const el = document.getElementById(elId);
  if (!el) return;

  // Find inner span or use element itself
  const displayEl = el.querySelector('span') || el;
  const duration  = 900;
  const start     = performance.now();

  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = eased * target;
    displayEl.textContent = isDecimal ? val.toFixed(1) : Math.round(val);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── CHART BUILDERS ────────────────────────────────────────────
function initEmptyCharts() {
  // Initialize all canvas with empty data to avoid layout shift
  createBarChart('chart-by-day', [], []);
  createLineChart('chart-wait-trend', [], []);
  createDoughnutChart('chart-status', [], []);
  createBarChart('chart-doctor-load', [], [], DOC_COLORS);
  createAreaChart('chart-hourly', [], []);
  createScatterChart('chart-pva', []);
}

// Bar Chart — Appointments by Day of Week
function updateByDayChart(data) {
  destroyChart('chart-by-day');
  createBarChart(
    'chart-by-day',
    data.labels || [],
    data.data   || [],
    null,
    'Appointments'
  );
}

function createBarChart(canvasId, labels, data, colors = null, label = 'Count') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const bgColors = colors || labels.map((_, i) => {
    const palette = [COLORS.primary, COLORS.accent, COLORS.warning, COLORS.danger, COLORS.purple, '#0984e3', '#fd79a8'];
    return palette[i % palette.length];
  });

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: Array.isArray(bgColors) && bgColors.length === data.length
          ? bgColors
          : labels.map(() => COLORS.primary + 'cc'),
        borderRadius: 6,
        borderSkipped: false,
        hoverBackgroundColor: labels.map(() => COLORS.primaryAlpha),
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} appointments` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 12 } } },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

// Line Chart — Wait Time Trend
function updateWaitTrendChart(data) {
  destroyChart('chart-wait-trend');
  createLineChart(
    'chart-wait-trend',
    (data.labels || []).map(d => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }),
    data.data || []
  );
}

function createLineChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Avg Wait (min)',
        data,
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accentAlpha,
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: COLORS.accent,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} minutes` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

// Doughnut Chart — Status Breakdown
function updateStatusChart(data) {
  destroyChart('chart-status');
  createDoughnutChart('chart-status', data.labels || [], data.data || []);

  // Custom legend
  const legendEl = document.getElementById('status-legend');
  if (legendEl && data.labels) {
    const total = (data.data || []).reduce((a, b) => a + b, 0);
    legendEl.innerHTML = data.labels.map((lbl, i) => {
      const pct = total > 0 ? Math.round((data.data[i] / total) * 100) : 0;
      return `
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:12px; height:12px; border-radius:3px; background:${STATUS_COLORS[i % 4]}; flex-shrink:0;"></div>
          <div>
            <div style="font-size:0.8rem; font-weight:600;">${lbl}</div>
            <div style="font-size:0.75rem; color:var(--muted);">${data.data[i]} (${pct}%)</div>
          </div>
        </div>`;
    }).join('');
  }
}

function createDoughnutChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: STATUS_COLORS,
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} appointments`
          }
        }
      }
    }
  });
}

// Bar Chart — Doctor Load
function updateDoctorLoadChart(data) {
  destroyChart('chart-doctor-load');
  const labels = (data.labels || []).map(n => n.replace('Dr. ', ''));
  createBarChart('chart-doctor-load', labels, data.data || [], DOC_COLORS.slice(0, labels.length), 'Appointments');
}

// Area Chart — Hourly Volume
function updateHourlyChart(data) {
  destroyChart('chart-hourly');
  createAreaChart('chart-hourly', data.labels || [], data.data || []);
}

function createAreaChart(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Appointments',
        data,
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(13,148,136,0.15)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: COLORS.primary,
        tension: 0.5,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} appointments at ${ctx.label}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

// Scatter Chart — Predicted vs Actual
function updatePVAChart(data) {
  destroyChart('chart-pva');
  createScatterChart('chart-pva', data.data || []);
}

function createScatterChart(canvasId, points) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // Compute max for diagonal reference line
  const allVals = points.flatMap(p => [p.x, p.y]);
  const maxVal  = allVals.length ? Math.max(...allVals, 10) : 90;
  const step    = Math.ceil(maxVal / 5) * 5;
  const diag    = [{ x: 0, y: 0 }, { x: step + 10, y: step + 10 }];

  charts[canvasId] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Appointments',
          data: points,
          backgroundColor: 'rgba(26,108,245,0.5)',
          borderColor:     COLORS.primary,
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Perfect Prediction',
          data: diag,
          type: 'line',
          borderColor:     'rgba(0,184,148,0.5)',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, font: { size: 11 }, padding: 16 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` Predicted: ${ctx.parsed.x} min · Actual: ${ctx.parsed.y} min`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Predicted Wait (min)', font: { size: 11 } },
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          title: { display: true, text: 'Actual Wait (min)', font: { size: 11 } },
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
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
