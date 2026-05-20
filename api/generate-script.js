import Anthropic from '@anthropic-ai/sdk';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Simple auth — reuse ADMIN_SECRET
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { business, description, views } = req.body;
  if (!business) return res.status(400).json({ error: 'Missing business' });

  try {
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Write a short Instagram Reel script for a Get Biz Idea account.
The video is about this business: "${business}"${description ? ` — ${description}` : ''}.
${views ? `This concept has ${views}M views on similar content.` : ''}

Format EXACTLY like this (no extra text):
HOOK: [One punchy line, max 10 words, includes a number or surprising fact]
BODY: [3 short lines about what the business does, why it works, startup cost]
CTA: Want your own version of this? Take the 90-sec quiz → getbizidea.com

Rules:
- Hook must grab attention in 3 seconds
- Body lines are 8-12 words each
- Tone: direct, exciting, factual
- Include realistic revenue/cost numbers
- English only`
      }]
    });

    const script = msg.content[0].text.trim();
    res.json({ ok: true, script });
  } catch (err) {
    console.error('Generate script error:', err);
    res.status(500).json({ error: err.message });
  }
}
