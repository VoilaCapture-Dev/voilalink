// ============================================================
//  VoilaLink — Linktree Import
//  Fetches a Linktree page server-side, parses link data,
//  and returns a clean JSON array of links to import.
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'No URL provided' });
  }

  // ── Validate it's a Linktree URL ──────────────────────────
  let parsedUrl;
  try { parsedUrl = new URL(url.trim()); } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (!parsedUrl.hostname.includes('linktr.ee') && !parsedUrl.hostname.includes('linktree')) {
    return res.status(400).json({ error: 'Please provide a linktr.ee URL' });
  }

  // ── Fetch the Linktree page ───────────────────────────────
  let html = '';
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(parsedUrl.href, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    clearTimeout(timer);
    if (!r.ok) return res.status(502).json({ error: `Linktree returned ${r.status}. The page may be private or not exist.` });
    html = await r.text();
  } catch (e) {
    return res.status(502).json({ error: e.name === 'AbortError' ? 'Linktree took too long to respond.' : 'Could not reach Linktree.' });
  }

  // ── Parse __NEXT_DATA__ ───────────────────────────────────
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!match) {
    return res.status(422).json({ error: 'Could not read Linktree data. The page may use a format we cannot import.' });
  }

  let nextData;
  try { nextData = JSON.parse(match[1]); } catch {
    return res.status(422).json({ error: 'Could not parse Linktree data.' });
  }

  // ── Extract links (handles multiple Linktree formats) ─────
  const pageProps = nextData?.props?.pageProps || {};

  // Format 1: account.links
  const account = pageProps.account || pageProps.profile || {};
  let rawLinks = account.links || account.content || [];

  // Format 2: links at top level
  if (!rawLinks.length) rawLinks = pageProps.links || [];

  // Format 3: newer "content" nested structure
  if (!rawLinks.length && Array.isArray(account.content)) {
    rawLinks = account.content;
  }

  if (!rawLinks.length) {
    return res.status(422).json({ error: 'No links found on this Linktree page. The profile may be empty or use an unsupported format.' });
  }

  // ── Normalise links ───────────────────────────────────────
  const EMOJI_MAP = {
    'instagram': '📸', 'twitter': '🐦', 'youtube': '▶️', 'tiktok': '🎵',
    'facebook': '👥', 'linkedin': '💼', 'spotify': '🎧', 'soundcloud': '🎶',
    'github': '💻', 'discord': '🎮', 'twitch': '🎮', 'patreon': '❤️',
    'etsy': '🛍', 'amazon': '📦', 'shop': '🛒', 'store': '🛒',
    'podcast': '🎙', 'blog': '📝', 'website': '🌐', 'book': '📚',
    'email': '📧', 'contact': '📬', 'donate': '💝', 'paypal': '💳',
  };

  function guessEmoji(title, url) {
    const text = ((title || '') + ' ' + (url || '')).toLowerCase();
    for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
      if (text.includes(key)) return emoji;
    }
    return '🔗';
  }

  const links = rawLinks
    .filter(l => l && (l.url || l.directUrl) && l.type !== 'HEADER')
    .map((l, i) => ({
      title:    l.title || l.displayText || l.label || 'Link',
      url:      l.url || l.directUrl || l.destination || '',
      emoji:    guessEmoji(l.title, l.url || l.directUrl),
      position: l.position ?? i,
    }))
    .filter(l => l.url.startsWith('http'));

  if (!links.length) {
    return res.status(422).json({ error: 'No valid links could be extracted.' });
  }

  // ── Profile info (bonus) ──────────────────────────────────
  const profileName = account.pageTitle || account.name || account.username || null;
  const profileBio  = account.description || account.bio || null;

  return res.status(200).json({
    links,
    profile: { name: profileName, bio: profileBio },
    count: links.length,
  });
}
