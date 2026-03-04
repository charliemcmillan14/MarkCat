// ─────────────────────────────────────────────────────────────
// PAGES-MACRO-SECTORS.JS
// Macro dashboard: sector ETFs, bond market, indices, yield curve
// Sector deep-dives: Tech, Finance, Energy, Healthcare
// ─────────────────────────────────────────────────────────────

'use strict';

const SECTOR_STOCKS = {
  tech:       { label: 'Technology',   etf: 'XLK', syms: ['AAPL','MSFT','NVDA','AMD','GOOGL','META','INTC','CRM','ADBE','ORCL'] },
  finance:    { label: 'Financials',   etf: 'XLF', syms: ['JPM','GS','BAC','V','MA','BLK','MS','C','WFC','AXP'] },
  energy:     { label: 'Energy',       etf: 'XLE', syms: ['XOM','CVX','COP','SLB','PSX','VLO','OXY','MPC','EOG','PXD'] },
  healthcare: { label: 'Healthcare',   etf: 'XLV', syms: ['LLY','UNH','JNJ','ABBV','MRK','PFE','TMO','ABT','BMY','AMGN'] },
};

// ══════════════════════════════════════════════
// MACRO PAGE
// ══════════════════════════════════════════════
let _macroData = null;

async function initMacro() {
  const el = $('macroContent');
  if (el) el.innerHTML = '<div class="state-loading">Loading macro indicators…</div>';
  try {
    const data = await apiFetch('/api/macro');
    _macroData = data;
    renderMacro(data);
  } catch (e) {
    if (el) el.innerHTML = '<div class="state-empty" style="color:var(--red)">Could not load macro data.</div>';
  }
}

function renderMacro(data) {
  const el = $('macroContent');
  if (!el) return;

  const { indices, sectors, bonds, other, yieldCurveSignal } = data;

  el.innerHTML = `
    <!-- US Indices -->
    <div style="margin-bottom:36px">
      <div class="sec-title"><em>//</em> US Market Indices</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${indices.map(i => macroCard(i)).join('')}
      </div>
    </div>

    <!-- Yield Curve -->
    ${yieldCurveSignal ? `
    <div style="margin-bottom:36px">
      <div class="sec-title"><em>//</em> Yield Curve Signal</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:start">
        ${bonds.map(b => macroCard(b)).join('')}
        <div class="card" style="border-left:2px solid var(--gold)">
          <div style="font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Signal</div>
          <div style="font-family:var(--serif);font-size:16px;color:var(--text);margin-bottom:6px">${yieldCurveSignal.signal}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--text3)">TLT vs SHY spread: ${yieldCurveSignal.spread > 0 ? '+' : ''}${yieldCurveSignal.spread}%</div>
        </div>
      </div>
    </div>` : ''}

    <!-- Sector Performance -->
    <div style="margin-bottom:36px">
      <div class="sec-title"><em>//</em> Sector ETF Performance · Click to drill down</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
        ${sectors.map(s => {
          const key = Object.keys(SECTOR_STOCKS).find(k => SECTOR_STOCKS[k].etf === s.symbol);
          return `<div class="card" style="cursor:pointer;border-color:${(s.changePct||0)>=0?'rgba(52,211,153,.2)':'rgba(248,113,113,.2)'}" onclick="${key ? `goSector('${key}')` : ''}">
            <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--text3);text-transform:uppercase;margin-bottom:6px">${s.symbol}</div>
            <div style="font-family:var(--mono);font-size:18px;font-weight:600;margin-bottom:4px">${fmtPrice(s.price)}</div>
            <div class="${clsChg(s.changePct)}" style="font-family:var(--mono);font-size:12px;margin-bottom:8px">${fmtPct(s.changePct)}</div>
            <div style="font-size:11px;color:var(--text2)">${s.name}</div>
            ${key ? `<div style="font-family:var(--mono);font-size:9px;color:var(--gold);margin-top:8px">Explore stocks →</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Commodities + Dollar + VIX -->
    <div>
      <div class="sec-title"><em>//</em> Commodities, Dollar &amp; Volatility</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
        ${other.map(i => macroCard(i)).join('')}
      </div>
    </div>`;
}

function macroCard(item) {
  const cls = clsChg(item.changePct);
  const arrow = (item.changePct||0) >= 0 ? '▲' : '▼';
  return `<div class="card" onclick="goQuote('${item.symbol}')" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
      <div style="font-family:var(--mono);font-size:10px;font-weight:600;color:var(--gold)">${item.symbol}</div>
      <div class="${cls}" style="font-family:var(--mono);font-size:11px">${arrow} ${fmtPct(item.changePct)}</div>
    </div>
    <div style="font-family:var(--mono);font-size:22px;font-weight:600;margin-bottom:4px">${fmtPrice(item.price)}</div>
    <div style="font-size:11px;color:var(--text2)">${item.name}</div>
    <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:6px">H: ${fmtPrice(item.high)} · L: ${fmtPrice(item.low)}</div>
  </div>`;
}

