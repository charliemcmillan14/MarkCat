// ─────────────────────────────────────────────────────────────
// PAGES-CATS.JS — CATS Token Trading Platform
// Fully simulated crypto exchange for CATS token
// ─────────────────────────────────────────────────────────────

'use strict';

// ── CATS STATE ────────────────────────────────────────────────
const CATS = {
  // Wallet
  wallet: { usd: 10000, cats: 0 },
  // Price state
  price:     0.00842,
  priceHistory: [],     // { time, open, high, low, close, volume }
  // Order book
  asks: [],
  bids: [],
  // Trade history
  trades: [],
  // Simulation
  _tick: null,
  _candle: null,
  _candleOpen: 0,
  _candleHigh: 0,
  _candleLow:  Infinity,
  _candleStart: 0,
};

// ── INIT ──────────────────────────────────────────────────────
function initCats() {
  // Load saved state
  const saved = LS.get('cats_wallet');
  if (saved) { CATS.wallet = saved; }
  const savedTrades = LS.get('cats_trades', []);
  CATS.trades = savedTrades;

  // Seed price history with realistic looking data
  if (!CATS.priceHistory.length) seedPriceHistory();

  // Start simulation
  startCatsSim();

  renderCatsPage();
  renderCatsChart();
  renderOrderBook();
  renderTradeHistory();
  renderCatsWallet();
}

function seedPriceHistory() {
  // Build 200 candles of fake history
  let price = 0.00650 + Math.random() * 0.003;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 200; i >= 0; i--) {
    const t = now - i * 300; // 5-min candles
    const open  = price;
    const move  = (Math.random() - 0.48) * 0.0004;
    const close = Math.max(0.0001, price + move);
    const high  = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low   = Math.min(open, close) * (1 - Math.random() * 0.005);
    const vol   = 5000 + Math.random() * 50000;
    CATS.priceHistory.push({ time: t, open, high, low, close, volume: vol });
    price = close;
  }
  CATS.price = price;
}

function startCatsSim() {
  if (CATS._tick) clearInterval(CATS._tick);
  CATS._candleStart = Math.floor(Date.now() / 1000);
  CATS._candleOpen  = CATS.price;
  CATS._candleHigh  = CATS.price;
  CATS._candleLow   = CATS.price;

  // Tick every 2 seconds — realistic price movement
  CATS._tick = setInterval(() => {
    const drift    = 0.00000002; // slight upward drift
    const vol      = 0.00012;    // volatility
    const move     = (Math.random() - 0.499) * vol + drift;
    CATS.price     = Math.max(0.00001, CATS.price + move);
    CATS._candleHigh = Math.max(CATS._candleHigh, CATS.price);
    CATS._candleLow  = Math.min(CATS._candleLow,  CATS.price);

    // Close candle every 5 minutes
    const elapsed = Math.floor(Date.now() / 1000) - CATS._candleStart;
    if (elapsed >= 300) {
      CATS.priceHistory.push({
        time:   CATS._candleStart,
        open:   CATS._candleOpen,
        high:   CATS._candleHigh,
        low:    CATS._candleLow,
        close:  CATS.price,
        volume: 10000 + Math.random() * 80000,
      });
      if (CATS.priceHistory.length > 500) CATS.priceHistory.shift();
      CATS._candleStart = Math.floor(Date.now() / 1000);
      CATS._candleOpen  = CATS.price;
      CATS._candleHigh  = CATS.price;
      CATS._candleLow   = CATS.price;
    }

    // Update UI
    updateCatsPrice();
    updateOrderBook();
    checkPriceAlerts();
  }, 2000);
}

