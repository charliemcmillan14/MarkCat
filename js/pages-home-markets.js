// ─────────────────────────────────────────────────────────────
// PAGES — HOME & MARKETS  (chart bug fixed)
// ─────────────────────────────────────────────────────────────
'use strict';

// ══════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════
async function initHome() {
  const movers = await fetchMovers();
  buildTicker();
  renderHomeTiles();
  renderHomeMovers(movers);
  const ls = $('liveStatus');
  if (ls) ls.textContent = 'LIVE · ' + new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  toast('Market data loaded ✓', true);
}

function renderHomeTiles() {
  [['tile-aapl','AAPL'],['tile-msft','MSFT'],['tile-nvda','NVDA'],['tile-tsla','TSLA']].forEach(([id,sym]) => {
    const el = $(id);
    if (!el) return;
    const q = LQ[sym];
    if (!q || !q.price) return;
    const cls = clsChg(q.changePct);
    const arrow = q.changePct >= 0 ? '▲' : '▼';
    el.querySelector('.st-price').textContent = fmtPrice(q.price);
    const chgEl = el.querySelector('.st-chg');
    chgEl.className = 'st-chg ' + cls;
    chgEl.textContent = arrow + ' ' + fmtPct(q.changePct);
  });
}

function renderHomeMovers(movers) {
  const tbody = $('homeMovers');
  if (!tbody) return;
  if (!movers.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="state-empty">No data — check Finnhub API key in Vercel settings</td></tr>';
    return;
  }
  tbody.innerHTML = movers.slice(0, 10).map(q => {
    const cls = clsChg(q.changePct);
    const arrow = q.changePct >= 0 ? '▲' : '▼';
    return `<tr onclick="goQuote('${q.symbol}')">
      <td><span class="tbl-sym">${q.symbol}</span></td>
      <td>${fmtPrice(q.price)}</td>
      <td class="${cls}">${arrow} ${fmtPct(q.changePct)}</td>
      <td class="${cls}">${fmtChg(q.change)}</td>
      <td style="color:var(--text3)">${fmtPrice(q.high)} / ${fmtPrice(q.low)}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════
// MARKETS
// ══════════════════════════════════════════════
let _marketsChart = null;
let _marketsCurrentSym = 'AAPL';

async function initMarkets() {
  const movers = Object.values(LQ).length > 3 ? Object.values(LQ) : await fetchMovers();
  renderMarketsList(movers);
  // Load default chart after DOM settles
  setTimeout(() => loadMarketsChart(_marketsCurrentSym), 150);
}

function renderMarketsList(movers) {
  const tbody = $('marketsList');
  if (!tbody) return;
  tbody.innerHTML = movers.map(q => {
    const cls = clsChg(q.changePct);
    const arrow = q.changePct >= 0 ? '▲' : '▼';
    const sel = q.symbol === _marketsCurrentSym ? 'style="background:rgba(201,168,76,.06)"' : '';
    return `<tr onclick="selectMarketsChart('${q.symbol}')" id="mrow-${q.symbol}" ${sel}>
      <td><span class="tbl-sym">${q.symbol}</span></td>
      <td>${fmtPrice(q.price)}</td>
      <td class="${cls}">${arrow} ${fmtPct(q.changePct)}</td>
      <td class="${cls}">${fmtChg(q.change)}</td>
    </tr>`;
  }).join('');
}

async function selectMarketsChart(sym) {
  _marketsCurrentSym = sym;
  $all('#marketsList tr').forEach(r => r.style.background = '');
  const row = $('mrow-' + sym);
  if (row) row.style.background = 'rgba(201,168,76,.06)';
  await loadMarketsChart(sym);
}

async function loadMarketsChart(sym) {
  const lbl = $('marketsChartLabel');
  if (lbl) lbl.innerHTML = `<span style="color:var(--text3)">${sym}</span> — Loading chart…`;

  const candles = await fetchCandles(sym, 90, 'D');
  if (!candles.length) {
    if (lbl) lbl.textContent = sym + ' — No chart data (market may be closed)';
    return;
  }

  const color  = priceColor(candles);
  const labels = candles.map(c => new Date(c.time * 1000).toLocaleDateString('en-US',{month:'short',day:'numeric'}));
  const prices = candles.map(c => c.close);
  const first  = prices[0], last = prices[prices.length - 1];
  const pct    = ((last - first) / first * 100).toFixed(2);

  if (lbl) {
    lbl.innerHTML = `<span onclick="goQuote('${sym}')" style="cursor:pointer;color:var(--gold)">${sym}</span>
      &nbsp;<span class="${clsChg(last-first)}">${last>=first?'▲':'▼'} ${pct}% (90d)</span>`;
  }

  // CRITICAL: get canvas AFTER label update, ensure container has height
  const wrap = $('marketsChartWrap');
  if (wrap) wrap.style.height = '300px';

  const cv = $('marketsChart');
  if (!cv) return;

  // Destroy old chart first
  if (_marketsChart) { _marketsChart.destroy(); _marketsChart = null; }

  // Let browser paint before creating chart
  requestAnimationFrame(() => {
    const opts = chartDefaults();
    opts.plugins.tooltip.callbacks = { label: ctx => ' ' + fmtPrice(ctx.parsed.y) };
    _marketsChart = new Chart(cv.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [lineDataset(prices, color)] },
      options: opts,
    });
  });
}
