// ─────────────────────────────────────────────────────────────
// PAGES-WATCHLIST.JS — Watchlist + Price Alerts
// ─────────────────────────────────────────────────────────────
'use strict';

let _watchlist = [];
let _alerts    = [];
let _watchRefresh = null;

function initWatchlist() {
  _watchlist = LS.get('watchlist', ['AAPL','TSLA','NVDA','AMZN','META']);
  _alerts    = LS.get('price_alerts', []);
  renderWatchlist();
  renderAlerts();
  // Refresh every 60s
  if (_watchRefresh) clearInterval(_watchRefresh);
  _watchRefresh = setInterval(refreshWatchlist, 60000);
}

async function addToWatchlist() {
  const inp = $('watchInput');
  const sym = (inp?.value || '').trim().toUpperCase();
  if (!sym) return;
  if (_watchlist.includes(sym)) { toast(sym + ' already in watchlist'); return; }
  toast('Adding ' + sym + '…');
  const q = await fetchQuote(sym);
  if (!q || !q.price) { toast(sym + ' not found'); return; }
  _watchlist.push(sym);
  LS.set('watchlist', _watchlist);
  if (inp) inp.value = '';
  renderWatchlist();
  toast(sym + ' added to watchlist ✓', true);
}

function removeFromWatchlist(sym) {
  _watchlist = _watchlist.filter(s => s !== sym);
  LS.set('watchlist', _watchlist);
  renderWatchlist();
}

async function refreshWatchlist() {
  if (!_watchlist.length) return;
  await Promise.allSettled(_watchlist.map(s => fetchQuote(s)));
  renderWatchlist();
}

function renderWatchlist() {
  const el = $('watchlistTable');
  if (!el) return;
  if (!_watchlist.length) {
    el.innerHTML = '<div class="state-empty">Your watchlist is empty. Add symbols above.</div>';
    return;
  }
  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
      <table class="tbl">
        <thead><tr>
          <th>Symbol</th><th>Price</th><th>Change</th><th>High</th><th>Low</th><th>Alert</th><th></th>
        </tr></thead>
        <tbody>
          ${_watchlist.map(sym => {
            const q = LQ[sym];
            const cls = q ? clsChg(q.changePct) : '';
            const arrow = q && q.changePct >= 0 ? '▲' : '▼';
            const alert = _alerts.find(a => a.symbol === sym && !a.triggered);
            return `<tr>
              <td><span class="tbl-sym" onclick="goQuote('${sym}')" style="cursor:pointer">${sym}</span></td>
              <td>${q ? fmtPrice(q.price) : '<span style="color:var(--text3)">—</span>'}</td>
              <td class="${cls}">${q ? arrow + ' ' + fmtPct(q.changePct) : '—'}</td>
              <td style="color:var(--green)">${q ? fmtPrice(q.high) : '—'}</td>
              <td style="color:var(--red)">${q ? fmtPrice(q.low) : '—'}</td>
              <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">
                ${alert ? `<span style="color:var(--gold)">🔔 ${alert.type} $${alert.target.toFixed(2)}</span>` : '<span style="color:var(--border2)">No alert</span>'}
              </td>
              <td>
                <button onclick="removeFromWatchlist('${sym}')" class="port-remove">✕</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── PRICE ALERTS ──────────────────────────────────────────────
function addAlert() {
  const sym    = ($('alertSym')?.value   || '').trim().toUpperCase();
  const target = parseFloat($('alertTarget')?.value || '0');
  const type   = $('alertType')?.value || 'above';
  if (!sym || !target) { toast('Fill in symbol and target price'); return; }

  // Add to watchlist if not there
  if (!_watchlist.includes(sym)) {
    _watchlist.push(sym);
    LS.set('watchlist', _watchlist);
  }

  _alerts.push({ symbol: sym, target, type, triggered: false, created: Date.now() });
  LS.set('price_alerts', _alerts);
  renderAlerts();
  renderWatchlist();

  if ($('alertSym'))    $('alertSym').value    = '';
  if ($('alertTarget')) $('alertTarget').value = '';
  toast(`Alert set: ${sym} ${type} $${target.toFixed(2)} ✓`, true);
}

function removeAlert(i) {
  _alerts.splice(i, 1);
  LS.set('price_alerts', _alerts);
  renderAlerts();
  renderWatchlist();
}

function renderAlerts() {
  const el = $('alertsList');
  if (!el) return;
  const active    = _alerts.filter(a => !a.triggered);
  const triggered = _alerts.filter(a => a.triggered);

  if (!_alerts.length) {
    el.innerHTML = '<div class="state-empty">No alerts set. Use the form above to create one.</div>';
    return;
  }

  el.innerHTML = `
    ${active.length ? `
      <div class="sec-title"><em>//</em> Active Alerts (${active.length})</div>
      <div style="display:grid;gap:8px;margin-bottom:24px">
        ${active.map((a, i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--bg2);border:1px solid rgba(201,168,76,.2);border-radius:var(--radius)">
            <div style="display:flex;gap:16px;align-items:center">
              <span style="font-family:var(--mono);font-size:12px;color:var(--gold);font-weight:600">${a.symbol}</span>
              <span style="font-family:var(--mono);font-size:11px;color:var(--text2)">${a.type === 'above' ? 'rises above' : 'drops below'}</span>
              <span style="font-family:var(--mono);font-size:13px;font-weight:600">${fmtPrice(a.target)}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">${new Date(a.created).toLocaleDateString()}</span>
              <button onclick="removeAlert(${_alerts.indexOf(a)})" class="port-remove">✕</button>
            </div>
          </div>`).join('')}
      </div>` : ''}
    ${triggered.length ? `
      <div class="sec-title"><em>//</em> Triggered (${triggered.length})</div>
      <div style="display:grid;gap:8px">
        ${triggered.map((a) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);opacity:.5">
            <span style="font-family:var(--mono);font-size:12px">✓ ${a.symbol} ${a.type} ${fmtPrice(a.target)}</span>
            <button onclick="removeAlert(${_alerts.indexOf(a)})" class="port-remove">✕</button>
          </div>`).join('')}
      </div>` : ''}`;
}

// Check alerts against live prices (called from ticker refresh)
function checkAllAlerts() {
  let changed = false;
  _alerts.forEach((a, i) => {
    if (a.triggered) return;
    const q = LQ[a.symbol];
    if (!q || !q.price) return;
    if ((a.type === 'above' && q.price >= a.target) ||
        (a.type === 'below' && q.price <= a.target)) {
      _alerts[i].triggered = true;
      changed = true;
      toast(`🔔 ${a.symbol} alert: price ${a.type === 'above' ? 'reached' : 'dropped to'} ${fmtPrice(a.target)}`, true);
    }
  });
  if (changed) {
    LS.set('price_alerts', _alerts);
    renderAlerts();
    renderWatchlist();
  }
}
