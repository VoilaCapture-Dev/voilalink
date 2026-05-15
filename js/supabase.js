// ============================================================
//  VoilaLink — Supabase client
// ============================================================
'use strict';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ─────────────────────────────────────────────

async function getUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function getProfileByUsername(username) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  if (error) throw error;
  return data;
}

// ── Link helpers ─────────────────────────────────────────────

async function getLinks(userId) {
  const { data, error } = await db
    .from('links')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
}

async function getPublicPolls(userId) {
  const { data } = await db
    .from('polls')
    .select('*')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .order('created_at', { ascending: false });
  return data || [];
}

async function submitPollResponse(pollId, optionIndex, answer) {
  const { error } = await db.from('poll_responses').insert({
    poll_id: pollId,
    option_index: optionIndex !== null ? optionIndex : null,
    answer: answer || null
  });
  return !error;
}

async function getPollResults(pollId) {
  const { data } = await db.from('poll_responses').select('option_index, answer').eq('poll_id', pollId);
  return data || [];
}

async function getPublicCountdowns(userId) {
  const { data } = await db
    .from('countdowns')
    .select('*')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .order('target_date', { ascending: true });
  return data || [];
}

async function getPublicTipJar(userId) {
  const { data } = await db
    .from('tip_jar')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data || null;
}

async function getPublicLinks(userId) {
  const { data, error } = await db
    .from('links')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
}

async function addLink(link) {
  const { data, error } = await db
    .from('links')
    .insert(link)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateLink(id, updates) {
  const { data, error } = await db
    .from('links')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteLink(id) {
  const { error } = await db.from('links').delete().eq('id', id);
  if (error) throw error;
}

async function trackClick(linkId, referrer) {
  await db.from('link_clicks').insert({
    link_id: linkId,
    referrer: referrer || null
  });
}

async function getLinkClicks(userId) {
  const { data, error } = await db
    .from('link_clicks')
    .select('link_id, clicked_at, links!inner(user_id, title, emoji)')
    .eq('links.user_id', userId);
  if (error) throw error;
  return data;
}

// ── Username availability ────────────────────────────────────

async function isUsernameAvailable(username) {
  const { data } = await db
    .from('profiles')
    .select('username')
    .eq('username', username)
    .single();
  return !data; // true = available
}

// ── Chat helpers ─────────────────────────────────────────────

async function createConversation(profileId, visitorName, visitorEmail) {
  const { data, error } = await db
    .from('conversations')
    .insert({ profile_id: profileId, visitor_name: visitorName, visitor_email: visitorEmail || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function sendMessage(conversationId, sender, content) {
  const { data, error } = await db
    .from('messages')
    .insert({ conversation_id: conversationId, sender, content })
    .select()
    .single();
  if (error) throw error;
  // Update conversation timestamp + unread flag
  await db.from('conversations').update({
    last_message_at: new Date().toISOString(),
    has_unread: sender === 'visitor'
  }).eq('id', conversationId);
  return data;
}

async function getConversations(profileId) {
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .eq('profile_id', profileId)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function getMessages(conversationId) {
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

async function markConversationRead(conversationId) {
  await db.from('conversations')
    .update({ has_unread: false })
    .eq('id', conversationId);
}

async function getPublicVCard(userId) {
  const { data } = await db
    .from('vcard_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .single();
  return data || null;
}

async function saveVCardSettings(userId, settings) {
  const { data, error } = await db
    .from('vcard_settings')
    .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Email Widget helpers ─────────────────────────────────────

async function getPublicEmailWidget(userId) {
  const { data } = await db
    .from('email_widget')
    .select('*')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .single();
  return data || null;
}

async function getSignupCount(userId) {
  const { count } = await db
    .from('email_signups')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count || 0;
}

async function submitEmailSignup(userId, email, name) {
  const { error } = await db
    .from('email_signups')
    .insert({ user_id: userId, email, name: name || null });
  return !error;
}

async function getEmailSignups(userId) {
  const { data, error } = await db
    .from('email_signups')
    .select('*')
    .eq('user_id', userId)
    .order('signed_up_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function saveEmailWidget(userId, settings) {
  const { error } = await db
    .from('email_widget')
    .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function getReferrerStats(userId) {
  const { data, error } = await db
    .from('link_clicks')
    .select('referrer, clicked_at, links!inner(user_id)')
    .eq('links.user_id', userId);
  if (error) throw error;
  return data || [];
}
