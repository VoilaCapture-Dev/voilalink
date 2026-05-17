// ============================================================
//  VoilaLink — LemonSqueezy Webhook (Vercel Serverless)
//  Listens for successful payments and upgrades user to Pro
// ============================================================

const crypto = require('crypto');

// Disable Vercel's default body parser so we get the raw bytes
// (required for HMAC signature verification)
module.exports.config = {
  api: { bodyParser: false }
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret      = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!secret || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  // Read raw body for signature verification
  const rawBody  = await getRawBody(req);
  const signature = req.headers['x-signature'];
  const hmac      = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (signature !== hmac) {
    console.error('Webhook signature mismatch');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event     = JSON.parse(rawBody);
  const eventName = event?.meta?.event_name;

  console.log('Webhook event received:', eventName);

  // Handle successful orders and subscription events
  const handledEvents = ['order_created', 'subscription_created', 'subscription_updated'];
  if (!handledEvents.includes(eventName)) {
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
        'Authorization': 'Bearer ' + supabaseKey,
        'Prefer': 'return=minimal'
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
