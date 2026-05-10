// ============================================================
//  VoilaLink — AI Auto-Reply (Vercel Serverless)
//  Generates and sends an automatic reply when owner is away
// ============================================================

const { createClient } = require('@supabase/supabase-js');

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
    // Generate AI reply
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiResponse.ok) throw new Error('AI generation failed');
    const aiData = await aiResponse.json();
    const replyText = aiData.content[0].text.trim();

    // Send the reply as owner message
    const db = createClient(supabaseUrl, supabaseKey);
    const { error } = await db.from('messages').insert({
      conversation_id: conversationId,
      sender: 'owner',
      content: replyText
    });

    if (error) throw error;

    // Update conversation timestamp
    await db.from('conversations').update({
      last_message_at: new Date().toISOString()
    }).eq('id', conversationId);

    return res.status(200).json({ reply: replyText });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
