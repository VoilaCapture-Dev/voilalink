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

  window._pageReferrer = document.referrer || null;

  try {
    const profile    = await getProfileByUsername(username);
    const links      = await getPublicLinks(profile.id);
    const tipJar     = await getPublicTipJar(profile.id);
    const countdowns = await getPublicCountdowns(profile.id);
    const polls      = await getPublicPolls(profile.id);
    const calEvents  = await getPublicCalendarEvents(profile.id);
    const pixels     = await getPublicPixelSettings(profile.id);
    renderBio(profile, links);
    if (calEvents  && calEvents.length > 0)  renderCalendar(calEvents);
    if (pixels) injectPixels(pixels);
    if (countdowns && countdowns.length > 0) renderCountdowns(countdowns);
    if (polls && polls.length > 0) renderPolls(polls);
    if (tipJar && tipJar.is_enabled) renderTipJar(tipJar);
    // vCard
    const vcard = await getPublicVCard(profile.id);
    if (vcard) renderVCard(vcard);

    // Email signup widget
    const emailWidget = await getPublicEmailWidget(profile.id);
    if (emailWidget) {
      const signupCount = await getSignupCount(profile.id);
      renderEmailWidget(emailWidget, profile.id, signupCount);
    }

    // Guestbook
    if (profile.guestbook_enabled) {
      const gbEntries = await getPublicGuestbook(profile.id);
      renderGuestbook(gbEntries, profile.id);
    }

    const effectiveTheme = profile.dynamic_theme
      ? getDynamicThemeName()
      : (profile.theme || 'midnight');
    applyTheme(effectiveTheme);
    initThemeToggle(effectiveTheme);
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
  // ── SEO meta tags ─────────────────────────────────────────
  const seoTitle = profile.seo_title
    || (profile.full_name || profile.username) + ' | VoilaLink';
  const seoDesc  = profile.seo_description
    || profile.bio
    || ('Check out ' + (profile.full_name || profile.username) + "'s links on VoilaLink");
  const setMeta = (id, val) => { const el = document.getElementById(id); if (el) el.setAttribute('content', val); };
  document.title = seoTitle;
  setMeta('meta-description', seoDesc);
  setMeta('og-title',         seoTitle);
  setMeta('og-description',   seoDesc);
  setMeta('og-url',           window.location.href);
  setMeta('twitter-title',       seoTitle);
  setMeta('twitter-description', seoDesc);

  // Apply custom font
  if (profile.font && profile.font !== 'inter') {
    const fontMap = {
      poppins:   'Poppins',
      playfair:  'Playfair Display',
      space:     'Space Grotesk',
      raleway:   'Raleway',
      montserrat:'Montserrat',
      nunito:    'Nunito',
      syne:      'Syne',
    };
    const fontName = fontMap[profile.font];
    if (fontName) {
      document.body.style.fontFamily = `'${fontName}', sans-serif`;
    }
  }

  // Social pills
  renderSocials(profile);

  // Links
  const container = document.getElementById('bio-links');
  container.innerHTML = '';

  const now = new Date();
  const activeLinks = links.filter(link => {
    if (link.start_at && new Date(link.start_at) > now) return false; // not started yet
    if (link.end_at   && new Date(link.end_at)   < now) return false; // already expired
    return true;
  });

  if (activeLinks.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:32px 0;">No links added yet.</p>';
    return;
  }

  activeLinks.forEach((link, index) => {
    const isGated   = link.gate_type && link.gate_type !== 'none' && link.gate_action_url;
    const storageKey = `vl_gate_${link.id}`;
    const isUnlocked = isGated ? localStorage.getItem(storageKey) === '1' : true;

    if (isGated && !isUnlocked) {
      // ── Locked card ───────────────────────────────────────
      const lbl = { action: link.gate_type, icon: '🔒' };

      const card = document.createElement('div');
      card.className = 'link-card bio-link';
      card.id = `gate-card-${link.id}`;
      card.style.cssText = 'flex-direction:column;align-items:stretch;gap:0;cursor:default;';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;padding:0 0 12px 0;">
          <div class="link-icon" style="background:rgba(129,140,248,0.12);flex-shrink:0;">🔒</div>
          <div class="link-text" style="flex:1;">
            <div class="link-title">${escHtml(link.title)}</div>
            <div class="link-desc" style="color:var(--text-muted);font-size:12px;">Unlock by completing an action below</div>
          </div>
        </div>
        <div id="gate-step1-${link.id}" style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:12px;color:var(--text-muted);text-align:center;padding:4px 0;">
            ${lbl.icon} To unlock this link, please ${lbl.action.toLowerCase()} first
          </div>
          <a href="${escHtml(link.gate_action_url)}" target="_blank" rel="noopener noreferrer"
            id="gate-go-${link.id}"
            onclick="document.getElementById('gate-step2-${link.id}').style.display='flex';this.style.opacity='0.6';"
            style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-radius:12px;font-size:13px;font-weight:700;text-decoration:none;transition:opacity 0.15s;">
            ${lbl.icon} ${escHtml(lbl.action)} →
          </a>
          <div id="gate-step2-${link.id}" style="display:none;flex-direction:column;gap:6px;">
            <div style="font-size:11px;color:var(--text-muted);text-align:center;">Done? Tap below to unlock the link:</div>
            <button onclick="unlockGatedLink('${link.id}','${encodeURIComponent(link.url)}')"
              style="padding:10px;background:rgba(129,140,248,0.15);border:1px solid var(--accent);border-radius:12px;color:var(--accent);font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;"
              onmouseover="this.style.background='rgba(129,140,248,0.25)'" onmouseout="this.style.background='rgba(129,140,248,0.15)'">
              ✓ I did it — unlock this link
            </button>
          </div>
        </div>`;
      container.appendChild(card);
    } else {
      // ── Normal (or already unlocked) card ─────────────────
      const a = document.createElement('a');
      a.className = index === 0 ? 'link-card bio-link bio-link-featured' : 'link-card bio-link';
      a.href = '#';
      a.onclick = (e) => { e.preventDefault(); handleClick(link, a); };

      const ytId = getYouTubeId(link.url);
      const thumbHtml = ytId
        ? `<img class="vl-yt-thumb" src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" alt="Video thumbnail" loading="lazy">`
        : '';

      // A/B Split Test: pick variant per session per link
      let abVariant = 'a';
      let displayTitle = link.title;
      if (link.ab_label_b) {
        const key = 'ab_' + link.id;
        abVariant = sessionStorage.getItem(key);
        if (!abVariant) {
          abVariant = Math.random() < 0.5 ? 'a' : 'b';
          sessionStorage.setItem(key, abVariant);
        }
        if (abVariant === 'b') displayTitle = link.ab_label_b;
      }
      a.dataset.abVariant = abVariant;
      a.innerHTML = `${thumbHtml}
        <div class="link-icon" style="background:rgba(129,140,248,0.12);">${link.emoji || '🔗'}</div>
        <div class="link-text">
          <div class="link-title">${escHtml(displayTitle)}</div>
          ${link.description ? `<div class="link-desc">${escHtml(link.description)}<\/div>` : ''}
        </div>
        <div class="link-arrow">→</div>`;
      container.appendChild(a);
    }
  });

  // Update footer link to include referral code
  const footerLink = document.getElementById('referral-footer');
  if (footerLink) {
    footerLink.href = 'https://voilalink.com/login.html?ref=' + encodeURIComponent(profile.username) + '&mode=signup';
    const ctaSpan = document.getElementById('footer-cta-text');
    if (ctaSpan) ctaSpan.textContent = profile.footer_cta || 'Create your free page →';
  }
}