// ── RENDER ────────────────────────────────────────────────────
function renderCatsPage() {
  const el = $('catsPage');
  if (!el) return;
  const p = CATS.price;
  const prev = CATS.priceHistory.length > 1 ? CATS.priceHistory[CATS.priceHistory.length - 1].open : p;
  const chgPct = ((p - prev) / prev * 100);
  const cls = chgPct >= 0 ? 'up' : 'dn';
  const arrow = chgPct >= 0 ? '▲' : '▼';

  el.innerHTML = `
    <!-- Header -->
    <div style="display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start;margin-bottom:32px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#C9A84C,#E8C96A);display:flex;align-items:center;justify-content:center;font-size:20px">🐱</div>
          <div>
            <div style="font-family:var(--mono);font-size:10px;letter-spacing:.18em;color:var(--gold);text-transform:uppercase">CATS / USDT · Simulated Exchange</div>
            <div style="font-family:var(--serif);font-size:22px;font-weight:700">CATS Token</div>
          </div>
        </div>
        <div id="catsPriceBig" style="font-family:var(--mono);font-size:48px;font-weight:600;letter-spacing:-.02em">$${p.toFixed(5)}</div>
        <div id="catsChgBig" class="${cls}" style="font-family:var(--mono);font-size:14px;margin-top:4px">${arrow} ${Math.abs(chgPct).toFixed(2)}% &nbsp; ${chgPct >= 0 ? '+' : ''}$${(p - prev).toFixed(5)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:260px">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">24h High</div>
          <div id="catsHigh" style="font-family:var(--mono);font-size:13px;color:var(--green)">$${Math.max(...CATS.priceHistory.slice(-288).map(c=>c.high)).toFixed(5)}</div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">24h Low</div>
          <div id="catsLow" style="font-family:var(--mono);font-size:13px;color:var(--red)">$${Math.min(...CATS.priceHistory.slice(-288).map(c=>c.low)).toFixed(5)}</div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Market Cap</div>
          <div style="font-family:var(--mono);font-size:13px">$${(p * 1_000_000_000).toLocaleString('en-US',{maximumFractionDigits:0})}</div>
        </div>
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">24h Volume</div>
          <div style="font-family:var(--mono);font-size:13px">$${fmtVol(CATS.priceHistory.slice(-288).reduce((s,c)=>s+c.volume,0) * p)}</div>
        </div>
      </div>
    </div>

    <!-- Main grid: Chart + OrderBook | Trade Panel -->
    <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start">

      <!-- Left: Chart + Order Book -->
      <div>
        <!-- Chart -->
        <div class="chart-wrap" style="margin-bottom:16px">
          <div class="chart-hdr">
            <span class="chart-label">CATS/USDT · 5 Minute Candles</span>
            <div style="display:flex;gap:6px;align-items:center">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--green);animation:livePulse 2s infinite"></div>
              <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">LIVE</span>
            </div>
          </div>
          <div class="chart-canvas-wrap" style="height:300px">
            <canvas id="catsChart" style="width:100%;height:100%"></canvas>
          </div>
        </div>

        <!-- Order Book -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px">
            <div style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--red);margin-bottom:10px">Sell Orders (Asks)</div>
            <div id="catsAsks" style="font-family:var(--mono);font-size:10px"></div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px">
            <div style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--green);margin-bottom:10px">Buy Orders (Bids)</div>
            <div id="catsBids" style="font-family:var(--mono);font-size:10px"></div>
          </div>
        </div>
      </div>

      <!-- Right: Trade Panel -->
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Wallet -->
        <div id="catsWalletCard" class="card card-gold"></div>

        <!-- Buy/Sell -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
          <div style="display:grid;grid-template-columns:1fr 1fr">
            <button id="catsBuyTab"  onclick="setCatsTab('buy')"  style="padding:12px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;background:rgba(52,211,153,.1);border:none;border-bottom:2px solid var(--green);color:var(--green);cursor:pointer;text-transform:uppercase">Buy CATS</button>
            <button id="catsSellTab" onclick="setCatsTab('sell')" style="padding:12px;font-family:var(--mono);font-size:11px;letter-spacing:.1em;background:transparent;border:none;border-bottom:2px solid var(--border);color:var(--text3);cursor:pointer;text-transform:uppercase">Sell CATS</button>
          </div>
          <div style="padding:16px" id="catsTradePanel">
            ${renderBuyPanel()}
          </div>
        </div>

        <!-- Recent Trades -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px">
          <div style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">Your Trade History</div>
          <div id="catsTradeHistory" style="font-family:var(--mono);font-size:10px;max-height:200px;overflow-y:auto"></div>
        </div>
      </div>
    </div>`;

  renderTradeHistory();
  renderCatsWallet();
}

