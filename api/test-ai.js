// Temporary test endpoint — lists available Anthropic models
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'No API key' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      }
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
