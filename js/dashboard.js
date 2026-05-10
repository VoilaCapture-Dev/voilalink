// ============================================================
//  VoilaLink — Dashboard (dashboard.html)
// ============================================================
'use strict';

let currentUser    = null;
let currentProfile = null;
let allLinks       = [];

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const user = await getUser();
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;

  try {
    currentProfile = await getProfile(user.id);
  } catch {
    // No profile yet — new Google/OAuth user, show username setup
    showUsernameSetup(user);
    return;
  }

  renderHeader();
  await loadLinks();
});

// ── Username setup for OAuth users ───────────────────────────
function showUsernameSetup(user) {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#08080f;font-family:'Inter',sans-serif;">
      <div style="background:#13131a;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;width:100%;max-width:420px;text-align:center;">
        <div style="font-size:32px;margin-bottom:16px;">👋</div>
        <h2 style="color:#f0f0f5;font-family:'Syne',sans-serif;font-size:22px;margin-bottom:8px;">One last step!</h2>
        <p style="color:#7878a0;font-size:13px;margin-bottom:28px;">Choose your VoilaLink username — this will be your public URL.</p>
        <input id="setup-name" type="text" placeholder="Your full name" style="width:100%;background:#0a0a0f;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 16px;color:#f0f0f5;font-size:14px;margin-bottom:12px;box-sizing:border-box;" />
        <input id="setup-username" type="text" placeholder="username" style="width:100%;background:#0a0a0f;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 16px;color:#f0f0f5;font-size:14px;margin-bottom:6px;box-sizing:border-box;" oninput="checkSetupUsername(this)" />
        <div id="setup-hint" style="font-size:11px;color:#7878a0;margin-bottom:20px;text-align:left;">voilalink.com/yourname</div>
        <button onclick="createProfile()" style="width:100%;background:linear-gradient(135deg,#818cf8,#a78bfa);border:none;border-radius:10px;padding:14px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">Create my page →</button>
        <div id="setup-error" style="color:#ef4444;font-size:12px;margin-top:12px;display:none;"></div>
      </div>
    </div>`;
}

async function checkSetupUsername(input) {
  const val = input.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  input.value = val;
  const hint = document.getElementById('setup-hint');
  if (!val) { hint.textContent = 'voilalink.com/yourname'; hint.style.color = '#7878a0'; return; }
  if (val.length < 3) { hint.textContent = '⚠ At least 3 characters'; hint.style.color = '#f59e0b'; return; }
  hint.textContent = 'Checking…'; hint.style.color = '#7878a0';
  try {
    const available = await isUsernameAvailable(val);
    hint.textContent = available ? '✓ voilalink.com/' + val + ' is available!' : '✗ @' + val + ' is taken';
    hint.style.color = available ? '#4ade80' : '#ef4444';
  } catch { hint.textContent = 'Could not check'; }
}

async function createProfile() {
  const name     = document.getElementById('setup-name').value.trim();
  const username = document.getElementById('setup-username').value.trim();
  const errEl    = document.getElementById('setup-error');
  errEl.style.display = 'none';

  if (!name)           { errEl.textContent = 'Please enter your name'; errEl.style.display = 'block'; return; }
  if (!username || username.length < 3) { errEl.textContent = 'Username must be at least 3 characters'; errEl.style.display = 'block'; return; }

  try {
    const available = await isUsernameAvailable(username);
    if (!available) { errEl.textContent = 'That username is taken'; errEl.style.display = 'block'; return; }

    const { error } = await db.from('profiles').insert({
      id: currentUser.id, username, full_name: name, theme: 'midnight'
    });
    if (error) throw error;
    window.location.reload();
  } catch (e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.style.display = 'block';
  }
}

// ── Header ───────────────────────────────────────────────────
function renderHeader() {
  const url = 'voilalink.com/' + currentProfile.username;
  document.getElementById('topbar-url-text').textContent = url;
  document.querySelector('.user-name').textContent = currentProfile.full_name || currentProfile.username;
  const avatarEl = document.querySelector('.user-avatar');
  if (currentProfile.avatar_url) {
    avatarEl.textContent = '';
    avatarEl.style.cssText += ';background-image:url(' + currentProfile.avatar_url + ');background-size:cover;background-position:center;';
  } else {
    avatarEl.textContent = (currentProfile.full_name || 'U')[0].toUpperCase();
  }
  document.getElementById('preview-page-link').href = '/' + currentProfile.username;
}

function copyUrl() {
  navigator.clipboard.writeText('https://voilalink.com/' + currentProfile.username)
    .then(() => toast('Link copied ✓'));
}

// showTab is defined in dashboard.html inline script

// ── Load links ───────────────────────────────────────────────
async function loadLinks() {
  try {
    allLinks = await getLinks(currentUser.id);
    renderLinks();
    renderPreview();
    updateStats();
    renderOnboarding();
  } catch (e) {
    toast('Error loading links: ' + e.message);
  }
}

function renderLinks() {
  const container = document.getElementById('links-container');
  container.innerHTML = '';
  if (allLinks.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:48px 24px;">
        <div style="font-size:48px;margin-bottom:16px;">🔗</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--text-primary);">Add your first link</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:24px;line-height:1.6;">Share any URL — your website, social profile,<br>portfolio, shop, or anything else.</div>
        <button class="btn-sm primary" onclick="openModal()" style="padding:12px 28px;font-size:13px;">+ Add a link</button>
      </div>`;
    return;
  }
  allLinks.forEach(link => {
    const el = document.createElement('div');
    el.className = 'link-item';
    el.dataset.id = link.id;
    el.innerHTML = `
      <div class="drag-handle"><span></span><span></span><span></span></div>
      <div class="link-icon-box" style="background:rgba(129,140,248,0.12);">
        ${link.emoji || '🔗'}
        <div class="edit-hint">✏️</div>
      </div>
      <div class="link-info">
        <div class="link-title-text">${escHtml(link.title)}</div>
        <div class="link-url-text">${escHtml(link.url)}</div>
      </div>
      <div class="link-actions">
        <button class="link-toggle ${link.enabled ? '' : 'off'}"
          onclick="toggleLink('${link.id}', this)"></button>
        <button class="link-edit-btn"   onclick="openEditModal('${link.id}')">✏️</button>
        <button class="link-delete-btn" onclick="confirmDelete('${link.id}')">🗑</button>
      </div>`;
    container.appendChild(el);
  });

  // Drag & drop reorder
  if (typeof Sortable !== 'undefined') {
    Sortable.create(container, {
      handle: '.drag-handle',
      animation: 150,
      forceFallback: true,
      fallbackClass: 'sortable-drag',
      onEnd: async () => {
        const ids = Array.from(container.querySelectorAll('.link-item')).map(el => el.dataset.id);
        allLinks.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        allLinks.forEach((link, idx) => { link.position = idx; });
        await Promise.all(allLinks.map((link, idx) =>
          db.from('links').update({ position: idx }).eq('id', link.id)
        ));
        renderPreview();
        toast('Order saved ✓');
      }
    });
  }
}

