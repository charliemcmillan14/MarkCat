// ─────────────────────────────────────────────────────────────
// PAGES-PREMIUM.JS — Sentiment, Earnings Calendar, Portfolio, Simulator
// ─────────────────────────────────────────────────────────────

'use strict';

// ══════════════════════════════════════════════
// MARKET SENTIMENT GAUGE
// ══════════════════════════════════════════════
async function initSentiment() {
  const el = $('sentimentContent');
  if (el) el.innerHTML = '<div class="state-loading">Analyzing market sentiment…</div>';

  const data = await fetchSentiment();
  if (!data || !data.score) {
    if (el) el.innerHTML = '<div class="state-empty" style="color:var(--red)">Could not load sentiment data. Check your Finnhub API key.</div>';
    return;
  }
  renderSentiment(data);
}

function renderSentiment(data) {
  const el = $('sentimentContent');
  if (!el) return;

  const { score, label, color, breadth, avgChangePct, stocks } = data;
  const circumference = 2 * Math.PI * 70; // r=70
  const dashOffset = circumference - (score / 100) * circumference;

  // History for mini-chart
  const prevScore = LS.get('sentimentHistory', []);
  prevScore.push({ score, time: Date.now() });
  if (prevScore.length > 30) prevScore.shift();
  LS.set('sentimentHistory', prevScore);

  el.innerHTML = `
    <div class="sentiment-wrap">
      <!-- Gauge -->
      <div>
        <div class="gauge-card">
          <div class="sec-title"><em>//</em> Fear &amp; Greed Index</div>
          <div class="gauge-ring">
            <svg viewBox="0 0 180 180">
              <circle class="track" cx="90" cy="90" r="70"/>
              <circle class="fill" cx="90" cy="90" r="70"
                stroke="${color}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${dashOffset}"
                id="gaugeArc"/>
            </svg>
            <div class="gauge-center">
              <div class="gauge-score" style="color:${color}" id="gaugeNum">0</div>
              <div class="gauge-label">${label}</div>
            </div>
          </div>
          <div class="gauge-sub">${breadth.up} stocks up · ${breadth.down} stocks down</div>
          <div class="gauge-sub" style="margin-top:6px">Avg move: <span class="${clsChg(avgChangePct)}">${fmtPct(avgChangePct)}</span></div>

          <div class="sentiment-breakdown" style="margin-top:24px">
            <div class="sb-row">
              <div class="sb-label">Greed</div>
              <div class="sb-bar-wrap"><div class="sb-bar" style="width:${breadth.pctUp}%;background:var(--green)"></div></div>
              <div class="sb-val">${breadth.pctUp}%</div>
            </div>
            <div class="sb-row">
              <div class="sb-label">Fear</div>
              <div class="sb-bar-wrap"><div class="sb-bar" style="width:${100-breadth.pctUp}%;background:var(--red)"></div></div>
              <div class="sb-val">${(100-breadth.pctUp).toFixed(1)}%</div>
            </div>
          </div>

          <div style="margin-top:20px;font-family:var(--mono);font-size:10px;color:var(--text3);line-height:1.8;padding:12px;background:var(--bg3);border-radius:var(--radius)">
            Score 0–100. Below 30 = Extreme Fear (buy signal for contrarians). Above 70 = Extreme Greed (take profit). Calculated from price breadth and momentum of 18 major stocks.
          </div>
        </div>
      </div>

      <!-- Stock breakdown -->
      <div>
        <div class="sec-title"><em>//</em> Stock Breakdown</div>
        <div class="sent-stocks">
          ${stocks.map(s => `
            <div class="sent-stock" onclick="goQuote('${s.symbol}')">
              <div class="sym">${s.symbol}</div>
              <div class="chg ${clsChg(s.changePct)}">${fmtPct(s.changePct)}</div>
            </div>`).join('')}
        </div>

        <div style="margin-top:28px">
          <div class="sec-title"><em>//</em> What This Means</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            ${[
              ['0 – 25', 'Extreme Fear', 'var(--red)', 'Markets oversold. Historically a contrarian buy opportunity.'],
              ['25 – 45', 'Fear', '#F87171', 'Investors pulling back. Watch for stabilization before entry.'],
              ['45 – 55', 'Neutral', 'var(--gold)', 'Balanced market. Follow individual stock setups.'],
              ['55 – 75', 'Greed', '#34D399', 'Bull momentum. Strong but watch for over-extension.'],
              ['75 – 100', 'Extreme Greed', 'var(--green)', 'Market euphoria. Consider trimming positions, tighten stops.'],
            ].map(([range, lbl, col, desc]) => `
              <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:14px;${score >= parseInt(range) && score <= parseInt(range.split('–')[1]) ? 'border-color:'+col+';background:rgba(255,255,255,.02)' : ''}">
                <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:${col};margin-bottom:4px">${range} · ${lbl}</div>
                <div style="font-size:11px;color:var(--text2);line-height:1.6">${desc}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  // Animate gauge counter
  let n = 0;
  const el2 = $('gaugeNum');
  const tick = setInterval(() => {
    n = Math.min(n + Math.ceil(score / 30), score);
    if (el2) el2.textContent = n;
    if (n >= score) clearInterval(tick);
  }, 30);
}

