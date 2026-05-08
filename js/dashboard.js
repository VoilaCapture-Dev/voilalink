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
  document.querySelector('.user-name').textContent  = currentProfile.full_name || currentProfile.username;
  document.querySelector('.user-avatar').textContent = (currentProfile.full_name || 'U')[0].toUpperCase();
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
async function selectTheme(card) {
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const theme = card.dataset.theme;
  try {
    await db.from('profiles').update({ theme }).eq('id', currentUser.id);
    if (currentProfile) currentProfile.theme = theme;
    toast('Theme saved ✓');
    const reminder = document.getElementById('theme-refresh-reminder');
    if (reminder) reminder.style.display = 'flex';
  } catch (e) { toast('Error saving theme'); }
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
