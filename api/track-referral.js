// ============================================================
//  VoilaLink — Track Referral (Vercel Serverless)
//  Called after a new user signs up via a referral link.
//  Records the referral and upgrades referrer to Pro after 5.
// ============================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { referrerUsername, referredUserId } = req.body || {};
  if (!referrerUsername || !referredUserId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const db = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Find referrer profile by username
    const { data: referrer, error: refErr } = await db
      .from('profiles')
      .select('id, referral_count, is_pro, pro_until')
      .eq('username', referrerUsername)
      .single();

    if (refErr || !referrer) {
      return res.status(404).json({ error: 'Referrer not found' });
    }

    // 2. Prevent self-referral
    if (referrer.id === referredUserId) {
      return res.status(400).json({ error: 'Cannot refer yourself' });
    }

    // 3. Check if this referred user has already been tracked (prevent duplicates)
    const { data: existing } = await db
      .from('referrals')
      .select('id')
      .eq('referred_id', referredUserId)
      .single();

    if (existing) {
      return res.status(200).json({ message: 'Already tracked' });
    }

    // 4. Insert referral record
    const { error: insertErr } = await db.from('referrals').insert({
      referrer_id: referrer.id,
      referred_id: referredUserId
    });
    if (insertErr) throw insertErr;

    // 5. Mark the new user as referred
    await db.from('profiles')
      .update({ referred_by: referrerUsername })
      .eq('id', referredUserId);

    // 6. Count total confirmed referrals for referrer
    const { count } = await db
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrer.id);

    const newCount = count || 0;

    // 7. Update referral_count on referrer profile
    const updates = { referral_count: newCount };

    // 8. Every 5 referrals, grant 1 month Pro
    if (newCount > 0 && newCount % 5 === 0) {
      const base = (referrer.pro_until && new Date(referrer.pro_until) > new Date())
        ? new Date(referrer.pro_until)   // extend existing Pro
        : new Date();                    // start from now
      base.setMonth(base.getMonth() + 1);
      updates.is_pro     = true;
      updates.pro_until  = base.toISOString();
    }

    await db.from('profiles').update(updates).eq('id', referrer.id);

    return res.status(200).json({
      success:       true,
      referralCount: newCount,
      proGranted:    newCount % 5 === 0
    });

  } catch (err) {
    console.error('track-referral error:', err);
    return res.status(500).json({ error: err.message });
  }
};
