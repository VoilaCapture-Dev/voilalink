// ============================================================
//  VoilaLink — Auth (login.html)
// ============================================================
'use strict';

// ── Mode toggle ──────────────────────────────────────────────
function setMode(mode) {
  const isSignup = mode === 'signup';
  document.getElementById('signin-view').style.display = isSignup ? 'none' : 'block';
  document.getElementById('signup-view').style.display = isSignup ? 'block' : 'none';
  document.getElementById('signinBtn').classList.toggle('active', !isSignup);
  document.getElementById('signupBtn').classList.toggle('active',  isSignup);
}

// ── Password toggle ──────────────────────────────────────────
function togglePw(id, btn) {
  const input = document.getElementById(id);
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

// ── Username check ───────────────────────────────────────────
let usernameTimer = null;
async function checkUsername(input) {
  const val  = input.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  input.value = val;
  const hint  = document.getElementById('username-hint');

  if (!val) {
    hint.style.color = 'var(--text-muted)';
    hint.textContent = 'Pick your unique username — this is your public URL';
    return;
  }
  if (val.length < 3) {
    hint.style.color = '#f59e0b';
    hint.textContent = '⚠ Username must be at least 3 characters';
    return;
  }

  hint.style.color = 'var(--text-muted)';
  hint.textContent = 'Checking availability…';

  clearTimeout(usernameTimer);
  usernameTimer = setTimeout(async () => {
    try {
      const available = await isUsernameAvailable(val);
      if (available) {
        hint.style.color = 'var(--accent-lime)';
        hint.textContent = '✓ voilalink.com/' + val + ' is available!';
      } else {
        hint.style.color = 'var(--danger)';
        hint.textContent = '✗ @' + val + ' is taken — try another';
      }
    } catch {
      hint.style.color = 'var(--text-muted)';
      hint.textContent = 'Could not check — try again';
    }
  }, 500);
}

// ── Google sign in ───────────────────────────────────────────
async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/dashboard.html' }
  });
  if (error) showError(error.message);
}

// ── LinkedIn sign in ─────────────────────────────────────────
async function signInWithLinkedIn() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'linkedin_oidc',
    options: { redirectTo: window.location.origin + '/dashboard.html' }
  });
  if (error) showError(error.message);
}

// ── Email sign in ────────────────────────────────────────────
async function signIn() {
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('pw-signin').value;
  const btn      = document.getElementById('signin-submit');

  if (!email || !password) { showError('Please fill in all fields'); return; }

  btn.textContent = 'Signing in…'; btn.disabled = true;
  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.location.href = 'dashboard.html';
  } catch (e) {
    showError(e.message);
    btn.textContent = 'Sign in →'; btn.disabled = false;
  }
}

// ── Email sign up ────────────────────────────────────────────
async function signUp() {
  const name     = document.getElementById('signup-name').value.trim();
  const username = document.getElementById('username-input').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('pw-signup').value;
  const btn      = document.getElementById('signup-submit');

  if (!name || !username || !email || !password) { showError('Please fill in all fields'); return; }
  if (username.length < 3) { showError('Username must be at least 3 characters'); return; }
  if (password.length < 8) { showError('Password must be at least 8 characters'); return; }

  btn.textContent = 'Creating account…'; btn.disabled = true;
  try {
    // Check username availability one more time
    const available = await isUsernameAvailable(username);
    if (!available) throw new Error('That username is taken — please choose another');

    // Create auth user
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) throw error;

    // Create profile row
    const { error: profileError } = await db.from('profiles').insert({
      id:        data.user.id,
      username,
      full_name: name,
      theme:     'midnight'
    });
    if (profileError) throw profileError;

    // Track referral if user came via a referral link
    const ref = localStorage.getItem('vl_ref');
    if (ref && ref !== username) {
      localStorage.removeItem('vl_ref');
      fetch('/api/track-referral', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ referrerUsername: ref, referredUserId: data.user.id })
      }).catch(() => {}); // fire-and-forget
    }

    window.location.href = 'dashboard.html';
  } catch (e) {
    showError(e.message);
    btn.textContent = 'Create my free page →'; btn.disabled = false;
  }
}

// ── Error display ────────────────────────────────────────────
function showError(msg) {
  let el = document.getElementById('auth-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-error';
    el.style.cssText = 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 14px;font-size:12px;color:#ef4444;margin-bottom:14px;';
    document.querySelector('.auth-box').prepend(el);
  }
  el.textContent = '⚠ ' + msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── On load — redirect if already logged in ──────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const user = await getUser();
  if (user) window.location.href = 'dashboard.html';
});
