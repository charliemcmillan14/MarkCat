// ─────────────────────────────────────────────────────────────
// DATA.JS — all fetch calls to /api/* and CoinGecko
// ─────────────────────────────────────────────────────────────

'use strict';

// Live quote cache: LQ['AAPL'] = { symbol, price, changePct, ... }
const LQ = {};

async function apiFetch(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return r.json();
}

// ── STOCKS ────────────────────────────────────────────────────
async function fetchMovers() {
  try {
    const data = await apiFetch('/api/movers');
    if (Array.isArray(data)) {
      data.forEach(q => { LQ[q.symbol] = q; });
    }
    return data || [];
  } catch (e) {
    console.warn('fetchMovers:', e.message);
    return [];
  }
}

async function fetchQuote(symbol) {
  try {
    const d = await apiFetch('/api/quote?symbol=' + encodeURIComponent(symbol));
    if (d.price) LQ[symbol] = d;
    return d;
  } catch (e) {
    console.warn('fetchQuote:', e.message);
    return null;
  }
}

async function fetchCandles(symbol, days = 90, resolution = 'D') {
  try {
    const d = await apiFetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&days=${days}&resolution=${resolution}`);
    return d.candles || [];
  } catch (e) {
    console.warn('fetchCandles:', e.message);
    return [];
  }
}

// ── NEWS ──────────────────────────────────────────────────────
async function fetchCompanyNews(symbol) {
  try {
    const d = await apiFetch(`/api/news?symbol=${encodeURIComponent(symbol)}&days=7`);
    return d.articles || [];
  } catch (e) {
    console.warn('fetchCompanyNews:', e.message);
    return [];
  }
}

async function fetchMarketNews() {
  try {
    const d = await apiFetch('/api/news?days=3');
    return d.articles || [];
  } catch (e) {
    console.warn('fetchMarketNews:', e.message);
    return [];
  }
}

// ── PREMIUM FEATURES ──────────────────────────────────────────
async function fetchSentiment() {
  try {
    return await apiFetch('/api/sentiment');
  } catch (e) {
    console.warn('fetchSentiment:', e.message);
    return null;
  }
}

async function fetchEarnings() {
  try {
    return await apiFetch('/api/earnings');
  } catch (e) {
    console.warn('fetchEarnings:', e.message);
    return null;
  }
}

// ── CRYPTO (CoinGecko — no key needed) ────────────────────────
async function fetchCrypto() {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets' +
      '?vs_currency=usd&ids=bitcoin,ethereum,solana,dogecoin,cardano,avalanche-2,chainlink,polkadot' +
      '&order=market_cap_desc&per_page=8&page=1&sparkline=false&price_change_percentage=24h,7d'
    );
    if (!r.ok) throw new Error('CoinGecko ' + r.status);
    return await r.json();
  } catch (e) {
    console.warn('fetchCrypto:', e.message);
    return [];
  }
}

// ── NEWS-ALL (multi-source) ───────────────────────────────────
async function fetchAllNews(symbol) {
  try {
    const url = symbol ? `/api/news-all?symbol=${encodeURIComponent(symbol)}` : '/api/news-all';
    return await apiFetch(url);
  } catch (e) {
    console.warn('fetchAllNews:', e.message);
    return { articles: [], sources: [] };
  }
}

// ── TECHNICALS ────────────────────────────────────────────────
async function fetchTechnicals(symbol, days, resolution) {
  try {
    return await apiFetch(`/api/technicals?symbol=${encodeURIComponent(symbol)}&days=${days||90}&resolution=${resolution||'D'}`);
  } catch (e) {
    console.warn('fetchTechnicals:', e.message);
    return null;
  }
}