function renderPreview() {
  const container = document.getElementById('preview-links');
  container.innerHTML = '';
  allLinks.filter(l => l.enabled).slice(0, 5).forEach(link => {
    const el = document.createElement('div');
    el.className = 'phone-link';
    el.innerHTML = `
      <div class="phone-link-icon" style="background:rgba(129,140,248,0.15);">${link.emoji || '🔗'}</div>
      <div><div class="phone-link-title">${escHtml(link.title)}</div></div>
      <div class="phone-link-arrow">→</div>`;
    container.appendChild(el);
  });
  if (currentProfile) {
    document.getElementById('preview-name').textContent   = currentProfile.full_name || currentProfile.username;
    document.getElementById('preview-handle').textContent = '@' + currentProfile.username;
    document.getElementById('preview-avatar').textContent = (currentProfile.full_name || 'U')[0].toUpperCase();
  }
}

function updateStats() {
  document.getElementById('stat-links').textContent = allLinks.filter(l => l.enabled).length;
}

// ── Toggle link on/off ────────────────────────────────────────
async function toggleLink(id, btn) {
  const link = allLinks.find(l => l.id === id);
  if (!link) return;
  const newVal = !link.enabled;
  try {
    await updateLink(id, { enabled: newVal });
    link.enabled = newVal;
    btn.classList.toggle('off', !newVal);
    renderPreview(); updateStats();
  } catch (e) { toast('Error: ' + e.message); }
}

