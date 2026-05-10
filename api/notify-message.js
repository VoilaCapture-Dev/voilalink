// ============================================================
//  VoilaLink — Email Notification (Vercel Serverless)
//  Sends an email to the page owner when a visitor messages them
// ============================================================

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ownerEmail, ownerName, visitorName, message, pageUrl } = req.body || {};

  if (!ownerEmail || !visitorName || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Email service not configured' });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        from: 'VoilaLink <notifications@voilalink.com>',
        to: ownerEmail,
        subject: `💬 New message from ${visitorName} on your VoilaLink`,
        html: `
          <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#08080f;color:#f0f0f5;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#818cf8,#a78bfa);padding:28px 32px;">
              <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">VoilaLink</div>
              <div style="font-size:13px;opacity:0.85;margin-top:4px;">You have a new message!</div>
            </div>
            <div style="padding:28px 32px;">
              <p style="color:#7878a0;font-size:13px;margin:0 0 16px;">Hi ${ownerName || 'there'},</p>
              <p style="font-size:14px;margin:0 0 20px;"><strong style="color:#818cf8;">${visitorName}</strong> just sent you a message on your VoilaLink page:</p>
              <div style="background:#13131a;border:1px solid rgba(255,255,255,0.07);border-left:3px solid #818cf8;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                <p style="font-size:14px;line-height:1.6;margin:0;color:#f0f0f5;">${message}</p>
              </div>
              <a href="https://voilalink.com/dashboard.html#messages" style="display:inline-block;background:linear-gradient(135deg,#818cf8,#a78bfa);color:#fff;font-weight:700;font-size:13px;padding:12px 24px;border-radius:10px;text-decoration:none;">Reply in dashboard →</a>
              <p style="color:#7878a0;font-size:11px;margin-top:24px;">This message was sent via <a href="${pageUrl || 'https://voilalink.com'}" style="color:#818cf8;">${pageUrl || 'your VoilaLink page'}</a></p>
            </div>
          </div>
        `
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Email send failed: ' + err });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