// ══════════════════════════════════════════════
// SECTOR DEEP-DIVES
// ══════════════════════════════════════════════
let _currentSector = null;
let _sectorChart = null;

function goSector(sectorKey) {
  _currentSector = sectorKey;
  go('sector');
}

async function initSector() {
  if (!_currentSector) _currentSector = 'tech';
  await renderSectorPage(_currentSector);
}

async function renderSectorPage(key) {
  const sector = SECTOR_STOCKS[key];
  if (!sector) return;
  const el = $('sectorContent');
  if (!el) return;

  el.innerHTML = `
    <!-- Sector nav tabs -->
    <div style="display:flex;gap:8px;margin-bottom:28px;flex-wrap:wrap">
      ${Object.entries(SECTOR_STOCKS).map(([k,v]) =>
        `<button class="pill ${k===key?'active':''}" onclick="switchSector('${k}')">${v.label}</button>`
      ).join('')}
    </div>

    <!-- ETF summary -->
    <div id="sectorEtfCard" class="card card-gold" style="margin-bottom:28px">
      <div class="state-loading">Loading ${sector.etf}…</div>
    </div>

    <!-- Stock grid -->
    <div class="sec-title"><em>//</em> ${sector.label} Stocks · Click for full quote</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:28px">
      <table class="tbl">
        <thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>High</th><th>Low</th><th>Prev Close</th></tr></thead>
        <tbody id="sectorStockList">
          <tr><td colspan="6" class="state-loading">Loading stocks…</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Chart -->
    <div class="sec-title"><em>//</em> ${sector.etf} ETF — 90 Day Chart</div>
    <div class="chart-wrap">
      <div class="chart-canvas-wrap" style="height:280px">
        <canvas id="sectorChart" style="width:100%;height:100%"></canvas>
      </div>
    </div>`;

  // Load ETF quote
  const etfQ = await fetchQuote(sector.etf);
  const etfEl = $('sectorEtfCard');
  if (etfEl && etfQ) {
    const cls = clsChg(etfQ.changePct);
    etfEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:var(--gold);margin-bottom:4px">${sector.etf} ETF · ${sector.label} Sector</div>
          <div style="font-family:var(--mono);font-size:32px;font-weight:600">${fmtPrice(etfQ.price)}</div>
        </div>
        <div class="${cls}" style="font-family:var(--mono);font-size:18px">${fmtPct(etfQ.changePct)} &nbsp; ${fmtChg(etfQ.change)}</div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--text3)">Open: ${fmtPrice(etfQ.open)} · H: ${fmtPrice(etfQ.high)} · L: ${fmtPrice(etfQ.low)}</div>
      </div>`;
  }

  // Load all stocks
  const results = await Promise.allSettled(sector.syms.map(s => fetchQuote(s)));
  const quotes = results.filter(r => r.status==='fulfilled' && r.value?.price).map(r => r.value);

  const tbody = $('sectorStockList');
  if (tbody) {
    tbody.innerHTML = quotes.map(q => {
      const cls = clsChg(q.changePct);
      const arrow = (q.changePct||0)>=0?'▲':'▼';
      return `<tr onclick="goQuote('${q.symbol}')">
        <td><span class="tbl-sym">${q.symbol}</span></td>
        <td>${fmtPrice(q.price)}</td>
        <td class="${cls}">${arrow} ${fmtPct(q.changePct)}</td>
        <td style="color:var(--green)">${fmtPrice(q.high)}</td>
        <td style="color:var(--red)">${fmtPrice(q.low)}</td>
        <td style="color:var(--text3)">${fmtPrice(q.prevClose)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="state-empty">Data unavailable</td></tr>';
  }

  // Load ETF chart
  const candles = await fetchCandles(sector.etf, 90, 'D');
  if (candles.length) {
    setTimeout(() => {
      const cv = $('sectorChart');
      if (!cv) return;
      if (_sectorChart) _sectorChart.destroy();
      const color = priceColor(candles);
      const labels = candles.map(c => new Date(c.time*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'}));
      const prices = candles.map(c => c.close);
      _sectorChart = new Chart(cv.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [lineDataset(prices, color)] },
        options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins, tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { label: ctx => ' ' + fmtPrice(ctx.parsed.y) } } } }
      });
    }, 100);
  }
}

async function switchSector(key) {
  _currentSector = key;
  await renderSectorPage(key);
}
