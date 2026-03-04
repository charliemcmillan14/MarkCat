export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol   = (req.query.symbol || '').toUpperCase().trim();
  const category = req.query.category || 'general'; // general | forex | crypto | merger
  const days     = Math.min(parseInt(req.query.days || '7', 10), 30);
  const mode     = symbol ? 'company' : 'market';

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });

  const to   = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  try {
    let articles = [];

    if (mode === 'company') {
      // Company-specific news
      const r = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${key}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await r.json();
      if (Array.isArray(data)) articles = data;
    } else {
      // General market news — fetch multiple categories in parallel
      const cats = ['general', 'forex', 'merger'];
      const results = await Promise.allSettled(
        cats.map(cat =>
          fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=${key}`, { signal: AbortSignal.timeout(8000) })
            .then(r => r.json())
            .then(d => (Array.isArray(d) ? d.map(a => ({ ...a, _cat: cat })) : []))
        )
      );
      for (const r of results) {
        if (r.status === 'fulfilled') articles.push(...r.value);
      }
    }

    // Deduplicate by headline, sort newest first, limit
    const seen = new Set();
    const cleaned = articles
      .filter(a => a.headline && a.url && !seen.has(a.headline) && seen.add(a.headline))
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 30)
      .map(a => ({
        headline: a.headline,
        summary:  a.summary   || '',
        url:      a.url,
        source:   a.source    || 'Finnhub',
        datetime: a.datetime,
        image:    a.image     || null,
        category: a._cat      || (symbol ? 'company' : 'general'),
        related:  a.related   || symbol || '',
      }));

    res.status(200).json({ mode, symbol: symbol || null, articles: cleaned });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