// ── Countdowns ───────────────────────────────────────────────
function renderCountdowns(countdowns) {
  const container = document.getElementById('bio-countdowns');
  if (!container) return;
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = '12px';
  container.style.width = '100%';

  countdowns.forEach(cd => {
    const target  = new Date(cd.target_date);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;max-width:480px;background:var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px 22px;text-align:center;';

    wrapper.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.12em;font-family:monospace;margin-bottom:6px;">⏱ Coming soon</div>
      <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:16px;">${escHtml(cd.title)}</div>
      ${cd.description ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">${escHtml(cd.description)}</div>` : ''}
      <div style="display:flex;justify-content:center;gap:12px;" id="cd-${cd.id}">
        <div style="text-align:center;">
          <div class="cd-num" id="cd-${cd.id}-d" style="font-family:'Syne',sans-serif;font-weight:800;font-size:32px;color:var(--accent);line-height:1;">00</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-top:4px;">Days</div>
        </div>
        <div style="font-size:28px;color:var(--text-muted);line-height:1.2;">:</div>
        <div style="text-align:center;">
          <div class="cd-num" id="cd-${cd.id}-h" style="font-family:'Syne',sans-serif;font-weight:800;font-size:32px;color:var(--accent);line-height:1;">00</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-top:4px;">Hours</div>
        </div>
        <div style="font-size:28px;color:var(--text-muted);line-height:1.2;">:</div>
        <div style="text-align:center;">
          <div class="cd-num" id="cd-${cd.id}-m" style="font-family:'Syne',sans-serif;font-weight:800;font-size:32px;color:var(--accent);line-height:1;">00</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-top:4px;">Mins</div>
        </div>
        <div style="font-size:28px;color:var(--text-muted);line-height:1.2;">:</div>
        <div style="text-align:center;">
          <div class="cd-num" id="cd-${cd.id}-s" style="font-family:'Syne',sans-serif;font-weight:800;font-size:32px;color:var(--accent);line-height:1;">00</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-top:4px;">Secs</div>
        </div>
      </div>`;

    container.appendChild(wrapper);

    // Tick every second
    function tick() {
      const diff = target - new Date();
      if (diff <= 0) {
        document.getElementById(`cd-${cd.id}-d`).textContent = '00';
        document.getElementById(`cd-${cd.id}-h`).textContent = '00';
        document.getElementById(`cd-${cd.id}-m`).textContent = '00';
        document.getElementById(`cd-${cd.id}-s`).textContent = '00';
        return;
      }
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000)  / 60000);
      const secs  = Math.floor((diff % 60000)    / 1000);
      const pad   = n => String(n).padStart(2,'0');
      document.getElementById(`cd-${cd.id}-d`).textContent = pad(days);
      document.getElementById(`cd-${cd.id}-h`).textContent = pad(hours);
      document.getElementById(`cd-${cd.id}-m`).textContent = pad(mins);
      document.getElementById(`cd-${cd.id}-s`).textContent = pad(secs);
    }
    tick();
    setInterval(tick, 1000);
  });
}

// ── Polls & Q&A ──────────────────────────────────────────────
function renderPolls(polls) {
  const container = document.getElementById('bio-polls');
  if (!container) return;
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = '12px';
  container.style.width = '100%';

  window._bioPolls = polls;

  polls.forEach(poll => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;max-width:480px;background:var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px 22px;';

    if (poll.type === 'qa') {
      // Q&A widget
      wrapper.innerHTML = `
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.12em;font-family:monospace;margin-bottom:6px;">💬 Ask me</div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:14px;">${escHtml(poll.question)}</div>
        <textarea id="qa-${poll.id}" rows="3" placeholder="Type your question..." maxlength="500"
          style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;color:var(--text-primary);font-size:13px;resize:none;outline:none;font-family:inherit;"></textarea>
        <button onclick="submitQA('${poll.id}')" id="qa-btn-${poll.id}"
          style="margin-top:10px;width:100%;padding:11px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">
          Send question →
        </button>
        <div id="qa-thanks-${poll.id}" style="display:none;text-align:center;padding:12px;color:#4ade80;font-size:14px;font-weight:700;">✓ Thanks! Question sent 🎉</div>`;
    } else {
      // Poll widget
      const opts = poll.options || [];
      const optHtml = opts.map((opt, i) =>
        `<button onclick="submitVote('${poll.id}', ${i})" id="poll-opt-${poll.id}-${i}"
          style="width:100%;padding:11px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:var(--text-primary);font-size:13px;font-weight:500;cursor:pointer;text-align:left;margin-bottom:8px;transition:all 0.15s;"
          onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">
          ${escHtml(opt)}
        </button>`
      ).join('');
      wrapper.innerHTML = `
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.12em;font-family:monospace;margin-bottom:6px;">📊 Vote</div>
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:14px;">${escHtml(poll.question)}</div>
        <div id="poll-options-${poll.id}">${optHtml}</div>
        <div id="poll-results-${poll.id}" style="display:none;"></div>`;
    }
    container.appendChild(wrapper);
  });
}

async function submitVote(pollId, optionIndex) {
  // Disable all buttons
  const poll = document.getElementById(`poll-options-${pollId}`);
  if (poll) poll.querySelectorAll('button').forEach(b => b.disabled = true);
  const ok = await submitPollResponse(pollId, optionIndex, null);
  if (!ok) return;
  // Load and show results
  const results = await getPollResults(pollId);
  const poll2 = document.getElementById(`poll-options-${pollId}`);
  const resDiv = document.getElementById(`poll-results-${pollId}`);
  if (poll2) poll2.style.display = 'none';
  if (resDiv) {
    // Get options from the poll data
    const allPolls = window._bioPolls || [];
    const pollData = allPolls.find(p => p.id === pollId);
    const opts = pollData ? (pollData.options || []) : [];
    const total = results.length || 1;
    resDiv.style.display = 'block';
    resDiv.innerHTML = '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Results · ' + results.length + ' vote' + (results.length === 1 ? '' : 's') + '</div>' +
      opts.map((opt, i) => {
        const count = results.filter(r => r.option_index === i).length;
        const pct   = Math.round((count / total) * 100);
        const isSelected = i === optionIndex;
        return '<div style="margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">' +
            '<span style="' + (isSelected ? 'color:var(--accent);font-weight:700;' : '') + '">' + escHtml(opt) + (isSelected ? ' ✓' : '') + '</span>' +
            '<span style="color:var(--accent);">' + pct + '%</span>' +
          '</div>' +
          '<div style="background:rgba(255,255,255,0.07);border-radius:99px;height:7px;overflow:hidden;">' +
            '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:99px;"></div>' +
          '</div>' +
        '</div>';
      }).join('');
  }
}

async function submitQA(pollId) {
  const ta  = document.getElementById(`qa-${pollId}`);
  const btn = document.getElementById(`qa-btn-${pollId}`);
  const thanks = document.getElementById(`qa-thanks-${pollId}`);
  if (!ta || !ta.value.trim()) return;
  if (btn) btn.disabled = true;
  const ok = await submitPollResponse(pollId, null, ta.value.trim());
  if (ok) {
    if (ta) ta.style.display = 'none';
    if (btn) btn.style.display = 'none';
    if (thanks) thanks.style.display = 'block';
  } else {
    if (btn) btn.disabled = false;
  }
}

// ── Guestbook ────────────────────────────────────────────────
const GB_EMOJIS = [
  '👋','❤️','🔥','⭐','🎉','👏','😍','🙌','💯','🚀',
  '😊','💪','🤩','✨','👍','🎊','💫','🌟','😎','🙏',
  '😂','🥰','😭','🤣','😆','🥳','😜','🤯','😇','🫶',
  '🎯','🏆','💎','🎸','🌈','🦋','🍀','🌸','🎨','⚡',
  '🐉','🦄','🍕','☕','🎵','📸','💡','🌍','🤝','💬'
];
const GB_DAILY_LIMIT = 5;
let _gbProfileId = null;
let _gbSelectedEmoji = '👋';

function _gbGetTodayKey() {
  return 'vl_gb_' + new Date().toISOString().slice(0, 10);
}
function _gbCanPost() {
  const count = parseInt(localStorage.getItem(_gbGetTodayKey()) || '0', 10);
  return count < GB_DAILY_LIMIT;
}
function _gbIncrementCount() {
  const key = _gbGetTodayKey();
  const count = parseInt(localStorage.getItem(key) || '0', 10);
  localStorage.setItem(key, count + 1);
}

function renderGuestbook(entries, profileId) {
  const container = document.getElementById('bio-guestbook');
  if (!container) return;
  _gbProfileId = profileId;

  const entriesHtml = entries.length > 0
    ? entries.map(e => {
        const ago = _gbTimeAgo(new Date(e.created_at));
        return `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:24px;flex-shrink:0;width:36px;text-align:center;">${e.emoji}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px;">
              <span style="font-size:13px;font-weight:700;color:var(--text-primary);">${escHtml(e.visitor_name)}</span>
              <span style="font-size:11px;color:var(--text-muted);">${ago}</span>
            </div>
            <div style="font-size:13px;color:var(--text-muted);line-height:1.5;word-break:break-word;">${escHtml(e.message)}</div>
          </div>
        </div>`;
      }).join('')
    : `<div id="gb-no-msg" style="text-align:center;padding:24px 0;color:var(--text-muted);font-size:13px;">No messages yet — be the first! 👋</div>`;

  container.innerHTML = `
    <div style="width:100%;max-width:480px;margin:0 auto;">
      <div style="background:var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px 22px;">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.12em;font-family:monospace;margin-bottom:14px;">✍️ Guestbook</div>
        <div id="gb-entries" style="max-height:320px;overflow-y:auto;">${entriesHtml}</div>
        <!-- Leave a message form -->
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
          <input id="gb-name" type="text" maxlength="40" placeholder="Your name"
            style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;color:var(--text-primary);font-size:13px;margin-bottom:10px;box-sizing:border-box;outline:none;font-family:inherit;" />
          <!-- Emoji picker -->
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div id="gb-emoji-preview" style="font-size:26px;flex-shrink:0;width:36px;text-align:center;">👋</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
              ${GB_EMOJIS.map(em => `<span onclick="gbSelectEmoji(this,'${em}')" data-emoji="${em}"
                style="font-size:18px;cursor:pointer;padding:4px 5px;border-radius:8px;border:2px solid ${em==='👋'?'var(--accent)':'transparent'};transition:border-color 0.15s;">${em}</span>`).join('')}
            </div>
          </div>
          <textarea id="gb-msg" maxlength="140" rows="2" placeholder="Leave a message… (140 chars)"
            style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;color:var(--text-primary);font-size:13px;resize:none;box-sizing:border-box;outline:none;font-family:inherit;" oninput="document.getElementById('gb-chars').textContent=140-this.value.length"></textarea>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
            <div style="display:flex;flex-direction:column;gap:2px;">
              <span id="gb-chars" style="font-size:11px;color:var(--text-muted);">140</span>
              <span id="gb-remaining" style="font-size:11px;color:var(--text-muted);"></span>
            </div>
            <button onclick="gbSubmit()" id="gb-submit-btn"
              style="padding:9px 22px;background:linear-gradient(135deg,var(--accent),var(--accent-2));border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">
              Post 📮
            </button>
          </div>
          <div id="gb-error" style="color:#ef4444;font-size:12px;margin-top:6px;min-height:16px;"></div>
          <div id="gb-thanks" style="display:none;text-align:center;padding:10px 0;color:var(--accent);font-size:13px;font-weight:600;">Message posted! 🎉</div>
        </div>
      </div>
    </div>`;
  container.style.display = 'block';
  _gbUpdateRemaining();
}

function _gbUpdateRemaining() {
  const el = document.getElementById('gb-remaining');
  if (!el) return;
  const used = parseInt(localStorage.getItem(_gbGetTodayKey()) || '0', 10);
  const left = GB_DAILY_LIMIT - used;
  el.textContent = left > 0 ? `${left} of ${GB_DAILY_LIMIT} posts left today` : 'Daily limit reached';
  el.style.color = left <= 1 ? '#f59e0b' : 'var(--text-muted)';
}

function gbSelectEmoji(el, emoji) {
  _gbSelectedEmoji = emoji;
  document.querySelectorAll('[data-emoji]').forEach(e => e.style.borderColor = 'transparent');
  el.style.borderColor = 'var(--accent)';
  const preview = document.getElementById('gb-emoji-preview');
  if (preview) preview.textContent = emoji;
}

async function gbSubmit() {
  const name = (document.getElementById('gb-name')?.value || '').trim();
  const msg  = (document.getElementById('gb-msg')?.value  || '').trim();
  const btn  = document.getElementById('gb-submit-btn');
  const thanks = document.getElementById('gb-thanks');
  const errEl = document.getElementById('gb-error');
  if (errEl) errEl.textContent = '';
  if (!_gbCanPost()) {
    if (errEl) errEl.textContent = '⚠ You\'ve reached the limit of 3 messages today — come back tomorrow!';
    return;
  }
  const nameEl = document.getElementById('gb-name');
  const msgEl  = document.getElementById('gb-msg');
  if (!name) {
    if (nameEl) { nameEl.style.borderColor = '#ef4444'; nameEl.focus(); }
    if (errEl)  errEl.textContent = '⚠ Please enter your name';
    return;
  }
  if (!msg) {
    if (msgEl)  { msgEl.style.borderColor = '#ef4444'; msgEl.focus(); }
    if (errEl)  errEl.textContent = '⚠ Please write a message';
    return;
  }
  if (nameEl) nameEl.style.borderColor = '';
  if (msgEl)  msgEl.style.borderColor  = '';
  if (btn) btn.disabled = true;
  const ok = await addGuestbookEntry(_gbProfileId, name, _gbSelectedEmoji, msg);
  if (ok) {
    // Prepend entry to list without reload
    const wrap = document.getElementById('gb-entries');
    const noMsg = document.getElementById('gb-no-msg');
    if (noMsg) noMsg.remove();
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);';
    row.innerHTML = `<div style="font-size:24px;flex-shrink:0;width:36px;text-align:center;">${_gbSelectedEmoji}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px;">
          <span style="font-size:13px;font-weight:700;color:var(--text-primary);">${escHtml(name)}</span>
          <span style="font-size:11px;color:var(--text-muted);">just now</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5;">${escHtml(msg)}</div>
      </div>`;
    wrap?.insertBefore(row, wrap.firstChild);
    _gbIncrementCount();
    _gbUpdateRemaining();
    document.getElementById('gb-name').value = '';
    document.getElementById('gb-msg').value  = '';
    document.getElementById('gb-chars').textContent = '140';
    if (thanks) thanks.style.display = 'block';
    setTimeout(() => { if (thanks) thanks.style.display = 'none'; }, 3000);
  }
  if (btn) btn.disabled = false;
}

function _gbTimeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400)return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}

// ── Tip Jar ──────────────────────────────────────────────────
function renderTipJar(tj) {
  const container = document.getElementById('bio-tipjar');
  if (!container) return;

  const cur      = tj.currency || '£';
  const goal     = parseFloat(tj.goal_amount || 0);
  const current  = parseFloat(tj.current_amount || 0);
  const hasGoal  = goal > 0;
  const pct      = hasGoal ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  const progressHtml = hasGoal ? `
    <div style="margin:14px 0 6px;">
      <div style="background:rgba(255,255,255,0.1);border-radius:99px;height:10px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:99px;transition:width 0.6s ease;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--text-muted);">
        <span>${cur}${current.toLocaleString()} raised</span>
        <span>${pct}% of ${cur}${goal.toLocaleString()} goal</span>
      </div>
    </div>` : '';

  container.innerHTML = `
    <div style="width:100%;max-width:480px;background:var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px 22px;text-align:center;">
      <div style="font-size:28px;margin-bottom:8px;">☕</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">${escHtml(tj.title || 'Support my work')}</div>
      ${tj.description ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">${escHtml(tj.description)}</div>` : ''}
      ${progressHtml}
      <a href="${escHtml(tj.payment_link)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;margin-top:14px;padding:12px 32px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-radius:99px;font-size:14px;font-weight:700;text-decoration:none;transition:opacity 0.15s;"
        onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
        ☕ Support me
      </a>
    </div>`;
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
}

// ── Shared Calendar ──────────────────────────────────────────
function renderCalendar(events) {
  const container = document.getElementById('bio-calendar');
  if (!container) return;
  const now = new Date();

  // Split into upcoming and past
  const upcoming = events.filter(e => new Date(e.event_date) >= now);
  const past     = events.filter(e => new Date(e.event_date) <  now);
  const toShow   = upcoming.length > 0 ? upcoming : past;
  if (toShow.length === 0) return;

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.gap = '0';
  container.style.width = '100%';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;max-width:480px;background:var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;';

  const header = document.createElement('div');
  header.style.cssText = 'padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,0.06);';
  header.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.12em;font-family:monospace;">📅 ' + (upcoming.length > 0 ? 'Upcoming Events' : 'Past Events') + '</div>';
  wrap.appendChild(header);

  toShow.forEach((ev, i) => {
    const d       = new Date(ev.event_date);
    const isPast  = d < now;
    const dayStr  = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:14px;padding:14px 20px;' +
      (i < toShow.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,0.04);' : '') +
      (isPast ? 'opacity:0.5;' : '');

    // Date badge
    const badge = document.createElement('div');
    badge.style.cssText = 'flex-shrink:0;width:44px;text-align:center;background:rgba(129,140,248,0.12);border-radius:10px;padding:6px 4px;';
    badge.innerHTML =
      '<div style="font-size:10px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.08em;">' +
        d.toLocaleDateString('en-GB', { month: 'short' }) +
      '</div>' +
      '<div style="font-size:20px;font-weight:800;color:var(--text-primary);line-height:1.1;">' +
        d.getDate() +
      '</div>';

    // Info
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;';
    info.innerHTML =
      '<div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">' + escHtml(ev.title) + '</div>' +
      '<div style="font-size:12px;color:var(--text-muted);">' + dayStr + ' · ' + timeStr + '</div>' +
      (ev.description ? '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + escHtml(ev.description) + '</div>' : '');

    row.appendChild(badge);
    row.appendChild(info);

    // Link button
    if (ev.link_url && !isPast) {
      const btn = document.createElement('a');
      btn.href = ev.link_url;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.style.cssText = 'flex-shrink:0;padding:7px 14px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-radius:99px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;';
      btn.textContent = 'Join →';
      row.appendChild(btn);
    }

    wrap.appendChild(row);
  });

  container.appendChild(wrap);
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

// ── Device detection ─────────────────────────────────────────
function getDeviceType() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

// ── Click tracking ───────────────────────────────────────────
async function handleClick(link, el) {
  // A/B variant from element data attribute
  const abVariant = (el && el.dataset.abVariant) || null;
  // Track click in background — don't await so page feels instant
  trackClick(link.id, window._pageReferrer, abVariant).catch(() => {});
  // Smart link routing
  let url = link.url;
  const device = getDeviceType();
  if (device === 'ios'     && link.ios_url)     url = link.ios_url;
  else if (device === 'android' && link.android_url) url = link.android_url;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Gate unlock ──────────────────────────────────────────────
function unlockGatedLink(linkId, encodedUrl) {
  // Persist unlock in localStorage
  localStorage.setItem(`vl_gate_${linkId}`, '1');

  // Swap the locked card for a success flash, then open the link
  const card = document.getElementById(`gate-card-${linkId}`);
  if (card) {
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="link-icon" style="background:rgba(74,222,128,0.15);flex-shrink:0;">✅</div>
        <div class="link-text">
          <div class="link-title" style="color:#4ade80;">Unlocked! Opening…</div>
          <div class="link-desc" style="font-size:11px;color:var(--text-muted);">This link is now permanently unlocked for you</div>
        </div>
      </div>`;
    card.style.cursor = 'default';
  }

  // Open the destination URL
  const url = decodeURIComponent(encodedUrl);
  setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 400);
}

// ── Themes ───────────────────────────────────────────────────
const themes = {
  midnight: { bg: '#08080f', surface: '#13131a', card: '#1a1a24', accent: '#818cf8', accent2: '#a78bfa' },
  ocean:    { bg: '#0a1628', surface: '#0f2040', card: '#132850', accent: '#38bdf8', accent2: '#818cf8' },
  lime:     { bg: '#0a0f0a', surface: '#0d140d', card: '#111a11', accent: '#c8f135', accent2: '#4ade80' },
  light:    { bg: '#f8f8fc', surface: '#ffffff', card: '#f0f0f8', accent: '#6366f1', accent2: '#a78bfa', isLight: true },
  galaxy:   { bg: '#0d0520', surface: '#160a30', card: '#1e1040', accent: '#d946ef', accent2: '#a78bfa' },
  sunset:   { bg: '#0f0a05', surface: '#1a1005', card: '#221508', accent: '#f59e0b', accent2: '#ef4444' },
  // ── Dynamic time-of-day themes ───────────────────────────
  dawn:     { bg: '#0f0a05', surface: '#1a1008', card: '#22150a', accent: '#fb923c', accent2: '#f59e0b' },
  day:      { bg: '#f5f3ff', surface: '#ffffff', card: '#ede9fe', accent: '#4f46e5', accent2: '#7c3aed', isLight: true },
  dusk:     { bg: '#0f0a18', surface: '#180f28', card: '#201438', accent: '#f472b6', accent2: '#c084fc' },
  night:    { bg: '#08080f', surface: '#13131a', card: '#1a1a24', accent: '#818cf8', accent2: '#a78bfa' },
};

function applyTheme(name) {
  const t = themes[name] || themes.midnight;
  const root = document.documentElement;
  root.style.setProperty('--bg',       t.bg);
  root.style.setProperty('--surface',  t.surface);
  root.style.setProperty('--card',     t.card);
  root.style.setProperty('--accent',   t.accent);
  root.style.setProperty('--accent-2', t.accent2);
  if (t.isLight) {
    root.style.setProperty('--text-primary', '#111118');
    root.style.setProperty('--text-muted',   '#55558a');
    root.style.setProperty('--border',       'rgba(0,0,0,0.08)');
  } else {
    root.style.setProperty('--text-primary', '#f0f0f5');
    root.style.setProperty('--text-muted',   '#7878a0');
    root.style.setProperty('--border',       'rgba(255,255,255,0.06)');
  }
}

// Returns the time-of-day theme name based on the visitor's local hour
function getDynamicThemeName() {
  const h = new Date().getHours();
  if (h >= 5  && h < 9)  return 'dawn';   // 5am – 9am  🌅
  if (h >= 9  && h < 17) return 'day';    // 9am – 5pm  ☀️
  if (h >= 17 && h < 21) return 'dusk';   // 5pm – 9pm  🌆
  return 'night';                          // 9pm – 5am  🌙
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

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Chat widget ───────────────────────────────────────────────
let chatConversationId   = sessionStorage.getItem('vl_conv_id') || null;
let chatProfileId        = null;
let chatProfileEmail     = null;
let chatProfileName      = null;
let chatPageUrl          = null;
let chatAutoReplyEnabled = false;
let chatAutoReplyContext = null;
let chatProfileIsPro     = false;
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
  chatProfileIsPro     = profile.is_pro || false;

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

    // AI auto-reply if enabled and owner is Pro (fire and forget)
    if (chatAutoReplyEnabled && chatProfileIsPro) {
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

function renderVCard(v) {
  const el = document.getElementById('bio-vcard');
  if (!el) return;
  el.innerHTML = `
    <div style="margin:16px 0;text-align:center;">
      <button onclick="downloadVCard()" style="
        display:inline-flex;align-items:center;gap:8px;
        background:#fff;border:2px solid #e2e8f0;
        color:#334155;font-size:15px;font-weight:600;
        padding:12px 28px;border-radius:50px;cursor:pointer;
        box-shadow:0 2px 8px rgba(0,0,0,0.08);
        transition:all 0.2s;
      " onmouseover="this.style.borderColor='#6366f1';this.style.color='#6366f1'"
         onmouseout="this.style.borderColor='#e2e8f0';this.style.color='#334155'">
        <span style="font-size:18px;">📇</span> Save Contact
      </button>
    </div>`;
  window._bioVCard = v;
}

function downloadVCard() {
  const v = window._bioVCard;
  if (!v) return;
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (v.display_name) lines.push(`FN:${v.display_name}`);
  if (v.email)        lines.push(`EMAIL:${v.email}`);
  if (v.phone)        lines.push(`TEL:${v.phone}`);
  if (v.company)      lines.push(`ORG:${v.company}`);
  if (v.job_title)    lines.push(`TITLE:${v.job_title}`);
  if (v.website)      lines.push(`URL:${v.website}`);
  lines.push('END:VCARD');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(v.display_name || 'contact').replace(/\s+/g, '_')}.vcf`;
  a.click();
}

function renderEmailWidget(widget, userId, count) {
  const el = document.getElementById('bio-email-widget');
  if (!el) return;
  window._emailUserId = userId;

  const counterHtml = widget.show_counter && count > 0
    ? `<div style="text-align:center;margin-bottom:12px;font-size:13px;color:var(--text-muted);">
        <span style="color:var(--accent);font-weight:700;">${count.toLocaleString()}</span> people joined
       </div>`
    : '';

  el.innerHTML = `
    <div style="width:100%;max-width:480px;margin:16px auto 0;background:var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:24px 22px;">
      <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:6px;text-align:center;">
        ${escHtml(widget.title || 'Join my newsletter')}
      </div>
      ${widget.description ? `<div style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:14px;">${escHtml(widget.description)}</div>` : '<div style="margin-bottom:14px;"></div>'}
      ${counterHtml}
      <div id="email-widget-form">
        <input id="ew-name" type="text" placeholder="Your name (optional)"
          style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none;margin-bottom:10px;box-sizing:border-box;font-family:inherit;" />
        <input id="ew-email" type="email" placeholder="Your email address"
          style="width:100%;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:var(--text-primary);font-size:13px;outline:none;margin-bottom:12px;box-sizing:border-box;font-family:inherit;" />
        <button onclick="submitEmailSignupForm('${userId}')"
          style="width:100%;padding:12px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
          ${escHtml(widget.button_text || 'Subscribe')} →
        </button>
        <div id="ew-error" style="display:none;color:#f87171;font-size:12px;text-align:center;margin-top:8px;"></div>
      </div>
      <div id="email-widget-thanks" style="display:none;text-align:center;padding:16px 0;">
        <div style="font-size:28px;margin-bottom:8px;">🎉</div>
        <div style="font-size:15px;font-weight:700;color:var(--text-primary);">You're in!</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Thanks for subscribing.</div>
      </div>
    </div>`;
}

async function submitEmailSignupForm(userId) {
  const emailEl = document.getElementById('ew-email');
  const nameEl  = document.getElementById('ew-name');
  const errEl   = document.getElementById('ew-error');
  const email   = emailEl ? emailEl.value.trim() : '';
  const name    = nameEl  ? nameEl.value.trim()  : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent = 'Please enter a valid email address.'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  const ok = await submitEmailSignup(userId, email, name);
  if (ok) {
    const form   = document.getElementById('email-widget-form');
    const thanks = document.getElementById('email-widget-thanks');
    if (form)   form.style.display   = 'none';
    if (thanks) thanks.style.display = 'block';
  } else {
    if (errEl) { errEl.textContent = 'Something went wrong. Please try again.'; errEl.style.display = 'block'; }
  }
}

// ── Visitor theme toggle ──────────────────────────────────────
let _creatorTheme = 'midnight';
let _visitorLight = false;

function initThemeToggle(themeName) {
  _creatorTheme = themeName || 'midnight';
  // Check localStorage for visitor preference
  const saved = localStorage.getItem('vl_visitor_theme');
  if (saved === 'light') {
    _visitorLight = true;
    applyTheme('light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '☀️';
  }
}

function toggleVisitorTheme() {
  _visitorLight = !_visitorLight;
  const btn = document.getElementById('theme-toggle');
  if (_visitorLight) {
    applyTheme('light');
    localStorage.setItem('vl_visitor_theme', 'light');
    if (btn) btn.textContent = '☀️';
  } else {
    applyTheme(_creatorTheme);
    localStorage.setItem('vl_visitor_theme', 'dark');
    if (btn) btn.textContent = '🌙';
  }
}

// ── Pixel injection ───────────────────────────────────────────
function injectPixels(px) {
  // Meta (Facebook) Pixel
  if (px.meta_pixel_id) {
    (function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js'));
    window.fbq('init', px.meta_pixel_id);
    window.fbq('track', 'PageView');
  }

  // TikTok Pixel
  if (px.tiktok_pixel_id) {
    (function(w,d,t){
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
      ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
      ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
      for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
      ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
      ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
      ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement('script');
      o.type='text/javascript';o.async=!0;o.src=i+'?sdkid='+e+'&lib='+t;
      var s=document.getElementsByTagName('script')[0];s.parentNode.insertBefore(o,s)};
      ttq.load(px.tiktok_pixel_id);ttq.page();
    }(window,document,'ttq'));
  }

  // Google Analytics 4
  if (px.ga_id) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + px.ga_id;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', px.ga_id);
  }
}