function renderBuyPanel() {
  return `
    <div style="margin-bottom:12px">
      <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">Amount (USD)</div>
      <input id="catsTradeAmt" type="number" placeholder="100" min="1" step="any"
        style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:var(--radius);font-family:var(--mono);font-size:13px;outline:none"
        oninput="updateCatsEstimate()" onfocus="this.style.borderColor='var(--green)'"/>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
      ${['25%','50%','75%','100%'].map(p => `<button onclick="setCatsPct(${parseInt(p)},'buy')" style="padding:6px;font-family:var(--mono);font-size:9px;background:var(--bg3);border:1px solid var(--border);color:var(--text3);border-radius:var(--radius);cursor:pointer">${p}</button>`).join('')}
    </div>
    <div id="catsEstimate" style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-bottom:12px;padding:10px;background:var(--bg3);border-radius:var(--radius)">
      Enter amount to see estimate
    </div>
    <button onclick="executeCatsTrade('buy')" style="width:100%;padding:13px;background:var(--green);border:none;border-radius:var(--radius);font-family:var(--mono);font-size:12px;font-weight:600;color:#080A0F;cursor:pointer;letter-spacing:.08em;text-transform:uppercase">
      Buy CATS
    </button>`;
}

function renderSellPanel() {
  return `
    <div style="margin-bottom:12px">
      <div style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">Amount (CATS)</div>
      <input id="catsTradeAmt" type="number" placeholder="1000" min="0.01" step="any"
        style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:var(--radius);font-family:var(--mono);font-size:13px;outline:none"
        oninput="updateCatsEstimate()" onfocus="this.style.borderColor='var(--red)'"/>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
      ${['25%','50%','75%','100%'].map(p => `<button onclick="setCatsPct(${parseInt(p)},'sell')" style="padding:6px;font-family:var(--mono);font-size:9px;background:var(--bg3);border:1px solid var(--border);color:var(--text3);border-radius:var(--radius);cursor:pointer">${p}</button>`).join('')}
    </div>
    <div id="catsEstimate" style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-bottom:12px;padding:10px;background:var(--bg3);border-radius:var(--radius)">
      Enter amount to see estimate
    </div>
    <button onclick="executeCatsTrade('sell')" style="width:100%;padding:13px;background:var(--red);border:none;border-radius:var(--radius);font-family:var(--mono);font-size:12px;font-weight:600;color:#fff;cursor:pointer;letter-spacing:.08em;text-transform:uppercase">
      Sell CATS
    </button>`;
}

let _catsTab = 'buy';
function setCatsTab(tab) {
  _catsTab = tab;
  const panel = $('catsTradePanel');
  if (panel) panel.innerHTML = tab === 'buy' ? renderBuyPanel() : renderSellPanel();
  const buyTab  = $('catsBuyTab');
  const sellTab = $('catsSellTab');
  if (buyTab) {
    buyTab.style.background  = tab === 'buy'  ? 'rgba(52,211,153,.1)' : 'transparent';
    buyTab.style.borderBottomColor = tab === 'buy' ? 'var(--green)' : 'var(--border)';
    buyTab.style.color = tab === 'buy' ? 'var(--green)' : 'var(--text3)';
  }
  if (sellTab) {
    sellTab.style.background = tab === 'sell' ? 'rgba(248,113,113,.1)' : 'transparent';
    sellTab.style.borderBottomColor = tab === 'sell' ? 'var(--red)' : 'var(--border)';
    sellTab.style.color = tab === 'sell' ? 'var(--red)' : 'var(--text3)';
  }
}

function setCatsPct(pct, side) {
  const inp = $('catsTradeAmt');
  if (!inp) return;
  if (side === 'buy') {
    inp.value = (CATS.wallet.usd * pct / 100).toFixed(2);
  } else {
    inp.value = (CATS.wallet.cats * pct / 100).toFixed(0);
  }
  updateCatsEstimate();
}

function updateCatsEstimate() {
  const inp = $('catsTradeAmt');
  const el  = $('catsEstimate');
  if (!inp || !el) return;
  const amt = parseFloat(inp.value) || 0;
  const fee = amt * 0.001; // 0.1% fee
  if (_catsTab === 'buy') {
    const cats = (amt - fee) / CATS.price;
    el.innerHTML = `You receive: <strong style="color:var(--green)">${cats.toFixed(0)} CATS</strong>&nbsp; Fee: $${fee.toFixed(4)}`;
  } else {
    const usd = (amt * CATS.price) * (1 - 0.001);
    el.innerHTML = `You receive: <strong style="color:var(--green)">$${usd.toFixed(4)} USD</strong>&nbsp; Fee: ${(amt*0.001).toFixed(0)} CATS`;
  }
}

