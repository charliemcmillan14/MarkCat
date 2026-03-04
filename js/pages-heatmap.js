// ─────────────────────────────────────────────────────────────
// PAGES-HEATMAP.JS — Market Heatmap
// Color-coded performance grid for S&P 500 sectors
// ─────────────────────────────────────────────────────────────
'use strict';

const HEATMAP_DATA = {
  Technology:    ['AAPL','MSFT','NVDA','AMD','GOOGL','META','INTC','CRM','ADBE','ORCL','QCOM','AVGO'],
  Financials:    ['JPM','GS','BAC','V','MA','BLK','MS','C','WFC','AXP'],
  Healthcare:    ['LLY','UNH','JNJ','ABBV','MRK','PFE','TMO','ABT','BMY','AMGN'],
  ConsumerDisc:  ['AMZN','TSLA','HD','MCD','NKE','SBUX','TGT','LOW','BKNG','CMG'],
  Energy:        ['XOM','CVX','COP','SLB','PSX','VLO','OXY','MPC','EOG'],
  Industrials:   ['CAT','DE','BA','HON','UPS','GE','LMT','MMM','RTX','FDX'],
  Utilities:     ['NEE','DUK','SO','D','AEP','EXC','PCG'],
  Materials:     ['LIN','APD','SHW','ECL','NEM','FCX','MOS'],
};

async function initHeatmap() {
  const el = $('heatmapContent');
  if (el) el.innerHTML = '<div class="state-loading">Loading market heatmap…</div>';

  // Collect all symbols
  const allSyms = [...new Set(Object.values(HEATMAP_DATA).flat())];

  // Fetch any we don't have
  const missing = allSyms.filter(s => !LQ[s] || !LQ[s].price);
  if (missing.length) {
    await Promise.allSettled(missing.map(s => fetchQuote(s)));
  }

  renderHeatmap();
}

function renderHeatmap() {
  const el = $('heatmapContent');
  if (!el) return;

  // Summary stats
  const all = Object.values(LQ).filter(q => q.price && q.changePct != null);
  const upCount   = all.filter(q => q.changePct >= 0).length;
  const downCount = all.filter(q => q.changePct < 0).length;
  const avgChg    = all.reduce((s, q) => s + q.changePct, 0) / (all.length || 1);

  el.innerHTML = `
    <!-- Summary bar -->
    <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin-bottom:28px;padding:16px 20px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg)">
      <div style="font-family:var(--mono);font-size:11px">
        <span style="color:var(--green)">▲ ${upCount} up</span>
        &nbsp;·&nbsp;
        <span style="color:var(--red)">▼ ${downCount} down</span>
        &nbsp;·&nbsp;
        <span class="${clsChg(avgChg)}">Avg ${fmtPct(avgChg)}</span>
      </div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-left:auto">
        Color intensity = magnitude of move · Size = relative market cap · Click = full quote
      </div>
    </div>

    <!-- Heatmap grid by sector -->
    ${Object.entries(HEATMAP_DATA).map(([sector, syms]) => {
      const quotes = syms.map(s => LQ[s]).filter(q => q && q.price);
      if (!quotes.length) return '';
      const sectorAvg = quotes.reduce((s, q) => s + (q.changePct||0), 0) / quotes.length;
      const sectorCls = clsChg(sectorAvg);
      return `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <div style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text3)">${sector}</div>
            <div class="${sectorCls}" style="font-family:var(--mono);font-size:10px">${fmtPct(sectorAvg)} avg</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${quotes.map(q => heatCell(q)).join('')}
          </div>
        </div>`;
    }).join('')}`;
}

function heatCell(q) {
  const pct   = q.changePct || 0;
  const abs   = Math.abs(pct);
  const intensity = Math.min(abs / 4, 1); // 4% = max color
  let bg, textColor;

  if (pct >= 0) {
    const g = Math.round(55 + intensity * 145); // 55–200 green
    bg = `rgba(52,211,153,${0.08 + intensity * 0.4})`;
    textColor = pct > 1 ? '#34D399' : 'var(--text2)';
  } else {
    bg = `rgba(248,113,113,${0.08 + intensity * 0.4})`;
    textColor = pct < -1 ? '#F87171' : 'var(--text2)';
  }

  const arrow = pct >= 0 ? '▲' : '▼';
  // Size based on rough market cap proxy
  const bigCaps = ['AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','JPM','V','LLY','UNH','XOM'];
  const isBig = bigCaps.includes(q.symbol);

  return `<div onclick="goQuote('${q.symbol}')"
    title="${q.symbol}: ${fmtPrice(q.price)} (${fmtPct(pct)})"
    style="
      background:${bg};
      border:1px solid ${pct>=0?'rgba(52,211,153,.2)':'rgba(248,113,113,.2)'};
      border-radius:4px;
      padding:${isBig?'14px 16px':'10px 12px'};
      cursor:pointer;
      transition:all .15s;
      min-width:${isBig?'90px':'70px'};
      text-align:center;
    "
    onmouseover="this.style.transform='scale(1.05)';this.style.zIndex='10'"
    onmouseout="this.style.transform='';this.style.zIndex=''">
    <div style="font-family:var(--mono);font-size:${isBig?'11px':'10px'};font-weight:600;color:var(--gold);margin-bottom:3px">${q.symbol}</div>
    <div style="font-family:var(--mono);font-size:${isBig?'12px':'10px'};color:${textColor}">${arrow} ${Math.abs(pct).toFixed(1)}%</div>
  </div>`;
}
