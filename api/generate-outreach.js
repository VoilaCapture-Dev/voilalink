// ============================================================
//  VoilaLink — AI Outreach Generator (Vercel Serverless)
// ============================================================

export default async function handler(req, res) {
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

  const prompt = `Write a short, genuine outreach DM to a social media creator for a partnership with VoilaLink.

VoilaLink is a free link-in-bio tool (like Linktree but better designed) at voilalink.com. It lets creators share all their links on one beautiful page.

Creator details:
- Name: ${creatorName}
- Platform: ${platform || 'TikTok / Instagram'}
- Niche: ${niche || 'content creator'}
- Profile URL: ${profileUrl || 'not provided'}
- Extra notes: ${notes || 'none'}

Write a DM that:
- Feels personal and genuine, not copy-paste or corporate
- Is 3-5 sentences max — short enough to read in 10 seconds
- Mentions something specific about their niche/content
- Explains VoilaLink in one simple sentence
- Offers them a free Pro account in exchange for an honest post or story
- Ends with a simple yes/no question to make replying easy
- Sounds like it comes from a real founder, not a marketing team

Write ONLY the message. No subject line. No "Here is the message:" intro. Just the message itself.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-20240307',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return res.status(500).json({ error: 'Failed to generate message' });
    }

    const data = await response.json();
    const message = data.content[0].text.trim();

    return res.status(200).json({ message });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
