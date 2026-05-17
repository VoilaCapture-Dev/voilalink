// ============================================================
//  VoilaLink — Health Guard: check link URLs server-side
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { links } = req.body || {};
  if (!Array.isArray(links) || links.length === 0)
    return res.status(400).json({ error: 'No links provided' });

  const results = await Promise.all(links.map(async ({ id, url }) => {
    if (!url || !url.startsWith('http')) return { id, status: 'unknown', code: 0 };
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(url, {
        method:   'HEAD',
        signal:   ctrl.signal,
        redirect: 'follow',
        headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; VoilaLink-HealthGuard/1.0)' }
      });
      clearTimeout(timer);
      // 403/401 = bot-protected (page likely exists, not a dead link)
      if (r.status === 403 || r.status === 401) return { id, status: 'unknown', code: r.status };
      return { id, status: r.ok ? 'ok' : 'broken', code: r.status };
    } catch (e) {
      return { id, status: e.name === 'AbortError' ? 'slow' : 'broken', code: 0 };
    }
  }));

  return res.status(200).json({ results });
}
