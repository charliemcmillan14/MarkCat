// ─────────────────────────────────────────────────────────────
// TICKER.JS — scrolling ticker bar builder
// ─────────────────────────────────────────────────────────────

'use strict';

const TICKER_SYMS = ['AAPL','MSFT','NVDA','AMZN','TSLA','META','GOOGL','JPM','GS','AMD','NFLX','V','XOM','LLY'];

function buildTicker() {
  const rail = $('tickerRail');
  if (!rail) return;

  const items = TICKER_SYMS.map(sym => {
    const q = LQ[sym];
    if (!q || !q.price) {
      return `<span class="ti"><span class="ti-sym">${sym}</span><span class="ti-price">—</span></span>`;
    }
    const cls = (q.changePct || 0) >= 0 ? 'up' : 'dn';
    const arrow = (q.changePct || 0) >= 0 ? '▲' : '▼';
    return `<span class="ti" onclick="goQuote('${sym}')" style="cursor:pointer">
      <span class="ti-sym">${sym}</span>
      <span class="ti-price">${fmtPrice(q.price)}</span>
      <span class="ti-chg ${cls}">${arrow}${Math.abs(q.changePct || 0).toFixed(2)}%</span>
    </span>`;
  }).join('');

  // Duplicate for seamless loop
  rail.innerHTML = items + items;
}