// ── Delete link ───────────────────────────────────────────────
async function confirmDelete(id) {
  if (!confirm('Delete this link? This cannot be undone.')) return;
  try {
    await deleteLink(id);
    allLinks = allLinks.filter(l => l.id !== id);
    renderLinks(); renderPreview(); updateStats();
    toast('Link deleted');
  } catch (e) { toast('Error: ' + e.message); }
}

// ── Presets ───────────────────────────────────────────────────
const presets = {
  facebook:  { url: 'https://facebook.com/',         title: 'Facebook',    emoji: '📘' },
  youtube:   { url: 'https://youtube.com/@',         title: 'YouTube',     emoji: '▶️' },
  instagram: { url: 'https://instagram.com/',        title: 'Instagram',   emoji: '📸' },
  tiktok:    { url: 'https://tiktok.com/@',          title: 'TikTok',      emoji: '🎵' },
  whatsapp:  { url: 'https://wa.me/',                title: 'WhatsApp',    emoji: '💬' },
  linkedin:  { url: 'https://linkedin.com/in/',      title: 'LinkedIn',    emoji: '💼' },
  twitter:   { url: 'https://twitter.com/',          title: 'Twitter / X', emoji: '𝕏'  },
  telegram:  { url: 'https://t.me/',                 title: 'Telegram',    emoji: '✈️' },
  reddit:    { url: 'https://reddit.com/u/',         title: 'Reddit',      emoji: '🟠' },
  discord:   { url: 'https://discord.gg/',           title: 'Discord',     emoji: '👾' },
  pinterest: { url: 'https://pinterest.com/',        title: 'Pinterest',   emoji: '📌' },
  threads:   { url: 'https://threads.net/@',         title: 'Threads',     emoji: '🧵' },
  snapchat:  { url: 'https://snapchat.com/add/',     title: 'Snapchat',    emoji: '👻' },
  slack:     { url: 'https://slack.com/',            title: 'Slack',       emoji: '💼' },
  wechat:    { url: 'https://weixin.qq.com/',        title: 'WeChat',      emoji: '💚' },
  signal:    { url: 'https://signal.me/#p/',         title: 'Signal',      emoji: '📱' },
  messenger: { url: 'https://m.me/',                 title: 'Messenger',   emoji: '💬' },
  viber:     { url: 'https://invite.viber.com/',     title: 'Viber',       emoji: '🎮' },
  line:      { url: 'https://line.me/ti/p/',         title: 'LINE',        emoji: '💚' },
  teams:     { url: 'https://teams.microsoft.com/',  title: 'MS Teams',    emoji: '🟦' },
  googlechat:{ url: 'https://chat.google.com/',      title: 'Google Chat', emoji: '💬' },
  email:     { url: 'mailto:',                       title: 'Email me',    emoji: '✉️' },
  phone:     { url: 'tel:',                          title: 'Call me',     emoji: '📞' },
  website:   { url: 'https://',                      title: 'My Website',  emoji: '🌐' },
  shop:      { url: 'https://',                      title: 'My Shop',     emoji: '🛒' },
  blog:      { url: 'https://',                      title: 'My Blog',     emoji: '✍️' },
};

let editingId = null;

function openModal() {
  editingId = null;
  document.getElementById('modal-title').textContent  = 'Add a link';
  document.getElementById('modal-submit').textContent = 'Add link →';
  document.getElementById('input-url').value   = '';
  document.getElementById('input-title').value = '';
  document.getElementById('input-emoji').value = '🔗';
  document.getElementById('input-desc').value  = '';
  document.getElementById('modal').classList.add('open');
}