// ══════════════════════════════════════════════
// EARNINGS CALENDAR
// ══════════════════════════════════════════════
async function initEarnings() {
  const el = $('earningsContent');
  if (el) el.innerHTML = '<div class="state-loading">Loading earnings calendar…</div>';

  const data = await fetchEarnings();
  if (!data || !data.earnings) {
    if (el) el.innerHTML = '<div class="state-empty" style="color:var(--red)">Could not load earnings calendar. Check your Finnhub API key.</div>';
    return;
  }
  renderEarnings(data.earnings);
}

function renderEarnings(earnings) {
  const el = $('earningsContent');
  if (!el) return;

  if (!earnings.length) {
    el.innerHTML = '<div class="state-empty">No upcoming earnings found for tracked symbols.</div>';
    return;
  }

  // Group by date
  const byDate = {};
  earnings.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const today = new Date().toISOString().split('T')[0];

  const rows = Object.entries(byDate).map(([date, items]) => {
    const isToday = date === today;
    const isPast  = date < today;
    const dateLabel = fmtDateStr(date);
    return `
      <div style="margin-bottom:28px">
        <div class="sec-title" style="${isToday ? 'color:var(--gold)' : ''}">
          <em>${isToday ? '★ Today' : ''}</em> ${dateLabel} ${isToday ? '' : isPast ? '· Reported' : '· Upcoming'}
        </div>
        <div class="earnings-grid">
          <div class="earn-row earn-hdr">
            <div>Symbol</div><div>Company</div><div>EPS Est.</div><div>EPS Actual</div><div>When</div><div>Beat?</div>
          </div>
          ${items.map(e => {
            const q = LQ[e.symbol];
            const beat = e.epsActual != null && e.epsEstimate != null
              ? e.epsActual >= e.epsEstimate ? 'beat' : 'miss'
              : 'pending';
            const beatLabel = beat === 'beat' ? '✓ Beat' : beat === 'miss' ? '✗ Miss' : '—';
            const beatCls   = beat === 'beat' ? 'earn-beat' : beat === 'miss' ? 'earn-miss' : 'earn-pending';
            const hourCls   = e.hour === 'bmo' ? 'bmo' : e.hour === 'amc' ? 'amc' : '';
            const hourLabel = e.hour === 'bmo' ? 'Pre-Mkt' : e.hour === 'amc' ? 'After-Mkt' : e.hour || '—';
            return `<div class="earn-row" onclick="goQuote('${e.symbol}')">
              <div class="earn-sym">${e.symbol}</div>
              <div class="earn-name">${e.symbol}</div>
              <div class="earn-est">${e.epsEstimate != null ? '$' + Number(e.epsEstimate).toFixed(2) : '—'}</div>
              <div class="earn-act ${beatCls}">${e.epsActual != null ? '$' + Number(e.epsActual).toFixed(2) : '—'}</div>
              <div><span class="earn-hour ${hourCls}">${hourLabel}</span></div>
              <div class="${beatCls}">${beatLabel}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="margin-bottom:20px;padding:16px;background:var(--bg2);border:1px solid rgba(201,168,76,.2);border-radius:var(--radius-lg);font-size:12px;color:var(--text2)">
      📅 &nbsp;Showing upcoming earnings for <strong style="color:var(--text)">25 major stocks</strong> over the next 60 days. Click any row to view the full quote and chart.
    </div>
    ${rows}`;
}

// ══════════════════════════════════════════════
// PORTFOLIO TRACKER
// ══════════════════════════════════════════════
let _portfolio = [];
let _portChart = null;

function initPortfolio() {
  _portfolio = LS.get('portfolio', []);
  renderPortfolio();
}

async function addHolding() {
  const sym   = ($('portSym')?.value  || '').trim().toUpperCase();
  const qty   = parseFloat($('portQty')?.value  || '0');
  const cost  = parseFloat($('portCost')?.value || '0');
  if (!sym || !qty || !cost) { toast('Fill in all three fields'); return; }

  // Fetch live price
  let q = LQ[sym];
  if (!q || !q.price) {
    toast('Looking up ' + sym + '…');
    q = await fetchQuote(sym);
  }
  if (!q || !q.price) { toast(sym + ' not found'); return; }

  // Add or update
  const existing = _portfolio.findIndex(h => h.symbol === sym);
  if (existing >= 0) {
    _portfolio[existing].qty  += qty;
    _portfolio[existing].cost  = ((_portfolio[existing].cost * (_portfolio[existing].qty - qty)) + cost * qty) / _portfolio[existing].qty;
  } else {
    _portfolio.push({ symbol: sym, qty, cost, name: q.name || sym });
  }
  LS.set('portfolio', _portfolio);
  renderPortfolio();

  // Clear inputs
  if ($('portSym'))  $('portSym').value  = '';
  if ($('portQty'))  $('portQty').value  = '';
  if ($('portCost')) $('portCost').value = '';
  toast(sym + ' added ✓', true);
}

function removeHolding(sym) {
  _portfolio = _portfolio.filter(h => h.symbol !== sym);
  LS.set('portfolio', _portfolio);
  renderPortfolio();
}

function renderPortfolio() {
  const tableEl   = $('portTable');
  const summaryEl = $('portSummary');
  if (!tableEl) return;

  if (!_portfolio.length) {
    tableEl.innerHTML = `<div class="state-empty" style="padding:40px">
      Add your holdings above to track your portfolio's live value and P&amp;L.
    </div>`;
    if (summaryEl) summaryEl.innerHTML = '<div class="state-empty">No holdings yet.</div>';
    return;
  }

  let totalValue = 0, totalCost = 0;
  const rows = _portfolio.map(h => {
    const q    = LQ[h.symbol];
    const price = q?.price || h.cost;
    const value = price * h.qty;
    const pnl   = (price - h.cost) * h.qty;
    const pnlPct = ((price - h.cost) / h.cost) * 100;
    totalValue += value;
    totalCost  += h.cost * h.qty;
    const cls = clsChg(pnl);
    return { ...h, price, value, pnl, pnlPct, cls };
  });

  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = (totalPnl / totalCost) * 100;

  tableEl.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
      <div class="port-row port-hdr">
        <div>Symbol</div><div>Name</div><div>Qty</div><div>Avg Cost</div><div>Current</div><div>Value</div><div>P&amp;L</div><div></div>
      </div>
      ${rows.map(r => `
        <div class="port-row">
          <div class="tbl-sym" style="cursor:pointer" onclick="goQuote('${r.symbol}')">${r.symbol}</div>
          <div class="tbl-name">${r.name}</div>
          <div>${r.qty}</div>
          <div>${fmtPrice(r.cost)}</div>
          <div>${fmtPrice(r.price)}</div>
          <div>${fmtLarge(r.value)}</div>
          <div class="${r.cls}">${r.pnl >= 0 ? '+' : ''}${fmtLarge(Math.abs(r.pnl))} <span style="font-size:10px;opacity:.7">${fmtPct(r.pnlPct)}</span></div>
          <div><button class="port-remove" onclick="removeHolding('${r.symbol}')">✕</button></div>
        </div>`).join('')}
    </div>`;

  // Summary card
  if (summaryEl) {
    const pnlCls = clsChg(totalPnl);
    summaryEl.innerHTML = `
      <div class="sec-title"><em>//</em> Portfolio Summary</div>
      <div class="ps-total">${fmtLarge(totalValue)}</div>
      <div class="${pnlCls}" style="font-family:var(--mono);font-size:13px;margin-bottom:20px">
        ${totalPnl >= 0 ? '▲' : '▼'} ${fmtLarge(Math.abs(totalPnl))} (${fmtPct(totalPnlPct)})
      </div>
      ${rows.map(r => `
        <div class="ps-row">
          <span>${r.symbol}</span>
          <span class="${r.cls}">${fmtPct(r.pnlPct)}</span>
        </div>`).join('')}
      <div class="ps-row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:12px">
        <span>Total Cost</span><span>${fmtLarge(totalCost)}</span>
      </div>
      <div style="margin-top:16px">
        <div class="sec-title" style="font-size:8px">Allocation</div>
        <div class="pie-wrap"><canvas id="pieChart"></canvas></div>
      </div>`;

    // Draw pie chart
    setTimeout(() => {
      const cv = $('pieChart');
      if (!cv) return;
      if (_portChart) _portChart.destroy();
      const COLORS = ['#C9A84C','#34D399','#60A5FA','#F87171','#FBBF24','#A78BFA','#FB7185','#34D399'];
      _portChart = new Chart(cv.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: rows.map(r => r.symbol),
          datasets: [{
            data: rows.map(r => r.value),
            backgroundColor: rows.map((_, i) => COLORS[i % COLORS.length] + 'CC'),
            borderColor: rows.map((_, i) => COLORS[i % COLORS.length]),
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#5A5650', font: { family: 'IBM Plex Mono', size: 9 }, boxWidth: 10, padding: 12 } },
            tooltip: {
              backgroundColor: '#0C0F17', borderColor: '#1C2235', borderWidth: 1,
              titleColor: '#5A5650', bodyColor: '#E2DECD',
              callbacks: { label: ctx => ' ' + fmtLarge(ctx.parsed) + ' · ' + (ctx.parsed / totalValue * 100).toFixed(1) + '%' }
            }
          }
        }
      });
    }, 50);
  }
}

// ══════════════════════════════════════════════
// POSITION SIZING SIMULATOR
// ══════════════════════════════════════════════
function initSimulator() {
  calcPosition();
}

function calcPosition() {
  const acct   = parseFloat($('simAcct')?.value)   || 50000;
  const risk   = parseFloat($('simRisk')?.value)   || 1;
  const entry  = parseFloat($('simEntry')?.value)  || 150;
  const stop   = parseFloat($('simStop')?.value)   || 144;
  const target = parseFloat($('simTarget')?.value) || 165;

  if (entry <= 0 || stop <= 0 || entry === stop) return;

  const riskPerShare  = Math.abs(entry - stop);
  const dollarRisk    = acct * risk / 100;
  const shares        = Math.floor(dollarRisk / riskPerShare);
  const rr            = riskPerShare > 0 ? (Math.abs(target - entry) / riskPerShare) : 0;
  const maxLoss       = shares * riskPerShare;
  const maxGain       = shares * Math.abs(target - entry);
  const positionSize  = shares * entry;
  const pctAcct       = (positionSize / acct) * 100;

  const el = $('simResults');
  if (!el) return;

  const rrCls = rr >= 3 ? 'up' : rr >= 2 ? '' : rr >= 1 ? '' : 'dn';
  const rrLabel = rr >= 3 ? 'Excellent' : rr >= 2 ? 'Good' : rr >= 1 ? 'Acceptable' : 'Poor — consider skipping';

  el.innerHTML = `
    <div class="result-grid">
      <div class="result-card card-gold">
        <div class="rc-label">Shares to Buy</div>
        <div class="rc-value" style="color:var(--gold)">${shares.toLocaleString()}</div>
        <div class="rc-sub">Position size: ${fmtLarge(positionSize)} (${pctAcct.toFixed(1)}% of account)</div>
      </div>
      <div class="result-card">
        <div class="rc-label">Max Loss if Stopped Out</div>
        <div class="rc-value dn">−${fmtLarge(maxLoss)}</div>
        <div class="rc-sub">${risk}% of account · Stop at ${fmtPrice(stop)}</div>
      </div>
      <div class="result-card">
        <div class="rc-label">Max Gain if Target Hit</div>
        <div class="rc-value up">+${fmtLarge(maxGain)}</div>
        <div class="rc-sub">Target at ${fmtPrice(target)}</div>
      </div>
      <div class="result-card">
        <div class="rc-label">Risk / Reward Ratio</div>
        <div class="rc-value ${rrCls}">1 : ${rr.toFixed(2)}</div>
        <div class="rc-sub">${rrLabel}</div>
      </div>
      <div class="result-card">
        <div class="rc-label">Breakeven Price</div>
        <div class="rc-value">${fmtPrice(entry)}</div>
        <div class="rc-sub">Your exact entry price</div>
      </div>
      <div class="result-card">
        <div class="rc-label">Trades to Wipe Account</div>
        <div class="rc-value">${Math.floor(100 / risk)}</div>
        <div class="rc-sub">If every trade is a full loss (${risk}% risk each)</div>
      </div>
    </div>`;
}
