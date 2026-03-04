// ─────────────────────────────────────────────────────────────
// PAGES — QUOTE, NEWS, CRYPTO
// ─────────────────────────────────────────────────────────────

'use strict';

// ══════════════════════════════════════════════
// QUOTE PAGE
// ══════════════════════════════════════════════
let _quoteChart = null;

function initQuotePage() {
  // Pre-load AAPL if no sym cached
  const last = LS.get('lastQuoteSym', 'AAPL');
  const inp = $('quoteInput');
  if (inp) inp.value = last;
  renderQuote(last);
}

async function searchQuote() {
  const inp = $('quoteInput');
  const sym = (inp?.value || '').trim().toUpperCase();
  if (!sym) return;
  LS.set('lastQuoteSym', sym);
  await renderQuote(sym);
}

async function renderQuote(symbol) {
  const panel = $('quotePanel');
  if (!panel) return;

  panel.innerHTML = `<div class="state-loading">
    <div class="loading-shimmer" style="width:200px;height:52px;margin:0 auto 12px"></div>
    <div class="loading-shimmer" style="width:140px;height:24px;margin:0 auto 8px"></div>
    <div class="loading-shimmer" style="width:100%;height:260px;margin-top:20px"></div>
  </div>`;

  const [q, candles, articles] = await Promise.all([
    fetchQuote(symbol),
    fetchCandles(symbol, 90, 'D'),
    fetchCompanyNews(symbol),
  ]);

  if (!q || !q.price) {
    panel.innerHTML = `<div class="state-empty" style="color:var(--red)">
      Symbol <strong>${symbol}</strong> not found. Try AAPL, TSLA, NVDA, etc.
    </div>`;
    return;
  }

  const cls = clsChg(q.changePct);
  const arrow = q.changePct >= 0 ? '▲' : '▼';
  const color = candles.length ? priceColor(candles) : (q.changePct >= 0 ? '#34D399' : '#F87171');

  panel.innerHTML = `
    <div class="quote-hero">
      <div>
        <div class="qh-sym">${q.symbol} ${q.exchange ? '· ' + q.exchange : ''}</div>
        <div class="qh-name">${q.name || q.symbol}</div>
        <div class="qh-price">${fmtPrice(q.price)}</div>
        <div class="qh-chg ${cls}">${arrow} ${fmtPct(q.changePct)} &nbsp; (${fmtChg(q.change)})</div>
        <div class="qh-meta">
          <span>Open <strong>${fmtPrice(q.open)}</strong></span>
          <span>High <strong>${fmtPrice(q.high)}</strong></span>
          <span>Low <strong>${fmtPrice(q.low)}</strong></span>
          <span>Prev Close <strong>${fmtPrice(q.prevClose)}</strong></span>
          ${q.marketCap ? `<span>Mkt Cap <strong>${fmtLarge(q.marketCap * 1e6)}</strong></span>` : ''}
        </div>
      </div>
      ${q.industry ? `<div class="qh-badge">
        <strong>${q.industry}</strong>
        ${q.weburl ? `<a href="${q.weburl}" target="_blank" style="color:var(--gold);font-size:10px;display:block;margin-top:4px">Investor Relations ↗</a>` : ''}
      </div>` : ''}
    </div>

    <div class="chart-wrap" style="margin-bottom:32px">
      <div class="chart-hdr">
        <span class="chart-label">Price Chart · ${symbol}</span>
        <div class="chart-tabs">
          <button class="chart-tab active" onclick="changeQuoteChart('${symbol}',30,this)">1M</button>
          <button class="chart-tab" onclick="changeQuoteChart('${symbol}',90,this)">3M</button>
          <button class="chart-tab" onclick="changeQuoteChart('${symbol}',180,this)">6M</button>
          <button class="chart-tab" onclick="changeQuoteChart('${symbol}',365,this)">1Y</button>
        </div>
      </div>
      <div class="chart-canvas-wrap">
        <canvas id="quoteCanvas"></canvas>
      </div>
    </div>

    ${articles.length ? `
    <div class="sec-title"><em>//</em> Recent News · ${symbol}</div>
    <div class="news-grid" id="quoteNews">
      ${renderNewsItems(articles.slice(0, 5))}
    </div>` : ''}
  `;

  // Draw chart
  if (candles.length) {
    drawQuoteChart(candles, color);
  }
}

function drawQuoteChart(candles, color) {
  const cv = $('quoteCanvas');
  if (!cv) return;
  const labels = candles.map(c => {
    const d = new Date(c.time * 1000);
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
  });
  const prices = candles.map(c => c.close);
  if (_quoteChart) { _quoteChart.destroy(); _quoteChart = null; }
  requestAnimationFrame(() => {
    _quoteChart = new Chart(cv.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [lineDataset(prices, color)] },
      options: {
        ...chartDefaults(),
        plugins: {
          ...chartDefaults().plugins,
          tooltip: {
            ...chartDefaults().plugins.tooltip,
            callbacks: { label: ctx => ' ' + fmtPrice(ctx.parsed.y) }
          }
        }
      }
    });
  });
}