function openEditModal(id) {
  const link = allLinks.find(l => l.id === id);
  if (!link) return;
  editingId = id;
  document.getElementById('modal-title').textContent  = 'Edit link';
  document.getElementById('modal-submit').textContent = 'Save changes →';
  document.getElementById('input-url').value   = link.url;
  document.getElementById('input-title').value = link.title;
  document.getElementById('input-emoji').value = link.emoji || '🔗';
  document.getElementById('input-desc').value  = link.description || '';
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function fillPreset(key) {
  const p = presets[key];
  if (!p) return;
  document.getElementById('input-url').value   = p.url;
  document.getElementById('input-title').value = p.title;
  document.getElementById('input-emoji').value = p.emoji;
}

function pickEmoji(el, emoji) {
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('input-emoji').value = emoji;
}

async function saveLink() {
  const url   = document.getElementById('input-url').value.trim();
  const title = document.getElementById('input-title').value.trim();
  const emoji = document.getElementById('input-emoji').value.trim() || '🔗';
  const desc  = document.getElementById('input-desc').value.trim();
  const btn   = document.getElementById('modal-submit');

  if (!url || !title) { toast('Please fill in URL and title'); return; }

  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    if (editingId) {
      const updated = await updateLink(editingId, { url, title, emoji, description: desc });
      const idx = allLinks.findIndex(l => l.id === editingId);
      if (idx !== -1) allLinks[idx] = updated;
      toast('Link updated ✓');
    } else {
      const maxPos = allLinks.reduce((m, l) => Math.max(m, l.position), -1);
      const newLink = await addLink({
        user_id: currentUser.id,
        url, title, emoji,
        description: desc,
        position: maxPos + 1,
        enabled: true
      });
      allLinks.push(newLink);
      toast('Link added ✓');
    }
    renderLinks(); renderPreview(); updateStats();
    closeModal();
  } catch (e) {
    toast('Error: ' + e.message);
  } finally {
    btn.textContent = editingId ? 'Save changes →' : 'Add link →';
    btn.disabled = false;
  }
}

