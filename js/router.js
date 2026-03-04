// ─────────────────────────────────────────────────────────────
// ROUTER.JS — page navigation + keyboard shortcuts
// ─────────────────────────────────────────────────────────────
'use strict';

const PAGES = [
  'home','markets','quote','news','crypto',
  'sentiment','earnings','portfolio','simulator',
  'cats','watchlist','heatmap','macro','sector'
];
const _inited = {};

function go(name) {
  if (!PAGES.includes(name)) return;

  PAGES.forEach(p => {
    const el = $('page-' + p);
    if (el) el.classList.toggle('active', p === name);
  });

  $all('.nb').forEach(b => {
    b.classList.toggle('active', b.dataset.page === name);
  });

  window.scrollTo(0, 0);

  if (!_inited[name]) {
    _inited[name] = true;
    _initPage(name);
  } else if (name === 'home') {
    renderHomeTiles();
  } else if (name === 'watchlist') {
    renderWatchlist();
    renderAlerts();
  }

  window.location.hash = name;
}

async function _initPage(name) {
  switch (name) {
    case 'home':       await initHome();       break;
    case 'markets':    await initMarkets();    break;
    case 'quote':      initQuotePage();        break;
    case 'news':       await initNews();       break;
    case 'crypto':     await initCrypto();     break;
    case 'sentiment':  await initSentiment();  break;
    case 'earnings':   await initEarnings();   break;
    case 'portfolio':  initPortfolio();        break;
    case 'simulator':  initSimulator();        break;
    case 'cats':       initCats();             break;
    case 'watchlist':  initWatchlist();        break;
    case 'heatmap':    await initHeatmap();    break;
    case 'macro':      await initMacro();      break;
    case 'sector':     await initSector();     break;
  }
}

async function goQuote(symbol) {
  go('quote');
  const inp = $('quoteInput');
  if (inp) inp.value = symbol;
  await renderQuote(symbol);
}

async function goSector(key) {
  _currentSector = key;
  _inited['sector'] = false;
  go('sector');
}

function handleHash() {
  const hash = window.location.hash.replace('#','');
  if (hash && PAGES.includes(hash)) go(hash);
  else go('home');
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const map = {
    '1':'home','2':'markets','3':'quote','4':'news',
    '5':'crypto','6':'cats','7':'sentiment','8':'earnings',
    '9':'heatmap','0':'watchlist',
  };
  if (map[e.key]) go(map[e.key]);
  if (e.key === 'm') go('macro');
  if (e.key === 'p') go('portfolio');
  if (e.key === 's') go('simulator');
});
