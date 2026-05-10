// ============================================================
//  VoilaLink — LemonSqueezy Webhook (Vercel Serverless)
//  Listens for successful payments and upgrades user to Pro
// ============================================================

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret    = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_KEY;

  if (!secret || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Verify webhook signature
  const signature = req.headers['x-signature'];
  const rawBody   = JSON.stringify(req.body);
  const hmac      = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (signature !== hmac) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event     = req.body;
  const eventName = event?.meta?.event_name;

  // Only handle successful orders/subscriptions
  if (!['order_created', 'subscription_created'].includes(eventName)) {
    return res.status(200).json({ received: true });
  }

  const customerEmail = event?.data?.attributes?.user_email;
  if (!customerEmail) return res.status(200).json({ received: true });

  try {
    const db = createClient(supabaseUrl, supabaseKey);

    // Find user by email and set is_pro = true
    const { data: { users }, error: userError } = await db.auth.admin.listUsers();
    if (userError) throw userError;

    const user = users.find(u => u.email === customerEmail);
    if (!user) {
      console.log('No user found for email:', customerEmail);
      return res.status(200).json({ received: true });
    }

    const { error } = await db
      .from('profiles')
      .update({ is_pro: true })
      .eq('id', user.id);

    if (error) throw error;

    console.log('Upgraded to Pro:', customerEmail);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};