function executeCatsTrade(side) {
  const inp = $('catsTradeAmt');
  const amt = parseFloat(inp?.value) || 0;
  if (amt <= 0) { toast('Enter an amount'); return; }

  if (side === 'buy') {
    const cost = amt;
    const fee  = cost * 0.001;
    const cats = (cost - fee) / CATS.price;
    if (cost > CATS.wallet.usd) { toast('Insufficient USD balance'); return; }
    CATS.wallet.usd  -= cost;
    CATS.wallet.cats += cats;
    CATS.trades.unshift({ side: 'buy', cats: +cats.toFixed(2), price: CATS.price, usd: cost, time: Date.now() });
    toast(`✓ Bought ${cats.toFixed(0)} CATS @ $${CATS.price.toFixed(5)}`, true);
  } else {
    const catsSell = amt;
    const fee = catsSell * 0.001;
    const usd = (catsSell - fee) * CATS.price;
    if (catsSell > CATS.wallet.cats) { toast('Insufficient CATS balance'); return; }
    CATS.wallet.cats -= catsSell;
    CATS.wallet.usd  += usd;
    CATS.trades.unshift({ side: 'sell', cats: catsSell, price: CATS.price, usd, time: Date.now() });
    toast(`✓ Sold ${catsSell.toFixed(0)} CATS for $${usd.toFixed(4)}`, true);
  }

  if (CATS.trades.length > 50) CATS.trades.pop();
  LS.set('cats_wallet', CATS.wallet);
  LS.set('cats_trades', CATS.trades);

  if (inp) inp.value = '';
  renderCatsWallet();
  renderTradeHistory();
}

function renderCatsWallet() {
  const el = $('catsWalletCard');
  if (!el) return;
  const portfolioVal = CATS.wallet.usd + CATS.wallet.cats * CATS.price;
  el.innerHTML = `
    <div style="font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:10px">Your Wallet</div>
    <div style="margin-bottom:12px">
      <div style="font-family:var(--mono);font-size:24px;font-weight:600;color:var(--text)">$${portfolioVal.toFixed(2)}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3)">Total value</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-family:var(--mono);font-size:11px">
      <div style="background:var(--bg3);padding:10px;border-radius:var(--radius)">
        <div style="color:var(--text3);font-size:9px;margin-bottom:3px">USD</div>
        <div>$${CATS.wallet.usd.toFixed(2)}</div>
      </div>
      <div style="background:var(--bg3);padding:10px;border-radius:var(--radius)">
        <div style="color:var(--text3);font-size:9px;margin-bottom:3px">CATS</div>
        <div>${CATS.wallet.cats.toFixed(0)}</div>
      </div>
    </div>
    <button onclick="resetCatsWallet()" style="width:100%;margin-top:10px;padding:7px;background:transparent;border:1px solid var(--border);border-radius:var(--radius);font-family:var(--mono);font-size:9px;color:var(--text3);cursor:pointer;letter-spacing:.08em">RESET WALLET ($10,000)</button>`;
}

function resetCatsWallet() {
  CATS.wallet = { usd: 10000, cats: 0 };
  CATS.trades = [];
  LS.set('cats_wallet', CATS.wallet);
  LS.set('cats_trades', CATS.trades);
  renderCatsWallet();
  renderTradeHistory();
  toast('Wallet reset to $10,000 USD');
}