// ── QR Code ───────────────────────────────────────────────────
function showQR() {
  const modal = document.getElementById('qr-modal');
  const container = document.getElementById('qr-container');
  const url = 'https://voilalink.com/' + currentProfile.username;
  document.getElementById('qr-url-label').textContent = 'voilalink.com/' + currentProfile.username;
  container.innerHTML = '';
  modal.classList.add('open');
  new QRCode(container, {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}
function closeQR() { document.getElementById('qr-modal').classList.remove('open'); }
function downloadQR() {
  const canvas = document.querySelector('#qr-container canvas');
  const img    = document.querySelector('#qr-container img');
  const src    = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
  if (!src) return;
  const a = document.createElement('a');
  a.download = 'voilalink-' + currentProfile.username + '.png';
  a.href = src;
  a.click();
}

// ── Avatar upload ─────────────────────────────────────────────
async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Image must be under 2MB'); return; }
  toast('Uploading…');
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = currentUser.id + '/avatar.' + ext;
  const { error: upErr } = await db.storage.from('avatars').upload(path, file, { upsert: true });
  if (upErr) { toast('Upload failed: ' + upErr.message); return; }
  const { data } = db.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl + '?t=' + Date.now();
  const { error } = await db.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
  if (error) { toast('Save failed: ' + error.message); return; }
  currentProfile.avatar_url = url;
  // Update avatar preview in settings
  const av = document.getElementById('settings-avatar');
  if (av) av.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  renderHeader();
  toast('Photo updated ✓');
}

// ── Themes ───────────────────────────────────────────────────
async function selectTheme(card) {
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const theme = card.dataset.theme;
  const { error } = await db.from('profiles').update({ theme }).eq('id', currentUser.id);
  if (error) { toast('Error saving theme'); return; }
  if (currentProfile) currentProfile.theme = theme;
  toast('Theme saved ✓');
  window.open('/' + currentProfile.username, 'voilalink_preview');
}

// ── Onboarding ────────────────────────────────────────────────
function renderOnboarding() {
  const banner = document.getElementById('onboarding-banner');
  if (!banner) return;
  if (localStorage.getItem('vl_onboarding_dismissed')) { banner.style.display = 'none'; return; }

  const hasLinks = allLinks.length > 0;
  const hasBio   = !!(currentProfile && currentProfile.bio);
  if (hasLinks && hasBio) { banner.style.display = 'none'; return; }

  banner.style.display = 'block';

  const steps = [
    { done: true,     text: 'Create your VoilaLink account',   btn: '' },
    { done: hasLinks, text: 'Add your first link',             btn: `<button class="btn-sm primary" onclick="openModal()" style="font-size:10px;padding:4px 10px;">Add link →</button>` },
    { done: hasBio,   text: 'Write a short bio',               btn: `<span style="font-size:11px;color:var(--accent);cursor:pointer;" onclick="document.querySelector('[onclick*=settings]').click()">Go to Settings →</span>` },
  ];

  document.getElementById('onboarding-checklist').innerHTML = steps.map((s, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;${i < steps.length-1 ? 'border-bottom:1px solid var(--border);' : ''}">
      <div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
        ${s.done ? 'background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.4);' : 'background:var(--card);color:var(--text-muted);border:1px solid var(--border);'}">
        ${s.done ? '✓' : '·'}
      </div>
      <div style="flex:1;font-size:12px;${s.done ? 'color:var(--text-muted);text-decoration:line-through;' : 'font-weight:500;'}">${s.text}</div>
      ${!s.done ? s.btn : ''}
    </div>`).join('');
}

function dismissOnboarding() {
  localStorage.setItem('vl_onboarding_dismissed', '1');
  const banner = document.getElementById('onboarding-banner');
  if (banner) banner.style.display = 'none';
}

// ── Analytics ────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    const clicks = await getLinkClicks(currentUser.id);
    document.getElementById('stat-total-clicks').textContent = clicks.length;
    const counts = {};
    clicks.forEach(c => { counts[c.link_id] = (counts[c.link_id] || 0) + 1; });
    const max = Math.max(...Object.values(counts), 1);
    const container = document.getElementById('analytics-links');
    container.innerHTML = '';
    allLinks.forEach(link => {
      const n   = counts[link.id] || 0;
      const pct = Math.round((n / max) * 100);
      container.innerHTML += `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-size:16px;">${link.emoji || '🔗'}</span>
            <div style="flex:1;font-weight:600;font-size:12px;">${escHtml(link.title)}</div>
            <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:14px;color:var(--accent);">${n}</div>
          </div>
          <div style="background:var(--bg);border-radius:4px;height:6px;">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:4px;transition:width 0.5s;"></div>
          </div>
        </div>`;
    });
  } catch (e) { toast('Error loading analytics: ' + e.message); }
}

// ── Creator Research ──────────────────────────────────────────
async function researchCreators() {
  const niche    = document.getElementById('res-niche').value.trim();
  const platform = document.getElementById('res-platform').value;
  const minF     = document.getElementById('res-min').value;
  const maxF     = document.getElementById('res-max').value;
  const count    = document.getElementById('res-count').value;

  if (!niche) { toast('Please enter a niche'); document.getElementById('res-niche').focus(); return; }

  const btn     = document.getElementById('res-search-btn');
  const results = document.getElementById('res-results');
  btn.textContent = '🔍 Searching…'; btn.disabled = true;
  results.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">
    <div style="font-size:32px;margin-bottom:12px;">🤖</div>
    <div style="font-size:13px;">Claude is researching ${platform} creators in the ${niche} niche…</div>
  </div>`;

  try {
    const res  = await fetch('/api/research-creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche, platform, minFollowers: minF, maxFollowers: maxF, count: parseInt(count) })
    });
    const data = await res.json();
    if (!res.ok || data.error) { toast('Error: ' + (data.error || 'Unknown')); results.innerHTML = ''; return; }

    renderResearchResults(data.creators, platform);
  } catch (e) {
    toast('Error: ' + e.message); results.innerHTML = '';
  } finally {
    btn.textContent = '🔍 Find creators'; btn.disabled = false;
  }
}

function renderResearchResults(creators, platform) {
  const container = document.getElementById('res-results');
  if (!creators || creators.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">No results found. Try a different niche or platform.</div>`;
    return;
  }

  const confidenceColour = { high: '#4ade80', medium: '#f59e0b', low: '#ef4444' };

  container.innerHTML = `
    <div style="font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px;">${creators.length} creators found</div>
    ${creators.map((c, i) => `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:10px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:#fff;flex-shrink:0;">${(c.name||'?')[0].toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <div style="font-size:14px;font-weight:700;">${escHtml(c.name || '')}</div>
              <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);">${escHtml(c.handle || '')}</div>
              <div style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(129,140,248,0.1);color:var(--text-muted);">${escHtml(c.estimated_followers || '')}</div>
              <div style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(0,0,0,0.2);color:${confidenceColour[c.confidence]||'#7878a0'};">${c.confidence || 'unknown'} confidence</div>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;line-height:1.5;">${escHtml(c.why_good_fit || '')}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
              ${(c.niche_tags||[]).map(t => `<span style="font-size:10px;padding:2px 8px;background:var(--card-hover);border:1px solid var(--border);border-radius:99px;color:var(--text-muted);">${escHtml(t)}</span>`).join('')}
            </div>
            <div style="display:flex;gap:8px;">
              <button onclick="useCreatorForOutreach('${escHtml(c.name||'')}','${escHtml(platform)}','${escHtml((c.niche_tags||[]).join(', '))}','${escHtml(c.profile_url||'')}','${escHtml(c.estimated_followers||'')} followers')" class="btn-sm primary" style="font-size:11px;padding:5px 12px;">✍️ Write outreach</button>
              ${c.profile_url ? `<a href="${escHtml(c.profile_url)}" target="_blank" rel="noopener noreferrer" class="btn-sm ghost" style="font-size:11px;padding:5px 12px;">↗ View profile</a>` : ''}
            </div>
          </div>
        </div>
      </div>`).join('')}`;
}

function useCreatorForOutreach(name, platform, niche, profileUrl, notes) {
  // Switch to outreach tab
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('nav-outreach').classList.add('active');
  document.getElementById('panel-research').style.display = 'none';
  document.getElementById('panel-outreach').style.display = 'block';
  document.querySelector('.preview-panel').style.display  = 'none';
  document.getElementById('topbar-title').textContent = 'AI Outreach';
  loadOutreachLog();

  // Pre-fill the outreach form
  document.getElementById('out-name').value  = name;
  document.getElementById('out-niche').value = niche;
  document.getElementById('out-url').value   = profileUrl;
  document.getElementById('out-notes').value = notes;

  // Set platform dropdown
  const sel = document.getElementById('out-platform');
  for (let opt of sel.options) { if (opt.value === platform) { sel.value = platform; break; } }

  toast('Creator loaded — click Generate message ✓');
}

// ── AI Outreach ───────────────────────────────────────────────
let lastOutreachMessage = '';

async function generateOutreach() {
  const name     = document.getElementById('out-name').value.trim();
  const platform = document.getElementById('out-platform').value;
  const niche    = document.getElementById('out-niche').value.trim();
  const url      = document.getElementById('out-url').value.trim();
  const notes    = document.getElementById('out-notes').value.trim();

  if (!name) { toast('Please enter the creator name'); document.getElementById('out-name').focus(); return; }

  const btn = document.getElementById('out-generate-btn');
  btn.textContent = '✨ Generating…'; btn.disabled = true;

  try {
    const res = await fetch('/api/generate-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorName: name, platform, niche, profileUrl: url, notes })
    });

    const data = await res.json();
    if (!res.ok || data.error) { toast('Error: ' + (data.error || 'Unknown error')); return; }

    lastOutreachMessage = data.message;
    document.getElementById('out-message').textContent = data.message;
    document.getElementById('out-result').style.display = 'block';
    document.getElementById('out-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (e) {
    toast('Error: ' + e.message);
  } finally {
    btn.textContent = '✨ Generate message'; btn.disabled = false;
  }
}

function copyOutreach() {
  if (!lastOutreachMessage) return;
  navigator.clipboard.writeText(lastOutreachMessage).then(() => toast('Message copied ✓'));
}

function logOutreach() {
  const name     = document.getElementById('out-name').value.trim();
  const platform = document.getElementById('out-platform').value;
  if (!name || !lastOutreachMessage) return;

  const log = JSON.parse(localStorage.getItem('vl_outreach_log') || '[]');
  log.unshift({ name, platform, message: lastOutreachMessage, date: new Date().toISOString() });
  localStorage.setItem('vl_outreach_log', JSON.stringify(log.slice(0, 50))); // keep last 50
  toast('Logged as sent ✓');
  loadOutreachLog();

  // Clear form
  document.getElementById('out-name').value  = '';
  document.getElementById('out-niche').value = '';
  document.getElementById('out-url').value   = '';
  document.getElementById('out-notes').value = '';
  document.getElementById('out-result').style.display = 'none';
  lastOutreachMessage = '';
}

function loadOutreachLog() {
  const log       = JSON.parse(localStorage.getItem('vl_outreach_log') || '[]');
  const container = document.getElementById('out-log');
  if (!container) return;

  if (log.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">No messages sent yet. Generate your first outreach above.</div>`;
    return;
  }

  container.innerHTML = log.map((entry, i) => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:14px;color:#fff;flex-shrink:0;">${entry.name[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${escHtml(entry.name)}</div>
        <div style="font-size:11px;color:var(--text-muted);">${escHtml(entry.platform)} · ${timeAgo(entry.date)}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="previewLog(${i})" class="btn-sm ghost" style="font-size:10px;padding:4px 10px;">View</button>
        <button onclick="deleteLog(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;" title="Delete">×</button>
      </div>
    </div>`).join('');
}

function previewLog(i) {
  const log = JSON.parse(localStorage.getItem('vl_outreach_log') || '[]');
  if (!log[i]) return;
  lastOutreachMessage = log[i].message;
  document.getElementById('out-message').textContent = log[i].message;
  document.getElementById('out-result').style.display = 'block';
  document.getElementById('out-result').scrollIntoView({ behavior: 'smooth' });
}

function deleteLog(i) {
  const log = JSON.parse(localStorage.getItem('vl_outreach_log') || '[]');
  log.splice(i, 1);
  localStorage.setItem('vl_outreach_log', JSON.stringify(log));
  loadOutreachLog();
}

// ── Messages / Inbox ─────────────────────────────────────────
let conversations      = [];
let activeConvId       = null;
let inboxRealtime      = null;
let activeConvRealtime = null;

async function loadMessages() {
  try {
    conversations = await getConversations(currentUser.id);
    renderConversations();
    updateMsgBadge();
    subscribeToInbox();
  } catch (e) { toast('Error loading messages: ' + e.message); }
}

function updateMsgBadge() {
  const unread = conversations.filter(c => c.has_unread).length;
  const badge  = document.getElementById('msg-badge');
  if (!badge) return;
  badge.textContent    = unread;
  badge.style.display  = unread > 0 ? 'inline' : 'none';
}

function renderConversations() {
  const container = document.getElementById('conversations-list');
  if (!container) return;
  if (conversations.length === 0) {
    container.innerHTML = `
      <div style="padding:40px 20px;text-align:center;color:var(--text-muted);">
        <div style="font-size:36px;margin-bottom:12px;">💬</div>
        <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">No messages yet</div>
        <div style="font-size:12px;line-height:1.6;">When visitors chat on your bio page, conversations will appear here.</div>
      </div>`;
    return;
  }
  container.innerHTML = conversations.map(c => `
    <div class="conv-item ${c.id === activeConvId ? 'active' : ''} ${c.has_unread ? 'unread' : ''}"
      onclick="openConversation('${c.id}', '${escHtml(c.visitor_name)}')">
      <div class="conv-avatar">${c.visitor_name[0].toUpperCase()}</div>
      <div class="conv-info">
        <div class="conv-name">${escHtml(c.visitor_name)}</div>
        <div class="conv-time">${timeAgo(c.last_message_at)}</div>
      </div>
      ${c.has_unread ? '<div class="conv-dot"></div>' : ''}
    </div>`).join('');
}

async function openConversation(convId, visitorName) {
  // Unsubscribe from previous active conversation
  if (activeConvRealtime) { db.removeChannel(activeConvRealtime); activeConvRealtime = null; }

  activeConvId = convId;
  renderConversations();

  // Mark as read
  const conv = conversations.find(c => c.id === convId);
  if (conv && conv.has_unread) {
    await markConversationRead(convId);
    conv.has_unread = false;
    updateMsgBadge();
    renderConversations();
  }

  // Show chat panel
  document.getElementById('messages-empty').style.display      = 'none';
  const chatEl = document.getElementById('messages-chat');
  chatEl.style.display = 'flex';

  document.getElementById('messages-chat-name').textContent   = visitorName;
  document.getElementById('messages-chat-avatar').textContent = visitorName[0].toUpperCase();
  document.getElementById('reply-input').value = '';

  // Load messages
  try {
    const msgs      = await getMessages(convId);
    const container = document.getElementById('messages-chat-body');
    container.innerHTML = '';
    msgs.forEach(m => appendInboxMessage(m, false));
    container.scrollTop = container.scrollHeight;
  } catch (e) { toast('Error loading messages: ' + e.message); }

  // Subscribe to new messages in this conversation
  activeConvRealtime = db.channel('conv-' + convId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `conversation_id=eq.${convId}`
    }, (payload) => {
      if (payload.new.sender === 'visitor') {
        appendInboxMessage(payload.new);
      }
    })
    .subscribe();
}

function appendInboxMessage(msg, scroll = true) {
  const container = document.getElementById('messages-chat-body');
  const isOwner   = msg.sender === 'owner';
  const time      = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const el        = document.createElement('div');
  el.style.cssText = `display:flex;flex-direction:column;align-items:${isOwner ? 'flex-end' : 'flex-start'};`;
  el.innerHTML = `
    <div style="max-width:75%;padding:8px 13px;border-radius:14px;font-size:13px;line-height:1.5;word-break:break-word;
      ${isOwner
        ? 'background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-bottom-right-radius:4px;'
        : 'background:var(--card);color:var(--text-primary);border:1px solid var(--border);border-bottom-left-radius:4px;'}">
      ${escHtml(msg.content)}
    </div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">${isOwner ? 'You' : 'Visitor'} · ${time}</div>`;
  container.appendChild(el);
  if (scroll) container.scrollTop = container.scrollHeight;
}

async function sendReply() {
  const input = document.getElementById('reply-input');
  const msg   = input.value.trim();
  if (!msg || !activeConvId) return;
  input.value = '';
  try {
    const m = await sendMessage(activeConvId, 'owner', msg);
    appendInboxMessage(m);
  } catch (e) { toast('Error sending: ' + e.message); }
}

function subscribeToInbox() {
  if (inboxRealtime) return;
  // Listen for conversation updates (triggered when visitor sends a message)
  inboxRealtime = db.channel('inbox-convs-' + currentUser.id)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'conversations',
      filter: `profile_id=eq.${currentUser.id}`
    }, async () => {
      conversations = await getConversations(currentUser.id);
      renderConversations();
      updateMsgBadge();
    })
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'conversations',
      filter: `profile_id=eq.${currentUser.id}`
    }, async () => {
      conversations = await getConversations(currentUser.id);
      renderConversations();
      updateMsgBadge();
    })
    .subscribe();
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return min + 'm ago';
  const hr = Math.floor(min / 60);
  if (hr < 24)  return hr + 'h ago';
  return Math.floor(hr / 24) + 'd ago';
}

// ── Sign out ─────────────────────────────────────────────────
async function signOut() {
  await db.auth.signOut();
  window.location.href = 'login.html';
}

// ── Utilities ────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function switchSubTab(btn) {
  document.querySelectorAll('.tab-switch-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});
