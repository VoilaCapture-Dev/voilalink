// ============================================================
//  VoilaLink — Bio page SSR for OG / social meta tags
//  Fetches profile server-side and pre-fills <head> meta tags
//  so crawlers (WhatsApp, Twitter, LinkedIn…) see real data.
// ============================================================
import fs   from 'fs';
import path from 'path';

const SUPABASE_URL  = 'https://lquuojhirwnhqkcgsgft.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxdXVvamhpcnduaHFrY2dzZ2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDMxNjcsImV4cCI6MjA5MzQ3OTE2N30.-uCCTQGw12P03kDg4-xK8PC1nkrY8hqx4CUXMN7xgyw';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const username = (req.query.username || '').trim().toLowerCase();
  if (!username) return res.status(400).send('No username');

  // ── 1. Fetch profile from Supabase (server-side, no JS needed) ──
  let profile = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles` +
      `?username=eq.${encodeURIComponent(username)}` +
      `&select=full_name,bio,og_image_url,seo_title,seo_description`,
      {
        headers: {
          apikey:        SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
      }
    );
    const rows = await r.json();
    profile = Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (_) { /* fall through — serve plain bio.html */ }

  // ── 2. Read bio.html from disk ──
  let html;
  try {
    html = fs.readFileSync(path.join(process.cwd(), 'bio.html'), 'utf-8');
  } catch (e) {
    return res.status(500).send('Template read error');
  }

  // ── 3. Inject real values into the <head> ──
  if (profile) {
    const name        = profile.full_name        || username;
    const title       = profile.seo_title        || name;
    const description = profile.seo_description  || profile.bio
                        || `Check out ${name}'s links on VoilaLink`;
    const ogImage     = profile.og_image_url     || '';
    const pageUrl     = `https://voilalink.com/${encodeURIComponent(username)}`;

    const esc = s => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Replace <title>
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)} | VoilaLink</title>`);

    // Replace content="" on meta tags that have a matching id=""
    // Works regardless of attribute order inside the <meta> tag
    const setMeta = (h, id, value) => {
      // id before content
      h = h.replace(
        new RegExp(`(<meta[^>]+id="${id}"[^>]+content=")[^"]*(")`),
        `$1${esc(value)}$2`
      );
      // content before id
      h = h.replace(
        new RegExp(`(<meta[^>]+content=")[^"]*("[^>]+id="${id}")`),
        `$1${esc(value)}$2`
      );
      return h;
    };

    html = setMeta(html, 'meta-description', description);
    html = setMeta(html, 'og-title',         title);
    html = setMeta(html, 'og-description',   description);
    html = setMeta(html, 'og-url',           pageUrl);

    if (ogImage) {
      html = setMeta(html, 'og-image',     ogImage);
      html = setMeta(html, 'twitter-image', ogImage);
      html = setMeta(html, 'twitter-card',  'summary_large_image');
    }
  }

  // ── 4. Return pre-rendered HTML ──
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache 30 s on CDN edge, serve stale while revalidating
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).send(html);
}
