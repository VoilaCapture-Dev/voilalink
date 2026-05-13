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
    initChat(profile);
  } catch (e) {
    console.error('Bio page error:', e);
    showError('Page not found.');
  }
});

// ── Render bio ───────────────────────────────────────────────
function renderBio(profile, links) {
  // Avatar / name
  const avatarEl = document.getElementById('bio-avatar');
  if (profile.avatar_url) {
    avatarEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = profile.avatar_url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = (profile.full_name || profile.username)[0].toUpperCase();
  }
  document.getElementById('bio-name').textContent     = profile.full_name || profile.username;
  document.getElementById('bio-handle').textContent   = '@' + profile.username;
  document.getElementById('bio-bio').textContent      = profile.bio || '';
  document.title = (profile.full_name || profile.username) + ' — VoilaLink';

  // Social pills
  renderSocials(profile);

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

  // Update footer link to include referral code
  const footerLink = document.getElementById('referral-footer');
  if (footerLink) {
    footerLink.href = 'https://voilalink.com/login.html?ref=' + encodeURIComponent(profile.username) + '&mode=signup';
  }
}

// ── Social pills ─────────────────────────────────────────────
function renderSocials(profile) {
  const container = document.getElementById('bio-socials');
  if (!container) return;
  container.innerHTML = '';
  const socials = [
    { key: 'linkedin_url',   label: 'LinkedIn',   icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>' },
    { key: 'instagram_url',  label: 'Instagram',  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>' },
    { key: 'twitter_url',    label: 'Twitter',    icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
    { key: 'youtube_url',    label: 'YouTube',    icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>' },
    { key: 'tiktok_url',     label: 'TikTok',     icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.54V6.78a4.85 4.85 0 0 1-1.06-.09z"/></svg>' },
    { key: 'github_url',     label: 'GitHub',     icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>' },
  ];
  socials.forEach(s => {
    if (!profile[s.key]) return;
    const a = document.createElement('a');
    a.className = 'social-pill';
    a.href = profile[s.key];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = s.icon + ' ' + s.label;
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

// ── Chat widget ───────────────────────────────────────────────
let chatConversationId   = sessionStorage.getItem('vl_conv_id') || null;
let chatProfileId        = null;
let chatProfileEmail     = null;
let chatProfileName      = null;
let chatPageUrl          = null;
let chatAutoReplyEnabled = false;
let chatAutoReplyContext = null;
let chatOpen             = false;
let chatRealtime         = null;
let activeConvRealtime   = null;

function initChat(profile) {
  chatProfileId        = profile.id;
  chatProfileEmail     = profile.email || null;
  chatProfileName      = profile.full_name || profile.username;
  chatPageUrl          = window.location.href;
  chatAutoReplyEnabled = profile.auto_reply_enabled || false;
  chatAutoReplyContext = profile.auto_reply_context || null;

  // Set header name & avatar
  const nameEl   = document.getElementById('chat-header-name');
  const avatarEl = document.getElementById('chat-header-avatar');
  if (nameEl)   nameEl.textContent = profile.full_name || profile.username;
  if (avatarEl) {
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      avatarEl.textContent = (profile.full_name || profile.username)[0].toUpperCase();
    }
  }

  // Returning visitor: restore conversation
  if (chatConversationId) {
    showChatMessages();
    loadChatHistory();
    subscribeToChatReplies();
  }
}

function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chat-window').classList.toggle('open', chatOpen);
  if (chatOpen && chatConversationId) {
    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }
}

async function startChat() {
  const name = document.getElementById('chat-visitor-name').value.trim();
  const msg  = document.getElementById('chat-first-message').value.trim();
  if (!name) { document.getElementById('chat-visitor-name').focus(); return; }
  if (!msg)  { document.getElementById('chat-first-message').focus(); return; }

  const btn = document.getElementById('chat-start-btn');
  btn.textContent = 'Sending…'; btn.disabled = true;

  try {
    const conv = await createConversation(chatProfileId, name, null);
    chatConversationId = conv.id;
    sessionStorage.setItem('vl_conv_id', conv.id);
    await sendMessage(conv.id, 'visitor', msg);
    showChatMessages();
    appendChatMessage({ sender: 'visitor', content: msg, created_at: new Date().toISOString() });
    subscribeToChatReplies();

    // Send email notification to page owner (fire and forget)
    if (chatProfileEmail) {
      fetch('/api/notify-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail:  chatProfileEmail,
          ownerName:   chatProfileName,
          visitorName: name,
          message:     msg,
          pageUrl:     chatPageUrl
        })
      }).catch(() => {});
    }

    // AI auto-reply if enabled (fire and forget)
    if (chatAutoReplyEnabled) {
      setTimeout(() => {
        fetch('/api/auto-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conv.id,
            visitorName:    name,
            visitorMessage: msg,
            ownerContext:   chatAutoReplyContext
          })
        }).then(r => r.json()).then(data => {
          if (data.reply) {
            appendChatMessage({ sender: 'owner', content: data.reply, created_at: new Date().toISOString() });
          }
        }).catch(() => {});
      }, 2000); // 2 second delay so it feels natural
    }
  } catch (e) {
    console.error('Chat error:', e);
    btn.textContent = 'Try again'; btn.disabled = false;
  }
}

async function sendChat() {
  const input = document.getElementById('chat-msg-input');
  const msg   = input.value.trim();
  if (!msg || !chatConversationId) return;
  input.value = '';
  try {
    const m = await sendMessage(chatConversationId, 'visitor', msg);
    appendChatMessage(m);
  } catch (e) { console.error('Send error:', e); }
}

function showChatMessages() {
  document.getElementById('chat-intro').style.display     = 'none';
  document.getElementById('chat-messages').style.display  = 'flex';
  document.getElementById('chat-input-row').style.display = 'flex';
}

async function loadChatHistory() {
  try {
    const messages  = await getMessages(chatConversationId);
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    messages.forEach(m => appendChatMessage(m, false));
    container.scrollTop = container.scrollHeight;
  } catch (e) { console.error('Load history error:', e); }
}

function appendChatMessage(msg, scroll = true) {
  const container = document.getElementById('chat-messages');
  const el   = document.createElement('div');
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  el.className = 'msg-bubble ' + msg.sender;
  el.innerHTML = escHtml(msg.content) + `<div class="msg-time">${time}</div>`;
  container.appendChild(el);
  if (scroll) container.scrollTop = container.scrollHeight;
}

function subscribeToChatReplies() {
  if (chatRealtime) return;
  chatRealtime = db.channel('chat-' + chatConversationId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `conversation_id=eq.${chatConversationId}`
    }, (payload) => {
      if (payload.new.sender === 'owner') {
        appendChatMessage(payload.new);
      }
    })
    .subscribe();
}
