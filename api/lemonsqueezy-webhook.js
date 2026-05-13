// ============================================================
//  VoilaLink — LemonSqueezy Webhook (Vercel Serverless)
//  Listens for successful payments and upgrades user to Pro
//  Uses fetch only — no npm dependencies needed
// ============================================================

const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret      = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

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
    // Find user by email using Supabase Auth Admin API
    const userRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(customerEmail)}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      }
    });
    const userData = await userRes.json();
    const user = userData?.users?.[0];

    if (!user) {
      console.log('No user found for email:', customerEmail);
      return res.status(200).json({ received: true });
    }

    // Set is_pro = true on their profile
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      },
      body: JSON.stringify({ is_pro: true })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error('DB update error: ' + errText);
    }

    console.log('Upgraded to Pro:', customerEmail);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
};
