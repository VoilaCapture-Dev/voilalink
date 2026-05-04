-- ============================================================
--  VoilaLink — Supabase Database Schema
--  Paste this into: Supabase → SQL Editor → Run
-- ============================================================


-- ── Profiles ─────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  bio         TEXT,
  avatar_url  TEXT,
  theme       TEXT DEFAULT 'midnight',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Links ────────────────────────────────────────────────────
CREATE TABLE links (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  emoji       TEXT DEFAULT '🔗',
  description TEXT,
  section     TEXT DEFAULT 'custom',
  position    INTEGER DEFAULT 0,
  enabled     BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Link clicks (analytics) ───────────────────────────────────
CREATE TABLE link_clicks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id     UUID REFERENCES links(id) ON DELETE CASCADE NOT NULL,
  clicked_at  TIMESTAMPTZ DEFAULT NOW(),
  referrer    TEXT
);


-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;


-- profiles: anyone can read public profiles, only owner can write
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);


-- links: public can read enabled links, owner can do everything
CREATE POLICY "Enabled links are publicly readable"
  ON links FOR SELECT
  USING (enabled = true OR auth.uid() = user_id);

CREATE POLICY "Users can manage own links"
  ON links FOR ALL USING (auth.uid() = user_id);


-- clicks: anyone can insert (tracking), owner can read their own
CREATE POLICY "Anyone can record a click"
  ON link_clicks FOR INSERT WITH CHECK (true);

CREATE POLICY "Owners can read own link clicks"
  ON link_clicks FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM links WHERE id = link_id)
  );


-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