function renderTradeHistory() {
  const el = $('catsTradeHistory');
  if (!el) return;
  if (!CATS.trades.length) {
    el.innerHTML = '<div style="color:var(--text3);padding:8px 0">No trades yet</div>';
    return;
  }
  el.innerHTML = CATS.trades.slice(0, 20).map(t => {
    const d = new Date(t.time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const cls = t.side === 'buy' ? 'var(--green)' : 'var(--red)';
    return `<div style="display:grid;grid-template-columns:40px 1fr 1fr;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="color:${cls};text-transform:uppercase">${t.side}</div>
      <div>${t.cats.toFixed(0)} CATS</div>
      <div style="color:var(--text3);text-align:right">${d}</div>
    </div>`;
  }).join('');
}

// ── LIVE PRICE UPDATE ─────────────────────────────────────────
function updateCatsPrice() {
  const el = $('catsPriceBig');
  if (!el) return;
  const prev = CATS.priceHistory.length > 1 ? CATS.priceHistory[CATS.priceHistory.length - 1].open : CATS.price;
  const chgPct = ((CATS.price - prev) / prev * 100);
  const cls = chgPct >= 0 ? 'var(--green)' : 'var(--red)';
  el.textContent = '$' + CATS.price.toFixed(5);
  el.style.color = cls;

  const chgEl = $('catsChgBig');
  if (chgEl) {
    const arrow = chgPct >= 0 ? '▲' : '▼';
    chgEl.textContent = `${arrow} ${Math.abs(chgPct).toFixed(2)}%`;
    chgEl.className = chgPct >= 0 ? 'up' : 'dn';
  }

  // Update estimate if panel open
  updateCatsEstimate();
}

// ── ORDER BOOK ────────────────────────────────────────────────
function updateOrderBook() {
  renderOrderBook();
}

function renderOrderBook() {
  const asks = $('catsAsks');
  const bids = $('catsBids');
  if (!asks || !bids) return;

  const spread = CATS.price * 0.0015;
  const askRows = Array.from({length:8}, (_,i) => ({
    price: CATS.price + spread + i * CATS.price * 0.001,
    size:  (5000 + Math.random() * 50000) | 0,
  }));
  const bidRows = Array.from({length:8}, (_,i) => ({
    price: CATS.price - spread - i * CATS.price * 0.001,
    size:  (5000 + Math.random() * 50000) | 0,
  }));

  asks.innerHTML = askRows.map(r => `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(28,34,53,.3)">
      <span style="color:var(--red)">$${r.price.toFixed(5)}</span>
      <span style="color:var(--text3)">${r.size.toLocaleString()}</span>
    </div>`).join('');

  bids.innerHTML = bidRows.map(r => `
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(28,34,53,.3)">
      <span style="color:var(--green)">$${r.price.toFixed(5)}</span>
      <span style="color:var(--text3)">${r.size.toLocaleString()}</span>
    </div>`).join('');
}

// ── CHART ─────────────────────────────────────────────────────
let _catsChart = null;

function renderCatsChart() {
  setTimeout(() => {
    const cv = $('catsChart');
    if (!cv) return;
    if (_catsChart) _catsChart.destroy();

    const history = CATS.priceHistory.slice(-100);
    const labels  = history.map(c => new Date(c.time * 1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}));
    const prices  = history.map(c => c.close);
    const color   = prices[prices.length-1] >= prices[0] ? '#34D399' : '#F87171';

    _catsChart = new Chart(cv.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [lineDataset(prices, color)] },
      options: {
        ...chartDefaults(),
        plugins: {
          ...chartDefaults().plugins,
          tooltip: { ...chartDefaults().plugins.tooltip, callbacks: { label: ctx => ' $' + ctx.parsed.y.toFixed(5) } }
        },
        scales: {
          x: { ...chartDefaults().scales.x, ticks: { ...chartDefaults().scales.x.ticks, maxTicksLimit: 6 } },
          y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: v => '$' + v.toFixed(4) } }
        }
      }
    });

    // Refresh chart every 30s with latest data
    if (CATS._candle) clearInterval(CATS._candle);
    CATS._candle = setInterval(() => {
      if (!_catsChart) return;
      const h = CATS.priceHistory.slice(-100);
      _catsChart.data.labels = h.map(c => new Date(c.time*1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}));
      _catsChart.data.datasets[0].data = h.map(c => c.close);
      _catsChart.update('none');
    }, 30000);
  }, 100);
}

// ── PRICE ALERTS ──────────────────────────────────────────────
function checkPriceAlerts() {
  const alerts = LS.get('cats_alerts', []);
  if (!alerts.length) return;
  alerts.forEach((a, i) => {
    if (a.triggered) return;
    if ((a.type === 'above' && CATS.price >= a.target) ||
        (a.type === 'below' && CATS.price <= a.target)) {
      toast(`🔔 CATS alert: price ${a.type === 'above' ? 'reached' : 'dropped to'} $${a.target.toFixed(5)}`, true);
      alerts[i].triggered = true;
    }
  });
  LS.set('cats_alerts', alerts);
}