async function changeQuoteChart(symbol, days, btn) {
  $all('.chart-tabs .chart-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const candles = await fetchCandles(symbol, days, 'D');
  if (candles.length) drawQuoteChart(candles, priceColor(candles));
}

// ══════════════════════════════════════════════
// NEWS PAGE
// ══════════════════════════════════════════════
let _newsFilter = 'all';
let _newsArticles = [];

async function initNews() {
  const el = $('newsFeed');
  if (el) el.innerHTML = '<div class="state-loading">Loading market news…</div>';
  const last = LS.get('lastNewsSym', '');
  if (last) {
    const inp = $('newsInput');
    if (inp) inp.value = last;
  }
  await loadMarketNews();
}

async function loadMarketNews() {
  const el = $('newsFeed');
  if (el) el.innerHTML = '<div class="state-loading">Loading from Reuters, MarketWatch, Yahoo Finance, Finnhub…</div>';
  const data = await fetchAllNews('');
  const articles = data.articles || [];
  _newsArticles = articles;
  // Show source count
  const sources = data.sources || [];
  if (sources.length) {
    const bar = $('newsSourceBar');
    if (bar) bar.textContent = 'Sources: ' + sources.join(' · ');
  }
  renderNewsFeed(articles);
}

async function searchNews() {
  const inp = $('newsInput');
  const sym = (inp?.value || '').trim().toUpperCase();
  if (!sym) return;
  LS.set('lastNewsSym', sym);
  const el = $('newsFeed');
  if (el) el.innerHTML = '<div class="state-loading">Searching news for ' + sym + '…</div>';
  const data = await fetchAllNews(sym);
  const articles = data.articles || [];
  _newsArticles = articles;
  renderNewsFeed(articles);
}

function setNewsFilter(cat, btn) {
  _newsFilter = cat;
  $all('.pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat === 'all'
    ? _newsArticles
    : _newsArticles.filter(a => a.category === cat || a.related?.includes(cat));
  renderNewsFeed(filtered);
}

function renderNewsFeed(articles) {
  const el = $('newsFeed');
  if (!el) return;
  if (!articles.length) {
    el.innerHTML = '<div class="state-empty">No articles found. Try searching for a symbol like AAPL, TSLA, etc.</div>';
    return;
  }
  el.innerHTML = `<div class="news-grid">${renderNewsItems(articles.slice(0, 20))}</div>`;
}

function renderNewsItems(articles) {
  return articles.map(a => {
    const d = new Date(a.datetime * 1000);
    const dateStr = d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
    const timeStr = d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
    const catLabel = a.category === 'merger' ? 'M&A' : a.category === 'forex' ? 'Forex' : a.category === 'company' ? (a.related || 'Co.') : 'Market';
    return `<div class="news-item" onclick="window.open('${a.url}','_blank')">
      ${a.image ? `<img class="ni-img" src="${a.image}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : '<div class="ni-img" style="flex-shrink:0"></div>'}
      <div class="ni-body">
        <div class="ni-meta">
          <span class="ni-source">${a.source}</span>
          &nbsp;·&nbsp; ${dateStr} ${timeStr}
          &nbsp; <span class="ni-cat">${catLabel}</span>
        </div>
        <a class="ni-hl" href="${a.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${a.headline}</a>
        ${a.summary ? `<div class="ni-sum">${a.summary.slice(0, 180)}…</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// CRYPTO PAGE
// ══════════════════════════════════════════════
async function initCrypto() {
  const el = $('cryptoGrid');
  if (el) el.innerHTML = '<div class="state-loading">Loading crypto prices from CoinGecko…</div>';
  const coins = await fetchCrypto();
  renderCrypto(coins);
}

function renderCrypto(coins) {
  const el = $('cryptoGrid');
  if (!el) return;
  if (!coins.length) {
    el.innerHTML = '<div class="state-empty">CoinGecko may be rate-limited. Wait a moment and refresh the page.</div>';
    return;
  }
  el.innerHTML = `<div class="crypto-grid">
    ${coins.map(c => {
      const chg24  = c.price_change_percentage_24h || 0;
      const chg7d  = c.price_change_percentage_7d_in_currency || 0;
      const cls24  = clsChg(chg24);
      const cls7d  = clsChg(chg7d);
      return `<div class="crypto-card">
        <div class="cc-coin">
          <img class="cc-icon" src="${c.image}" alt="${c.name}" loading="lazy"/>
          <div>
            <div class="cc-name">${c.name}</div>
            <div class="cc-sym">${c.symbol}</div>
          </div>
        </div>
        <div class="cc-price">${fmtPrice(c.current_price)}</div>
        <div class="cc-chg ${cls24}">${chg24 >= 0 ? '▲' : '▼'} ${Math.abs(chg24).toFixed(2)}% (24h)</div>
        <div class="cc-stats">
          <div class="cc-stat"><span>7d Change</span><span class="${cls7d}">${fmtPct(chg7d)}</span></div>
          <div class="cc-stat"><span>Market Cap</span>${fmtLarge(c.market_cap)}</div>
          <div class="cc-stat"><span>24h Volume</span>${fmtLarge(c.total_volume)}</div>
          <div class="cc-stat"><span>Rank</span>#${c.market_cap_rank}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}
