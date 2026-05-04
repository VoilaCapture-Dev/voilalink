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
    window.location.href = 'login.html'; return;
  }

  renderHeader();
  await loadLinks();
});

// ── Header ───────────────────────────────────────────────────
function renderHeader() {
  const url = 'voilalink.com/' + currentProfile.username;
  document.getElementById('topbar-url-text').textContent = url;
  document.querySelector('.user-name').textContent  = currentProfile.full_name || currentProfile.username;
  document.querySelector('.user-avatar').textContent = (currentProfile.full_name || 'U')[0].toUpperCase();
  document.getElementById('preview-page-link').href = 'bio.html?u=' + currentProfile.username;
}

function copyUrl() {
  navigator.clipboard.writeText('https://voilalink.com/' + currentProfile.username)
    .then(() => toast('Link copied ✓'));
}

// ── Navigation ───────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('panel-links').style.display     = tab === 'links'     ? 'block' : 'none';
  document.getElementById('panel-themes').style.display    = tab === 'themes'    ? 'block' : 'none';
  document.getElementById('panel-analytics').style.display = tab === 'analytics' ? 'block' : 'none';
  document.getElementById('topbar-title').textContent =
    tab === 'links' ? 'My Links' : tab === 'themes' ? 'Themes' : 'Analytics';
  if (tab === 'analytics') loadAnalytics();
}

// ── Load links ───────────────────────────────────────────────
async function loadLinks() {
  try {
    allLinks = await getLinks(currentUser.id);
    renderLinks();
    renderPreview();
    updateStats();
  } catch (e) {
    toast('Error loading links: ' + e.message);
  }
}

function renderLinks() {
  const container = document.getElementById('links-container');
  container.innerHTML = '';
  if (allLinks.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);">
        <div style="font-size:32px;margin-bottom:12px;">🔗</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px;">No links yet</div>
        <div style="font-size:12px;">Click "Add link" to get started</div>
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

// ── Themes ───────────────────────────────────────────────────
function selectTheme(card) {
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const theme = card.dataset.theme;
  db.from('profiles').update({ theme }).eq('id', currentUser.id)
    .then(() => toast('Theme saved ✓'));
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
