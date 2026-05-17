// ============================================================
//  VoilaLink — AI Outreach Generator (Vercel Serverless)
// ============================================================

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { creatorName, platform, niche, profileUrl, notes } = req.body || {};

  if (!creatorName) {
    return res.status(400).json({ error: 'Creator name is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `Write a short, genuine outreach DM to a social media creator for VoilaLink using the exact template below. Personalise ONLY the first two sentences based on the creator's details — keep everything else exactly as written.

Creator details:
- Name: ${creatorName}
- Platform: ${platform || 'TikTok / Instagram'}
- Niche: ${niche || 'content creator'}
- Profile URL: ${profileUrl || 'not provided'}
- Extra notes: ${notes || 'none'}

Template to follow:
---
Hey [Name],

I've been following your content and really like what you do. [Add one genuine sentence about their specific niche or content style.]

I'm the founder of VoilaLink — one link that holds everything: your socials, content, bookings, newsletter and more. I'd love to give you a free Pro account to try it out, completely free, no catch.

👉 See it in action: voilalink.com/riorivera
👉 Learn more: voilalink.com

Just sign up at voilalink.com and reply to this message with your username — I'll upgrade your account to Pro straight away.

Your page would be live in minutes at voilalink.com/[their first name in lowercase] — and there's more on the table down the line if it's a good fit.

[Sender name]
---

Rules:
- Only personalise the opening two sentences
- Keep all links exactly as written
- Do not add "Interested?" or any closing question
- Do not change the tone or add extra sentences
- Write ONLY the message. No intro. No explanation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return res.status(500).json({ error: 'Claude error: ' + errorText });
    }

    const data = await response.json();
    const message = data.content[0].text.trim();

    return res.status(200).json({ message });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message + ' | key exists: ' + !!apiKey });
  }
}
