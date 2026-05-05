// ============================================================
//  VoilaLink — Public bio page (bio.html)
// ============================================================
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // Get username from ?u=param or from clean URL path /username
  const params   = new URLSearchParams(window.location.search);
  const username = params.get('u') ||
    window.location.pathname.replace(/^\//, '').replace(/\.html$/, '') || null;

  if (!username) {
    showError('No username specified.');
    return;
  }

  try {
    const profile = await getProfileByUsername(username);
    const links   = await getPublicLinks(profile.id);
    renderBio(profile, links);
    applyTheme(profile.theme || 'midnight');
  } catch (e) {
    console.error('Bio page error:', e);
    showError('Page not found.');
  }
});

// ── Render bio ───────────────────────────────────────────────
function renderBio(profile, links) {
  // Avatar / name
  document.getElementById('bio-avatar').textContent   = (profile.full_name || profile.username)[0].toUpperCase();
  document.getElementById('bio-name').textContent     = profile.full_name || profile.username;
  document.getElementById('bio-handle').textContent   = '@' + profile.username;
  document.getElementById('bio-bio').textContent      = profile.bio || '';
  document.title = (profile.full_name || profile.username) + ' — VoilaLink';

  // Links
  const container = document.getElementById('bio-links');
  container.innerHTML = '';

  if (links.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:32px 0;">No links added yet.</p>';
    return;
  }

  links.forEach(link => {
    const a = document.createElement('a');
    a.className = 'link-card';
    a.href = '#';
    a.onclick = (e) => { e.preventDefault(); handleClick(link); };
    a.innerHTML = `
      <div class="link-icon" style="background:rgba(129,140,248,0.12);">${link.emoji || '🔗'}</div>
      <div class="link-text">
        <div class="link-title">${escHtml(link.title)}</div>
        ${link.description ? `<div class="link-desc">${escHtml(link.description)}</div>` : ''}
      </div>
      <div class="link-arrow">→</div>`;
    container.appendChild(a);
  });
}

// ── Click tracking ───────────────────────────────────────────
async function handleClick(link) {
  // Track click in background — don't await so page feels instant
  trackClick(link.id).catch(() => {});
  // Open link
  window.open(link.url, '_blank', 'noopener,noreferrer');
}

// ── Themes ───────────────────────────────────────────────────
const themes = {
  midnight: { bg: '#08080f', surface: '#13131a', card: '#1a1a24', accent: '#818cf8', accent2: '#a78bfa' },
  ocean:    { bg: '#0a1628', surface: '#0f2040', card: '#132850', accent: '#38bdf8', accent2: '#818cf8' },
  lime:     { bg: '#0a0f0a', surface: '#0d140d', card: '#111a11', accent: '#c8f135', accent2: '#4ade80' },
  light:    { bg: '#f8f8fc', surface: '#ffffff', card: '#f0f0f8', accent: '#6366f1', accent2: '#a78bfa' },
  galaxy:   { bg: '#0d0520', surface: '#160a30', card: '#1e1040', accent: '#d946ef', accent2: '#a78bfa' },
  sunset:   { bg: '#0f0a05', surface: '#1a1005', card: '#221508', accent: '#f59e0b', accent2: '#ef4444' },
};

function applyTheme(name) {
  const t = themes[name] || themes.midnight;
  const root = document.documentElement;
  root.style.setProperty('--bg',       t.bg);
  root.style.setProperty('--surface',  t.surface);
  root.style.setProperty('--card',     t.card);
  root.style.setProperty('--accent',   t.accent);
  root.style.setProperty('--accent-2', t.accent2);
  if (name === 'light') {
    root.style.setProperty('--text-primary', '#111118');
    root.style.setProperty('--text-muted',   '#66668a');
    root.style.setProperty('--border',       'rgba(0,0,0,0.08)');
  }
}

// ── Error ────────────────────────────────────────────────────
function showError(msg) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Inter',sans-serif;color:#7878a0;text-align:center;padding:40px;">
      <div style="font-size:48px;margin-bottom:16px;">🔗</div>
      <div style="font-size:18px;font-weight:700;color:#f0f0f5;margin-bottom:8px;">${msg}</div>
      <a href="index.html" style="margin-top:16px;color:#818cf8;font-size:13px;">← Back to VoilaLink</a>
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
