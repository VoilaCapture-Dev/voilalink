// ============================================================
//  VoilaLink — Media Kit SSR
//  Generates a public, shareable media kit page for any user
// ============================================================
const SUPABASE_URL  = 'https://lquuojhirwnhqkcgsgft.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxdXVvamhpcnduaHFrY2dzZ2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDMxNjcsImV4cCI6MjA5MzQ3OTE2N30.-uCCTQGw12P03kDg4-xK8PC1nkrY8hqx4CUXMN7xgyw';

const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const username = (req.query.username || '').trim().toLowerCase();
  if (!username) return res.status(400).send('No username');

  const headers = {
    apikey:        SUPABASE_ANON,
    Authorization: `Bearer ${SUPABASE_ANON}`,
  };

  // ── Fetch profile ──────────────────────────────────────────
  let profile = null;
  let links   = [];
  let totalClicks = null;

  try {
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}` +
      `&select=id,username,full_name,bio,avatar_url,og_image_url,created_at,is_pro`,
      { headers }
    );
    const rows = await pr.json();
    profile = Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (_) {}

  if (!profile) {
    return res.status(404).send('<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px;background:#0a0a0f;color:#f0f0f5"><h2>Profile not found</h2><a href="https://voilalink.com" style="color:#818cf8">← Back to VoilaLink</a></body></html>');
  }

  // ── Fetch active links ─────────────────────────────────────
  try {
    const lr = await fetch(
      `${SUPABASE_URL}/rest/v1/links?user_id=eq.${profile.id}&enabled=eq.true&order=position.asc`,
      { headers }
    );
    const rows = await lr.json();
    links = Array.isArray(rows) ? rows : [];
  } catch (_) {}

  // ── Try to get total clicks via RPC ───────────────────────
  try {
    const cr = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_public_profile_stats`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_username: username }),
      }
    );
    if (cr.ok) {
      const stats = await cr.json();
      if (stats && typeof stats.total_clicks === 'number') {
        totalClicks = stats.total_clicks;
      }
    }
  } catch (_) {}

  // ── Build page ─────────────────────────────────────────────
  const name       = profile.full_name || username;
  const bio        = profile.bio || '';
  const avatar     = profile.avatar_url || '';
  const ogImage    = profile.og_image_url || '';
  const isPro      = profile.is_pro || false;
  const memberYear = profile.created_at
    ? new Date(profile.created_at).getFullYear()
    : new Date().getFullYear();
  const pageUrl    = `https://voilalink.com/${encodeURIComponent(username)}/mediakit`;
  const bioUrl     = `https://voilalink.com/${encodeURIComponent(username)}`;
  const initials   = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  // Avatar HTML
  const avatarHtml = avatar
    ? `<img src="${esc(avatar)}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="font-size:36px;font-weight:800;font-family:'Syne',sans-serif;">${esc(initials)}</span>`;

  // Links HTML
  const linksHtml = links.length === 0
    ? `<p style="text-align:center;color:#7878a0;padding:32px 0;">No public links yet.</p>`
    : links.map(l => `
      <a href="${esc(l.url)}" target="_blank" rel="noopener" class="link-card">
        <span class="link-emoji">${esc(l.emoji || '🔗')}</span>
        <span class="link-title">${esc(l.title || l.url)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4;flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>`).join('');

  // Stats
  const clicksStat = totalClicks !== null
    ? totalClicks.toLocaleString()
    : '—';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(name)} | Media Kit · VoilaLink</title>
  <meta name="description" content="${esc(bio || `Check out ${name}'s media kit on VoilaLink`)}" />
  <meta property="og:title"       content="${esc(name)} | Media Kit" />
  <meta property="og:description" content="${esc(bio || `Links and stats for ${name}`)}" />
  <meta property="og:url"         content="${esc(pageUrl)}" />
  <meta property="og:type"        content="website" />
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}" />` : ''}
  <meta name="twitter:card"       content="${ogImage ? 'summary_large_image' : 'summary'}" />
  <link rel="icon" type="image/png" href="/icons/icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0a0f;
      color: #f0f0f5;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      padding: 0 0 80px;
    }

    /* ── Top bar ── */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .topbar-logo {
      font-family: 'Syne', sans-serif;
      font-size: 16px;
      font-weight: 800;
      color: #818cf8;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .topbar-logo::before {
      content: '';
      width: 8px; height: 8px;
      background: #818cf8;
      border-radius: 50%;
      display: inline-block;
    }
    .view-profile-btn {
      padding: 7px 16px;
      background: rgba(129,140,248,0.12);
      border: 1px solid rgba(129,140,248,0.3);
      border-radius: 20px;
      color: #818cf8;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s;
    }
    .view-profile-btn:hover { background: rgba(129,140,248,0.2); }

    /* ── Hero ── */
    .hero {
      background: linear-gradient(135deg, #0f0f1e 0%, #13131a 50%, #0a0a0f 100%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding: 56px 24px 48px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -60px; left: 50%; transform: translateX(-50%);
      width: 400px; height: 200px;
      background: radial-gradient(ellipse, rgba(129,140,248,0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .avatar-ring {
      width: 100px; height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, #818cf8, #a78bfa);
      padding: 3px;
      margin: 0 auto 20px;
      position: relative;
    }
    .avatar-inner {
      width: 100%; height: 100%;
      border-radius: 50%;
      background: #1a1a30;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      color: #f0f0f5;
    }
    .hero-name {
      font-family: 'Syne', sans-serif;
      font-size: 30px;
      font-weight: 800;
      color: #f0f0f5;
      margin-bottom: 6px;
    }
    .hero-handle {
      font-size: 14px;
      color: #818cf8;
      margin-bottom: 16px;
      font-weight: 500;
    }
    .pro-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg,#f59e0b,#f97316);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 3px 8px;
      border-radius: 20px;
      margin-bottom: 12px;
    }
    .hero-bio {
      max-width: 480px;
      margin: 0 auto;
      font-size: 15px;
      color: #a0a0c0;
      line-height: 1.6;
    }

    /* ── Stats ── */
    .stats-wrap {
      max-width: 680px;
      margin: -1px auto 0;
      padding: 0 16px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      transform: translateY(-24px);
    }
    .stat-card {
      background: #13131a;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 20px 16px;
      text-align: center;
    }
    .stat-value {
      font-family: 'Syne', sans-serif;
      font-size: 26px;
      font-weight: 800;
      color: #f0f0f5;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 11px;
      color: #7878a0;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ── Content ── */
    .content {
      max-width: 680px;
      margin: 0 auto;
      padding: 0 16px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      color: #7878a0;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 12px;
    }

    /* ── Links ── */
    .link-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #13131a;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 8px;
      text-decoration: none;
      color: #f0f0f5;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .link-card:hover {
      background: #1a1a24;
      border-color: rgba(129,140,248,0.3);
      transform: translateY(-1px);
    }
    .link-emoji {
      font-size: 20px;
      flex-shrink: 0;
      width: 32px;
      text-align: center;
    }
    .link-title {
      flex: 1;
      font-size: 14px;
      font-weight: 600;
      color: #e0e0f0;
    }

    /* ── Footer ── */
    .footer {
      max-width: 680px;
      margin: 48px auto 0;
      padding: 0 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .footer-brand {
      font-size: 13px;
      color: #7878a0;
    }
    .footer-brand strong {
      color: #818cf8;
    }
    .footer-cta {
      padding: 9px 20px;
      background: linear-gradient(135deg, #818cf8, #a78bfa);
      border-radius: 20px;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .footer-cta:hover { opacity: 0.85; }

    /* ── Share bar ── */
    .share-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 8px 0 0;
      flex-wrap: wrap;
    }
    .share-btn {
      padding: 8px 18px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      color: #a0a0c0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .share-btn:hover { background: rgba(255,255,255,0.1); color: #f0f0f5; }

    @media (max-width: 480px) {
      .hero { padding: 40px 16px 36px; }
      .hero-name { font-size: 24px; }
      .stats-grid { grid-template-columns: repeat(3,1fr); gap: 8px; }
      .stat-value { font-size: 20px; }
      .footer { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>

  <!-- Top bar -->
  <nav class="topbar">
    <a href="https://voilalink.com" class="topbar-logo">VoilaLink</a>
    <a href="${esc(bioUrl)}" class="view-profile-btn">View Profile →</a>
  </nav>

  <!-- Hero -->
  <div class="hero">
    <div class="avatar-ring">
      <div class="avatar-inner">${avatarHtml}</div>
    </div>
    <h1 class="hero-name">${esc(name)}</h1>
    <p class="hero-handle">@${esc(username)} · voilalink.com/${esc(username)}</p>
    ${isPro ? '<div class="pro-badge">⚡ PRO</div>' : ''}
    ${bio ? `<p class="hero-bio">${esc(bio)}</p>` : ''}
  </div>

  <!-- Stats -->
  <div class="stats-wrap">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${esc(clicksStat)}</div>
        <div class="stat-label">Total Clicks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${links.length}</div>
        <div class="stat-label">Active Links</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${memberYear}</div>
        <div class="stat-label">Member Since</div>
      </div>
    </div>
  </div>

  <!-- Links -->
  <div class="content">
    <div class="section-title">🔗 My Links</div>
    ${linksHtml}

    <!-- Share bar -->
    <div style="margin-top:32px;text-align:center;">
      <div class="section-title" style="margin-bottom:12px;">Share This Media Kit</div>
      <div class="share-bar">
        <button class="share-btn" onclick="copyLink()">📋 Copy Link</button>
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(`Check out ${name}'s media kit`)}" target="_blank" class="share-btn">𝕏 Share on X</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}" target="_blank" class="share-btn">in LinkedIn</a>
      </div>
      <div id="copy-toast" style="margin-top:10px;font-size:12px;color:#818cf8;display:none;">✓ Link copied!</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p class="footer-brand">Powered by <strong>VoilaLink</strong> — Your link-in-bio, built your way.</p>
    <a href="https://voilalink.com" class="footer-cta">Create Yours Free →</a>
  </div>

  <script>
    function copyLink() {
      navigator.clipboard.writeText('${pageUrl}').then(() => {
        const t = document.getElementById('copy-toast');
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2500);
      });
    }
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  return res.status(200).send(html);
}
