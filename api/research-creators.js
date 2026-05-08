// ============================================================
//  VoilaLink — AI Creator Research (Vercel Serverless)
// ============================================================

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { niche, platform, minFollowers, maxFollowers, count } = req.body || {};

  if (!niche) return res.status(400).json({ error: 'Niche is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are a creator marketing expert. Generate a list of ${count || 10} real ${platform || 'TikTok'} creators in the "${niche}" niche who would be a good fit to promote VoilaLink (a free link-in-bio tool).

Follower range: ${minFollowers || '10K'} to ${maxFollowers || '500K'} followers.

VoilaLink is a free Linktree alternative with better design. It's ideal for creators who share multiple links (YouTube, merch, courses, Instagram, etc.) in their bio.

For each creator, return a JSON array with objects containing:
- name: their display name
- handle: their @handle on ${platform || 'TikTok'}
- platform: "${platform || 'TikTok'}"
- estimated_followers: estimated follower count as a string (e.g. "120K")
- niche_tags: array of 2-3 topic tags
- why_good_fit: one sentence explaining why they'd be a good fit for VoilaLink
- profile_url: their profile URL if you know it, otherwise generate the likely URL from their handle
- confidence: "high", "medium", or "low" — how confident you are this creator exists with these details

IMPORTANT: Only include creators you have reasonable knowledge of. If unsure, mark confidence as "low". Do NOT make up completely fictional creators — use real ones you know from your training data.

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks. Just the raw JSON array starting with [ and ending with ].`;

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
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: 'Claude API error: ' + errorText });
    }

    const data = await response.json();
    let text = data.content[0].text.trim();

    // Strip markdown code blocks if present
    text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '').replace(/\n?```$/, '');

    let creators;
    try {
      creators = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse response', raw: text });
    }

    return res.status(200).json({ creators });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
