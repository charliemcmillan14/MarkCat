// ─────────────────────────────────────────────────────────────
// UTILS.JS — formatting, DOM helpers, toast, local storage
// ─────────────────────────────────────────────────────────────

'use strict';

// ── DOM ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $q = s => document.querySelector(s);
const $all = s => [...document.querySelectorAll(s)];

// ── NUMBER FORMATTING ─────────────────────────────────────────
function fmtPrice(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 10000) return '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  if (n >= 1)     return '$' + Number(n).toFixed(2);
  return '$' + Number(n).toFixed(4);
}

function fmtPct(n, showPlus = true) {
  if (n == null || isNaN(n)) return '—';
  const s = showPlus && n >= 0 ? '+' : '';
  return s + Number(n).toFixed(2) + '%';
}

function fmtChg(n) {
  if (n == null || isNaN(n)) return '—';
  const s = n >= 0 ? '+' : '';
  return s + Number(n).toFixed(2);
}

function fmtLarge(n) {
  if (!n) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2)  + 'B';
  if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2)  + 'M';
  return '$' + Number(n).toLocaleString();
}

function fmtVol(n) {
  if (!n) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
}

function fmtDateStr(str) {
  if (!str) return '—';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
}

function clsChg(n) { return n >= 0 ? 'up' : 'dn'; }

// ── TOAST ─────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, gold = false) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show' + (gold ? ' gold' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.className = '', 3200);
}

// ── LOCAL STORAGE ─────────────────────────────────────────────
const LS = {
  get: (k, def = null) => {
    try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : def; } catch { return def; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
  del: k => { try { localStorage.removeItem(k); } catch {} },
};

// ── CHART HELPERS ─────────────────────────────────────────────
function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0C0F17',
        borderColor: '#1C2235',
        borderWidth: 1,
        titleColor: '#5A5650',
        bodyColor: '#E2DECD',
        padding: 10,
        displayColors: false,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(28,34,53,.5)', drawBorder: false },
        ticks: { color: '#3A3D4E', font: { family: 'IBM Plex Mono', size: 9 }, maxTicksLimit: 8 }
      },
      y: {
        position: 'right',
        grid: { color: 'rgba(28,34,53,.5)', drawBorder: false },
        ticks: { color: '#3A3D4E', font: { family: 'IBM Plex Mono', size: 9 }, callback: v => '$' + v.toFixed(0) }
      }
    }
  };
}

function lineDataset(prices, color) {
  return {
    data: prices,
    borderColor: color,
    borderWidth: 2,
    pointRadius: 0,
    fill: true,
    tension: 0.3,
    backgroundColor: ctx => {
      const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
      g.addColorStop(0, color + '28');
      g.addColorStop(1, color + '00');
      return g;
    }
  };
}

function priceColor(candles) {
  if (!candles || candles.length < 2) return '#C9A84C';
  return candles[candles.length - 1].close >= candles[0].close ? '#34D399' : '#F87171';
}
