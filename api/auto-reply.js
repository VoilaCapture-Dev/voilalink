// ============================================================
//  VoilaLink — AI Auto-Reply (Vercel Serverless)
//  Uses fetch only — no npm dependencies needed
// ============================================================

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversationId, visitorName, visitorMessage, ownerContext } = req.body || {};

  if (!conversationId || !visitorMessage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl  = process.env.SUPABASE_URL;
  const supabaseKey  = process.env.SUPABASE_SERVICE_KEY;

  if (!anthropicKey) return res.status(500).json({ error: 'AI not configured' });
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Database not configured' });

  const prompt = `You are an AI assistant responding to a visitor message on behalf of a VoilaLink page owner.

Owner context: ${ownerContext || 'A professional with a VoilaLink bio page.'}

Visitor name: ${visitorName || 'Visitor'}
Visitor message: "${visitorMessage}"

Write a short, friendly, helpful auto-reply (2-3 sentences max) that:
- Acknowledges their message
- Gives them useful information based on the owner context
- Lets them know the owner will follow up personally
- Sounds warm and human, not robotic

Write ONLY the message. No quotes, no intro.`;

  try {
    // Generate AI reply using Claude
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error('AI error: ' + errText);
    }
    const aiData = await aiResponse.json();
    const replyText = aiData.content[0].text.trim();

    // Insert reply into messages table via Supabase REST API
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        sender: 'owner',
        content: replyText
      })
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      throw new Error('DB insert error: ' + errText);
    }

    // Update conversation timestamp
    await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
      },
      body: JSON.stringify({ last_message_at: new Date().toISOString() })
    });

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
